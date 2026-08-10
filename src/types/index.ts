export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  taxCode: string;
  website?: string;
}

export interface WeightStepRule {
  minWeight: number; // e.g. 0 kg
  maxWeight: number; // e.g. 1 kg
  price: number;     // e.g. 25000 VND
}

export interface ShopPricingPlan {
  id: string;
  name: string;
  description?: string;
  carrierId?: string; // 'all' or specific carrier
  weightRules: WeightStepRule[];
  extraStepWeight: number; // e.g. every 0.5kg or 1kg above max rule
  extraStepPrice: number;  // e.g. +5000 VND
  returnFeePercent: number; // e.g. 50% of shipping fee or 0%
  insuranceFeePercent: number; // e.g. 0.5% of COD
  fixedSurcharge: number;  // e.g. 0 VND or 3000 VND
}

export interface Shop {
  id: string;
  code: string; // e.g. "SHOP_A", "SHOP_MINA"
  name: string; // e.g. "Shop Thời Trang Mina"
  phone: string;
  email: string;
  address: string;
  bankAccount: BankAccount;
  pricingPlan: ShopPricingPlan;
  previousDebt?: number; // Công nợ cũ còn tồn (-/+)
  notes?: string;
  createdAt: string;
  active: boolean;
}

export interface CarrierWholesaleTier {
  id: string;
  carrierId: string;
  carrierName: string; // e.g. "Giao Hàng Tiết Kiệm (GHTK)", "Giao Hàng Nhanh (GHN)", "Viettel Post", "J&T Express", "Shopee Xpress (SPX)"
  weightRules: WeightStepRule[];
  extraStepWeight: number;
  extraStepPrice: number;
  returnFeePercent: number;
  columnMapping?: {
    nvc?: ColumnMappingConfig;
    app?: ColumnMappingConfig;
  };
  exportColumns?: ExportColumnSettings;
}

export interface CustomColumnMapping {
  id: string;
  label: string;
  excelColumn: string;
  fileType: 'nvc' | 'app';
}

export interface ColumnMappingConfig {
  waybillColumn: string;
  codColumn?: string;
  feeColumn?: string;
  weightColumn?: string;
  statusColumn?: string;
  otherFeeColumn?: string;
  dateColumn?: string;
  refOrderCodeColumn?: string;
  shopNameColumn?: string;
  shopPhoneColumn?: string;
  shopAddressColumn?: string;
  shopCodeColumn?: string;
  receiverNameColumn?: string;
  receiverPhoneColumn?: string;
  receiverAddressColumn?: string;
  receiverCityColumn?: string;
  receiverDistrictColumn?: string;
  productNameColumn?: string;
  orderNoteColumn?: string;
  customColumns?: CustomColumnMapping[];
}

export interface ExportColumnItem {
  id: string;
  label: string;
  enabled: boolean;
  category: 'basic' | 'receiver' | 'finance' | 'carrier' | 'system' | 'custom';
  sourceHeader?: string; // Tên cột thực tế quét được từ File NVC hoặc File App
}

export interface ExportColumnSettings {
  shopColumns: ExportColumnItem[];
  masterColumns: ExportColumnItem[];
}

export type OrderStatus = 'delivered' | 'returning' | 'returned' | 'in_transit' | 'cancelled' | 'unknown';

export interface ReconciledOrder {
  id: string;
  waybill: string;              // Mã vận đơn (GH123, VTP456...)
  carrierId: string;            // NVC
  shopId?: string;              // ID shop trong hệ thống
  shopName: string;             // Tên Shop
  shopPhone: string;            // SĐT Shop
  shopAddress: string;          // Địa chỉ Shop
  receiverName: string;         // Tên Người Nhận
  receiverPhone: string;        // SĐT Người Nhận
  receiverAddress: string;      // Địa chỉ Người Nhận
  productName?: string;         // Tên Sản Phẩm / Hàng Hóa
  weight: number;               // Khối lượng (kg)
  codAmount: number;            // Tiền COD thu hộ
  nvcBaseFee: number;           // Cước NVC tính cho nhà gom
  nvcOtherFee: number;          // Phí khác NVC
  shopCalculatedFee: number;    // Cước gom đơn tính cho Shop theo bảng giá riêng
  shopOtherFee: number;         // Phí khác/bảo hiểm/hoàn tính cho Shop
  netShopPayout: number;        // Tiền thực trả Shop = COD - Cước Shop - Phí khác
  profitMargin: number;         // Lợi nhuận nhà gom = (Cước Shop + Phí khác) - (Cước NVC + Phí khác NVC)
  status: OrderStatus;          // Trạng thái đơn hàng
  statusText: string;           // Text gốc từ file NVC
  matched: boolean;             // Khớp được với shop hay chưa
  matchError?: string;          // Lý do không khớp
  rawNvcData?: Record<string, any>;
  rawAppData?: Record<string, any>;
}

