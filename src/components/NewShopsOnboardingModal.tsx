import React, { useState } from 'react';
import { Store, Plus, Trash2, Check, AlertCircle, Sparkles, CreditCard, Sliders, X, Mail } from 'lucide-react';
import type { Shop, WeightStepRule } from '../types';

import { useToast } from './UIFeedback';

interface DiscoveredNewShop {
  tempId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  orderCount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  weightRules: WeightStepRule[];
  extraStepWeight: number;
  extraStepPrice: number;
  returnFeePercent: number;
}

interface NewShopsOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredShops: { name: string; phone: string; address: string; orderCount: number }[];
  existingShops: Shop[];
  onSaveNewShopsAndContinue: (newShops: Shop[]) => void;
}

import { VIETNAM_BANKS as FULL_VIETNAM_BANKS } from '../constants/banks';

const VIETNAM_BANKS = FULL_VIETNAM_BANKS.map(b => b.shortName);

export const NewShopsOnboardingModal: React.FC<NewShopsOnboardingModalProps> = ({
  isOpen,
  onClose,
  discoveredShops,
  existingShops,
  onSaveNewShopsAndContinue,
}) => {
  const { showToast } = useToast();
  const [shopList, setShopList] = useState<DiscoveredNewShop[]>(() => {
    return discoveredShops.map((d, idx) => ({
      tempId: `new_shop_${idx}_${Date.now()}`,
      name: d.name || `Shop Mới ${idx + 1}`,
      phone: d.phone || '',
      email: (d as any).email || '',
      address: d.address || '',
      orderCount: d.orderCount,
      bankName: 'MB Bank',
      accountNumber: '',
      accountHolder: d.name ? d.name.toUpperCase() : '',
      weightRules: [
        { minWeight: 0, maxWeight: 1, price: 25000 },
        { minWeight: 1, maxWeight: 3, price: 30000 },
        { minWeight: 3, maxWeight: 5, price: 35000 },
      ],
      extraStepWeight: 1,
      extraStepPrice: 5000,
      returnFeePercent: 0,
    }));
  });

  const [activeShopIndex, setActiveShopIndex] = useState(0);

  if (!isOpen || shopList.length === 0) return null;

  const currentShop = shopList[activeShopIndex] || shopList[0];

  const handleUpdateCurrentShop = (field: keyof DiscoveredNewShop, val: any) => {
    const updated = [...shopList];
    updated[activeShopIndex] = {
      ...updated[activeShopIndex],
      [field]: val,
    };
    setShopList(updated);
  };

  const handleWeightRuleChange = (ruleIdx: number, field: keyof WeightStepRule, val: number) => {
    const updated = [...shopList];
    const rules = [...updated[activeShopIndex].weightRules];
    rules[ruleIdx] = { ...rules[ruleIdx], [field]: val };
    updated[activeShopIndex].weightRules = rules;
    setShopList(updated);
  };

  const handleAddWeightRule = () => {
    const updated = [...shopList];
    const rules = updated[activeShopIndex].weightRules;
    const lastRule = rules[rules.length - 1];
    const newMin = lastRule ? Math.round((lastRule.maxWeight + 0.1) * 10) / 10 : 0;
    const newMax = lastRule ? Math.ceil(newMin) : 1;
    const newPrice = lastRule ? lastRule.price + 5000 : 25000;

    updated[activeShopIndex].weightRules = [
      ...rules,
      { minWeight: newMin, maxWeight: newMax, price: newPrice }
    ];
    setShopList(updated);
  };

  const handleRemoveWeightRule = (ruleIdx: number) => {
    const updated = [...shopList];
    const rules = updated[activeShopIndex].weightRules;
    if (rules.length <= 1) {
      showToast('Cần giữ lại ít nhất 1 bậc cước!', 'warning');
      return;
    }
    updated[activeShopIndex].weightRules = rules.filter((_, idx) => idx !== ruleIdx);
    setShopList(updated);
  };

  const applyPresetPrice = (presetType: 'standard' | 'vip' | 'super_vip') => {
    const updated = [...shopList];
    if (presetType === 'standard') {
      updated[activeShopIndex].weightRules = [
        { minWeight: 0, maxWeight: 1, price: 25000 },
        { minWeight: 1, maxWeight: 3, price: 30000 },
        { minWeight: 3, maxWeight: 5, price: 35000 },
      ];
      updated[activeShopIndex].extraStepPrice = 6000;
    } else if (presetType === 'vip') {
      updated[activeShopIndex].weightRules = [
        { minWeight: 0, maxWeight: 1, price: 23000 },
        { minWeight: 1, maxWeight: 3, price: 28000 },
        { minWeight: 3, maxWeight: 5, price: 33000 },
      ];
      updated[activeShopIndex].extraStepPrice = 5500;
    } else if (presetType === 'super_vip') {
      updated[activeShopIndex].weightRules = [
        { minWeight: 0, maxWeight: 1, price: 22000 },
        { minWeight: 1, maxWeight: 3, price: 27000 },
        { minWeight: 3, maxWeight: 5, price: 32000 },
      ];
      updated[activeShopIndex].extraStepPrice = 5000;
    }
    setShopList(updated);
  };

  // Apply current shop's pricing plan to all remaining new shops in one click
  const handleApplyPricingToAll = () => {
    const currentRules = currentShop.weightRules;
    const currentStepWeight = currentShop.extraStepWeight;
    const currentStepPrice = currentShop.extraStepPrice;
    const currentReturnFee = currentShop.returnFeePercent;

    const updated = shopList.map(s => ({
      ...s,
      weightRules: JSON.parse(JSON.stringify(currentRules)),
      extraStepWeight: currentStepWeight,
      extraStepPrice: currentStepPrice,
      returnFeePercent: currentReturnFee,
    }));
    setShopList(updated);
    showToast('Đã sao chép biểu giá này áp dụng cho toàn bộ các Shop mới còn lại!', 'success');
  };

  const handleSaveAndContinue = () => {
    const formattedNewShops: Shop[] = shopList.map((item, idx) => {
      const code = `SHOP_${existingShops.length + idx + 1}`;
      return {
        id: `shop_${Date.now()}_${idx}`,
        code,
        name: item.name.trim() || `Shop ${code}`,
        phone: item.phone.trim(),
        email: '',
        address: item.address.trim(),
        bankAccount: {
          bankName: item.bankName || 'MB Bank',
          accountNumber: item.accountNumber.trim(),
          accountHolder: item.accountHolder.trim() || item.name.toUpperCase(),
        },
        pricingPlan: {
          id: `plan_${Date.now()}_${idx}`,
          name: `Bảng giá ${item.name}`,
          weightRules: item.weightRules,
          extraStepWeight: item.extraStepWeight,
          extraStepPrice: item.extraStepPrice,
          returnFeePercent: item.returnFeePercent,
          insuranceFeePercent: 0,
          fixedSurcharge: 0,
        },
        notes: `Tự động tạo từ file đối soát (${item.orderCount} đơn)`,
        createdAt: new Date().toISOString(),
        active: true,
      };
    });

    onSaveNewShopsAndContinue(formattedNewShops);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 960 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                Phát Hiện {shopList.length} Khách Hàng (Shop) Mới Trong File Excel!
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Vui lòng điền nhanh mức cước và STK ngân hàng để hệ thống tính tiền và tự động thêm vào danh bạ Shop.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Left Tab List + Right Detail Editor */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 480 }}>
          
          {/* Left: New Shop Selector List */}
          <div style={{
            background: 'var(--bg-tertiary)',
            borderRight: '1px solid var(--border-color)',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 520,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6, padding: '0 6px' }}>
              Danh Sách Shop Mới ({shopList.length})
            </div>

            {shopList.map((shop, idx) => {
              const isActive = activeShopIndex === idx;
              return (
                <button
                  key={shop.tempId}
                  type="button"
                  onClick={() => setActiveShopIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shop.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {shop.phone || 'Chưa có SĐT'}
                    </div>
                  </div>

                  <span className="badge badge-neutral" style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}>
                    {shop.orderCount} đơn
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Quick Editor for Current Selected Shop */}
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 520, overflowY: 'auto' }}>
            
            {/* 1. Basic Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
                <Store size={16} /> 1. THÔNG TIN SHOP
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Tên Shop (*)</label>
                  <input
                    type="text"
                    value={currentShop.name}
                    onChange={(e) => handleUpdateCurrentShop('name', e.target.value)}
                    className="input-field"
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={currentShop.phone}
                    onChange={(e) => handleUpdateCurrentShop('phone', e.target.value)}
                    className="input-field"
                    style={{ padding: '8px 12px' }}
                    placeholder="0912..."
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={13} /> Email Nhận Bảng Kê
                  </label>
                  <input
                    type="email"
                    value={currentShop.email || ''}
                    onChange={(e) => handleUpdateCurrentShop('email', e.target.value)}
                    className="input-field"
                    style={{ padding: '8px 12px' }}
                    placeholder="shop@gmail.com"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginTop: 10, marginBottom: 0 }}>
                <label className="input-label">Địa Chỉ Kho Gửi Hàng</label>
                <input
                  type="text"
                  value={currentShop.address}
                  onChange={(e) => handleUpdateCurrentShop('address', e.target.value)}
                  className="input-field"
                  style={{ padding: '8px 12px' }}
                  placeholder="Địa chỉ kho gửi hàng..."
                />
              </div>
            </div>

            {/* 2. Bank Details */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
                <CreditCard size={16} /> 2. TÀI KHOẢN NHẬN TIỀN COD (VIETQR)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="input-label">Ngân Hàng</label>
                  <select
                    value={currentShop.bankName}
                    onChange={(e) => handleUpdateCurrentShop('bankName', e.target.value)}
                    className="select-field"
                    style={{ padding: '8px 10px', fontSize: 13 }}
                  >
                    {VIETNAM_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div>
                  <label className="input-label">Số Tài Khoản</label>
                  <input
                    type="text"
                    placeholder="091234567899"
                    value={currentShop.accountNumber}
                    onChange={(e) => handleUpdateCurrentShop('accountNumber', e.target.value)}
                    className="input-field"
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div>
                  <label className="input-label">Chủ Tài Khoản</label>
                  <input
                    type="text"
                    placeholder="NGUYEN VAN A"
                    value={currentShop.accountHolder}
                    onChange={(e) => handleUpdateCurrentShop('accountHolder', e.target.value.toUpperCase())}
                    className="input-field"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Pricing Plan Builder */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                  <Sliders size={16} /> 3. BIỂU GIÁ CƯỚC BẬC THANG RIÊNG THEO CÂN NẶNG
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => applyPresetPrice('standard')}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    Giá Chuẩn (25k-30k-35k)
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPresetPrice('vip')}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    Giá VIP (23k-28k-33k)
                  </button>

                  <button
                    type="button"
                    onClick={handleAddWeightRule}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    <Plus size={12} />
                    <span>Thêm Nấc</span>
                  </button>
                </div>
              </div>

              {/* Weight rules list - fully editable min & max */}
              <div style={{
                background: 'var(--bg-primary)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-color)', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>
                  <div style={{ width: 50, textAlign: 'center' }}>Từ (kg)</div>
                  <div style={{ fontSize: 10 }}>→</div>
                  <div style={{ width: 65, textAlign: 'center' }}>Đến (kg)</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>Giá (đ)</div>
                  <div style={{ width: 28 }} />
                </div>

                {currentShop.weightRules.map((rule, rIdx) => (
                  <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rule.minWeight}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightRuleChange(rIdx, 'minWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0)}
                      className="input-field"
                      style={{ width: 50, padding: '5px 6px', fontSize: 12, textAlign: 'center' }}
                      title="Từ (kg)"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>→</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rule.maxWeight}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightRuleChange(rIdx, 'maxWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0.5)}
                      className="input-field"
                      style={{ width: 65, padding: '5px 8px', fontSize: 12, textAlign: 'center' }}
                      title="Đến (kg)"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>kg:</span>
                    <input
                      type="number"
                      step="500"
                      min="0"
                      placeholder="0"
                      value={rule.price === 0 ? '' : rule.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightRuleChange(rIdx, 'price', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                      className="input-field"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>đ</span>

                    {currentShop.weightRules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWeightRule(rIdx)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 6px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Extra kg step and return fee */}
                <div style={{
                  marginTop: 6,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Vượt cân: +</span>
                    <input
                      type="number"
                      step="500"
                      placeholder="0"
                      value={currentShop.extraStepPrice === 0 ? '' : currentShop.extraStepPrice}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleUpdateCurrentShop('extraStepPrice', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                      className="input-field"
                      style={{ width: 70, padding: '3px 6px', fontSize: 12 }}
                    />
                    <span>đ / {currentShop.extraStepWeight}kg</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phí hoàn:</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={currentShop.returnFeePercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleUpdateCurrentShop('returnFeePercent', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                      className="input-field"
                      style={{ width: 50, padding: '3px 6px', fontSize: 12 }}
                    />
                    <span>%</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateCurrentShop('returnFeePercent', 0)}
                      className={`btn btn-sm ${currentShop.returnFeePercent === 0 ? 'btn-success' : 'btn-secondary'}`}
                      style={{ padding: '2px 6px', fontSize: 10 }}
                    >
                      Miễn hoàn (0%)
                    </button>
                  </div>
                </div>
              </div>

              {shopList.length > 1 && (
                <button
                  type="button"
                  onClick={handleApplyPricingToAll}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', marginTop: 8, fontSize: 11 }}
                >
                  ⚡ Áp dụng biểu giá của {currentShop.name} cho tất cả các Shop mới còn lại
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} color="var(--primary)" />
            <span>Các Shop này sẽ được tự động lưu vào danh bạ Shop chính thức của bạn.</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Để Sau
            </button>

            <button type="button" onClick={handleSaveAndContinue} className="btn btn-primary">
              <Check size={16} />
              <span>Lưu {shopList.length} Shop Mới & Tiếp Tục Đối Soát</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
