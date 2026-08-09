import React, { useState } from 'react';
import { SlidersHorizontal, Check, X, Plus, Trash2, RotateCcw, FileSpreadsheet, Layers, Sparkles, AlertCircle } from 'lucide-react';
import type { ColumnMappingConfig, CustomColumnMapping } from '../types';
import { autoDetectColumns } from '../services/smartColumnDetector';
import { StorageService } from '../services/storage';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  nvcHeaders: string[];
  appHeaders: string[];
  nvcMapping: ColumnMappingConfig;
  appMapping: ColumnMappingConfig;
  onSaveMappings: (nvcMapping: ColumnMappingConfig, appMapping: ColumnMappingConfig) => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  nvcHeaders,
  appHeaders,
  nvcMapping,
  appMapping,
  onSaveMappings,
}) => {
  const [activeTab, setActiveTab] = useState<'nvc' | 'app'>('nvc');
  const [localNvcMapping, setLocalNvcMapping] = useState<ColumnMappingConfig>(nvcMapping);
  const [localAppMapping, setLocalAppMapping] = useState<ColumnMappingConfig>(appMapping);

  // New Custom Column Form State
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomExcelCol, setNewCustomExcelCol] = useState('');

  if (!isOpen) return null;

  const updateNvcField = (field: keyof ColumnMappingConfig, val: string) => {
    setLocalNvcMapping(prev => ({ ...prev, [field]: val }));
  };

  const updateAppField = (field: keyof ColumnMappingConfig, val: string) => {
    setLocalAppMapping(prev => ({ ...prev, [field]: val }));
  };

  const handleAddCustomColumn = () => {
    if (!newCustomLabel.trim() || !newCustomExcelCol) {
      alert('Vui lòng nhập tên nhãn cột và chọn cột trong file Excel.');
      return;
    }

    const newCol: CustomColumnMapping = {
      id: `col_${Date.now()}`,
      label: newCustomLabel.trim(),
      excelColumn: newCustomExcelCol,
      fileType: activeTab,
    };

    if (activeTab === 'nvc') {
      const customs = localNvcMapping.customColumns || [];
      setLocalNvcMapping({
        ...localNvcMapping,
        customColumns: [...customs, newCol],
      });
    } else {
      const customs = localAppMapping.customColumns || [];
      setLocalAppMapping({
        ...localAppMapping,
        customColumns: [...customs, newCol],
      });
    }

    setNewCustomLabel('');
    setNewCustomExcelCol('');
  };

  const handleRemoveCustomColumn = (colId: string) => {
    if (activeTab === 'nvc') {
      const customs = (localNvcMapping.customColumns || []).filter(c => c.id !== colId);
      setLocalNvcMapping({ ...localNvcMapping, customColumns: customs });
    } else {
      const customs = (localAppMapping.customColumns || []).filter(c => c.id !== colId);
      setLocalAppMapping({ ...localAppMapping, customColumns: customs });
    }
  };

  const handleAutoRedetect = () => {
    if (confirm('Khôi phục tự động nhận diện thông minh cho cả 2 file?')) {
      const newNvc = autoDetectColumns(nvcHeaders, 'nvc');
      const newApp = autoDetectColumns(appHeaders, 'app');
      setLocalNvcMapping(newNvc);
      setLocalAppMapping(newApp);
    }
  };

  const handleSave = () => {
    if (!localNvcMapping.waybillColumn) {
      alert('Vui lòng chọn Cột Mã Vận Đơn cho File Đối Soát NVC.');
      setActiveTab('nvc');
      return;
    }
    if (!localAppMapping.waybillColumn) {
      alert('Vui lòng chọn Cột Mã Vận Đơn cho File Đơn Hàng App.');
      setActiveTab('app');
      return;
    }

    StorageService.saveColumnMappings(localNvcMapping, localAppMapping);
    onSaveMappings(localNvcMapping, localAppMapping);
    onClose();
  };

  const nvcCustoms = localNvcMapping.customColumns || [];
  const appCustoms = localAppMapping.customColumns || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 860 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
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
              <SlidersHorizontal size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                Cấu Hình Ánh Xạ Cột Excel Linh Hoạt (Smart Column Mapping)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Tùy chỉnh liên kết cột dữ liệu và thêm bất kỳ cột mở rộng nào từ file Excel của bạn.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          padding: '0 20px',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('nvc')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              color: activeTab === 'nvc' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'nvc' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileSpreadsheet size={16} />
            <span>1. File Đối Soát Từ NVC ({nvcHeaders.length} cột đã đọc)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('app')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              color: activeTab === 'app' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'app' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Layers size={16} />
            <span>2. File Đơn Hàng Xuất Từ App ({appHeaders.length} cột đã đọc)</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: 24, maxHeight: 480, overflowY: 'auto' }}>
          
          {/* Quick redetect & info banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            background: 'var(--bg-secondary)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} color="var(--primary)" />
              <span>Hệ thống đã tự động quét và gợi ý các cột phù hợp nhất.</span>
            </div>

            <button
              type="button"
              onClick={handleAutoRedetect}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              <RotateCcw size={12} />
              <span>Tự Động Quét Lại</span>
            </button>
          </div>

          {/* TAB 1: FILE NVC */}
          {activeTab === 'nvc' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                DANH MỤC CÁC TRƯỜNG LOGISTICS CHÍNH:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Mã Vận Đơn (*)</label>
                  <select
                    value={localNvcMapping.waybillColumn || ''}
                    onChange={(e) => updateNvcField('waybillColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Chọn cột --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Tiền COD Thu Hộ</label>
                  <select
                    value={localNvcMapping.codColumn || ''}
                    onChange={(e) => updateNvcField('codColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Cước Chính NVC</label>
                  <select
                    value={localNvcMapping.feeColumn || ''}
                    onChange={(e) => updateNvcField('feeColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Phụ Phí / Hoàn / Bảo Hiểm NVC</label>
                  <select
                    value={localNvcMapping.otherFeeColumn || ''}
                    onChange={(e) => updateNvcField('otherFeeColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Khối Lượng / Cân Nặng (kg hoặc gram)</label>
                  <select
                    value={localNvcMapping.weightColumn || ''}
                    onChange={(e) => updateNvcField('weightColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Trạng Thái Giao Hàng</label>
                  <select
                    value={localNvcMapping.statusColumn || ''}
                    onChange={(e) => updateNvcField('statusColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Ngày Gửi / Ngày Đối Soát</label>
                  <select
                    value={localNvcMapping.dateColumn || ''}
                    onChange={(e) => updateNvcField('dateColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Mã Đơn Phụ / Ref Code</label>
                  <select
                    value={localNvcMapping.refOrderCodeColumn || ''}
                    onChange={(e) => updateNvcField('refOrderCodeColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

              </div>

              {/* Custom Extra Columns in NVC */}
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    ➕ CÁC CỘT TÙY CHỈNH THÊM TỪ FILE NVC ({nvcCustoms.length})
                  </div>
                </div>

                {nvcCustoms.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {nvcCustoms.map(c => (
                      <div key={c.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-secondary)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{c.label}</strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👉 Cột trong Excel: <strong>{c.excelColumn}</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomColumn(c.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '3px 6px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new custom column row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: 10,
                  alignItems: 'flex-end',
                  background: 'var(--bg-tertiary)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Tên Nhãn Cột Muốn Đặt</label>
                    <input
                      type="text"
                      value={newCustomLabel}
                      onChange={(e) => setNewCustomLabel(e.target.value)}
                      placeholder="Ví dụ: Khu vực phát, Mã kho..."
                      className="input-field"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Chọn Cột Trong File NVC</label>
                    <select
                      value={newCustomExcelCol}
                      onChange={(e) => setNewCustomExcelCol(e.target.value)}
                      className="select-field"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                    >
                      <option value="">-- Chọn cột --</option>
                      {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomColumn}
                    className="btn btn-primary btn-sm"
                    style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                  >
                    <Plus size={14} />
                    <span>+ Thêm Cột</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: FILE APP */}
          {activeTab === 'app' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                DANH MỤC CÁC TRƯỜNG THÔNG TIN ĐƠN HÀNG APP:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Mã Vận Đơn (*)</label>
                  <select
                    value={localAppMapping.waybillColumn || ''}
                    onChange={(e) => updateAppField('waybillColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Chọn cột --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Tên Shop / Người Gửi (*)</label>
                  <select
                    value={localAppMapping.shopNameColumn || ''}
                    onChange={(e) => updateAppField('shopNameColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Chọn cột --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Số ĐT Shop / Người Gửi</label>
                  <select
                    value={localAppMapping.shopPhoneColumn || ''}
                    onChange={(e) => updateAppField('shopPhoneColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Địa Chỉ Kho Gửi Của Shop</label>
                  <select
                    value={localAppMapping.shopAddressColumn || ''}
                    onChange={(e) => updateAppField('shopAddressColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Tên Người Nhận</label>
                  <select
                    value={localAppMapping.receiverNameColumn || ''}
                    onChange={(e) => updateAppField('receiverNameColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột SĐT Người Nhận</label>
                  <select
                    value={localAppMapping.receiverPhoneColumn || ''}
                    onChange={(e) => updateAppField('receiverPhoneColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Địa Chỉ Giao Hàng</label>
                  <select
                    value={localAppMapping.receiverAddressColumn || ''}
                    onChange={(e) => updateAppField('receiverAddressColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Tên Sản Phẩm / Hàng Hóa</label>
                  <select
                    value={localAppMapping.productNameColumn || ''}
                    onChange={(e) => updateAppField('productNameColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Ghi Chú Đơn Hàng</label>
                  <select
                    value={localAppMapping.orderNoteColumn || ''}
                    onChange={(e) => updateAppField('orderNoteColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Cột Khối Lượng App (Dự phòng)</label>
                  <select
                    value={localAppMapping.weightColumn || ''}
                    onChange={(e) => updateAppField('weightColumn', e.target.value)}
                    className="select-field"
                  >
                    <option value="">-- Không chọn --</option>
                    {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

              </div>

              {/* Custom Extra Columns in App */}
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    ➕ CÁC CỘT TÙY CHỈNH THÊM TỪ FILE APP ({appCustoms.length})
                  </div>
                </div>

                {appCustoms.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {appCustoms.map(c => (
                      <div key={c.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-secondary)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{c.label}</strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👉 Cột trong Excel: <strong>{c.excelColumn}</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomColumn(c.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '3px 6px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new custom column row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: 10,
                  alignItems: 'flex-end',
                  background: 'var(--bg-tertiary)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Tên Nhãn Cột Muốn Đặt</label>
                    <input
                      type="text"
                      value={newCustomLabel}
                      onChange={(e) => setNewCustomLabel(e.target.value)}
                      placeholder="Ví dụ: Hình thức thanh toán, Mã chi nhánh..."
                      className="input-field"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Chọn Cột Trong File App</label>
                    <select
                      value={newCustomExcelCol}
                      onChange={(e) => setNewCustomExcelCol(e.target.value)}
                      className="select-field"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                    >
                      <option value="">-- Chọn cột --</option>
                      {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomColumn}
                    className="btn btn-primary btn-sm"
                    style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                  >
                    <Plus size={14} />
                    <span>+ Thêm Cột</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
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
            <span>Mọi cấu hình cột và cột tùy chỉnh thêm sẽ được lưu tự động cho các lần đối soát sau.</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Đóng
            </button>
            <button type="button" onClick={handleSave} className="btn btn-primary">
              <Check size={16} />
              <span>Lưu Cấu Hình Ánh Xạ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
