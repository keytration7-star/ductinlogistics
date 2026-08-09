import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ShopSettlementStatement, ReconciliationSession, ExportColumnSettings, ExportColumnItem } from '../types';
import { normalizeHeader } from './smartColumnDetector';
import { StorageService } from './storage';

export const ExcelService = {
  // Intelligent parser supporting title banners, multi-line headers and multiple sheets
  async parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to 2D array of rows to inspect headers
          const rawSheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          if (!rawSheetData || rawSheetData.length === 0) {
            resolve({ headers: [], rows: [] });
            return;
          }

          // Search top 10 rows to find the actual header row containing key logistics terms
          let headerRowIndex = 0;
          for (let r = 0; r < Math.min(10, rawSheetData.length); r++) {
            const row = rawSheetData[r];
            if (!Array.isArray(row)) continue;
            
            const rowStr = row.map(c => normalizeHeader(String(c))).join(' ');
            if (
              rowStr.includes('ma_van_don') ||
              rowStr.includes('tracking') ||
              rowStr.includes('mvd') ||
              rowStr.includes('ma_don') ||
              rowStr.includes('thu_ho') ||
              rowStr.includes('cod') ||
              rowStr.includes('ten_shop') ||
              rowStr.includes('nguoi_gui')
            ) {
              headerRowIndex = r;
              break;
            }
          }

          // Extract headers from detected header row
          const rawHeaders = rawSheetData[headerRowIndex] || [];
          const headers: string[] = [];
          
          rawHeaders.forEach((h, colIdx) => {
            const hStr = String(h || '').trim();
            if (hStr) {
              headers.push(hStr);
            } else {
              headers.push(`Cột_${colIdx + 1}`);
            }
          });

          // Build object rows from subsequent data rows
          const rows: Record<string, any>[] = [];
          for (let r = headerRowIndex + 1; r < rawSheetData.length; r++) {
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

          resolve({ headers, rows });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  formatMoney(num: number): string {
    return new Intl.NumberFormat('vi-VN').format(num);
  },

  createShopStatementWorkbook(statement: ShopSettlementStatement, customExportSettings?: ExportColumnSettings): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const exportSettings = customExportSettings || StorageService.getExportColumnSettings();
    const activeCols: ExportColumnItem[] = exportSettings.shopColumns.filter((c: ExportColumnItem) => c.enabled);

    // ──────────────────────────────────────────
    // SHEET 1: TỔNG HỢP CÔNG NỢ
    // ──────────────────────────────────────────
    const summaryData = [
      ['CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS TRUNG GIAN', '', '', ''],
      ['BẢNG KÊ ĐỐI SOÁT TIỀN THU HỘ (COD) VÀ CƯỚC PHÍ VẬN CHUYỂN', '', '', ''],
      ['Kỳ đối soát:', statement.periodName, 'Ngày xuất phiếu:', new Date().toLocaleDateString('vi-VN')],
      ['', '', '', ''],
      ['I. THÔNG TIN KHÁCH HÀNG (SHOP)', '', '', ''],
      ['Tên Shop:', statement.shopName, 'Mã khách hàng:', statement.shopCode],
      ['Số điện thoại:', statement.shopPhone, 'Email:', statement.shopEmail || ''],
      ['Địa chỉ gửi:', statement.shopAddress || '', '', ''],
      ['', '', '', ''],
      ['II. THÔNG TIN TÀI KHOẢN NHẬN TIỀN COD', '', '', ''],
      ['Ngân hàng:', statement.bankInfo.bankName, '', ''],
      ['Số tài khoản:', statement.bankInfo.accountNumber, '', ''],
      ['Chủ tài khoản:', statement.bankInfo.accountHolder, '', ''],
      ['', '', '', ''],
      ['III. BẢNG TỔNG HỢP DÒNG TIỀN ĐỐI SOÁT', '', '', ''],
      ['Hạng mục', 'Số lượng / Giá trị', 'Đơn vị tính', 'Ghi chú'],
      ['1. Tổng số đơn hàng gửi', statement.totalOrders, 'Đơn', ''],
      ['2. Số đơn giao thành công', statement.deliveredOrders, 'Đơn', 'Thu đủ tiền COD'],
      ['3. Số đơn chuyển hoàn', statement.returnedOrders, 'Đơn', 'Tính phí hoàn theo hợp đồng'],
      ['4. Số đơn đang giao/khác', statement.inTransitOrders, 'Đơn', ''],
      ['5. TỔNG TIỀN THU HỘ (COD) (+)', statement.totalCod, 'VNĐ', 'Tổng tiền NVC đã thu từ người nhận'],
      ['6. TỔNG CƯỚC PHÍ VẬN CHUYỂN (-)', statement.totalShopFee, 'VNĐ', 'Tính theo biểu giá riêng của Shop'],
      ['7. Phí phụ thu / Bảo hiểm / Hoàn (-)', statement.totalShopOtherFee, 'VNĐ', ''],
      ['----------------------------------------', '------------------', '-----', '----------------------------------'],
      ['▶ SỐ TIỀN THỰC CHUYỂN CHO SHOP (=)', statement.totalNetPayout, 'VNĐ', 'Tiền công ty sẽ chuyển khoản cho Shop'],
      ['----------------------------------------', '------------------', '-----', '----------------------------------'],
      ['', '', '', ''],
      ['ĐẠI DIỆN NHÀ GOM ĐƠN', '', 'ĐẠI DIỆN KHÁCH HÀNG (SHOP)', ''],
      ['(Ký & Ghi rõ họ tên)', '', '(Ký & Ghi rõ họ tên)', ''],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [
      { wch: 38 },
      { wch: 25 },
      { wch: 16 },
      { wch: 38 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TONG_HOP_CONG_NO');

    // ──────────────────────────────────────────
    // SHEET 2: CHI TIẾT ĐƠN HÀNG (DYNAMIC COLUMNS)
    // ──────────────────────────────────────────
    const headersRow = activeCols.map((c: ExportColumnItem) => c.label);
    const ordersData: any[] = [headersRow];

    statement.orders.forEach((order, idx) => {
      const row: any[] = [];
      activeCols.forEach((col: ExportColumnItem) => {
        switch (col.id) {
          case 'stt':
            row.push(idx + 1);
            break;
          case 'waybill':
            row.push(order.waybill);
            break;
          case 'date':
            row.push(order.rawNvcData?.['Ngày'] || order.rawAppData?.['Ngày'] || '');
            break;
          case 'refOrderCode':
            row.push(order.rawAppData?.['Mã đơn phụ'] || order.rawAppData?.['Mã đơn hàng'] || '');
            break;
          case 'receiverName':
            row.push(order.receiverName);
            break;
          case 'receiverPhone':
            row.push(order.receiverPhone);
            break;
          case 'receiverAddress':
            row.push(order.receiverAddress);
            break;
          case 'productName':
            row.push(order.rawAppData?.['Tên sản phẩm'] || order.rawAppData?.['Hàng hóa'] || '');
            break;
          case 'weight':
            row.push(order.weight);
            break;
          case 'status':
            row.push(order.statusText || order.status);
            break;
          case 'codAmount':
            row.push(order.codAmount);
            break;
          case 'shopFee':
            row.push(order.shopCalculatedFee);
            break;
          case 'shopOtherFee':
            row.push(order.shopOtherFee);
            break;
          case 'netPayout':
            row.push(order.netShopPayout);
            break;
          case 'orderNote':
            row.push(order.rawAppData?.['Ghi chú'] || '');
            break;
          default:
            row.push('');
        }
      });
      ordersData.push(row);
    });

    const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
    wsOrders['!cols'] = activeCols.map((col: ExportColumnItem) => {
      if (col.id === 'stt') return { wch: 6 };
      if (col.id === 'waybill') return { wch: 20 };
      if (col.id === 'receiverAddress') return { wch: 36 };
      if (col.id === 'receiverName' || col.id === 'productName') return { wch: 24 };
      return { wch: 18 };
    });

    XLSX.utils.book_append_sheet(wb, wsOrders, 'CHI_TIET_VAN_DON');
    return wb;
  },

  downloadShopStatement(statement: ShopSettlementStatement): void {
    const wb = this.createShopStatementWorkbook(statement);
    const cleanShopName = statement.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
    const filename = `Doi_Soat_${cleanShopName}_${statement.periodName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  createMasterProfitWorkbook(session: ReconciliationSession, customExportSettings?: ExportColumnSettings): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const exportSettings = customExportSettings || StorageService.getExportColumnSettings();
    const activeMasterCols: ExportColumnItem[] = exportSettings.masterColumns.filter((c: ExportColumnItem) => c.enabled);

    // SHEET 1: TỔNG HỢP THEO SHOP
    const masterData: any[] = [
      ['BÁO CÁO TỔNG HỢP ĐỐI SOÁT & LỢI NHUẬN NHÀ GOM ĐƠN', '', '', '', '', '', '', '', '', ''],
      ['Kỳ đối soát:', session.sessionName, 'Hãng vận chuyển:', session.carrierName, 'Ngày tạo:', new Date(session.createdAt).toLocaleString('vi-VN')],
      ['', '', '', '', '', '', '', '', '', ''],
      [
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
      ]
    ];

    session.statements.forEach((stmt, idx) => {
      masterData.push([
        idx + 1,
        stmt.shopCode,
        stmt.shopName,
        stmt.shopPhone,
        stmt.totalOrders,
        stmt.totalCod,
        stmt.totalShopFee + stmt.totalShopOtherFee,
        stmt.totalNvcCost,
        stmt.totalProfit,
        stmt.totalNetPayout,
        `${stmt.bankInfo.bankName} - ${stmt.bankInfo.accountNumber} (${stmt.bankInfo.accountHolder})`,
      ]);
    });

    masterData.push([
      '',
      'TỔNG CỘNG',
      '',
      '',
      session.matchedOrdersCount,
      session.totalCod,
      session.totalShopRevenue,
      session.totalNvcCost,
      session.totalProfit,
      session.totalNetPayout,
      '',
    ]);

    const wsMaster = XLSX.utils.aoa_to_sheet(masterData);
    wsMaster['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMaster, 'TONG_HOP_DOANH_THU_LOI_NHUAN');

    // SHEET 2: DANH SÁCH CHI TIẾT TẤT CẢ ĐƠN HÀNG (THEO CẤU HÌNH CỘT)
    const allOrders: any[] = [];
    session.statements.forEach(stmt => {
      stmt.orders.forEach(o => allOrders.push(o));
    });
    session.unmatchedOrders.forEach(o => allOrders.push(o));

    const masterHeaders = activeMasterCols.map((c: ExportColumnItem) => c.label);
    const detailsData: any[] = [masterHeaders];

    allOrders.forEach((order, idx) => {
      const row: any[] = [];
      activeMasterCols.forEach((col: ExportColumnItem) => {
        switch (col.id) {
          case 'stt':
            row.push(idx + 1);
            break;
          case 'waybill':
            row.push(order.waybill);
            break;
          case 'carrier':
            row.push(session.carrierName);
            break;
          case 'shopName':
            row.push(order.shopName);
            break;
          case 'shopPhone':
            row.push(order.shopPhone);
            break;
          case 'receiverName':
            row.push(order.receiverName);
            break;
          case 'receiverPhone':
            row.push(order.receiverPhone);
            break;
          case 'receiverAddress':
            row.push(order.receiverAddress);
            break;
          case 'weight':
            row.push(order.weight);
            break;
          case 'status':
            row.push(order.statusText || order.status);
            break;
          case 'codAmount':
            row.push(order.codAmount);
            break;
          case 'shopFee':
            row.push(order.shopCalculatedFee + order.shopOtherFee);
            break;
          case 'nvcFee':
            row.push(order.nvcBaseFee + order.nvcOtherFee);
            break;
          case 'profit':
            row.push(order.profitMargin);
            break;
          case 'netPayout':
            row.push(order.netShopPayout);
            break;
          case 'matchStatus':
            row.push(order.matched ? 'Đã khớp Shop' : 'Chưa nhận diện Shop');
            break;
          default:
            row.push('');
        }
      });
      detailsData.push(row);
    });

    const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
    wsDetails['!cols'] = activeMasterCols.map((col: ExportColumnItem) => {
      if (col.id === 'stt') return { wch: 6 };
      if (col.id === 'waybill') return { wch: 20 };
      if (col.id === 'receiverAddress') return { wch: 36 };
      return { wch: 18 };
    });
    XLSX.utils.book_append_sheet(wb, wsDetails, 'CHI_TIET_TOAN_BO_DON_HANG');

    return wb;
  },

  downloadMasterProfitReport(session: ReconciliationSession): void {
    const wb = this.createMasterProfitWorkbook(session);
    const filename = `Bao_Cao_Tong_Hop_Loi_Nhuan_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  async downloadAllStatementsZip(session: ReconciliationSession, onProgress?: (percent: number, currentShop: string) => void): Promise<void> {
    const zip = new JSZip();
    const rootFolder = zip.folder(`DOI_SOAT_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}`);

    const masterWb = this.createMasterProfitWorkbook(session);
    const masterBinary = XLSX.write(masterWb, { bookType: 'xlsx', type: 'array' });
    rootFolder?.file('00_BAO_CAO_TONG_HOP_LOI_NHUAN_NHA_GOM.xlsx', masterBinary);

    const total = session.statements.length;
    for (let i = 0; i < total; i++) {
      const stmt = session.statements[i];
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 100), stmt.shopName);
      }

      const cleanShopFolder = stmt.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      const shopSubFolder = rootFolder?.folder(cleanShopFolder);
      
      const shopWb = this.createShopStatementWorkbook(stmt);
      const shopBinary = XLSX.write(shopWb, { bookType: 'xlsx', type: 'array' });
      const filename = `Doi_soat_${cleanShopFolder}.xlsx`;
      
      shopSubFolder?.file(filename, shopBinary);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `Bo_Ho_So_Doi_Soat_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
  },
};
