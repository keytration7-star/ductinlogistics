import type { ColumnMappingConfig } from '../types';

export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const ALIASES = {
  waybill: [
    'ma_van_don', 'mvd', 'tracking_number', 'tracking_code', 'ma_don', 'ma_don_hang',
    'ma_phieu_gui', 'ma_buu_gui', 'order_code', 'tracking', 'ma_bill', 'so_hieu',
    'so_hieu_buu_gui', 'ma_kien_hang', 'waybill'
  ],
  cod: [
    'tien_thu_ho', 'cod', 'tien_cod', 'thu_ho', 'so_tien_cod', 'tien_tra_nguoi_gui',
    'tien_cod_thuc_nhan', 'so_tien_thu_ho', 'tong_cod', 'cod_thu_ho', 'so_tien_thu',
    'cod_amount', 'collect_amount'
  ],
  fee: [
    'cuoc_phi', 'tong_cuoc', 'cuoc_van_chuyen', 'phi_van_chuyen', 'cuoc_chinh',
    'phi_dich_vu', 'tong_phi', 'cuoc_thuc_te', 'cuoc_phi_goc', 'cuoc_nvc',
    'shipping_fee', 'fee', 'tong_tien_cuoc', 'cuoc_tam_tinh'
  ],
  otherFee: [
    'phi_khac', 'phu_phi', 'phi_bao_hiem', 'phi_chuyen_hoan', 'phi_hoan',
    'phi_giao_lai', 'phi_kiem_dem', 'phu_phi_vung_xa', 'other_fee', 'surcharge'
  ],
  weight: [
    'khoi_luong', 'trong_luong', 'can_nang', 'khoi_luong_tinh_cuoc', 'kl_quy_doi',
    'weight', 'gross_weight', 'khoi_luong_kg', 'trong_luong_kg', 'can_nang_kg',
    'khoi_luong_gram', 'trong_luong_g', 'can_nang_gram', 'kg'
  ],
  status: [
    'trang_thai', 'tinh_trang', 'ket_qua_giao', 'trang_thai_don', 'trang_thai_giao_hang',
    'status', 'delivery_status', 'ket_qua', 'trang_thai_doi_soat', 'ghi_chu'
  ],
  shopName: [
    'ten_shop', 'shop_name', 'ten_nguoi_gui', 'ho_ten_nguoi_gui', 'ten_khach_hang',
    'ten_cua_hang', 'chu_shop', 'cua_hang', 'shop', 'khach_hang', 'sender_name',
    'ma_shop', 'ma_khach_hang'
  ],
  shopPhone: [
    'sdt_shop', 'sdt_nguoi_gui', 'dien_thoai_shop', 'dien_thoai_nguoi_gui', 'so_dien_thoai_nguoi_gui',
    'sdt_khach', 'sender_phone', 'phone_shop', 'sdt_gui', 'dien_thoai_gui'
  ],
  shopAddress: [
    'dia_chi_shop', 'dia_chi_nguoi_gui', 'dia_chi_gui', 'dia_chi_kho', 'dia_chi_kho_gui',
    'sender_address', 'kho_gui', 'noi_gui'
  ],
  receiverName: [
    'ten_nguoi_nhan', 'ho_ten_nguoi_nhan', 'ten_khach_nhan', 'nguoi_nhan', 'receiver_name'
  ],
  receiverPhone: [
    'sdt_nhan', 'sdt_nguoi_nhan', 'dien_thoai_nhan', 'so_dien_thoai_nguoi_nhan', 'receiver_phone'
  ],
  receiverAddress: [
    'dia_chi_nhan', 'dia_chi_nguoi_nhan', 'dia_chi_giao_hang', 'dia_chi_khach_nhan',
    'receiver_address', 'dia_chi', 'noi_nhan', 'tinh_thanh_nhan', 'quan_huyen_nhan'
  ],
};

