import type { Shop, CarrierWholesaleTier, ReconciliationSession, EmailSettings, ExportColumnSettings, CompanyInfo, PaymentRecord } from '../types';

const SHOPS_KEY = 'gomdon_shops_v1';
const CARRIERS_KEY = 'gomdon_carriers_v1';
const SESSIONS_KEY = 'gomdon_sessions_v1';
const EMAIL_SETTINGS_KEY = 'gomdon_email_settings_v1';
const COLUMN_MAPPINGS_KEY = 'gomdon_column_mappings_v1';
const COMPANY_INFO_KEY = 'gomdon_company_info_v1';
const EXPORT_COLUMNS_KEY = 'gomdon_export_columns_v1';
const PAYMENTS_KEY = 'gomdon_payments_v1';

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  companyName: 'CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS TRUNG GIAN',
  address: 'Số 123 Đường Nguyễn Trãi, Thanh Xuân, Hà Nội',
  phone: '0988 123 456',
  taxCode: '0101234567',
};

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

export const DEFAULT_EXPORT_COLUMNS: ExportColumnSettings = {
  shopColumns: [
    { id: 'stt', label: 'STT', enabled: true, category: 'basic' },
    { id: 'waybill', label: 'Mã Vận Đơn', enabled: true, category: 'basic' },
    { id: 'date', label: 'Ngày Gửi / Đối Soát', enabled: false, category: 'basic' },
    { id: 'refOrderCode', label: 'Mã Đơn Phụ / Ref', enabled: false, category: 'basic' },
    { id: 'receiverName', label: 'Tên Người Nhận', enabled: true, category: 'receiver' },
    { id: 'receiverPhone', label: 'SĐT Người Nhận', enabled: true, category: 'receiver' },
    { id: 'receiverAddress', label: 'Địa Chỉ Giao Hàng', enabled: true, category: 'receiver' },
    { id: 'productName', label: 'Tên Sản Phẩm / Hàng Hóa', enabled: false, category: 'basic' },
    { id: 'weight', label: 'Khối Lượng (kg)', enabled: true, category: 'basic' },
    { id: 'status', label: 'Trạng Thái Đơn Hàng', enabled: true, category: 'basic' },
    { id: 'codAmount', label: 'Tiền Thu Hộ (COD)', enabled: true, category: 'finance' },
    { id: 'shopFee', label: 'Cước Phí Vận Chuyển', enabled: true, category: 'finance' },
    { id: 'shopOtherFee', label: 'Phí Khác / Phụ Thu / Hoàn', enabled: true, category: 'finance' },
    { id: 'netPayout', label: 'SỐ TIỀN THỰC CHUYỂN SHOP', enabled: true, category: 'finance' },
    { id: 'orderNote', label: 'Ghi Chú Đơn Hàng', enabled: false, category: 'basic' },
  ],
  masterColumns: [
    { id: 'stt', label: 'STT', enabled: true, category: 'basic' },
    { id: 'waybill', label: 'Mã Vận Đơn', enabled: true, category: 'basic' },
    { id: 'carrier', label: 'Đơn Vị Vận Chuyển', enabled: true, category: 'carrier' },
    { id: 'shopName', label: 'Tên Shop / Khách Hàng', enabled: true, category: 'basic' },
    { id: 'shopPhone', label: 'Số ĐT Shop', enabled: true, category: 'basic' },
    { id: 'receiverName', label: 'Người Nhận', enabled: true, category: 'receiver' },
    { id: 'receiverPhone', label: 'SĐT Nhận', enabled: true, category: 'receiver' },
    { id: 'receiverAddress', label: 'Địa Chỉ Nhận', enabled: true, category: 'receiver' },
    { id: 'weight', label: 'Khối Lượng (kg)', enabled: true, category: 'basic' },
    { id: 'status', label: 'Trạng Thái', enabled: true, category: 'basic' },
    { id: 'codAmount', label: 'Tiền Thu Hộ (COD)', enabled: true, category: 'finance' },
    { id: 'shopFee', label: 'Cước Thu Shop', enabled: true, category: 'finance' },
    { id: 'nvcFee', label: 'Cước Gốc Trả NVC', enabled: true, category: 'carrier' },
    { id: 'profit', label: 'LÃI RÒNG NHÀ GOM', enabled: true, category: 'finance' },
    { id: 'netPayout', label: 'Thực Chuyển Cho Shop', enabled: true, category: 'finance' },
    { id: 'matchStatus', label: 'Tình Trạng Khớp Shop', enabled: true, category: 'system' },
  ],
};

