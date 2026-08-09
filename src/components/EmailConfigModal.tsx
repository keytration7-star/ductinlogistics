import React, { useState } from 'react';
import { 
  Settings, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Server, 
  HelpCircle, 
  CheckCircle2, 
  X, 
  Send, 
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import type { EmailSettings } from '../types';
import { EmailService } from '../services/emailService';

interface EmailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailSettings: EmailSettings;
  onSave: (newSettings: EmailSettings) => void;
}

export const EmailConfigModal: React.FC<EmailConfigModalProps> = ({
  isOpen,
  onClose,
  emailSettings,
  onSave,
}) => {
  const [formData, setFormData] = useState<EmailSettings>({
    ...emailSettings,
    emailPassword: emailSettings.emailPassword || '',
    smtpHost: emailSettings.smtpHost || 'smtp.gmail.com',
    smtpPort: emailSettings.smtpPort || 465,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState('');
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error' | 'sending'; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  const handleSendTestEmail = async () => {
    if (!formData.senderEmail || !formData.emailPassword) {
      setTestStatus({ type: 'error', msg: 'Vui lòng điền Email gửi và Mật khẩu ứng dụng trước khi gửi thử.' });
      return;
    }

    if (!testEmailInput.trim()) {
      setTestStatus({ type: 'error', msg: 'Vui lòng nhập email nhận để gửi thử nghiệm.' });
      return;
    }

    setTestStatus({ type: 'sending', msg: 'Đang kết nối SMTP Gmail và gửi email thật...' });

    const res = await EmailService.sendRealEmail({
      senderName: formData.senderName,
      senderEmail: formData.senderEmail,
      emailPassword: formData.emailPassword,
      smtpHost: formData.smtpHost,
      smtpPort: formData.smtpPort,
      to: testEmailInput.trim(),
      subject: `【KIỂM TRA GOMDON PRO】Thử nghiệm kết nối Email từ ${formData.senderName}`,
      text: `Xin chào,\n\nĐây là email gửi thử nghiệm tự động từ hệ thống Quản Trị Đối Soát GOMDON PRO.\n\nTài khoản gửi: ${formData.senderEmail}\nThời gian: ${new Date().toLocaleString('vi-VN')}\n\nNếu bạn nhận được email này, cấu hình SMTP và Mật khẩu ứng dụng của bạn đã hoàn toàn chính xác 100%!`,
    });

    if (res.success) {
      setTestStatus({
        type: 'success',
        msg: `✓ THÀNH CÔNG! Đã gửi email thử nghiệm thật tới: ${testEmailInput}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam)!`,
      });
    } else {
      setTestStatus({
        type: 'error',
        msg: `✕ LỖI GỬI: ${res.error}`,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
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
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Settings size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                Cài Đặt Cấu Hình Gửi Mail (SMTP & Mật Khẩu Mail)
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Thiết lập tài khoản Gmail / Outlook để tự động gửi bảng kê COD cho các Shop
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {saveSuccess && (
            <div className="badge badge-success" style={{ padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} />
              <span>Đã lưu thành công cấu hình tài khoản gửi Email!</span>
            </div>
          )}

          {/* 1. Sender Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Tên Hiển Thị Người Gửi (*)</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Công Ty Vận Chuyển Đức Tín"
                value={formData.senderName}
                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Địa Chỉ Email Gửi (*)</label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="doisoat.ductin@gmail.com"
                  value={formData.senderEmail}
                  onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
                  className="input-field"
                  style={{ paddingLeft: 34 }}
                />
              </div>
            </div>
          </div>

          {/* 2. Password / App Password */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">
              Mật Khẩu Ứng Dụng (Gmail App Password) (*)
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Nhập 16 ký tự Mật khẩu ứng dụng (ví dụ: abcd efgh ijkl mnop)..."
                value={formData.emailPassword}
                onChange={(e) => setFormData({ ...formData, emailPassword: e.target.value })}
                className="input-field"
                style={{ paddingLeft: 34, paddingRight: 40, fontFamily: showPassword ? 'monospace' : 'inherit' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 3. SMTP Server & Port */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Máy Chủ SMTP (Host)</label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <Server size={16} />
                </div>
                <input
                  type="text"
                  value={formData.smtpHost}
                  onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                  className="input-field"
                  style={{ paddingLeft: 34 }}
                  placeholder="smtp.gmail.com"
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Cổng (Port)</label>
              <input
                type="number"
                value={formData.smtpPort}
                onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 465 })}
                className="input-field"
                placeholder="465"
              />
            </div>
          </div>

          {/* 4. Google App Password Tutorial Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <HelpCircle size={15} />
              <span>Cách lấy "Mật khẩu ứng dụng" Gmail cực nhanh (30 giây):</span>
            </div>
            <ol style={{ paddingLeft: 18, margin: 0, color: 'var(--text-main)' }}>
              <li>Truy cập Google Account: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>myaccount.google.com/security <ExternalLink size={11} /></a></li>
              <li>Bật <strong>"Xác minh 2 bước"</strong> (2-Step Verification).</li>
              <li>Tìm mục <strong>"Mật khẩu ứng dụng"</strong> (App Passwords) 👉 Tạo mật khẩu mới với tên <em>GomDonPro</em> 👉 Copy mã 16 ký tự và dán vào ô Mật khẩu ở trên.</li>
            </ol>
          </div>

          {/* 5. Test Email Sending Area */}
          <div style={{
            background: 'var(--bg-primary)',
            padding: 14,
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
              Kiểm Tra Kết Nối Gửi Thử:
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="Nhập email nhận thử (ví dụ: your_email@gmail.com)..."
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                className="input-field"
                style={{ flex: 1, padding: '7px 12px', fontSize: 12.5 }}
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                <Send size={13} />
                <span>Gửi Test Thử</span>
              </button>
            </div>

            {testStatus && (
              <div className={`badge ${testStatus.type === 'success' ? 'badge-success' : testStatus.type === 'error' ? 'badge-danger' : 'badge-warning'}`} style={{ padding: '6px 10px', fontSize: 11.5 }}>
                {testStatus.msg}
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={14} color="var(--success)" />
              <span>Mật khẩu được lưu trữ mã hóa an toàn trên máy tính của bạn.</span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Hủy
              </button>
              <button type="submit" className="btn btn-primary">
                Lưu Cấu Hình Mail
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
