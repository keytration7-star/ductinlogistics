import React, { useState, useMemo } from 'react';
import { Settings2, Check, X, RotateCcw, FileSpreadsheet, Layers, Eye, ShieldAlert, ArrowUp, ArrowDown, GripVertical, Plus, Trash2, Sparkles } from 'lucide-react';
import type { ExportColumnSettings, ExportColumnItem } from '../types';
import { StorageService, DEFAULT_EXPORT_COLUMNS } from '../services/storage';

import { useConfirm } from './UIFeedback';

interface ExportColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: ExportColumnSettings) => void;
  carrierId?: string;
  carrierName?: string;
  availableFileHeaders?: {
    nvcHeaders?: string[];
    appHeaders?: string[];
  };
}

export const ExportColumnConfigModal: React.FC<ExportColumnConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  carrierId,
  carrierName,
  availableFileHeaders,
}) => {
  const { showConfirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'shop' | 'master'>('shop');
  const [settings, setSettings] = useState<ExportColumnSettings>(() => {
    if (carrierId) {
      return StorageService.getCarrierExportSettings(carrierId);
    }
    return StorageService.getExportColumnSettings();
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [customInputName, setCustomInputName] = useState('');
  // Drag & drop state for export column reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const currentColumns = activeTab === 'shop' ? settings.shopColumns : settings.masterColumns;

  // Extract all unique headers from loaded NVC & App files
  const fileHeaders = useMemo(() => {
    const set = new Set<string>();
    (availableFileHeaders?.nvcHeaders || []).forEach(h => { if (h && h.trim()) set.add(h.trim()); });
    (availableFileHeaders?.appHeaders || []).forEach(h => { if (h && h.trim()) set.add(h.trim()); });
    return Array.from(set);
  }, [availableFileHeaders]);

  const unaddedHeaders = useMemo(() => {
    const existingLabels = new Set(currentColumns.map(c => c.label.toLowerCase().trim()));
    const existingSources = new Set(currentColumns.map(c => (c.sourceHeader || '').toLowerCase().trim()));
    return fileHeaders.filter(h => !existingLabels.has(h.toLowerCase().trim()) && !existingSources.has(h.toLowerCase().trim()));
  }, [fileHeaders, currentColumns]);

  const handleAddCustomColumn = (headerName: string) => {
    if (!headerName.trim()) return;
    const name = headerName.trim();
    const newCol: ExportColumnItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: name,
      enabled: true,
      category: 'custom',
      sourceHeader: name,
    };
    const updatedCols = [...currentColumns, newCol];
    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
    setCustomInputName('');
  };

  const handleRemoveCustomColumn = (colId: string) => {
    const updatedCols = currentColumns.filter(c => c.id !== colId);
    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
  };

  if (!isOpen) return null;

  const handleToggleColumn = (colId: string) => {
    if (colId === 'stt' || colId === 'waybill') return; // Cannot disable primary key

    const updatedCols = currentColumns.map(col => {
      if (col.id === colId) {
        return { ...col, enabled: !col.enabled };
      }
      return col;
    });

    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
  };

  const handleMoveColumn = (colId: string, direction: 'up' | 'down') => {
    const idx = currentColumns.findIndex(col => col.id === colId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentColumns.length) return;

    const updatedCols = [...currentColumns];
    const [movedCol] = updatedCols.splice(idx, 1);
    updatedCols.splice(newIdx, 0, movedCol);

    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
  };

  const handleDropColumn = (targetIdx: number) => {
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updatedCols = [...currentColumns];
    const [movedCol] = updatedCols.splice(draggedIndex, 1);
    updatedCols.splice(targetIdx, 0, movedCol);

    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSelectAll = (enabled: boolean) => {
    const updatedCols = currentColumns.map(col => {
      if (col.id === 'stt' || col.id === 'waybill') return col;
      return { ...col, enabled };
    });

    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
  };

  const handleResetDefaults = async () => {
    const ok = await showConfirm({
      title: 'KHÔI PHỤC MẶC ĐỊNH',
      message: 'Bạn có chắc muốn khôi phục lại danh sách cột xuất Excel mặc định?',
      confirmText: 'Khôi phục',
      warning: true,
    });
    if (ok) {
      const defaultClone = JSON.parse(JSON.stringify(DEFAULT_EXPORT_COLUMNS));
      setSettings(defaultClone);
      if (carrierId) {
        StorageService.saveCarrierExportSettings(carrierId, defaultClone);
      } else {
        StorageService.saveExportColumnSettings(defaultClone);
      }
    }
  };

  const handleSave = () => {
    if (carrierId) {
      StorageService.saveCarrierExportSettings(carrierId, settings);
    } else {
      StorageService.saveExportColumnSettings(settings);
    }
    if (onSave) onSave(settings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 400);
  };

  const enabledCount = currentColumns.filter(c => c.enabled).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 780 }}
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
              <Settings2 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                  Tùy Chọn Cột Khi Xuất File Excel
                </h3>
                {carrierName && (
                  <span className="badge badge-primary" style={{ fontSize: 12, padding: '2px 8px' }}>
                    📦 {carrierName}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {carrierName
                  ? `Cấu hình cột xuất này áp dụng riêng cho hồ sơ ${carrierName}!`
                  : 'Tự do bật/tắt các cột dữ liệu theo nhu cầu quản lý hoặc bảo mật thông tin gửi khách hàng.'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          padding: '0 20px',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              color: activeTab === 'shop' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'shop' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FileSpreadsheet size={16} />
            <span>1. Bảng Kê Gửi Cho Shop ({settings.shopColumns.filter(c => c.enabled).length}/{settings.shopColumns.length} cột)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('master')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              color: activeTab === 'master' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'master' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Layers size={16} />
            <span>2. Báo Cáo Tổng Hợp Gom Đơn ({settings.masterColumns.filter(c => c.enabled).length}/{settings.masterColumns.length} cột)</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 24, maxHeight: 460, overflowY: 'auto' }}>
          
          {/* Quick Actions Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            background: 'var(--bg-secondary)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Đang chọn: <strong style={{ color: 'var(--primary)' }}>{enabledCount} cột</strong> sẽ xuất ra Excel
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Chọn Tất Cả
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
              >
                Bỏ Chọn Hết
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '4px 8px' }}
                title="Khôi phục mặc định"
              >
                <RotateCcw size={12} />
                <span>Mặc định</span>
              </button>
            </div>
          </div>

          {activeTab === 'shop' && (
            <div style={{
              background: 'rgba(79, 70, 229, 0.05)',
              border: '1px dashed var(--primary)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--text-main)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <ShieldAlert size={16} color="var(--primary)" />
              <span>
                <strong>Lưu ý bảo mật:</strong> Các cột <em>Cước gốc NVC</em> và <em>Lợi nhuận gom đơn</em> đã được tự động ẩn khỏi file của Shop để bảo mật biên lợi nhuận của bạn.
              </span>
            </div>
          )}

          {/* Grid of Checkboxes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}>
            {currentColumns.map((col, idx) => {
              const isMandatory = col.id === 'stt' || col.id === 'waybill';
              return (
                <div
                  key={col.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(idx));
                    setDraggedIndex(idx);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropColumn(idx);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: draggedIndex === idx
                      ? 'var(--bg-tertiary)'
                      : dragOverIndex === idx
                      ? 'rgba(79, 70, 229, 0.12)'
                      : col.enabled ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                    border: dragOverIndex === idx
                      ? '2px dashed var(--primary)'
                      : col.enabled ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    cursor: 'grab',
                    transition: 'all 0.15s ease',
                    opacity: draggedIndex === idx ? 0.4 : isMandatory ? 0.85 : 1,
                  }}
                >
                  {/* Drag Handle Icon */}
                  <div
                    style={{ color: 'var(--text-dim)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    title="Giữ và kéo thả để đổi thứ tự vị trí cột"
                  >
                    <GripVertical size={15} />
                  </div>

                  <input
                    type="checkbox"
                    checked={col.enabled}
                    disabled={isMandatory}
                    onChange={() => handleToggleColumn(col.id)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: isMandatory ? 'not-allowed' : 'pointer' }}
                  />
                  <div style={{ flex: 1, minWidth: 0, cursor: isMandatory ? 'not-allowed' : 'pointer' }} onClick={() => !isMandatory && handleToggleColumn(col.id)}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: col.enabled ? 700 : 500,
                      color: col.enabled ? 'var(--text-main)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>#{idx + 1}</span>
                      {col.label}
                    </div>
                    {isMandatory && (
                      <div style={{ fontSize: 10, color: 'var(--primary)' }}>Cột bắt buộc</div>
                    )}
                  </div>

                  {/* Up & Down Reorder & Delete Buttons */}
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); handleMoveColumn(col.id, 'up'); }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 5px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                      title="Di chuyển cột lên trước"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentColumns.length - 1}
                      onClick={(e) => { e.stopPropagation(); handleMoveColumn(col.id, 'down'); }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 5px', opacity: idx === currentColumns.length - 1 ? 0.3 : 1, cursor: idx === currentColumns.length - 1 ? 'not-allowed' : 'pointer' }}
                      title="Di chuyển cột xuống sau"
                    >
                      <ArrowDown size={13} />
                    </button>
                    {col.category === 'custom' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveCustomColumn(col.id); }}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '2px 5px', marginLeft: 2 }}
                        title="Xóa cột tùy chỉnh này"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CỘT QUÉT ĐƯỢC TỪ FILE NVC VÀ FILE APP */}
          {unaddedHeaders.length > 0 && (
            <div style={{
              marginTop: 16,
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#047857', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="#059669" />
                <span>Cột Quét Được Từ 2 File (NVC & App) Có Thể Thêm Vào Bảng Xuất:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {unaddedHeaders.map((header) => (
                  <button
                    key={header}
                    type="button"
                    onClick={() => handleAddCustomColumn(header)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      background: '#fff',
                      border: '1px solid #10b981',
                      color: '#047857',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title={`Thêm cột "${header}" vào danh sách xuất`}
                  >
                    <Plus size={11} />
                    <span>{header}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* THÊM CỘT TÙY CHỈNH THỦ CÔNG */}
          <div style={{
            marginTop: 12,
            background: 'var(--bg-secondary)',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={14} color="var(--primary)" />
              <span>Thêm Cột Tùy Chỉnh Khác:</span>
            </div>
            <input
              type="text"
              placeholder="Nhập tên cột trong file Excel (ví dụ: Ghi chú, Lý do hoàn...)"
              value={customInputName}
              onChange={(e) => setCustomInputName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomColumn(customInputName);
                }
              }}
              className="input-field"
              style={{ flex: 1, minWidth: 200, padding: '5px 10px', fontSize: 12 }}
            />
            <button
              type="button"
              onClick={() => handleAddCustomColumn(customInputName)}
              disabled={!customInputName.trim()}
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12, padding: '5px 12px', fontWeight: 700 }}
            >
              + Thêm Cột
            </button>
          </div>

          {/* Preview Row Header */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={14} /> Xem trước hàng tiêu đề cột trong file Excel:
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              background: 'var(--bg-tertiary)',
              padding: 10,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}>
              {currentColumns.filter(c => c.enabled).map((c, idx) => (
                <span
                  key={c.id}
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-main)',
                  }}
                >
                  {idx + 1}. {c.label}
                </span>
              ))}
            </div>
          </div>

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
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Cấu hình này sẽ được lưu tự động cho mọi lần xuất file Excel sau này.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Hủy Bỏ
            </button>
            <button type="button" onClick={handleSave} className="btn btn-primary">
              <Check size={16} />
              <span>{savedSuccess ? 'Đã Lưu Thành Công!' : 'Lưu Cấu Hình Xuất Excel'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
