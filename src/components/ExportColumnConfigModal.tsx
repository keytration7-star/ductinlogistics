import React, { useState, useMemo } from 'react';
import { 
  Settings2, 
  Check, 
  X, 
  RotateCcw, 
  FileSpreadsheet, 
  Layers, 
  Eye, 
  ShieldAlert, 
  ArrowUp, 
  ArrowDown, 
  GripVertical, 
  Plus, 
  Trash2, 
  Search, 
  FileText
} from 'lucide-react';
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

interface ActualFileColumn {
  name: string;
  origin: 'nvc' | 'app' | 'both';
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
  
  // Search & Filter state for selecting columns from the 2 files
  const [searchKeyword, setSearchKeyword] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | 'nvc' | 'app'>('all');

  // Drag & drop state for export column reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const currentColumns = activeTab === 'shop' ? settings.shopColumns : settings.masterColumns;

  // 🌟 Extract all unique actual columns from File 1 (NVC) and File 2 (App)
  const actualFileColumns = useMemo<ActualFileColumn[]>(() => {
    const nvcCols = (availableFileHeaders?.nvcHeaders || []).filter(h => h && h.trim());
    const appCols = (availableFileHeaders?.appHeaders || []).filter(h => h && h.trim());
    const appSet = new Set(appCols.map(c => c.trim()));

    const allMap = new Map<string, 'nvc' | 'app' | 'both'>();

    nvcCols.forEach(h => {
      const trimmed = h.trim();
      allMap.set(trimmed, appSet.has(trimmed) ? 'both' : 'nvc');
    });

    appCols.forEach(h => {
      const trimmed = h.trim();
      if (!allMap.has(trimmed)) {
        allMap.set(trimmed, 'app');
      }
    });

    return Array.from(allMap.entries()).map(([name, origin]) => ({
      name,
      origin,
    }));
  }, [availableFileHeaders]);

