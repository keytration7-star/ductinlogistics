import React, { useState } from 'react';
import { Truck, Plus, Trash2, Check, X, CheckCircle2 } from 'lucide-react';
import type { CarrierWholesaleTier, WeightStepRule, UserAccount } from '../types';
import { ColumnMappingModal } from './ColumnMappingModal';
import { ExportColumnConfigModal } from './ExportColumnConfigModal';
import { StorageService } from '../services/storage';
import { useToast, useConfirm } from './UIFeedback';

export const getCarrierTheme = (carrierId: string = '', carrierName: string = '') => {
  const key = (carrierId + ' ' + carrierName).toLowerCase();
  if (key.includes('jnt') || key.includes('j&t')) {
    return {
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      accentColor: '#dc2626',
      cardBorder: 'rgba(239, 68, 68, 0.35)',
      cardBg: 'linear-gradient(180deg, #fff1f2 0%, #fee2e2 50%, #fff7f7 100%)',
      innerBoxBg: 'rgba(254, 226, 226, 0.55)',
      innerBoxBorder: '1px solid rgba(239, 68, 68, 0.22)',
      badgeBg: '#fee2e2',
      badgeText: '#b91c1c',
      shadowGlow: '0 6px 20px -3px rgba(220, 38, 38, 0.18)',
    };
  }
  if (key.includes('spx') || key.includes('shopee')) {
    return {
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      accentColor: '#ea580c',
      cardBorder: 'rgba(249, 115, 22, 0.35)',
      cardBg: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(255, 237, 213, 0.55)',
      innerBoxBorder: '1px solid rgba(249, 115, 22, 0.22)',
      badgeBg: '#ffedd5',
      badgeText: '#c2410c',
      shadowGlow: '0 6px 20px -3px rgba(234, 88, 12, 0.18)',
    };
  }
  if (key.includes('ghn') || key.includes('giao hang nhanh')) {
    return {
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      accentColor: '#0284c7',
      cardBorder: 'rgba(2, 132, 199, 0.35)',
      cardBg: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(224, 242, 254, 0.55)',
      innerBoxBorder: '1px solid rgba(2, 132, 199, 0.22)',
      badgeBg: '#e0f2fe',
      badgeText: '#0369a1',
      shadowGlow: '0 6px 20px -3px rgba(2, 132, 199, 0.18)',
    };
  }
  if (key.includes('ghtk') || key.includes('tiet kiem')) {
    return {
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      accentColor: '#059669',
      cardBorder: 'rgba(16, 185, 129, 0.35)',
      cardBg: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(220, 252, 231, 0.55)',
      innerBoxBorder: '1px solid rgba(16, 185, 129, 0.22)',
      badgeBg: '#d1fae5',
      badgeText: '#047857',
      shadowGlow: '0 6px 20px -3px rgba(16, 185, 129, 0.18)',
    };
  }
  if (key.includes('vtp') || key.includes('viettel')) {
    return {
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      accentColor: '#e11d48',
      cardBorder: 'rgba(244, 63, 94, 0.35)',
      cardBg: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(255, 228, 230, 0.55)',
      innerBoxBorder: '1px solid rgba(244, 63, 94, 0.22)',
      badgeBg: '#ffe4e6',
      badgeText: '#be123c',
      shadowGlow: '0 6px 20px -3px rgba(225, 29, 72, 0.18)',
    };
  }
  if (key.includes('ninja')) {
    return {
      gradient: 'linear-gradient(135deg, #be123c 0%, #9f1239 100%)',
      accentColor: '#be123c',
      cardBorder: 'rgba(190, 18, 60, 0.35)',
      cardBg: 'linear-gradient(180deg, #fff1f2 0%, #ffe4e6 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(255, 228, 230, 0.55)',
      innerBoxBorder: '1px solid rgba(190, 18, 60, 0.22)',
      badgeBg: '#ffe4e6',
      badgeText: '#9f1239',
      shadowGlow: '0 6px 20px -3px rgba(190, 18, 60, 0.18)',
    };
  }
  if (key.includes('best')) {
    return {
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      accentColor: '#0284c7',
      cardBorder: 'rgba(2, 132, 199, 0.35)',
      cardBg: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(224, 242, 254, 0.55)',
      innerBoxBorder: '1px solid rgba(2, 132, 199, 0.22)',
      badgeBg: '#e0f2fe',
      badgeText: '#0369a1',
      shadowGlow: '0 6px 20px -3px rgba(2, 132, 199, 0.18)',
    };
  }
  if (key.includes('vnpost') || key.includes('ems')) {
    return {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      accentColor: '#d97706',
      cardBorder: 'rgba(245, 158, 11, 0.35)',
      cardBg: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 50%, #ffffff 100%)',
      innerBoxBg: 'rgba(254, 243, 199, 0.55)',
      innerBoxBorder: '1px solid rgba(245, 158, 11, 0.22)',
      badgeBg: '#fef3c7',
      badgeText: '#b45309',
      shadowGlow: '0 6px 20px -3px rgba(217, 119, 6, 0.18)',
    };
  }
  return {
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    accentColor: '#4f46e5',
    cardBorder: 'rgba(79, 70, 229, 0.3)',
    cardBg: 'linear-gradient(180deg, #f5f3ff 0%, #ede9fe 50%, #ffffff 100%)',
    innerBoxBg: 'rgba(237, 233, 254, 0.55)',
    innerBoxBorder: '1px solid rgba(79, 70, 229, 0.22)',
    badgeBg: '#e0e7ff',
    badgeText: '#4338ca',
    shadowGlow: '0 6px 20px -3px rgba(79, 70, 229, 0.18)',
  };
};

