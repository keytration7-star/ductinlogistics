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
    if (num === undefined || num === null || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
  },

  createShopStatementWorkbook(statement: ShopSettlementStatement, customExportSettings?: ExportColumnSettings): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const exportSettings = customExportSettings || StorageService.getExportColumnSettings();
    const activeCols: ExportColumnItem[] = exportSettings.shopColumns.filter((c: ExportColumnItem) => c.enabled);
    const company = StorageService.getCompanyInfo();

    const companyTitle = (company.companyName || 'CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS').toUpperCase();
    const companySubtitle = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    // ──────────────────────────────────────────
    // SHEET 1: TỔNG HỢP CÔNG NỢ
    // ──────────────────────────────────────────
    const summaryData = [
      [companyTitle, '', '', ''],
      [companySubtitle, '', '', ''],
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
      { wch: 42 },
      { wch: 28 },
      { wch: 16 },
      { wch: 42 },
    ];

    // Format monetary cells in Sheet 1 summary (rows 21, 22, 23, 25 in 0-indexed: 20, 21, 22, 24)
    const moneyRowIndices = [20, 21, 22, 24];
    moneyRowIndices.forEach(rIdx => {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: 1 });
      if (wsSummary[cellRef] && typeof wsSummary[cellRef].v === 'number') {
        wsSummary[cellRef].z = '#,##0';
      }
    });

    // Make Company Title bold in A1 & A2
    if (wsSummary['A1']) {
      wsSummary['A1'].s = { font: { bold: true, sz: 14, color: { rgb: '1E3A8A' } } };
    }
    if (wsSummary['A2']) {
      wsSummary['A2'].s = { font: { italic: true, sz: 10, color: { rgb: '4B5563' } } };
    }
    if (wsSummary['A3']) {
      wsSummary['A3'].s = { font: { bold: true, sz: 12, color: { rgb: '111827' } } };
    }

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

    // 🌟 ADD TOTAL SUMMARY ROW (TỔNG CỘNG BÔI VÀNG Ô CHỮ ĐỎ)
    const totalWeight = Number(statement.orders.reduce((sum, o) => sum + (o.weight || 0), 0).toFixed(2));
    const totalRow: any[] = [];
    activeCols.forEach((col: ExportColumnItem) => {
      switch (col.id) {
        case 'stt':
          totalRow.push('TỔNG CỘNG');
          break;
        case 'waybill':
          totalRow.push(`${statement.orders.length} đơn`);
          break;
        case 'weight':
          totalRow.push(totalWeight);
          break;
        case 'codAmount':
          totalRow.push(statement.totalCod);
          break;
        case 'shopFee':
          totalRow.push(statement.totalShopFee);
          break;
        case 'shopOtherFee':
          totalRow.push(statement.totalShopOtherFee);
          break;
        case 'netPayout':
          totalRow.push(statement.totalNetPayout);
          break;
        default:
          totalRow.push('');
      }
    });
    ordersData.push(totalRow);

    const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
    wsOrders['!cols'] = activeCols.map((col: ExportColumnItem) => {
      if (col.id === 'stt') return { wch: 14 };
      if (col.id === 'waybill') return { wch: 20 };
      if (col.id === 'receiverAddress') return { wch: 38 };
      if (col.id === 'receiverName' || col.id === 'productName') return { wch: 25 };
      return { wch: 18 };
    });

    // Format all money numbers with VN Currency format '#,##0'
    const totalRowIndex = ordersData.length - 1;
    for (let r = 1; r <= totalRowIndex; r++) {
      activeCols.forEach((col, cIdx) => {
        const isMoney = ['codAmount', 'shopFee', 'shopOtherFee', 'netPayout'].includes(col.id);
        const cellRef = XLSX.utils.encode_cell({ r, c: cIdx });
        if (wsOrders[cellRef]) {
          if (isMoney && typeof wsOrders[cellRef].v === 'number') {
            wsOrders[cellRef].z = '#,##0';
          }
        }
      });
    }

    // 🎨 STYLE SUMMARY ROW: Yellow background + Bold Red text (Ô vàng chữ đỏ)
    activeCols.forEach((_, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c: cIdx });
      if (wsOrders[cellRef]) {
        wsOrders[cellRef].s = {
          fill: { fgColor: { rgb: 'FFFF00' }, patternType: 'solid' }, // Yellow fill
          font: { color: { rgb: 'FF0000' }, bold: true, sz: 11 },     // Red bold text
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } }
          }
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, wsOrders, 'CHI_TIET_VAN_DON');
    return wb;
  },

  downloadShopStatement(statement: ShopSettlementStatement): void {
    const wb = this.createShopStatementWorkbook(statement);
    const cleanShopName = statement.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
    const filename = `Doi_Soat_${cleanShopName}_${statement.periodName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename, { cellStyles: true });
  },

  createMasterProfitWorkbook(session: ReconciliationSession, customExportSettings?: ExportColumnSettings): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const exportSettings = customExportSettings || StorageService.getExportColumnSettings();
    const activeMasterCols: ExportColumnItem[] = exportSettings.masterColumns.filter((c: ExportColumnItem) => c.enabled);
    const company = StorageService.getCompanyInfo();

    const companyTitle = (company.companyName || 'CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS').toUpperCase();
    const companySubtitle = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    // SHEET 1: TỔNG HỢP THEO SHOP
    const masterData: any[] = [
      [companyTitle, '', '', '', '', '', '', '', '', ''],
      [companySubtitle, '', '', '', '', '', '', '', '', ''],
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

    const masterSummaryRowIndex = masterData.length;
    masterData.push([
      'TỔNG CỘNG',
      '',
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
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 15 },
      { wch: 10 },
      { wch: 22 },
      { wch: 20 },
      { wch: 20 },
      { wch: 24 },
      { wch: 24 },
      { wch: 40 },
    ];

    // Format numbers in Master sheet
    for (let r = 6; r <= masterSummaryRowIndex; r++) {
      [5, 6, 7, 8, 9].forEach(cIdx => {
        const cellRef = XLSX.utils.encode_cell({ r, c: cIdx });
        if (wsMaster[cellRef] && typeof wsMaster[cellRef].v === 'number') {
          wsMaster[cellRef].z = '#,##0';
        }
      });
    }

    // Yellow background + Red text for Master summary row
    for (let c = 0; c <= 10; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: masterSummaryRowIndex, c });
      if (wsMaster[cellRef]) {
        wsMaster[cellRef].s = {
          fill: { fgColor: { rgb: 'FFFF00' }, patternType: 'solid' },
          font: { color: { rgb: 'FF0000' }, bold: true, sz: 11 },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } }
          }
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, wsMaster, 'TONG_HOP_DOANH_THU_LOI_NHUAN');

    // SHEET 2: DANH SÁCH CHI TIẾT TẤT CẢ ĐƠN HÀNG (THEO CẤU HÌNH CỘT)
    const allOrders: any[] = [];
    session.statements.forEach(stmt => {
      stmt.orders.forEach(o => allOrders.push(o));
    });
    session.unmatchedOrders.forEach(o => allOrders.push(o));

    const masterHeaders = activeMasterCols.map((c: ExportColumnItem) => c.label);
    const detailsData: any[] = [masterHeaders];

    let grandCod = 0;
    let grandShopFee = 0;
    let grandNvcFee = 0;
    let grandProfit = 0;
    let grandNetPayout = 0;
    let grandWeight = 0;

    allOrders.forEach((order, idx) => {
      const row: any[] = [];
      grandCod += order.codAmount || 0;
      grandShopFee += (order.shopCalculatedFee || 0) + (order.shopOtherFee || 0);
      grandNvcFee += (order.nvcBaseFee || 0) + (order.nvcOtherFee || 0);
      grandProfit += order.profitMargin || 0;
      grandNetPayout += order.netShopPayout || 0;
      grandWeight += order.weight || 0;

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

    // 🌟 Master Details Summary Row
    const masterDetailsTotalRow: any[] = [];
    activeMasterCols.forEach((col: ExportColumnItem) => {
      switch (col.id) {
        case 'stt':
          masterDetailsTotalRow.push('TỔNG CỘNG');
          break;
        case 'waybill':
          masterDetailsTotalRow.push(`${allOrders.length} đơn`);
          break;
        case 'weight':
          masterDetailsTotalRow.push(Number(grandWeight.toFixed(2)));
          break;
        case 'codAmount':
          masterDetailsTotalRow.push(grandCod);
          break;
        case 'shopFee':
          masterDetailsTotalRow.push(grandShopFee);
          break;
        case 'nvcFee':
          masterDetailsTotalRow.push(grandNvcFee);
          break;
        case 'profit':
          masterDetailsTotalRow.push(grandProfit);
          break;
        case 'netPayout':
          masterDetailsTotalRow.push(grandNetPayout);
          break;
        default:
          masterDetailsTotalRow.push('');
      }
    });
    detailsData.push(masterDetailsTotalRow);

    const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
    wsDetails['!cols'] = activeMasterCols.map((col: ExportColumnItem) => {
      if (col.id === 'stt') return { wch: 14 };
      if (col.id === 'waybill') return { wch: 20 };
      if (col.id === 'receiverAddress') return { wch: 36 };
      return { wch: 18 };
    });

    // Format money numbers and style summary row
    const masterDetailTotalIndex = detailsData.length - 1;
    for (let r = 1; r <= masterDetailTotalIndex; r++) {
      activeMasterCols.forEach((col, cIdx) => {
        const isMoney = ['codAmount', 'shopFee', 'nvcFee', 'profit', 'netPayout'].includes(col.id);
        const cellRef = XLSX.utils.encode_cell({ r, c: cIdx });
        if (wsDetails[cellRef] && isMoney && typeof wsDetails[cellRef].v === 'number') {
          wsDetails[cellRef].z = '#,##0';
        }
      });
    }

    activeMasterCols.forEach((_, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: masterDetailTotalIndex, c: cIdx });
      if (wsDetails[cellRef]) {
        wsDetails[cellRef].s = {
          fill: { fgColor: { rgb: 'FFFF00' }, patternType: 'solid' },
          font: { color: { rgb: 'FF0000' }, bold: true, sz: 11 },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'double', color: { rgb: '000000' } }
          }
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, wsDetails, 'CHI_TIET_TOAN_BO_DON_HANG');

    return wb;
  },

  downloadMasterProfitReport(session: ReconciliationSession): void {
    const wb = this.createMasterProfitWorkbook(session);
    const filename = `Bao_Cao_Tong_Hop_Loi_Nhuan_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename, { cellStyles: true });
  },

  async downloadAllStatementsZip(session: ReconciliationSession, onProgress?: (percent: number, currentShop: string) => void): Promise<void> {
    const zip = new JSZip();
    const rootFolder = zip.folder(`DOI_SOAT_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}`);

    const masterWb = this.createMasterProfitWorkbook(session);
    const masterBinary = XLSX.write(masterWb, { bookType: 'xlsx', type: 'array', cellStyles: true });
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
      const shopBinary = XLSX.write(shopWb, { bookType: 'xlsx', type: 'array', cellStyles: true });
      const filename = `Doi_soat_${cleanShopFolder}.xlsx`;
      
      shopSubFolder?.file(filename, shopBinary);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `Bo_Ho_So_Doi_Soat_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
  },
};
