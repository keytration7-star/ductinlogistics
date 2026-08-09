import React, { useState, useRef } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { Settings2, SlidersHorizontal, FileSpreadsheet, Check, X, Plus, Trash2, RotateCcw, AlertCircle, Eye, ShieldAlert, Zap } from 'lucide-react';
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

  const [selectedExportSourceHeader, setSelectedExportSourceHeader] = useState('');
  const [customExportLabel, setCustomExportLabel] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  if (!isOpen) return null;

  // Auto-save helper: debounce 400ms after last change
  const triggerAutoSave = (newNvc: ColumnMappingConfig, newApp: ColumnMappingConfig, newExport?: ExportColumnSettings) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      StorageService.saveCarrierMapping(carrierId, newNvc, newApp);
      onSaveMappings(newNvc, newApp);
      if (newExport) {
        StorageService.saveCarrierExportSettings(carrierId, newExport);
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }, 400);
  };

  // Mapping handlers — auto-save on every change
  const updateNvcField = (field: keyof ColumnMappingConfig, val: string) => {
    const updated = { ...localNvcMapping, [field]: val };
    setLocalNvcMapping(updated);
    triggerAutoSave(updated, localAppMapping);
  };

  const updateAppField = (field: keyof ColumnMappingConfig, val: string) => {
    const updated = { ...localAppMapping, [field]: val };
    setLocalAppMapping(updated);
    triggerAutoSave(localNvcMapping, updated);
  };

  const handleAddCustomColumn = () => {
    if (!newCustomLabel.trim() || !newCustomExcelCol) {
      showToast('Vui lòng nhập tên nhãn cột và chọn cột trong file Excel.', 'warning');
      return;
    }

    const newCol: CustomColumnMapping = {
      id: `col_${Date.now()}`,
      label: newCustomLabel.trim(),
      excelColumn: newCustomExcelCol,
      fileType: mappingSubTab,
    };

    if (mappingSubTab === 'nvc') {
      const updated = { ...localNvcMapping, customColumns: [...(localNvcMapping.customColumns || []), newCol] };
      setLocalNvcMapping(updated);
      triggerAutoSave(updated, localAppMapping);
    } else {
      const updated = { ...localAppMapping, customColumns: [...(localAppMapping.customColumns || []), newCol] };
      setLocalAppMapping(updated);
      triggerAutoSave(localNvcMapping, updated);
    }

    setNewCustomLabel('');
    setNewCustomExcelCol('');
  };

  const handleRemoveCustomColumn = (colId: string) => {
    if (mappingSubTab === 'nvc') {
      const updated = { ...localNvcMapping, customColumns: (localNvcMapping.customColumns || []).filter(c => c.id !== colId) };
      setLocalNvcMapping(updated);
      triggerAutoSave(updated, localAppMapping);
    } else {
      const updated = { ...localAppMapping, customColumns: (localAppMapping.customColumns || []).filter(c => c.id !== colId) };
      setLocalAppMapping(updated);
      triggerAutoSave(localNvcMapping, updated);
    }
  };

  const handleAutoRedetect = async () => {
    const ok = await showConfirm({
      title: 'Nhận Diện Lại Cột',
      message: `Khôi phục tự động nhận diện cột thông minh cho hồ sơ ${carrierName}? Cấu hình hiện tại sẽ bị ghi đè.`,
      confirmText: 'Nhận Diện Lại',
      warning: true,
    });
    if (ok) {
      const newNvc = autoDetectColumns(nvcHeaders, 'nvc');
      const newApp = autoDetectColumns(appHeaders, 'app');
      setLocalNvcMapping(newNvc);
      setLocalAppMapping(newApp);
      triggerAutoSave(newNvc, newApp);
    }
  };

  // Compute all unique scanned headers from NVC & App files
  const allScannedHeaders = Array.from(new Set([
    ...nvcHeaders,
    ...appHeaders,
    ...(localNvcMapping.customColumns || []).map(c => c.excelColumn),
    ...(localAppMapping.customColumns || []).map(c => c.excelColumn),
  ].filter(Boolean)));

  const handleAddNewCustomExportColumn = () => {
    if (!selectedExportSourceHeader) {
      showToast('Vui lòng chọn một cột quét từ file NVC hoặc App.', 'warning');
      return;
    }
    const label = (customExportLabel.trim() || selectedExportSourceHeader);
    const targetKey = exportSubTab === 'shop' ? 'shopColumns' : 'masterColumns';

    const exists = exportSettings[targetKey].some(c => c.sourceHeader === selectedExportSourceHeader || c.label === label);
    if (exists) {
      showToast(`Cột "${label}" đã có sẵn trong mẫu xuất file.`, 'warning');
      return;
    }

    const newCol: ExportColumnItem = {
      id: `exp_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label,
      enabled: true,
      category: 'custom',
      sourceHeader: selectedExportSourceHeader,
    };

    const updated = {
      ...exportSettings,
      [targetKey]: [...exportSettings[targetKey], newCol],
    };
    setExportSettings(updated);
    triggerAutoSave(localNvcMapping, localAppMapping, updated);
    showToast(`Đã thêm cột xuất "${label}"!`, 'success');
    setSelectedExportSourceHeader('');
    setCustomExportLabel('');
  };

  const handleRemoveExportColumn = (colId: string) => {
    const targetKey = exportSubTab === 'shop' ? 'shopColumns' : 'masterColumns';
    const updated = {
      ...exportSettings,
      [targetKey]: exportSettings[targetKey].filter(c => c.id !== colId),
    };
    setExportSettings(updated);
    triggerAutoSave(localNvcMapping, localAppMapping, updated);
    showToast('Đã xóa cột tùy chọn khỏi mẫu xuất.', 'info');
  };

  const handleAutoAddAllScannedHeaders = () => {
    const targetKey = exportSubTab === 'shop' ? 'shopColumns' : 'masterColumns';
    const currentCols = exportSettings[targetKey];
    let countAdded = 0;

    const newCols = [...currentCols];
    allScannedHeaders.forEach(h => {
      const alreadyHas = newCols.some(c => c.sourceHeader === h || c.label.toLowerCase() === h.toLowerCase());
      if (!alreadyHas) {
        newCols.push({
          id: `exp_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          label: h,
          enabled: true,
          category: 'custom',
          sourceHeader: h,
        });
        countAdded++;
      }
    });

    if (countAdded === 0) {
      showToast('Tất cả cột quét được từ 2 file đã có sẵn trong danh sách mẫu xuất!', 'info');
      return;
    }

    const updated = {
      ...exportSettings,
      [targetKey]: newCols,
    };
    setExportSettings(updated);
    triggerAutoSave(localNvcMapping, localAppMapping, updated);
    showToast(`Đã tự động thêm ${countAdded} cột mới quét từ 2 file!`, 'success');
  };

  // Export handlers — auto-save on every change
  const currentExportColumns = exportSubTab === 'shop' ? exportSettings.shopColumns : exportSettings.masterColumns;

  const handleToggleExportColumn = (colId: string) => {
    if (colId === 'stt' || colId === 'waybill') return;
    const updatedCols = currentExportColumns.map((col: ExportColumnItem) => col.id === colId ? { ...col, enabled: !col.enabled } : col);
    const newSettings: ExportColumnSettings = {
      ...exportSettings,
      [exportSubTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setExportSettings(newSettings);
    triggerAutoSave(localNvcMapping, localAppMapping, newSettings);
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
    triggerAutoSave(localNvcMapping, localAppMapping, newSettings);
  };

  const handleResetExportDefaults = async () => {
    const ok = await showConfirm({
      title: 'Khôi Phục Mặc Định',
      message: 'Bạn có chắc muốn khôi phục lại danh sách cột xuất Excel mặc định?',
      confirmText: 'Khôi Phục',
      warning: true,
    });
    if (ok) {
      const defaultClone = JSON.parse(JSON.stringify(DEFAULT_EXPORT_COLUMNS));
      setExportSettings(defaultClone);
      StorageService.saveCarrierExportSettings(carrierId, defaultClone);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };




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
              {mappingSubTab === 'nvc' && (() => {
                // All configurable NVC fields (beyond mandatory waybill)
                const NVC_OPTIONAL_FIELDS: { key: keyof ColumnMappingConfig; label: string; emoji: string; hint: string }[] = [
                  { key: 'codColumn',       label: 'Tiền COD Thu Hộ',          emoji: '💰', hint: 'Dùng để lấy số tiền COD của đơn' },
                  { key: 'feeColumn',       label: 'Cước Chính NVC',            emoji: '🚚', hint: 'Dùng để tính lợi nhuận nhà gom' },
                  { key: 'otherFeeColumn',  label: 'Phụ Phí / Hoàn / Bảo Hiểm',emoji: '➕', hint: 'Phí phát sinh thêm' },
                  { key: 'weightColumn',    label: 'Khối Lượng (kg/g)',          emoji: '⚖️', hint: 'Dùng để tính lại cước theo bảng giá shop' },
                  { key: 'statusColumn',    label: 'Trạng Thái Giao Hàng',      emoji: '📋', hint: 'Phân loại: giao thành công / đang giao / hoàn' },
                  { key: 'dateColumn',      label: 'Ngày Giao Hàng',            emoji: '📅', hint: 'Ngày hoàn tất giao hàng' },
                ];
                const activeNvcFields = NVC_OPTIONAL_FIELDS.filter(f => !!localNvcMapping[f.key]);
                const inactiveNvcFields = NVC_OPTIONAL_FIELDS.filter(f => !localNvcMapping[f.key]);
                const hasHeaders = nvcHeaders.length > 0;

                return (
                  <div>
                    {/* MANDATORY: Mã Vận Đơn */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
                      border: '2px solid var(--primary)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 18 }}>🔑</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 3 }}>
                          Cột Mã Vận Đơn — Bắt Buộc (Khóa Ghép 2 File)
                        </div>
                        <select
                          value={localNvcMapping.waybillColumn || ''}
                          onChange={(e) => updateNvcField('waybillColumn', e.target.value)}
                          className="select-field"
                          style={{ padding: '5px 10px', fontSize: 13, fontWeight: 700 }}
                        >
                          <option value="">-- Chọn cột Mã Vận Đơn trong file NVC --</option>
                          {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* OPTIONAL ACTIVE FIELDS */}
                    {activeNvcFields.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                          Cột Tuỳ Chọn Đang Bật ({activeNvcFields.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {activeNvcFields.map(f => (
                            <div key={f.key as string} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '7px 12px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                            }}>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>{f.emoji}</span>
                              <div style={{ width: 180, flexShrink: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{f.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.hint}</div>
                              </div>
                              <select
                                value={(localNvcMapping[f.key] as string) || ''}
                                onChange={(e) => updateNvcField(f.key, e.target.value)}
                                className="select-field"
                                style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                              >
                                <option value="">-- Không chọn --</option>
                                {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                              {/* Nút xoá hàng này */}
                              <button
                                type="button"
                                onClick={() => updateNvcField(f.key, '')}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 6px', flexShrink: 0 }}
                                title={`Xoá cột "${f.label}" khỏi ánh xạ`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* THÊM CỘT TỪ DANH SÁCH PRESET */}
                    {inactiveNvcFields.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                          Thêm Cột Ánh Xạ
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {inactiveNvcFields.map(f => (
                            <button
                              key={f.key as string}
                              type="button"
                              onClick={() => {
                                // Auto-select first header or leave empty
                                updateNvcField(f.key, nvcHeaders[0] || '');
                              }}
                              disabled={!hasHeaders}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 10px', opacity: hasHeaders ? 1 : 0.5 }}
                              title={hasHeaders ? `Thêm ánh xạ cho ${f.label}` : 'Vui lòng tải file NVC lên trước'}
                            >
                              <Plus size={11} />
                              <span>{f.emoji} {f.label}</span>
                            </button>
                          ))}
                        </div>
                        {!hasHeaders && (
                          <div style={{ fontSize: 11, color: '#92400e', marginTop: 6, padding: '4px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 4 }}>
                            ⚠️ Cần tải file NVC lên để kích hoạt thêm cột mới
                          </div>
                        )}
                      </div>
                    )}

                    {/* CỘT TUỲ CHỈNH THÊM (extra custom) */}
                    <div style={{ paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                        Cột Tuỳ Chỉnh Thêm Từ File NVC ({(localNvcMapping.customColumns || []).length})
                      </div>
                      {(localNvcMapping.customColumns || []).map(c => (
                        <div key={c.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'var(--bg-secondary)', padding: '6px 12px',
                          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: 6,
                        }}>
                          <span style={{ fontSize: 12, flex: 1 }}>
                            <strong style={{ color: 'var(--primary)' }}>{c.label}</strong> → Cột: <strong>{c.excelColumn}</strong>
                          </span>
                          <button type="button" onClick={() => handleRemoveCustomColumn(c.id)} className="btn btn-danger btn-sm" style={{ padding: '2px 5px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 6 }}>
                        <input
                          type="text"
                          value={newCustomLabel}
                          onChange={(e) => setNewCustomLabel(e.target.value)}
                          placeholder="Tên nhãn cột..."
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          disabled={!hasHeaders}
                        />
                        <select
                          value={newCustomExcelCol}
                          onChange={(e) => setNewCustomExcelCol(e.target.value)}
                          className="select-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          disabled={!hasHeaders}
                        >
                          <option value="">{hasHeaders ? '-- Chọn cột trong file NVC --' : '⚠️ Cần tải file NVC trước'}</option>
                          {nvcHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddCustomColumn}
                          className="btn btn-primary btn-sm"
                          style={{ height: 32, padding: '0 10px', fontSize: 11 }}
                          disabled={!hasHeaders}
                          title={!hasHeaders ? 'Cần tải file NVC lên để thêm cột tuỳ chỉnh' : ''}
                        >
                          <Plus size={13} />
                          <span>Thêm</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sub-tab Content: File App */}
              {mappingSubTab === 'app' && (() => {
                const APP_OPTIONAL_FIELDS: { key: keyof ColumnMappingConfig; label: string; emoji: string; hint: string }[] = [
                  { key: 'shopNameColumn',      label: 'Tên Shop / Người Gửi',  emoji: '🏪', hint: 'Dùng để khớp shop trong hệ thống' },
                  { key: 'shopPhoneColumn',     label: 'SĐT Shop / Người Gửi',  emoji: '📞', hint: 'Dùng để khớp shop theo SĐT' },
                  { key: 'receiverNameColumn',  label: 'Tên Người Nhận',        emoji: '👤', hint: 'Xuất ra bảng kê' },
                  { key: 'receiverPhoneColumn', label: 'SĐT Người Nhận',        emoji: '📱', hint: 'Xuất ra bảng kê' },
                  { key: 'receiverAddressColumn',label: 'Địa Chỉ Nhận Hàng',   emoji: '📍', hint: 'Xuất ra bảng kê' },
                  { key: 'shopAddressColumn',   label: 'Địa Chỉ Shop',          emoji: '🏠', hint: 'Tự động điền khi thêm shop mới' },
                ];
                const activeAppFields = APP_OPTIONAL_FIELDS.filter(f => !!localAppMapping[f.key]);
                const inactiveAppFields = APP_OPTIONAL_FIELDS.filter(f => !localAppMapping[f.key]);
                const hasHeaders = appHeaders.length > 0;

                return (
                  <div>
                    {/* MANDATORY: Mã Vận Đơn App */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)',
                      border: '2px solid var(--primary)', borderRadius: 'var(--radius-md)', marginBottom: 10,
                    }}>
                      <span style={{ fontSize: 18 }}>🔑</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 3 }}>
                          Cột Mã Vận Đơn — Bắt Buộc (Khóa Ghép 2 File)
                        </div>
                        <select
                          value={localAppMapping.waybillColumn || ''}
                          onChange={(e) => updateAppField('waybillColumn', e.target.value)}
                          className="select-field"
                          style={{ padding: '5px 10px', fontSize: 13, fontWeight: 700 }}
                        >
                          <option value="">-- Chọn cột Mã Vận Đơn trong file App --</option>
                          {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* OPTIONAL ACTIVE FIELDS */}
                    {activeAppFields.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                          Cột Tuỳ Chọn Đang Bật ({activeAppFields.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {activeAppFields.map(f => (
                            <div key={f.key as string} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                              background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                            }}>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>{f.emoji}</span>
                              <div style={{ width: 180, flexShrink: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{f.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.hint}</div>
                              </div>
                              <select
                                value={(localAppMapping[f.key] as string) || ''}
                                onChange={(e) => updateAppField(f.key, e.target.value)}
                                className="select-field"
                                style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                              >
                                <option value="">-- Không chọn --</option>
                                {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => updateAppField(f.key, '')}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 6px', flexShrink: 0 }}
                                title={`Xoá cột "${f.label}" khỏi ánh xạ`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* THÊM CỘT TỪ DANH SÁCH PRESET */}
                    {inactiveAppFields.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                          Thêm Cột Ánh Xạ
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {inactiveAppFields.map(f => (
                            <button
                              key={f.key as string}
                              type="button"
                              onClick={() => updateAppField(f.key, appHeaders[0] || '')}
                              disabled={!hasHeaders}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 10px', opacity: hasHeaders ? 1 : 0.5 }}
                              title={hasHeaders ? `Thêm ánh xạ cho ${f.label}` : 'Vui lòng tải file App lên trước'}
                            >
                              <Plus size={11} />
                              <span>{f.emoji} {f.label}</span>
                            </button>
                          ))}
                        </div>
                        {!hasHeaders && (
                          <div style={{ fontSize: 11, color: '#92400e', marginTop: 6, padding: '4px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 4 }}>
                            ⚠️ Cần tải file App lên để kích hoạt thêm cột mới
                          </div>
                        )}
                      </div>
                    )}

                    {/* CỘT TUỲ CHỈNH THÊM */}
                    <div style={{ paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                        Cột Tuỳ Chỉnh Thêm Từ File App ({(localAppMapping.customColumns || []).length})
                      </div>
                      {(localAppMapping.customColumns || []).map(c => (
                        <div key={c.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'var(--bg-secondary)', padding: '6px 12px',
                          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: 6,
                        }}>
                          <span style={{ fontSize: 12, flex: 1 }}>
                            <strong style={{ color: 'var(--primary)' }}>{c.label}</strong> → Cột: <strong>{c.excelColumn}</strong>
                          </span>
                          <button type="button" onClick={() => handleRemoveCustomColumn(c.id)} className="btn btn-danger btn-sm" style={{ padding: '2px 5px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 6 }}>
                        <input
                          type="text"
                          value={newCustomLabel}
                          onChange={(e) => setNewCustomLabel(e.target.value)}
                          placeholder="Tên nhãn cột..."
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          disabled={!hasHeaders}
                        />
                        <select
                          value={newCustomExcelCol}
                          onChange={(e) => setNewCustomExcelCol(e.target.value)}
                          className="select-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                          disabled={!hasHeaders}
                        >
                          <option value="">{hasHeaders ? '-- Chọn cột trong file App --' : '⚠️ Cần tải file App trước'}</option>
                          {appHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddCustomColumn}
                          className="btn btn-primary btn-sm"
                          style={{ height: 32, padding: '0 10px', fontSize: 11 }}
                          disabled={!hasHeaders}
                        >
                          <Plus size={13} />
                          <span>Thêm</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

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

              {/* Dynamic Add Scanned Column Box */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--primary)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  <span>➕ Thêm Cột Tùy Chọn Từ File Thực Tế Quét Được ({allScannedHeaders.length} Cột)</span>
                  {allScannedHeaders.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoAddAllScannedHeaders}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      title="Tự động thêm toàn bộ các cột thực tế tìm thấy trong 2 file"
                    >
                      <Zap size={12} color="var(--warning)" />
                      <span>Tự động thêm tất cả {allScannedHeaders.length} cột</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <select
                    value={selectedExportSourceHeader}
                    onChange={(e) => {
                      setSelectedExportSourceHeader(e.target.value);
                      if (!customExportLabel) setCustomExportLabel(e.target.value);
                    }}
                    className="select-field"
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  >
                    <option value="">
                      {allScannedHeaders.length > 0
                        ? `-- Chọn cột thực tế từ File NVC hoặc App (${allScannedHeaders.length} cột) --`
                        : '⚠️ Chưa quét thấy cột nào (Vui lòng tải file NVC hoặc App)'}
                    </option>
                    {allScannedHeaders.map(h => (
                      <option key={h} value={h}>
                        {nvcHeaders.includes(h) && appHeaders.includes(h)
                          ? `[Cả 2 File] ${h}`
                          : nvcHeaders.includes(h)
                          ? `[File NVC] ${h}`
                          : `[File App] ${h}`}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Tên tiêu đề hiển thị trên Excel xuất..."
                    value={customExportLabel}
                    onChange={(e) => setCustomExportLabel(e.target.value)}
                    className="input-field"
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  />

                  <button
                    type="button"
                    onClick={handleAddNewCustomExportColumn}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '0 12px', fontSize: 11, height: 32 }}
                    disabled={!selectedExportSourceHeader}
                  >
                    <Plus size={13} />
                    <span>Thêm Cột Xuất</span>
                  </button>
                </div>
              </div>

              {/* Grid of Checkboxes */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: 8,
              }}>
                {currentExportColumns.map((col: ExportColumnItem) => {
                  const isMandatory = col.id === 'stt' || col.id === 'waybill';
                  const isCustom = col.category === 'custom';

                  return (
                    <div
                      key={col.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: col.enabled ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                        border: col.enabled ? '1px solid var(--primary)' : '1px solid var(--border-color)',
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
                      <div style={{ flex: 1, minWidth: 0, cursor: isMandatory ? 'not-allowed' : 'pointer' }} onClick={() => !isMandatory && handleToggleExportColumn(col.id)}>
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
                        {isCustom && (
                          <div style={{ fontSize: 9, color: 'var(--warning)', fontWeight: 600 }}>
                            Quét từ file ({col.sourceHeader || col.label})
                          </div>
                        )}
                      </div>

                      {/* Trash button for custom export columns */}
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveExportColumn(col.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 5px', flexShrink: 0 }}
                          title="Xóa cột tùy chọn này khỏi danh sách xuất"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
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
          padding: '12px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
        }}>
          {/* Auto-save status */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.3s' }}>
            {savedSuccess ? (
              <>
                <span style={{ color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={14} /> Đã lưu tự động
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={13} color="var(--primary)" />
                <span>Mọi thay đổi được <strong>lưu tự động</strong> cho hồ sơ <strong>{carrierName}</strong>.</span>
              </>
            )}
          </div>

          <button type="button" onClick={onClose} className="btn btn-secondary">
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
