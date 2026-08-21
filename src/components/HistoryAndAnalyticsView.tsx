import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Eye, 
  FileSpreadsheet, 
  Award,
  Search,
  PieChart,
  Layers,
  Mail
} from 'lucide-react';
import type { ReconciliationSession, Shop } from '../types';
import { ExcelService } from '../services/excelService';
import { StorageService } from '../services/storage';
import { cleanSessionName } from '../utils/periodUtils';
import { useToast } from './UIFeedback';

interface HistoryAndAnalyticsViewProps {
  sessions: ReconciliationSession[];
  shops: Shop[];
  onSelectSession: (session: ReconciliationSession) => void;
  onNavigateToEmail?: (session: ReconciliationSession) => void;
}

export const HistoryAndAnalyticsView: React.FC<HistoryAndAnalyticsViewProps> = ({
  sessions,
  shops,
  onSelectSession,
  onNavigateToEmail,
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('ALL');

  // Edit Session Date & Name Modal
  const [editingSession, setEditingSession] = useState<ReconciliationSession | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');

  const handleStartEditSession = (session: ReconciliationSession) => {
    setEditingSession(session);
    setEditSessionName(session.sessionName || '');
    const dateObj = new Date(session.createdAt);
    const dateIso = !isNaN(dateObj.getTime()) ? dateObj.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    setEditSessionDate(dateIso);
  };

  const handleSaveSessionEdit = () => {
    if (!editingSession) return;
    if (!editSessionName.trim()) {
      showToast('Tên kỳ đối soát không được để trống.', 'warning');
      return;
    }
    const updatedSession: ReconciliationSession = {
      ...editingSession,
      sessionName: editSessionName.trim(),
      createdAt: editSessionDate
        ? new Date(editSessionDate + 'T12:00:00.000Z').toISOString()
        : editingSession.createdAt,
    };

    StorageService.saveSession(updatedSession);
    showToast('Đã cập nhật Ngày/Kỳ đối soát thành công!', 'success');
    setEditingSession(null);
    window.location.reload();
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  // Helper to safely get total shop revenue, NVC cost, and profit per statement & session
  const getStmtShopFee = (stmt: any) => {
    const fee = (stmt.totalShopFee || 0) + (stmt.totalShopOtherFee || 0);
    if (fee > 0) return fee;
    if (stmt.orders && stmt.orders.length > 0) {
      return stmt.orders.reduce((sum: number, o: any) => sum + (o.shopCalculatedFee ?? 0) + (o.shopOtherFee ?? 0), 0);
    }
    return 0;
  };

  const getStmtNvcCost = (stmt: any) => {
    if (stmt.totalNvcCost !== undefined) return stmt.totalNvcCost;
    if (stmt.orders && stmt.orders.length > 0) {
      return stmt.orders.reduce((sum: number, o: any) => sum + (o.nvcBaseFee || 0) + (o.nvcOtherFee || 0), 0);
    }
    return 0;
  };

  const getStmtProfit = (stmt: any) => {
    const fee = getStmtShopFee(stmt);
    const cost = getStmtNvcCost(stmt);
    return fee - cost;
  };

  const getSessionShopRevenue = (s: ReconciliationSession) => {
    if (s.totalShopRevenue !== undefined) return s.totalShopRevenue;
    return s.statements.reduce((sum, st) => sum + getStmtShopFee(st), 0);
  };

  const getSessionNvcCost = (s: ReconciliationSession) => {
    if (s.totalNvcCost !== undefined) return s.totalNvcCost;
    return s.statements.reduce((sum, st) => sum + getStmtNvcCost(st), 0);
  };

  const getSessionProfit = (s: ReconciliationSession) => {
    const rev = getSessionShopRevenue(s);
    const cost = getSessionNvcCost(s);
    return rev - cost;
  };

  // Overall Financial Aggregations
  const totalOrdersAllTime = sessions.reduce((sum, s) => sum + s.totalOrders, 0);
  const totalCodAllTime = sessions.reduce((sum, s) => sum + s.totalCod, 0);
  const totalShopRevenueAllTime = sessions.reduce((sum, s) => sum + getSessionShopRevenue(s), 0);
  const totalNvcCostAllTime = sessions.reduce((sum, s) => sum + getSessionNvcCost(s), 0);
  const totalProfitAllTime = totalShopRevenueAllTime - totalNvcCostAllTime;
  const totalNetPayoutAllTime = totalCodAllTime - totalShopRevenueAllTime;

  const profitMarginPercent = totalShopRevenueAllTime > 0 
    ? ((totalProfitAllTime / totalShopRevenueAllTime) * 100).toFixed(1) 
    : '0';

  // Top Performing Shops ranking (Accumulated profit across all sessions)
  const shopProfitMap = new Map<string, { name: string; orders: number; cod: number; profit: number }>();

  for (const sess of sessions) {
    for (const stmt of sess.statements) {
      const key = stmt.shopName;
      const stmtProfit = getStmtProfit(stmt);
      if (!shopProfitMap.has(key)) {
        shopProfitMap.set(key, {
          name: stmt.shopName,
          orders: stmt.totalOrders,
          cod: stmt.totalCod,
          profit: stmtProfit,
        });
      } else {
        const item = shopProfitMap.get(key)!;
        item.orders += stmt.totalOrders;
        item.cod += stmt.totalCod;
        item.profit += stmtProfit;
      }
    }
  }

  const topShops = Array.from(shopProfitMap.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    const matchQuery = s.sessionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.carrierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.nvcFileName && s.nvcFileName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCarrier = carrierFilter === 'ALL' || s.carrierId === carrierFilter;
    return matchQuery && matchCarrier;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart3 size={24} color="var(--primary)" />
              Báo Cáo Tài Chính & Lịch Sử Đối Soát Nhà Gom Đơn
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Toàn bộ dữ liệu đối soát, dòng tiền COD, doanh thu cước và biên lợi nhuận ròng được lưu trữ vĩnh viễn trong hệ thống.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-primary" style={{ fontSize: 12, padding: '6px 12px' }}>
              {shops.length} Shop đã đăng ký
            </span>
            <span className="badge badge-success" style={{ fontSize: 12, padding: '6px 12px' }}>
              ✓ Đã lưu trữ {sessions.length} kỳ đối soát
            </span>
          </div>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {/* Total Orders */}
        <div className="kpi-card" style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(99, 102, 241, 0.02) 100%)',
          border: '1.5px solid rgba(79, 70, 229, 0.25)',
        }}>
          <div className="kpi-title">
            <span>TỔNG SỐ ĐƠN ĐÃ ĐỐI SOÁT</span>
            <Calendar size={18} color="var(--primary)" />
          </div>
          <div className="kpi-value">{totalOrdersAllTime.toLocaleString('vi-VN')} đơn</div>
          <div className="kpi-subtext">Tích lũy từ {sessions.length} kỳ đối soát</div>
        </div>

        {/* Total COD */}
        <div className="kpi-card" style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(56, 189, 248, 0.02) 100%)',
          border: '1.5px solid rgba(2, 132, 199, 0.25)',
        }}>
          <div className="kpi-title">
            <span>TỔNG TIỀN COD ĐÃ THU HỘ</span>
            <DollarSign size={18} color="var(--info)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--info)' }}>
            {formatVND(totalCodAllTime)}
          </div>
          <div className="kpi-subtext">Dòng tiền NVC đã thanh toán về tài khoản</div>
        </div>

        {/* Total Shop Revenue */}
        <div className="kpi-card" style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(168, 85, 247, 0.02) 100%)',
          border: '1.5px solid rgba(139, 92, 246, 0.25)',
        }}>
          <div className="kpi-title">
            <span>DOANH THU CƯỚC THU SHOP</span>
            <DollarSign size={18} color="var(--primary)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {formatVND(totalShopRevenueAllTime)}
          </div>
          <div className="kpi-subtext">Cước trả NVC gốc: {formatVND(totalNvcCostAllTime)}</div>
        </div>

        {/* Total Net Profit */}
        <div className="kpi-card profit" style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.1) 0%, rgba(16, 185, 129, 0.04) 100%)',
          border: '1.5px solid rgba(5, 150, 105, 0.3)',
        }}>
          <div className="kpi-title" style={{ color: 'var(--success)' }}>
            <span>TỔNG LÃI RÒNG NHÀ GOM (PROFIT)</span>
            <TrendingUp size={18} color="var(--success)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            +{formatVND(totalProfitAllTime)}
          </div>
          <div className="kpi-subtext" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
            Biên lợi nhuận: <span style={{ color: 'var(--success)' }}>{profitMarginPercent}%</span> trên tổng cước thu
          </div>
        </div>

        {/* Total Net Payout to Shops */}
        <div className="kpi-card" style={{
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.06) 0%, rgba(245, 158, 11, 0.02) 100%)',
          border: '1.5px solid rgba(217, 119, 6, 0.25)',
        }}>
          <div className="kpi-title">
            <span>TỔNG TIỀN ĐÃ TRẢ CÁC SHOP</span>
            <Layers size={18} color="var(--warning)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>
            {formatVND(totalNetPayoutAllTime)}
          </div>
          <div className="kpi-subtext">= Tổng COD - Tổng Cước trừ Shop</div>
        </div>
      </div>

      {/* Top 5 Most Profitable Shops Ranking */}
      {topShops.length > 0 && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Award size={20} color="var(--warning)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              Top Shop Đem Lại Lợi Nhuận Cao Nhất Cho Bạn
            </h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {topShops.map((shop, idx) => (
              <div key={shop.name} style={{
                background: 'var(--bg-primary)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: idx === 0 ? 'var(--warning)' : 'var(--bg-tertiary)',
                    color: idx === 0 ? '#fff' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    #{idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{shop.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {shop.orders} đơn • COD: {formatVND(shop.cod)}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                    +{formatVND(shop.profit)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Lãi ròng</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Table Filter & Search */}
      <div className="table-container glass-panel" style={{
        border: '1.5px solid rgba(226, 232, 240, 0.95)',
        borderRadius: 16,
        boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.05)',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1.5px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart size={18} color="var(--primary)" />
            Danh Sách Các Kỳ Đối Soát Đã Thực Hiện ({filteredSessions.length})
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Tìm kỳ đối soát..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px 6px 30px', fontSize: 13 }}
              />
            </div>

            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="select-field"
              style={{ padding: '6px 10px', fontSize: 13 }}
            >
              <option value="ALL">Tất cả NVC</option>
              <option value="ghtk">GHTK</option>
              <option value="ghn">GHN</option>
              <option value="vtp">Viettel Post</option>
              <option value="jnt">J&T Express</option>
              <option value="spx">SPX Express</option>
            </select>
          </div>
        </div>

        {/* Scrollable Framed Container */}
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Kỳ Đối Soát</th>
                <th>Hãng Vận Chuyển</th>
                <th>Số Đơn / Số Shop</th>
                <th>Tổng Tiền COD</th>
                <th>LỢI NHUẬN GOM ĐƠN</th>
                <th>Tổng Tiền Trả Khách</th>
                <th>Ngày Tạo</th>
                <th style={{ textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    {sessions.length === 0 
                      ? 'Chưa có kỳ đối soát nào được lưu. Bạn hãy vào tab "Đối Soát Kéo Thả" để tải file và đối soát.' 
                      : 'Không tìm thấy kỳ đối soát phù hợp với từ khóa tìm kiếm.'}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session, idx) => (
                  <tr key={session.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong style={{ fontSize: 14, color: 'var(--primary)' }}>
                        {cleanSessionName(session.sessionName, session.createdAt, session.carrierName)}
                      </strong>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                        File: {session.nvcFileName} • {session.appFileName}
                      </div>
                    </td>
                  <td>
                    <span className="badge badge-neutral">{session.carrierName}</span>
                  </td>
                  <td>
                    <strong>{session.totalOrders} đơn</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {session.statements.length} Shop
                    </div>
                  </td>
                  <td className="mono" style={{ color: 'var(--info)', fontWeight: 600 }}>
                    {formatVND(session.totalCod)}
                  </td>
                  <td className="mono" style={{ color: getSessionProfit(session) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {getSessionProfit(session) >= 0 ? '+' : ''}{formatVND(getSessionProfit(session))}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    {formatVND(session.totalNetPayout)}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(session.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => onSelectSession(session)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '5px 9px', fontSize: 11 }}
                        title="Mở lại toàn bộ kết quả đối soát này"
                      >
                        <Eye size={13} />
                        <span>Mở lại</span>
                      </button>

                      <button
                        onClick={() => {
                          if (onNavigateToEmail) {
                            onNavigateToEmail(session);
                          } else {
                            onSelectSession(session);
                          }
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 9px', fontSize: 11, color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        title="Mở tab Gửi Email đối soát cho kỳ này"
                      >
                        <Mail size={13} />
                        <span>Gửi Mail</span>
                      </button>

                      <button
                        onClick={() => ExcelService.downloadMasterProfitReport(session)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 8px' }}
                        title="Tải Báo Cáo Lợi Nhuận Excel (.xlsx)"
                      >
                        <FileSpreadsheet size={13} />
                      </button>

                      <button
                        onClick={() => handleStartEditSession(session)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 8px', fontSize: 11 }}
                        title="Sửa Tên Kỳ hoặc Ngày Kỳ đối soát này"
                      >
                        <Calendar size={13} />
                        <span>Sửa ngày</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {editingSession && (
        <div className="modal-backdrop" style={{ zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="glass-panel modal-content" style={{ width: 440, padding: 22, borderRadius: 16, background: '#ffffff' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} /> Sửa Tên Kỳ & Ngày Kỳ Đối Soát
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-main)' }}>
                  ✏️ Tên Kỳ Đối Soát:
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontWeight: 700 }}
                  value={editSessionName}
                  onChange={(e) => setEditSessionName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-main)' }}>
                  🗓️ Ngày Kỳ Đối Soát:
                </label>
                <input
                  type="date"
                  className="input-field"
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontWeight: 700 }}
                  value={editSessionDate}
                  onChange={(e) => setEditSessionDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingSession(null)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSessionEdit}
                >
                  💾 Lưu Thay Đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
