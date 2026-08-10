import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ShopSettlementStatement, ReconciliationSession, ExportColumnSettings, ExportColumnItem } from '../types';
import { normalizeHeader } from './smartColumnDetector';
import { StorageService } from './storage';
import { extractRowField } from './reconciliationService';

export function formatAnyDateValue(val: any): string {
  if (val === undefined || val === null || val === '') return '';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return formatDateToString(val, true);
  }

  const str = String(val).trim();
  if (!str) return '';

  const num = Number(str);
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

  async createShopStatementWorkbook(statement: ShopSettlementStatement, customExportSettings?: ExportColumnSettings): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const carrierId = statement.orders[0]?.carrierId;
    const exportSettings = customExportSettings || (carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings());
    const enabledCols = exportSettings.shopColumns.filter((c: ExportColumnItem) => c.enabled);
    const company = StorageService.getCompanyInfo();

    // Respect user's explicit column configuration 100%
    const activeCols = enabledCols;

    const companyTitle = (company.companyName || 'CÔNG TY GOM ĐƠN VẬN CHUYỂN & LOGISTICS').toUpperCase();
    const companySubtitle = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    // ──────────────────────────────────────────
    // SHEET 1: TỔNG HỢP CÔNG NỢ
    // ──────────────────────────────────────────
    const wsSummary = workbook.addWorksheet('TONG_HOP_CONG_NO');
    wsSummary.columns = [
      { width: 44 },
      { width: 30 },
      { width: 18 },
      { width: 44 },
    ];

    // Company Header Section
    const row1 = wsSummary.addRow([companyTitle]);
    row1.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF1E3A8A' } }; // Dark Navy

    const row2 = wsSummary.addRow([companySubtitle]);
    row2.font = { name: 'Arial', size: 10.5, italic: true, color: { argb: 'FF475569' } }; // Slate Gray

    const row3 = wsSummary.addRow(['BẢNG KÊ ĐỐI SOÁT TIỀN THU HỘ (COD) VÀ CƯỚC PHÍ VẬN CHUYỂN']);
    row3.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF4F46E5' } }; // Indigo

    const row4 = wsSummary.addRow([`Kỳ đối soát: ${statement.periodName}`, '', `Ngày xuất phiếu: ${new Date().toLocaleDateString('vi-VN')}`]);
    row4.font = { name: 'Arial', size: 11, color: { argb: 'FF334155' } };

    wsSummary.addRow([]); // Blank line

    // Section I: Shop Info
    const sec1 = wsSummary.addRow(['I. THÔNG TIN KHÁCH HÀNG (SHOP)']);
    sec1.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF1E293B' } };

    wsSummary.addRow(['Tên Shop:', statement.shopName, 'Mã khách hàng:', statement.shopCode]);
    wsSummary.addRow(['Số điện thoại:', statement.shopPhone, 'Email:', statement.shopEmail || '']);
    wsSummary.addRow(['Địa chỉ gửi:', statement.shopAddress || '']);
    wsSummary.addRow([]);

    // Section II: Bank Info
    const sec2 = wsSummary.addRow(['II. THÔNG TIN TÀI KHOẢN NHẬN TIỀN COD']);
    sec2.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF1E293B' } };

    wsSummary.addRow(['Ngân hàng:', statement.bankInfo.bankName]);
    wsSummary.addRow(['Số tài khoản:', statement.bankInfo.accountNumber]);
    wsSummary.addRow(['Chủ tài khoản:', statement.bankInfo.accountHolder]);
    wsSummary.addRow([]);

    // Section III: Financial Summary Table
    const sec3 = wsSummary.addRow(['III. BẢNG TỔNG HỢP DÒNG TIỀN ĐỐI SOÁT']);
    sec3.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF1E293B' } };

    const tblHeader = wsSummary.addRow(['Hạng mục', 'Số lượng / Giá trị', 'Đơn vị tính', 'Ghi chú']);
    tblHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const rowsData = [
      ['1. Tổng số đơn hàng gửi', statement.totalOrders, 'Đơn', ''],
      ['2. Số đơn giao thành công', statement.deliveredOrders, 'Đơn', 'Thu đủ tiền COD'],
      ['3. Số đơn chuyển hoàn', statement.returnedOrders, 'Đơn', 'Tính phí hoàn theo hợp đồng'],
      ['4. Số đơn đang giao/khác', statement.inTransitOrders, 'Đơn', ''],
      ['5. TỔNG TIỀN THU HỘ (COD) (+)', statement.totalCod, 'VNĐ', 'Tổng tiền NVC đã thu từ người nhận'],
      ['6. TỔNG CƯỚC PHÍ VẬN CHUYỂN (-)', statement.totalShopFee, 'VNĐ', 'Tính theo biểu giá riêng của Shop'],
      ['7. Phí phụ thu / Bảo hiểm / Hoàn (-)', statement.totalShopOtherFee, 'VNĐ', ''],
    ];

    rowsData.forEach(r => {
      const addedRow = wsSummary.addRow(r);
      const valCell = addedRow.getCell(2);
      if (typeof r[1] === 'number' && (r[0] as string).includes('TỔNG')) {
        valCell.numFmt = '#,##0';
        valCell.font = { bold: true };
      }
    });

    // 🌟 GRAND TOTAL ROW (SỐ TIỀN THỰC CHUYỂN FOR SHOP) - Yellow Fill + Bold Red Text
    const grandRow = wsSummary.addRow(['▶ SỐ TIỀN THỰC CHUYỂN CHO SHOP (=)', statement.totalNetPayout, 'VNĐ', 'Tiền công ty sẽ chuyển khoản cho Shop']);
    grandRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFF0000' } }; // Red
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } }
      };
    });
    grandRow.getCell(2).numFmt = '#,##0';

    wsSummary.addRow([]);
    wsSummary.addRow(['ĐẠI DIỆN NHÀ GOM ĐƠN', '', 'ĐẠI DIỆN KHÁCH HÀNG (SHOP)']);
    wsSummary.addRow(['(Ký & Ghi rõ họ tên)', '', '(Ký & Ghi rõ họ tên)']);

    // ──────────────────────────────────────────
    // SHEET 2: CHI TIẾT ĐƠN HÀNG (DYNAMIC NON-EMPTY COLUMNS)
    // ──────────────────────────────────────────
    const wsOrders = workbook.addWorksheet('CHI_TIET_VAN_DON');

    // Column Widths
    wsOrders.columns = activeCols.map((col: ExportColumnItem) => {
      if (col.id === 'stt') return { width: 8 };
      if (col.id === 'waybill') return { width: 22 };
      if (col.id === 'receiverAddress') return { width: 38 };
      if (col.id === 'receiverName' || col.id === 'productName') return { width: 26 };
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
        switch (col.id) {
          case 'stt': rowData.push(idx + 1); break;
          case 'waybill': rowData.push(order.waybill); break;
          case 'date': {
            const rawDate = order.rawNvcData?.['Ngày'] || order.rawAppData?.['Ngày'] || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ngay', 'date', 'thoi_gian']);
            rowData.push(formatAnyDateValue(rawDate));
            break;
          }
          case 'refOrderCode': rowData.push(order.rawAppData?.['Mã đơn phụ'] || order.rawAppData?.['Mã đơn hàng'] || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ma_don_phu', 'ref'])); break;
          case 'receiverName': rowData.push(order.receiverName || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ten_nguoi_nhan', 'nguoi_nhan', 'ten_khach'])); break;
          case 'receiverPhone': rowData.push(order.receiverPhone || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['sdt_nguoi_nhan', 'so_dien_thoai', 'phone', 'mobile'])); break;
          case 'receiverAddress': rowData.push(order.receiverAddress || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['dia_chi', 'address', 'dc_nhan', 'giao_hang', 'dc'])); break;
          case 'productName': rowData.push(order.productName || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ten_san_pham', 'hang_hoa', 'ten_hang', 'san_pham', 'noi_dung', 'mo_ta'])); break;
          case 'weight': rowData.push(order.weight); break;
          case 'status': rowData.push(order.statusText || order.status); break;
          case 'codAmount': rowData.push(order.codAmount); break;
          case 'shopFee': rowData.push(order.shopCalculatedFee); break;
          case 'shopOtherFee': rowData.push(order.shopOtherFee); break;
          case 'netPayout': rowData.push(order.netShopPayout); break;
          default: {
            const srcHeader = col.sourceHeader || col.label || col.id;
            let val = (order.rawNvcData && order.rawNvcData[srcHeader] !== undefined ? order.rawNvcData[srcHeader] : undefined) ??
                        (order.rawAppData && order.rawAppData[srcHeader] !== undefined ? order.rawAppData[srcHeader] : undefined) ??
                        (order.rawNvcData && order.rawNvcData[col.label] !== undefined ? order.rawNvcData[col.label] : undefined) ??
                        (order.rawAppData && order.rawAppData[col.label] !== undefined ? order.rawAppData[col.label] : undefined) ?? '';

            const lowerLabel = (col.label || srcHeader).toLowerCase();
            if (lowerLabel.includes('ngay') || lowerLabel.includes('date') || lowerLabel.includes('thoi_gian') || lowerLabel.includes('thời gian')) {
              val = formatAnyDateValue(val);
            }
            rowData.push(val);
            break;
          }
        }
      });

      const addedOrderRow = wsOrders.addRow(rowData);
      
      // Formatting cell values
      activeCols.forEach((col, cIdx) => {
        const cell = addedOrderRow.getCell(cIdx + 1);
        const lowerLabel = (col.label || col.id).toLowerCase();

        if (['codAmount', 'shopFee', 'shopOtherFee', 'netPayout'].includes(col.id)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else if (col.id === 'weight') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (col.id === 'stt' || col.id === 'waybill' || col.id === 'date' || lowerLabel.includes('ngay') || lowerLabel.includes('date') || lowerLabel.includes('thoi_gian')) {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    // 🌟 TOTAL SUMMARY ROW (TỔNG CỘNG BÔI VÀNG Ô CHỮ ĐỎ)
    const totalWeight = Number(statement.orders.reduce((sum, o) => sum + (o.weight || 0), 0).toFixed(2));
    const totalRowData: any[] = [];
    activeCols.forEach((col: ExportColumnItem) => {
      switch (col.id) {
        case 'stt': totalRowData.push('TỔNG CỘNG'); break;
        case 'waybill': totalRowData.push(`${statement.orders.length} đơn`); break;
        case 'weight': totalRowData.push(totalWeight); break;
        case 'codAmount': totalRowData.push(statement.totalCod); break;
        case 'shopFee': totalRowData.push(statement.totalShopFee); break;
        case 'shopOtherFee': totalRowData.push(statement.totalShopOtherFee); break;
        case 'netPayout': totalRowData.push(statement.totalNetPayout); break;
        default: totalRowData.push('');
      }
    });

    const oGrandRow = wsOrders.addRow(totalRowData);
    activeCols.forEach((col, cIdx) => {
      const cell = oGrandRow.getCell(cIdx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow Fill
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFF0000' } }; // Bold Red Text
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } }
      };

      if (['codAmount', 'shopFee', 'shopOtherFee', 'netPayout'].includes(col.id)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (col.id === 'weight') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      } else if (col.id === 'stt' || col.id === 'waybill') {
        cell.alignment = { horizontal: 'center' };
      }
    });

    return workbook;
  },

  async downloadShopStatement(statement: ShopSettlementStatement, customExportSettings?: ExportColumnSettings): Promise<void> {
    const carrierId = statement.orders[0]?.carrierId;
    const exportSettings = customExportSettings || (carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings());
    const workbook = await this.createShopStatementWorkbook(statement, exportSettings);
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanShopName = statement.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
    const filename = `Doi_Soat_${cleanShopName}_${statement.periodName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  },

  async createMasterProfitWorkbook(session: ReconciliationSession, customExportSettings?: ExportColumnSettings): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const carrierId = session.carrierId;
    const exportSettings = customExportSettings || (carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings());
    const enabledMasterCols = exportSettings.masterColumns.filter((c: ExportColumnItem) => c.enabled);
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

    session.statements.forEach((stmt, idx) => {
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
        stmt.totalNetPayout,
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
      session.totalNetPayout,
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

    // Respect user's explicit master column configuration 100%
    const activeMasterCols = enabledMasterCols;

    const wsDetails = workbook.addWorksheet('CHI_TIET_TOAN_BO_DON_HANG');
    wsDetails.columns = activeMasterCols.map((col: ExportColumnItem) => {
      if (col.id === 'stt') return { width: 8 };
      if (col.id === 'waybill') return { width: 22 };
      if (col.id === 'receiverAddress') return { width: 38 };
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
        switch (col.id) {
          case 'stt': rowData.push(idx + 1); break;
          case 'waybill': rowData.push(order.waybill); break;
          case 'carrier': rowData.push(session.carrierName); break;
          case 'shopName': rowData.push(order.shopName); break;
          case 'shopPhone': rowData.push(order.shopPhone); break;
          case 'receiverName': rowData.push(order.receiverName || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['ten_nguoi_nhan', 'nguoi_nhan', 'ten_khach'])); break;
          case 'receiverPhone': rowData.push(order.receiverPhone || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['sdt_nguoi_nhan', 'so_dien_thoai', 'phone', 'mobile'])); break;
          case 'receiverAddress': rowData.push(order.receiverAddress || extractRowField(order.rawAppData, order.rawNvcData, undefined, ['dia_chi', 'address', 'dc_nhan', 'giao_hang', 'dc'])); break;
          case 'weight': rowData.push(order.weight); break;
          case 'status': rowData.push(order.statusText || order.status); break;
          case 'codAmount': rowData.push(order.codAmount); break;
          case 'shopFee': rowData.push(order.shopCalculatedFee + order.shopOtherFee); break;
          case 'nvcFee': rowData.push(order.nvcBaseFee + order.nvcOtherFee); break;
          case 'profit': rowData.push(order.profitMargin); break;
          case 'netPayout': rowData.push(order.netShopPayout); break;
          case 'matchStatus': rowData.push(order.matched ? 'Đã khớp Shop' : 'Chưa nhận diện Shop'); break;
          default: {
            const srcHeader = col.sourceHeader || col.label || col.id;
            let val = (order.rawNvcData && order.rawNvcData[srcHeader] !== undefined ? order.rawNvcData[srcHeader] : undefined) ??
                        (order.rawAppData && order.rawAppData[srcHeader] !== undefined ? order.rawAppData[srcHeader] : undefined) ??
                        (order.rawNvcData && order.rawNvcData[col.label] !== undefined ? order.rawNvcData[col.label] : undefined) ??
                        (order.rawAppData && order.rawAppData[col.label] !== undefined ? order.rawAppData[col.label] : undefined) ?? '';

            const lowerLabel = (col.label || srcHeader).toLowerCase();
            if (lowerLabel.includes('ngay') || lowerLabel.includes('date') || lowerLabel.includes('thoi_gian') || lowerLabel.includes('thời gian')) {
              val = formatAnyDateValue(val);
            }
            rowData.push(val);
            break;
          }
        }
      });

      const addedMdRow = wsDetails.addRow(rowData);
      activeMasterCols.forEach((col, cIdx) => {
        const cell = addedMdRow.getCell(cIdx + 1);
        const lowerLabel = (col.label || col.id).toLowerCase();

        if (['codAmount', 'shopFee', 'nvcFee', 'profit', 'netPayout'].includes(col.id)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right' };
        } else if (col.id === 'weight') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (col.id === 'stt' || col.id === 'waybill' || col.id === 'date' || lowerLabel.includes('ngay') || lowerLabel.includes('date') || lowerLabel.includes('thoi_gian')) {
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
    const exportSettings = carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings();
    const workbook = await this.createMasterProfitWorkbook(session, exportSettings);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Bao_Cao_Tong_Hop_Loi_Nhuan_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  },

  async downloadAllStatementsZip(session: ReconciliationSession, onProgress?: (percent: number, currentShop: string) => void): Promise<void> {
    const zip = new JSZip();
    const rootFolder = zip.folder(`DOI_SOAT_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}`);

    const carrierId = session.carrierId;
    const exportSettings = carrierId ? StorageService.getCarrierExportSettings(carrierId) : StorageService.getExportColumnSettings();

    const masterWb = await this.createMasterProfitWorkbook(session, exportSettings);
    const masterBuffer = await masterWb.xlsx.writeBuffer();
    rootFolder?.file('00_BAO_CAO_TONG_HOP_LOI_NHUAN_NHA_GOM.xlsx', masterBuffer);

    const total = session.statements.length;
    for (let i = 0; i < total; i++) {
      const stmt = session.statements[i];
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 100), stmt.shopName);
      }

      const cleanShopFolder = stmt.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      const shopSubFolder = rootFolder?.folder(cleanShopFolder);
      
      const shopWb = await this.createShopStatementWorkbook(stmt, exportSettings);
      const shopBuffer = await shopWb.xlsx.writeBuffer();
      const filename = `Doi_soat_${cleanShopFolder}.xlsx`;
      
      shopSubFolder?.file(filename, shopBuffer);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `Bo_Ho_So_Doi_Soat_${session.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
  },
};
