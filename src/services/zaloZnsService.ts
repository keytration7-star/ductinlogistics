import type { ZaloZnsSettings, ZnsSendResult, ReconciliationSession, ShopSettlementStatement } from '../types';
import { getAuthHeaders } from './authService';

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
    companyName: string = ''
  ): Record<string, any> {
    const totalFee = (statement.totalShopFee || 0) + (statement.totalShopOtherFee || 0);
    const totalCod = statement.totalCod || 0;
    const totalPayout = statement.totalNetPayout || 0;
    const totalOrders = statement.totalOrders || 0;

    return {
      shop_name: statement.shopName || 'Quý khách',
      shop_code: statement.shopCode || '',
      period_name: session.sessionName || 'Kỳ đối soát',
      total_orders: totalOrders,
      total_cod: totalCod,
      total_fee: totalFee,
      total_net_payout: totalPayout,
      company_name: companyName || 'CÔNG TY TNHH TM&DV TRƯỜNG PHÚC',
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
      const response = await fetch('/api/zalo/send-zns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          accessToken: settings.accessToken,
          templateId: settings.templateId,
          phone: normPhone,
          templateData: templateData,
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
   * Kiểm tra nhanh kết nối ZNS với một số điện thoại thử nghiệm
   */
  static async testConnection(phone: string, settings: ZaloZnsSettings): Promise<{ success: boolean; message: string }> {
    const normPhone = this.normalizePhoneNumber(phone);
    if (!normPhone || normPhone.length < 10) {
      return { success: false, message: 'Số điện thoại thử nghiệm không hợp lệ (cần ít nhất 10 số).' };
    }
    if (!settings.accessToken) {
      return { success: false, message: 'Chưa nhập Access Token Zalo.' };
    }
    if (!settings.templateId) {
      return { success: false, message: 'Chưa nhập Template ID.' };
    }

    try {
      const response = await fetch('/api/zalo/send-zns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          accessToken: settings.accessToken,
          templateId: settings.templateId,
          phone: normPhone,
          templateData: {
            shop_name: 'Shop Thử Nghiệm',
            shop_code: 'TEST01',
            period_name: '21/08 - 24/08/2026',
            total_orders: 10,
            total_cod: 1000000,
            total_fee: 50000,
            total_net_payout: 950000,
            company_name: settings.companyName || 'CÔNG TY TNHH TM&DV TRƯỜNG PHÚC',
          },
          mode: settings.isTestMode ? 'development' : undefined,
        }),
      });

      const data = await response.json();
      if (data.error === 0) {
        return { success: true, message: `Kết nối thành công! Mã tin Zalo: ${data.data?.msg_id || 'OK'}` };
      } else {
        return { success: false, message: `Zalo báo lỗi (${data.error}): ${data.message}` };
      }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Không thể kết nối máy chủ Zalo' };
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
