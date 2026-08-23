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
  Mail,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import type { ReconciliationSession, Shop } from '../types';
import { ExcelService } from '../services/excelService';
import { StorageService } from '../services/storage';
import { cleanSessionName } from '../utils/periodUtils';
import { useToast, useConfirm } from './UIFeedback';

interface HistoryAndAnalyticsViewProps {
  sessions: ReconciliationSession[];
  shops: Shop[];
  onSelectSession: (session: ReconciliationSession) => void;
  onNavigateToEmail?: (session: ReconciliationSession) => void;
  onNavigateToZalo?: (session: ReconciliationSession) => void;
  onRefreshSessions?: () => void;
}

export const HistoryAndAnalyticsView: React.FC<HistoryAndAnalyticsViewProps> = ({
  sessions,
  shops,
  onSelectSession,
  onNavigateToEmail,
  onNavigateToZalo,
  onRefreshSessions,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('ALL');

  const handleDeleteSession = async (session: ReconciliationSession) => {
    const ok = await showConfirm({
      title: 'Xóa Kỳ Đối Soát',
      message: `Bạn có chắc chắn muốn xóa kỳ đối soát "${session.sessionName || session.id}" (${session.statements.length} Shop)? Thao tác này sẽ dọn sạch dữ liệu kỳ đối soát này để bạn có thể test lại.`,
      danger: true,
      confirmText: 'Xóa Vĩnh Viễn',
      cancelText: 'Giữ Lại',
    });
    if (ok) {
      StorageService.deleteSession(session.id);
      showToast(`Đã xóa kỳ đối soát "${session.sessionName || session.id}"!`, 'success');
      if (onRefreshSessions) onRefreshSessions();
    }
  };

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
      
      {/* 🌟 1. HEADER FROSTED PORCELAIN */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border-color)',
        borderRadius: 16,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(79, 70, 229, 0.3)',
            flexShrink: 0,
          }}>
            <BarChart3 size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                Báo Cáo Tài Chính & Lịch Sử Đối Soát Vận Chuyển
              </h2>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '2px 0 0' }}>
              Toàn bộ dữ liệu đối soát, dòng tiền COD, doanh thu cước và biên lợi nhuận ròng được lưu trữ an toàn trong hệ thống.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11,
            background: 'rgba(79, 70, 229, 0.12)',
            color: 'var(--primary)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            padding: '3px 10px',
            borderRadius: 6,
            fontWeight: 800,
          }}>
            👥 {shops.length} Shop Đã Đăng Ký
          </span>
          <span style={{
            fontSize: 11,
            background: 'var(--success-bg)',
            color: 'var(--success)',
            border: '1px solid var(--success-border)',
            padding: '3px 10px',
            borderRadius: 6,
            fontWeight: 800,
          }}>
            ✓ Đã Lưu Trữ {sessions.length} Kỳ Đối Soát
          </span>
        </div>
      </div>

      {/* 🌟 2. 5 THẺ TÀI CHÍNH CÂN XỨNG HOÀN HẢO TRÊN 1 HÀNG */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {/* Card 1: Tổng đơn */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--info-border)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: 'var(--info)', fontWeight: 800, textTransform: 'uppercase' }}>TỔNG ĐƠN ĐỐI SOÁT</span>
            <Calendar size={15} color="var(--info)" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)', margin: '4px 0 2px' }}>
            {totalOrdersAllTime.toLocaleString('vi-VN')} <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-dim)' }}>đơn</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Tích lũy từ {sessions.length} kỳ</div>
        </div>

        {/* Card 2: Tổng COD Thu hộ */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--success-border)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: 'var(--success)', fontWeight: 800, textTransform: 'uppercase' }}>TỔNG COD THU HỘ</span>
            <DollarSign size={15} color="var(--success)" />
          </div>
          <div className="mono" style={{ fontSize: 17, fontWeight: 900, color: 'var(--info)', margin: '4px 0 2px' }}>
            {formatVND(totalCodAllTime)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Tiền NVC đã thanh toán</div>
        </div>

        {/* Card 3: Doanh thu cước Shop */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid rgba(124, 58, 237, 0.3)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: '#8b5cf6', fontWeight: 800, textTransform: 'uppercase' }}>CƯỚC THU SHOP</span>
            <DollarSign size={15} color="#8b5cf6" />
          </div>
          <div className="mono" style={{ fontSize: 17, fontWeight: 900, color: '#8b5cf6', margin: '4px 0 2px' }}>
            {formatVND(totalShopRevenueAllTime)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Gốc NVC: {formatVND(totalNvcCostAllTime)}</div>
        </div>

        {/* Card 4: Tiền đã trả Shop */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--warning-border)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: 'var(--warning)', fontWeight: 800, textTransform: 'uppercase' }}>TIỀN ĐÃ TRẢ CÁC SHOP</span>
            <Layers size={15} color="var(--warning)" />
          </div>
          <div className="mono" style={{ fontSize: 17, fontWeight: 900, color: 'var(--warning)', margin: '4px 0 2px' }}>
            {formatVND(totalNetPayoutAllTime)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>= Tổng COD - Cước Shop</div>
        </div>

        {/* Card 5: Tổng Lãi Ròng Nhà Gom */}
        <div style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--success-border)',
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, color: 'var(--success)', fontWeight: 900, textTransform: 'uppercase' }}>LÃI RÒNG NHÀ GOM</span>
            <TrendingUp size={15} color="var(--success)" />
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)', margin: '4px 0 2px' }}>
            +{formatVND(totalProfitAllTime)}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--success)', fontWeight: 700 }}>
            Biên lợi nhuận: <span style={{ color: 'var(--success)' }}>{profitMarginPercent}%</span>
          </div>
        </div>
      </div>

      {/* 🌟 3. TOP 5 SHOP ĐEM LẠI LỢI NHUẬN CAO NHẤT */}
      {topShops.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-color)',
          borderRadius: 14,
          padding: '12px 16px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Award size={16} color="#f59e0b" />
            <h3 style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Top Shop Đem Lại Lợi Nhuận Cao Nhất Cho Bạn
            </h3>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {topShops.map((shop, idx) => (
              <div key={shop.name} style={{
                background: 'var(--bg-tertiary)',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: idx === 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'var(--bg-card)',
                    color: idx === 0 ? '#fff' : 'var(--text-dim)',
                    fontWeight: 800,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    #{idx + 1}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={shop.name}>
                      {shop.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
                      {shop.orders} đơn • COD {formatVND(shop.cod)}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)' }}>
                    +{formatVND(shop.profit)}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>Lãi ròng</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🌟 4. BẢNG LỊCH SỬ KỲ ĐỐI SOÁT FROSTED PORCELAIN */}
      <div className="table-container glass-panel" style={{
        borderRadius: 14,
        border: '1.5px solid var(--border-color)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '1.5px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          background: 'var(--bg-tertiary)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <PieChart size={16} color="var(--primary)" />
            Danh Sách Các Kỳ Đối Soát Đã Lưu ({filteredSessions.length})
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: 8, color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Tìm kỳ đối soát..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '4px 8px 4px 28px', fontSize: 12, borderRadius: 6 }}
              />
            </div>

            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="select-field"
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6 }}
            >
              <option value="ALL">🌐 Tất cả Hãng NVC</option>
              <option value="jnt">J&T Express</option>
              <option value="spx">Shopee Express (SPX)</option>
              <option value="ghn">GHN</option>
              <option value="ghtk">GHTK</option>
              <option value="vtp">Viettel Post</option>
            </select>
          </div>
        </div>

        {/* Scrollable Framed Container */}
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 45, textAlign: 'center' }}>STT</th>
                <th>KỲ ĐỐI SOÁT</th>
                <th>HÃNG NVC</th>
                <th>SỐ ĐƠN / SHOP</th>
                <th>TỔNG TIỀN COD</th>
                <th>LÃI RÒNG NHÀ GOM</th>
                <th>TIỀN TRẢ SHOP</th>
                <th>NGÀY TẠO</th>
                <th style={{ textAlign: 'center', width: 220 }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    {sessions.length === 0 
                      ? 'Chưa có kỳ đối soát nào được lưu. Bạn hãy vào tab "Đối Soát Kéo Thả" để tải file và đối soát.' 
                      : 'Không tìm thấy kỳ đối soát phù hợp với từ khóa tìm kiếm.'}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session, idx) => (
                  <tr key={session.id}>
                    <td style={{ textAlign: 'center', color: 'var(--text-dim)' }}>{idx + 1}</td>
                    <td>
                      <strong style={{ fontSize: 13, color: 'var(--primary)' }}>
                        {cleanSessionName(session.sessionName, session.createdAt, session.carrierName)}
                      </strong>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
                        File: {session.nvcFileName} • {session.appFileName}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 10.5, padding: '2px 6px' }}>{session.carrierName}</span>
                    </td>
                    <td>
                      <strong>{session.totalOrders} đơn</strong>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                        {session.statements.length} Shop
                      </div>
                    </td>
                    <td className="mono" style={{ color: '#0284c7', fontWeight: 600 }}>
                      {formatVND(session.totalCod)}
                    </td>
                    <td className="mono" style={{ color: getSessionProfit(session) >= 0 ? '#059669' : '#dc2626', fontWeight: 800 }}>
                      {getSessionProfit(session) >= 0 ? '+' : ''}{formatVND(getSessionProfit(session))}
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: '#d97706' }}>
                      {formatVND(session.totalNetPayout)}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(session.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => onSelectSession(session)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '3px 7px', fontSize: 10.5 }}
                          title="Mở lại toàn bộ kết quả đối soát này"
                        >
                          <Eye size={12} />
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
                          style={{ padding: '3px 7px', fontSize: 10.5, color: 'var(--primary)', borderColor: 'var(--primary)' }}
                          title="Mở tab Gửi Email đối soát cho kỳ này"
                        >
                          <Mail size={12} />
                          <span>Mail</span>
                        </button>

                        <button
                          onClick={() => {
                            if (onNavigateToZalo) {
                              onNavigateToZalo(session);
                            } else if (onNavigateToEmail) {
                              onNavigateToEmail(session);
                            } else {
                              onSelectSession(session);
                            }
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 7px', fontSize: 10.5, color: '#0068ff', borderColor: '#0068ff' }}
                          title="Mở tab Gửi Zalo ZNS đối soát cho kỳ này"
                        >
                          <MessageSquare size={12} />
                          <span>Zalo</span>
                        </button>

                        <button
                          onClick={() => ExcelService.downloadMasterProfitReport(session)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 6px' }}
                          title="Tải Báo Cáo Lợi Nhuận Excel (.xlsx)"
                        >
                          <FileSpreadsheet size={12} />
                        </button>

                        <button
                          onClick={() => handleStartEditSession(session)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 6px', fontSize: 10.5 }}
                          title="Sửa Tên Kỳ hoặc Ngày Kỳ đối soát này"
                        >
                          <Calendar size={12} />
                        </button>

                        <button
                          onClick={() => handleDeleteSession(session)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '3px 6px', fontSize: 10.5, background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
                          title="Xóa kỳ đối soát này"
                        >
                          <Trash2 size={12} />
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
