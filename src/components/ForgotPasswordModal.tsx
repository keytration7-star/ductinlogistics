import React, { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2, X, ArrowRight } from 'lucide-react';
import { AuthService } from '../services/authService';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setErrorMsg('Vui lòng nhập Tên đăng nhập hoặc Email tài khoản.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await AuthService.sendForgotPasswordOtp(usernameOrEmail.trim());
      if (res.success && res.userId) {
        setUserId(res.userId);
        setMaskedEmail(res.maskedEmail || '');
        setStep('VERIFY');
      } else {
        setErrorMsg(res.error || 'Không tìm thấy tài khoản hoặc chưa thiết lập Email.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ khi gửi mã khôi phục.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMsg('Vui lòng nhập mã OTP gồm 6 chữ số.');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('Mật khẩu mới phải có tối thiểu 4 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await AuthService.resetPasswordWithOtp(userId, otp.trim(), newPassword);
      if (res.success) {
        setSuccessMsg(res.message || 'Khôi phục mật khẩu thành công!');
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Mã OTP không chính xác hoặc đã hết hạn.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ khi đặt lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(12px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 440,
        padding: '32px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1.5px solid rgba(226, 232, 240, 0.8)',
        position: 'relative',
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.4)',
          }}>
            <KeyRound size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>
            Khôi Phục Mật Khẩu
          </h2>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>
            {step === 'REQUEST'
              ? 'Nhập Tên đăng nhập hoặc Email để nhận mã xác thực OTP qua email'
              : `Mã OTP đã được gửi đến email: ${maskedEmail}`}
          </div>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'REQUEST' ? (
          <form onSubmit={handleSendOtp}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Tên đăng nhập hoặc Email của bạn:
              </label>
              <input
                type="text"
                placeholder="VD: admin hoặc admin@autopro.io.vn..."
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                disabled={isLoading}
                className="input-field"
                style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 10 }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: 13.5,
                fontWeight: 800,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
              }}
            >
              <span>{isLoading ? 'Đang gửi mã...' : 'Gửi Mã OTP Qua Email'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Mã OTP 6 số từ Email:
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="0 0 0 0 0 0"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isLoading}
                className="input-field mono"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 20,
                  fontWeight: 900,
                  textAlign: 'center',
                  letterSpacing: 6,
                  borderRadius: 10,
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Mật khẩu mới:
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu mới..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                className="input-field"
                style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 10 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Xác nhận mật khẩu mới:
              </label>
              <input
                type="password"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="input-field"
                style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 10 }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: 13.5,
                fontWeight: 800,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}
            >
              {isLoading ? 'Đang cập nhật...' : 'Xác Nhận Đặt Lại Mật Khẩu'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setStep('REQUEST')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Gửi lại mã hoặc đổi tài khoản
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