  // Filtered actual file columns based on search keyword & file origin tab
  const filteredFileColumns = useMemo(() => {
    const query = searchKeyword.toLowerCase().trim();
    return actualFileColumns.filter(item => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      if (fileFilter === 'nvc') return item.origin === 'nvc' || item.origin === 'both';
      if (fileFilter === 'app') return item.origin === 'app' || item.origin === 'both';
      return true;
    });
  }, [actualFileColumns, searchKeyword, fileFilter]);

  // Helper to check if an actual file column is already added in the export list
  const isColumnAdded = (colName: string) => {
    const norm = colName.toLowerCase().trim();
    return currentColumns.some(
      c => c.label.toLowerCase().trim() === norm || (c.sourceHeader && c.sourceHeader.toLowerCase().trim() === norm)
    );
  };

  const handleAddFileColumn = (fileCol: ActualFileColumn) => {
    if (isColumnAdded(fileCol.name)) return;

    const newCol: ExportColumnItem = {
      id: `file_col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: fileCol.name,
      enabled: true,
      category: fileCol.origin === 'nvc' ? 'carrier' : 'basic',
      sourceHeader: fileCol.name,
    };

    const updatedCols = [...currentColumns, newCol];
    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
  };

  const handleRemoveColumn = (colId: string) => {
    if (colId === 'stt' || colId === 'waybill') return; // Cannot remove primary key
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

        {/* Scrollable Content Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Quick Actions Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              Đang chọn: <strong style={{ color: 'var(--primary)', fontSize: 14 }}>{enabledCount} cột</strong> sẽ xuất ra Excel
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <ShieldAlert size={16} color="var(--primary)" />
              <span>
                <strong>Lưu ý bảo mật:</strong> Các cột <em>Cước gốc NVC</em> và <em>Lợi nhuận gom đơn</em> tự động ẩn khỏi file của Shop để bảo mật biên lợi nhuận của bạn.
              </span>
            </div>
          )}

          {/* 🌟 SECTION 1: DANH SÁCH CÁC CỘT ĐÃ CHỌN SẼ XUẤT RA EXCEL */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={15} color="var(--primary)" />
                <span>Danh Sách Cột Sẽ Xuất Ra File ({currentColumns.length} cột):</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
                (Giữ và kéo chuột để đổi thứ tự cột xuất)
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 8,
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
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: draggedIndex === idx
                        ? 'var(--bg-tertiary)'
                        : dragOverIndex === idx
                        ? 'rgba(79, 70, 229, 0.12)'
                        : col.enabled ? '#f0fdf4' : '#ffffff',
                      border: dragOverIndex === idx
                        ? '2px dashed var(--primary)'
                        : col.enabled ? '1.5px solid #86efac' : '1px solid var(--border-color)',
                      cursor: 'grab',
                      transition: 'all 0.15s ease',
                      opacity: draggedIndex === idx ? 0.4 : isMandatory ? 0.9 : 1,
                    }}
                  >
                    {/* Drag Handle */}
                    <div
                      style={{ color: 'var(--text-dim)', cursor: 'grab', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      title="Giữ và kéo thả để đổi thứ tự cột"
                    >
                      <GripVertical size={14} />
                    </div>

                    <input
                      type="checkbox"
                      checked={col.enabled}
                      disabled={isMandatory}
                      onChange={() => handleToggleColumn(col.id)}
                      style={{ width: 16, height: 16, accentColor: '#10b981', cursor: isMandatory ? 'not-allowed' : 'pointer' }}
                    />

                    <div style={{ flex: 1, minWidth: 0, cursor: isMandatory ? 'not-allowed' : 'pointer' }} onClick={() => !isMandatory && handleToggleColumn(col.id)}>
                      <div style={{
                        fontSize: 12.5,
                        fontWeight: col.enabled ? 700 : 500,
                        color: col.enabled ? '#14532d' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 4 }}>#{idx + 1}</span>
                        {col.label}
                      </div>
                      <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        {isMandatory ? (
                          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Cột bắt buộc</span>
                        ) : col.sourceHeader ? (
                          <span style={{ color: '#047857', fontWeight: 600 }}>Cột gốc trong file: {col.sourceHeader}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Hệ thống Gom Đơn</span>
                        )}
                      </div>
                    </div>

                    {/* Up & Down & Remove Buttons */}
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); handleMoveColumn(col.id, 'up'); }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 4px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        title="Đẩy lên trước"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === currentColumns.length - 1}
                        onClick={(e) => { e.stopPropagation(); handleMoveColumn(col.id, 'down'); }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 4px', opacity: idx === currentColumns.length - 1 ? 0.3 : 1, cursor: idx === currentColumns.length - 1 ? 'not-allowed' : 'pointer' }}
                        title="Đẩy xuống sau"
                      >
                        <ArrowDown size={12} />
                      </button>
                      {!isMandatory && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveColumn(col.id); }}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '2px 4px', marginLeft: 2 }}
                          title="Bỏ cột này khỏi danh sách xuất"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🌟 SECTION 2: TÌM KIẾM & THÊM CỘT THỰC TẾ TỪ 2 FILE (FILE NVC & FILE APP) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
            border: '1.5px solid rgba(79, 70, 229, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={16} />
                <span>Tìm Kiếm & Thêm Cột Thực Tế Từ 2 File (File NVC & File App)</span>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setFileFilter('all')}
                  className={`btn btn-sm ${fileFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  Tất cả ({actualFileColumns.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFileFilter('nvc')}
                  className={`btn btn-sm ${fileFilter === 'nvc' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  📦 File NVC ({actualFileColumns.filter(c => c.origin === 'nvc' || c.origin === 'both').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFileFilter('app')}
                  className={`btn btn-sm ${fileFilter === 'app' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  📱 File App ({actualFileColumns.filter(c => c.origin === 'app' || c.origin === 'both').length})
                </button>
              </div>
            </div>

            {/* Search Input Box */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={15} color="var(--text-dim)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Nhập từ khóa tìm cột trong 2 File (ví dụ: ngày, mã, cước, phí, trọng lượng, người nhận, sđt, trạng thái...)"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="input-field"
                style={{ width: '100%', paddingLeft: 34, paddingRight: 30, fontSize: 12.5, background: '#fff' }}
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* List of matching columns from the 2 files */}
            {actualFileColumns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)', background: '#fff', borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                Chưa có file nào được nạp trong phiên làm việc. Hãy kéo thả file đối soát ở Bước 1 để hiển thị đầy đủ tất cả các cột thực tế của file!
              </div>
            ) : filteredFileColumns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '14px 12px', fontSize: 12, color: 'var(--text-muted)', background: '#fff', borderRadius: 8 }}>
                Không tìm thấy cột nào khớp với từ khóa "{searchKeyword}".
              </div>
            ) : (
              <div style={{
                maxHeight: 180,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 6,
                padding: 4,
              }}>
                {filteredFileColumns.map((col) => {
                  const added = isColumnAdded(col.name);
                  return (
                    <div
                      key={col.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: added ? '#f0fdf4' : '#ffffff',
                        border: added ? '1px solid #86efac' : '1px solid var(--border-color)',
                        gap: 6,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: added ? 700 : 500,
                          color: added ? '#047857' : 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }} title={col.name}>
                          {col.name}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          {col.origin === 'nvc' ? (
                            <span style={{ color: '#2563eb' }}>📦 File NVC</span>
                          ) : col.origin === 'app' ? (
                            <span style={{ color: '#059669' }}>📱 File App</span>
                          ) : (
                            <span style={{ color: '#7c3aed' }}>🔗 Cả 2 File</span>
                          )}
                        </div>
                      </div>

                      {added ? (
                        <span style={{
                          fontSize: 10,
                          color: '#059669',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          background: '#d1fae5',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          <Check size={10} /> Đã có
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddFileColumn(col)}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px', fontWeight: 700 }}
                          title={`Thêm cột "${col.name}" vào danh sách xuất`}
                        >
                          <Plus size={11} />
                          <span>Thêm</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview Row Header */}
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
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
              maxHeight: 90,
              overflowY: 'auto',
            }}>
              {currentColumns.filter(c => c.enabled).map((c, idx) => (
                <span
                  key={c.id}
                  style={{
                    background: '#ffffff',
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
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
          flexShrink: 0,
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
