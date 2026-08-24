import React, { useState, useEffect } from 'react';
import { Building2, Check, X, MapPin, Phone, FileText, Globe, Lock } from 'lucide-react';
import type { CompanyInfo } from '../types';
import { StorageService } from '../services/storage';
import { useToast } from './UIFeedback';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  userRole?: string;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  userRole = 'ADMIN',
}) => {
  const isAdmin = userRole === 'ADMIN';
  const { showToast } = useToast();
  const [info, setInfo] = useState<CompanyInfo>(() => StorageService.getCompanyInfo());
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInfo(StorageService.getCompanyInfo());
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!info.companyName.trim()) {
      showToast('Vui lòng nhập Tên Công Ty / Doanh Nghiệp', 'warning');
      return;
    }
    if (!info.email || !info.email.trim()) {
      showToast('BẮT BUỘC: Vui lòng nhập Email Công Ty để nhận mã OTP khôi phục và thông báo!', 'warning');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(info.email.trim())) {
      showToast('Định dạng Email không hợp lệ. Vui lòng kiểm tra lại!', 'warning');
      return;
    }

    StorageService.saveCompanyInfo(info);
    setIsSaved(true);
    showToast('Đã lưu thông tin công ty thành công!', 'success');
    if (onSaved) onSaved();

    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 400);
  };

  const hasMissingEmail = !info.email || !info.email.trim();

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: 600, 
          width: '90%', 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                Cấu Hình Thông Tin Công Ty / Doanh Nghiệp
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Thông tin này sẽ được in ở tiêu đề đầu trang của các tệp Excel xuất đối soát
              </div>
            </div>
          </div>

          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto' }}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Missing Email Alert Banner */}
            {hasMissingEmail && (
              <div style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1.5px solid #f59e0b',
                borderRadius: 12,
                padding: '12px 14px',
                color: '#b45309',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
              }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e' }}>
                    CẢNH BÁO BẢO MẬT: CHƯA CẤU HÌNH EMAIL CÔNG TY
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.4 }}>
                    Hệ thống bắt buộc Admin phải nhập Email Công Ty để nhận mã OTP khi <strong>quên mật khẩu, đổi mật khẩu và xác thực 2 bước (2FA)</strong>.
                  </div>
                </div>
              </div>
            )}

            {!isAdmin && (
              <div className="badge badge-warning" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 12.5,
                lineHeight: 1.4,
              }}>
                <Lock size={16} style={{ flexShrink: 0 }} />
                <span>🔒 Tài khoản Kế toán / Nhân viên chỉ có quyền xem. Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa cấu hình này.</span>
              </div>
            )}

            {/* Tên công ty */}
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>
                🏢 Tên Công Ty / Doanh Nghiệp (*)
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                placeholder="Ví dụ: CÔNG TY TNHH LOGISTICS ĐỨC TÍN..."
                value={info.companyName}
                onChange={(e) => setInfo({ ...info, companyName: e.target.value })}
                className="input-field"
                style={{ padding: '10px 12px', fontSize: 13.5, fontWeight: 700, opacity: !isAdmin ? 0.75 : 1 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Xuất hiện ở dòng 1 của tiêu đề file Excel đối soát gửi cho Shop và Báo cáo tổng hợp.
              </div>
            </div>

            {/* Email công ty - BẮT BUỘC */}
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📧 Email Công Ty (Nhận OTP Khôi Phục & Đổi Pass) (*)</span>
                <span className="badge badge-danger" style={{ fontSize: 9.5, padding: '1px 5px' }}>BẮT BUỘC</span>
              </label>
              <input
                type="email"
                required
                disabled={!isAdmin}
                placeholder="Ví dụ: admin@autopro.io.vn hoặc cty@ductinlogistics.shop..."
                value={info.email || ''}
                onChange={(e) => setInfo({ ...info, email: e.target.value })}
                className="input-field"
                style={{
                  padding: '10px 12px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  borderColor: hasMissingEmail ? '#f59e0b' : undefined,
                  background: hasMissingEmail ? '#fffdf5' : undefined,
                  opacity: !isAdmin ? 0.75 : 1,
                }}
              />
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                Địa chỉ nhận mã xác thực OTP khi Quên mật khẩu, Đổi mật khẩu Admin và Xác thực 2 bước (2FA).
              </div>
            </div>

            {/* Địa chỉ công ty */}
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color="var(--primary)" />
                <span>Địa Chỉ Trụ Sở / Văn Phòng</span>
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                placeholder="Ví dụ: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội..."
                value={info.address}
                onChange={(e) => setInfo({ ...info, address: e.target.value })}
                className="input-field"
                style={{ opacity: !isAdmin ? 0.75 : 1 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Số điện thoại */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14} color="var(--primary)" />
                  <span>Số Điện Thoại Liên Hệ</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  placeholder="Ví dụ: 0988 123 456"
                  value={info.phone}
                  onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                  className="input-field"
                  style={{ opacity: !isAdmin ? 0.75 : 1 }}
                />
              </div>

              {/* Mã số thuế */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} color="var(--primary)" />
                  <span>Mã Số Thuế (MST)</span>
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  placeholder="Ví dụ: 0101234567"
                  value={info.taxCode}
                  onChange={(e) => setInfo({ ...info, taxCode: e.target.value })}
                  className="input-field"
                  style={{ opacity: !isAdmin ? 0.75 : 1 }}
                />
              </div>
            </div>

            {/* Website / Hotline */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={14} color="var(--primary)" />
                <span>Website / Hotline Khác (Không bắt buộc)</span>
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                placeholder="Ví dụ: ductinlogistics.shop"
                value={info.website || ''}
                onChange={(e) => setInfo({ ...info, website: e.target.value })}
                className="input-field"
                style={{ opacity: !isAdmin ? 0.75 : 1 }}
              />
            </div>

          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: 'var(--bg-tertiary)',
          }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Đóng
            </button>
            {isAdmin && (
              <button type="submit" className="btn btn-primary">
                <Check size={16} />
                <span>{isSaved ? 'Đã Lưu Thông Tin!' : 'Lưu Thông Tin Công Ty'}</span>
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
};
