import type { ShopSettlementStatement, EmailSettings, ReconciliationSession } from '../types';
import { StorageService } from './storage';
import { getAuthHeaders } from './authService';
import { calculateStatementSettlement, calculateLiveOpeningDebtForStatement } from './settlementService';
import * as XLSX from 'xlsx';

export const EmailService = {
  formatMoney(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount);
  },

  getEmailsForStatement(statement: ShopSettlementStatement): string[] {
    return this.getValidShopEmails(statement);
  },

  getValidShopEmails(statement: ShopSettlementStatement): string[] {
    const emailSet = new Set<string>();

    if (statement.shopEmail && statement.shopEmail.trim()) {
      statement.shopEmail.split(/[,;\s]+/).forEach((e: string) => {
        const clean = e.trim();
        if (clean && clean.includes('@')) emailSet.add(clean);
      });
    }

    const shops = StorageService.getShops();
    const liveShop = shops.find(s => 
      s.id === statement.shopId || 
      s.code === statement.shopCode || 
      (s.name && statement.shopName && s.name.trim().toLowerCase() === statement.shopName.trim().toLowerCase())
    );

    if (liveShop) {
      if (liveShop.email && liveShop.email.trim()) {
        liveShop.email.split(/[,;\s]+/).forEach((e: string) => {
          const clean = e.trim();
          if (clean && clean.includes('@')) emailSet.add(clean);
        });
      }
      if (Array.isArray(liveShop.emailList)) {
        liveShop.emailList.forEach((e: any) => {
          if (typeof e === 'string') {
            e.split(/[,;\s]+/).forEach((sub: string) => {
              const clean = sub.trim();
              if (clean && clean.includes('@')) emailSet.add(clean);
            });
          }
        });
      }
    }

    return Array.from(emailSet);
  },

  renderEmail(statement: ShopSettlementStatement, settings: EmailSettings, carrierId?: string, session?: ReconciliationSession): { subject: string; body: string } {
    const allSessions = StorageService.getSessions();
    const allPayments = StorageService.getPaymentRecords();
    const allShops = StorageService.getShops();
    const currentSession = session || allSessions.find(s => (s.statements || []).some((st: ShopSettlementStatement) => st.shopId === statement.shopId && st.periodName === statement.periodName));
    const matchedShop = allShops.find(s => s.id === statement.shopId || s.code === statement.shopCode);

    const liveOpeningDebt = currentSession
      ? calculateLiveOpeningDebtForStatement(statement, currentSession, allSessions, allPayments, matchedShop)
      : (statement.previousDebt || 0);

    const stmtWithLiveDebt = { ...statement, previousDebt: liveOpeningDebt };
    const settlement = calculateStatementSettlement(stmtWithLiveDebt);
    let subject = settings.subjectTemplate;
    let body = settings.bodyTemplate;

    // Check Carrier Specific Template
    if (carrierId && settings.carrierTemplates && settings.carrierTemplates[carrierId]) {
      const cTemplate = settings.carrierTemplates[carrierId];
      if (cTemplate.subjectTemplate) subject = cTemplate.subjectTemplate;
      if (cTemplate.bodyTemplate) body = cTemplate.bodyTemplate;
    }

    const replacements: Record<string, string> = {
      '{TEN_SHOP}': statement.shopName,
      '{MA_SHOP}': statement.shopCode,
      '{KY_DOI_SOAT}': statement.periodName,
      '{TONG_DON}': statement.totalOrders.toLocaleString('vi-VN'),
      '{DON_THANH_CONG}': statement.deliveredOrders.toLocaleString('vi-VN'),
      '{DON_HOAN}': statement.returnedOrders.toLocaleString('vi-VN'),
      '{TONG_COD}': this.formatMoney(statement.totalCod),
      '{TONG_CUOC}': this.formatMoney(statement.totalShopFee),
      '{PHI_KHAC}': this.formatMoney(statement.totalShopOtherFee),
      '{THUC_TRA}': this.formatMoney(settlement.amountPayable),
      '{CONG_NO_DAU_KY}': this.formatMoney(settlement.openingDebt),
      '{SHOP_CON_NO}': this.formatMoney(settlement.amountShopOwes),
      '{NGAN_HANG}': statement.bankInfo.bankName || 'Chưa cập nhật',
      '{SO_TAI_KHOAN}': statement.bankInfo.accountNumber || 'Chưa cập nhật',
      '{CHU_TAI_KHOAN}': statement.bankInfo.accountHolder || statement.shopName,
      '{SDT_SHOP}': statement.shopPhone || '',
      '{EMAIL_SHOP}': statement.shopEmail || '',
    };

    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.split(key).join(value);
      body = body.split(key).join(value);
    }

    return { subject, body };
  },

  renderHtmlEmail(statement: ShopSettlementStatement, settings: EmailSettings, carrierId?: string, session?: ReconciliationSession): string {
    const allSessions = StorageService.getSessions();
    const allPayments = StorageService.getPaymentRecords();
    const allShops = StorageService.getShops();
    const currentSession = session || allSessions.find(s => (s.statements || []).some((st: ShopSettlementStatement) => st.shopId === statement.shopId && st.periodName === statement.periodName));
    const matchedShop = allShops.find(s => s.id === statement.shopId || s.code === statement.shopCode);

    const liveOpeningDebt = currentSession
      ? calculateLiveOpeningDebtForStatement(statement, currentSession, allSessions, allPayments, matchedShop)
      : (statement.previousDebt || 0);

    const stmtWithLiveDebt = { ...statement, previousDebt: liveOpeningDebt };
    const settlement = calculateStatementSettlement(stmtWithLiveDebt);
    const companyInfo = StorageService.getCompanyInfo();
    const companyName = companyInfo?.companyName || settings.senderName || 'CÔNG TY LOGISTICS & GOM ĐƠN';
    const companyAddress = companyInfo?.address || '';
    const companyPhone = companyInfo?.phone || '';
    const companyTax = companyInfo?.taxCode || '';

    // Dynamically render custom text body from user settings template (carrier specific or general)
    const { body: customTextBody } = this.renderEmail(statement, settings, carrierId, session);

    const totalCodStr = this.formatMoney(statement.totalCod);
    const totalFeeStr = this.formatMoney(statement.totalShopFee + statement.totalShopOtherFee);
    const netPayoutStr = this.formatMoney(settlement.amountPayable);

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bảng Kê Đối Soát COD</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Email Card -->
        <table width="100%" max-width="620" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Top Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%); padding: 32px 28px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase; margin-bottom: 6px;">
                      🚚 ${companyName}
                    </div>
                    <div style="font-size: 14px; color: #c7d2fe; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                      BẢNG KÊ ĐỐI SOÁT COD & QUYẾT TOÁN CƯỚC
                    </div>
                    <div style="display: inline-block; margin-top: 14px; background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; padding: 5px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                      📅 Kỳ đối soát: ${statement.periodName}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Custom Body Content Written by User -->
          <tr>
            <td style="padding: 26px 28px 16px;">
              <div style="font-size: 14.5px; line-height: 1.7; color: #334155; white-space: pre-wrap; font-family: inherit;">
                ${customTextBody}
              </div>
            </td>
          </tr>

          <!-- Financial KPI Cards (2x2 Grid) -->
          <tr>
            <td style="padding: 10px 28px 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Card 1: Total Orders -->
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
                      📦 Tổng Sản Lượng
                    </div>
                    <div style="font-size: 20px; font-weight: 800; color: #0f172a;">
                      ${statement.totalOrders.toLocaleString('vi-VN')} <span style="font-size: 13px; font-weight: 500; color: #64748b;">đơn</span>
                    </div>
                    <div style="font-size: 11.5px; color: #16a34a; margin-top: 4px;">
                      ✓ Thành công: <strong>${statement.deliveredOrders}</strong> • Hoàn: <strong>${statement.returnedOrders}</strong>
                    </div>
                  </td>

                  <td width="4%"></td>

                  <!-- Card 2: Total COD -->
                  <td width="48%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; margin-bottom: 6px;">
                      💵 Tổng Thu Hộ (COD)
                    </div>
                    <div style="font-size: 20px; font-weight: 800; color: #1d4ed8;">
                      ${totalCodStr} <span style="font-size: 13px; font-weight: 500;">đ</span>
                    </div>
                    <div style="font-size: 11.5px; color: #3b82f6; margin-top: 4px;">
                      Tiền hàng NVC đã thu từ khách
                    </div>
                  </td>
                </tr>

                <tr><td height="12" colspan="3"></td></tr>

                <tr>
                  <!-- Card 3: Total Shipping Fee -->
                  <td width="48%" style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #c2410c; text-transform: uppercase; margin-bottom: 6px;">
                      🏷️ Tổng Cước Vận Chuyển
                    </div>
                    <div style="font-size: 20px; font-weight: 800; color: #ea580c;">
                      ${totalFeeStr} <span style="font-size: 13px; font-weight: 500;">đ</span>
                    </div>
                    <div style="font-size: 11.5px; color: #f97316; margin-top: 4px;">
                      Đã áp dụng bảng giá sỉ ưu đãi
                    </div>
                  </td>

                  <td width="4%"></td>

                  <!-- Card 4: Net Payout to Shop (Hero Card) -->
                  <td width="48%" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 12px; padding: 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 800; color: #15803d; text-transform: uppercase; margin-bottom: 6px;">
                      💰 THỰC CHUYỂN CHO SHOP
                    </div>
                    <div style="font-size: 22px; font-weight: 900; color: #15803d;">
                      ${netPayoutStr} <span style="font-size: 14px; font-weight: 600;">đ</span>
                    </div>
                    <div style="font-size: 11.5px; color: #166534; margin-top: 4px; font-weight: 600;">
                      ${settlement.amountShopOwes > 0 ? `Shop còn nợ công ty ${this.formatMoney(settlement.amountShopOwes)} đ; chuyển kỳ sau` : '(= COD - Cước + công nợ đầu kỳ)'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bank Account Details Card -->
          <tr>
            <td style="padding: 0 28px 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center;">
                      🏦 THÔNG TIN TÀI KHOẢN NHẬN THANH TOÁN
                    </div>
                    <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 13.5px; color: #475569;">
                      <tr>
                        <td width="130" style="color: #64748b;">Ngân hàng:</td>
                        <td><strong style="color: #0f172a;">${statement.bankInfo.bankName || 'Chưa cập nhật'}</strong></td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Số tài khoản:</td>
                        <td><strong style="color: #4f46e5; font-size: 15px; font-family: monospace;">${statement.bankInfo.accountNumber || 'Chưa cập nhật'}</strong></td>
                      </tr>
                      <tr>
                        <td style="color: #64748b;">Chủ tài khoản:</td>
                        <td><strong style="color: #0f172a; text-transform: uppercase;">${statement.bankInfo.accountHolder || statement.shopName}</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Attachment & Support Notice -->
          <tr>
            <td style="padding: 0 28px 24px;">
              <div style="background-color: #f0fdfa; border: 1px dashed #0d9488; border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #134e4a; line-height: 1.6;">
                📎 <strong>File bảng kê chi tiết đính kèm:</strong> Chi tiết từng mã vận đơn, cân nặng và cước phí được đính kèm trong file Excel: <code style="background: rgba(13,148,136,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 700;">Bang_ke_doi_soat_${statement.shopCode}.xlsx</code>.<br/>
                ⏱️ <em>Quý khách vui lòng kiểm tra và phản hồi lại trước <strong>17h00 hôm nay</strong> nếu có thắc mắc hoặc khiếu nại.</em>
              </div>
            </td>
          </tr>

          <!-- Email Footer Sign-off -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 28px; text-align: center;">
              <div style="font-size: 15px; font-weight: 800; color: #1e1b4b; margin-bottom: 4px;">
                ${companyName}
              </div>
              ${companyAddress ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 3px;">📍 ${companyAddress}</div>` : ''}
              ${companyPhone ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 3px;">📞 Hotline: ${companyPhone} ${companyTax ? `• MST: ${companyTax}` : ''}</div>` : ''}
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin-top: 10px;">
                Email này được tạo và gửi tự động từ hệ thống GomDon Pro Enterprise.<br/>
                Vui lòng không chia sẻ thông tin tài chính đối soát cho bên thứ ba.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  },

  generateMailtoUri(statement: ShopSettlementStatement, settings: EmailSettings): string {
    const { subject, body } = this.renderEmail(statement, settings);
    const email = statement.shopEmail || '';
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  generateExcelBase64(statement: ShopSettlementStatement): string {
    try {
      const exportData = statement.orders.map((o, idx) => ({
        'STT': idx + 1,
        'Mã Vận Đơn': o.waybill,
        'Trạng Thái': o.statusText || o.status,
        'Cân Nặng (kg)': o.weight,
        'Tiền Thu Hộ COD': o.codAmount,
        'Cước Phí Tính Cho Shop': o.shopCalculatedFee,
        'Phí Khác / Hoàn': o.shopOtherFee,
        'Tiền Thực Nhận Của Đơn': o.netShopPayout,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BangKeChiTiet');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      return wbout;
    } catch {
      return '';
    }
  },

  async sendRealEmail(params: {
    senderName: string;
    senderEmail: string;
    emailPassword?: string;
    smtpHost?: string;
    smtpPort?: number;
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments?: Array<{ filename: string; content: string }>;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Không thể kết nối đến máy chủ gửi email nội bộ.',
      };
    }
  },

  async sendBatchEmails(
    statements: ShopSettlementStatement[],
    settings: EmailSettings,
    carrierId?: string,
    onProgress?: (shopId: string, status: 'sending' | 'sent' | 'failed', message?: string) => void
  ): Promise<{ sentCount: number; failedCount: number }> {
    let sentCount = 0;
    let failedCount = 0;

    for (const stmt of statements) {
      if (onProgress) onProgress(stmt.shopId, 'sending');

      const recipientEmails = this.getEmailsForStatement(stmt);
      if (recipientEmails.length === 0) {
        if (onProgress) onProgress(stmt.shopId, 'failed', 'Shop chưa có địa chỉ Email nhận hợp lệ');
        failedCount++;
        continue;
      }

      if (!settings.senderEmail || !settings.emailPassword) {
        if (onProgress) onProgress(stmt.shopId, 'failed', 'Chưa cài đặt Email gửi hoặc Mật khẩu ứng dụng trong bánh răng ⚙️');
        failedCount++;
        continue;
      }

      const { subject, body } = this.renderEmail(stmt, settings, carrierId);
      const htmlBody = this.renderHtmlEmail(stmt, settings, carrierId);
      const attachments = [];

      if (settings.autoAttachExcel) {
        const excelBase64 = this.generateExcelBase64(stmt);
        if (excelBase64) {
          attachments.push({
            filename: `Bang_ke_doi_soat_${stmt.shopCode || stmt.shopName}.xlsx`,
            content: excelBase64,
          });
        }
      }

      const toHeader = recipientEmails.join(', ');

      const res = await this.sendRealEmail({
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        emailPassword: settings.emailPassword,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        to: toHeader,
        subject,
        text: body,
        html: htmlBody,
        attachments,
      });

      if (res.success) {
        if (onProgress) onProgress(stmt.shopId, 'sent', `Đã gửi thành công tới ${recipientEmails.length} mail (${toHeader})`);
        sentCount++;
      } else {
        if (onProgress) onProgress(stmt.shopId, 'failed', res.error || 'Lỗi gửi mail qua SMTP');
        failedCount++;
      }

      // Short delay between batches
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { sentCount, failedCount };
  },
};
