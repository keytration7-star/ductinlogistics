import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ShopSettlementStatement, ReconciliationSession, ExportColumnSettings, ExportColumnItem } from '../types';
import { normalizeHeader } from './smartColumnDetector';
import { StorageService } from './storage';

import { extractRowField } from './reconciliationService';

export function getCleanCarrierTag(carrierId?: string, carrierName?: string): string {
  const combined = `${carrierId || ''} ${carrierName || ''}`.toLowerCase().trim();
  if (combined.includes('j&t') || combined.includes('jnt')) return 'J&T';
  if (combined.includes('ghn') || combined.includes('giao hàng nhanh') || combined.includes('giaohangnhanh')) return 'GHN';
  if (combined.includes('ghtk') || combined.includes('tiết kiệm') || combined.includes('tietkiem')) return 'GHTK';
  if (combined.includes('viettel') || combined.includes('vtp')) return 'ViettelPost';
  if (combined.includes('spx') || combined.includes('shopee')) return 'SPX';
  if (combined.includes('vnpost') || combined.includes('ems')) return 'VNPost';
  if (carrierName && carrierName.trim()) return carrierName.trim().replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
  if (carrierId && carrierId.trim()) return carrierId.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, '_');
  return 'NVC';
}

export function formatAnyDateValue(val: any): string {
  if (val === undefined || val === null || val === '') return '';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return formatDateToString(val, true);
  }

  let str = String(val).trim();
  if (!str) return '';

  // Handle European/Vietnamese decimal comma (e.g. "46239,64141" -> "46239.64141")
  const normalizedStr = str.replace(',', '.');
  const num = Number(normalizedStr);
  if (!isNaN(num) && num > 25000 && num < 75000) {
    const jsTimestamp = Math.round((num - 25569) * 86400 * 1000);
    const dateObj = new Date(jsTimestamp);
    if (!isNaN(dateObj.getTime())) {
      const hasTime = num % 1 !== 0;
      return formatDateToString(dateObj, hasTime);
    }
  }

  if ((str.includes('-') || str.includes('/') || str.includes('T')) && !str.match(/^[a-zA-Z0-9\s]+$/)) {
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1990 && parsedDate.getFullYear() < 2100) {
      return formatDateToString(parsedDate, str.includes(':') || str.includes('T'));
    }
  }

  return str;
}

function formatDateToString(d: Date, includeTime: boolean = false): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  if (includeTime) {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    if (hours !== '00' || minutes !== '00') {
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  }

  return `${day}/${month}/${year}`;
}

export function saveBlobFile(blob: Blob, filename: string): void {
  try {
    saveAs(blob, filename);
  } catch (err) {
    console.warn('saveAs failed, falling back to anchor click:', err);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }
}

function isValidRealHeader(headerName: string): boolean {
  if (!headerName) return false;
  const t = headerName.trim();
  if (t.includes('(chuẩn hóa') || t.includes('đa file')) return false;
  if (/[-–]\s*(80\d{8,}|\d{8,}|0\d{8,})/.test(t)) return false;
  if (/[-–]\s*(Giao thành công|Đã lấy hàng|Hủy|Đang giao)/i.test(t)) return false;
  if (t.length > 50) return false;
  return true;
}

export function buildDynamicColumnsFromOrders(
  orders: any[],
  customExportSettings?: ExportColumnSettings,
  isMaster: boolean = false
): ExportColumnItem[] {
  // If user provided custom export settings or saved specific enabled columns in settings
  if (customExportSettings) {
    const cols = isMaster
      ? (customExportSettings.masterColumns || customExportSettings.shopColumns || [])
      : (customExportSettings.shopColumns || []);
    
    const enabled = cols.filter(c => c.enabled !== false && isValidRealHeader(c.label));
    if (enabled.length > 0) {
      return enabled;
    }
  }

  // 🌟 DEFAULT BEHAVIOR: Output ALL columns from the 2 merged files (NVC + App) + shop finance columns
  const discoveredCols: ExportColumnItem[] = [];
  const seenHeaders = new Set<string>();

  // 1. STT always first
  discoveredCols.push({ id: 'stt', label: 'STT', enabled: true, category: 'basic' });
  seenHeaders.add('stt');

  // 2. Discover all NVC headers from rawNvcData
  orders.forEach(order => {
    if (order.rawNvcData) {
      Object.keys(order.rawNvcData).forEach(key => {
        if (!isValidRealHeader(key)) return;
        const trimmed = key.trim();
        const norm = normalizeHeader(trimmed);
        if (!trimmed || seenHeaders.has(norm)) return;
        seenHeaders.add(norm);
        discoveredCols.push({
          id: `nvc_${norm}`,
          label: trimmed,
          sourceHeader: trimmed,
          enabled: true,
          category: 'carrier',
        });
      });
    }
  });

  // 3. Discover all App headers from rawAppData
  orders.forEach(order => {
    if (order.rawAppData) {
      Object.keys(order.rawAppData).forEach(key => {
        if (!isValidRealHeader(key)) return;
        const trimmed = key.trim();
        const cleanKey = trimmed.replace(/\s*[-–]\s*[^\s].*$/, '').trim() || trimmed;
        if (!isValidRealHeader(cleanKey)) return;
        const norm = normalizeHeader(cleanKey);
        if (!cleanKey || seenHeaders.has(norm)) return;
        seenHeaders.add(norm);
        discoveredCols.push({
          id: `app_${norm}`,
          label: cleanKey,
          sourceHeader: trimmed,
          enabled: true,
          category: 'basic',
        });
      });
    }
  });

  // 4. Financial calculation columns
  if (!seenHeaders.has('cuoc_tinh_shop_vnd') && !seenHeaders.has('cuoc_phi_van_chuyen')) {
    discoveredCols.push({ id: 'shopFee', label: 'Cước Tính Shop (VNĐ)', enabled: true, category: 'finance' });
  }
  if (!seenHeaders.has('phu_phi_shop_vnd') && !seenHeaders.has('phi_khac_phu_thu_hoan')) {
    discoveredCols.push({ id: 'shopOtherFee', label: 'Phụ Phí Shop (VNĐ)', enabled: true, category: 'finance' });
  }
  if (!seenHeaders.has('thuc_chuyen_cho_shop_vnd') && !seenHeaders.has('so_tien_thuc_chuyen_shop')) {
    discoveredCols.push({ id: 'netPayout', label: 'Thực Chuyển Cho Shop (VNĐ)', enabled: true, category: 'finance' });
  }
  if (isMaster && !seenHeaders.has('loi_nhuan_gom_don_vnd') && !seenHeaders.has('lai_rong_nha_gom')) {
    discoveredCols.push({ id: 'profit', label: 'Lợi Nhuận Gom Đơn (VNĐ)', enabled: true, category: 'finance' });
  }

  // 🌟 Smart fallback for legacy sessions that lack raw data objects
  if (discoveredCols.length <= 4) {
    return [
      { id: 'stt', label: 'STT', enabled: true, category: 'basic' },
      { id: 'waybill', label: 'Mã Vận Đơn', enabled: true, category: 'basic' },
      { id: 'refOrderCode', label: 'Mã Đơn Khách Hàng', enabled: true, category: 'basic' },
      { id: 'shopName', label: 'Tên Shop', enabled: true, category: 'basic' },
      { id: 'receiverName', label: 'Tên Người Nhận', enabled: true, category: 'receiver' },
      { id: 'receiverPhone', label: 'SĐT Người Nhận', enabled: true, category: 'receiver' },
      { id: 'receiverAddress', label: 'Địa Chỉ Nhận', enabled: true, category: 'receiver' },
      { id: 'productName', label: 'Nội Dung Hàng Hóa', enabled: true, category: 'basic' },
      { id: 'weight', label: 'Khối Lượng (kg)', enabled: true, category: 'basic' },
      { id: 'status', label: 'Trạng Thái', enabled: true, category: 'basic' },
      { id: 'codAmount', label: 'Tiền Thu Hộ (COD)', enabled: true, category: 'finance' },
      { id: 'shopFee', label: 'Cước Tính Shop (VNĐ)', enabled: true, category: 'finance' },
      { id: 'shopOtherFee', label: 'Phụ Phí Shop (VNĐ)', enabled: true, category: 'finance' },
      { id: 'netPayout', label: 'Thực Chuyển Cho Shop (VNĐ)', enabled: true, category: 'finance' },
      ...(isMaster ? [{ id: 'profit', label: 'Lợi Nhuận Gom Đơn (VNĐ)', enabled: true, category: 'finance' as const }] : []),
    ];
  }

  return discoveredCols;
}

