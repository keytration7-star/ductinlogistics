import React from 'react';
import { 
  X, 
  Download, 
  Mail, 
  QrCode, 
  CheckCircle2, 
  Store, 
  CreditCard, 
  Package,
  Printer 
} from 'lucide-react';
import type { ShopSettlementStatement } from '../types';
import { ExcelService } from '../services/excelService';
import { PdfService } from '../services/pdfService';

interface StatementPreviewModalProps {
  statement: ShopSettlementStatement | null;
  onClose: () => void;
  onOpenQr: (statement: ShopSettlementStatement) => void;
  onOpenEmail: (statement: ShopSettlementStatement) => void;
}

export const StatementPreviewModal: React.FC<StatementPreviewModalProps> = ({
  statement,
  onClose,
  onOpenQr,
  onOpenEmail,
}) => {
  if (!statement) return null;

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 1000, padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Store size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                Phiếu Bảng Kê Đối Soát: {statement.shopName}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Kỳ: {statement.periodName} • Mã KH: {statement.shopCode}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 8px' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}>
            <div style={{
              background: 'var(--bg-primary)',
              padding: 16,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Store size={15} /> THÔNG TIN SHOP
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{statement.shopName}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                SĐT: <strong>{statement.shopPhone || 'Chưa có'}</strong> • Email: <strong>{statement.shopEmail || 'Chưa có'}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                Địa chỉ: {statement.shopAddress || 'Toàn quốc'}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-primary)',
              padding: 16,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={15} /> TÀI KHOẢN NHẬN TIỀN COD
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{statement.bankInfo.bankName}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                STK: {statement.bankInfo.accountNumber}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                Chủ TK: <strong>{statement.bankInfo.accountHolder}</strong>
              </div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-main)' }}>
              TỔNG HỢP DÒNG TIỀN ĐỐI SOÁT KỲ NÀY
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tổng số đơn gửi</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{statement.totalOrders} đơn</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {statement.deliveredOrders} giao xong • {statement.returnedOrders} chuyển hoàn
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tổng tiền COD thu hộ (+)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--info)' }}>
                  {formatVND(statement.totalCod)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tổng cước tính Shop (-)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>
                  {formatVND(statement.totalShopFee)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phí khác / Phụ thu (-)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                  {formatVND(statement.totalShopOtherFee)}
                </div>
              </div>
            </div>

            <div style={{
              paddingTop: 14,
              borderTop: '1px dashed var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={24} color="var(--success)" />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SỐ TIỀN THỰC CHUYỂN KHOẢN CHO SHOP
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                    {formatVND(statement.totalNetPayout)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                Lợi nhuận gom đơn từ shop này: <strong style={{ color: 'var(--primary)' }}>+{formatVND(statement.totalProfit)}</strong>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={16} /> Danh sách chi tiết {statement.orders.length} vận đơn
              </div>
              <span className="badge badge-neutral" style={{ fontSize: 12 }}>
                Đã tính theo biểu giá riêng
              </span>
            </div>

            <div className="table-container" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã Vận Đơn</th>
                    <th>Người Nhận</th>
                    <th>Khối Lượng</th>
                    <th>Tiền COD</th>
                    <th>Cước Shop</th>
                    <th>Thực Nhận</th>
                    <th>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.orders.map((order, idx) => (
                    <tr key={order.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong className="mono" style={{ color: 'var(--primary)' }}>
                          {order.waybill}
                        </strong>
                      </td>
                      <td>
                        <div>{order.receiverName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{order.receiverPhone}</div>
                      </td>
                      <td>{order.weight} kg</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{formatVND(order.codAmount)}</td>
                      <td className="mono" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        {formatVND(order.shopCalculatedFee)}
                      </td>
                      <td className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>
                        {formatVND(order.netShopPayout)}
                      </td>
                      <td>
                        <span className={`badge ${
                          order.status === 'delivered' ? 'badge-success' : 
                          order.status === 'returned' || order.status === 'returning' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {order.statusText || order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <button
            onClick={() => onOpenQr(statement)}
            className="btn btn-secondary"
          >
            <QrCode size={16} />
            <span>Mã VietQR Chuyển Tiền</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => PdfService.printShopStatementPdf(statement)}
              className="btn btn-secondary"
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}
            >
              <Printer size={16} />
              <span>In / Tải PDF Bảng Kê</span>
            </button>

            <button
              onClick={() => onOpenEmail(statement)}
              className="btn btn-secondary"
            >
              <Mail size={16} />
              <span>Gửi Mail Riêng</span>
            </button>

            <button
              onClick={() => ExcelService.downloadShopStatement(statement)}
              className="btn btn-success"
            >
              <Download size={16} />
              <span>Tải File Excel Của Shop (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
