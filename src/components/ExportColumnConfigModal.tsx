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
  Sparkles,
  Zap
} from 'lucide-react';
import type { ExportColumnSettings, ExportColumnItem } from '../types';
import { StorageService, DEFAULT_EXPORT_COLUMNS } from '../services/storage';
import { useConfirm, useToast } from './UIFeedback';

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
  const { showToast } = useToast();
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

  // Drag & drop state for column reordering and moving across panels
  const [draggingSourceCol, setDraggingSourceCol] = useState<string | null>(null);
  const [draggedRightIndex, setDraggedRightIndex] = useState<number | null>(null);
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

  const handleAddFileColumn = (fileCol: ActualFileColumn, targetIndex?: number) => {
    const norm = fileCol.name.toLowerCase().trim();
    const existingIdx = currentColumns.findIndex(
      c => c.label.toLowerCase().trim() === norm || (c.sourceHeader && c.sourceHeader.toLowerCase().trim() === norm)
    );

    if (existingIdx >= 0) {
      // If already present but disabled, enable it!
      const updated = currentColumns.map((c, i) => i === existingIdx ? { ...c, enabled: true } : c);
      setSettings({
        ...settings,
        [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updated,
      });
      showToast(`Cột "${fileCol.name}" đã được bật trong danh sách xuất!`, 'info');
      return;
    }

    const newCol: ExportColumnItem = {
      id: `file_col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: fileCol.name,
      enabled: true,
      category: fileCol.origin === 'nvc' ? 'carrier' : 'basic',
      sourceHeader: fileCol.name,
    };

    const updatedCols = [...currentColumns];
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= updatedCols.length) {
      updatedCols.splice(targetIndex, 0, newCol);
    } else {
      updatedCols.push(newCol);
    }

    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
    };
    setSettings(newSettings);
    showToast(`Đã thêm cột "${fileCol.name}" vào danh sách xuất!`, 'success');
  };

  const handleAddAllSourceColumns = () => {
    const existingSourceHeaders = new Set(
      currentColumns.map(c => (c.sourceHeader || c.label).toLowerCase().trim())
    );

    const newItems: ExportColumnItem[] = [];
    filteredFileColumns.forEach(item => {
      const norm = item.name.toLowerCase().trim();
      if (!existingSourceHeaders.has(norm)) {
        newItems.push({
          id: `file_col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: item.name,
          enabled: true,
          category: item.origin === 'nvc' ? 'carrier' : 'basic',
          sourceHeader: item.name,
        });
      }
    });

    const updatedCurrent = currentColumns.map(c => ({ ...c, enabled: true }));
    const combined = [...updatedCurrent, ...newItems];

    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: combined,
    };
    setSettings(newSettings);
    showToast(`Đã thêm toàn bộ ${newItems.length} cột mới vào danh sách xuất!`, 'success');
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

  const handleRemoveAllCustomColumns = async () => {
    const ok = await showConfirm({
      title: 'Xóa Toàn Bộ Cột Xuất',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ các cột tùy chọn và chỉ giữ lại STT và Mã Vận Đơn?',
      warning: true,
    });
    if (!ok) return;

    const baseCols = currentColumns.filter(c => c.id === 'stt' || c.id === 'waybill');
    const newSettings: ExportColumnSettings = {
      ...settings,
      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: baseCols,
    };
    setSettings(newSettings);
    showToast('Đã dọn dẹp danh sách cột xuất!', 'info');
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

  const handleUpdateColumnLabel = (colId: string, newLabel: string) => {
    const updatedCols = currentColumns.map(col => {
      if (col.id === colId) {
        return { ...col, label: newLabel };
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
      showToast('Đã khôi phục danh sách cột xuất mặc định!', 'success');
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
    showToast('Đã lưu cấu hình cột xuất file Excel thành công!', 'success');
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 300);
  };

  const enabledCount = currentColumns.filter(c => c.enabled).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 1060, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          flexShrink: 0,
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
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}>
              <Settings2 size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Cấu Hình & Kéo Thả Cột Xuất File Excel
                </h3>
                {carrierName && (
                  <span className="badge badge-primary" style={{ fontSize: 12, padding: '2px 8px' }}>
                    📦 {carrierName}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                Kéo thả các cột từ <strong>bên Trái (File Excel)</strong> sang <strong>bên Phải (Danh Sách Xuất)</strong> để tùy chỉnh mẫu file xuất.
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
          flexShrink: 0,
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
              borderBottom: activeTab === 'shop' ? '3px solid var(--primary)' : '3px solid transparent',
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
              borderBottom: activeTab === 'master' ? '3px solid var(--primary)' : '3px solid transparent',
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
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {activeTab === 'shop' && (
            <div style={{
              background: 'rgba(79, 70, 229, 0.05)',
              border: '1px dashed var(--primary)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              fontSize: 12,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <ShieldAlert size={16} color="var(--primary)" />
              <span>
                <strong>Bảo mật biên lợi nhuận:</strong> Các cột <em>Cước gốc NVC</em> và <em>Lợi nhuận gom đơn</em> tự động ẩn khỏi bảng kê của Shop.
              </span>
            </div>
          )}

          {/* 🌟 2-COLUMN SIDE-BY-SIDE VERTICAL WORKSPACE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 16,
            alignItems: 'stretch',
          }}>
            
            {/* ═══════════════════════════════════════════ */}
            {/* CỘT TRÁI (LEFT PANEL): CÁC CỘT CÓ TRONG FILE EXCEL */}
            {/* ═══════════════════════════════════════════ */}
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Header Left Panel */}
              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileSpreadsheet size={16} />
                  <span>CỘT CÓ TRONG FILE EXCEL ({actualFileColumns.length})</span>
                </div>

                {filteredFileColumns.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddAllSourceColumns}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '3px 8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Thêm tất cả các cột này vào danh sách xuất"
                  >
                    <Zap size={12} color="var(--warning)" />
                    <span>Thêm Hết</span>
                  </button>
                )}
              </div>

              {/* Search & Origin Filter Bar */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Tìm kiếm cột trong file..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12, padding: '6px 10px 6px 30px' }}
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => setSearchKeyword('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFileFilter('all')}
                    className={`btn btn-sm ${fileFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 7px' }}
                  >
                    Tất cả ({actualFileColumns.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileFilter('nvc')}
                    className={`btn btn-sm ${fileFilter === 'nvc' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 7px' }}
                  >
                    📦 File NVC ({actualFileColumns.filter(c => c.origin === 'nvc' || c.origin === 'both').length})
                  </button>
                  {actualFileColumns.some(c => c.origin === 'app' || c.origin === 'both') && (
                    <button
                      type="button"
                      onClick={() => setFileFilter('app')}
                      className={`btn btn-sm ${fileFilter === 'app' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 10, padding: '2px 7px' }}
                    >
                      📱 File App ({actualFileColumns.filter(c => c.origin === 'app' || c.origin === 'both').length})
                    </button>
                  )}
                </div>
              </div>

              {/* Source Column Draggable List */}
              <div 
                style={{ 
                  padding: 10, 
                  maxHeight: 460, 
                  overflowY: 'auto', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 6 
                }}
              >
                {filteredFileColumns.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                    {actualFileColumns.length === 0 
                      ? '⚠️ Chưa có cột nào từ File Excel. Hãy tải file đối soát lên để quét cột tự động!'
                      : 'Không tìm thấy cột phù hợp với từ khóa.'}
                  </div>
                ) : (
                  filteredFileColumns.map(item => {
                    const alreadyAdded = isColumnAdded(item.name);
                    const isDragging = draggingSourceCol === item.name;

                    return (
                      <div
                        key={item.name}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'from-left',
                            name: item.name,
                            origin: item.origin,
                          }));
                          setDraggingSourceCol(item.name);
                        }}
                        onDragEnd={() => {
                          setDraggingSourceCol(null);
                          setDragOverIndex(null);
                        }}
                        onDoubleClick={() => handleAddFileColumn(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          background: alreadyAdded ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                          border: alreadyAdded ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 12,
                          cursor: 'grab',
                          opacity: isDragging ? 0.4 : 1,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'all 0.15s ease',
                          gap: 6,
                        }}
                        title="Giữ chuột và kéo sang cột bên phải (hoặc bấm nút +)"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <GripVertical size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {item.origin === 'nvc' && (
                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                              NVC
                            </span>
                          )}
                          {item.origin === 'app' && (
                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#e0e7ff', color: '#3730a3', fontWeight: 700 }}>
                              App
                            </span>
                          )}
                          {item.origin === 'both' && (
                            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                              2 File
                            </span>
                          )}

                          {alreadyAdded ? (
                            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Check size={13} />
                              <span>Đã có</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddFileColumn(item)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: '2px 6px', fontWeight: 700 }}
                              title="Thêm cột này vào file xuất"
                            >
                              <Plus size={12} />
                              <span>Thêm</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* CỘT PHẢI (RIGHT PANEL): DANH SÁCH CỘT SẼ XUẤT RA FILE */}
            {/* ═══════════════════════════════════════════ */}
            <div 
              style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const rawData = e.dataTransfer.getData('application/json');
                if (!rawData) return;
                try {
                  const data = JSON.parse(rawData);
                  if (data.type === 'from-left') {
                    handleAddFileColumn({ name: data.name, origin: data.origin });
                  } else if (data.type === 'reorder-right' && typeof data.fromIndex === 'number') {
                    const targetIdx = currentColumns.length - 1;
                    const updated = [...currentColumns];
                    const [moved] = updated.splice(data.fromIndex, 1);
                    updated.splice(targetIdx, 0, moved);
                    setSettings({
                      ...settings,
                      [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updated,
                    });
                  }
                } catch {
                  // Ignore
                }
                setDragOverIndex(null);
              }}
            >
              {/* Header Right Panel */}
              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color="var(--primary)" />
                  <span>CỘT SẼ XUẤT RA FILE ({enabledCount}/{currentColumns.length} cột)</span>
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '2px 6px' }}
                    title="Bật tất cả cột"
                  >
                    Chọn Hết
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '2px 6px' }}
                    title="Bỏ chọn tất cả cột"
                  >
                    Bỏ Chọn
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '2px 6px' }}
                    title="Khôi phục mặc định"
                  >
                    <RotateCcw size={11} />
                    <span>Mặc Định</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveAllCustomColumns}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10.5, padding: '2px 6px', color: 'var(--danger)' }}
                    title="Xóa toàn bộ các cột tùy chỉnh"
                  >
                    <Trash2 size={11} />
                    <span>Xóa Hết</span>
                  </button>
                </div>
              </div>

              {/* Subtitle guidance */}
              <div style={{ padding: '6px 14px', background: 'rgba(59, 130, 246, 0.04)', borderBottom: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-muted)' }}>
                💡 <em>Giữ chuột và kéo lên/xuống để đổi thứ tự cột xuất. Đổi tên cột trực tiếp bằng cách gõ vào ô chữ.</em>
              </div>

              {/* Selected Columns Reorderable List */}
              <div 
                style={{ 
                  padding: 10, 
                  maxHeight: 460, 
                  overflowY: 'auto', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 6 
                }}
              >
                {currentColumns.length === 0 ? (
                  <div style={{
                    padding: 36,
                    textAlign: 'center',
                    border: '2px dashed var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Plus size={24} color="var(--primary)" />
                    <span>Kéo thả các cột từ <strong>bên Trái</strong> sang đây để cấu hình file xuất!</span>
                  </div>
                ) : (
                  currentColumns.map((col, idx) => {
                    const isMandatory = col.id === 'stt' || col.id === 'waybill';
                    const isOver = dragOverIndex === idx;

                    return (
                      <div
                        key={col.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'reorder-right',
                            fromIndex: idx,
                          }));
                          setDraggedRightIndex(idx);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIndex !== idx) setDragOverIndex(idx);
                        }}
                        onDragLeave={() => {
                          if (dragOverIndex === idx) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rawData = e.dataTransfer.getData('application/json');
                          if (!rawData) return;
                          try {
                            const data = JSON.parse(rawData);
                            if (data.type === 'from-left') {
                              handleAddFileColumn({ name: data.name, origin: data.origin }, idx);
                            } else if (data.type === 'reorder-right' && typeof data.fromIndex === 'number') {
                              if (data.fromIndex !== idx) {
                                const updatedCols = [...currentColumns];
                                const [moved] = updatedCols.splice(data.fromIndex, 1);
                                updatedCols.splice(idx, 0, moved);
                                setSettings({
                                  ...settings,
                                  [activeTab === 'shop' ? 'shopColumns' : 'masterColumns']: updatedCols,
                                });
                              }
                            }
                          } catch {
                            // Ignore
                          }
                          setDragOverIndex(null);
                          setDraggedRightIndex(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          background: col.enabled ? '#ffffff' : '#f8fafc',
                          border: isOver ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          opacity: draggedRightIndex === idx ? 0.35 : col.enabled ? 1 : 0.55,
                          cursor: 'grab',
                          boxShadow: isOver ? '0 4px 12px rgba(79, 70, 229, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'border 0.15s ease',
                        }}
                      >
                        {/* Drag Handle & Order Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            color: col.enabled ? 'var(--primary)' : 'var(--text-muted)',
                            background: col.enabled ? 'rgba(79, 70, 229, 0.08)' : 'rgba(0,0,0,0.05)',
                            padding: '2px 5px',
                            borderRadius: 4,
                            minWidth: 26,
                            textAlign: 'center',
                          }}>
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Enable Checkbox */}
                        <input
                          type="checkbox"
                          checked={col.enabled}
                          disabled={isMandatory}
                          onChange={() => handleToggleColumn(col.id)}
                          style={{ cursor: isMandatory ? 'not-allowed' : 'pointer', width: 15, height: 15 }}
                          title={isMandatory ? 'Cột bắt buộc' : 'Bật/tắt xuất cột này'}
                        />

                        {/* Editable Label Input */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => handleUpdateColumnLabel(col.id, e.target.value)}
                            className="input-field"
                            style={{
                              padding: '3px 7px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: col.enabled ? '#ffffff' : '#f1f5f9',
                              border: '1px solid var(--border-color)',
                            }}
                            title="Nhấp để đổi tên cột xuất ra trong Excel"
                          />
                          {col.sourceHeader && col.sourceHeader !== col.label && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 2 }}>
                              Cột gốc: <span style={{ fontFamily: 'monospace' }}>{col.sourceHeader}</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons (Up, Down, Delete) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleMoveColumn(col.id, 'up')}
                            disabled={idx === 0}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: idx === 0 ? 'not-allowed' : 'pointer',
                              padding: 2,
                              color: idx === 0 ? '#cbd5e1' : 'var(--text-muted)',
                            }}
                            title="Di chuyển lên trên"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveColumn(col.id, 'down')}
                            disabled={idx === currentColumns.length - 1}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: idx === currentColumns.length - 1 ? 'not-allowed' : 'pointer',
                              padding: 2,
                              color: idx === currentColumns.length - 1 ? '#cbd5e1' : 'var(--text-muted)',
                            }}
                            title="Di chuyển xuống dưới"
                          >
                            <ArrowDown size={13} />
                          </button>
                          {!isMandatory && (
                            <button
                              type="button"
                              onClick={() => handleRemoveColumn(col.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 2,
                                color: 'var(--danger)',
                                opacity: 0.8,
                              }}
                              title="Xóa cột khỏi danh sách xuất"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 🌟 LIVE PREVIEW STRIP: HÀNG TIÊU ĐỀ EXCEL */}
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={13} color="var(--primary)" />
              <span>Xem trước thứ tự hàng tiêu đề trong file Excel xuất ra:</span>
            </div>
            <div style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 4,
            }}>
              {currentColumns.filter(c => c.enabled).map((col, idx) => (
                <div
                  key={col.id}
                  style={{
                    padding: '3px 8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}. {col.label}
                </div>
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
            Đã bật <strong>{enabledCount}/{currentColumns.length}</strong> cột xuất cho {activeTab === 'shop' ? 'Bảng Kê Shop' : 'Báo Cáo Tổng Hợp'}.
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
