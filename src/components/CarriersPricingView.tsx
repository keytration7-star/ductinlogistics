import React, { useState } from 'react';
import { Truck, Plus, Trash2, Check, X, CheckCircle2 } from 'lucide-react';
import type { CarrierWholesaleTier, WeightStepRule } from '../types';
import { ColumnMappingModal } from './ColumnMappingModal';
import { ExportColumnConfigModal } from './ExportColumnConfigModal';
import { StorageService } from '../services/storage';
import { useToast, useConfirm } from './UIFeedback';

interface CarriersPricingViewProps {
  carriers: CarrierWholesaleTier[];
  onSaveCarriers: (carriers: CarrierWholesaleTier[]) => void;
}

export const CarriersPricingView: React.FC<CarriersPricingViewProps> = ({ carriers, onSaveCarriers }) => {
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

  // Sync state if props change
  React.useEffect(() => {
    setCarrierList(carriers);
  }, [carriers]);

  const handleWeightRuleChange = (
    carrierIdx: number,
    ruleIdx: number,
    field: keyof WeightStepRule,
    val: number
  ) => {
    const updated = [...carrierList];
    updated[carrierIdx].weightRules[ruleIdx] = {
      ...updated[carrierIdx].weightRules[ruleIdx],
      [field]: val,
    };
    setCarrierList(updated);
    // Auto-save silently to localStorage
    onSaveCarriers(updated);
  };

  const handleAddRule = (carrierIdx: number) => {
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
    const updated = [...carrierList];
    updated[carrierIdx] = {
      ...updated[carrierIdx],
      [field]: val,
    };
    setCarrierList(updated);
    // Auto-save silently to localStorage
    onSaveCarriers(updated);
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
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Bảng Giá Cước Gốc Ký Với Đơn Vị Vận Chuyển (NVC)</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Mọi thay đổi sẽ <strong>tự động lưu ngay lập tức</strong> vào bộ nhớ máy tính. Bạn cũng có thể bấm nút Lưu bên phải.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setIsAddModalOpen(true)} className="btn btn-secondary">
            <Plus size={16} />
            <span>Thêm Hãng Vận Chuyển Mới</span>
          </button>

          <button onClick={handleSaveAll} className="btn btn-primary" style={{ minWidth: 190 }}>
            <Check size={16} />
            <span>{showSaveToast ? '✓ Đã Lưu Xong!' : 'Lưu Thay Đổi Bảng Giá'}</span>
          </button>
        </div>
      </div>

      {carrierList.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <Truck size={48} color="var(--text-dim)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Chưa có đơn vị vận chuyển nào</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Bấm nút "Thêm Hãng Vận Chuyển Mới" để tạo đơn vị vận chuyển bạn đang sử dụng.
          </p>
          <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Thêm Đơn Vị Vận Chuyển</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 520px))',
          gap: 20,
          alignItems: 'start',
        }}>
          {carrierList.map((carrier, cIdx) => (
            <div 
              key={carrier.id} 
              className="card-3d" 
              style={{ 
                padding: 24, 
                position: 'relative',
                borderRadius: 16,
                maxWidth: 540,
              }}
            >
              {/* Top Carrier Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--brand-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}>
                    <Truck size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>{carrier.carrierName}</h3>
                      <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px' }}>
                        ✓ Đang áp dụng
                      </span>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: 10, marginTop: 2 }}>
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
                        onChange={(e) => handleWeightRuleChange(cIdx, rIdx, 'minWeight', parseFloat(e.target.value) ?? 0)}
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
                        onChange={(e) => handleWeightRuleChange(cIdx, rIdx, 'maxWeight', parseFloat(e.target.value) || 0.5)}
                        className="input-field"
                        style={{ padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>kg:</span>
                      {/* Price */}
                      <input
                        type="number"
                        step="500"
                        min="0"
                        value={rule.price}
                        onChange={(e) => handleWeightRuleChange(cIdx, rIdx, 'price', parseInt(e.target.value) || 0)}
                        className="input-field"
                        style={{ padding: '5px 8px', fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}
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
                background: 'var(--bg-primary)',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
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
                      onChange={(e) => handleCarrierFieldChange(cIdx, 'extraStepWeight', parseFloat(e.target.value) || 1)}
                      className="input-field"
                      style={{ width: 55, padding: '3px 6px', fontSize: 12, display: 'inline-block', margin: '0 4px' }}
                    />
                    kg tiếp theo:
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>+</span>
                    <input
                      type="number"
                      step="500"
                      min="0"
                      value={carrier.extraStepPrice}
                      onChange={(e) => handleCarrierFieldChange(cIdx, 'extraStepPrice', parseInt(e.target.value) || 0)}
                      className="input-field"
                      style={{ width: 85, padding: '3px 6px', fontSize: 12 }}
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
                      onChange={(e) => handleCarrierFieldChange(cIdx, 'returnFeePercent', parseInt(e.target.value) || 0)}
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
          ))}
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
