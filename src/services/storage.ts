import type { Shop, CarrierWholesaleTier, ReconciliationSession, EmailSettings, ExportColumnSettings, CompanyInfo, PaymentRecord, CtvProfile } from '../types';
import { getAuthHeaders } from './authService';

const SHOPS_KEY = 'gomdon_shops_v1';
const CARRIERS_KEY = 'gomdon_carriers_v1';
const SESSIONS_KEY = 'gomdon_sessions_v1';
const EMAIL_SETTINGS_KEY = 'gomdon_email_settings_v1';
const COLUMN_MAPPINGS_KEY = 'gomdon_column_mappings_v1';
const COMPANY_INFO_KEY = 'gomdon_company_info_v1';
const EXPORT_COLUMNS_KEY = 'gomdon_export_columns_v1';
const PAYMENTS_KEY = 'gomdon_payments_v1';

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  companyName: 'CÔNG TY TNHH LOGISTICS & GOM ĐƠN',
  address: 'Địa chỉ trụ sở công ty',
  phone: '0988 000 000',
  taxCode: '0100000000',
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
      { minWeight: 0, maxWeight: 1, price: 11000 },
      { minWeight: 1, maxWeight: 3, price: 17000 },
      { minWeight: 3, maxWeight: 5, price: 25000 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 0,
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
    const authHeaders = getAuthHeaders();
    if (!authHeaders.Authorization) return; // Skip sync if not logged in
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Quiet failure in offline/local mode
  }
}

