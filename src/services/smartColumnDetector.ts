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
    .replace(/_+/g, '_');
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
    'ten_shop', 'nguoi_gui', 'ten_nguoi_gui', 'shop', 'khach_hang', 'ma_shop',
    'ten_khach_hang', 'sender_name', 'shop_name', 'cua_hang', 'ten_cua_hang',
    'ma_khach_hang', 'chu_shop'
  ],
  shopPhone: [
    'sdt_shop', 'sdt_nguoi_gui', 'dien_thoai_shop', 'dien_thoai_nguoi_gui', 'sdt_khach',
    'so_dien_thoai_nguoi_gui', 'sender_phone', 'phone_shop', 'sdt_gui'
  ],
  shopAddress: [
    'dia_chi_shop', 'dia_chi_nguoi_gui', 'dia_chi_gui', 'sender_address', 'kho_gui'
  ],
  receiverName: [
    'nguoi_nhan', 'ten_nguoi_nhan', 'ho_ten_nguoi_nhan', 'receiver_name', 'ten_khach_nhan'
  ],
  receiverPhone: [
    'sdt_nhan', 'sdt_nguoi_nhan', 'dien_thoai_nhan', 'receiver_phone', 'so_dien_thoai_nguoi_nhan'
  ],
  receiverAddress: [
    'dia_chi_nhan', 'dia_chi_nguoi_nhan', 'dia_chi', 'noi_nhan', 'tinh_thanh_nhan',
    'quan_huyen_nhan', 'receiver_address', 'dia_chi_giao_hang'
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

  const findBestMatch = (aliases: string[], savedCol?: string): string => {
    // 1. If user previously selected a column and it exists in current headers, keep user's choice
    if (savedCol && headers.includes(savedCol)) {
      return savedCol;
    }
    // 2. Otherwise auto-detect via aliases
    for (const header of headers) {
      const normalized = normalizeHeader(header);
      for (const alias of aliases) {
        if (normalized === alias || normalized.includes(alias)) {
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
    mapping.shopNameColumn = findBestMatch(ALIASES.shopName, savedMapping?.shopNameColumn);
    mapping.shopPhoneColumn = findBestMatch(ALIASES.shopPhone, savedMapping?.shopPhoneColumn);
    mapping.shopAddressColumn = findBestMatch(ALIASES.shopAddress, savedMapping?.shopAddressColumn);
    mapping.receiverNameColumn = findBestMatch(ALIASES.receiverName, savedMapping?.receiverNameColumn);
    mapping.receiverPhoneColumn = findBestMatch(ALIASES.receiverPhone, savedMapping?.receiverPhoneColumn);
    mapping.receiverAddressColumn = findBestMatch(ALIASES.receiverAddress, savedMapping?.receiverAddressColumn);
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
