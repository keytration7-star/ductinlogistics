import React, { useState } from 'react';
import { Settings2, SlidersHorizontal, FileSpreadsheet, Check, X, Plus, Trash2, RotateCcw, AlertCircle, Eye, ShieldAlert } from 'lucide-react';
import type { ColumnMappingConfig, CustomColumnMapping, ExportColumnSettings, ExportColumnItem } from '../types';
import { autoDetectColumns } from '../services/smartColumnDetector';
import { StorageService, DEFAULT_EXPORT_COLUMNS } from '../services/storage';

interface CarrierProfileConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  carrierId: string;
  carrierName: string;
  nvcHeaders: string[];
  appHeaders: string[];
  nvcMapping: ColumnMappingConfig;
  appMapping: ColumnMappingConfig;
  onSaveMappings: (nvcMapping: ColumnMappingConfig, appMapping: ColumnMappingConfig) => void;
  // Optional: indicate if headers come from live uploaded file vs saved cache
  hasLiveNvcFile?: boolean;
  hasLiveAppFile?: boolean;
  hasSavedNvcHeaders?: boolean;
  hasSavedAppHeaders?: boolean;
}

export const CarrierProfileConfigModal: React.FC<CarrierProfileConfigModalProps> = ({
  isOpen,
  onClose,
  carrierId,
  carrierName,
  nvcHeaders,
  appHeaders,
  nvcMapping,
  appMapping,
  onSaveMappings,
  hasLiveNvcFile = false,
  hasLiveAppFile = false,
  hasSavedNvcHeaders = false,
  hasSavedAppHeaders = false,
}) => {
  // Main Tab: 'mapping' (Ánh xạ cột) or 'export' (Mẫu xuất file)
  const [mainTab, setMainTab] = useState<'mapping' | 'export'>('mapping');

  // Sub-Tab for Mapping: 'nvc' or 'app'
  const [mappingSubTab, setMappingSubTab] = useState<'nvc' | 'app'>('nvc');

  // Sub-Tab for Export: 'shop' or 'master'
  const [exportSubTab, setExportSubTab] = useState<'shop' | 'master'>('shop');

  // Local state for Mapping
  const [localNvcMapping, setLocalNvcMapping] = useState<ColumnMappingConfig>(nvcMapping);
  const [localAppMapping, setLocalAppMapping] = useState<ColumnMappingConfig>(appMapping);

  // New Custom Column Form State
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomExcelCol, setNewCustomExcelCol] = useState('');

  // Local state for Export Settings
  const [exportSettings, setExportSettings] = useState<ExportColumnSettings>(() => {
    return StorageService.getCarrierExportSettings(carrierId);
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  // Mapping handlers
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
      fileType: mappingSubTab,
    };

    if (mappingSubTab === 'nvc') {
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
    if (mappingSubTab === 'nvc') {
      const customs = (localNvcMapping.customColumns || []).filter(c => c.id !== colId);
      setLocalNvcMapping({ ...localNvcMapping, customColumns: customs });
    } else {
      const customs = (localAppMapping.customColumns || []).filter(c => c.id !== colId);
      setLocalAppMapping({ ...localAppMapping, customColumns: customs });
    }
  };

  const handleAutoRedetect = () => {
    if (confirm(`Khôi phục tự động nhận diện cột thông minh cho hồ sơ ${carrierName}?`)) {
      const newNvc = autoDetectColumns(nvcHeaders, 'nvc');
      const newApp = autoDetectColumns(appHeaders, 'app');
      setLocalNvcMapping(newNvc);
      setLocalAppMapping(newApp);
    }
  };

  // Export handlers
  const currentExportColumns = exportSubTab === 'shop' ? exportSettings.shopColumns : exportSettings.masterColumns;

  const handleToggleExportColumn = (colId: string) => {
    if (colId === 'stt' || colId === 'waybill') return;

    const updatedCols = currentExportColumns.map((col: ExportColumnItem) => {
      if (col.id === colId) {
        return { ...col, enabled: !col.enabled };
      }
      return col;
    });

    const newSettings: ExportColumnSettings = {
      ...exportSettings,
      [exportSubTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setExportSettings(newSettings);
  };

  const handleSelectAllExport = (enabled: boolean) => {
    const updatedCols = currentExportColumns.map((col: ExportColumnItem) => {
      if (col.id === 'stt' || col.id === 'waybill') return col;
      return { ...col, enabled };
    });

    const newSettings: ExportColumnSettings = {
      ...exportSettings,
      [exportSubTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setExportSettings(newSettings);
  };

  const handleResetExportDefaults = () => {
    if (confirm('Bạn có chắc muốn khôi phục lại danh sách cột xuất Excel mặc định?')) {
      const defaultClone = JSON.parse(JSON.stringify(DEFAULT_EXPORT_COLUMNS));
      setExportSettings(defaultClone);
      StorageService.saveCarrierExportSettings(carrierId, defaultClone);
    }
  };

  // Unified Save
  const handleSaveAll = () => {
    if (!localNvcMapping.waybillColumn && nvcHeaders.length > 0) {
      alert('Vui lòng chọn Cột Mã Vận Đơn cho File Đối Soát NVC.');
      setMainTab('mapping');
      setMappingSubTab('nvc');
      return;
    }

    // Save Mapping per carrier
    StorageService.saveCarrierMapping(carrierId, localNvcMapping, localAppMapping);
    onSaveMappings(localNvcMapping, localAppMapping);

    // Save Export settings per carrier
    StorageService.saveCarrierExportSettings(carrierId, exportSettings);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 450);
  };

  const nvcCustoms = localNvcMapping.customColumns || [];
  const appCustoms = localAppMapping.customColumns || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 880 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.10) 0%, rgba(16, 185, 129, 0.08) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}>
              <Settings2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                  Cài Đặt Hồ Sơ Hãng Vận Chuyển
                </h3>
                <span className="badge badge-primary" style={{ fontSize: 12, padding: '3px 9px', fontWeight: 700 }}>
                  📦 {carrierName}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Tùy chỉnh ánh xạ cột file đầu vào & mẫu cột xuất file Excel dành riêng cho hãng <strong>{carrierName}</strong>.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Level 1 Tabs: Ánh Xạ Cột vs Mẫu Xuất Excel */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          padding: '0 20px',
        }}>
          <button
            type="button"
            onClick={() => setMainTab('mapping')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              color: mainTab === 'mapping' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: mainTab === 'mapping' ? '3px solid var(--primary)' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SlidersHorizontal size={17} />
            <span>1. Cấu Hình Ánh Xạ Cột Excel (Mapping)</span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('export')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              color: mainTab === 'export' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: mainTab === 'export' ? '3px solid var(--primary)' : '3px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileSpreadsheet size={17} />
            <span>2. Cấu Hình Mẫu Cột Xuất File Excel</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 22, maxHeight: 480, overflowY: 'auto' }}>
          
          {/* ═══════════════════════════════════════════ */}
          {/* TAB 1: ÁNH XẠ CỘT (COLUMN MAPPING) */}
          {/* ═══════════════════════════════════════════ */}
          {mainTab === 'mapping' && (
            <div>
              {/* Sub-tabs: File NVC vs File App */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setMappingSubTab('nvc')}
                  className={`btn btn-sm ${mappingSubTab === 'nvc' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  📄 Cột File Đối Soát NVC {nvcHeaders.length > 0 ? `(${nvcHeaders.length} cột)` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setMappingSubTab('app')}
                  className={`btn btn-sm ${mappingSubTab === 'app' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  📱 Cột File Đơn Hàng Từ App {appHeaders.length > 0 ? `(${appHeaders.length} cột)` : ''}
                </button>

                <div style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={handleAutoRedetect}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    title="Quét lại tiêu đề tự động"
                  >
                    <RotateCcw size={12} />
                    <span>Tự Động Quét Lại</span>
                  </button>
                </div>
              </div>

              {/* Header source status banner */}
              {mappingSubTab === 'nvc' && (
                <div style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 12,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  ...(hasLiveNvcFile
                    ? { background: 'rgba(16, 185, 129, 0.10)', border: '1px solid var(--success)', color: 'var(--success)' }
                    : hasSavedNvcHeaders && nvcHeaders.length > 0
                    ? { background: 'rgba(79, 70, 229, 0.08)', border: '1px solid var(--primary)', color: 'var(--primary)' }
                    : { background: 'rgba(245, 158, 11, 0.10)', border: '1px solid #f59e0b', color: '#92400e' }
                  )
                }}>
                  <span style={{ fontSize: 14 }}>
                    {hasLiveNvcFile ? '🟢' : hasSavedNvcHeaders && nvcHeaders.length > 0 ? '🔵' : '🟡'}
                  </span>
                  <span>
                    {hasLiveNvcFile
                      ? <><strong>File NVC đang mở ({nvcHeaders.length} cột):</strong> Dữ liệu cột thực tế từ file vừa tải lên.</>  
                      : hasSavedNvcHeaders && nvcHeaders.length > 0
                      ? <><strong>Dùng cột đã lưu ({nvcHeaders.length} cột):</strong> Lấy từ file NVC lần trước của hãng {carrierName}. <em>Tải lên file NVC mới để cập nhật.</em></>
                      : <><strong>Chưa có dữ liệu cột NVC.</strong> Vui lòng tải file NVC lên trang chính trước, hoặc nhập tay bên dưới.</> 
                    }
                  </span>
                </div>
              )}

              {mappingSubTab === 'app' && (
                <div style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 12,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  ...(hasLiveAppFile
                    ? { background: 'rgba(16, 185, 129, 0.10)', border: '1px solid var(--success)', color: 'var(--success)' }
                    : hasSavedAppHeaders && appHeaders.length > 0
                    ? { background: 'rgba(79, 70, 229, 0.08)', border: '1px solid var(--primary)', color: 'var(--primary)' }
                    : { background: 'rgba(245, 158, 11, 0.10)', border: '1px solid #f59e0b', color: '#92400e' }
                  )
                }}>
                  <span style={{ fontSize: 14 }}>
                    {hasLiveAppFile ? '🟢' : hasSavedAppHeaders && appHeaders.length > 0 ? '🔵' : '🟡'}
                  </span>
                  <span>
                    {hasLiveAppFile
                      ? <><strong>File App đang mở ({appHeaders.length} cột):</strong> Dữ liệu cột thực tế từ file vừa tải lên.</>
                      : hasSavedAppHeaders && appHeaders.length > 0
                      ? <><strong>Dùng cột đã lưu ({appHeaders.length} cột):</strong> Lấy từ file App lần trước của hãng {carrierName}. <em>Tải lên file App mới để cập nhật.</em></>
                      : <><strong>Chưa có dữ liệu cột App.</strong> Vui lòng tải file App lên trang chính trước, hoặc nhập tay bên dưới.</>
                    }
                  </span>
                </div>
              )}

              {/* Sub-tab Content: File NVC */}
              {mappingSubTab === 'nvc' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                    
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
                      <label className="input-label">Cột Khối Lượng (kg/g)</label>
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

                  </div>

                  {/* Custom Extra Columns NVC */}
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                      ➕ CÁC CỘT TÙY CHỈNH THÊM TỪ FILE NVC ({nvcCustoms.length})
                    </div>

                    {nvcCustoms.map(c => (
                      <div key={c.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-secondary)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 12 }}>
                          <strong style={{ color: 'var(--primary)' }}>{c.label}</strong> 👉 Cột Excel: <strong>{c.excelColumn}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomColumn(c.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 5px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                      <div>
                        <input
                          type="text"
                          value={newCustomLabel}
                          onChange={(e) => setNewCustomLabel(e.target.value)}
                          placeholder="Tên nhãn cột muốn thêm..."
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <select
                          value={newCustomExcelCol}
                          onChange={(e) => setNewCustomExcelCol(e.target.value)}
                          className="select-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        >
                          <option value="">-- Chọn cột trong file NVC --</option>
                          {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCustomColumn}
                        className="btn btn-primary btn-sm"
                        style={{ height: 32, padding: '0 10px', fontSize: 11 }}
                      >
                        <Plus size={13} />
                        <span>Thêm</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* Sub-tab Content: File App */}
              {mappingSubTab === 'app' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                    
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
                      <label className="input-label">Cột SĐT Shop</label>
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
                      <label className="input-label">Cột Địa Chỉ Nhận Hàng</label>
                      <select
                        value={localAppMapping.receiverAddressColumn || ''}
                        onChange={(e) => updateAppField('receiverAddressColumn', e.target.value)}
                        className="select-field"
                      >
                        <option value="">-- Không chọn --</option>
                        {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                  </div>

                  {/* Custom Extra Columns App */}
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
                      ➕ CÁC CỘT TÙY CHỈNH THÊM TỪ FILE APP ({appCustoms.length})
                    </div>

                    {appCustoms.map(c => (
                      <div key={c.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-secondary)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 12 }}>
                          <strong style={{ color: 'var(--primary)' }}>{c.label}</strong> 👉 Cột Excel: <strong>{c.excelColumn}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomColumn(c.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 5px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                      <div>
                        <input
                          type="text"
                          value={newCustomLabel}
                          onChange={(e) => setNewCustomLabel(e.target.value)}
                          placeholder="Tên nhãn cột muốn thêm..."
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <select
                          value={newCustomExcelCol}
                          onChange={(e) => setNewCustomExcelCol(e.target.value)}
                          className="select-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        >
                          <option value="">-- Chọn cột trong file App --</option>
                          {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCustomColumn}
                        className="btn btn-primary btn-sm"
                        style={{ height: 32, padding: '0 10px', fontSize: 11 }}
                      >
                        <Plus size={13} />
                        <span>Thêm</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* TAB 2: MẪU XUẤT EXCEL (EXPORT SETTINGS) */}
          {/* ═══════════════════════════════════════════ */}
          {mainTab === 'export' && (
            <div>
              {/* Sub-tabs: File Shop vs File Master */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setExportSubTab('shop')}
                    className={`btn btn-sm ${exportSubTab === 'shop' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                  >
                    📄 Bảng Kê Shop ({exportSettings.shopColumns.filter((c: ExportColumnItem) => c.enabled).length}/{exportSettings.shopColumns.length} cột)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportSubTab('master')}
                    className={`btn btn-sm ${exportSubTab === 'master' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                  >
                    📊 Báo Cáo Tổng Hợp Gom Đơn ({exportSettings.masterColumns.filter((c: ExportColumnItem) => c.enabled).length}/{exportSettings.masterColumns.length} cột)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleSelectAllExport(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Chọn Tất Cả
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllExport(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    Bỏ Chọn Hết
                  </button>
                  <button
                    type="button"
                    onClick={handleResetExportDefaults}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                    title="Khôi phục mặc định"
                  >
                    <RotateCcw size={12} />
                    <span>Mặc định</span>
                  </button>
                </div>
              </div>

              {exportSubTab === 'shop' && (
                <div style={{
                  background: 'rgba(79, 70, 229, 0.05)',
                  border: '1px dashed var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-main)',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <ShieldAlert size={15} color="var(--primary)" />
                  <span>
                    <strong>Bảo mật:</strong> Cột <em>Cước gốc NVC</em> và <em>Lợi nhuận</em> đã tự động ẩn trong file của Shop.
                  </span>
                </div>
              )}

              {/* Grid of Checkboxes */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 8,
              }}>
                {currentExportColumns.map((col: ExportColumnItem) => {
                  const isMandatory = col.id === 'stt' || col.id === 'waybill';
                  return (
                    <label
                      key={col.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: col.enabled ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                        border: col.enabled ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        cursor: isMandatory ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        opacity: isMandatory ? 0.8 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={col.enabled}
                        disabled={isMandatory}
                        onChange={() => handleToggleExportColumn(col.id)}
                        style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: isMandatory ? 'not-allowed' : 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: col.enabled ? 700 : 500,
                          color: col.enabled ? 'var(--text-main)' : 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {col.label}
                        </div>
                        {isMandatory && <div style={{ fontSize: 10, color: 'var(--primary)' }}>Bắt buộc</div>}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Preview Line */}
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={13} /> Xem trước hàng tiêu đề:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: 'var(--bg-tertiary)', padding: 8, borderRadius: 'var(--radius-md)' }}>
                  {currentExportColumns.filter((c: ExportColumnItem) => c.enabled).map((c: ExportColumnItem, idx: number) => (
                    <span key={c.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>
                      {idx + 1}. {c.label}
                    </span>
                  ))}
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
            <span>Mọi thay đổi sẽ được lưu cố định cho hồ sơ <strong>{carrierName}</strong>.</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Đóng
            </button>
            <button type="button" onClick={handleSaveAll} className="btn btn-primary">
              <Check size={16} />
              <span>{savedSuccess ? 'Đã Lưu Hồ Sơ Thành Công!' : `Lưu Cấu Hình Hồ Sơ ${carrierName}`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
