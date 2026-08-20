import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, Layers } from 'lucide-react';
import { AuthService } from '../services/authService';
import type { UserAccount } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await AuthService.login(username, password);
      setIsLoading(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      }
    } catch {
      setIsLoading(false);
      setErrorMsg('Lỗi kết nối tới hệ thống. Vui lòng thử lại.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(79, 70, 229, 0.22) 0%, rgba(15, 23, 42, 1) 70%)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative ambient background glows */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '20%',
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: 'rgba(79, 70, 229, 0.15)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '20%',
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.12)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      {/* Login Card Container */}
      <div style={{
        width: '100%',
        maxWidth: 450,
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 'var(--radius-xl)',
        padding: '38px 34px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(79, 70, 229, 0.2)',
        backdropFilter: 'blur(16px)',
        position: 'relative',
        zIndex: 1,
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '16px',
            background: 'var(--brand-gradient)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 10px 25px var(--primary-glow)',
          }}>
            <Layers size={32} />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>
            GomDon Pro <span style={{ color: 'var(--primary)' }}>Enterprise</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Hệ thống Quản Lý & Đối Soát Vận Chuyển Chuyên Nghiệp
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="badge badge-danger" style={{
            display: 'block',
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 20,
            textAlign: 'center',
            borderRadius: 'var(--radius-md)',
          }}>
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Username */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: 13 }}>
              Tên Đăng Nhập
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}>
                <User size={18} />
              </div>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên tài khoản..."
                className="input-field"
                style={{ padding: '12px 14px 12px 40px', fontSize: 14 }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: 13 }}>
              Mật Khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="input-field"
                style={{ padding: '12px 42px 12px 40px', fontSize: 14 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              padding: '13px',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            {isLoading ? (
              <span>Đang xác thực...</span>
            ) : (
              <>
                <span>ĐĂNG NHẬP HỆ THỐNG</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

        </form>

        {/* Security Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-dim)',
          marginTop: 28,
          paddingTop: 16,
          borderTop: '1px solid var(--border-color)',
        }}>
          <ShieldCheck size={15} color="var(--success)" />
          <span>Truy cập nội bộ có phân quyền — không chia sẻ thông tin đăng nhập</span>
        </div>

      </div>
    </div>
  );
};
