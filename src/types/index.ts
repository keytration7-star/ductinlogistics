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

export interface CtvCommissionRule {
  minWeight: number;
  maxWeight: number;
  commissionPrice: number;
}

export interface CtvProfile {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  assignedCarriers?: string[]; // Carrier IDs CTV manages: ['ALL'] or ['jnt', 'spx', 'ghn']
  bankAccount?: BankAccount;
  commissionRules: CtvCommissionRule[];
  extraWeightStep: number;  // kg
  extraWeightPrice: number; // VND
  active: boolean;
  createdAt: string;
}

export interface CtvReportItem {
  ctvId: string;
  ctvCode: string;
  ctvName: string;
  totalOrders: number;
  totalDelivered: number;
  totalReturned: number;
  totalWeight: number;
  totalCommission: number;
  orders: ReconciledOrder[];
}

export interface ShopPricingPlan {
  id: string;
  name: string;
  description?: string;
  carrierId?: string; // 'all' or specific carrier
  weightRules: WeightStepRule[];
  extraStepWeight: number; // e.g. every 0.5kg or 1kg above max rule
  extraStepPrice: number;  // e.g. +5000 VND
  returnFeeType?: 'free' | 'percent' | 'fixed'; // 3 kiểu hoàn: 'free' (miễn phí), 'percent' (theo % cước gửi), 'fixed' (số tiền cố định)
  returnFeeFixed?: number; // Số tiền hoàn cố định (VND) nếu returnFeeType === 'fixed'
  returnFeePercent: number; // Tỷ lệ % cước hoàn nếu returnFeeType === 'percent'
  insuranceFeePercent: number; // e.g. 0.5% of COD
  declaredFeePercent?: number; // e.g. 0.5% of declared value
  partialDeliveryFee?: number; // e.g. 15000 VND per partial order (GH1P)
  fixedSurcharge: number;  // e.g. 0 VND or 3000 VND
}

export interface Shop {
  id: string;
  code: string; // e.g. "SHOP_A", "SHOP_MINA"
  name: string; // e.g. "Shop Thời Trang Mina"
  phone: string;
  phoneList?: string[]; // Multiple SĐT for exact matching
  nameAliases?: string[]; // Tên shop/nhãn gửi khác, chỉ khớp chính xác với cùng một hồ sơ shop
  email: string;
  emailList?: string[]; // Multiple emails for receiving statements
  telegramChatId?: string; // ID Chat / Nhóm Telegram riêng của Shop
  address: string;
  bankAccount: BankAccount;
  pricingPlan: ShopPricingPlan;
  previousDebt?: number; // Công nợ cũ còn tồn (-/+)
  ctvId?: string;        // ID Cộng tác viên phụ trách shop
  ctvName?: string;      // Tên Cộng tác viên phụ trách shop
  carrierId?: string;    // Mã Đơn vị vận chuyển quản lý shop này (e.g. 'jnt', 'ghn', 'vtp')
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
  additionalFeeColumns?: string[]; // Nhiều cột phụ phí NVC cần cộng cùng lúc
  adjustmentColumn?: string;       // Điều chỉnh tăng/giảm của NVC
  settlementAmountColumn?: string; // Số tiền NVC trả sau khi cấn trừ, dùng để kiểm tra
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
  declaredValueColumn?: string; // Giá trị khai giá
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

export type OrderStatus = 'delivered' | 'returning' | 'returned' | 'in_transit' | 'cancelled' | 'fee_charged' | 'unknown';

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
  nvcSettlementAmount?: number; // Số NVC thực trả sau cấn trừ trong file đối soát
  nvcSettlementVerified?: boolean;
  shopCalculatedFee: number;    // Cước gom đơn tính cho Shop theo bảng giá riêng
  shopOtherFee: number;         // Phí khác/bảo hiểm/hoàn tính cho Shop
  netShopPayout: number;        // Tiền thực trả Shop = COD - Cước Shop - Phí khác
  profitMargin: number;         // Lợi nhuận nhà gom = (Cước Shop + Phí khác) - (Cước NVC + Phí khác NVC)
  status: OrderStatus;          // Trạng thái đơn hàng
  statusText: string;           // Text gốc từ file NVC
  matched: boolean;             // Khớp được với shop hay chưa
  shopMatchMethod?: 'phone' | 'code' | 'name' | 'name_alias' | 'manual_admin'; // Căn cứ phân shop để kiểm tra lại
  matchError?: string;          // Lý do không khớp
  canManualAssignShop?: boolean; // Chỉ cho phép sửa lỗi nhận diện shop, không được bỏ qua lỗi dữ liệu tài chính
  isPartialDelivery?: boolean;  // Đơn GH1P (Giao hàng 1 phần)
  declaredValue?: number;       // Giá trị khai giá
  declaredFee?: number;         // Phí khai giá tính cho shop
  ctvId?: string;               // ID CTV phụ trách
  ctvName?: string;             // Tên CTV
  ctvCommission?: number;       // Tiền hoa hồng CTV được hưởng trên đơn này
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
  voidedAt?: string;          // Thời điểm hủy/đảo bản ghi; không xóa lịch sử tài chính
  voidedByUsername?: string;
  voidedByFullName?: string;
  voidReason?: string;
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
  partialOrders?: number;       // Số đơn GH1P (Giao 1 phần)
  totalCod: number;
  totalShopFee: number;
  totalShopOtherFee: number;
  totalNetPayout: number;       // SỐ TIỀN THỰC CHUYỂN CHO SHOP
  previousDebt?: number;         // Công nợ cũ chưa thanh toán từ các kỳ trước (-/+)
  totalNvcCost: number;         // Tổng chi phí trả NVC cho các đơn của shop này
  totalProfit: number;          // Tổng tiền lãi của nhà gom từ shop này
  totalDeliveredCod?: number;   // Tổng COD đơn giao thành công
  totalDeliveredFee?: number;   // Tổng cước đơn giao thành công
  totalReturnedFee?: number;    // Tổng phí đơn hoàn
  totalPartialCod?: number;     // Tổng COD đơn GH1P
  totalPartialFee?: number;     // Tổng phí đơn GH1P
  orders: ReconciledOrder[];
  emailStatus: 'idle' | 'queued' | 'sending' | 'sent' | 'failed';
  emailSentAt?: string;
  telegramStatus?: 'idle' | 'queued' | 'sending' | 'sent' | 'failed';
  telegramSentAt?: string;
  telegramChatId?: string;
  payoutStatus?: PayoutStatus;
  paidAmount?: number;
  remainingDebt?: number;
  paymentHistory?: PaymentRecord[];
  isSupplementary?: boolean;    // Đơn/Shop bù dữ liệu
  supplementaryNotes?: string;  // Ghi chú bù (e.g. "Bù dữ liệu thiếu kỳ 01/08/2026")
}