export const StorageService = {
  // 🔄 Sync all data from Server on App Launch
  async syncWithServer(): Promise<boolean> {
    try {
      const authHeaders = getAuthHeaders();
      if (!authHeaders.Authorization) return false; // Skip server sync if no token present
      const res = await fetch('/api/db/all', { headers: authHeaders });
      if (!res.ok) return false;
      const result = await res.json();
      if (!result.success || !result.data) return false;

      const { shops, carriers, sessions, companyInfo, emailSettings, exportColumns, carrierData, users, payments, ctvs, auditLogs } = result.data;

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
        const localSettings = this.getEmailSettings();
        if (!emailSettings.emailPassword && localSettings.emailPassword) {
          emailSettings.emailPassword = localSettings.emailPassword;
        }
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
      if (ctvs && Array.isArray(ctvs)) {
        localStorage.setItem('gomdon_ctvs_v1', JSON.stringify(ctvs));
      }
      if (auditLogs && Array.isArray(auditLogs)) {
        localStorage.setItem('gomdon_audit_logs_v1', JSON.stringify(auditLogs));
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
      const localPayments = localStorage.getItem(PAYMENTS_KEY);
      if (!payments && localPayments) {
        postServerSync('/api/db/payments', { payments: JSON.parse(localPayments) });
      }
      const localCtvs = localStorage.getItem('gomdon_ctvs_v1');
      if (!ctvs && localCtvs) {
        postServerSync('/api/db/ctvs', { ctvs: JSON.parse(localCtvs) });
      }
      const localLogs = localStorage.getItem('gomdon_audit_logs_v1');
      if (!auditLogs && localLogs) {
        postServerSync('/api/db/audit-logs', { logs: JSON.parse(localLogs) });
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
      const parsed: Shop[] = JSON.parse(data);
      return parsed.map(s => ({
        ...s,
        carrierId: s.carrierId || 'jnt',
      }));
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
      const sessions: ReconciliationSession[] = JSON.parse(data);
      // Never infer or overwrite financial values while loading history. A zero
      // NVC fee is a valid business value (already charged in a previous
      // settlement), not corrupt data that can be replaced with a default fee.
      return sessions;
    } catch {
      return [];
    }
  },

  saveSession(session: ReconciliationSession): void {
    // Clean raw bulky Excel objects before saving to localStorage to stay within browser 5MB quota
    const cleanSession: ReconciliationSession = {
      ...session,
      statements: session.statements.map(stmt => ({
        ...stmt,
        orders: stmt.orders.map(o => {
          const { rawNvcData: _rawNvcData, rawAppData: _rawAppData, ...cleanOrder } = o;
          return cleanOrder;
        })
      })),
      unmatchedOrders: session.unmatchedOrders.map(o => {
        const { rawNvcData: _rawNvcData, rawAppData: _rawAppData, ...cleanOrder } = o;
        return cleanOrder;
      })
    };

    const sessions = this.getSessions();
    const index = sessions.findIndex(s => s.id === cleanSession.id);
    if (index >= 0) {
      sessions[index] = cleanSession;
    } else {
      sessions.unshift(cleanSession);
    }

    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch (err) {
      // Financial history must never be sacrificed to make browser cache fit.
      // The individual session is still upserted to the server below; a reload
      // will retrieve it through syncWithServer once storage is available.
      console.error('[LocalStorage Quota Error] Không lưu được bản sao cục bộ; không xóa bất kỳ kỳ đối soát cũ nào.', err);
    }

    // Granular server upsert keeps the authoritative history independently of
    // browser cache capacity.
    postServerSync('/api/db/sessions/upsert', { session: cleanSession });
  },

  deleteSession(sessionId: string): void {
    const sessions = this.getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    postServerSync('/api/db/sessions/delete', { id: sessionId });
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

  // Deliberate operational reset: preserves master data (shops, pricing,
  // carriers, accounts and mappings) while clearing transactional history.
  async clearOperationalData(): Promise<void> {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify([]));
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify([]));
    localStorage.setItem('gomdon_audit_logs_v1', JSON.stringify([]));
    await Promise.all([
      postServerSync('/api/db/sessions', { sessions: [] }),
      postServerSync('/api/db/payments', { payments: [] }),
      postServerSync('/api/db/audit-logs', { logs: [] }),
    ]);
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
      version: '2.0',
      exportedAt: new Date().toISOString(),
      shops: this.getShops(),
      carriers: this.getCarriers(),
      sessions: this.getSessions(),
      emailSettings: this.getEmailSettings(),
      exportColumns: this.getExportColumnSettings(),
      companyInfo: this.getCompanyInfo(),
      payments: this.getPaymentRecords(),
      ctvs: this.getCtvs(),
      users: (() => {
        try {
          const raw = localStorage.getItem('gomdon_users_v1');
          return raw ? JSON.parse(raw) : [];
        } catch { return []; }
      })(),
      auditLogs: (() => {
        try {
          const raw = localStorage.getItem('gomdon_audit_logs_v1');
          return raw ? JSON.parse(raw) : [];
        } catch { return []; }
      })(),
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
      if (backup.payments) {
        localStorage.setItem(PAYMENTS_KEY, JSON.stringify(backup.payments));
        postServerSync('/api/db/payments', { payments: backup.payments });
      }
      if (backup.ctvs) this.saveCtvs(backup.ctvs);
      if (backup.users) {
        localStorage.setItem('gomdon_users_v1', JSON.stringify(backup.users));
        postServerSync('/api/db/users', { users: backup.users });
      }
      if (backup.auditLogs) {
        localStorage.setItem('gomdon_audit_logs_v1', JSON.stringify(backup.auditLogs));
        postServerSync('/api/db/audit-logs', { logs: backup.auditLogs });
      }

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

  voidPaymentRecord(paymentId: string, voidedByUsername: string, voidedByFullName: string, voidReason: string): boolean {
    const payments = this.getPaymentRecords();
    const index = payments.findIndex(payment => payment.id === paymentId);
    if (index < 0 || payments[index].voidedAt) return false;
    payments[index] = {
      ...payments[index],
      voidedAt: new Date().toISOString(),
      voidedByUsername,
      voidedByFullName,
      voidReason,
    };
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
    postServerSync('/api/db/payments', { payments });
    return true;
  },

  getCtvs(): CtvProfile[] {
    const raw = localStorage.getItem('gomdon_ctvs_v1');
    // Never create a fictional CTV in a financial application. A missing
    // configuration means no CTV commission is payable until Admin adds one.
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveCtvs(ctvs: CtvProfile[]): void {
    localStorage.setItem('gomdon_ctvs_v1', JSON.stringify(ctvs));
    postServerSync('/api/db/ctvs', { ctvs });
  },

  calculateCtvCommission(ctv: CtvProfile, weightKg: number, carrierId?: string): number {
    if (!ctv || !ctv.active || !ctv.commissionRules || ctv.commissionRules.length === 0) {
      return 0;
    }

    // Check Carrier Scope Assignment (Hãng vận chuyển phụ trách)
    if (carrierId && ctv.assignedCarriers && ctv.assignedCarriers.length > 0) {
      const isAll = ctv.assignedCarriers.includes('ALL') || ctv.assignedCarriers.includes('all');
      if (!isAll) {
        const normCarrier = carrierId.trim().toLowerCase();
        const isMatched = ctv.assignedCarriers.some(c => c.trim().toLowerCase() === normCarrier);
        if (!isMatched) {
          return 0; // CTV không phụ trách hãng vận chuyển này!
        }
      }
    }

    const weight = Math.max(0, weightKg || 0);

    // Sorted rules by max weight
    const sorted = [...ctv.commissionRules].sort((a, b) => a.maxWeight - b.maxWeight);
    for (const rule of sorted) {
      if (weight >= rule.minWeight && weight <= rule.maxWeight) {
        return rule.commissionPrice;
      }
    }

    // Exceeds maximum defined rule -> calculate extra steps
    const maxRule = sorted[sorted.length - 1];
    if (weight > maxRule.maxWeight) {
      const basePrice = maxRule.commissionPrice;
      const extraWeight = weight - maxRule.maxWeight;
      const step = ctv.extraWeightStep > 0 ? ctv.extraWeightStep : 1;
      const stepsCount = Math.ceil(extraWeight / step);
      return basePrice + (stepsCount * (ctv.extraWeightPrice || 0));
    }

    return 0;
  },

  // 📸 SERVER SNAPSHOT BACKUP & RECOVERY APIs
  async getServerSnapshots(): Promise<{ filename: string; sizeBytes: number; createdAt: string; modifiedAt: string }[]> {
    try {
      const res = await fetch('/api/db/snapshots', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.snapshots || [];
    } catch {
      return [];
    }
  },

  async restoreServerSnapshot(filename: string): Promise<boolean> {
    try {
      const res = await fetch('/api/db/snapshots/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success) {
        await this.syncWithServer();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async createManualServerSnapshot(): Promise<boolean> {
    try {
      const res = await fetch('/api/db/snapshots/create', { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.success;
    } catch {
      return false;
    }
  },
};