interface CarriersPricingViewProps {
  carriers: CarrierWholesaleTier[];
  onSaveCarriers: (carriers: CarrierWholesaleTier[]) => void;
  currentUser: UserAccount;
  activeCarrierId?: string;
}

export const CarriersPricingView: React.FC<CarriersPricingViewProps> = ({ carriers, onSaveCarriers, currentUser, activeCarrierId }) => {
  const { showToast: uiToast } = useToast();
  const { showConfirm } = useConfirm();
  const [carrierList, setCarrierList] = useState<CarrierWholesaleTier[]>(carriers);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Vừa xong');

  // Carrier Profile Mapping / Export Modals
  const [mappingCarrier, setMappingCarrier] = useState<CarrierWholesaleTier | null>(null);
  const [exportCarrier, setExportCarrier] = useState<CarrierWholesaleTier | null>(null);

  // New Carrier form state
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCode, setNewCarrierCode] = useState('');
  const isAdmin = currentUser.role === 'ADMIN';
  const requireAdmin = () => {
    if (isAdmin) return true;
    uiToast('Chỉ Admin được phép thay đổi bảng giá NVC vì dữ liệu này ảnh hưởng trực tiếp đến đối soát.', 'warning');
    return false;
  };

  // Sync state if props change
  React.useEffect(() => {
    setCarrierList(carriers);
  }, [carriers]);

  const activeCarrierTier = carriers.find(c => c.carrierId === activeCarrierId || c.id === activeCarrierId);
  const displayedCarriers = activeCarrierId 
    ? carrierList.filter(c => c.carrierId === activeCarrierId || c.id === activeCarrierId)
    : carrierList;

  const handleWeightRuleChange = (
    carrierIdx: number,
    ruleIdx: number,
    field: keyof WeightStepRule,
    val: number
  ) => {
    if (!requireAdmin()) return;
    const updated = [...carrierList];
    updated[carrierIdx].weightRules[ruleIdx] = {
      ...updated[carrierIdx].weightRules[ruleIdx],
      [field]: val,
    };
    setCarrierList(updated);
    // Auto-save silently to localStorage & server
    onSaveCarriers(updated);
    triggerSaveToast();
  };

  const handleAddRule = (carrierIdx: number) => {
    if (!requireAdmin()) return;
    const updated = [...carrierList];
    const rules = updated[carrierIdx].weightRules;
    const lastRule = rules[rules.length - 1];
    // Auto-suggest minWeight = previous maxWeight + 0.1, maxWeight = next round number
    const minWeight = lastRule ? Math.round((lastRule.maxWeight + 0.1) * 10) / 10 : 0;
    const maxWeight = lastRule ? Math.ceil(minWeight) : 1;
    const price = lastRule ? lastRule.price + 5000 : 20000;

    updated[carrierIdx].weightRules.push({ minWeight, maxWeight, price });
    setCarrierList(updated);
    onSaveCarriers(updated);
    triggerSaveToast();
  };

  const handleRemoveRule = (carrierIdx: number, ruleIdx: number) => {
    if (!requireAdmin()) return;
    const updated = [...carrierList];
    if (updated[carrierIdx].weightRules.length <= 1) return;
    updated[carrierIdx].weightRules = updated[carrierIdx].weightRules.filter((_, idx) => idx !== ruleIdx);
    setCarrierList(updated);
    onSaveCarriers(updated);
    triggerSaveToast();
  };

  // Update extra step weight / price / return fee
  const handleCarrierFieldChange = (
    carrierIdx: number,
    field: 'extraStepWeight' | 'extraStepPrice' | 'returnFeePercent',
    val: number
  ) => {
    if (!requireAdmin()) return;
    const updated = [...carrierList];
    updated[carrierIdx] = {
      ...updated[carrierIdx],
      [field]: val,
    };
    setCarrierList(updated);
    // Auto-save silently to localStorage & server
    onSaveCarriers(updated);
    triggerSaveToast();
  };

  // Trigger Save Toast
  const triggerSaveToast = () => {
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSavedTime(timeStr);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  // Delete Carrier
  const handleDeleteCarrier = async (carrierId: string, carrierName: string) => {
    if (!requireAdmin()) return;
    const ok = await showConfirm({
      title: 'Xoá Hãng Vận Chuyển',
      message: `Bạn có chắc muốn xóa tạm thời đơn vị vận chuyển "${carrierName}"? Bạn có thể thêm lại bất cứ lúc nào.`,
      confirmText: 'Xoá',
      warning: true,
    });
    if (ok) {
      const updated = carrierList.filter(c => c.id !== carrierId && c.carrierId !== carrierId);
      setCarrierList(updated);
      onSaveCarriers(updated);
      triggerSaveToast();
    }
  };

  // Add New Carrier
  const handleAddNewCarrier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAdmin()) return;
    if (!newCarrierName.trim()) {
      uiToast('Vui lòng nhập tên đơn vị vận chuyển', 'warning');
      return;
    }

    const code = (newCarrierCode.trim() || newCarrierName.trim().slice(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const id = `carrier_${Date.now()}`;

    const newCarrier: CarrierWholesaleTier = {
      id,
      carrierId: code.toLowerCase(),
      carrierName: newCarrierName.trim(),
      weightRules: [
        { minWeight: 0, maxWeight: 1, price: 20000 },
        { minWeight: 1, maxWeight: 3, price: 25000 },
        { minWeight: 3, maxWeight: 5, price: 30000 },
      ],
      extraStepWeight: 1,
      extraStepPrice: 5000,
      returnFeePercent: 0, // default 0% (free return)
    };

    const updated = [...carrierList, newCarrier];
    setCarrierList(updated);
    onSaveCarriers(updated);
    setIsAddModalOpen(false);
    setNewCarrierName('');
    setNewCarrierCode('');
    triggerSaveToast();
  };

  const handleSaveAll = () => {
    if (!requireAdmin()) return;
    onSaveCarriers(carrierList);
    triggerSaveToast();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
      
      {/* Toast Notification on Save */}
      {showSaveToast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 32,
          zIndex: 9999,
          background: 'var(--success)',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'fadeIn 0.2s ease-out',
          fontWeight: 700,
          fontSize: 14,
        }}>
          <CheckCircle2 size={20} />
          <span>✓ ĐÃ LƯU THÀNH CÔNG VÀO HỆ THỐNG ({lastSavedTime})!</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>
            {activeCarrierTier ? `Bảng Giá Cước Gốc Ký Với ${activeCarrierTier.carrierName}` : 'Bảng Giá Cước Gốc Ký Với Đơn Vị Vận Chuyển (NVC)'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {activeCarrierTier 
              ? `Cấu hình biểu cước bậc thang và chiết khấu cước gốc áp dụng cho hãng ${activeCarrierTier.carrierName}.`
              : 'Bảng giá là nguồn cấu hình tài chính. Chỉ Admin được phép cập nhật và mọi thay đổi được lưu để dùng cho các kỳ đối soát tiếp theo.'}
          </p>
          {!isAdmin && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--warning)', fontWeight: 700 }}>
              Chế độ xem: bạn không thể sửa bảng giá hoặc cấu hình hãng.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!activeCarrierId && (
            <button onClick={() => setIsAddModalOpen(true)} className="btn btn-secondary" disabled={!isAdmin} title={!isAdmin ? 'Chỉ Admin được thêm hãng vận chuyển' : undefined}>
              <Plus size={16} />
              <span>Thêm Hãng Vận Chuyển Mới</span>
            </button>
          )}

          <button 
            onClick={handleSaveAll} 
            className="btn" 
            style={{ 
              minWidth: 190,
              background: activeCarrierTier ? getCarrierTheme(activeCarrierTier.carrierId, activeCarrierTier.carrierName).gradient : 'var(--primary)',
              color: '#ffffff',
              boxShadow: activeCarrierTier ? getCarrierTheme(activeCarrierTier.carrierId, activeCarrierTier.carrierName).shadowGlow : 'var(--shadow-sm)',
              fontWeight: 700,
            }} 
            disabled={!isAdmin} 
            title={!isAdmin ? 'Chỉ Admin được lưu thay đổi bảng giá' : undefined}
          >
            <Check size={16} />
            <span>{showSaveToast ? '✓ Đã Lưu Xong!' : 'Lưu Thay Đổi Bảng Giá'}</span>
          </button>
        </div>
      </div>

      {displayedCarriers.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <Truck size={48} color="var(--text-dim)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Chưa có biểu giá cho đơn vị vận chuyển này</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Bấm nút bên dưới để cấu hình biểu giá cho hãng.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 520px))',
          gap: 20,
          alignItems: 'start',
          pointerEvents: isAdmin ? 'auto' : 'none',
          opacity: isAdmin ? 1 : 0.72,
        }}>
          {displayedCarriers.map((carrier) => {
            const cIdx = carrierList.findIndex(c => c.id === carrier.id);
            const theme = getCarrierTheme(carrier.carrierId, carrier.carrierName);
            return (
            <div 
              key={carrier.id} 
              className="card-3d" 
              style={{ 
                padding: 24, 
                position: 'relative',
                borderRadius: 16,
                maxWidth: 540,
                border: `1.5px solid ${theme.cardBorder}`,
                background: theme.cardBg,
                boxShadow: `0 4px 18px -2px rgba(15, 23, 42, 0.06), ${theme.shadowGlow}`,
              }}
            >
              {/* Top Carrier Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: theme.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: theme.shadowGlow,
                  }}>
                    <Truck size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>{carrier.carrierName}</h3>
                      <span className="badge" style={{ fontSize: 10, padding: '2px 7px', background: theme.badgeBg, color: theme.badgeText, fontWeight: 700, border: `1px solid ${theme.cardBorder}` }}>
                        ✓ Đang áp dụng
                      </span>
                    </div>
                    <span className="badge" style={{ fontSize: 10, marginTop: 2, background: 'rgba(255, 255, 255, 0.85)', color: theme.accentColor, border: `1px solid ${theme.cardBorder}`, fontWeight: 700 }}>
                      Mã sỉ: {carrier.carrierId.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleAddRule(cIdx)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    title="Thêm nấc cân nặng mới"
                  >
                    <Plus size={13} />
                    <span>Nấc</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCarrier(carrier.id, carrier.carrierName)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 8px' }}
                    title="Xóa tạm thời hãng vận chuyển này"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Weight Rules List - Full editable min & max weight */}
              <div style={{ marginBottom: 16 }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '60px 16px 70px 30px 1fr 20px 32px', gap: 6, alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>Từ (kg)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>→</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>Đến (kg)</div>
                  <div />
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>Giá cước NVC (VNĐ)</div>
                  <div />
                  <div />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {carrier.weightRules.map((rule, rIdx) => (
                    <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: '60px 16px 70px 30px 1fr 20px 32px', gap: 6, alignItems: 'center' }}>
                      {/* Min weight */}
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={rule.minWeight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleWeightRuleChange(cIdx, rIdx, 'minWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0)}
                        className="input-field"
                        style={{ padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>→</span>
                      {/* Max weight */}
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={rule.maxWeight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleWeightRuleChange(cIdx, rIdx, 'maxWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0.5)}
                        className="input-field"
                        style={{ padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>kg:</span>
                      {/* Price */}
                      <input
                        type="number"
                        step="500"
                        min="0"
                        placeholder="0"
                        value={rule.price === 0 ? '' : rule.price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleWeightRuleChange(cIdx, rIdx, 'price', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                        className="input-field mono"
                        style={{ padding: '5px 8px', fontSize: 13, fontWeight: 750, color: theme.accentColor }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>đ</span>

                      {carrier.weightRules.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(cIdx, rIdx)}
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
              </div>

              {/* Dynamic Editable Extra Step & Return Fee Box */}
              <div style={{
                background: theme.innerBoxBg,
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: theme.innerBoxBorder,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {/* Excess kg step settings */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Mỗi thêm{' '}
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={carrier.extraStepWeight}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCarrierFieldChange(cIdx, 'extraStepWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 1)}
                      className="input-field"
                      style={{ width: 55, padding: '3px 6px', fontSize: 12, display: 'inline-block', margin: '0 4px' }}
                    />
                    kg tiếp theo:
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: theme.accentColor }}>+</span>
                    <input
                      type="number"
                      step="500"
                      min="0"
                      placeholder="0"
                      value={carrier.extraStepPrice === 0 ? '' : carrier.extraStepPrice}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCarrierFieldChange(cIdx, 'extraStepPrice', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                      className="input-field mono"
                      style={{ width: 85, padding: '3px 6px', fontSize: 12, fontWeight: 700, color: theme.accentColor }}
                    />
                    <span style={{ fontSize: 12 }}>đ</span>
                  </div>
                </div>

                {/* Return fee % settings */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phí hoàn đơn:</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={carrier.returnFeePercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleCarrierFieldChange(cIdx, 'returnFeePercent', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                      className="input-field"
                      style={{ width: 60, padding: '3px 6px', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>

                  {/* Quick Preset Buttons for Return Fee */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => handleCarrierFieldChange(cIdx, 'returnFeePercent', 0)}
                      className={`btn btn-sm ${carrier.returnFeePercent === 0 ? 'btn-success' : 'btn-secondary'}`}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      Miễn hoàn (0%)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCarrierFieldChange(cIdx, 'returnFeePercent', 50)}
                      className={`btn btn-sm ${carrier.returnFeePercent === 50 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      50%
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCarrierFieldChange(cIdx, 'returnFeePercent', 100)}
                      className={`btn btn-sm ${carrier.returnFeePercent === 100 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      100%
                    </button>
                  </div>
                </div>



              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Carrier Specific Column Mapping Modal */}
      {mappingCarrier && (
        <ColumnMappingModal
          isOpen={!!mappingCarrier}
          onClose={() => setMappingCarrier(null)}
          nvcHeaders={[]}
          appHeaders={[]}
          nvcMapping={StorageService.getCarrierMapping(mappingCarrier.carrierId).nvc || { waybillColumn: '' }}
          appMapping={StorageService.getCarrierMapping(mappingCarrier.carrierId).app || { waybillColumn: '' }}
          carrierId={mappingCarrier.carrierId}
          carrierName={mappingCarrier.carrierName}
          onSaveMappings={(nvc, app) => {
            StorageService.saveCarrierMapping(mappingCarrier.carrierId, nvc, app);
            triggerSaveToast();
          }}
        />
      )}

      {/* Carrier Specific Export Columns Modal */}
      {exportCarrier && (
        <ExportColumnConfigModal
          isOpen={!!exportCarrier}
          onClose={() => setExportCarrier(null)}
          carrierId={exportCarrier.carrierId}
          carrierName={exportCarrier.carrierName}
          onSave={() => {
            triggerSaveToast();
          }}
        />
      )}

      {/* Modal Add New Carrier */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 550 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleAddNewCarrier}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Truck size={20} color="var(--primary)" />
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>Thêm Đơn Vị Vận Chuyển Mới</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 6px' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Tên Đơn Vị Vận Chuyển (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Giao Hàng Tiết Kiệm (GHTK), Viettel Post..."
                    value={newCarrierName}
                    onChange={(e) => setNewCarrierName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Mã viết tắt / Mã sỉ</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: GHTK, GHN, VTP, JNT, SPX, BEST..."
                    value={newCarrierCode}
                    onChange={(e) => setNewCarrierCode(e.target.value.toUpperCase())}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                background: 'var(--bg-tertiary)',
              }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>Thêm Hãng Này</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
