export interface BankItem {
  code: string;       // VietQR short code e.g. "MB", "VCB", "TCB", "CTG"
  name: string;       // Full name e.g. "MB Bank (Ngân hàng Quân Đội)"
  shortName: string;  // Common short name e.g. "MB Bank"
}

export const VIETNAM_BANKS: BankItem[] = [
  { code: 'MB', name: 'MB Bank (Ngân hàng Quân Đội)', shortName: 'MB Bank' },
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương Việt Nam)', shortName: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương Việt Nam)', shortName: 'Techcombank' },
  { code: 'CTG', name: 'VietinBank (Công Thương Việt Nam)', shortName: 'VietinBank' },
  { code: 'BIDV', name: 'BIDV (Đầu tư và Phát triển Việt Nam)', shortName: 'BIDV' },
  { code: 'VBA', name: 'Agribank (Nông nghiệp & PT Nông thôn)', shortName: 'Agribank' },
  { code: 'ACB', name: 'ACB (Ngân hàng Á Châu)', shortName: 'ACB' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)', shortName: 'VPBank' },
  { code: 'TPB', name: 'TPBank (Tiên Phong Bank)', shortName: 'TPBank' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)', shortName: 'Sacombank' },
  { code: 'HDB', name: 'HDBank (Phát triển TP.HCM)', shortName: 'HDBank' },
  { code: 'VIB', name: 'VIB (Quốc Tế Việt Nam)', shortName: 'VIB' },
  { code: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)', shortName: 'SHB' },
  { code: 'MSB', name: 'MSB (Hàng Hải Việt Nam)', shortName: 'MSB' },
  { code: 'SEA', name: 'SeABank (Đông Nam Á)', shortName: 'SeABank' },
  { code: 'OCB', name: 'OCB (Phương Đông)', shortName: 'OCB' },
  { code: 'LPB', name: 'LPBank (Lộc Phát Việt Nam / Bưu Điện Liên Việt)', shortName: 'LPBank' },
  { code: 'EIB', name: 'Eximbank (Xuất Nhập Khẩu Việt Nam)', shortName: 'Eximbank' },
  { code: 'BVB', name: 'BaoVietBank (Bảo Việt)', shortName: 'BaoVietBank' },
  { code: 'ABB', name: 'ABBANK (An Bình)', shortName: 'ABBANK' },
  { code: 'SCB', name: 'SCB (Sài Gòn)', shortName: 'SCB' },
  { code: 'VCCB', name: 'BVBank (Bản Việt / VietCapital)', shortName: 'BVBank' },
  { code: 'BAB', name: 'BacABank (Bắc Á)', shortName: 'BacABank' },
  { code: 'VTB', name: 'VietBank (Việt Nam Thương Tín)', shortName: 'VietBank' },
  { code: 'NAB', name: 'NamABank (Nam Á)', shortName: 'NamABank' },
  { code: 'PGB', name: 'PGBank (Xăng Dầu Petrolimex)', shortName: 'PGBank' },
  { code: 'PVC', name: 'PVcomBank (Đại Chúng Việt Nam)', shortName: 'PVcomBank' },
  { code: 'SGB', name: 'SaigonBank (Sài Gòn Công Thương)', shortName: 'SaigonBank' },
  { code: 'DAB', name: 'DongABank (Đông Á)', shortName: 'DongABank' },
  { code: 'OCEAN', name: 'OceanBank (Đại Dương)', shortName: 'OceanBank' },
  { code: 'GPB', name: 'GPBank (Dầu Khí Toàn Cầu)', shortName: 'GPBank' },
  { code: 'KLB', name: 'KienLongBank (Kiên Long)', shortName: 'KienLongBank' },
  { code: 'CBB', name: 'CBBank (Xây Dựng Việt Nam)', shortName: 'CBBank' },
  { code: 'VRB', name: 'VRB (Việt - Nga)', shortName: 'VRB' },
  { code: 'KBANK', name: 'KBank (Kasikornbank Thái Lan)', shortName: 'KBank' },
  { code: 'SHBVN', name: 'Shinhan Bank (Hàn Quốc)', shortName: 'Shinhan Bank' },
  { code: 'WOO', name: 'Woori Bank (Hàn Quốc)', shortName: 'Woori Bank' },
  { code: 'HSBC', name: 'HSBC Việt Nam', shortName: 'HSBC' },
  { code: 'SCBVL', name: 'Standard Chartered Việt Nam', shortName: 'Standard Chartered' },
  { code: 'CIMB', name: 'CIMB Bank Việt Nam', shortName: 'CIMB' },
  { code: 'PBVN', name: 'Public Bank Việt Nam', shortName: 'Public Bank' },
  { code: 'HLBVN', name: 'Hong Leong Bank Việt Nam', shortName: 'Hong Leong Bank' },
  { code: 'IBK', name: 'IBK (Công nghiệp Hàn Quốc)', shortName: 'IBK Bank' },
  { code: 'UOB', name: 'UOB (United Overseas Bank)', shortName: 'UOB Bank' },
  { code: 'TIMO', name: 'Timo (Ngân hàng số Timo)', shortName: 'Timo' },
  { code: 'CAKE', name: 'Cake by VPBank', shortName: 'Cake' },
  { code: 'TNEX', name: 'TNEX by MSB', shortName: 'TNEX' },
  { code: 'VTMONEY', name: 'Viettel Money / ViettelPay', shortName: 'Viettel Money' },
  { code: 'VNPTMONEY', name: 'VNPT Money', shortName: 'VNPT Money' },
  { code: 'COOPBANK', name: 'Co-opBank (Hợp tác xã Việt Nam)', shortName: 'Co-opBank' },
  { code: 'OTHER', name: 'Khác (Ngân hàng khác)', shortName: 'Khác' },
];

export const BANK_SHORT_NAMES = VIETNAM_BANKS.map(b => b.shortName);

export const BANK_CODES: Record<string, string> = VIETNAM_BANKS.reduce((acc, b) => {
  acc[b.shortName] = b.code;
  acc[b.name] = b.code;
  acc[b.code] = b.code;
  return acc;
}, {} as Record<string, string>);

/**
 * Chuẩn hóa nội dung chuyển khoản theo chuẩn NAPAS / VietQR (Field 62):
 * - Đổi dấu '/' trong ngày tháng thành '.' (ví dụ: 20/08 -> 20.08) vì dấu '/' bị hệ thống Core Banking NAPAS lọc bỏ làm mất ngày.
 * - Bỏ dấu tiếng Việt (ASCII only) để App ngân hàng quét là tự điền nội dung ngay.
 * - Bỏ dấu ngoặc đơn/kép '()' và đổi gạch ngang đặc biệt '–' thành '-'.
 * - Giới hạn tối đa 50 ký tự theo chuẩn quốc tế EMVCo / NAPAS 247.
 */
export function toVietQrMemo(text: string): string {
  if (!text) return '';
  let clean = text
    .replace(/J&T/gi, 'JNT')
    .replace(/J & T/gi, 'JNT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    // Đổi dấu gạch chéo ngày tháng (20/08/2026 -> 20.08.2026, 20/08 -> 20.08)
    .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, '$1.$2.$3')
    .replace(/(\d{1,2})\/(\d{1,2})/g, '$1.$2')
    .replace(/[–—]/g, '-')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/Thanh toan doi soat ky Doi Soat/gi, 'TT doi soat')
    .replace(/Thanh toan doi soat/gi, 'TT doi soat')
    .replace(/doi soat ky Doi Soat/gi, 'doi soat')
    .replace(/[^a-zA-Z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 50);
}