export type PayoutStatus = 'UNPAID' | 'HOLD' | 'PARTIAL' | 'PAID';

export interface PaymentRecord {
  id: string;
  sessionId: string;
  sessionName?: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  amount: number;             // Số tiền đã chuyển khoản qua ngân hàng
  paidAt: string;             // Thời gian đi tiền
  paidByUsername: string;     // Kế toán / Admin thực hiện
  paidByFullName: string;
  bankName?: string;          // Ngân hàng chuyển
  transactionRef?: string;    // Mã giao dịch ngân hàng (FT...)
  note?: string;              // Ghi chú thanh toán
}

export interface ShopSettlementStatement {
  shopId: string;
  shopCode: string;
  shopName: string;
  shopPhone: string;
  shopEmail: string;
  shopAddress: string;
  bankInfo: BankAccount;
  periodName: string;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  inTransitOrders: number;
  totalCod: number;
  totalShopFee: number;
  totalShopOtherFee: number;
  totalNetPayout: number;       // SỐ TIỀN THỰC CHUYỂN CHO SHOP
  previousDebt?: number;         // Công nợ cũ chưa thanh toán từ các kỳ trước (-/+)
  totalNvcCost: number;         // Tổng chi phí trả NVC cho các đơn của shop này
  totalProfit: number;          // Tổng tiền lãi của nhà gom từ shop này
  orders: ReconciledOrder[];
  emailStatus: 'idle' | 'queued' | 'sending' | 'sent' | 'failed';
  emailSentAt?: string;
  payoutStatus?: PayoutStatus;
  paidAmount?: number;
  remainingDebt?: number;
  paymentHistory?: PaymentRecord[];
}

export interface ReconciliationSession {
  id: string;
  sessionName: string;          // e.g. "Đối Soát Tuần 1 Tháng 08/2026"
  createdAt: string;
  carrierId: string;
  carrierName: string;
  nvcFileName: string;
  appFileName: string;
  totalOrders: number;
  matchedOrdersCount: number;
  unmatchedOrdersCount: number;
  totalCod: number;
  totalNvcCost: number;
  totalShopRevenue: number;
  totalNetPayout: number;       // Tổng tiền cần chuyển khoản trả tất cả các shop
  totalProfit: number;          // Tổng lợi nhuận ròng của Nhà Gom Đơn
  statements: ShopSettlementStatement[];
  unmatchedOrders: ReconciledOrder[];
  payoutStatus?: PayoutStatus;
  totalPaidAmount?: number;
  totalRemainingDebt?: number;
}

export interface EmailSettings {
  senderName: string;
  senderEmail: string;
  emailPassword?: string; // Mật khẩu ứng dụng / App Password
  smtpHost?: string;      // e.g. "smtp.gmail.com"
  smtpPort?: number;      // e.g. 465 or 587
  subjectTemplate: string;
  bodyTemplate: string;
  autoAttachExcel: boolean;
}

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'VIEWER';

export interface UserAccount {
  id: string;
  username: string;
  password?: string; // Stored securely in storage
  fullName: string;
  role: UserRole;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  // 🛡️ Device & Security Management
  activeDeviceId?: string;
  activeDeviceName?: string;
  activeIp?: string;
  lastActiveAt?: string;
  singleDeviceOnly?: boolean; // Restrict account to single device
  maskPhoneNumbers?: boolean;  // Mask sensitive customer phone numbers
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  ip?: string;
  deviceName?: string;
  details?: string;
}
