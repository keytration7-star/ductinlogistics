import React, { useState, useEffect } from 'react';
import { Building2, Check, X, MapPin, Phone, FileText, Globe } from 'lucide-react';
import type { CompanyInfo } from '../types';
import { StorageService } from '../services/storage';
import { useToast } from './UIFeedback';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
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
      showToast('Vui lòng nhập Tên Công Ty / Nhà Gom Đơn', 'warning');
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 580 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary), #6366f1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                Cấu Hình Thông Tin Công Ty / Nhà Gom Đơn
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
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Tên công ty */}
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>
                🏢 Tên Công Ty / Nhà Gom Đơn (*)
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: CÔNG TY TNHH LOGISTICS DỰC TÍN..."
                value={info.companyName}
                onChange={(e) => setInfo({ ...info, companyName: e.target.value })}
                className="input-field"
                style={{ padding: '10px 12px', fontSize: 13.5, fontWeight: 700 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Xuất hiện ở dòng 1 của tiêu đề file Excel đối soát gửi cho Shop và Báo cáo tổng hợp.
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
                placeholder="Ví dụ: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội..."
                value={info.address}
                onChange={(e) => setInfo({ ...info, address: e.target.value })}
                className="input-field"
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
                  placeholder="Ví dụ: 0988 123 456"
                  value={info.phone}
                  onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                  className="input-field"
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
                  placeholder="Ví dụ: 0101234567"
                  value={info.taxCode}
                  onChange={(e) => setInfo({ ...info, taxCode: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            {/* Website / Hotline */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={14} color="var(--primary)" />
                <span>Website / Email Khác (Không bắt buộc)</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: ductinlogistics.shop"
                value={info.website || ''}
                onChange={(e) => setInfo({ ...info, website: e.target.value })}
                className="input-field"
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
              Huỷ
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              <span>{isSaved ? 'Đã Lưu Thông Tin!' : 'Lưu Thông Tin Công Ty'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
