import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  Plus, 
  ArrowRight, 
  FileSpreadsheet, 
  Clock, 
  Sparkles,
  TrendingUp,
  Package,
  Layers,
  Search,
  Trash2,
} from 'lucide-react';
import type { 
  CarrierWholesaleTier, 
  Shop, 
  ReconciliationSession, 
  UserAccount,
} from '../types';
import { useToast, useConfirm } from './UIFeedback';

interface CarrierHubDashboardProps {
  carriers: CarrierWholesaleTier[];
  shops: Shop[];
  sessions: ReconciliationSession[];
  currentUser: UserAccount | null;
  onSelectCarrier: (carrierId: string) => void;
  onSaveCarriers: (updatedCarriers: CarrierWholesaleTier[]) => void;
  onOpenCompanyModal?: () => void;
  onOpenSettingsModal?: () => void;
}

// Brand color palette helper for carrier cards
const CARRIER_THEMES: Record<string, { bgGradient: string; border: string; badgeBg: string; badgeText: string; accentColor: string }> = {
  jnt: {
    bgGradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.04) 100%)',
    border: 'rgba(239, 68, 68, 0.35)',
    badgeBg: '#fee2e2',
    badgeText: '#b91c1c',
    accentColor: '#dc2626',
  },
  ghn: {
    bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.04) 100%)',
    border: 'rgba(249, 115, 22, 0.35)',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    accentColor: '#ea580c',
  },
  vtp: {
    bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(29, 78, 216, 0.04) 100%)',
    border: 'rgba(37, 99, 235, 0.35)',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
    accentColor: '#2563eb',
  },
  spx: {
    bgGradient: 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(244, 63, 94, 0.04) 100%)',
    border: 'rgba(234, 88, 12, 0.35)',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    accentColor: '#f97316',
  },
  ghtk: {
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)',
    border: 'rgba(16, 185, 129, 0.35)',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    accentColor: '#059669',
  },
};

const DEFAULT_THEME = {
  bgGradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(79, 70, 229, 0.04) 100%)',
  border: 'rgba(99, 102, 241, 0.35)',
  badgeBg: '#e0e7ff',
  badgeText: '#4338ca',
  accentColor: '#4f46e5',
};

