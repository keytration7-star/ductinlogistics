import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const SampleDataService = {
  // Download clean blank template Excel files with standard headers
  downloadSampleFiles() {
    // 1. File Đối Soát NVC Mẫu (Trắng)
    const nvcTemplateRows = [
      {
        'Mã vận đơn': 'VD: GHTK10001',
        'Trạng thái giao hàng': 'Giao thành công',
        'Khối lượng tính cước (kg)': 1.2,
        'Tiền thu hộ (COD)': 250000,
        'Cước NVC (VNĐ)': 20000,
        'Phí phụ thu/khác': 0,
        'Ghi chú': 'Đơn mẫu',
      }
    ];
    const wbNvc = XLSX.utils.book_new();
    const wsNvc = XLSX.utils.json_to_sheet(nvcTemplateRows);
    XLSX.utils.book_append_sheet(wbNvc, wsNvc, 'DOI_SOAT_NVC');
    const nvcBinary = XLSX.write(wbNvc, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([nvcBinary]), '1_File_Doi_Soat_NVC_Mau_Trang.xlsx');

    // 2. File Đơn Hàng từ App Mẫu (Trắng)
    const appTemplateRows = [
      {
        'Mã vận đơn': 'VD: GHTK10001',
        'Tên Shop / Người gửi': 'Shop Thời Trang ABC',
        'Số ĐT Shop': '0912345678',
        'Địa chỉ kho gửi': '142 Cầu Giấy, Hà Nội',
        'Tên người nhận': 'Nguyễn Văn A',
        'SĐT người nhận': '0987654321',
        'Địa chỉ giao hàng': 'Số 10 Phố X, TP. HCM',
        'Khối lượng khai báo (kg)': 1.2,
        'Tiền COD': 250000,
      }
    ];
    const wbApp = XLSX.utils.book_new();
    const wsApp = XLSX.utils.json_to_sheet(appTemplateRows);
    XLSX.utils.book_append_sheet(wbApp, wsApp, 'DANH_SACH_DON_APP');
    const appBinary = XLSX.write(wbApp, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([appBinary]), '2_File_Danh_Sach_Don_App_Mau_Trang.xlsx');
  },
};
