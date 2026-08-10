import React, { useState } from 'react';
import { Settings2, Check, X, RotateCcw, FileSpreadsheet, Layers, Eye, ShieldAlert, ArrowUp, ArrowDown } from 'lucide-react';
import type { ExportColumnSettings } from '../types';
import { StorageService, DEFAULT_EXPORT_COLUMNS } from '../services/storage';

interface ExportColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: ExportColumnSettings) => void;
  carrierId?: string;
  carrierName?: string;
}

export const ExportColumnConfigModal: React.FC<ExportColumnConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  carrierId,
  carrierName,
}) => {
  const [activeTab, setActiveTab] = useState<'shop' | 'master'>('shop');
  const [settings, setSettings] = useState<ExportColumnSettings>(() => {
    if (carrierId) {
      return StorageService.getCarrierExportSettings(carrierId);
    }
    return StorageService.getExportColumnSettings();
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentColumns = activeTab === 'shop' ? settings.shopColumns : settings.masterColumns;

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

  const handleResetDefaults = () => {
    if (confirm('Bạn có chắc muốn khôi phục lại danh sách cột xuất Excel mặc định?')) {
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
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

                  {/* Up & Down Reorder Buttons */}
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
                  </div>
                </div>
              );
            })}
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
