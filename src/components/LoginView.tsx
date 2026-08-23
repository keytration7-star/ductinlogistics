import React, { useState } from 'react';
import { 
  Layers, 
  ShieldCheck, 
  ArrowRight, 
  FileSpreadsheet, 
  TrendingUp, 
  Zap, 
  X, 
  ChevronRight, 
  Truck, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Sparkles, 
  Send, 
  Award, 
  QrCode,
  Building2,
  MapPin,
  Phone,
} from 'lucide-react';
import { AuthService } from '../services/authService';
import type { UserAccount } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenLogin = () => {
    setErrorMsg(null);
    setIsLoginModalOpen(true);
  };

  const handleCloseLogin = () => {
    setIsLoginModalOpen(false);
    setErrorMsg(null);
  };

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
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', paddingTop: 70 }}>
      
      {/* 🌟 1. FIXED TOP NAVIGATION BAR (LUÔN CỐ ĐỊNH TRÊN CÙNG KHI CUỘN TRANG) */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1.5px solid #e2e8f0',
        padding: '0 32px',
        height: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
          }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.2 }}>
              Kế Toán PRO <span style={{ color: 'var(--primary)' }}>Enterprise</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              Hệ Thống Kế Toán & Đối Soát Vận Chuyển Đa Hãng
            </div>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <a href="#features" style={{ textDecoration: 'none', color: '#475569', fontSize: 13.5, fontWeight: 700, transition: 'color 0.15s' }}>
            Tính Năng Nổi Bật
          </a>
          <a href="#carriers" style={{ textDecoration: 'none', color: '#475569', fontSize: 13.5, fontWeight: 700, transition: 'color 0.15s' }}>
            Hãng Hỗ Trợ
          </a>
          <a href="#workflow" style={{ textDecoration: 'none', color: '#475569', fontSize: 13.5, fontWeight: 700, transition: 'color 0.15s' }}>
            Quy Trình 3 Bước
          </a>
        </nav>

        {/* Right CTA Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleOpenLogin}
            className="btn btn-primary"
            style={{
              fontWeight: 800,
              fontSize: 13.5,
              padding: '9px 22px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              border: 'none',
              color: '#fff',
            }}
          >
            <User size={16} />
            <span>Đăng Nhập Hệ Thống</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* 🌟 2. HERO SECTION */}
      <section style={{
        position: 'relative',
        padding: '64px 24px 72px',
        background: 'radial-gradient(ellipse at 50% -10%, rgba(79, 70, 229, 0.12) 0%, rgba(248, 250, 252, 1) 70%)',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Glow ambient background effects */}
        <div style={{ position: 'absolute', top: 40, left: '15%', width: 280, height: 280, background: 'rgba(79, 70, 229, 0.1)', filter: 'blur(90px)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 60, right: '15%', width: 280, height: 280, background: 'rgba(6, 182, 212, 0.1)', filter: 'blur(90px)', borderRadius: '50%', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          
          {/* Top Pill Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#eef2ff',
            color: '#4f46e5',
            border: '1.5px solid #c7d2fe',
            padding: '6px 18px',
            borderRadius: 30,
            fontSize: 12.5,
            fontWeight: 800,
            marginBottom: 20,
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.08)',
          }}>
            <Sparkles size={15} color="#4f46e5" />
            <span>Kế Toán PRO Enterprise v2.0 • Hệ Thống Kế Toán & Đối Soát Vận Chuyển</span>
          </div>

          {/* Main Hero Headline */}
          <h1 style={{
            fontSize: 'clamp(28px, 4.5vw, 46px)',
            fontWeight: 900,
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            margin: '0 0 18px',
            color: '#0f172a',
          }}>
            Quản Trị Đối Soát COD & Dòng Tiền Vận Chuyển{' '}
            <span style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Đa Hãng Tự Động 100%
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p style={{
            fontSize: 'clamp(15px, 2vw, 17.5px)',
            color: '#475569',
            lineHeight: 1.6,
            maxWidth: 820,
            margin: '0 auto 32px',
            fontWeight: 500,
          }}>
            Giải pháp chuyên biệt cho kế toán logistics và quản trị tài chính vận chuyển: Tự động đối chiếu file Excel hàng chục nghìn đơn, tính cước bậc thang từng shop, đi tiền VietQR 1-chạm và gửi báo cáo đa kênh Zalo ZNS / Email / Telegram.
          </p>

          {/* Hero CTA Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 38 }}>
            <button
              type="button"
              onClick={handleOpenLogin}
              style={{
                fontSize: 15,
                fontWeight: 800,
                padding: '14px 34px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Zap size={18} />
              <span>Đăng Nhập Quản Trị Ngay</span>
              <ArrowRight size={16} />
            </button>

            <a
              href="#features"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                padding: '14px 28px',
                borderRadius: 14,
                background: '#ffffff',
                color: '#334155',
                border: '1.5px solid #cbd5e1',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span>Xem Demo & Tính Năng</span>
              <ChevronRight size={16} />
            </a>
          </div>

          {/* Social Proof Trust Badges */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap',
            fontSize: 12.5,
            fontWeight: 700,
            color: '#64748b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Khớp 50.000+ đơn trong 3 giây</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Hỗ trợ 8+ Hãng vận chuyển lớn</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Bắn VietQR NAPAS247 chính xác 100%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Phân quyền 3 cấp Admin • Staff • Thuế</span>
            </div>
          </div>
        </div>

        {/* 🌟 3. HERO INTERACTIVE APP PREVIEW SHOWCASE MOCKUP */}
        <div style={{ maxWidth: 1160, margin: '42px auto 0', position: 'relative', zIndex: 3 }}>
          <div style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfe 100%)',
            border: '2px solid #cbd5e1',
            borderRadius: 24,
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.12), 0 0 30px rgba(79, 70, 229, 0.08)',
            padding: '24px 28px',
            overflow: 'hidden',
            textAlign: 'left',
          }}>
            {/* Mockup Window Header Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginLeft: 8 }}>
                  dashboard.ketoanpro.vn • Trung Tâm Điều Hành Đa Hãng Vận Chuyển
                </span>
              </div>
              <span className="badge badge-success" style={{ fontSize: 11, padding: '3px 10px' }}>
                🟢 Hệ thống sẵn sàng
              </span>
            </div>

            {/* Mockup 3-Column Visual Representation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
              
              {/* Card 1: J&T Express */}
              <div style={{
                background: 'linear-gradient(180deg, #fff5f5 0%, #ffffff 50%)',
                border: '2px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 16,
                padding: '18px 20px',
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, color: '#0f172a' }}>J&T Express</strong>
                      <div style={{ fontSize: 10.5, color: '#dc2626', fontWeight: 800 }}>MÃ: JNT</div>
                    </div>
                  </div>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                    ● 19 Shop
                  </span>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #fecaca', fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span>Tổng đơn: <strong>2.315 đơn</strong></span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>COD: 137.8 Tr</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLogin}
                  style={{ width: '100%', padding: '8px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>Vào Không Gian J&T Express</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Card 2: Giao Hàng Nhanh */}
              <div style={{
                background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 50%)',
                border: '2px solid rgba(249, 115, 22, 0.4)',
                borderRadius: 16,
                padding: '18px 20px',
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f97316', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, color: '#0f172a' }}>Giao Hàng Nhanh</strong>
                      <div style={{ fontSize: 10.5, color: '#ea580c', fontWeight: 800 }}>MÃ: GHN</div>
                    </div>
                  </div>
                  <span style={{ background: '#ffedd5', color: '#c2410c', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                    ● 4 Shop
                  </span>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #fed7aa', fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span>Tổng đơn: <strong>367 đơn</strong></span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>COD: 42.5 Tr</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLogin}
                  style={{ width: '100%', padding: '8px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>Vào Không Gian GHN</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Card 3: Giao Hàng Tiết Kiệm & Viettel Post */}
              <div style={{
                background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 50%)',
                border: '2px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 16,
                padding: '18px 20px',
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, color: '#0f172a' }}>GHTK & Viettel Post</strong>
                      <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 800 }}>MÃ: GHTK / VTP</div>
                    </div>
                  </div>
                  <span style={{ background: '#d1fae5', color: '#047857', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                    ● Sẵn sàng
                  </span>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #bbf7d0', fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span>Hỗ trợ biểu phí riêng</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>Tự động hóa</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLogin}
                  style={{ width: '100%', padding: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>Mở Không Gian Đối Soát</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 🌟 4. CORE FEATURES HIGHLIGHTS (6 PILLARS) */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 54 }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            TÍNH NĂNG ĐỈNH CAO
          </span>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 14px', letterSpacing: '-0.02em' }}>
            Tối Ưu Hoá 100% Quy Trình Kế Toán Vận Chuyển
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 680, margin: '0 auto' }}>
            Hệ thống giải quyết triệt để bài toán thất thoát cước, sai lệch tiền COD và quá tải đối soát thủ công.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          
          {/* Feature 1 */}
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <FileSpreadsheet size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              1. Đối Soát Excel Siêu Tốc 3 Giây
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Thuật toán tự động nhận diện cột thông minh, gộp mã đơn, đối chiếu số tiền COD, cước gốc NVC và cước tính cho Shop với độ chính xác tuyệt đối.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <TrendingUp size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              2. Biểu Phí Bậc Thang Từng Shop
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Cấu hình bảng giá theo bậc cân nặng (0-0.5kg, 0.5-1kg, vượt nấc...), tự động tính phí hoàn hàng và trích xuất lợi nhuận chênh lệch cho hệ thống kế toán.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <QrCode size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              3. Đi Tiền Bank & VietQR 1-Chạm
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Tạo tức thì mã QR NAPAS247 chuẩn cho từng Shop kèm chính xác số tiền thực trả và nội dung chuyển khoản, kiểm soát trạng thái đã đi tiền/còn nợ.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <Send size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              4. Báo Cáo Đa Kênh: Zalo • Email • Telegram
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Gửi email đính kèm bảng kê Excel chi tiết hàng loạt cho hàng trăm shop, gửi tin nhắn thông báo Zalo ZNS Doanh nghiệp và Bot Telegram tự động.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(236, 72, 153, 0.12)', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <Award size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              5. Quản Lý Hoa Hồng Cộng Tác Viên (CTV)
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Phân công CTV phụ trách từng shop và từng hãng vận chuyển, tự động trích hoa hồng bậc cân nặng (VNĐ/đơn) và quản lý thanh toán hoa hồng minh bạch.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
              6. Bảo Mật Phân Quyền 3 Lớp Chuyên Biệt
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Tách biệt hoàn toàn quyền Admin (Quản trị toàn quyền), Staff (Nhân viên vận hành đối soát) và Kế Toán Thuế (Cổng xuất số liệu thuế cô lập).
            </p>
          </div>

        </div>
      </section>

      {/* 🌟 5. SUPPORTED CARRIERS SECTION */}
      <section id="carriers" style={{ padding: '80px 24px', background: '#ffffff', borderTop: '1.5px solid #e2e8f0', borderBottom: '1.5px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            HỆ SINH THÁI ĐA HÃNG
          </span>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 14px', letterSpacing: '-0.02em' }}>
            Tích Hợp Sẵn Tất Cả Hãng Vận Chuyển Hàng Đầu
          </h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 680, margin: '0 auto 48px' }}>
            Hệ thống hỗ trợ cấu hình biểu cước và đọc bảng kê Excel của mọi đơn vị vận chuyển tại Việt Nam.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { name: 'J&T Express', code: 'JNT', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', desc: 'Chuyển phát nhanh tiêu chuẩn & đối soát' },
              { name: 'Giao Hàng Nhanh', code: 'GHN', color: '#ea580c', bg: '#ffedd5', border: '#fdba74', desc: 'Giao hàng siêu tốc toàn quốc' },
              { name: 'Giao Hàng Tiết Kiệm', code: 'GHTK', color: '#059669', bg: '#d1fae5', border: '#86efac', desc: 'Giao nhanh, cước tối ưu' },
              { name: 'Viettel Post', code: 'VTP', color: '#e11d48', bg: '#ffe4e6', border: '#fda4af', desc: 'Mạng lưới bưu chính rộng khắp' },
              { name: 'SPX Express', code: 'SPX', color: '#ee4d2d', bg: '#ffedd5', border: '#fed7aa', desc: 'Vận chuyển chuyên biệt TMĐT' },
              { name: 'Best Express', code: 'BEST', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd', desc: 'Dịch vụ giao nhận thông minh' },
              { name: 'Ninja Van', code: 'NINJA', color: '#be123c', bg: '#ffe4e6', border: '#fecdd3', desc: 'Logistics công nghệ hiện đại' },
              { name: 'EMS / VNPost', code: 'EMS', color: '#d97706', bg: '#fef3c7', border: '#fde68a', desc: 'Bưu điện Việt Nam' },
            ].map(c => (
              <div key={c.code} style={{
                background: '#ffffff',
                border: `1.5px solid ${c.border}`,
                borderRadius: 16,
                padding: '20px 18px',
                textAlign: 'left',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                transition: 'all 0.2s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={18} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: c.color, background: c.bg, padding: '2px 8px', borderRadius: 6 }}>
                    {c.code}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 🌟 6. 3-STEP WORKFLOW SECTION */}
      <section id="workflow" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 54 }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            QUY TRÌNH TINH GỌN
          </span>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 14px', letterSpacing: '-0.02em' }}>
            Đối Soát Đơn Hàng Chỉ Trong 3 Bước
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0', position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, marginBottom: 18 }}>
              1
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Nạp File Excel Đối Soát
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Kéo thả trực tiếp file Excel của Hãng vận chuyển và file của App. Hệ thống tự động phát hiện cột và chuẩn hóa định dạng.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0', position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, marginBottom: 18 }}>
              2
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Tự Động Tính Cước & Lợi Nhuận
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Áp dụng chính xác biểu phí từng shop, tính tiền COD, cước gốc, cước shop và hoa hồng CTV chỉ trong 3 giây.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '28px 24px', borderRadius: 20, border: '1.5px solid #e2e8f0', position: 'relative' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, marginBottom: 18 }}>
              3
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Đi Tiền VietQR & Bắn Báo Cáo
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Quét mã VietQR chuyển khoản không lo nhầm số tiền, đồng thời tự động gửi Email kèm file Excel và tin nhắn Zalo cho khách.
            </p>
          </div>
        </div>
      </section>

      {/* 🌟 7. BOTTOM CALL TO ACTION BANNER */}
      <section style={{
        padding: '70px 24px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
        color: '#fff',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Sẵn Sàng Trải Nghiệm Đỉnh Cao Đối Soát?
          </h2>
          <p style={{ fontSize: 16, color: '#c7d2fe', lineHeight: 1.6, margin: '0 0 32px' }}>
            Đăng nhập vào hệ thống ngay hôm nay để quản lý dữ liệu đối soát an toàn, nhanh chóng và tự động hóa 100%.
          </p>
          <button
            type="button"
            onClick={handleOpenLogin}
            style={{
              fontSize: 15,
              fontWeight: 800,
              padding: '14px 38px',
              borderRadius: 14,
              background: '#ffffff',
              color: '#4f46e5',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <User size={18} />
            <span>Đăng Nhập Vào Hệ Thống</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* 🌟 8. FOOTER - ĐƠN VỊ PHÁT TRIỂN PHẦN MỀM */}
      <footer style={{
        background: '#0f172a',
        color: '#94a3b8',
        padding: '48px 32px 32px',
        fontSize: 13,
        borderTop: '1px solid #1e293b',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* Main Footer Info Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 32,
            justifyContent: 'space-between',
          }}>
            
            {/* Left Col: Development Company Identity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' }}>
                    Kế Toán PRO <span style={{ color: '#818cf8' }}>Enterprise</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                    Hệ Thống Kế Toán & Đối Soát Vận Chuyển Chuyên Nghiệp
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Building2 size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ color: '#ffffff', fontSize: 13 }}>CÔNG TY TNHH MTV CÔNG NGHỆ VÀ THƯƠNG MẠI TQ DIGITAL</strong>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>Tên viết tắt: <strong>TQ DIGITAL CO., LTD</strong></div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 2 }}>
                  <MapPin size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: '#94a3b8', lineHeight: 1.5 }}>
                    Địa chỉ: Thôn Đại Lai 1, Phường Trần Hưng Đạo, Tỉnh Hưng Yên
                  </span>
                </div>
              </div>
            </div>

            {/* Right Col: Hotline Support & Quick Login Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  HỖ TRỢ KỸ THUẬT & TƯ VẤN TRIỂN KHAI
                </div>
                
                <a 
                  href="tel:0936833319"
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(79, 70, 229, 0.15)',
                    border: '1.5px solid rgba(129, 140, 248, 0.35)',
                    borderRadius: 12,
                    padding: '10px 18px',
                    color: '#fff',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#818cf8'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.35)'}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <Phone size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8', letterSpacing: '0.02em', lineHeight: 1.2 }}>
                      09368.333.19
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      Hotline / Zalo Hỗ trợ 24/7
                    </div>
                  </div>
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={14} color="#10b981" />
                  Bảo mật dữ liệu chuẩn ngân hàng
                </span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleOpenLogin}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 800, cursor: 'pointer', fontSize: 12.5, padding: 0 }}
                >
                  Đăng Nhập Quản Trị →
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Copyright Bar */}
          <div style={{
            borderTop: '1px solid #1e293b',
            paddingTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 12,
            color: '#64748b',
          }}>
            <div>
              © 2026. Tất cả quyền được bảo lưu. Phát triển và vận hành bởi <strong>TQ DIGITAL CO., LTD</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span>Phiên bản Enterprise 2.0</span>
              <span>•</span>
              <span>Đối Soát Đa Hãng Vận Chuyển</span>
            </div>
          </div>

        </div>
      </footer>

      {/* 🌟 9. LOGIN POPUP MODAL (Matching User's Screenshot Exactly) */}
      {isLoginModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          animation: 'fadeIn 0.2s ease-out',
        }} onClick={handleCloseLogin}>
          
          <div style={{
            width: '100%',
            maxWidth: 440,
            background: '#ffffff',
            borderRadius: 24,
            padding: '36px 32px 30px',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.4), 0 0 40px rgba(79, 70, 229, 0.15)',
            position: 'relative',
            animation: 'scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Close Modal Button */}
            <button
              type="button"
              onClick={handleCloseLogin}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Đóng cửa sổ"
            >
              <X size={16} />
            </button>

            {/* Brand Logo in Modal */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)',
              }}>
                <Layers size={30} />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Kế Toán PRO <span style={{ color: '#4f46e5' }}>Enterprise</span>
              </h2>
              <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, fontWeight: 500 }}>
                Hệ thống Quản Lý & Đối Soát Vận Chuyển Chuyên Nghiệp
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                color: '#dc2626',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 16,
                textAlign: 'center',
              }}>
                {errorMsg}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Username Input */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Tên Đăng Nhập
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <User size={17} />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    style={{
                      width: '100%',
                      padding: '11px 14px 11px 38px',
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 10,
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Mật Khẩu
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <Lock size={17} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    style={{
                      width: '100%',
                      padding: '11px 38px 11px 38px',
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#0f172a',
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 10,
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
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
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: 6,
                  padding: '12px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 800,
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 6px 18px rgba(79, 70, 229, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: isLoading ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isLoading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP HỆ THỐNG'}</span>
                {!isLoading && <ArrowRight size={16} />}
              </button>
            </form>

            {/* Note & Security Badge */}
            <div style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 11,
              color: '#64748b',
              lineHeight: 1.4,
            }}>
              <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Truy cập nội bộ có phân quyền — không chia sẻ thông tin đăng nhập</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
