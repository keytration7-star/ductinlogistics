import type { ColumnMappingConfig } from '../types';

export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .toString()
    .toLowerCase()
    .trim()
    // Vietnamese "đ" is not decomposed by NFD, so convert it before the
    // ASCII cleanup. Without this, "Mã vận đơn" becomes "ma_van_on" and
    // real carrier headers can silently miss their aliases.
    .replace(/đ/g, 'd')
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
    'so_hieu_buu_gui', 'ma_kien_hang', 'waybill', 'ma_giao_hang', 'ma_tra_cuu',
    'client_order_code', 'order_id', 'order_no', 'order_number', 'ma_don_nvc',
    'ma_don_ghn', 'ma_don_ghtk', 'ma_don_khach_hang', 'tracking_id', 'shipment_id',
    'so_phieu_gui', 'ma_buu_gui_nvc', 'stt_ma_don'
  ],
  cod: [
    'tien_thu_ho', 'cod', 'tien_cod', 'thu_ho', 'so_tien_cod', 'tien_tra_nguoi_gui',
    'tien_cod_thuc_nhan', 'so_tien_thu_ho', 'tong_cod', 'cod_thu_ho', 'so_tien_thu',
    'cod_amount', 'collect_amount', 'tong_tien_thu_ho', 'cod_chuyen_khoan', 'tong_nhan',
    'cod_giao_thanh_cong', 'tien_co_cod', 'cod_tra_shop', 'tien_cod_da_ky_nhan',
    'tien_cod_1'
  ],
  fee: [
    'cuoc_phi', 'tong_cuoc', 'cuoc_van_chuyen', 'phi_van_chuyen', 'cuoc_chinh',
    'phi_dich_vu', 'phi_dich_vu_5', 'tong_phi', 'cuoc_thuc_te', 'cuoc_phi_goc', 'cuoc_nvc',
    'shipping_fee', 'fee', 'tong_tien_cuoc', 'cuoc_tam_tinh', 'phi_giao_hang', 'phi_giao_hang_5_1',
    'cuoc_tru', 'phi_chinh', 'tong_phi_giao_hang', 'phi_dich_vu_chinh', 'tien_cuoc_pp_pm'
  ],
  otherFee: [
    'phi_khac', 'phu_phi', 'phi_bao_hiem', 'phi_chuyen_hoan', 'phi_hoan', 'phi_hoan_hang',
    'phi_hoan_hang_5_4', 'phi_khai_gia_5_3', 'phi_giao_lai_5_2', 'phi_doi_dia_chi_hoan_5_5',
    'phi_doi_dia_chi_giao_5_6', 'phi_giao_lai', 'phi_kiem_dem', 'phu_phi_vung_xa', 'other_fee',
    'surcharge', 'phi_hoan_thanh_cong', 'phi_chuyen_tra'
  ],
  adjustment: ['dieu_chinh', 'adjustment', 'phi_dieu_chinh', 'khuyen_mai_4', 'khuyen_mai', 'da_thanh_toan_truoc_3', 'giao_that_bai_thu_tien_2'],
  settlementAmount: ['so_tien_phai_tra_sau_can_tru', 'tien_thuc_nhan_sau_can_tru', 'net_settlement', 'so_tien_doi_soat', 'tong_doi_soat', 'tong_doi_soat_3_4_5'],
  weight: [
    'khoi_luong', 'trong_luong', 'can_nang', 'khoi_luong_tinh_cuoc', 'kl_quy_doi',
    'weight', 'gross_weight', 'khoi_luong_kg', 'trong_luong_kg', 'can_nang_kg',
    'khoi_luong_gram', 'trong_luong_g', 'can_nang_gram', 'kg', 'trong_luong_tinh_phi'
  ],
  status: [
    'trang_thai', 'tinh_trang', 'ket_qua_giao', 'trang_thai_don', 'trang_thai_giao_hang',
    'status', 'delivery_status', 'ket_qua', 'trang_thai_doi_soat', 'ghi_chu',
    'trang_thai_giao', 'tinh_trang_don_hang'
  ],
  shopName: [
    'ten_shop', 'shop_name', 'ten_nguoi_gui', 'ho_ten_nguoi_gui', 'ten_khach_hang',
    'ten_cua_hang', 'chu_shop', 'cua_hang', 'shop', 'khach_hang', 'sender_name',
    'ma_shop', 'ma_khach_hang', 'ten_kho', 'kho_gui', 'ten_kho_gui', 'store_name',
    'client_name', 'ten_doi_tac'
  ],
  shopPhone: [
    'sdt_shop', 'sdt_nguoi_gui', 'dien_thoai_shop', 'dien_thoai_nguoi_gui', 'so_dien_thoai_nguoi_gui',
    'sdt_khach', 'sender_phone', 'phone_shop', 'sdt_gui', 'dien_thoai_gui', 'sdt_kho',
    'sdt_kho_gui', 'dien_thoai_kho', 'mobile_shop', 'so_dien_thoai_di_dong_cua_nguoi_gui_hang'
  ],
  shopAddress: [
    'dia_chi_shop', 'dia_chi_nguoi_gui', 'dia_chi_gui', 'dia_chi_kho', 'dia_chi_kho_gui',
    'sender_address', 'kho_gui', 'noi_gui', 'dc_kho'
  ],
  receiverName: [
    'ten_nguoi_nhan', 'ho_ten_nguoi_nhan', 'ten_khach_nhan', 'nguoi_nhan', 'receiver_name', 'khach_hang_nhan'
  ],
  receiverPhone: [
    'sdt_nhan', 'sdt_nguoi_nhan', 'dien_thoai_nhan', 'so_dien_thoai_nguoi_nhan', 'receiver_phone', 'sdt_khach_nhan'
  ],
  receiverAddress: [
    'dia_chi_nhan', 'dia_chi_nguoi_nhan', 'dia_chi_giao_hang', 'dia_chi_khach_nhan',
    'receiver_address', 'dia_chi', 'noi_nhan', 'tinh_thanh_nhan', 'quan_huyen_nhan'
  ],
};