export interface ReconciliationSession {
  id: string;
  sessionName: string;          // e.g. "Đối Soát Tuần 1 Tháng 08/2026"
  createdAt: string;
  carrierId: string;
  carrierName: string;
  mode?: '1file' | '2files';    // Chế độ 1 File (GHN/GHTK) hoặc 2 File (J&T)
  nvcFileName: string;
  appFileName?: string;
  mappingSnapshot?: {           // Cấu hình cột đã dùng cho chính kỳ này
    nvc: ColumnMappingConfig;
    app?: ColumnMappingConfig;
  };
  totalOrders: number;
  matchedOrdersCount: number;
  unmatchedOrdersCount: number;
  totalCod: number;
  totalNvcCost: number;
  totalShopRevenue: number;
  totalNetPayout: number;       // Tổng tiền cần chuyển khoản trả tất cả các shop
  totalProfit: number;          // Tổng lợi nhuận ròng của Nhà Gom Đơn
  totalCtvCommission?: number;  // Tổng hoa hồng chi trả CTV trong kỳ
  statements: ShopSettlementStatement[];
  unmatchedOrders: ReconciledOrder[];
  payoutStatus?: PayoutStatus;
  totalPaidAmount?: number;
  totalRemainingDebt?: number;
  isSupplementary?: boolean;    // Kỳ đối soát bù dữ liệu
  supplementaryNotes?: string;  // Ghi chú kỳ bù
}

export interface CarrierEmailTemplateConfig {
  senderName?: string;
  senderEmail?: string;
  emailPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  subjectTemplate?: string;
  bodyTemplate?: string;
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
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramEnabled?: boolean;
  carrierTemplates?: Record<string, CarrierEmailTemplateConfig>; // Per carrier template & sender!
}

export interface TelegramSettings {
  botToken: string;
  defaultChatId: string;
  messageTemplate: string;
  enabled: boolean;
  isSandbox?: boolean;
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  autoAttachExcel?: boolean;
  carrierTemplates?: Record<string, { messageTemplate: string }>;
}

export interface TelegramSendResult {
  shopId: string;
  shopCode: string;
  shopName: string;
  chatId: string;
  success: boolean;
  messageId?: string | number;
  error?: string;
  sentAt: string;
}

export interface ZaloZnsSettings {
  appId: string;
  secretKey: string;
  oaId: string;
  templateId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  isTestMode?: boolean;
  testPhoneNumber?: string;
  companyName?: string;
}

export interface ZnsSendResult {
  shopId: string;
  shopCode: string;
  shopName: string;
  phone: string;
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: string;
}

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'TAX_ACCOUNTANT' | 'STAFF' | 'VIEWER';

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
