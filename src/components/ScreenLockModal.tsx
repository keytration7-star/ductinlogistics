import React, { useState, useEffect, useRef } from 'react';
import { Lock, LogOut, AlertCircle, Delete } from 'lucide-react';
import type { UserAccount } from '../types';
import { AuthService } from '../services/authService';

interface ScreenLockModalProps {
  currentUser: UserAccount;
  onUnlock: () => void;
  onLogout: () => void;
}

export const ScreenLockModal: React.FC<ScreenLockModalProps> = ({
  currentUser,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [unlockMode, setUnlockMode] = useState<'PIN' | 'PASSWORD'>(currentUser.hasPin ? 'PIN' : 'PASSWORD');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [unlockMode]);

  const handleVerifyPin = async (pinToTest: string) => {
    if (pinToTest.length < 4) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const ok = await AuthService.verifyQuickPin(pinToTest);
      if (ok) {
        onUnlock();
      } else {
        setErrorMsg('Mã PIN không chính xác. Vui lòng thử lại!');
        setPin('');
      }
    } catch {
      setErrorMsg('Lỗi kết nối khi xác thực mã PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu tài khoản.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const ok = await AuthService.verifyCurrentPassword(password.trim());
      if (ok) {
        onUnlock();
      } else {
        setErrorMsg('Mật khẩu không chính xác.');
        setPassword('');
      }
    } catch {
      setErrorMsg('Lỗi kết nối khi xác thực mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6 || isLoading) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length >= 4 && newPin.length <= 6) {
      handleVerifyPin(newPin);
    }
  };

  const handlePinBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
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
        maxWidth: 400,
        padding: '32px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1.5px solid rgba(226, 232, 240, 0.8)',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Shield Icon Lock Header */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)',
        }}>
          <Lock size={30} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>
          Màn Hình Đang Tạm Khóa
        </h2>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          Xin chào <strong>{currentUser.fullName || currentUser.username}</strong>. Vui lòng mở khóa để tiếp tục làm việc.
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
            justifyContent: 'center',
          }}>
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {unlockMode === 'PIN' ? (
          <div>
            {/* PIN Dots Indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 24,
            }}>
              {[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pin.length)).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: i < pin.length ? '#4f46e5' : '#e2e8f0',
                    border: i < pin.length ? '2px solid #4338ca' : '2px solid #cbd5e1',
                    transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>

            {/* Hidden Input for Physical Keyboard */}
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
                if (val.length >= 4) handleVerifyPin(val);
              }}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />

            {/* Virtual Number Keypad */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              maxWidth: 260,
              margin: '0 auto 20px',
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(num)}
                  disabled={isLoading}
                  style={{
                    height: 52,
                    fontSize: 20,
                    fontWeight: 800,
                    borderRadius: 14,
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                disabled={isLoading}
                style={{
                  height: 52,
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                Xóa hết
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                disabled={isLoading}
                style={{
                  height: 52,
                  fontSize: 20,
                  fontWeight: 800,
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#1e293b',
                  cursor: 'pointer',
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinBackspace}
                disabled={isLoading}
                style={{
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                <Delete size={20} />
              </button>
            </div>

            {/* Switch to Password Option */}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setUnlockMode('PASSWORD');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Quên Mã PIN? Mở khóa bằng Mật khẩu tài khoản
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerifyPassword}>
            <div style={{ marginBottom: 16 }}>
              <input
                ref={inputRef}
                type="password"
                placeholder="Nhập mật khẩu tài khoản / Mật khẩu Admin..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                padding: '10px',
                fontSize: 13.5,
                fontWeight: 800,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              }}
            >
              {isLoading ? 'Đang mở khóa...' : 'Mở Khóa Màn Hình'}
            </button>

            {currentUser.hasPin && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setUnlockMode('PIN');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4f46e5',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ← Mở khóa bằng Mã PIN
                </button>
              </div>
            )}
          </form>
        )}

        {/* Bottom Logout Button */}
        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 20, paddingTop: 14 }}>
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <LogOut size={13} />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
};