function detectAdditionalFeeColumns(headers: string[], savedColumns?: string[]): string[] {
  if (savedColumns && savedColumns.length > 0) {
    return savedColumns.filter(column => headers.includes(column));
  }
  const feeMarkers = ['phi_thu_ho', 'phi_chuyen_hoan', 'phi_giao_mot_phan', 'phi_bao_hiem', 'phu_phi', 'surcharge', 'other_fee'];
  return headers.filter(header => {
    const normalized = normalizeHeader(header);
    return feeMarkers.some(marker => normalized.includes(marker));
  });
}

export interface ColumnMatchConfidence {
  columnKey: keyof ColumnMappingConfig;
  fieldLabel: string;
  matchedHeader: string;
  confidencePercent: number; // 100 = exact/saved, 75 = substring/alias match, 0 = not matched
  isConfident: boolean;
}

export function autoDetectColumnsWithConfidence(
  headers: string[],
  type: 'nvc' | 'app',
  savedMapping?: ColumnMappingConfig,
  sampleRows?: Record<string, any>[]
): { mapping: ColumnMappingConfig; confidences: Record<string, ColumnMatchConfidence> } {
  const mapping: ColumnMappingConfig = { waybillColumn: '' };
  const confidences: Record<string, ColumnMatchConfidence> = {};

  const waybillForbidden = ['danh_sach', 'bao_cao', 'cong_ty', 'stt', 'nguoi_gui', 'nguoi_nhan', 'dia_chi', 'sdt', 'tien', 'cod', 'cuoc', 'phi'];

  const findBestMatchWithScore = (
    key: keyof ColumnMappingConfig,
    fieldLabel: string,
    aliases: string[],
    savedCol?: string,
    mustNotInclude: string[] = []
  ): string => {
    // 1. Saved choice by user
    if (savedCol && headers.includes(savedCol)) {
      confidences[key] = {
        columnKey: key,
        fieldLabel,
        matchedHeader: savedCol,
        confidencePercent: 100,
        isConfident: true
      };
      return savedCol;
    }

    // 2. Exact match
    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if (mustNotInclude.some(forbidden => normalized.includes(forbidden))) continue;
      for (const alias of aliases) {
        if (normalized === alias) {
          confidences[key] = {
            columnKey: key,
            fieldLabel,
            matchedHeader: header,
            confidencePercent: 100,
            isConfident: true
          };
          return header;
        }
      }
    }

    // 3. Substring match
    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if (mustNotInclude.some(forbidden => normalized.includes(forbidden))) continue;
      for (const alias of aliases) {
        if (normalized.startsWith(alias + '_') || normalized.endsWith('_' + alias) || normalized.includes(alias)) {
          confidences[key] = {
            columnKey: key,
            fieldLabel,
            matchedHeader: header,
            confidencePercent: 75,
            isConfident: false
          };
          return header;
        }
      }
    }

    // 4. Not found
    confidences[key] = {
      columnKey: key,
      fieldLabel,
      matchedHeader: '',
      confidencePercent: 0,
      isConfident: false
    };
    return '';
  };

  mapping.waybillColumn = findBestMatchWithScore('waybillColumn', 'Mã vận đơn', ALIASES.waybill, savedMapping?.waybillColumn, waybillForbidden);

  // If waybillColumn not matched via header text, inspect sample data rows!
  if (!mapping.waybillColumn && sampleRows && sampleRows.length > 0) {
    for (const header of headers) {
      const normH = normalizeHeader(header);
      if (waybillForbidden.some(f => normH.includes(f))) continue;

      let validWaybillCount = 0;
      for (const row of sampleRows.slice(0, 10)) {
        const val = String(row[header] || '').trim();
        if (val && val.length >= 4 && !/^\d{1,3}$/.test(val)) {
          validWaybillCount++;
        }
      }

      if (validWaybillCount >= Math.min(3, sampleRows.length)) {
        mapping.waybillColumn = header;
        confidences.waybillColumn = {
          columnKey: 'waybillColumn',
          fieldLabel: 'Mã vận đơn',
          matchedHeader: header,
          confidencePercent: 85,
          isConfident: true,
        };
        break;
      }
    }
  }

  // Fallback to first non-forbidden header if still empty
  if (!mapping.waybillColumn) {
    const safeHeader = headers.find(h => !waybillForbidden.some(f => normalizeHeader(h).includes(f))) || headers[0] || '';
    mapping.waybillColumn = safeHeader;
  }

  if (type === 'nvc') {
    mapping.codColumn = findBestMatchWithScore('codColumn', 'Tiền COD Thu Hộ', ALIASES.cod, savedMapping?.codColumn);
    mapping.feeColumn = findBestMatchWithScore('feeColumn', 'Cước Vận Chuyển', ALIASES.fee, savedMapping?.feeColumn);
    mapping.otherFeeColumn = findBestMatchWithScore('otherFeeColumn', 'Phụ Phí / Hoàn / Bảo Hiểm', ALIASES.otherFee, savedMapping?.otherFeeColumn);
    mapping.additionalFeeColumns = detectAdditionalFeeColumns(headers, savedMapping?.additionalFeeColumns)
      .filter(column => column !== mapping.otherFeeColumn);
    mapping.adjustmentColumn = findBestMatchWithScore('adjustmentColumn', 'Điều Chỉnh NVC', ALIASES.adjustment, savedMapping?.adjustmentColumn);
    mapping.settlementAmountColumn = findBestMatchWithScore('settlementAmountColumn', 'Số Tiền NVC Trả Sau Cấn Trừ', ALIASES.settlementAmount, savedMapping?.settlementAmountColumn);
    mapping.weightColumn = findBestMatchWithScore('weightColumn', 'Trọng Lượng (kg)', ALIASES.weight, savedMapping?.weightColumn);
    mapping.statusColumn = findBestMatchWithScore('statusColumn', 'Trạng Thái Đơn Hàng', ALIASES.status, savedMapping?.statusColumn);
    mapping.shopNameColumn = findBestMatchWithScore('shopNameColumn', 'Tên Shop / Cửa Hàng', ALIASES.shopName, savedMapping?.shopNameColumn, ['dia_chi', 'address', 'sdt', 'phone']);
    mapping.shopCodeColumn = findBestMatchWithScore('shopCodeColumn', 'Mã Shop / Kho', ['ma_shop', 'ma_kho', 'ma_cua_hang', 'store_id', 'client_id'], savedMapping?.shopCodeColumn);
    mapping.shopPhoneColumn = findBestMatchWithScore('shopPhoneColumn', 'SĐT Shop', ALIASES.shopPhone, savedMapping?.shopPhoneColumn, ['dia_chi', 'address', 'ten']);
    mapping.receiverNameColumn = findBestMatchWithScore('receiverNameColumn', 'Tên Người Nhận', ALIASES.receiverName, savedMapping?.receiverNameColumn, ['dia_chi', 'address', 'sdt', 'phone']);
    mapping.receiverPhoneColumn = findBestMatchWithScore('receiverPhoneColumn', 'SĐT Người Nhận', ALIASES.receiverPhone, savedMapping?.receiverPhoneColumn, ['dia_chi', 'address', 'ten', 'name']);
    mapping.receiverAddressColumn = findBestMatchWithScore('receiverAddressColumn', 'Địa Chỉ Người Nhận', ALIASES.receiverAddress, savedMapping?.receiverAddressColumn);
    mapping.shopNameColumn = findBestMatchWithScore('shopNameColumn', 'Tên Shop / Cửa Hàng', ALIASES.shopName, savedMapping?.shopNameColumn, ['dia_chi', 'address', 'sdt', 'phone']);
    mapping.shopPhoneColumn = findBestMatchWithScore('shopPhoneColumn', 'SĐT Shop', ALIASES.shopPhone, savedMapping?.shopPhoneColumn, ['dia_chi', 'address', 'ten']);
  } else {
    mapping.shopNameColumn = findBestMatchWithScore('shopNameColumn', 'Tên Shop / Cửa Hàng', ALIASES.shopName, savedMapping?.shopNameColumn, ['dia_chi', 'address', 'kho', 'sdt', 'phone', 'dien_thoai', 'ngan_hang', 'stk', 'so_tai_khoan']);
    mapping.shopPhoneColumn = findBestMatchWithScore('shopPhoneColumn', 'SĐT Shop', ALIASES.shopPhone, savedMapping?.shopPhoneColumn, ['dia_chi', 'address', 'ten', 'name']);
    mapping.shopAddressColumn = findBestMatchWithScore('shopAddressColumn', 'Địa Chỉ Shop', ALIASES.shopAddress, savedMapping?.shopAddressColumn);
    mapping.receiverNameColumn = findBestMatchWithScore('receiverNameColumn', 'Tên Người Nhận', ALIASES.receiverName, savedMapping?.receiverNameColumn, ['dia_chi', 'address', 'sdt', 'phone', 'dien_thoai']);
    mapping.receiverPhoneColumn = findBestMatchWithScore('receiverPhoneColumn', 'SĐT Người Nhận', ALIASES.receiverPhone, savedMapping?.receiverPhoneColumn, ['dia_chi', 'address', 'ten', 'name']);
    mapping.receiverAddressColumn = findBestMatchWithScore('receiverAddressColumn', 'Địa Chỉ Người Nhận', ALIASES.receiverAddress, savedMapping?.receiverAddressColumn);
    mapping.weightColumn = findBestMatchWithScore('weightColumn', 'Trọng Lượng (kg)', ALIASES.weight, savedMapping?.weightColumn);
    mapping.codColumn = findBestMatchWithScore('codColumn', 'Tiền COD Thu Hộ', ALIASES.cod, savedMapping?.codColumn);
    mapping.statusColumn = findBestMatchWithScore('statusColumn', 'Trạng Thái Đơn Hàng', ALIASES.status, savedMapping?.statusColumn);
  }

  return { mapping, confidences };
}