// Helper for sending server sync requests asynchronously
async function postServerSync(endpoint: string, body: any) {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn(`[Server Sync Fail] ${endpoint}:`, err);
  }
}

export const StorageService = {
  // 🔄 Sync all data from Server on App Launch
  async syncWithServer(): Promise<boolean> {
    try {
      const res = await fetch('/api/db/all');
      if (!res.ok) return false;
      const result = await res.json();
      if (!result.success || !result.data) return false;

      const { shops, carriers, sessions, companyInfo, emailSettings, exportColumns, carrierData, users, payments } = result.data;

      if (shops && Array.isArray(shops)) {
        localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
      }
      if (carriers && Array.isArray(carriers)) {
        localStorage.setItem(CARRIERS_KEY, JSON.stringify(carriers));
      }
      if (sessions && Array.isArray(sessions)) {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      }
      if (companyInfo && Object.keys(companyInfo).length > 0) {
        localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(companyInfo));
      }
      if (emailSettings && Object.keys(emailSettings).length > 0) {
        localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(emailSettings));
      }
      if (exportColumns && Object.keys(exportColumns).length > 0) {
        localStorage.setItem(EXPORT_COLUMNS_KEY, JSON.stringify(exportColumns));
      }
      if (carrierData && typeof carrierData === 'object') {
        Object.keys(carrierData).forEach(key => {
          localStorage.setItem(key, JSON.stringify(carrierData[key]));
        });
      }
      if (users && Array.isArray(users) && users.length > 0) {
        localStorage.setItem('gomdon_users_v1', JSON.stringify(users));
      }
      if (payments && Array.isArray(payments)) {
        localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
      }

      // First time sync: If server was empty but client had local data, push client data to server!
      if (!shops && this.getShops().length > 0) {
        postServerSync('/api/db/shops', { shops: this.getShops() });
      }
      if (!sessions && this.getSessions().length > 0) {
        postServerSync('/api/db/sessions', { sessions: this.getSessions() });
      }
      const localUsers = localStorage.getItem('gomdon_users_v1');
      if (!users && localUsers) {
        postServerSync('/api/db/users', { users: JSON.parse(localUsers) });
      }

      return true;
    } catch (err) {
      console.warn('[Server Sync Load Fail]:', err);
      return false;
    }
  },

  getShops(): Shop[] {
    const data = localStorage.getItem(SHOPS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveShops(shops: Shop[]): void {
    localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
    postServerSync('/api/db/shops', { shops });
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
    postServerSync('/api/db/carriers', { carriers });
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
    postServerSync('/api/db/sessions', { sessions });
  },

  deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    postServerSync('/api/db/sessions', { sessions });
  },

  clearAllData(): void {
    localStorage.setItem(SHOPS_KEY, JSON.stringify([]));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
    postServerSync('/api/db/shops', { shops: [] });
    postServerSync('/api/db/sessions', { sessions: [] });
  },

  clearSessionsOnly(): void {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
    postServerSync('/api/db/sessions', { sessions: [] });
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
    postServerSync('/api/db/email-settings', { emailSettings: settings });
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

  getCarrierMapping(carrierId: string): { nvc?: any; app?: any } {
    const key = `gomdon_carrier_mapping_${carrierId}`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch { }
    }
    return this.getColumnMappings();
  },

  saveCarrierMapping(carrierId: string, nvcMapping: any, appMapping: any): void {
    const key = `gomdon_carrier_mapping_${carrierId}`;
    const data = { nvc: nvcMapping, app: appMapping };
    localStorage.setItem(key, JSON.stringify(data));
    this.saveColumnMappings(nvcMapping, appMapping);
    
    // Sync carrier mappings to server
    postServerSync('/api/db/carrier-data', {
      carrierData: {
        [key]: data,
        [COLUMN_MAPPINGS_KEY]: data,
      },
    });
  },

  getCarrierHeaders(carrierId: string): { nvcHeaders: string[]; appHeaders: string[] } {
    const key = `gomdon_carrier_headers_${carrierId}`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return {
          nvcHeaders: parsed.nvcHeaders || [],
          appHeaders: parsed.appHeaders || [],
        };
      } catch { }
    }
    return { nvcHeaders: [], appHeaders: [] };
  },

  saveCarrierHeaders(carrierId: string, nvcHeaders: string[], appHeaders: string[]): void {
    const key = `gomdon_carrier_headers_${carrierId}`;
    const data = { nvcHeaders, appHeaders };
    localStorage.setItem(key, JSON.stringify(data));
    postServerSync('/api/db/carrier-data', {
      carrierData: { [key]: data },
    });
  },

  getExportColumnSettings(): ExportColumnSettings {
    const data = localStorage.getItem(EXPORT_COLUMNS_KEY);
    if (!data) {
      return DEFAULT_EXPORT_COLUMNS;
    }
    try {
      const parsed = JSON.parse(data);
      return {
        shopColumns: parsed.shopColumns || DEFAULT_EXPORT_COLUMNS.shopColumns,
        masterColumns: parsed.masterColumns || DEFAULT_EXPORT_COLUMNS.masterColumns,
      };
    } catch {
      return DEFAULT_EXPORT_COLUMNS;
    }
  },

  saveExportColumnSettings(settings: ExportColumnSettings): void {
    localStorage.setItem(EXPORT_COLUMNS_KEY, JSON.stringify(settings));
    postServerSync('/api/db/export-columns', { exportColumns: settings });
  },

  getCarrierExportSettings(carrierId: string): ExportColumnSettings {
    const key = `gomdon_carrier_export_${carrierId}`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return {
          shopColumns: parsed.shopColumns || DEFAULT_EXPORT_COLUMNS.shopColumns,
          masterColumns: parsed.masterColumns || DEFAULT_EXPORT_COLUMNS.masterColumns,
        };
      } catch { }
    }
    return this.getExportColumnSettings();
  },

  saveCarrierExportSettings(carrierId: string, settings: ExportColumnSettings): void {
    const key = `gomdon_carrier_export_${carrierId}`;
    localStorage.setItem(key, JSON.stringify(settings));
    this.saveExportColumnSettings(settings);
    postServerSync('/api/db/carrier-data', {
      carrierData: { [key]: settings },
    });
  },

  getCompanyInfo(): CompanyInfo {
    const data = localStorage.getItem(COMPANY_INFO_KEY);
    if (!data) {
      this.saveCompanyInfo(DEFAULT_COMPANY_INFO);
      return DEFAULT_COMPANY_INFO;
    }
    try {
      return { ...DEFAULT_COMPANY_INFO, ...JSON.parse(data) };
    } catch {
      return DEFAULT_COMPANY_INFO;
    }
  },

  saveCompanyInfo(info: CompanyInfo): void {
    localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(info));
    postServerSync('/api/db/company-info', { companyInfo: info });
  },

  exportDatabaseBackup(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      shops: this.getShops(),
      carriers: this.getCarriers(),
      sessions: this.getSessions(),
      emailSettings: this.getEmailSettings(),
      exportColumns: this.getExportColumnSettings(),
      companyInfo: this.getCompanyInfo(),
    };
    return JSON.stringify(backup, null, 2);
  },

  importDatabaseBackup(jsonString: string): boolean {
    try {
      const backup = JSON.parse(jsonString);
      if (backup.shops) this.saveShops(backup.shops);
      if (backup.carriers) this.saveCarriers(backup.carriers);
      if (backup.sessions) {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(backup.sessions));
        postServerSync('/api/db/sessions', { sessions: backup.sessions });
      }
      if (backup.emailSettings) this.saveEmailSettings(backup.emailSettings);
      if (backup.exportColumns) this.saveExportColumnSettings(backup.exportColumns);
      if (backup.companyInfo) this.saveCompanyInfo(backup.companyInfo);

      postServerSync('/api/db/backup/import', backup);
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  },

  getPaymentRecords(): PaymentRecord[] {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  savePaymentRecord(payment: Omit<PaymentRecord, 'id' | 'paidAt'>): PaymentRecord {
    const payments = this.getPaymentRecords();
    const newRecord: PaymentRecord = {
      ...payment,
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      paidAt: new Date().toISOString(),
    };
    payments.unshift(newRecord);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
    postServerSync('/api/db/payments', { payments });
    return newRecord;
  },

  deletePaymentRecord(paymentId: string): boolean {
    const payments = this.getPaymentRecords();
    const filtered = payments.filter(p => p.id !== paymentId);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(filtered));
    postServerSync('/api/db/payments', { payments: filtered });
    return true;
  },
};
