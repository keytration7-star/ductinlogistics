import React, { useState, useEffect, useRef } from 'react';
import { Lock, LogOut, AlertCircle, Delete, Eye, EyeOff, KeyRound, Smartphone } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
        setErrorMsg('Mã PIN không chính xác (hoặc tài khoản chưa cài đặt mã PIN này). Vui lòng thử lại hoặc mở bằng Mật khẩu!');
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
        setErrorMsg('Mật khẩu không chính xác. Vui lòng kiểm tra lại!');
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
    const newPin = (pin + digit).slice(0, 6);
    setPin(newPin);
    setErrorMsg('');
    if (newPin.length === 6) {
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
    <div 
      onKeyDown={(e) => {
        if (unlockMode === 'PIN') {
          if (e.key >= '0' && e.key <= '9') {
            handlePinDigit(e.key);
          } else if (e.key === 'Backspace') {
            handlePinBackspace();
          } else if (e.key === 'Enter' && pin.length >= 4) {
            handleVerifyPin(pin);
          }
        }
      }}
      style={{
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
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 420,
        padding: '30px 26px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1.5px solid rgba(226, 232, 240, 0.8)',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Shield Icon Lock Header */}
        <div style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
          boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)',
        }}>
          <Lock size={28} />
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>
          Màn Hình Đang Tạm Khóa
        </h2>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 16 }}>
          Xin chào <strong>{currentUser.fullName || currentUser.username}</strong>
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 12,
          gap: 4,
          marginBottom: 18,
        }}>
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setUnlockMode('PIN');
            }}
            style={{
              padding: '8px 10px',
              borderRadius: 9,
              border: 'none',
              background: unlockMode === 'PIN' ? '#ffffff' : 'transparent',
              color: unlockMode === 'PIN' ? '#4f46e5' : '#64748b',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: unlockMode === 'PIN' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Smartphone size={14} />
            <span>Mở Bằng Mã PIN</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setUnlockMode('PASSWORD');
            }}
            style={{
              padding: '8px 10px',
              borderRadius: 9,
              border: 'none',
              background: unlockMode === 'PASSWORD' ? '#ffffff' : 'transparent',
              color: unlockMode === 'PASSWORD' ? '#4f46e5' : '#64748b',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: unlockMode === 'PASSWORD' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <KeyRound size={14} />
            <span>Mở Bằng Mật Khẩu</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'center',
            textAlign: 'left',
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {unlockMode === 'PIN' ? (
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 12 }}>
              Nhập mã PIN bảo vệ (<strong>từ 4 đến 6 chữ số</strong>):
            </div>

            {/* 6 Fixed PIN Dots Indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 16,
            }}>
              {[0, 1, 2, 3, 4, 5].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: i < pin.length ? '#4f46e5' : '#f1f5f9',
                    border: i < pin.length ? '2px solid #4338ca' : '2px solid #cbd5e1',
                    transform: i < pin.length ? 'scale(1.2)' : 'scale(1)',
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
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(val);
                if (val.length === 6) handleVerifyPin(val);
              }}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />

            {/* Virtual Number Keypad */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              maxWidth: 260,
              margin: '0 auto 12px',
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(num)}
                  disabled={isLoading}
                  style={{
                    height: 46,
                    fontSize: 18,
                    fontWeight: 800,
                    borderRadius: 12,
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
                  height: 46,
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 12,
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
                  height: 46,
                  fontSize: 18,
                  fontWeight: 800,
                  borderRadius: 12,
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
                  height: 46,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                <Delete size={18} />
              </button>
            </div>

            {/* Explicit Unlock Button for 4-6 digits */}
            <button
              type="button"
              onClick={() => handleVerifyPin(pin)}
              disabled={isLoading || pin.length < 4}
              className="btn btn-primary"
              style={{
                width: '100%',
                maxWidth: 260,
                margin: '0 auto 10px',
                padding: '9px',
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 10,
                display: 'block',
                opacity: pin.length >= 4 ? 1 : 0.45,
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              }}
            >
              {isLoading ? 'Đang kiểm tra...' : `Mở Khóa (${pin.length > 0 ? `${pin.length} số` : 'Nhập 4-6 số'})`}
            </button>

            {/* Switch to Password Option */}
            <div>
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
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Chưa có mã PIN hoặc quên? Bấm mở bằng Mật khẩu
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerifyPassword}>
            <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 10, textAlign: 'left' }}>
              Nhập mật khẩu tài khoản đăng nhập của bạn:
            </div>
            
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu đăng nhập..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="input-field"
                style={{ width: '100%', padding: '10px 40px 10px 12px', fontSize: 13, borderRadius: 10 }}
                autoFocus
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
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
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
          </form>
        )}

        {/* Bottom Logout Button */}
        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 18, paddingTop: 12 }}>
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
            <span>Đăng xuất hoàn toàn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