export function resolveOrderColumnValue(order: any, col: ExportColumnItem, idx: number, carrierName?: string): any {
  const normId = normalizeHeader(col.id || '');
  const normLabel = normalizeHeader(col.label || '');
  const normSrc = normalizeHeader(col.sourceHeader || '');

  // 1. Direct standard IDs & Key Semantics
  if (normId === 'stt' || normLabel === 'stt') return idx + 1;
  if (normId === 'waybill' || normLabel === 'ma_van_don' || normLabel === 'mvd' || normLabel === 'tracking' || normLabel === 'ma_don') {
    return order.waybill;
  }
  if (normId === 'carrier' || normLabel.includes('don_vi_van_chuyen') || normLabel.includes('hang_van_chuyen') || normLabel.includes('nvc')) {
    return carrierName || order.carrierId || '';
  }
  if (normId === 'codamount' || normLabel === 'tien_thu_ho_cod' || normLabel === 'tien_cod' || normLabel === 'cod' || normLabel.includes('tien_cod') || normLabel.includes('thu_ho')) {
    return order.codAmount ?? 0;
  }
  if (normId === 'shopfee' || normLabel === 'cuoc_phi_van_chuyen' || normLabel === 'cuoc_thu_shop' || normLabel === 'cuoc_phi' || normLabel === 'phi_giao_hang' || normLabel === 'phi_dich_vu') {
    return (order.shopCalculatedFee !== undefined) ? order.shopCalculatedFee : (order.shopFee || 0);
  }
  if (normId === 'shopotherfee' || normLabel === 'phi_khac_phu_thu_hoan' || normLabel === 'phu_thu' || normLabel === 'phi_khac' || normLabel === 'phi_hoan_hang') {
    return order.shopOtherFee ?? 0;
  }
  if (normId === 'nvcfee' || normLabel === 'cuoc_goc_tra_nvc' || normLabel === 'cuoc_goc' || normLabel === 'cuoc_nvc') {
    return (order.nvcBaseFee || 0) + (order.nvcOtherFee || 0);
  }
  if (normId === 'profit' || normLabel === 'lai_rong_nha_gom' || normLabel === 'loi_nhuan' || normLabel === 'lai_rong') {
    return order.profitMargin ?? 0;
  }
  if (normId === 'netpayout' || normLabel === 'so_tien_thuc_chuyen_shop' || normLabel === 'thuc_chuyen_cho_shop' || normLabel === 'thuc_chuyen' || normLabel === 'thuc_tra' || normLabel.includes('tong_doi_soat')) {
    return order.netShopPayout ?? 0;
  }
  if (normId === 'weight' || normLabel === 'khoi_luong_kg' || normLabel === 'trong_luong_tinh_phi' || normLabel.includes('khoi_luong') || normLabel.includes('trong_luong') || normLabel.includes('can_nang')) {
    return order.weight ?? 0.5;
  }
  if (normId === 'status' || normLabel === 'trang_thai_don_hang' || normLabel === 'trang_thai_van_don' || normLabel === 'trang_thai') {
    return order.statusText || order.status || '';
  }
  if (normId === 'receivername' || normLabel === 'ten_nguoi_nhan' || normLabel === 'nguoi_nhan' || normLabel.includes('nguoi_nhan') || normLabel.includes('ten_khach')) {
    return order.receiverName || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ten_nguoi_nhan', 'nguoi_nhan', 'ten_khach', 'receiver', 'nguoi_mua']);
  }
  if (normId === 'receiverphone' || normLabel === 'sdt_nguoi_nhan' || normLabel === 'sdt_nhan' || normLabel.includes('sdt_nguoi_nhan') || normLabel.includes('so_dien_thoai_nguoi_nhan') || normLabel.includes('dien_thoai_nguoi_nhan')) {
    return order.receiverPhone || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['sdt_nguoi_nhan', 'so_dien_thoai', 'phone', 'mobile', 'sdt']);
  }
  if (normId === 'receiveraddress' || normLabel === 'dia_chi_giao_hang' || normLabel === 'dia_chi_nhan' || normLabel === 'dia_chi_nguoi_nhan' || normLabel.includes('dia_chi_nhan') || normLabel.includes('dia_chi_giao') || normLabel.includes('dia_chi_nguoi_nhan')) {
    return order.receiverAddress || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['dia_chi', 'address', 'dc_nhan', 'giao_hang', 'dia_chi_nhan', 'dc', 'dia_chi_giao', 'dia_chi_nguoi_nhan']);
  }
  if (normId === 'productname' || normLabel === 'ten_san_pham_hang_hoa' || normLabel === 'noi_dung_hang_hoa' || normLabel.includes('san_pham') || normLabel.includes('hang_hoa') || normLabel.includes('noi_dung')) {
    return order.productName || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ten_san_pham', 'hang_hoa', 'ten_hang', 'san_pham', 'noi_dung', 'mo_ta', 'product', 'items', 'noi_dung_hang_hoa']);
  }
  if (normId === 'refordercode' || normLabel.includes('ma_don_phu') || normLabel.includes('ma_don_kh') || normLabel.includes('ma_don_khach_hang') || normLabel.includes('ma_don_ghn')) {
    return order.rawAppData?.['Mã đơn phụ'] || order.rawAppData?.['Mã đơn hàng'] || order.rawNvcData?.['Mã đơn KH'] || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ma_don_phu', 'ma_don_kh', 'ma_don_khach_hang', 'ref', 'order_id', 'ma_don_ghn']);
  }
  if (normId === 'date' || normLabel.includes('ngay_gui') || normLabel.includes('ngay_tao') || normLabel.includes('thoi_gian_tao') || normLabel.includes('ngay_doi_soat')) {
    const rawDate = order.rawNvcData?.['Ngày Gửi Hàng'] || order.rawNvcData?.['Ngày'] || order.rawAppData?.['Thời gian tạo đơn'] || order.rawAppData?.['Thời gian lấy hàng'] || order.rawAppData?.['Ngày'] || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ngay_gui', 'ngay_tao', 'ngay', 'date', 'thoi_gian_tao_don', 'thoi_gian_lay_hang', 'thoi_gian']);
    return formatAnyDateValue(rawDate);
  }
  if (normLabel.includes('ngay_giao') || normLabel.includes('ngay_tra') || normLabel.includes('ky_nhan') || normLabel.includes('thoi_gian_ky_nhan')) {
    const rawDate = order.rawNvcData?.['Thời gian Ký Nhận'] || order.rawAppData?.['Thời gian ký nhận'] || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ngay_giao', 'ngay_tra', 'ky_nhan', 'thoi_gian_ky_nhan', 'ngay_giao_tra']);
    return formatAnyDateValue(rawDate);
  }
  if (normId === 'shopname' || normLabel.includes('ten_shop') || normLabel.includes('cua_hang') || normLabel.includes('nguoi_gui')) {
    return order.shopName;
  }
  if (normId === 'shopphone' || normLabel.includes('sdt_shop') || normLabel.includes('so_dt_shop') || normLabel.includes('phone_shop') || normLabel.includes('sdt_gui')) {
    return order.shopPhone;
  }
  if (normId === 'shopaddress' || normLabel.includes('dia_chi_gui') || normLabel.includes('kho_gui') || normLabel.includes('dia_chi_kho')) {
    return order.shopAddress;
  }
  if (normId === 'matchstatus' || normLabel.includes('khop_shop') || normLabel.includes('tinh_trang_khop')) {
    return order.matched ? 'Đã khớp Shop' : 'Chưa nhận diện Shop';
  }

  // 2. Direct lookup in raw data by sourceHeader, label, id
  const candidates = [col.sourceHeader, col.label, col.id].filter(Boolean) as string[];
  for (const c of candidates) {
    if (order.rawAppData && order.rawAppData[c] !== undefined && order.rawAppData[c] !== '') return order.rawAppData[c];
    if (order.rawNvcData && order.rawNvcData[c] !== undefined && order.rawNvcData[c] !== '') return order.rawNvcData[c];
  }

  // 3. Normalized header lookup in raw data keys
  const allRawData = [order.rawAppData, order.rawNvcData];
  for (const raw of allRawData) {
    if (!raw) continue;
    for (const key of Object.keys(raw)) {
      const normKey = normalizeHeader(key);
      if (normKey === normLabel || normKey === normSrc || normKey === normId) {
        let val = raw[key];
        const strVal = String(val).trim().replace(',', '.');
        const numVal = Number(strVal);
        const isDateCol = normLabel.includes('ngay') || normLabel.includes('date') || normLabel.includes('thoi_gian');
        if (isDateCol || (!isNaN(numVal) && numVal > 25000 && numVal < 75000)) {
          val = formatAnyDateValue(val);
        }
        return val;
      }
    }
  }

  return '';
}

export interface ParsedExcelSheetInfo {
  name: string;
  rowCount: number;
}

export interface ParsedExcelFile {
  headers: string[];
  rows: Record<string, any>[];
  format: 'standard' | 'ghn_settlement' | 'ghn_cod_transfer';
  sheets?: ParsedExcelSheetInfo[];
  ignoredSheetNames?: string[];
}

const GHN_SETTLEMENT_HEADERS = [
  'Mã đơn GHN',
  'Mã đơn khách hàng',
  'Cửa hàng',
  'Mã Shop/Kho',
  'Người nhận',
  'SĐT Người nhận',
  'Địa chỉ nhận',
  'Ngày tạo',
  'Ngày giao/trả',
  'Trạng thái',
  'Tiền COD',
  'Cước phí',
  'Loại dòng đối soát',
  'Sheet đối soát GHN',
];

// GHN's "Phiên chuyển tiền COD" export is a 2-tier header settlement document.
// The parser dynamically merges Row 0 and Row 1 to discover all actual columns.

const ghnShopCodeFrom = (value: any) => {
  const text = String(value || '').trim();
  const match = text.match(/^\s*([A-Za-z0-9]+)\s*[-–]/);
  return match ? match[1] : '';
};

const ghnShopNameFrom = (value: any) => String(value || '')
  .replace(/^\s*[A-Za-z0-9]+\s*[-–]\s*/, '')
  .trim();

