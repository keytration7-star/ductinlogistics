import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, AlertCircle, X, ArrowRight } from 'lucide-react';
import { AuthService } from '../services/authService';
import type { UserAccount } from '../types';

interface TwoFactorOtpModalProps {
  userId: string;
  tempToken: string;
  maskedEmail?: string;
  onSuccess: (user: UserAccount) => void;
  onCancel: () => void;
}

export const TwoFactorOtpModal: React.FC<TwoFactorOtpModalProps> = ({
  userId,
  tempToken,
  maskedEmail,
  onSuccess,
  onCancel,
}) => {
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d+$/.test(cleanOtp)) {
      setErrorMsg('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await AuthService.verify2FaOtp(userId, tempToken, cleanOtp);
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setErrorMsg(res.error || 'Mã OTP không chính xác hoặc đã hết hạn.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối khi xác thực OTP.');
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
        maxWidth: 420,
        padding: '32px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1.5px solid rgba(226, 232, 240, 0.8)',
        textAlign: 'center',
        position: 'relative',
      }}>
        <button
          type="button"
          onClick={onCancel}
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

        <div style={{
          width: 60,
          height: 60,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
        }}>
          <ShieldAlert size={30} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: '0 0 6px 0' }}>
          Xác Thực 2 Bước (2FA)
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
          Mã xác thực 6 số vừa được gửi tới email <strong>{maskedEmail || 'của bạn'}</strong>. Vui lòng nhập mã để hoàn tất đăng nhập.
        </p>

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
            justifyContent: 'center',
          }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: 20 }}>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="0 0 0 0 0 0"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(val);
                if (val.length === 6) {
                  setErrorMsg('');
                }
              }}
              disabled={isLoading}
              className="input-field"
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 26,
                fontWeight: 900,
                textAlign: 'center',
                letterSpacing: 10,
                fontFamily: 'monospace',
                borderRadius: 12,
                border: '2px solid #cbd5e1',
                color: '#1e293b',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '11px',
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span>{isLoading ? 'Đang xác thực...' : 'Xác Nhận Đăng Nhập'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: 18, fontSize: 12, color: '#94a3b8' }}>
          Mã OTP có hiệu lực trong 5 phút. Nếu không nhận được, hãy kiểm tra mục Thư rác/Spam.
        </div>
      </div>
    </div>
  );
};