export const CarrierHubDashboard: React.FC<CarrierHubDashboardProps> = ({
  carriers,
  shops,
  sessions,
  currentUser,
  onSelectCarrier,
  onSaveCarriers,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCarrierModalOpen, setIsAddCarrierModalOpen] = useState(false);
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCode, setNewCarrierCode] = useState('');
  const [newCarrierBasePrice, setNewCarrierBasePrice] = useState('20000');
  const [newCarrierStepPrice, setNewCarrierStepPrice] = useState('5000');

  // Compute live statistics per carrier
  const carrierStats = useMemo(() => {
    const statsMap = new Map<string, { sessionCount: number; orderCount: number; totalCod: number; totalProfit: number; lastSessionDate?: string }>();

    carriers.forEach(c => {
      statsMap.set(c.carrierId, {
        sessionCount: 0,
        orderCount: 0,
        totalCod: 0,
        totalProfit: 0,
      });
    });

    sessions.forEach(sess => {
      const cId = sess.carrierId || 'jnt';
      const existing = statsMap.get(cId) || {
        sessionCount: 0,
        orderCount: 0,
        totalCod: 0,
        totalProfit: 0,
      };

      existing.sessionCount += 1;
      existing.orderCount += sess.totalOrders || 0;
      existing.totalCod += sess.totalCod || 0;
      existing.totalProfit += sess.totalProfit || 0;
      if (!existing.lastSessionDate || new Date(sess.createdAt) > new Date(existing.lastSessionDate)) {
        existing.lastSessionDate = sess.createdAt;
      }
      statsMap.set(cId, existing);
    });

    return statsMap;
  }, [carriers, sessions]);

  // Filtered carriers
  const filteredCarriers = useMemo(() => {
    return carriers.filter(c => 
      c.carrierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.carrierId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [carriers, searchTerm]);

  // Overall system metrics
  const totalSystemCod = useMemo(() => sessions.reduce((acc, s) => acc + (s.totalCod || 0), 0), [sessions]);

  // Handle create new carrier
  const handleCreateCarrier = () => {
    if (!newCarrierName.trim()) {
      showToast('Vui lòng nhập tên Đơn vị vận chuyển.', 'warning');
      return;
    }

    const carrierId = (newCarrierCode.trim() || newCarrierName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    
    if (carriers.some(c => c.carrierId === carrierId)) {
      showToast('Mã Đơn vị vận chuyển này đã tồn tại trong hệ thống.', 'error');
      return;
    }

    const basePriceNum = parseInt(newCarrierBasePrice.replace(/\D/g, ''), 10) || 20000;
    const stepPriceNum = parseInt(newCarrierStepPrice.replace(/\D/g, ''), 10) || 5000;

    const newTier: CarrierWholesaleTier = {
      id: `${carrierId}_tier_${Date.now()}`,
      carrierId: carrierId,
      carrierName: newCarrierName.trim(),
      weightRules: [
        { minWeight: 0, maxWeight: 1, price: basePriceNum },
        { minWeight: 1, maxWeight: 3, price: basePriceNum + stepPriceNum },
        { minWeight: 3, maxWeight: 5, price: basePriceNum + stepPriceNum * 2 },
      ],
      extraStepWeight: 1,
      extraStepPrice: stepPriceNum,
      returnFeePercent: 50,
    };

    const updated = [...carriers, newTier];
    onSaveCarriers(updated);
    setIsAddCarrierModalOpen(false);
    setNewCarrierName('');
    setNewCarrierCode('');
    showToast(`Đã tạo thành công Đơn vị vận chuyển "${newTier.carrierName}"!`, 'success');
  };

  // Handle delete carrier
  const handleDeleteCarrier = async (carrier: CarrierWholesaleTier, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên mới được phép xóa Đơn vị vận chuyển.', 'warning');
      return;
    }

    const stats = carrierStats.get(carrier.carrierId);
    if (stats && stats.sessionCount > 0) {
      showToast(`Không thể xóa "${carrier.carrierName}" vì đang có ${stats.sessionCount} kỳ đối soát đã lưu.`, 'error');
      return;
    }

    const ok = await showConfirm({
      title: `Xác Nhận Xóa Đơn Vị "${carrier.carrierName}"`,
      message: `Bạn có chắc chắn muốn xóa Đơn vị vận chuyển này khỏi danh sách Hub?`,
      danger: true,
    });

    if (!ok) return;

    const updated = carriers.filter(c => c.carrierId !== carrier.carrierId);
    onSaveCarriers(updated);
    showToast(`Đã xóa Đơn vị vận chuyển "${carrier.carrierName}".`, 'success');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 0%, rgba(79, 70, 229, 0.08) 0%, transparent 60%), var(--bg-primary)',
      padding: '40px 32px 80px',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {/* 🌟 HERO HEADER BANNER */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: 24,
          padding: '36px 40px',
          color: '#fff',
          boxShadow: '0 20px 40px -15px rgba(49, 46, 129, 0.4)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 24,
        }}>
          {/* Decorative Glow */}
          <div style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              borderRadius: 30,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              marginBottom: 16,
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}>
              <Sparkles size={14} color="#fbbf24" />
              <span>GOMDON ENTERPRISE • TRUNG TÂM ĐA HÃNG VẬN CHUYỂN</span>
            </div>

            <h1 style={{
              fontSize: 32,
              fontWeight: 900,
              lineHeight: 1.25,
              letterSpacing: -0.5,
              margin: '0 0 10px 0',
              background: 'linear-gradient(to right, #ffffff, #e0e7ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Bảng Điều Khiển Đơn Vị Vận Chuyển
            </h1>

            <p style={{
              fontSize: 15,
              color: '#c7d2fe',
              lineHeight: 1.6,
              margin: 0,
            }}>
              Chọn một Hãng vận chuyển bên dưới để vào không gian nghiệp vụ đối soát, quản lý shop, cước gốc và công nợ riêng biệt cho hãng đó.
            </p>
          </div>

          {/* Quick Global Metrics Chips */}
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 2,
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.10)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              padding: '16px 20px',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 12, color: '#c7d2fe', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck size={14} />
                <span>Số Đơn Vị NVC</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
                {carriers.length} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Hãng</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.10)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              padding: '16px 20px',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 12, color: '#c7d2fe', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={14} />
                <span>Số Shop Quản Lý</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
                {shops.length} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Shop</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.10)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              padding: '16px 20px',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 12, color: '#c7d2fe', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} />
                <span>Kỳ Đối Soát</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>
                {sessions.length} <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Kỳ</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.10)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              padding: '16px 20px',
              minWidth: 160,
            }}>
              <div style={{ fontSize: 12, color: '#c7d2fe', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} />
                <span>Tổng Tiền COD</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: '#34d399' }}>
                {(totalSystemCod / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Tr
              </div>
            </div>
          </div>
        </div>

        {/* 🔍 SEARCH & ACTIONS BAR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div style={{ position: 'relative', width: 340 }}>
            <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm hãng vận chuyển..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 42, height: 44, borderRadius: 12, fontSize: 13.5 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAddCarrierModalOpen(true)}
                className="btn btn-primary"
                style={{
                  height: 44,
                  padding: '0 20px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
                }}
              >
                <Plus size={18} />
                <span>Tạo Thẻ Đơn Vị Vận Chuyển Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* 🗂️ GRID CARDS: DANH SÁCH THẺ ĐƠN VỊ VẬN CHUYỂN */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: 24,
        }}>
          {filteredCarriers.map((carrier) => {
            const stats = carrierStats.get(carrier.carrierId) || {
              sessionCount: 0,
              orderCount: 0,
              totalCod: 0,
              totalProfit: 0,
            };

            const theme = CARRIER_THEMES[carrier.carrierId] || DEFAULT_THEME;
            const weightTiersSummary = carrier.weightRules && carrier.weightRules.length > 0
              ? carrier.weightRules.map(r => `${r.minWeight}-${r.maxWeight}kg: ${(r.price / 1000)}k`).join(' • ')
              : 'Chưa cấu hình';

            return (
              <div
                key={carrier.carrierId}
                onClick={() => onSelectCarrier(carrier.carrierId)}
                style={{
                  background: '#ffffff',
                  borderRadius: 20,
                  border: `1.5px solid ${theme.border}`,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 20,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 20px 35px -10px rgba(79, 70, 229, 0.18)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.borderColor = theme.border;
                }}
              >
                {/* Top Accent Strip */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 6,
                  background: theme.accentColor,
                }} />

                {/* Card Top Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: theme.bgGradient,
                        border: `1px solid ${theme.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.accentColor,
                        fontWeight: 900,
                        fontSize: 18,
                        flexShrink: 0,
                      }}>
                        <Truck size={24} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)', margin: '0 0 2px 0' }}>
                          {carrier.carrierName}
                        </h2>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: theme.accentColor }}>
                          MÃ HÃNG: {carrier.carrierId.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: theme.badgeBg,
                        color: theme.badgeText,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: 20,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accentColor }} />
                        Sẵn sàng
                      </span>

                      {isAdmin && carriers.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCarrier(carrier, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 6,
                          }}
                          title="Xóa hãng vận chuyển này"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Stats */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginTop: 16,
                    background: 'var(--bg-secondary)',
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FileSpreadsheet size={12} />
                        <span>Kỳ đối soát:</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                        {stats.sessionCount} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)' }}>kỳ</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Package size={12} />
                        <span>Tổng đơn:</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                        {stats.orderCount.toLocaleString('vi-VN')} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)' }}>đơn</span>
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: 8, marginTop: 2 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                        Biểu cước gốc: <strong style={{ color: 'var(--text-main)' }}>{weightTiersSummary}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card CTA Action Button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: 16,
                }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} />
                    <span>{stats.lastSessionDate ? `Đối soát gần nhất: ${new Date(stats.lastSessionDate).toLocaleDateString('vi-VN')}` : 'Chưa có kỳ đối soát'}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{
                      fontWeight: 800,
                      fontSize: 12.5,
                      padding: '8px 16px',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>Vào Không Gian {carrier.carrierId.toUpperCase()}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* ➕ CARD: THÊM HÃNG VẬN CHUYỂN MỚI */}
          {isAdmin && (
            <div
              onClick={() => setIsAddCarrierModalOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                borderRadius: 20,
                border: '2px dashed var(--primary)',
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: 280,
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.05)';
                e.currentTarget.style.transform = 'translateY(-3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(79, 70, 229, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Plus size={28} />
              </div>

              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>
                  + Thêm Đơn Vị Vận Chuyển Mới
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, maxWidth: 280 }}>
                  Tạo thẻ nghiệp vụ riêng cho các hãng như Ninja Van, Best Express, EMS, Ahamove...
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 🚀 MODAL: TẠO THẺ HÃNG VẬN CHUYỂN MỚI */}
      {isAddCarrierModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: 520,
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            background: '#ffffff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Thêm Đơn Vị Vận Chuyển Mới</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khởi tạo không gian kế toán & đối soát chuyên biệt</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddCarrierModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-dim)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Tên Đơn vị vận chuyển <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Ninja Van, Best Express, EMS..."
                  value={newCarrierName}
                  onChange={(e) => setNewCarrierName(e.target.value)}
                  className="input-field"
                  style={{ fontSize: 13 }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Mã viết tắt (Carrier ID)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: ninja, best, ems (để trống tự sinh)"
                  value={newCarrierCode}
                  onChange={(e) => setNewCarrierCode(e.target.value)}
                  className="input-field"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    Cước gốc nấc 0-1kg (VNĐ)
                  </label>
                  <input
                    type="text"
                    value={parseInt(newCarrierBasePrice || '0').toLocaleString('vi-VN')}
                    onChange={(e) => setNewCarrierBasePrice(e.target.value.replace(/\D/g, ''))}
                    className="input-field mono"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    Cước nấc vượt (+VNĐ/kg)
                  </label>
                  <input
                    type="text"
                    value={parseInt(newCarrierStepPrice || '0').toLocaleString('vi-VN')}
                    onChange={(e) => setNewCarrierStepPrice(e.target.value.replace(/\D/g, ''))}
                    className="input-field mono"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              borderTop: '1px solid var(--border-color)',
              paddingTop: 16,
              marginTop: 6,
            }}>
              <button
                type="button"
                onClick={() => setIsAddCarrierModalOpen(false)}
                className="btn btn-secondary"
                style={{ fontWeight: 600, fontSize: 13 }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleCreateCarrier}
                className="btn btn-primary"
                style={{ fontWeight: 800, fontSize: 13, padding: '8px 20px' }}
              >
                Khởi Tạo Thẻ Hãng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