const ghnNumber = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseGhnCodTransferSheet(rawSheetData: any[][], sheetName: string): { rows: Record<string, any>[]; headers: string[] } | null {
  for (let rowIndex = 1; rowIndex < Math.min(20, rawSheetData.length); rowIndex++) {
    const rawSubHeaders = rawSheetData[rowIndex] || [];
    const rawSuperHeaders = rawSheetData[rowIndex - 1] || [];
    const headers = rawSubHeaders.map(cell => normalizeHeader(String(cell || '')));
    const groupHeaders = rawSuperHeaders.map(cell => normalizeHeader(String(cell || '')));
    const waybillIndex = headers.findIndex(header => header === 'ma_don_ghn');
    const shopIndex = headers.findIndex(header => header === 'cua_hang');
    const statusIndex = headers.findIndex(header => header === 'trang_thai');
    const codIndex = groupHeaders.findIndex(header => header === 'tien_cod');
    const settlementIndex = groupHeaders.findIndex(header => header === 'tong_doi_soat');
    const feeIndexes = groupHeaders
      .map((header, index) => header === 'phi_dich_vu' ? index : -1)
      .filter(index => index >= 0);

    if (waybillIndex < 0 || shopIndex < 0 || statusIndex < 0 || codIndex < 0 || settlementIndex < 0 || feeIndexes.length !== 1) continue;

    const validWaybill = (value: any) => {
      const text = String(value || '').trim();
      return text.length >= 4 && !['ma_don_ghn', 'tong_cong', 'tong_doi_soat'].includes(normalizeHeader(text));
    };

    // Construct full 2-tier column names from Row 0 (Super header) + Row 1 (Sub header)
    const maxCols = Math.max(rawSuperHeaders.length, rawSubHeaders.length);
    const colNameMap: { index: number; name: string }[] = [];
    const discoveredHeadersSet = new Set<string>();

    for (let c = 0; c < maxCols; c++) {
      const h1 = String(rawSuperHeaders[c] || '').trim();
      const h2 = String(rawSubHeaders[c] || '').trim();
      let label = '';
      if (h1 && h2) {
        if (h1.toLowerCase().includes('danh sách đơn')) {
          label = h2;
        } else if (h2.startsWith('(') && (h2.endsWith(')') || h2.includes('+'))) {
          label = `${h1} ${h2}`;
        } else if (h1.toLowerCase() === h2.toLowerCase()) {
          label = h1;
        } else {
          label = `${h1} - ${h2}`;
        }
      } else if (h2) {
        label = h2;
      } else if (h1) {
        label = h1;
      }

      if (label) {
        colNameMap.push({ index: c, name: label });
        discoveredHeadersSet.add(label);
      }
    }

    // Add standard normalized aliases so auto-mapping and matching works seamlessly
    const standardAliases = [
      'Mã đơn GHN',
      'Mã đơn khách hàng',
      'Cửa hàng',
      'Tên Shop',
      'Mã Shop/Kho',
      'Người nhận',
      'Địa chỉ nhận',
      'Ngày tạo',
      'Ngày giao/trả',
      'Trạng thái',
      'Tiền COD',
      'Cước phí',
      'Điều chỉnh',
      'Tổng đối soát',
      'Loại dòng đối soát',
      'Sheet đối soát GHN',
    ];
    standardAliases.forEach(h => discoveredHeadersSet.add(h));

    const rows: Record<string, any>[] = [];
    for (let dataIndex = rowIndex + 1; dataIndex < rawSheetData.length; dataIndex++) {
      const row = rawSheetData[dataIndex] || [];
      const waybill = row[waybillIndex];
      if (!validWaybill(waybill)) continue;
      const shopRaw = row[shopIndex] ?? '';
      // GHN stores service fees as negative deductions. The reconciliation
      // engine represents carrier cost as a positive number and adjustment as
      // a signed offset, yielding COD - fee + adjustment = total settlement.
      const fee = Math.abs(ghnNumber(row[feeIndexes[0]]));
      const codOnly = ghnNumber(row[codIndex]);
      // GHN column (2) is 'Giao thất bại - thu tiền'. In GHN settlement, this is collected money paid out to the shop.
      const failCollection = (codIndex >= 0 && row[codIndex + 1] !== undefined) ? ghnNumber(row[codIndex + 1]) : 0;
      const cod = codOnly + failCollection;
      const settlement = ghnNumber(row[settlementIndex]);

      const rowObj: Record<string, any> = {
        'Mã đơn GHN': String(waybill).trim(),
        'Mã đơn khách hàng': row[waybillIndex + 1] ?? '',
        'Cửa hàng': ghnShopNameFrom(shopRaw),
        'Tên Shop': ghnShopNameFrom(shopRaw),
        'Mã Shop/Kho': ghnShopCodeFrom(shopRaw),
        'Người nhận': row[shopIndex + 1] ?? '',
        'Địa chỉ nhận': row[shopIndex + 2] ?? '',
        'Ngày tạo': row[shopIndex + 3] ?? '',
        'Ngày giao/trả': row[shopIndex + 4] ?? '',
        'Trạng thái': row[statusIndex] ?? '',
        'Tiền COD': cod,
        'Tiền COD thuần': codOnly,
        'Giao thất bại - thu tiền': failCollection,
        'Giao thất bại - thu tiền (2)': failCollection,
        'Cước phí': fee,
        'Điều chỉnh': settlement - cod + fee,
        'Tổng đối soát': settlement,
        'Loại dòng đối soát': 'Phiên chuyển tiền COD GHN',
        'Sheet đối soát GHN': sheetName,
      };

      // Populate every raw 2-tier column value into rowObj
      colNameMap.forEach(({ index, name }) => {
        const val = row[index];
        if (val !== undefined && val !== null) {
          rowObj[name] = val;
        }
      });

      rows.push(rowObj);
    }
    return { rows, headers: Array.from(discoveredHeadersSet) };
  }
  return null;
}

export function parseGhnCodTransferWorkbook(workbook: XLSX.WorkBook, sheetNames?: string[]): ParsedExcelFile | null {
  const allDiscoveredHeaders = new Set<string>();
  const ghnSheets = workbook.SheetNames.map(sheetName => {
    const rawSheetData: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const result = parseGhnCodTransferSheet(rawSheetData, sheetName);
    if (result) {
      result.headers.forEach(h => allDiscoveredHeaders.add(h));
      return { name: sheetName, rows: result.rows };
    }
    return null;
  }).filter((sheet): sheet is { name: string; rows: Record<string, any>[] } => !!sheet);
  if (ghnSheets.length === 0) return null;
  const selectedSheets = sheetNames === undefined ? ghnSheets : ghnSheets.filter(sheet => sheetNames.includes(sheet.name));
  return {
    headers: Array.from(allDiscoveredHeaders),
    rows: selectedSheets.flatMap(sheet => sheet.rows),
    format: 'ghn_cod_transfer',
    sheets: ghnSheets.map(sheet => ({ name: sheet.name, rowCount: sheet.rows.length })),
    ignoredSheetNames: workbook.SheetNames.filter(name => !ghnSheets.some(sheet => sheet.name === name)),
  };
}

function findGhnHeaderRow(rawSheetData: any[][]): number {
  for (let rowIndex = 0; rowIndex < Math.min(60, rawSheetData.length); rowIndex++) {
    const normalized = (rawSheetData[rowIndex] || []).map(cell => normalizeHeader(String(cell || '')));
    const waybillCount = normalized.filter(header => header === 'ma_don_ghn').length;
    if (waybillCount >= 2 && normalized.includes('cua_hang')) return rowIndex;
  }
  return -1;
}

/**
 * GHN settlement workbooks place two independent ledgers side-by-side:
 * delivered COD orders on the left and shipment fees charged in the period on
 * the right. A waybill can appear once in each ledger: it is one shipment,
 * not a duplicate. Merge only that unambiguous one-to-one case; every other
 * repetition remains separate so the reconciliation gate can hold it for
 * manual verification.
 */
function parseGhnSettlementSheet(rawSheetData: any[][], sheetName: string): Record<string, any>[] | null {
  const headerRowIndex = findGhnHeaderRow(rawSheetData);
  if (headerRowIndex < 0) return null;

  const headers = rawSheetData[headerRowIndex] || [];
  const normalized = headers.map(cell => normalizeHeader(String(cell || '')));
  const waybillIndexes = normalized
    .map((header, index) => header === 'ma_don_ghn' ? index : -1)
    .filter(index => index >= 0);
  if (waybillIndexes.length < 2) return null;

  const [deliveredStart, feeStart] = waybillIndexes;
  const deliveredRows: Record<string, any>[] = [];
  const feeRows: Record<string, any>[] = [];
  const valueAt = (row: any[], index: number) => row[index] ?? '';
  const validWaybill = (value: any) => {
    const text = String(value || '').trim();
    return text.length >= 4 && !['ma_don_ghn', 'tong_cong', 'tổng cộng'].includes(normalizeHeader(text));
  };
  const shopCodeFrom = ghnShopCodeFrom;
  const shopNameKey = (value: any) => normalizeHeader(String(value || '').replace(/^\s*[A-Za-z0-9]+\s*[-–]\s*/, ''));
  const codesByShopName = new Map<string, Set<string>>();
  for (let rowIndex = headerRowIndex + 1; rowIndex < rawSheetData.length; rowIndex++) {
    const shopValue = valueAt(rawSheetData[rowIndex] || [], deliveredStart + 2);
    const code = shopCodeFrom(shopValue);
    const key = shopNameKey(shopValue);
    if (code && key) {
      const codes = codesByShopName.get(key) || new Set<string>();
      codes.add(code);
      codesByShopName.set(key, codes);
    }
  }

  for (let rowIndex = headerRowIndex + 1; rowIndex < rawSheetData.length; rowIndex++) {
    const row = rawSheetData[rowIndex] || [];
    const deliveredWaybill = valueAt(row, deliveredStart);
    const feeWaybill = valueAt(row, feeStart);

    if (validWaybill(deliveredWaybill)) {
      deliveredRows.push({
        'Mã đơn GHN': String(deliveredWaybill).trim(),
        'Mã đơn khách hàng': valueAt(row, deliveredStart + 1),
        'Cửa hàng': valueAt(row, deliveredStart + 2),
        'Mã Shop/Kho': shopCodeFrom(valueAt(row, deliveredStart + 2)),
        'Người nhận': valueAt(row, deliveredStart + 3),
        'Địa chỉ nhận': valueAt(row, deliveredStart + 4),
        'Ngày tạo': valueAt(row, deliveredStart + 5),
        'Ngày giao/trả': valueAt(row, deliveredStart + 6),
        'Trạng thái': valueAt(row, deliveredStart + 7),
        // GHN uses the third COD column: (1) + (2).
        'Tiền COD': valueAt(row, deliveredStart + 10),
        'Cước phí': 0,
        'Loại dòng đối soát': 'COD đã phát thành công',
        'Sheet đối soát GHN': sheetName,
      });
    }

    if (validWaybill(feeWaybill)) {
      const rawFee = valueAt(row, feeStart + 7);
      const numericFee = typeof rawFee === 'number' ? rawFee : Number(String(rawFee).replace(/[^0-9.-]/g, ''));
      const feeShopName = valueAt(row, feeStart + 2);
      const feeShopCodes = codesByShopName.get(shopNameKey(feeShopName));
      const inferredFeeShopCode = feeShopCodes?.size === 1 ? Array.from(feeShopCodes)[0] : '';
      feeRows.push({
        'Mã đơn GHN': String(feeWaybill).trim(),
        'Mã đơn khách hàng': valueAt(row, feeStart + 1),
        'Cửa hàng': feeShopName,
        // GHN's right-hand fee ledger often omits the numeric prefix. Infer it
        // only when the same normalized shop name maps to exactly one code in
        // the left COD ledger of this very sheet; otherwise leave it blank.
        'Mã Shop/Kho': shopCodeFrom(feeShopName) || inferredFeeShopCode,
        'Người nhận': valueAt(row, feeStart + 3),
        'SĐT Người nhận': valueAt(row, feeStart + 4),
        'Địa chỉ nhận': valueAt(row, feeStart + 5),
        'Ngày tạo': valueAt(row, feeStart + 6),
        'Ngày giao/trả': '',
        'Trạng thái': 'Đã cấn cước GHN',
        // GHN writes charged fees as negative numbers; reconciliation stores
        // carrier costs as positive amounts.
        'Tiền COD': 0,
        'Cước phí': Number.isFinite(numericFee) ? Math.abs(numericFee) : 0,
        'Loại dòng đối soát': 'Cước GHN đã cấn trừ',
        'Sheet đối soát GHN': sheetName,
      });
    }
  }
  const byWaybill = (items: Record<string, any>[]) => items.reduce((map, item) => {
    const waybill = String(item['Mã đơn GHN'] || '').trim().toUpperCase();
    const list = map.get(waybill) || [];
    list.push(item);
    map.set(waybill, list);
    return map;
  }, new Map<string, Record<string, any>[]>());
  const deliveredByWaybill = byWaybill(deliveredRows);
  const feesByWaybill = byWaybill(feeRows);
  const rows: Record<string, any>[] = [];
  const mergedWaybills = new Set<string>();

  deliveredRows.forEach(delivered => {
    const waybill = String(delivered['Mã đơn GHN'] || '').trim().toUpperCase();
    const deliveredMatches = deliveredByWaybill.get(waybill) || [];
    const feeMatches = feesByWaybill.get(waybill) || [];
    if (deliveredMatches.length === 1 && feeMatches.length === 1) {
      const fee = feeMatches[0];
      rows.push({
        ...delivered,
        'Cước phí': fee['Cước phí'],
        'Loại dòng đối soát': 'COD + cước GHN đã cấn trừ',
      });
      mergedWaybills.add(waybill);
      return;
    }
    rows.push(delivered);
  });

  feeRows.forEach(fee => {
    const waybill = String(fee['Mã đơn GHN'] || '').trim().toUpperCase();
    if (!mergedWaybills.has(waybill)) rows.push(fee);
  });

  return rows;
}

