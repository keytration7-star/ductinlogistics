import type { TelegramSettings, TelegramSendResult, ReconciliationSession, ShopSettlementStatement } from "../types";
import { StorageService } from "./storage";
import { calculateStatementSettlement, calculateLiveOpeningDebtForStatement } from "./settlementService";
import { ExcelService } from "./excelService";

export class TelegramService {
  static formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(Math.round(amount));
  }

  static renderTelegramMessage(
    statement: ShopSettlementStatement,
    settings: TelegramSettings,
    session?: ReconciliationSession | null
  ): string {
    const allSessions = StorageService.getSessions();
    const allPayments = StorageService.getPaymentRecords();
    const allShops = StorageService.getShops();
    const currentSession = session || allSessions.find(s => (s.statements || []).some(st => st.shopId === statement.shopId && st.periodName === statement.periodName));
    const matchedShop = allShops.find(s => s.id === statement.shopId || s.code === statement.shopCode);

    const liveOpeningDebt = currentSession
      ? calculateLiveOpeningDebtForStatement(statement, currentSession, allSessions, allPayments, matchedShop)
      : (statement.previousDebt || 0);

    const stmtWithLiveDebt = { ...statement, previousDebt: liveOpeningDebt };
    const settlement = calculateStatementSettlement(stmtWithLiveDebt);

    let template = settings.messageTemplate || `📦 <b>BẢNG KÊ ĐỐI SOÁT COD & CƯỚC PHÍ</b>
━━━━━━━━━━━━━━━━━━━━
🏢 <b>Khách hàng:</b> {TEN_SHOP} ({MA_SHOP})
📅 <b>Kỳ đối soát:</b> {KY_DOI_SOAT}
📊 <b>Tổng đơn:</b> {TONG_DON} đơn (Giao TC: {DON_THANH_CONG} | Hoàn: {DON_HOAN})

💰 <b>Tổng COD thu hộ:</b> +{TONG_COD} đ
🚚 <b>Tổng cước dịch vụ:</b> -{TONG_CUOC} đ
📌 <b>Phí phụ thu / khác:</b> -{PHI_KHAC} đ
🔄 <b>Nợ cũ dồn sang:</b> {CONG_NO_DAU_KY} đ
━━━━━━━━━━━━━━━━━━━━
💵 <b>THỰC CHUYỂN CHO SHOP:</b> <b><u>{THUC_TRA} đ</u></b>
━━━━━━━━━━━━━━━━━━━━
🏦 <b>Thông tin thanh toán:</b>
• Ngân hàng: {NGAN_HANG}
• STK: <code>{SO_TAI_KHOAN}</code>
• Chủ TK: {CHU_TAI_KHOAN}

<i>Cảm ơn Quý khách đã tin tưởng và đồng hành cùng dịch vụ!</i>`;

    const liveBank = (matchedShop?.bankAccount?.accountNumber ? matchedShop.bankAccount : statement.bankInfo) || { bankName: "", accountNumber: "", accountHolder: "" };

    const replacements: Record<string, string> = {
      "{TEN_SHOP}": statement.shopName,
      "{MA_SHOP}": statement.shopCode,
      "{KY_DOI_SOAT}": statement.periodName || currentSession?.sessionName || "Kỳ Đối Soát",
      "{TONG_DON}": (statement.totalOrders || 0).toLocaleString("vi-VN"),
      "{DON_THANH_CONG}": (statement.deliveredOrders || 0).toLocaleString("vi-VN"),
      "{DON_HOAN}": (statement.returnedOrders || 0).toLocaleString("vi-VN"),
      "{TONG_COD}": this.formatVND(statement.totalCod),
      "{TONG_CUOC}": this.formatVND(statement.totalShopFee),
      "{PHI_KHAC}": this.formatVND(statement.totalShopOtherFee),
      "{CONG_NO_DAU_KY}": liveOpeningDebt > 0 ? `+${this.formatVND(liveOpeningDebt)}` : liveOpeningDebt < 0 ? `-${this.formatVND(Math.abs(liveOpeningDebt))}` : "0",
      "{THUC_TRA}": this.formatVND(settlement.amountPayable),
      "{SHOP_CON_NO}": this.formatVND(settlement.amountShopOwes),
      "{NGAN_HANG}": liveBank.bankName || "Chưa cập nhật",
      "{SO_TAI_KHOAN}": liveBank.accountNumber || "Chưa cập nhật",
      "{CHU_TAI_KHOAN}": liveBank.accountHolder || statement.shopName,
      "{SDT_SHOP}": statement.shopPhone || matchedShop?.phone || "",
      "{EMAIL_SHOP}": statement.shopEmail || matchedShop?.email || "",
    };

    for (const [key, value] of Object.entries(replacements)) {
      template = template.split(key).join(value);
    }

    return template;
  }

  static async getBotInfo(botToken: string): Promise<{ success: boolean; botName?: string; username?: string; error?: string }> {
    if (!botToken || !botToken.trim()) {
      return { success: false, error: "Chưa nhập Bot Token" };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
      const data = await res.json();
      if (data.ok && data.result) {
        return {
          success: true,
          botName: data.result.first_name,
          username: data.result.username,
        };
      }
      return { success: false, error: data.description || "Bot Token không hợp lệ" };
    } catch (err: any) {
      return { success: false, error: err.message || "Lỗi kết nối tới máy chủ Telegram" };
    }
  }

  static async testConnection(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
    if (!botToken || !botToken.trim()) return { success: false, error: "Chưa nhập Bot Token" };
    if (!chatId || !chatId.trim()) return { success: false, error: "Chưa nhập Chat ID" };

    try {
      const text = `🤖 <b>THÔNG BÁO KIỂM TRA KẾT NỐI</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ Bot Telegram của bạn đã được kết nối thành công với Hệ thống Kế toán Đối soát!\n⏰ Thời gian: <code>${new Date().toLocaleString("vi-VN")}</code>`;
      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: "HTML",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        return { success: true };
      }
      return { success: false, error: data.description || "Không thể gửi tin nhắn" };
    } catch (err: any) {
      return { success: false, error: err.message || "Lỗi kết nối máy chủ Telegram" };
    }
  }

  static async sendSingleShopTelegram(
    statement: ShopSettlementStatement,
    session: ReconciliationSession | null,
    settings: TelegramSettings,
    overrideChatId?: string,
    sendExcelAttachment: boolean = false
  ): Promise<TelegramSendResult> {
    const allShops = StorageService.getShops();
    const matchedShop = allShops.find(s => s.id === statement.shopId || s.code === statement.shopCode);
    const targetChatId = (overrideChatId || statement.telegramChatId || matchedShop?.telegramChatId || settings.defaultChatId || "").trim();
    const sentAt = new Date().toISOString();

    if (!targetChatId) {
      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        chatId: "",
        success: false,
        error: "Chưa có Telegram Chat ID (Vui lòng nhập Chat ID hoặc cấu hình Chat ID mặc định)",
        sentAt,
      };
    }

    const messageText = this.renderTelegramMessage(statement, settings, session);

    if (settings.isSandbox || !settings.botToken || !settings.botToken.trim()) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        chatId: targetChatId,
        success: true,
        messageId: `SIM_TG_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sentAt,
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${settings.botToken.trim()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: messageText,
          parse_mode: "HTML",
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        return {
          shopId: statement.shopId,
          shopCode: statement.shopCode,
          shopName: statement.shopName,
          chatId: targetChatId,
          success: false,
          error: data.description || "Lỗi gửi tin nhắn Telegram",
          sentAt,
        };
      }

      if (sendExcelAttachment && session) {
        try {
          const exportSettings = StorageService.getExportColumnSettings();
          const workbook = await ExcelService.createShopStatementWorkbook(statement, exportSettings);
          const buffer = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const formData = new FormData();
          formData.append("chat_id", targetChatId);
          formData.append("document", blob, `Bang_Ke_Doi_Soat_${statement.shopCode}_${statement.periodName || "Ky"}.xlsx`);
          formData.append("caption", `📊 File chi tiết đối soát Shop: <b>${statement.shopName}</b>`);
          formData.append("parse_mode", "HTML");

          await fetch(`https://api.telegram.org/bot${settings.botToken.trim()}/sendDocument`, {
            method: "POST",
            body: formData,
          });
        } catch (excelErr) {
          console.warn("Could not attach Excel file to Telegram message:", excelErr);
        }
      }

      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        chatId: targetChatId,
        success: true,
        messageId: data.result?.message_id,
        sentAt,
      };
    } catch (err: any) {
      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        chatId: targetChatId,
        success: false,
        error: err.message || "Lỗi mạng khi gọi Telegram API",
        sentAt,
      };
    }
  }

  static async sendBatchTelegram(
    statements: ShopSettlementStatement[],
    session: ReconciliationSession | null,
    settings: TelegramSettings,
    onProgress: (progress: { sent: number; total: number; success: number; failed: number; currentShopName: string }) => void,
    sendIntervalSec: number = 1.5,
    sendExcelAttachment: boolean = false
  ): Promise<TelegramSendResult[]> {
    const results: TelegramSendResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      onProgress({
        sent: i,
        total: statements.length,
        success: successCount,
        failed: failedCount,
        currentShopName: stmt.shopName,
      });

      const res = await this.sendSingleShopTelegram(stmt, session, settings, undefined, sendExcelAttachment);
      results.push(res);

      if (res.success) successCount++;
      else failedCount++;

      if (i < statements.length - 1 && sendIntervalSec > 0) {
        await new Promise(resolve => setTimeout(resolve, sendIntervalSec * 1000));
      }
    }

    onProgress({
      sent: statements.length,
      total: statements.length,
      success: successCount,
      failed: failedCount,
      currentShopName: "Hoàn tất",
    });

    return results;
  }
}
