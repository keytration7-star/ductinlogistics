import type { Shop, CarrierWholesaleTier, ReconciliationSession, EmailSettings } from '../types';

const SHOPS_KEY = 'gomdon_shops_v1';
const CARRIERS_KEY = 'gomdon_carriers_v1';
const SESSIONS_KEY = 'gomdon_sessions_v1';
const EMAIL_SETTINGS_KEY = 'gomdon_email_settings_v1';
const COLUMN_MAPPINGS_KEY = 'gomdon_column_mappings_v1';

export const DEFAULT_CARRIER_TIERS: CarrierWholesaleTier[] = [
  {
    id: 'ghtk_tier',
    carrierId: 'ghtk',
    carrierName: 'Giao Hàng Tiết Kiệm (GHTK)',
    weightRules: [
      { minWeight: 0, maxWeight: 1, price: 20000 },
      { minWeight: 1, maxWeight: 3, price: 25000 },
      { minWeight: 3, maxWeight: 5, price: 30000 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 0,
  },
  {
    id: 'ghn_tier',
    carrierId: 'ghn',
    carrierName: 'Giao Hàng Nhanh (GHN)',
    weightRules: [
      { minWeight: 0, maxWeight: 1, price: 20000 },
      { minWeight: 1, maxWeight: 3, price: 25000 },
      { minWeight: 3, maxWeight: 5, price: 30000 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 50,
  },
  {
    id: 'vtp_tier',
    carrierId: 'vtp',
    carrierName: 'Viettel Post',
    weightRules: [
      { minWeight: 0, maxWeight: 1, price: 19000 },
      { minWeight: 1, maxWeight: 3, price: 24000 },
      { minWeight: 3, maxWeight: 5, price: 29000 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 50,
  },
  {
    id: 'jnt_tier',
    carrierId: 'jnt',
    carrierName: 'J&T Express',
    weightRules: [
      { minWeight: 0, maxWeight: 1, price: 20000 },
      { minWeight: 1, maxWeight: 3, price: 25000 },
      { minWeight: 3, maxWeight: 5, price: 30000 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 50,
  },
  {
    id: 'spx_tier',
    carrierId: 'spx',
    carrierName: 'SPX Express (Shopee Xpress)',
    weightRules: [
      { minWeight: 0, maxWeight: 1, price: 19500 },
      { minWeight: 1, maxWeight: 3, price: 24500 },
      { minWeight: 3, maxWeight: 5, price: 29500 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 50,
  },
];

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  senderName: 'Công Ty Gom Đơn Trung Gian & Logistics',
  senderEmail: 'doisoat.gomdon@gmail.com',
  emailPassword: '',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  subjectTemplate: '【BẢNG KÊ ĐỐI SOÁT COD】{TEN_SHOP} - Kỳ {KY_DOI_SOAT}',
  bodyTemplate: `Kính gửi Quý Khách hàng {TEN_SHOP},

Công ty chúng tôi xin gửi đến Quý khách bảng kê đối soát tiền thu hộ (COD) và cước phí vận chuyển kỳ {KY_DOI_SOAT}.

THÔNG TIN TỔNG HỢP ĐỐI SOÁT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Tổng số đơn hàng: {TONG_DON} đơn
• Tổng tiền thu hộ (COD): {TONG_COD} đ
• Tổng cước phí vận chuyển: {TONG_CUOC} đ
• Phí khác/Phụ thu/Hoàn: {PHI_KHAC} đ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ SỐ TIỀN THỰC CHUYỂN CHO SHOP: {THUC_TRA} đ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THÔNG TIN TÀI KHOẢN NHẬN TIỀN:
• Ngân hàng: {NGAN_HANG}
• Số tài khoản: {SO_TAI_KHOAN}
• Chủ tài khoản: {CHU_TAI_KHOAN}

Chi tiết từng mã vận đơn, cân nặng và cước phí được đính kèm chi tiết trong file Excel đính kèm. Quý khách vui lòng kiểm tra và phản hồi trước 17h00 hôm nay nếu có khiếu nại.

Trân trọng cảm ơn Quý khách đã luôn đồng hành cùng chúng tôi!
Phòng Kế Toán - Đối Soát Vận Chuyển`,
  autoAttachExcel: true,
};

export const StorageService = {
  getShops(): Shop[] {
    const data = localStorage.getItem(SHOPS_KEY);
    if (!data) {
      return [];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveShops(shops: Shop[]): void {
    localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
  },

  getCarriers(): CarrierWholesaleTier[] {
    const data = localStorage.getItem(CARRIERS_KEY);
    if (!data) {
      this.saveCarriers(DEFAULT_CARRIER_TIERS);
      return DEFAULT_CARRIER_TIERS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_CARRIER_TIERS;
    }
  },

  saveCarriers(carriers: CarrierWholesaleTier[]): void {
    localStorage.setItem(CARRIERS_KEY, JSON.stringify(carriers));
  },

  getSessions(): ReconciliationSession[] {
    const data = localStorage.getItem(SESSIONS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveSession(session: ReconciliationSession): void {
    const sessions = this.getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },

  clearAllData(): void {
    localStorage.setItem(SHOPS_KEY, JSON.stringify([]));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
  },

  clearSessionsOnly(): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
  },

  getEmailSettings(): EmailSettings {
    const data = localStorage.getItem(EMAIL_SETTINGS_KEY);
    if (!data) {
      this.saveEmailSettings(DEFAULT_EMAIL_SETTINGS);
      return DEFAULT_EMAIL_SETTINGS;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_EMAIL_SETTINGS;
    }
  },

  saveEmailSettings(settings: EmailSettings): void {
    localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
  },

  getColumnMappings(): { nvc?: any; app?: any } {
    const data = localStorage.getItem(COLUMN_MAPPINGS_KEY);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  },

  saveColumnMappings(nvcMapping: any, appMapping: any): void {
    const data = { nvc: nvcMapping, app: appMapping };
    localStorage.setItem(COLUMN_MAPPINGS_KEY, JSON.stringify(data));
  },

  exportDatabaseBackup(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shops: this.getShops(),
      carriers: this.getCarriers(),
      sessions: this.getSessions(),
      emailSettings: this.getEmailSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  importDatabaseBackup(jsonString: string): boolean {
    try {
      const backup = JSON.parse(jsonString);
      if (backup.shops) this.saveShops(backup.shops);
      if (backup.carriers) this.saveCarriers(backup.carriers);
      if (backup.sessions) localStorage.setItem(SESSIONS_KEY, JSON.stringify(backup.sessions));
      if (backup.emailSettings) this.saveEmailSettings(backup.emailSettings);
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  },
};