export function parseGhnSettlementWorkbook(workbook: XLSX.WorkBook, sheetNames?: string[]): ParsedExcelFile | null {
  const ghnSheets = workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rawSheetData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const rows = parseGhnSettlementSheet(rawSheetData, sheetName);
    return rows ? { name: sheetName, rows } : null;
  }).filter((sheet): sheet is { name: string; rows: Record<string, any>[] } => !!sheet);

  if (ghnSheets.length === 0) return null;
  const selectedSheets = sheetNames === undefined
    ? ghnSheets
    : ghnSheets.filter(sheet => sheetNames.includes(sheet.name));
  return {
    headers: GHN_SETTLEMENT_HEADERS,
    rows: selectedSheets.flatMap(sheet => sheet.rows),
    format: 'ghn_settlement',
    sheets: ghnSheets.map(sheet => ({ name: sheet.name, rowCount: sheet.rows.length })),
    ignoredSheetNames: workbook.SheetNames.filter(name => !ghnSheets.some(sheet => sheet.name === name)),
  };
}

export const ExcelService = {
  // Intelligent parser supporting title banners, multi-line headers and multiple sheets
  async parseExcelFile(file: File, options?: { sheetNames?: string[] }): Promise<ParsedExcelFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          const ghnCodTransferParsed = parseGhnCodTransferWorkbook(workbook, options?.sheetNames);
          if (ghnCodTransferParsed) {
            resolve(ghnCodTransferParsed);
            return;
          }

          const ghnParsed = parseGhnSettlementWorkbook(workbook, options?.sheetNames);
          if (ghnParsed) {
            resolve(ghnParsed);
            return;
          }

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to 2D array of rows to inspect headers
          const rawSheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          if (!rawSheetData || rawSheetData.length === 0) {
            resolve({ headers: [], rows: [], format: 'standard' });
            return;
          }

          // Search top 10 rows to find the actual header row(s) containing key logistics terms
          let headerRowIndex = -1;
          let bestScore = 0;

          for (let r = 0; r < Math.min(10, rawSheetData.length); r++) {
            const row = rawSheetData[r];
            if (!Array.isArray(row)) continue;
            
            const rowStr = row.map(c => normalizeHeader(String(c))).join(' ');
            let score = 0;
            if (rowStr.includes('ma_van_don') || rowStr.includes('tracking') || rowStr.includes('mvd') || rowStr.includes('ma_don')) score += 5;
            if (rowStr.includes('thu_ho') || rowStr.includes('cod')) score += 3;
            if (rowStr.includes('ten_shop') || rowStr.includes('nguoi_gui') || rowStr.includes('kho_gui') || rowStr.includes('cua_hang')) score += 3;
            if (rowStr.includes('cuoc') || rowStr.includes('phi')) score += 2;
            if (rowStr.includes('trong_luong') || rowStr.includes('can_nang') || rowStr.includes('khoi_luong')) score += 2;
            if (rowStr.includes('trang_thai') || rowStr.includes('status')) score += 2;

            if (score > bestScore) {
              bestScore = score;
              headerRowIndex = r;
            }
          }

          if (headerRowIndex === -1) {
            headerRowIndex = 0;
          }

          // Check if headerRowIndex + 1 is ALSO a header row (2-header Excel layout like GHN)
          let hasSecondHeaderRow = false;
          if (headerRowIndex + 1 < rawSheetData.length) {
            const nextRow = rawSheetData[headerRowIndex + 1];
            if (Array.isArray(nextRow)) {
              const nextRowStr = nextRow.map(c => normalizeHeader(String(c))).join(' ');
              const isNextRowHeader = (
                nextRowStr.includes('ma_van_don') ||
                nextRowStr.includes('tracking') ||
                nextRowStr.includes('mvd') ||
                nextRowStr.includes('ma_don') ||
                nextRowStr.includes('ten_shop') ||
                nextRowStr.includes('nguoi_gui') ||
                nextRowStr.includes('thu_ho') ||
                nextRowStr.includes('cod') ||
                nextRowStr.includes('cuoc') ||
                nextRowStr.includes('phi') ||
                nextRowStr.includes('trong_luong') ||
                nextRowStr.includes('can_nang') ||
                nextRowStr.includes('sdt') ||
                nextRowStr.includes('dien_thoai') ||
                nextRowStr.includes('trang_thai') ||
                nextRowStr.includes('dia_chi')
              );

              // Ensure nextRow is not a real data row containing numeric values > 100 or dates
              const hasRealNumericData = nextRow.some(val => typeof val === 'number' && val > 100);
              if (isNextRowHeader && !hasRealNumericData) {
                hasSecondHeaderRow = true;
              }
            }
          }

          // Extract and merge headers
          const topHeadersRow = rawSheetData[headerRowIndex] || [];
          const subHeadersRow = hasSecondHeaderRow ? (rawSheetData[headerRowIndex + 1] || []) : [];
          
          const maxCols = Math.max(topHeadersRow.length, subHeadersRow.length);
          const headers: string[] = [];

          // Forward-fill merged parent headers (Excel merged cells e.g. "Thông tin người gửi" spanning cols)
          let currentParentHeader = '';
          const resolvedTopHeaders: string[] = [];
          for (let cIdx = 0; cIdx < maxCols; cIdx++) {
            const topVal = String(topHeadersRow[cIdx] || '').trim();
            if (topVal) {
              currentParentHeader = topVal;
            }
            resolvedTopHeaders.push(topVal || currentParentHeader);
          }

          for (let cIdx = 0; cIdx < maxCols; cIdx++) {
            const topH = (resolvedTopHeaders[cIdx] || '').trim();
            const subH = String(subHeadersRow[cIdx] || '').trim();

            let finalHeaderName = '';
            if (topH && subH && topH !== subH && !topH.toLowerCase().startsWith('stt')) {
              finalHeaderName = `${topH} - ${subH}`;
            } else if (subH) {
              finalHeaderName = subH;
            } else if (topH) {
              finalHeaderName = topH;
            } else {
              finalHeaderName = `Cột_${cIdx + 1}`;
            }

            headers.push(finalHeaderName);
          }

          // 🔑 Waybill Anchor Alignment Engine: Find exact column index of waybill
          let waybillColIdx = -1;
          for (let c = 0; c < headers.length; c++) {
            const hNorm = normalizeHeader(headers[c]);
            if (hNorm.includes('ma_van_don') || hNorm.includes('mvd') || hNorm.includes('tracking') || hNorm.includes('ma_don')) {
              waybillColIdx = c;
              break;
            }
          }

          // Scan downwards to find the FIRST row that contains a real Waybill code
          let dataStartRowIndex = hasSecondHeaderRow ? headerRowIndex + 2 : headerRowIndex + 1;
          if (waybillColIdx !== -1) {
            for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 10, rawSheetData.length); r++) {
              const rowVal = String(rawSheetData[r]?.[waybillColIdx] || '').trim();
              const normVal = normalizeHeader(rowVal);
              const isHeaderVal = normVal.includes('ma_van_don') || normVal.includes('ma_don') || normVal.includes('tracking') || normVal.includes('stt') || normVal.includes('tong');
              
              if (rowVal && rowVal.length >= 3 && !isHeaderVal) {
                dataStartRowIndex = r;
                break;
              }
            }
          }

          // Build object rows from subsequent data rows
          const rows: Record<string, any>[] = [];
          for (let r = dataStartRowIndex; r < rawSheetData.length; r++) {
            const rowData = rawSheetData[r];
            if (!Array.isArray(rowData)) continue;

            const isRowEmpty = rowData.every(val => val === '' || val === null || val === undefined);
            if (isRowEmpty) continue;

            const rowObj: Record<string, any> = {};
            headers.forEach((headerName, cIdx) => {
              rowObj[headerName] = rowData[cIdx] !== undefined ? rowData[cIdx] : '';
            });
            rows.push(rowObj);
          }

          resolve({ headers, rows, format: 'standard' });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  formatMoney(num: number): string {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
  },



  async createShopStatementWorkbook(statement: ShopSettlementStatement, customExportSettings?: ExportColumnSettings): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const carrierId = statement.orders?.[0]?.carrierId;
    const savedSettings = customExportSettings || (carrierId ? StorageService.getCarrierExportSettings(carrierId) : undefined);
    
    // Default to ALL merged columns from the 2 files if no custom carrier settings exist
    const activeCols = buildDynamicColumnsFromOrders(statement.orders, savedSettings, false);
    const company = StorageService.getCompanyInfo();

    const companyTitle = (company.companyName || 'CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS').toUpperCase();
    const companySubtitle = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    // ──────────────────────────────────────────
    // SHEET 1: TỔNG HỢP CÔNG NỢ
    // ──────────────────────────────────────────
    const wsSummary = workbook.addWorksheet('TONG_HOP_CONG_NO');
    wsSummary.views = [{ showGridLines: false }]; // 🌟 Yêu cầu 3: Ẩn đường kẻ lưới dạng hóa đơn

    wsSummary.columns = [
      { width: 44 },
      { width: 30 },
      { width: 18 },
      { width: 44 },
    ];

    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    };

    // 🌟 Yêu cầu 4: Tên công ty to trên cùng gộp ô A1:D1 và căn giữa
    const row1 = wsSummary.addRow([companyTitle, '', '', '']);
    wsSummary.mergeCells('A1:D1');
    row1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } }; // Dark Navy
    row1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const row2 = wsSummary.addRow([companySubtitle, '', '', '']);
    wsSummary.mergeCells('A2:D2');
    row2.font = { name: 'Arial', size: 10.5, italic: true, color: { argb: 'FF475569' } }; // Slate Gray
    row2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const row3 = wsSummary.addRow(['BẢNG KÊ ĐỐI SOÁT TIỀN THU HỘ (COD) VÀ CƯỚC PHÍ VẬN CHUYỂN', '', '', '']);
    wsSummary.mergeCells('A3:D3');
    row3.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF4F46E5' } }; // Indigo
    row3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const row4 = wsSummary.addRow([`Kỳ đối soát: ${statement.periodName}`, '', `Ngày xuất phiếu: ${new Date().toLocaleDateString('vi-VN')}`, '']);
    row4.font = { name: 'Arial', size: 11, color: { argb: 'FF334155' } };

    wsSummary.addRow([]); // Blank line

    // Section I: Shop Info Box
    const sec1 = wsSummary.addRow(['I. THÔNG TIN KHÁCH HÀNG (SHOP)', '', '', '']);
    sec1.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF1E293B' } };

    const r7 = wsSummary.addRow(['Tên Shop:', statement.shopName, 'Mã khách hàng:', statement.shopCode]);
    const r8 = wsSummary.addRow(['Số điện thoại:', statement.shopPhone, 'Email:', statement.shopEmail || '']);
    const r9 = wsSummary.addRow(['Địa chỉ gửi:', statement.shopAddress || '', '', '']);

    [r7, r8, r9].forEach(r => {
      r.eachCell({ includeEmpty: true }, cell => {
        cell.border = thinBorder;
      });
      r.getCell(1).font = { bold: true };
      r.getCell(3).font = { bold: true };
    });

    wsSummary.addRow([]);

    // Section II: Bank Info Box
    const sec2 = wsSummary.addRow(['II. THÔNG TIN TÀI KHOẢN NHẬN TIỀN COD', '', '', '']);
    sec2.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF1E293B' } };

    const r12 = wsSummary.addRow(['Ngân hàng:', statement.bankInfo?.bankName || 'Chưa cập nhật', '', '']);
    const r13 = wsSummary.addRow(['Số tài khoản:', statement.bankInfo?.accountNumber || 'Chưa cập nhật', '', '']);
    const r14 = wsSummary.addRow(['Chủ tài khoản:', statement.bankInfo?.accountHolder || statement.shopName || 'Chưa cập nhật', '', '']);

    [r12, r13, r14].forEach(r => {
      r.eachCell({ includeEmpty: true }, cell => {
        cell.border = thinBorder;
      });
      r.getCell(1).font = { bold: true };
    });

    wsSummary.addRow([]);

    // Section III: Financial Summary Table
    const sec3 = wsSummary.addRow(['III. BẢNG TỔNG HỢP DÒNG TIỀN ĐỐI SOÁT', '', '', '']);
    sec3.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF1E293B' } };

    const tblHeader = wsSummary.addRow(['Hạng mục', 'Số lượng / Giá trị', 'Đơn vị tính', 'Ghi chú']);
    tblHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    // 🌟 Thống kê chi tiết tài chính: Tách chuẩn xác Đơn Giao Thành Công (Hoàn COD) và Đơn Gửi Hàng (Tính Cước)
    // CHỈ cấn trừ công nợ đầu kỳ khi Shop bị nợ cước âm (< 0), tuyệt đối không cộng dồn số tiền dương của kỳ trước.
    const previousDebtVal = (statement.previousDebt && statement.previousDebt < 0) ? statement.previousDebt : 0;
    const finalPayout = Math.max(0, statement.totalNetPayout + previousDebtVal);
    const amountShopOwes = Math.max(0, -(statement.totalNetPayout + previousDebtVal));

    const codOrders = statement.orders.filter(o => (o.codAmount || 0) > 0);
    const feeOrders = statement.orders.filter(o => ((o.shopCalculatedFee || 0) + (o.shopOtherFee || 0)) > 0);
    const returnedOrdersList = statement.orders.filter(o => o.status === 'returned' || o.status === 'returning');
    const partialOrdersList = statement.orders.filter(o => o.isPartialDelivery);

    const rowsData = [
      ['1. Tổng số dòng đối soát trong kỳ', statement.totalOrders, 'Đơn', 'Tổng đơn xuất đối soát trong kỳ'],
      ['2. Số đơn giao thành công (Hoàn COD)', codOrders.length, 'Đơn', `Tiền COD hoàn: ${statement.totalCod.toLocaleString('vi-VN')} VNĐ | Cước: 0 VNĐ`],
      ['3. Số đơn phát sinh gửi hàng (Tính cước)', feeOrders.length, 'Đơn', `Cước gửi: ${(statement.totalShopFee + statement.totalShopOtherFee).toLocaleString('vi-VN')} VNĐ | COD: 0 VNĐ`],
      ['4. Số đơn chuyển hoàn', returnedOrdersList.length, 'Đơn', returnedOrdersList.length > 0 ? `Phí hoàn: ${(statement.totalReturnedFee || 0).toLocaleString('vi-VN')} VNĐ` : 'Không có'],
      ['5. Số đơn giao 1 phần (GH1P)', partialOrdersList.length, 'Đơn', partialOrdersList.length > 0 ? `COD: ${(statement.totalPartialCod || 0).toLocaleString('vi-VN')} VNĐ | Cước/Phí: ${(statement.totalPartialFee || 0).toLocaleString('vi-VN')} VNĐ` : 'Không có'],
      ['6. TỔNG TIỀN THU HỘ (COD) (+)', statement.totalCod, 'VNĐ', 'Tổng tiền COD NVC đã thu từ người nhận'],
      ['7. TỔNG CƯỚC PHÍ VẬN CHUYỂN (-)', statement.totalShopFee, 'VNĐ', 'Cước tính theo biểu giá riêng của Shop'],
      ['8. Phí phụ thu / Khai giá / GH1P / Bảo hiểm (-)', statement.totalShopOtherFee, 'VNĐ', 'Bao gồm phụ phí, khai giá và cước GH1P'],
      ['9. Công nợ đầu kỳ (-/+) ', previousDebtVal, 'VNĐ', previousDebtVal < 0 ? 'Shop nợ công ty (trừ vào kỳ này)' : 'Không có công nợ đầu kỳ'],
      ['10. Shop còn nợ công ty', amountShopOwes, 'VNĐ', amountShopOwes > 0 ? 'Tự chuyển sang kỳ sau để cấn trừ' : 'Không phát sinh'],
    ];

    rowsData.forEach(r => {
      const addedRow = wsSummary.addRow(r);
      addedRow.eachCell({ includeEmpty: true }, cell => {
        cell.border = thinBorder;
      });

      const valCell = addedRow.getCell(2);
      if (typeof r[1] === 'number' && (typeof r[0] === 'string' && (r[0].includes('TỔNG') || r[0].includes('Công nợ')))) {
        valCell.numFmt = '#,##0';
        valCell.font = { bold: true };
      }
      addedRow.getCell(3).alignment = { horizontal: 'center' };
    });

    // 🌟 GRAND TOTAL ROW (SỐ TIỀN THỰC CHUYỂN FOR SHOP) - Yellow Fill + Bold Red Text
    const grandRow = wsSummary.addRow(['▶ SỐ TIỀN THỰC CHUYỂN CHO SHOP (=)', finalPayout, 'VNĐ', amountShopOwes > 0 ? 'Không chuyển tiền; công nợ shop được chuyển sang kỳ sau' : 'Tiền công ty sẽ chuyển khoản cho Shop']);
    grandRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFF0000' } }; // Red
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
    grandRow.getCell(2).numFmt = '#,##0';
    grandRow.getCell(3).alignment = { horizontal: 'center' };

    wsSummary.addRow([]);

    // 🌟 Yêu cầu 2: Thay "ĐẠI DIỆN NHÀ GOM ĐƠN" thành "ĐẠI DIỆN CÔNG TY KÝ"
    const sigRow1 = wsSummary.addRow(['ĐẠI DIỆN CÔNG TY KÝ', '', 'ĐẠI DIỆN KHÁCH HÀNG (SHOP)']);
    sigRow1.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    sigRow1.getCell(1).alignment = { horizontal: 'center' };
    sigRow1.getCell(3).alignment = { horizontal: 'center' };

    const sigRow2 = wsSummary.addRow(['(Ký & Ghi rõ họ tên)', '', '(Ký & Ghi rõ họ tên)']);
    sigRow2.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
    sigRow2.getCell(1).alignment = { horizontal: 'center' };
    sigRow2.getCell(3).alignment = { horizontal: 'center' };

    // ──────────────────────────────────────────
    // SHEET 2: CHI TIẾT ĐƠN HÀNG (DYNAMIC NON-EMPTY COLUMNS)
    // ──────────────────────────────────────────
    const wsOrders = workbook.addWorksheet('CHI_TIET_VAN_DON');

    // Column Widths
    wsOrders.columns = activeCols.map((col: ExportColumnItem) => {
      const lowerLabel = (col.label || col.id).toLowerCase();
      if (col.id === 'stt') return { width: 8 };
      if (col.id === 'waybill') return { width: 22 };
      if (col.id === 'receiverAddress') return { width: 38 };
      if (col.id === 'receiverName' || col.id === 'productName') return { width: 26 };
      if (col.id === 'date' || lowerLabel.includes('ngay') || lowerLabel.includes('date') || lowerLabel.includes('thoi_gian')) return { width: 22 };
      return { width: 20 };
    });

    // Sheet 2 Company Header
    const oRow1 = wsOrders.addRow([companyTitle]);
    oRow1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

    const oRow2 = wsOrders.addRow([companySubtitle]);
    oRow2.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };

    const oRow3 = wsOrders.addRow([`BẢNG KÊ CHI TIẾT MÃ VẬN ĐƠN ĐỐI SOÁT - SHOP: ${statement.shopName.toUpperCase()}`]);
    oRow3.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF4F46E5' } };

    wsOrders.addRow([]); // Blank line

    // Table Header Row
    const headersRow = activeCols.map((c: ExportColumnItem) => c.label);
    const oTblHeader = wsOrders.addRow(headersRow);
    oTblHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Orders Data Rows
    statement.orders.forEach((order, idx) => {
      const rowData: any[] = [];
      activeCols.forEach((col: ExportColumnItem) => {
        let val: any = '';
        const normLabel = normalizeHeader(col.label || col.id || '');
        const normSrc = normalizeHeader(col.sourceHeader || '');

        if (col.id === 'stt' || normLabel === 'stt') {
          val = idx + 1;
        } else if (
          col.id === 'shopFee' ||
          normLabel === 'cuoc_tinh_shop_vnd' ||
          normLabel.includes('tien_cuoc_pp_pm') ||
          normLabel.includes('cuoc_chinh') ||
          normLabel.includes('cuoc_phi_van_chuyen') ||
          normLabel.includes('cuoc_thu_shop') ||
          normSrc.includes('tien_cuoc_pp_pm') ||
          normSrc.includes('cuoc_chinh')
        ) {
          // 🛡️ BẢO VỆ GIÁ VỐN: Luôn xuất giá cước thỏa thuận của Shop, không bao giờ xuất cước gốc NVC
          val = order.shopCalculatedFee ?? 0;
        } else if (
          col.id === 'shopOtherFee' ||
          normLabel === 'phu_phi_shop_vnd' ||
          normLabel.includes('phi_hoan_hang') ||
          normLabel.includes('phu_thu')
        ) {
          val = order.shopOtherFee ?? 0;
        } else if (
          col.id === 'netPayout' ||
          normLabel === 'thuc_chuyen_cho_shop_vnd' ||
          normLabel.includes('so_tien_phai_tra_sau_can_tru') ||
          normLabel.includes('thuc_chuyen') ||
          normLabel.includes('thuc_tra') ||
          normSrc.includes('so_tien_phai_tra_sau_can_tru')
        ) {
          // 🛡️ BẢO VỆ SỐ TIỀN: Luôn xuất số tiền thực chuyển cho Shop (= COD - Cước Shop)
          val = order.netShopPayout ?? 0;
        } else if (
          col.id === 'profit' ||
          col.id === 'nvcFee' ||
          normLabel.includes('loi_nhuan') ||
          normLabel.includes('lai_rong') ||
          normLabel.includes('cuoc_goc') ||
          normLabel.includes('cuoc_nvc') ||
          normSrc.includes('cuoc_goc')
        ) {
          // 🛡️ TUYỆT ĐỐI ẨN LỢI NHUẬN / CƯỚC GỐC KHỎI FILE SHOP
          val = 0;
        } else {
          val = (order.rawNvcData && col.sourceHeader && order.rawNvcData[col.sourceHeader] !== undefined ? order.rawNvcData[col.sourceHeader] : undefined) ??
                (order.rawAppData && col.sourceHeader && order.rawAppData[col.sourceHeader] !== undefined ? order.rawAppData[col.sourceHeader] : undefined) ??
                (order.rawNvcData && order.rawNvcData[col.label] !== undefined ? order.rawNvcData[col.label] : undefined) ??
                (order.rawAppData && order.rawAppData[col.label] !== undefined ? order.rawAppData[col.label] : undefined) ??
                resolveOrderColumnValue(order, col, idx);
        }

        const isDateCol = (normLabel.includes('ngay') || normLabel.includes('date') || normLabel.includes('thoi_gian') ||
                           normSrc.includes('ngay') || normSrc.includes('date') || normSrc.includes('thoi_gian')) &&
                          !normLabel.includes('tien') && !normLabel.includes('cuoc') && !normLabel.includes('phi') && !normLabel.includes('cod') && !normLabel.includes('tra') &&
                          !normSrc.includes('tien') && !normSrc.includes('cuoc') && !normSrc.includes('phi') && !normSrc.includes('cod') && !normSrc.includes('tra');
        
        if (isDateCol && val !== undefined && val !== null && val !== '') {
          val = formatAnyDateValue(val);
        }
        rowData.push(val ?? '');
      });

      const addedOrderRow = wsOrders.addRow(rowData);
      
      // Formatting cell values
      activeCols.forEach((col, cIdx) => {
        const cell = addedOrderRow.getCell(cIdx + 1);
        const normId = normalizeHeader(col.id || '');
        const normLabel = normalizeHeader(col.label || '');

        if (
          normId === 'codamount' || normId === 'shopfee' || normId === 'shopotherfee' || normId === 'netpayout' || normId === 'nvcfee' || normId === 'profit' ||
          normLabel.includes('cod') || normLabel.includes('thu_ho') || normLabel.includes('cuoc') || normLabel.includes('thuc_chuyen') || normLabel.includes('thuc_tra') || normLabel.includes('phi') || normLabel.includes('tien_')
        ) {
          const num = Number(cell.value);
          if (!isNaN(num) && typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          }
        } else if (normId === 'weight' || normLabel.includes('khoi_luong') || normLabel.includes('trong_luong') || normLabel.includes('can_nang')) {
          const num = Number(cell.value);
          if (!isNaN(num)) {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        } else if (
          normId === 'stt' || normId === 'waybill' || normId === 'date' ||
          normLabel.includes('stt') || normLabel.includes('ma_van_don') || normLabel.includes('ngay') || normLabel.includes('date') || normLabel.includes('thoi_gian') || normLabel.includes('gui_hang')
        ) {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    // 🌟 TOTAL SUMMARY ROW (TỔNG CỘNG BÔI VÀNG Ô CHỮ ĐỎ)
    const totalWeight = Number(statement.orders.reduce((sum, o) => sum + (o.weight || 0), 0).toFixed(2));
    const totalRowData: any[] = [];
    activeCols.forEach((col: ExportColumnItem) => {
      const normId = normalizeHeader(col.id || '');
      const normLabel = normalizeHeader(col.label || '');
      const src = col.sourceHeader || '';

      if (normId === 'stt' || normLabel === 'stt') {
        totalRowData.push('TỔNG CỘNG');
      } else if (normId === 'waybill' || src === 'Mã vận đơn' || normLabel === 'ma_van_don') {
        totalRowData.push(`${statement.orders.length} đơn`);
      } else if (normId === 'weight' || normLabel === 'khoi_luong' || normLabel === 'trong_luong' || normLabel === 'can_nang') {
        totalRowData.push(totalWeight);
      } else if (col.id === 'codAmount' || src === 'Tiền COD đã ký nhận' || src === 'Tiền thu hộ COD' || src === 'COD thực thu' || normLabel === 'tien_cod_da_ky_nhan' || normLabel === 'tien_thu_ho_cod') {
        totalRowData.push(statement.totalCod);
      } else if (
        col.id === 'shopFee' ||
        normLabel === 'cuoc_tinh_shop_vnd' ||
        normLabel === 'cuoc_thu_shop' ||
        normLabel.includes('tien_cuoc_pp_pm') ||
        normLabel.includes('cuoc_chinh') ||
        src === 'Tiền cước PP_PM'
      ) {
        totalRowData.push(statement.totalShopFee);
      } else if (col.id === 'shopOtherFee' || normLabel === 'phu_phi_shop_vnd') {
        totalRowData.push(statement.totalShopOtherFee);
      } else if (
        col.id === 'netPayout' ||
        normLabel === 'thuc_chuyen_cho_shop_vnd' ||
        normLabel.includes('so_tien_phai_tra_sau_can_tru') ||
        src === 'Số tiền phải trả sau cấn trừ'
      ) {
        totalRowData.push(statement.totalNetPayout);
      } else if (col.category === 'carrier' || (col.sourceHeader && (normLabel.includes('phi') || normLabel.includes('tien') || normLabel.includes('cuoc')))) {
        const colSum = statement.orders.reduce((sum, o) => {
          const v = (o.rawNvcData && col.sourceHeader ? o.rawNvcData[col.sourceHeader] : undefined) ??
                    (o.rawAppData && col.sourceHeader ? o.rawAppData[col.sourceHeader] : undefined) ??
                    (o.rawNvcData ? o.rawNvcData[col.label] : undefined) ??
                    (o.rawAppData ? o.rawAppData[col.label] : undefined);
          const n = typeof v === 'number' ? v : Number(String(v || '').replace(',', '.'));
          return sum + (!isNaN(n) ? n : 0);
        }, 0);
        totalRowData.push(colSum !== 0 ? colSum : 0);
      } else {
        totalRowData.push('');
      }
    });

    const oGrandRow = wsOrders.addRow(totalRowData);
    activeCols.forEach((col, cIdx) => {
      const cell = oGrandRow.getCell(cIdx + 1);
      const normId = normalizeHeader(col.id || '');
      const normLabel = normalizeHeader(col.label || '');

      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow Fill
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } }; // Bold Red Text
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } }
      };

      if (
        normId === 'codamount' || normId === 'shopfee' || normId === 'shopotherfee' || normId === 'netpayout' ||
        normLabel.includes('cod') || normLabel.includes('thu_ho') || normLabel.includes('cuoc') || normLabel.includes('thuc_chuyen') || typeof cell.value === 'number'
      ) {
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        }
      } else if (normId === 'weight' || normLabel.includes('khoi_luong')) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      } else if (normId === 'stt' || normId === 'waybill' || normLabel === 'stt' || normLabel.includes('ma_van_don')) {
        cell.alignment = { horizontal: 'center' };
      }
    });

    return workbook;
  },

  async downloadShopStatement(statement: ShopSettlementStatement, customExportSettings?: ExportColumnSettings): Promise<void> {
    const carrierId = statement.orders?.[0]?.carrierId;
    const carrierTag = getCleanCarrierTag(carrierId);
    const exportSettings = customExportSettings || (carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings());
    const workbook = await this.createShopStatementWorkbook(statement, exportSettings);
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanShopName = (statement.shopName || statement.shopCode || 'Shop').replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
    const cleanPeriod = (statement.periodName || 'Ky_Doi_Soat').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Doi_Soat_${carrierTag}_${cleanShopName}_${cleanPeriod}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveBlobFile(blob, filename);
  },

  async createMasterProfitWorkbook(session: ReconciliationSession, customExportSettings?: ExportColumnSettings): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const carrierId = session.carrierId;
    const company = StorageService.getCompanyInfo();

    const companyTitle = (company.companyName || 'CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS').toUpperCase();
    const companySubtitle = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    // ──────────────────────────────────────────
    // SHEET 1: TỔNG HỢP THEO SHOP
    // ──────────────────────────────────────────
    const wsMaster = workbook.addWorksheet('TONG_HOP_DOANH_THU_LOI_NHUAN');
    wsMaster.columns = [
      { width: 12 },
      { width: 14 },
      { width: 28 },
      { width: 16 },
      { width: 12 },
      { width: 22 },
      { width: 20 },
      { width: 20 },
      { width: 24 },
      { width: 24 },
      { width: 42 },
    ];

    const mRow1 = wsMaster.addRow([companyTitle]);
    mRow1.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF1E3A8A' } };

    const mRow2 = wsMaster.addRow([companySubtitle]);
    mRow2.font = { name: 'Arial', size: 10.5, italic: true, color: { argb: 'FF475569' } };

    const mRow3 = wsMaster.addRow(['BÁO CÁO TỔNG HỢP ĐỐI SOÁT & LỢI NHUẬN NHÀ GOM ĐƠN']);
    mRow3.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF4F46E5' } };

    wsMaster.addRow([`Kỳ đối soát: ${session.sessionName}`, '', `Hãng VC: ${session.carrierName}`, '', `Ngày tạo: ${new Date(session.createdAt).toLocaleString('vi-VN')}`]);
    wsMaster.addRow([]);

    const mTblHeader = wsMaster.addRow([
      'STT',
      'Mã Shop',
      'Tên Shop',
      'Số ĐT',
      'Số Đơn',
      'Tổng COD Thu Hộ (đ)',
      'Cước Thu Shop (đ)',
      'Cước Trả NVC (đ)',
      'LỢI NHUẬN NHÀ GOM (đ)',
      'THỰC TRẢ CHO SHOP (đ)',
      'Số TK Ngân Hàng',
    ]);
    mTblHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let masterTotalPayable = 0;

    session.statements.forEach((stmt, idx) => {
      const debtVal = stmt.previousDebt || 0;
      const shopPayable = Math.max(0, stmt.totalNetPayout + debtVal);
      masterTotalPayable += shopPayable;

      const addedRow = wsMaster.addRow([
        idx + 1,
        stmt.shopCode,
        stmt.shopName,
        stmt.shopPhone,
        stmt.totalOrders,
        stmt.totalCod,
        stmt.totalShopFee + stmt.totalShopOtherFee,
        stmt.totalNvcCost,
        stmt.totalProfit,
        shopPayable,
        `${stmt.bankInfo.bankName} - ${stmt.bankInfo.accountNumber} (${stmt.bankInfo.accountHolder})`,
      ]);

      [6, 7, 8, 9, 10].forEach(cIdx => {
        const cell = addedRow.getCell(cIdx);
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      });
    });

    // Master Summary Row - Yellow Fill + Red Text
    const mGrandRow = wsMaster.addRow([
      'TỔNG CỘNG',
      '',
      '',
      '',
      session.matchedOrdersCount,
      session.totalCod,
      session.totalShopRevenue,
      session.totalNvcCost,
      session.totalProfit,
      masterTotalPayable,
      '',
    ]);

    mGrandRow.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } }
      };

      if (colNum >= 6 && colNum <= 10) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });

    // ──────────────────────────────────────────
    // SHEET 2: DANH SÁCH CHI TIẾT TẤT CẢ ĐƠN HÀNG
    // ──────────────────────────────────────────
    const allOrders: any[] = [];
    session.statements.forEach(stmt => {
      stmt.orders.forEach(o => allOrders.push(o));
    });
    session.unmatchedOrders.forEach(o => allOrders.push(o));

    // Respect user's explicit master column configuration or default to ALL merged columns from 2 files
    const savedMasterSettings = customExportSettings || (carrierId ? StorageService.getCarrierExportSettings(carrierId) : undefined);
    const activeMasterCols = buildDynamicColumnsFromOrders(allOrders, savedMasterSettings, true);

    const wsDetails = workbook.addWorksheet('CHI_TIET_TOAN_BO_DON_HANG');
    wsDetails.columns = activeMasterCols.map((col: ExportColumnItem) => {
      const lowerLabel = (col.label || col.id).toLowerCase();
      if (col.id === 'stt') return { width: 8 };
      if (col.id === 'waybill') return { width: 22 };
      if (col.id === 'receiverAddress') return { width: 38 };
      if (col.id === 'receiverName' || col.id === 'productName') return { width: 26 };
      if (col.id === 'date' || lowerLabel.includes('ngay') || lowerLabel.includes('date') || lowerLabel.includes('thoi_gian')) return { width: 22 };
      return { width: 20 };
    });

    const mdRow1 = wsDetails.addRow([companyTitle]);
    mdRow1.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

    const mdRow2 = wsDetails.addRow([companySubtitle]);
    mdRow2.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };

    const mdRow3 = wsDetails.addRow([`BÁO CÁO CHI TIẾT TOÀN BỘ ĐƠN HÀNG - KỲ: ${session.sessionName.toUpperCase()}`]);
    mdRow3.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF4F46E5' } };

    wsDetails.addRow([]);

    const masterHeaders = activeMasterCols.map((c: ExportColumnItem) => c.label);
    const mdTblHeader = wsDetails.addRow(masterHeaders);
    mdTblHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let grandCod = 0;
    let grandShopFee = 0;
    let grandNvcFee = 0;
    let grandProfit = 0;
    let grandNetPayout = 0;
    let grandWeight = 0;

    allOrders.forEach((order, idx) => {
      grandCod += order.codAmount || 0;
      grandShopFee += (order.shopCalculatedFee || 0) + (order.shopOtherFee || 0);
      grandNvcFee += (order.nvcBaseFee || 0) + (order.nvcOtherFee || 0);
      grandProfit += order.profitMargin || 0;
      grandNetPayout += order.netShopPayout || 0;
      grandWeight += order.weight || 0;

      const rowData: any[] = [];
      activeMasterCols.forEach((col: ExportColumnItem) => {
        let val: any = '';
        if (col.id === 'stt' || normalizeHeader(col.label) === 'stt') {
          val = idx + 1;
        } else if (col.id === 'shopFee' || normalizeHeader(col.label) === 'cuoc_tinh_shop_vnd') {
          val = order.shopCalculatedFee ?? 0;
        } else if (col.id === 'shopOtherFee' || normalizeHeader(col.label) === 'phu_phi_shop_vnd') {
          val = order.shopOtherFee ?? 0;
        } else if (col.id === 'netPayout' || normalizeHeader(col.label) === 'thuc_chuyen_cho_shop_vnd') {
          val = order.netShopPayout ?? 0;
        } else if (col.id === 'profit' || normalizeHeader(col.label) === 'loi_nhuan_gom_don_vnd') {
          val = order.profitMargin ?? 0;
        } else {
          val = (order.rawNvcData && col.sourceHeader && order.rawNvcData[col.sourceHeader] !== undefined ? order.rawNvcData[col.sourceHeader] : undefined) ??
                (order.rawAppData && col.sourceHeader && order.rawAppData[col.sourceHeader] !== undefined ? order.rawAppData[col.sourceHeader] : undefined) ??
                (order.rawNvcData && order.rawNvcData[col.label] !== undefined ? order.rawNvcData[col.label] : undefined) ??
                (order.rawAppData && order.rawAppData[col.label] !== undefined ? order.rawAppData[col.label] : undefined) ??
                resolveOrderColumnValue(order, col, idx, session.carrierName);
        }

        const normLabel = normalizeHeader(col.label || col.id || '');
        const normSrc = normalizeHeader(col.sourceHeader || '');
        const isDateCol = (normLabel.includes('ngay') || normLabel.includes('date') || normLabel.includes('thoi_gian') ||
                           normSrc.includes('ngay') || normSrc.includes('date') || normSrc.includes('thoi_gian')) &&
                          !normLabel.includes('tien') && !normLabel.includes('cuoc') && !normLabel.includes('phi') && !normLabel.includes('cod') && !normLabel.includes('tra') &&
                          !normSrc.includes('tien') && !normSrc.includes('cuoc') && !normSrc.includes('phi') && !normSrc.includes('cod') && !normSrc.includes('tra');
        
        if (isDateCol && val !== undefined && val !== null && val !== '') {
          val = formatAnyDateValue(val);
        }
        rowData.push(val ?? '');
      });

      const addedMdRow = wsDetails.addRow(rowData);
      activeMasterCols.forEach((col, cIdx) => {
        const cell = addedMdRow.getCell(cIdx + 1);
        const normId = normalizeHeader(col.id || '');
        const normLabel = normalizeHeader(col.label || '');

        if (
          normId === 'codamount' || normId === 'shopfee' || normId === 'nvcfee' || normId === 'profit' || normId === 'netpayout' ||
          normLabel.includes('cod') || normLabel.includes('thu_ho') || normLabel.includes('cuoc') || normLabel.includes('lai_rong') || normLabel.includes('loi_nhuan') || normLabel.includes('thuc_chuyen') || normLabel.includes('thuc_tra')
        ) {
          const num = Number(cell.value);
          if (!isNaN(num) && typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right' };
          }
        } else if (normId === 'weight' || normLabel.includes('khoi_luong') || normLabel.includes('trong_luong') || normLabel.includes('can_nang')) {
          const num = Number(cell.value);
          if (!isNaN(num)) {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        } else if (
          normId === 'stt' || normId === 'waybill' || normId === 'date' ||
          normLabel.includes('stt') || normLabel.includes('ma_van_don') || normLabel.includes('ngay') || normLabel.includes('date') || normLabel.includes('thoi_gian') || normLabel.includes('gui_hang')
        ) {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    // Master Details Grand Total Row - Yellow Fill + Red Text
    const mdGrandRowData: any[] = [];
    activeMasterCols.forEach((col: ExportColumnItem) => {
      switch (col.id) {
        case 'stt': mdGrandRowData.push('TỔNG CỘNG'); break;
        case 'waybill': mdGrandRowData.push(`${allOrders.length} đơn`); break;
        case 'weight': mdGrandRowData.push(Number(grandWeight.toFixed(2))); break;
        case 'codAmount': mdGrandRowData.push(grandCod); break;
        case 'shopFee': mdGrandRowData.push(grandShopFee); break;
        case 'nvcFee': mdGrandRowData.push(grandNvcFee); break;
        case 'profit': mdGrandRowData.push(grandProfit); break;
        case 'netPayout': mdGrandRowData.push(grandNetPayout); break;
        default: mdGrandRowData.push('');
      }
    });

    const mdGrandRow = wsDetails.addRow(mdGrandRowData);
    activeMasterCols.forEach((col, cIdx) => {
      const cell = mdGrandRow.getCell(cIdx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } }
      };

      if (['codAmount', 'shopFee', 'nvcFee', 'profit', 'netPayout'].includes(col.id)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (col.id === 'weight') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });

    return workbook;
  },

  async downloadMasterProfitReport(session: ReconciliationSession): Promise<void> {
    const carrierId = session.carrierId;
    const carrierTag = getCleanCarrierTag(session.carrierId, session.carrierName);
    const exportSettings = carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings();
    const workbook = await this.createMasterProfitWorkbook(session, exportSettings);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Bao_Cao_Tong_Hop_Loi_Nhuan_${carrierTag}_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveBlobFile(blob, filename);
  },

  async downloadAllStatementsZip(session: ReconciliationSession, onProgress?: (percent: number, currentShop: string) => void): Promise<void> {
    const zip = new JSZip();
    const carrierTag = getCleanCarrierTag(session.carrierId, session.carrierName);
    const rootFolder = zip.folder(`DOI_SOAT_${carrierTag}_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}`);

    const carrierId = session.carrierId;
    const exportSettings = carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings();

    const masterWb = await this.createMasterProfitWorkbook(session, exportSettings);
    const masterBuffer = await masterWb.xlsx.writeBuffer();
    rootFolder?.file(`00_BAO_CAO_TONG_HOP_LOI_NHUAN_${carrierTag}.xlsx`, masterBuffer);

    const total = session.statements.length;
    for (let i = 0; i < total; i++) {
      const stmt = session.statements[i];
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 100), stmt.shopName);
      }

      const cleanShopFolder = (stmt.shopName || stmt.shopCode || 'Shop').replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      const shopSubFolder = rootFolder?.folder(cleanShopFolder);
      
      const shopWb = await this.createShopStatementWorkbook(stmt, exportSettings);
      const shopBuffer = await shopWb.xlsx.writeBuffer();
      const filename = `Doi_Soat_${carrierTag}_${cleanShopFolder}.xlsx`;
      
      shopSubFolder?.file(filename, shopBuffer);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveBlobFile(zipBlob, `Bo_Ho_So_Doi_Soat_${carrierTag}_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
  },

  async downloadCtvCommissionReport(session: ReconciliationSession): Promise<void> {
    const carrierTag = getCleanCarrierTag(session.carrierId, session.carrierName);
    const ctvMap = new Map<string, { ctvCode: string; ctvName: string; orders: any[] }>();

    for (const stmt of session.statements) {
      for (const order of stmt.orders) {
        if (order.ctvId) {
          if (!ctvMap.has(order.ctvId)) {
            ctvMap.set(order.ctvId, {
              ctvCode: order.ctvId,
              ctvName: order.ctvName || 'Cộng tác viên',
              orders: [],
            });
          }
          ctvMap.get(order.ctvId)!.orders.push(order);
        }
      }
    }

    const workbook = new ExcelJS.Workbook();
    const wsSummary = workbook.addWorksheet('Tổng Hợp CTV');

    wsSummary.addRow(['BÁO CÁO HOA HỒNG CỘNG TÁC VIÊN (CTV)']);
    wsSummary.addRow([`Hãng vận chuyển: ${session.carrierName || carrierTag} | Kỳ đối soát: ${session.sessionName}`]);
    wsSummary.addRow([]);

    const header = wsSummary.addRow(['STT', 'Mã CTV', 'Tên CTV', 'Số đơn', 'Tổng cân nặng (kg)', 'Hoa hồng được hưởng (VNĐ)']);
    header.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    let idx = 1;
    let grandTotalOrders = 0;
    let grandTotalCommission = 0;

    ctvMap.forEach((data) => {
      const totalOrders = data.orders.length;
      const totalWeight = data.orders.reduce((s, o) => s + (o.weight || 0), 0);
      const totalCommission = data.orders.reduce((s, o) => s + (o.ctvCommission || 0), 0);

      grandTotalOrders += totalOrders;
      grandTotalCommission += totalCommission;

      const r = wsSummary.addRow([idx++, data.ctvCode, data.ctvName, totalOrders, totalWeight, totalCommission]);
      r.getCell(6).numFmt = '#,##0';
    });

    const totalRow = wsSummary.addRow(['TỔNG CỘNG', '', '', grandTotalOrders, '', grandTotalCommission]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = '#,##0';

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Bao_Cao_Hoa_Hong_CTV_${carrierTag}_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveBlobFile(blob, filename);
  },

  async exportBankPayoutExcel(items: {
    shopCode: string;
    shopName: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    amount: number;
    sessionName: string;
    statusText: string;
  }[], sessionName: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Danh Sách Đi Tiền Ngân Hàng');

    ws.addRow(['DANH SÁCH CHUYỂN KHOẢN NGÂN HÀNG (IBANKING BATCH PAYOUT)']);
    ws.addRow([`Kỳ đối soát: ${sessionName} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`]);
    ws.addRow([]);

    const headers = ws.addRow([
      'STT',
      'Mã Shop',
      'Tên Khách Hàng / Shop',
      'Tên Ngân Hàng',
      'Số Tài Khoản',
      'Chủ Tài Khoản Ngân Hàng',
      'Số Tiền Chuyển Khoản (VNĐ)',
      'Nội Dung Chuyển Khoản',
      'Trạng Thái'
    ]);

    headers.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let grandTotal = 0;

    items.forEach((item, idx) => {
      grandTotal += item.amount;
      const row = ws.addRow([
        idx + 1,
        item.shopCode,
        item.shopName,
        item.bankName || 'Chưa có',
        item.accountNumber || 'Chưa có',
        item.accountHolder || item.shopName,
        item.amount,
        `Thanh toan doi soat ${sessionName} shop ${item.shopCode}`,
        item.statusText,
      ]);

      row.getCell(7).numFmt = '#,##0';
    });

    const totalRow = ws.addRow(['TỔNG CỘNG CHUYỂN KHOẢN', '', '', '', '', '', grandTotal, '', '']);
    totalRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } };
    totalRow.getCell(7).numFmt = '#,##0';

    ws.columns = [
      { width: 8 },
      { width: 15 },
      { width: 28 },
      { width: 20 },
      { width: 22 },
      { width: 25 },
      { width: 24 },
      { width: 40 },
      { width: 16 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Danh_Sach_Di_Tien_Ngan_Hang_${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  },
};