export function autoDetectColumns(
  headers: string[], 
  type: 'nvc' | 'app', 
  savedMapping?: ColumnMappingConfig
): ColumnMappingConfig {
  const mapping: ColumnMappingConfig = {
    waybillColumn: '',
  };

  const findBestMatch = (
    aliases: string[], 
    savedCol?: string, 
    mustNotInclude: string[] = []
  ): string => {
    // 1. If user previously selected a column and it exists in current headers, keep user's choice
    if (savedCol && headers.includes(savedCol)) {
      return savedCol;
    }

    // 2. Exact match check first (highest priority)
    for (const header of headers) {
      const normalized = normalizeHeader(header);
      
      // Skip if contains forbidden words
      if (mustNotInclude.some(forbidden => normalized.includes(forbidden))) {
        continue;
      }

      for (const alias of aliases) {
        if (normalized === alias) {
          return header;
        }
      }
    }

    // 3. Prefix/Suffix or substring match
    for (const header of headers) {
      const normalized = normalizeHeader(header);
      
      // Skip if contains forbidden words
      if (mustNotInclude.some(forbidden => normalized.includes(forbidden))) {
        continue;
      }

      for (const alias of aliases) {
        if (normalized.startsWith(alias + '_') || normalized.endsWith('_' + alias) || normalized.includes(alias)) {
          return header;
        }
      }
    }

    return '';
  };

  mapping.waybillColumn = findBestMatch(ALIASES.waybill, savedMapping?.waybillColumn) || headers[0] || '';

  if (type === 'nvc') {
    mapping.codColumn = findBestMatch(ALIASES.cod, savedMapping?.codColumn);
    mapping.feeColumn = findBestMatch(ALIASES.fee, savedMapping?.feeColumn);
    mapping.otherFeeColumn = findBestMatch(ALIASES.otherFee, savedMapping?.otherFeeColumn);
    mapping.weightColumn = findBestMatch(ALIASES.weight, savedMapping?.weightColumn);
    mapping.statusColumn = findBestMatch(ALIASES.status, savedMapping?.statusColumn);
  } else {
    // shopName MUST NOT contain 'dia_chi', 'address', 'kho', 'sdt', 'phone', 'dien_thoai', 'ngan_hang', 'stk'
    mapping.shopNameColumn = findBestMatch(
      ALIASES.shopName, 
      savedMapping?.shopNameColumn, 
      ['dia_chi', 'address', 'kho', 'sdt', 'phone', 'dien_thoai', 'ngan_hang', 'stk', 'so_tai_khoan']
    );

    // shopPhone MUST NOT contain 'dia_chi', 'address', 'ten', 'name'
    mapping.shopPhoneColumn = findBestMatch(
      ALIASES.shopPhone, 
      savedMapping?.shopPhoneColumn, 
      ['dia_chi', 'address', 'ten', 'name']
    );

    // shopAddress
    mapping.shopAddressColumn = findBestMatch(
      ALIASES.shopAddress, 
      savedMapping?.shopAddressColumn
    );

    // receiverName MUST NOT contain 'dia_chi', 'address', 'sdt', 'phone', 'dien_thoai'
    mapping.receiverNameColumn = findBestMatch(
      ALIASES.receiverName, 
      savedMapping?.receiverNameColumn,
      ['dia_chi', 'address', 'sdt', 'phone', 'dien_thoai']
    );

    // receiverPhone MUST NOT contain 'dia_chi', 'address', 'ten', 'name'
    mapping.receiverPhoneColumn = findBestMatch(
      ALIASES.receiverPhone, 
      savedMapping?.receiverPhoneColumn,
      ['dia_chi', 'address', 'ten', 'name']
    );

    // receiverAddress
    mapping.receiverAddressColumn = findBestMatch(
      ALIASES.receiverAddress, 
      savedMapping?.receiverAddressColumn
    );

    mapping.weightColumn = findBestMatch(ALIASES.weight, savedMapping?.weightColumn);
    mapping.codColumn = findBestMatch(ALIASES.cod, savedMapping?.codColumn);
  }

  return mapping;
}

export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = val.toString().replace(/,/g, '').replace(/đ|vnd|VND|₫|k|K/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseWeightToKg(val: any): number {
  const num = parseNumber(val);
  if (num > 50) {
    return parseFloat((num / 1000).toFixed(3));
  }
  return parseFloat(num.toFixed(3));
}

// Check and ignore summary rows (Tổng cộng, Total, Grand Total, Kế toán, Chữ ký, v.v.)
export function isSummaryOrInvalidWaybill(waybillRaw: any): boolean {
  if (waybillRaw === undefined || waybillRaw === null) return true;
  const str = String(waybillRaw).trim().toLowerCase();
  if (!str || str === '-' || str === '--' || str === 'n/a' || str === 'null' || str === 'undefined') return true;

  const normalized = normalizeHeader(str);

  const summaryKeywords = [
    'tong',
    'tong_cong',
    'total',
    'grand_total',
    'tong_tien',
    'tong_cuoc',
    'tong_cod',
    'tong_so_don',
    'cong',
    'cong_lai',
    'ghi_chu',
    'luu_y',
    'ke_toan',
    'nguoi_lap',
    'chu_ky',
    'stt',
    'thong_ke',
    'tong_ket',
    'bao_cao',
    'so_luong'
  ];

  if (summaryKeywords.some(kw => normalized === kw || normalized.startsWith(kw + '_'))) {
    return true;
  }

  // If text contains "tong" or "total" and looks like a summary banner
  if ((normalized.includes('tong_cong') || normalized.includes('total') || normalized.includes('tong_')) && str.length < 35) {
    return true;
  }

  return false;
}
