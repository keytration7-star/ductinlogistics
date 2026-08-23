import type { ZaloZnsSettings, ZnsSendResult, ReconciliationSession, ShopSettlementStatement } from '../types';

export class ZaloZnsService {
  /**
   * Chuẩn hóa số điện thoại Việt Nam sang định dạng quốc tế Zalo yêu cầu (84xxxxxxxxx)
   */
  static normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '84' + clean.slice(1);
    } else if (!clean.startsWith('84') && clean.length >= 9) {
      clean = '84' + clean;
    }
    return clean;
  }

  /**
   * Định dạng số tiền VND
   */
  static formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
  }

  /**
   * Tạo dữ liệu template mẫu cho tin nhắn đối soát Zalo ZNS
   */
  static buildTemplateData(
    statement: ShopSettlementStatement,
    session: ReconciliationSession,
    companyName: string = 'ĐỨC TÍN LOGISTICS'
  ): Record<string, any> {
    const totalFee = statement.totalShopFee + statement.totalShopOtherFee;
    return {
      shop_name: statement.shopName,
      shop_code: statement.shopCode,
      period_name: session.sessionName,
      total_orders: `${statement.totalOrders} đơn`,
      total_cod: this.formatVND(statement.totalCod),
      total_fee: this.formatVND(totalFee),
      total_net_payout: this.formatVND(statement.totalNetPayout),
      bank_name: statement.bankInfo?.bankName || 'Chưa cập nhật',
      account_number: statement.bankInfo?.accountNumber || 'Chưa cập nhật',
      company_name: companyName,
      statement_link: window.location.origin,
      date_now: new Date().toLocaleDateString('vi-VN'),
    };
  }

  /**
   * Gửi tin nhắn ZNS cho 1 Shop
   */
  static async sendSingleZns(
    phone: string,
    statement: ShopSettlementStatement,
    session: ReconciliationSession,
    settings: ZaloZnsSettings
  ): Promise<ZnsSendResult> {
    const normPhone = this.normalizePhoneNumber(phone);
    const sentAt = new Date().toISOString();

    if (!normPhone || normPhone.length < 10) {
      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        phone: phone || '',
        success: false,
        error: 'Số điện thoại không hợp lệ hoặc bị trống',
        sentAt,
      };
    }

    const templateData = this.buildTemplateData(statement, session, settings.companyName);

    // Chế độ Test Mode hoặc Demo (chưa nhập token Zalo thật)
    if (settings.isTestMode || !settings.accessToken) {
      // Giả lập gửi thành công trong môi trường thử nghiệm
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        phone: normPhone,
        success: true,
        messageId: `SIM_ZNS_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sentAt,
      };
    }

    try {
      const response = await fetch('https://business.openapi.zalo.me/message/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': settings.accessToken,
        },
        body: JSON.stringify({
          phone: normPhone,
          template_id: settings.templateId,
          template_data: templateData,
          mode: settings.isTestMode ? 'development' : undefined,
        }),
      });

      const data = await response.json();

      if (data.error === 0) {
        return {
          shopId: statement.shopId,
          shopCode: statement.shopCode,
          shopName: statement.shopName,
          phone: normPhone,
          success: true,
          messageId: data.data?.msg_id || `ZNS_${Date.now()}`,
          sentAt,
        };
      } else {
        return {
          shopId: statement.shopId,
          shopCode: statement.shopCode,
          shopName: statement.shopName,
          phone: normPhone,
          success: false,
          error: data.message || `Lỗi Zalo ZNS (Mã: ${data.error})`,
          sentAt,
        };
      }
    } catch (err) {
      return {
        shopId: statement.shopId,
        shopCode: statement.shopCode,
        shopName: statement.shopName,
        phone: normPhone,
        success: false,
        error: err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ Zalo Cloud API',
        sentAt,
      };
    }
  }

  /**
   * Gửi hàng loạt ZNS cho tất cả Shop trong kỳ
   */
  static async sendBulkZns(
    session: ReconciliationSession,
    statements: ShopSettlementStatement[],
    settings: ZaloZnsSettings,
    onProgress?: (current: number, total: number, latestResult: ZnsSendResult) => void
  ): Promise<ZnsSendResult[]> {
    const results: ZnsSendResult[] = [];
    const total = statements.length;

    for (let i = 0; i < total; i++) {
      const stmt = statements[i];
      const phone = stmt.shopPhone || '';
      
      const res = await this.sendSingleZns(phone, stmt, session, settings);
      results.push(res);

      if (onProgress) {
        onProgress(i + 1, total, res);
      }

      // Giãn cách nhỏ để đảm bảo rate limit API Zalo
      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    return results;
  }
}
