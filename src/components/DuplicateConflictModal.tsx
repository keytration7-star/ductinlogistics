import { AlertTriangle, RefreshCcw, Filter, X, ArrowRight, FileText } from 'lucide-react';
import type { DuplicateCheckResult } from '../services/reconciliationService';

interface DuplicateConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkResult: DuplicateCheckResult;
  onOverwrite: () => void;
  onFilterNewOnly: () => void;
}

export const DuplicateConflictModal: React.FC<DuplicateConflictModalProps> = ({
  isOpen,
  onClose,
  checkResult,
  onOverwrite,
  onFilterNewOnly,
}) => {
  if (!isOpen || !checkResult.hasConflict) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const is100PercentDuplicate = checkResult.duplicateRowsCount === checkResult.totalNewRows;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 620, border: '1px solid rgba(245, 158, 11, 0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                Phát Hiện Dữ Liệu Trùng Lặp Trong Hệ Thống
              </h3>
              <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600, marginTop: 2 }}>
                Tránh cộng dồn sai số tiền & trùng lặp các đơn đã đối soát
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Conflict Info Banner */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} color="var(--primary)" />
              <span>Đã tìm thấy dữ liệu trùng khớp với Kỳ đối soát trong Lịch sử:</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
              📁 {checkResult.conflictingSessionName || 'Kỳ Đối Soát Đã Lưu'}
            </div>
            {checkResult.conflictingSessionDate && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Thời gian tạo: {formatDate(checkResult.conflictingSessionDate)}
              </div>
            )}
          </div>

          {/* Statistics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            <div style={{
              background: 'var(--bg-primary)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Tổng Đơn Trong File</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
                {checkResult.totalNewRows}
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>
                ⚠️ Số Đơn Trùng Lặp
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>
                {checkResult.duplicateRowsCount}
              </div>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 4 }}>
                ✨ Đơn Hoàn Toàn Mới
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>
                {checkResult.uniqueNewRowsCount}
              </div>
            </div>
          </div>

          {/* Warning Prompt */}
          <div style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            background: 'rgba(245, 158, 11, 0.08)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid #f59e0b',
          }}>
            <strong>Vui lòng chọn phương án xử lý để bảo vệ tính chính xác của sổ sách:</strong>
          </div>

          {/* Action Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            
            {/* Option 1: Overwrite & Replace */}
            <button
              onClick={onOverwrite}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(99, 102, 241, 0.08) 100%)',
                border: '1.5px solid var(--primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <RefreshCcw size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>
                    🔄 Cập Nhật & Ghi Đè (Lấy dữ liệu từ file mới này)
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Cập nhật lại số liệu của kỳ đối soát cũ bằng tệp file mới này. Tránh bị cộng dồn số tiền.
                  </div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--primary)" />
            </button>

            {/* Option 2: Filter New Only */}
            {!is100PercentDuplicate && (
              <button
                onClick={onFilterNewOnly}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1.5px solid #10b981',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#10b981', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Filter size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#059669' }}>
                      ➕ Chỉ Lọc Nạp {checkResult.uniqueNewRowsCount} Đơn Hoàn Toàn MỚI
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      Loại bỏ {checkResult.duplicateRowsCount} đơn đã trùng, chỉ tính cước & tiền COD cho các đơn mới.
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} color="#059669" />
              </button>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--bg-tertiary)',
        }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            🛑 Hủy Bỏ (Không nạp dữ liệu này)
          </button>
        </div>

      </div>
    </div>
  );
};
