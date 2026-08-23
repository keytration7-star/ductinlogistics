import type { ShopSettlementStatement, ReconciliationSession } from '../types';
import { StorageService } from './storage';
import { calculateStatementSettlement, calculateLiveOpeningDebtForStatement } from './settlementService';

export const PdfService = {
  printShopStatementPdf(statement: ShopSettlementStatement, session?: ReconciliationSession): void {
    const company = StorageService.getCompanyInfo();
    const companyTitle = (company.companyName || 'CÔNG TY TNHH LOGISTICS & GOM ĐƠN').toUpperCase();
    const companySubtitle = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    const allSessions = StorageService.getSessions();
    const allPayments = StorageService.getPaymentRecords();
    const allShops = StorageService.getShops();
    const currentSession = session || allSessions.find(s => (s.statements || []).some((st: ShopSettlementStatement) => st.shopId === statement.shopId && st.periodName === statement.periodName));
    const matchedShop = allShops.find(s => s.id === statement.shopId || s.code === statement.shopCode);

    const liveOpeningDebt = currentSession
      ? calculateLiveOpeningDebtForStatement(statement, currentSession, allSessions, allPayments, matchedShop)
      : (statement.previousDebt || 0);

    const stmtWithLiveDebt = { ...statement, previousDebt: liveOpeningDebt };
    const settlement = calculateStatementSettlement(stmtWithLiveDebt);
    const previousDebtVal = settlement.openingDebt;
    const finalPayout = settlement.amountPayable;

    const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Bảng Kê Đối Soát - ${statement.shopName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
            background: #fff;
          }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; }
          .company-name { font-size: 18px; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; text-transform: uppercase; }
          .company-sub { font-size: 11px; color: #475569; font-style: italic; }
          .title { font-size: 15px; font-weight: bold; color: #4f46e5; text-align: center; margin: 16px 0 6px 0; text-transform: uppercase; }
          .period { text-align: center; font-size: 12px; color: #334155; margin-bottom: 20px; }
          
          .grid-container { display: flex; gap: 16px; margin-bottom: 20px; }
          .box { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; }
          .box-title { font-weight: bold; color: #1e293b; font-size: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; }
          .info-row { margin-bottom: 4px; font-size: 12px; }
          .info-label { font-weight: bold; color: #475569; display: inline-block; width: 110px; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12px; }
          th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; }
          tr:nth-child(even) { background-color: #f8fafc; }

          .grand-total {
            background-color: #fef08a !important;
            color: #dc2626 !important;
            font-weight: bold;
            font-size: 14px;
          }

          .footer-sig { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; page-break-inside: avoid; }
          .sig-box { width: 45%; }
          .sig-title { font-weight: bold; font-size: 13px; margin-bottom: 4px; text-transform: uppercase; }
          .sig-sub { font-style: italic; font-size: 11px; color: #64748b; }
          .sig-space { height: 65px; }

          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            🖨️ In / Tải PDF (Save to PDF)
          </button>
        </div>

        <div class="header">
          <div class="company-name">${companyTitle}</div>
          <div class="company-sub">${companySubtitle}</div>
        </div>

        <div class="title">BẢNG KÊ ĐỐI SOÁT TIỀN THU HỘ (COD) VÀ CƯỚC PHÍ VẬN CHUYỂN</div>
        <div class="period">Kỳ đối soát: <strong>${statement.periodName}</strong> | Ngày xuất phiếu: ${new Date().toLocaleDateString('vi-VN')}</div>

        <div class="grid-container">
          <div class="box">
            <div class="box-title">I. THÔNG TIN KHÁCH HÀNG (SHOP)</div>
            <div class="info-row"><span class="info-label">Tên Shop:</span> <strong>${statement.shopName}</strong></div>
            <div class="info-row"><span class="info-label">Mã KH:</span> ${statement.shopCode}</div>
            <div class="info-row"><span class="info-label">Số điện thoại:</span> ${statement.shopPhone || 'Chưa có'}</div>
            <div class="info-row"><span class="info-label">Email:</span> ${statement.shopEmail || 'Chưa có'}</div>
          </div>

          <div class="box">
            <div class="box-title">II. THÔNG TIN TÀI KHOẢN NHẬN TIỀN COD</div>
            <div class="info-row"><span class="info-label">Ngân hàng:</span> <strong>${statement.bankInfo.bankName}</strong></div>
            <div class="info-row"><span class="info-label">Số tài khoản:</span> <strong style="color: #2563eb; font-size: 14px;">${statement.bankInfo.accountNumber}</strong></div>
            <div class="info-row"><span class="info-label">Chủ tài khoản:</span> <strong>${statement.bankInfo.accountHolder}</strong></div>
          </div>
        </div>

        <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">III. BẢNG TỔNG HỢP DÒNG TIỀN ĐỐI SOÁT</div>
        <table>
          <thead>
            <tr>
              <th>Hạng mục</th>
              <th style="text-align: right;">Số lượng / Giá trị</th>
              <th style="text-align: center;">Đơn vị tính</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Tổng số đơn hàng gửi</td>
              <td style="text-align: right; font-weight: bold;">${statement.totalOrders}</td>
              <td style="text-align: center;">Đơn</td>
              <td></td>
            </tr>
            <tr>
              <td>2. Số đơn giao thành công</td>
              <td style="text-align: right; font-weight: bold;">${statement.deliveredOrders}</td>
              <td style="text-align: center;">Đơn</td>
              <td>Thu đủ tiền COD</td>
            </tr>
            <tr>
              <td>3. Số đơn chuyển hoàn</td>
              <td style="text-align: right; font-weight: bold;">${statement.returnedOrders}</td>
              <td style="text-align: center;">Đơn</td>
              <td>Tính phí hoàn theo hợp đồng</td>
            </tr>
            <tr>
              <td>4. Số đơn đang giao / khác</td>
              <td style="text-align: right; font-weight: bold;">${statement.inTransitOrders}</td>
              <td style="text-align: center;">Đơn</td>
              <td></td>
            </tr>
            <tr>
              <td><strong>5. TỔNG TIỀN THU HỘ (COD) (+)</strong></td>
              <td style="text-align: right; font-weight: bold; color: #2563eb;">${formatVND(statement.totalCod)}</td>
              <td style="text-align: center;">VNĐ</td>
              <td>Tổng tiền NVC đã thu từ người nhận</td>
            </tr>
            <tr>
              <td><strong>6. TỔNG CƯỚC PHÍ VẬN CHUYỂN (-)</strong></td>
              <td style="text-align: right; font-weight: bold; color: #d97706;">${formatVND(statement.totalShopFee)}</td>
              <td style="text-align: center;">VNĐ</td>
              <td>Tính theo biểu giá riêng của Shop</td>
            </tr>
            <tr>
              <td>7. Phí phụ thu / Bảo hiểm / Hoàn (-)</td>
              <td style="text-align: right; font-weight: bold; color: #dc2626;">${formatVND(statement.totalShopOtherFee)}</td>
              <td style="text-align: center;">VNĐ</td>
              <td></td>
            </tr>
            <tr>
              <td>8. Công nợ đầu kỳ (-/+)</td>
              <td style="text-align: right; font-weight: bold;">${formatVND(previousDebtVal)}</td>
              <td style="text-align: center;">VNĐ</td>
              <td>${previousDebtVal < 0 ? 'Shop nợ công ty (trừ bớt)' : previousDebtVal > 0 ? 'Công ty nợ Shop (cộng thêm)' : 'Không có công nợ cũ'}</td>
            </tr>
            <tr>
              <td>9. Shop còn nợ công ty chuyển kỳ sau</td>
              <td style="text-align: right; font-weight: bold; color: #dc2626;">${formatVND(settlement.amountShopOwes)}</td>
              <td style="text-align: center;">VNĐ</td>
              <td>${settlement.amountShopOwes > 0 ? 'Không phát sinh chuyển tiền trong kỳ này' : 'Không có'}</td>
            </tr>
            <tr class="grand-total">
              <td>▶ SỐ TIỀN THỰC CHUYỂN CHO SHOP (=)</td>
              <td style="text-align: right; font-size: 15px;">${formatVND(finalPayout)}</td>
              <td style="text-align: center;">VNĐ</td>
              <td>${settlement.amountShopOwes > 0 ? 'Không chuyển tiền; công nợ được chuyển sang kỳ sau' : 'Tiền công ty chuyển khoản cho Shop'}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">IV. DANH SÁCH CHI TIẾT VẬN ĐƠN (${statement.orders.length} ĐƠN)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">STT</th>
              <th>Mã Vận Đơn</th>
              <th>Người Nhận</th>
              <th style="text-align: center;">Trọng Lượng</th>
              <th style="text-align: right;">Tiền COD</th>
              <th style="text-align: right;">Cước Shop</th>
              <th style="text-align: right;">Thực Nhận</th>
              <th style="text-align: center;">Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            ${statement.orders.slice(0, 100).map((o, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${o.waybill}</strong></td>
                <td>${o.receiverName || ''} (${o.receiverPhone || ''})</td>
                <td style="text-align: center;">${o.weight} kg</td>
                <td style="text-align: right;">${formatVND(o.codAmount)}</td>
                <td style="text-align: right; color: #d97706;">${formatVND(o.shopCalculatedFee + o.shopOtherFee)}</td>
                <td style="text-align: right; font-weight: bold; color: #16a34a;">${formatVND(o.netShopPayout)}</td>
                <td style="text-align: center;">${o.statusText || o.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${statement.orders.length > 100 ? `<div style="font-style: italic; font-size: 11px; color: #64748b;">(Đã rút gọn hiển thị 100 đơn đầu tiên trên bản in PDF. Xem chi tiết đầy đủ trong File Excel đính kèm)</div>` : ''}

        <div class="footer-sig">
          <div class="sig-box">
            <div class="sig-title">ĐẠI DIỆN CÔNG TY KÝ</div>
            <div class="sig-sub">(Ký & Ghi rõ họ tên)</div>
            <div class="sig-space"></div>
          </div>
          <div class="sig-box">
            <div class="sig-title">ĐẠI DIỆN KHÁCH HÀNG (SHOP)</div>
            <div class="sig-sub">(Ký & Ghi rõ họ tên)</div>
            <div class="sig-space"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};
