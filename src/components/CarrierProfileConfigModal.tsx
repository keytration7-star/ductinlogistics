import React, { useState, useRef } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { Settings2, SlidersHorizontal, FileSpreadsheet, Check, X, Trash2, RotateCcw, AlertCircle, ShieldAlert, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import type { ColumnMappingConfig, ExportColumnSettings, ExportColumnItem } from '../types';
import { autoDetectColumns } from '../services/smartColumnDetector';
import { StorageService } from '../services/storage';
import { SearchableSelect } from './SearchableSelect';

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
  hasLiveNvcFile: _hasLiveNvcFile = false,
  hasLiveAppFile: _hasLiveAppFile = false,
  hasSavedNvcHeaders: _hasSavedNvcHeaders = false,
  hasSavedAppHeaders: _hasSavedAppHeaders = false,
}) => {
  // Main Tab: 'mapping' (Ánh xạ cột) or 'export' (Mẫu xuất file)
  const [mainTab, setMainTab] = useState<'mapping' | 'export'>('mapping');

  // Local state for Mapping
  const [localNvcMapping, setLocalNvcMapping] = useState<ColumnMappingConfig>(nvcMapping);
  const [localAppMapping, setLocalAppMapping] = useState<ColumnMappingConfig>(appMapping);

  // Local state for Export Settings
  const [exportSettings, setExportSettings] = useState<ExportColumnSettings>(() => {
    return StorageService.getCarrierExportSettings(carrierId);
  });

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
          {/* TAB 1: ÁNH XẠ CỘT (UNIFIED 2-FILES SIDE-BY-SIDE MAPPING TABLE) */}
          {/* ═══════════════════════════════════════════ */}

          {/* ═══════════════════════════════════════════ */}
          {/* TAB 1: ÁNH XẠ CỘT (UNIFIED 2-FILES SIDE-BY-SIDE MAPPING TABLE) */}
          {/* ═══════════════════════════════════════════ */}
          {mainTab === 'mapping' && (() => {
            const UNIFIED_FIELDS: {
              keyNvc: keyof ColumnMappingConfig;
              keyApp: keyof ColumnMappingConfig;
              label: string;
              emoji: string;
              hint: string;
              isRequired?: boolean;
            }[] = [
              { keyNvc: 'waybillColumn',   keyApp: 'waybillColumn',   label: 'Mã Vận Đơn',           emoji: '🔑', hint: 'Khóa chính bắt buộc ghép 2 file', isRequired: true },
              { keyNvc: 'codColumn',       keyApp: 'codColumn',       label: 'Tiền COD Thu Hộ',       emoji: '💰', hint: 'COD NVC thu hộ vs COD App' },
              { keyNvc: 'feeColumn',       keyApp: 'feeColumn',       label: 'Cước Phí Gốc NVC (Giá Sỉ)', emoji: '🚚', hint: 'Cước sỉ trả NVC để tính lãi' },
              { keyNvc: 'otherFeeColumn',  keyApp: 'otherFeeColumn',  label: 'Phụ Phí / Hoàn / Bảo Hiểm', emoji: '➕', hint: 'Phụ phí phát sinh' },
              { keyNvc: 'weightColumn',    keyApp: 'weightColumn',    label: 'Trọng Lượng (kg/g)',   emoji: '⚖️', hint: 'Cân nặng NVC vs App' },
              { keyNvc: 'statusColumn',    keyApp: 'statusColumn',    label: 'Trạng Thái Đơn Hàng',   emoji: '📋', hint: 'Phân loại đơn giao / hoàn' },
              { keyNvc: 'shopPhoneColumn', keyApp: 'shopPhoneColumn', label: 'Số Điện Thoại Shop',    emoji: '📞', hint: 'Khớp shop theo SĐT phụ' },
              { keyNvc: 'receiverNameColumn',    keyApp: 'receiverNameColumn',    label: 'Tên Người Nhận',       emoji: '👤', hint: 'Dữ liệu xuất bảng kê' },
              { keyNvc: 'receiverPhoneColumn',   keyApp: 'receiverPhoneColumn',   label: 'SĐT Người Nhận',       emoji: '📱', hint: 'Dữ liệu xuất bảng kê' },
              { keyNvc: 'receiverAddressColumn', keyApp: 'receiverAddressColumn', label: 'Địa Chỉ Người Nhận',   emoji: '🏠', hint: 'Dữ liệu xuất bảng kê' },
            ];

            return (
              <div>
                {/* Header status bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  background: 'var(--bg-secondary)',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📄 File NVC: <strong>{nvcHeaders.length} cột</strong></span>
                    <span>•</span>
                    <span>📱 File App: <strong>{appHeaders.length > 0 ? `${appHeaders.length} cột` : 'Chế độ 1 File (Không cần App)'}</strong></span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoRedetect}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 12px' }}
                    title="Tự động quét lại toàn bộ cột khớp nhau"
                  >
                    <RotateCcw size={12} />
                    <span>🤖 Tự Động Khớp Lại (AI Auto-Match)</span>
                  </button>
                </div>

                {appHeaders.length === 0 && (
                  <div style={{
                    marginBottom: 14,
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Zap size={16} color="var(--primary)" />
                    <span>
                      💡 <strong>Hệ thống đang chạy ở Chế Độ 1-File</strong>: Bạn chỉ cần chọn các cột trong <strong>File NVC (Hãng Gốc)</strong>. Hệ thống sẽ tự động bóc tách thông tin Shop (Tên kho/SĐT gửi) trực tiếp từ file này!
                    </span>
                  </div>
                )}

                {/* 🌟 UNIFIED SIDE-BY-SIDE MAPPING TABLE */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  marginBottom: 16
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '210px 1fr 1fr 150px',
                    padding: '10px 14px',
                    background: 'var(--bg-tertiary)',
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border-color)',
                    gap: 12
                  }}>
                    <div>Trường Thông Tin Cần Lấy</div>
                    <div>📄 Cột Trong File NVC (Hãng)</div>
                    <div>📱 Cột Trong File App</div>
                    <div>Trạng Thái Khớp AI</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {UNIFIED_FIELDS.map((f, idx) => {
                      const nvcVal = f.keyNvc ? ((localNvcMapping[f.keyNvc] as string) || '') : '';
                      const appVal = f.keyApp ? ((localAppMapping[f.keyApp] as string) || '') : '';
                      
                      const hasNvc = !!f.keyNvc;
                      const hasApp = !!f.keyApp;

                      const isNvcMatched = hasNvc && !!nvcVal;
                      const isAppMatched = hasApp && !!appVal;

                      const isFullyMatched = appHeaders.length > 0 
                        ? (isNvcMatched && isAppMatched) 
                        : isNvcMatched;

                      return (
                        <div key={f.label} style={{
                          display: 'grid',
                          gridTemplateColumns: '210px 1fr 1fr 150px',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderBottom: idx === UNIFIED_FIELDS.length - 1 ? 'none' : '1px solid var(--border-color)',
                          background: f.isRequired ? 'rgba(79, 70, 229, 0.03)' : 'transparent',
                          gap: 12
                        }}>
                          {/* Column 1: Field Title */}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: f.isRequired ? 'var(--primary)' : 'var(--text-primary)' }}>
                              <span>{f.emoji}</span>
                              <span>{f.label}</span>
                              {f.isRequired && <span style={{ color: 'var(--danger)', fontSize: 11 }}>*</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{f.hint}</div>
                          </div>

                          {/* Column 2: Searchable Dropdown for File NVC */}
                          <div>
                            {hasNvc ? (
                              <SearchableSelect
                                options={nvcHeaders.map(h => ({ value: h, label: h, badge: 'NVC', badgeType: 'nvc' }))}
                                value={nvcVal}
                                onChange={(val) => updateNvcField(f.keyNvc!, val)}
                                placeholder={nvcHeaders.length > 0 ? `🔍 Cột File NVC...` : '⚠️ Vui lòng tải file NVC'}
                              />
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>-- Không dùng NVC --</span>
                            )}
                          </div>

                          {/* Column 3: Searchable Dropdown for File App */}
                          <div>
                            {hasApp ? (
                              appHeaders.length > 0 ? (
                                <SearchableSelect
                                  options={appHeaders.map(h => ({ value: h, label: h, badge: 'App', badgeType: 'app' }))}
                                  value={appVal}
                                  onChange={(val) => updateAppField(f.keyApp!, val)}
                                  placeholder="🔍 Cột File App..."
                                />
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>⚡ Tự động đọc từ File NVC (Chế độ 1 File)</span>
                              )
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>-- Không dùng App --</span>
                            )}
                          </div>

                          {/* Column 4: AI Match Status Badge */}
                          <div>
                            {isFullyMatched ? (
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--success)',
                                background: 'rgba(34, 197, 94, 0.12)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                padding: '4px 10px',
                                borderRadius: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                🟢 ✓ {appHeaders.length > 0 ? 'Khớp 2 file' : 'Đã chọn cột NVC'}
                              </span>
                            ) : (
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#b45309',
                                background: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '4px 10px',
                                borderRadius: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                ⚠️ Cần chọn cột
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══════════════════════════════════════════ */}
          {/* TAB 2: MẪU XUẤT EXCEL (3-PANEL VISUAL COLUMNS WORKSPACE) */}
          {/* ═══════════════════════════════════════════ */}
          {mainTab === 'export' && (() => {
            const handleAddAllToTarget = (target: 'shop' | 'master') => {
              const currentCols = target === 'shop' ? exportSettings.shopColumns : exportSettings.masterColumns;
              const existingSourceHeaders = new Set(currentCols.map(c => c.sourceHeader).filter(Boolean));

              const newItems: ExportColumnItem[] = [];

              allScannedHeaders.forEach(h => {
                if (!existingSourceHeaders.has(h)) {
                  newItems.push({
                    id: `col_scanned_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    label: h,
                    enabled: true,
                    category: 'custom',
                    sourceHeader: h,
                  });
                }
              });

              // Enable all existing columns
              const updatedCurrent = currentCols.map(c => ({ ...c, enabled: true }));
              const combined = [...updatedCurrent, ...newItems];

              const updatedSettings = {
                ...exportSettings,
                [target === 'shop' ? 'shopColumns' : 'masterColumns']: combined,
              };

              setExportSettings(updatedSettings);
              triggerAutoSave(localNvcMapping, localAppMapping, updatedSettings);
              showToast(`Đã chọn tất cả ${combined.length} cột vào ${target === 'shop' ? 'Bảng Kê Shop' : 'Báo Cáo Tổng Hợp'}!`, 'success');
            };

            const handleToggleCol = (target: 'shop' | 'master', colId: string) => {
              const listKey = target === 'shop' ? 'shopColumns' : 'masterColumns';
              const updatedList = exportSettings[listKey].map(c => c.id === colId ? { ...c, enabled: !c.enabled } : c);
              const updatedSettings = { ...exportSettings, [listKey]: updatedList };
              setExportSettings(updatedSettings);
              triggerAutoSave(localNvcMapping, localAppMapping, updatedSettings);
            };

            const handleMoveCol = (target: 'shop' | 'master', index: number, direction: 'up' | 'down') => {
              const listKey = target === 'shop' ? 'shopColumns' : 'masterColumns';
              const list = [...exportSettings[listKey]];
              const targetIdx = direction === 'up' ? index - 1 : index + 1;
              if (targetIdx < 0 || targetIdx >= list.length) return;
              const temp = list[index];
              list[index] = list[targetIdx];
              list[targetIdx] = temp;
              const updatedSettings = { ...exportSettings, [listKey]: list };
              setExportSettings(updatedSettings);
              triggerAutoSave(localNvcMapping, localAppMapping, updatedSettings);
            };

            const handleRemoveCol = (target: 'shop' | 'master', colId: string) => {
              const listKey = target === 'shop' ? 'shopColumns' : 'masterColumns';
              const updatedList = exportSettings[listKey].filter(c => c.id !== colId);
              const updatedSettings = { ...exportSettings, [listKey]: updatedList };
              setExportSettings(updatedSettings);
              triggerAutoSave(localNvcMapping, localAppMapping, updatedSettings);
            };

            const handleUpdateLabel = (target: 'shop' | 'master', colId: string, newLabel: string) => {
              const listKey = target === 'shop' ? 'shopColumns' : 'masterColumns';
              const updatedList = exportSettings[listKey].map(c => c.id === colId ? { ...c, label: newLabel } : c);
              const updatedSettings = { ...exportSettings, [listKey]: updatedList };
              setExportSettings(updatedSettings);
              triggerAutoSave(localNvcMapping, localAppMapping, updatedSettings);
            };

            const handleAddHeaderToTarget = (target: 'shop' | 'master', headerName: string) => {
              const listKey = target === 'shop' ? 'shopColumns' : 'masterColumns';
              const list = exportSettings[listKey];

              // Check if already exists
              const existing = list.find(c => c.sourceHeader === headerName || c.label === headerName || c.id === headerName);
              if (existing) {
                if (!existing.enabled) {
                  handleToggleCol(target, existing.id);
                } else {
                  showToast(`Cột "${headerName}" đã có trong danh sách!`, 'info');
                }
                return;
              }

              const newCol: ExportColumnItem = {
                id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                label: headerName,
                enabled: true,
                category: 'custom',
                sourceHeader: headerName,
              };

              const updatedSettings = {
                ...exportSettings,
                [listKey]: [...list, newCol],
              };
              setExportSettings(updatedSettings);
              triggerAutoSave(localNvcMapping, localAppMapping, updatedSettings);
              showToast(`Đã thêm cột "${headerName}" vào ${target === 'shop' ? 'Bảng Kê Shop' : 'Báo Cáo Tổng'}!`, 'success');
            };

            return (
              <div>
                {/* Security notice bar */}
                <div style={{
                  background: 'rgba(79, 70, 229, 0.05)',
                  border: '1px dashed var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--text-main)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <ShieldAlert size={15} color="var(--primary)" />
                  <span>
                    <strong>Thiết Kế Trực Quan 3 Bảng:</strong> Chọn cột bên trái hoặc bấm ⚡ Chọn tất cả để đẩy tự động sang <strong>Bảng Kê Shop (Sheet 2)</strong> và <strong>Báo Cáo Tổng Hợp Gom Đơn (Sheet 1)</strong>.
                  </span>
                </div>

                {/* 🌟 3-PANEL VISUAL WORKSPACE */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '250px 1fr 1fr',
                  gap: 12,
                  alignItems: 'start',
                }}>
                  {/* PANEL 1: KHO CỘT KHẢ DỤNG (LEFT POOL) */}
                  <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span>🎯 KHO CỘT ({allScannedHeaders.length} CỘT)</span>
                    </div>

                    <div style={{ padding: 8 }}>
                      {/* 1-Click Select All Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleAddAllToTarget('shop')}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 10, padding: '4px 6px', justifyContent: 'center', width: '100%' }}
                        >
                          <Zap size={11} color="var(--warning)" />
                          <span>⚡ Chọn tất cả vào Shop</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddAllToTarget('master')}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 10, padding: '4px 6px', justifyContent: 'center', width: '100%' }}
                        >
                          <Zap size={11} color="var(--primary)" />
                          <span>⚡ Chọn tất cả vào Báo Cáo</span>
                        </button>
                      </div>

                      <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {allScannedHeaders.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: 6, textAlign: 'center' }}>
                            Chưa có cột quét từ Excel.
                          </div>
                        ) : (
                          allScannedHeaders.map(h => (
                            <div key={h} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 7px',
                              background: 'var(--bg-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 11,
                              gap: 4
                            }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={h}>
                                {h}
                              </div>
                              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => handleAddHeaderToTarget('shop', h)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 9, padding: '1px 4px' }}
                                  title="Thêm vào Bảng kê Shop"
                                >
                                  + Shop
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddHeaderToTarget('master', h)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: 9, padding: '1px 4px' }}
                                  title="Thêm vào Báo cáo Tổng"
                                >
                                  + Tổng
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PANEL 2: BẢNG KÊ CHI TIẾT SHOP (MIDDLE) */}
                  <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span>📄 BẢNG KÊ SHOP ({exportSettings.shopColumns.filter(c => c.enabled).length}/{exportSettings.shopColumns.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = exportSettings.shopColumns.map(c => ({ ...c, enabled: true }));
                          setExportSettings({ ...exportSettings, shopColumns: updated });
                          triggerAutoSave(localNvcMapping, localAppMapping, { ...exportSettings, shopColumns: updated });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 9, padding: '2px 5px' }}
                      >
                        Bật Hết
                      </button>
                    </div>

                    <div style={{ padding: 8, maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {exportSettings.shopColumns.map((col, idx) => (
                        <div key={col.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 7px',
                          background: col.enabled ? 'var(--bg-primary)' : 'rgba(0, 0, 0, 0.03)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          opacity: col.enabled ? 1 : 0.55,
                        }}>
                          <input
                            type="checkbox"
                            checked={col.enabled}
                            onChange={() => handleToggleCol('shop', col.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => handleUpdateLabel('shop', col.id, e.target.value)}
                            className="input-field"
                            style={{ padding: '2px 5px', fontSize: 11, flex: 1 }}
                          />
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button
                              type="button"
                              onClick={() => handleMoveCol('shop', idx, 'up')}
                              disabled={idx === 0}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: 'var(--text-muted)' }}
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCol('shop', idx, 'down')}
                              disabled={idx === exportSettings.shopColumns.length - 1}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: 'var(--text-muted)' }}
                            >
                              <ArrowDown size={11} />
                            </button>
                            {col.category === 'custom' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCol('shop', col.id)}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: 'var(--danger)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PANEL 3: BÁO CÁO TỔNG HỢP GOM ĐƠN (RIGHT) */}
                  <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span>📊 BÁO CÁO TỔNG ({exportSettings.masterColumns.filter(c => c.enabled).length}/{exportSettings.masterColumns.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = exportSettings.masterColumns.map(c => ({ ...c, enabled: true }));
                          setExportSettings({ ...exportSettings, masterColumns: updated });
                          triggerAutoSave(localNvcMapping, localAppMapping, { ...exportSettings, masterColumns: updated });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 9, padding: '2px 5px' }}
                      >
                        Bật Hết
                      </button>
                    </div>

                    <div style={{ padding: 8, maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {exportSettings.masterColumns.map((col, idx) => (
                        <div key={col.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 7px',
                          background: col.enabled ? 'var(--bg-primary)' : 'rgba(0, 0, 0, 0.03)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          opacity: col.enabled ? 1 : 0.55,
                        }}>
                          <input
                            type="checkbox"
                            checked={col.enabled}
                            onChange={() => handleToggleCol('master', col.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => handleUpdateLabel('master', col.id, e.target.value)}
                            className="input-field"
                            style={{ padding: '2px 5px', fontSize: 11, flex: 1 }}
                          />
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button
                              type="button"
                              onClick={() => handleMoveCol('master', idx, 'up')}
                              disabled={idx === 0}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: 'var(--text-muted)' }}
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCol('master', idx, 'down')}
                              disabled={idx === exportSettings.masterColumns.length - 1}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: 'var(--text-muted)' }}
                            >
                              <ArrowDown size={11} />
                            </button>
                            {col.category === 'custom' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCol('master', col.id)}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 1, color: 'var(--danger)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

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
