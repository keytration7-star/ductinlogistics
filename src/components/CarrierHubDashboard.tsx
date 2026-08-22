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
  Store,
} from 'lucide-react';
import type { 
  CarrierWholesaleTier, 
  WeightStepRule,
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

const DEFAULT_NEW_WEIGHT_RULES: WeightStepRule[] = [
  { minWeight: 0, maxWeight: 0.9, price: 11000 },
  { minWeight: 1, maxWeight: 2.9, price: 17000 },
  { minWeight: 3, maxWeight: 4.9, price: 25000 },
];

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
  const [newCarrierWeightRules, setNewCarrierWeightRules] = useState<WeightStepRule[]>(DEFAULT_NEW_WEIGHT_RULES);
  const [newCarrierExtraStepWeight, setNewCarrierExtraStepWeight] = useState<number>(1);
  const [newCarrierExtraStepPrice, setNewCarrierExtraStepPrice] = useState<number>(5000);
  const [newCarrierReturnFeePercent, setNewCarrierReturnFeePercent] = useState<number>(0);

  const handleOpenAddModal = () => {
    setNewCarrierName('');
    setNewCarrierCode('');
    setNewCarrierWeightRules([
      { minWeight: 0, maxWeight: 0.9, price: 11000 },
      { minWeight: 1, maxWeight: 2.9, price: 17000 },
      { minWeight: 3, maxWeight: 4.9, price: 25000 },
    ]);
    setNewCarrierExtraStepWeight(1);
    setNewCarrierExtraStepPrice(5000);
    setNewCarrierReturnFeePercent(0);
    setIsAddCarrierModalOpen(true);
  };

  const handleAddModalRule = () => {
    const last = newCarrierWeightRules[newCarrierWeightRules.length - 1];
    const minWeight = last ? Math.round((last.maxWeight + 0.1) * 10) / 10 : 0;
    const maxWeight = last ? Math.ceil(minWeight) + 1.9 : 1;
    const price = last ? last.price + 5000 : 20000;
    setNewCarrierWeightRules([...newCarrierWeightRules, { minWeight, maxWeight, price }]);
  };

  const handleRemoveModalRule = (idx: number) => {
    if (newCarrierWeightRules.length <= 1) return;
    setNewCarrierWeightRules(newCarrierWeightRules.filter((_, i) => i !== idx));
  };

  const handleModalRuleChange = (idx: number, field: keyof WeightStepRule, val: number) => {
    const updated = [...newCarrierWeightRules];
    updated[idx] = { ...updated[idx], [field]: val };
    setNewCarrierWeightRules(updated);
  };

  // Compute live statistics per carrier
  const carrierStats = useMemo(() => {
    const statsMap = new Map<string, { shopCount: number; sessionCount: number; orderCount: number; totalCod: number; totalProfit: number; lastSessionDate?: string }>();

    carriers.forEach(c => {
      const cShops = shops.filter(s => (s.carrierId || 'jnt') === c.carrierId);
      statsMap.set(c.carrierId, {
        shopCount: cShops.length,
        sessionCount: 0,
        orderCount: 0,
        totalCod: 0,
        totalProfit: 0,
      });
    });

    sessions.forEach(sess => {
      const cId = sess.carrierId || 'jnt';
      const existing = statsMap.get(cId) || {
        shopCount: shops.filter(s => (s.carrierId || 'jnt') === cId).length,
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
  }, [carriers, sessions, shops]);

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

    const newTier: CarrierWholesaleTier = {
      id: `${carrierId}_tier_${Date.now()}`,
      carrierId: carrierId,
      carrierName: newCarrierName.trim(),
      weightRules: newCarrierWeightRules,
      extraStepWeight: newCarrierExtraStepWeight,
      extraStepPrice: newCarrierExtraStepPrice,
      returnFeePercent: newCarrierReturnFeePercent,
    };

    const updated = [...carriers, newTier];
    onSaveCarriers(updated);
    setIsAddCarrierModalOpen(false);
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
              <span>KẾ TOÁN PRO ENTERPRISE • TRUNG TÂM ĐA HÃNG VẬN CHUYỂN</span>
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
          </div>
        </div>

        {/* Global Summary Statistics Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}>
          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Hãng Hoạt Động</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', marginTop: 2 }}>
                {carriers.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>đơn vị</span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng Kỳ Đối Soát</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', marginTop: 2 }}>
                {sessions.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>kỳ</span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng Tiền COD Hệ Thống</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', marginTop: 2 }}>
                {new Intl.NumberFormat('vi-VN').format(totalSystemCod)} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>đ</span>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Shop Liên Kết</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-main)', marginTop: 2 }}>
                {shops.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>shop</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Title & Search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Danh Sách Thẻ Không Gian Hãng</span>
              <span style={{ fontSize: 12, background: 'var(--primary-glow)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>
                {filteredCarriers.length} Hãng
              </span>
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '3px 0 0' }}>
              Bấm chọn một hãng để bắt đầu phiên làm việc đối soát, tính cước hoặc xuất báo cáo công nợ.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search input */}
            <div style={{ position: 'relative', width: 240 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Tìm hãng vận chuyển..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ paddingLeft: 34, fontSize: 12.5, borderRadius: 10 }}
              />
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 800,
                  fontSize: 12.5,
                  padding: '8px 16px',
                  borderRadius: 10,
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <Plus size={16} />
                <span>Thêm Hãng Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* CARRIER CARDS GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 20,
        }}>
          {filteredCarriers.map(carrier => {
            const theme = CARRIER_THEMES[carrier.carrierId] || DEFAULT_THEME;
            const stats = carrierStats.get(carrier.carrierId) || { shopCount: 0, sessionCount: 0, orderCount: 0, totalCod: 0, totalProfit: 0, lastSessionDate: undefined };
            
            // Format weight tiers summary
            const weightTiersSummary = carrier.weightRules && carrier.weightRules.length > 0
              ? carrier.weightRules.map(r => `${r.minWeight}-${r.maxWeight}kg: ${r.price.toLocaleString('vi-VN')}đ`).join(' • ')
              : 'Chưa cấu hình biểu cước';

            return (
              <div
                key={carrier.id}
                onClick={() => onSelectCarrier(carrier.carrierId)}
                style={{
                  background: '#ffffff',
                  borderRadius: 20,
                  border: `1.5px solid ${theme.border}`,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 30px -4px rgba(79, 70, 229, 0.15)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.borderColor = theme.border;
                }}
              >
                {/* Top subtle gradient decoration bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 6,
                  background: theme.bgGradient,
                }} />

                {/* Card Header */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        background: theme.bgGradient,
                        border: `1.5px solid ${theme.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.accentColor,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}>
                        <Truck size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                          {carrier.carrierName}
                        </h3>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>
                          MÃ HÃNG: <strong style={{ color: theme.accentColor }}>{carrier.carrierId.toUpperCase()}</strong>
                        </div>
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
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    marginTop: 16,
                    background: 'var(--bg-secondary)',
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Store size={12} />
                        <span>Shop:</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
                        {stats.shopCount} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-dim)' }}>shop</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <FileSpreadsheet size={12} />
                        <span>Kỳ ĐS:</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                        {stats.sessionCount} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-dim)' }}>kỳ</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Package size={12} />
                        <span>Tổng đơn:</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
                        {stats.orderCount.toLocaleString('vi-VN')} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-dim)' }}>đơn</span>
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 3', borderTop: '1px solid var(--border-color)', paddingTop: 8, marginTop: 2 }}>
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
              onClick={handleOpenAddModal}
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

      {/* 🚀 MODAL: TẠO THẺ HÃNG VẬN CHUYỂN MỚI WITH FULL STEPPED PRICING TABLE */}
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
            maxWidth: 640,
            maxHeight: '92vh',
            overflowY: 'auto',
            borderRadius: 20,
            padding: 26,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            background: '#ffffff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Truck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Thêm Đơn Vị Vận Chuyển Mới</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khởi tạo thẻ và thiết lập biểu cước bậc thang gốc</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddCarrierModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-dim)' }}
              >
                ✕
              </button>
            </div>

            {/* Basic Carrier Name & Code Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Tên Đơn vị vận chuyển <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Ninja Van, Best Express..."
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
                  placeholder="Ví dụ: ninja, best, ems"
                  value={newCarrierCode}
                  onChange={(e) => setNewCarrierCode(e.target.value)}
                  className="input-field"
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>

            {/* Full Stepped Pricing Table (Matching Bảng Giá Cước Gốc) */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 16,
              padding: 18,
            }}>
              {/* Carrier mini header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Truck size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        {newCarrierName.trim() || 'Tên Hãng Vận Chuyển'}
                      </h4>
                      <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                        ✓ Đang thiết lập
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, display: 'inline-block' }}>
                      Mã sỉ: {(newCarrierCode.trim() || 'NEW').toUpperCase()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddModalRule}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Thêm nấc cân nặng mới"
                >
                  <Plus size={13} />
                  <span>Nấc</span>
                </button>
              </div>

              {/* Stepped rules table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '64px 16px 74px 30px 1fr 20px 32px', gap: 6, alignItems: 'center', paddingBottom: 4, borderBottom: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>Từ (kg)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>→</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>Đến (kg)</div>
                  <div />
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>Giá cước NVC (VNĐ)</div>
                  <div />
                  <div />
                </div>

                {newCarrierWeightRules.map((rule, rIdx) => (
                  <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: '64px 16px 74px 30px 1fr 20px 32px', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rule.minWeight}
                      onChange={(e) => handleModalRuleChange(rIdx, 'minWeight', parseFloat(e.target.value) || 0)}
                      className="input-field"
                      style={{ padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>→</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rule.maxWeight}
                      onChange={(e) => handleModalRuleChange(rIdx, 'maxWeight', parseFloat(e.target.value) || 0.5)}
                      className="input-field"
                      style={{ padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>kg:</span>
                    <input
                      type="number"
                      step="500"
                      min="0"
                      value={rule.price === 0 ? '' : rule.price}
                      onChange={(e) => handleModalRuleChange(rIdx, 'price', parseInt(e.target.value, 10) || 0)}
                      className="input-field"
                      style={{ padding: '5px 8px', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>đ</span>

                    {newCarrierWeightRules.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveModalRule(rIdx)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Xóa nấc này"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : <div />}
                  </div>
                ))}
              </div>

              {/* Extra step weight / price & Return fee */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span>Mỗi thêm</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={newCarrierExtraStepWeight}
                    onChange={(e) => setNewCarrierExtraStepWeight(parseFloat(e.target.value) || 1)}
                    className="input-field"
                    style={{ width: 60, padding: '4px 6px', fontSize: 13, textAlign: 'center', fontWeight: 700 }}
                  />
                  <span>kg tiếp theo:</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 800 }}>+</span>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={newCarrierExtraStepPrice}
                    onChange={(e) => setNewCarrierExtraStepPrice(parseInt(e.target.value, 10) || 0)}
                    className="input-field"
                    style={{ width: 110, padding: '4px 8px', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}
                  />
                  <span>đ</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                  <span>Phí hoàn đơn:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newCarrierReturnFeePercent}
                    onChange={(e) => setNewCarrierReturnFeePercent(parseInt(e.target.value, 10) || 0)}
                    className="input-field"
                    style={{ width: 60, padding: '4px 6px', fontSize: 13, textAlign: 'center', fontWeight: 700 }}
                  />
                  <span>%</span>

                  <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                    <button
                      type="button"
                      onClick={() => setNewCarrierReturnFeePercent(0)}
                      className={`btn btn-sm ${newCarrierReturnFeePercent === 0 ? 'btn-success' : 'btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 700 }}
                    >
                      Miễn hoàn (0%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCarrierReturnFeePercent(50)}
                      className={`btn btn-sm ${newCarrierReturnFeePercent === 50 ? 'btn-warning' : 'btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 700 }}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCarrierReturnFeePercent(100)}
                      className={`btn btn-sm ${newCarrierReturnFeePercent === 100 ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: 11, fontWeight: 700 }}
                    >
                      100%
                    </button>
                  </div>
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
              marginTop: 4,
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
                style={{ fontWeight: 800, fontSize: 13, padding: '8px 22px' }}
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