export function autoDetectColumns(
  headers: string[], 
  type: 'nvc' | 'app', 
  savedMapping?: ColumnMappingConfig,
  sampleRows?: Record<string, any>[]
): ColumnMappingConfig {
  const mapping: ColumnMappingConfig = {
    waybillColumn: '',
  };

  const waybillForbidden = ['danh_sach', 'bao_cao', 'cong_ty', 'stt', 'nguoi_gui', 'nguoi_nhan', 'dia_chi', 'sdt', 'tien', 'cod', 'cuoc', 'phi'];

  const findBestMatch = (
    aliases: string[], 
    savedCol?: string, 
    mustNotInclude: string[] = []
  ): string => {
    if (savedCol && headers.includes(savedCol)) {
      return savedCol;
    }

    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if (mustNotInclude.some(forbidden => normalized.includes(forbidden))) {
        continue;
      }
      for (const alias of aliases) {
        if (normalized === alias) {
          return header;
        }
      }
    }

    for (const header of headers) {
      const normalized = normalizeHeader(header);
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

  mapping.waybillColumn = findBestMatch(ALIASES.waybill, savedMapping?.waybillColumn, waybillForbidden);

  // Data content inspection fallback
  if (!mapping.waybillColumn && sampleRows && sampleRows.length > 0) {
    for (const header of headers) {
      const normH = normalizeHeader(header);
      if (waybillForbidden.some(f => normH.includes(f))) continue;

      let validWaybillCount = 0;
      for (const row of sampleRows.slice(0, 10)) {
        const val = String(row[header] || '').trim();
        if (val && val.length >= 4 && !/^\d{1,3}$/.test(val)) {
          validWaybillCount++;
        }
      }

      if (validWaybillCount >= Math.min(3, sampleRows.length)) {
        mapping.waybillColumn = header;
        break;
      }
    }
  }

  if (!mapping.waybillColumn) {
    mapping.waybillColumn = headers.find(h => !waybillForbidden.some(f => normalizeHeader(h).includes(f))) || headers[0] || '';
  }

  if (type === 'nvc') {
    mapping.codColumn = findBestMatch(ALIASES.cod, savedMapping?.codColumn);
    mapping.feeColumn = findBestMatch(ALIASES.fee, savedMapping?.feeColumn);
    mapping.otherFeeColumn = findBestMatch(ALIASES.otherFee, savedMapping?.otherFeeColumn);
    mapping.additionalFeeColumns = detectAdditionalFeeColumns(headers, savedMapping?.additionalFeeColumns)
      .filter(column => column !== mapping.otherFeeColumn);
    mapping.adjustmentColumn = findBestMatch(ALIASES.adjustment, savedMapping?.adjustmentColumn);
    mapping.settlementAmountColumn = findBestMatch(ALIASES.settlementAmount, savedMapping?.settlementAmountColumn);
    mapping.weightColumn = findBestMatch(ALIASES.weight, savedMapping?.weightColumn);
    mapping.statusColumn = findBestMatch(ALIASES.status, savedMapping?.statusColumn);
    mapping.shopNameColumn = findBestMatch(ALIASES.shopName, savedMapping?.shopNameColumn, ['dia_chi', 'address', 'sdt', 'phone']);
    mapping.shopCodeColumn = findBestMatch(['ma_shop', 'ma_kho', 'ma_cua_hang', 'store_id', 'client_id'], savedMapping?.shopCodeColumn);
    mapping.shopPhoneColumn = findBestMatch(ALIASES.shopPhone, savedMapping?.shopPhoneColumn, ['dia_chi', 'address', 'ten']);
    mapping.receiverNameColumn = findBestMatch(ALIASES.receiverName, savedMapping?.receiverNameColumn, ['dia_chi', 'address', 'sdt', 'phone']);
    mapping.receiverPhoneColumn = findBestMatch(ALIASES.receiverPhone, savedMapping?.receiverPhoneColumn, ['dia_chi', 'address', 'ten', 'name']);
    mapping.receiverAddressColumn = findBestMatch(ALIASES.receiverAddress, savedMapping?.receiverAddressColumn);
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
    mapping.statusColumn = findBestMatch(ALIASES.status, savedMapping?.statusColumn);
  }

  return mapping;
}

export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  // Files from carriers may store amounts as Vietnamese text (1.234.000),
  // English text (1,234,000), or a decimal weight (0,5 / 0.5). Preserve the
  // sign and decide separators before parsing instead of blindly removing only
  // commas, which turns 1.234.000 into 1.234.
  let str = val.toString()
    .replace(/đ|vnd|₫/gi, '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');
  if (!str || str === '-' || str === '.' || str === ',') return 0;

  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;
  if (commaCount > 0 && dotCount > 0) {
    // The right-most separator is the decimal separator.
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (commaCount > 0 || dotCount > 0) {
    const separator = commaCount > 0 ? ',' : '.';
    const count = commaCount || dotCount;
    const parts = str.split(separator);
    const decimalDigits = parts[parts.length - 1].length;
    const looksLikeThousands = count > 1 || (count === 1 && decimalDigits === 3 && parts[0].replace('-', '').length > 0);
    if (looksLikeThousands) {
      str = str.split(separator).join('');
    } else if (separator === ',') {
      str = str.replace(',', '.');
    }
  }

  const num = Number(str);
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
