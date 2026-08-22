import React, { useState, useEffect } from 'react';
import {
  X, Building2, Palette, Mail, ShieldCheck, BookOpen,
  Check, Sun, Moon, ChevronRight,
  FileSpreadsheet, ArrowRight, Smartphone,
  Filter, CheckCircle2, Info, Monitor, Lock, Users,
  Settings, Eye, EyeOff, Server, HelpCircle, ExternalLink,
  Send, ShieldCheck as ShieldOk
} from 'lucide-react';
import type { CompanyInfo, EmailSettings } from '../types';
import { StorageService } from '../services/storage';
import { EmailService } from '../services/emailService';
import { UserManagementView } from './UserManagementView';
import { useToast } from './UIFeedback';
import type { UserAccount } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  userRole?: string;
  currentUser?: UserAccount;
  onSaved?: () => void;
  onNavigateTo?: (tab: string) => void;
}

type SettingsTab = 'company' | 'ui' | 'email' | 'security' | 'accounts' | 'guide';

const BASE_TABS: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
  { id: 'company', icon: <Building2 size={15} />, label: 'Công Ty' },
  { id: 'ui', icon: <Palette size={15} />, label: 'Giao Diện' },
  { id: 'email', icon: <Mail size={15} />, label: 'Cài Đặt Mail' },
  { id: 'security', icon: <ShieldCheck size={15} />, label: 'Bảo Mật' },
  { id: 'accounts', icon: <Users size={15} />, label: 'Tài Khoản' }, // ADMIN only
  { id: 'guide', icon: <BookOpen size={15} />, label: 'Hướng Dẫn' },
];

/* ─────────────── TAB: CÔNG TY ─────────────── */
const TabCompany: React.FC<{ onSaved?: () => void; isAdmin: boolean }> = ({ onSaved, isAdmin }) => {
  const { showToast } = useToast();
  const [info, setInfo] = useState<CompanyInfo>(() => StorageService.getCompanyInfo());
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!info.companyName.trim()) { showToast('Vui lòng nhập Tên Công Ty', 'warning'); return; }
    StorageService.saveCompanyInfo(info);
    setSaved(true);
    showToast('Đã lưu thông tin công ty!', 'success');
    if (onSaved) onSaved();
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (label: string, key: keyof CompanyInfo, placeholder: string, icon: React.ReactNode) => (
    <div className="input-group">
      <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon} {label}
      </label>
      <input
        type="text"
        className="input-field"
        value={info[key] as string}
        onChange={e => setInfo({ ...info, [key]: e.target.value })}
        placeholder={placeholder}
        disabled={!isAdmin}
        style={{ padding: '9px 12px' }}
      />
    </div>
  );

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(79,70,229,.08),rgba(16,185,129,.06))', borderRadius: 'var(--radius-md)', padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Thông Tin Công Ty / Nhà Gom Đơn</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Hiển thị trên Email gửi khách & báo cáo đối soát</div>
        </div>
      </div>

      {field('Tên Công Ty / Nhà Gom Đơn (*)', 'companyName', 'VD: Đức Tín Logistics', <Building2 size={13} />)}
      {field('Địa Chỉ Trụ Sở', 'address', 'Số nhà, Đường, Quận, Tỉnh/TP', <Filter size={13} />)}
      {field('Số Điện Thoại / Hotline', 'phone', '0988 xxx xxx', <Smartphone size={13} />)}
      {field('Mã Số Thuế', 'taxCode', '0101234567', <FileSpreadsheet size={13} />)}

      {isAdmin && (
        <button type="submit" className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} style={{ alignSelf: 'flex-end', minWidth: 140 }}>
          {saved ? <><CheckCircle2 size={15} /> Đã Lưu!</> : <><Check size={15} /> Lưu Thông Tin</>}
        </button>
      )}
      {!isAdmin && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Lock size={12} /> Chỉ Admin mới có thể chỉnh sửa thông tin này.
        </div>
      )}
    </form>
  );
};

/* ─────────────── TAB: GIAO DIỆN ─────────────── */
const TabUI: React.FC<{ theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void }> = ({ theme, setTheme }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '18px 20px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Monitor size={15} /> Chế Độ Giao Diện
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {(['light', 'dark'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${theme === t ? 'var(--primary)' : 'var(--border-color)'}`,
              background: theme === t ? 'rgba(79,70,229,.08)' : 'var(--bg-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              transition: 'all .15s',
            }}
          >
            {t === 'light'
              ? <Sun size={24} color="#f59e0b" />
              : <Moon size={24} color="#818cf8" />}
            <span style={{ fontSize: 13, fontWeight: 600, color: theme === t ? 'var(--primary)' : 'var(--text-main)' }}>
              {t === 'light' ? '☀️ Sáng' : '🌙 Tối'}
            </span>
            {theme === t && <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>✓ Đang dùng</span>}
          </button>
        ))}
      </div>
    </div>

    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '18px 20px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={15} /> Thông Tin Phiên Bản
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
        {[
          ['Tên ứng dụng', 'GomDon Pro Enterprise'],
          ['Phiên bản', 'v2.0 • 2026'],
          ['Môi trường', 'Production (VPS)'],
          ['Hỗ trợ trình duyệt', 'Chrome, Edge, Firefox, Safari'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─────────────── TAB: EMAIL (Full Config) ─────────────── */
const TabEmail: React.FC = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState<EmailSettings>(() => ({
    ...StorageService.getEmailSettings(),
  }));
  const [showPwd, setShowPwd] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error' | 'sending'; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senderEmail.trim()) { showToast('Vui lòng nhập địa chỉ Email gửi', 'warning'); return; }
    if (!(form.emailPassword ?? '').trim()) { showToast('Vui lòng nhập Mật khẩu ứng dụng (App Password)', 'warning'); return; }
    StorageService.saveEmailSettings(form);
    setSaved(true);
    showToast('Đã lưu cài đặt Email thành công!', 'success');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    if (!form.senderEmail || !form.emailPassword) {
      setTestStatus({ type: 'error', msg: 'Vui lòng điền Email gửi và Mật khẩu App Password trước.' });
      return;
    }
    if (!testEmail.trim()) {
      setTestStatus({ type: 'error', msg: 'Vui lòng nhập email nhận để gửi thử.' });
      return;
    }
    setTestStatus({ type: 'sending', msg: 'Đang kết nối SMTP và gửi email thử...' });
    const res = await EmailService.sendRealEmail({
      senderName: form.senderName,
      senderEmail: form.senderEmail,
      emailPassword: form.emailPassword,
      smtpHost: form.smtpHost || 'smtp.gmail.com',
      smtpPort: form.smtpPort || 465,
      to: testEmail.trim(),
      subject: `【KIỂM TRA】Thử nghiệm kết nối Email từ ${form.senderName}`,
      text: `Xin chào,\n\nĐây là email gửi thử nghiệm tự động từ hệ thống GomDon Pro.\nTài khoản gửi: ${form.senderEmail}\nThời gian: ${new Date().toLocaleString('vi-VN')}\n\nNếu bạn nhận được email này, cấu hình đã hoàn toàn chính xác!`,
    });
    setTestStatus(res.success
      ? { type: 'success', msg: `✓ Thành công! Đã gửi email thử tới: ${testEmail}. Kiểm tra hộp thư đến.` }
      : { type: 'error', msg: `✕ Lỗi: ${res.error}` }
    );
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,rgba(79,70,229,.08),rgba(16,185,129,.06))', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Mail size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Cài Đặt Gmail / SMTP Gửi Email Đối Soát</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Thiết lập tài khoản Gmail để tự động gửi bảng kê COD cho các Shop</div>
        </div>
      </div>

      {/* Sender Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Tên Hiển Thị Người Gửi (*)</label>
          <input type="text" className="input-field" required placeholder="VD: Đức Tín Logistics"
            value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Địa Chỉ Email Gửi (*)</label>
          <input type="email" className="input-field" required placeholder="doisoat@gmail.com"
            value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.target.value })} />
        </div>
      </div>

      {/* App Password */}
      <div className="input-group" style={{ marginBottom: 0 }}>
        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Lock size={13} /> Mật Khẩu Ứng Dụng — Gmail App Password (*)
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPwd ? 'text' : 'password'}
            className="input-field"
            required
            placeholder="Nhập 16 ký tự App Password (VD: abcd efgh ijkl mnop)..."
            value={form.emailPassword}
            onChange={e => setForm({ ...form, emailPassword: e.target.value })}
            style={{ paddingRight: 40, fontFamily: showPwd ? 'monospace' : 'inherit' }}
          />
          <button type="button" onClick={() => setShowPwd(!showPwd)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* SMTP */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Server size={13} /> SMTP Host</label>
          <input type="text" className="input-field" placeholder="smtp.gmail.com"
            value={form.smtpHost || 'smtp.gmail.com'} onChange={e => setForm({ ...form, smtpHost: e.target.value })} />
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Port</label>
          <input type="number" className="input-field" placeholder="465"
            value={form.smtpPort || 465} onChange={e => setForm({ ...form, smtpPort: parseInt(e.target.value) || 465 })} />
        </div>
      </div>

      {/* How to get App Password */}
      <div style={{ background: 'rgba(79,70,229,.06)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <HelpCircle size={14} /> Cách lấy "Mật khẩu ứng dụng" Gmail:
        </div>
        <ol style={{ paddingLeft: 18, margin: 0, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <li>Vào: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>myaccount.google.com/security <ExternalLink size={10} /></a></li>
          <li>Bật <strong style={{ color: 'var(--text-main)' }}>"Xác minh 2 bước"</strong></li>
          <li>Tìm <strong style={{ color: 'var(--text-main)' }}>"Mật khẩu ứng dụng"</strong> → Tạo mới → Copy 16 ký tự → Dán vào ô trên</li>
        </ol>
      </div>

      {/* Test send */}
      <div style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>🧪 Gửi Email Test Kết Nối:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="email" className="input-field" placeholder="Email nhận thử (ví dụ: your@gmail.com)..."
            value={testEmail} onChange={e => setTestEmail(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', fontSize: 12.5 }} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleTest} style={{ whiteSpace: 'nowrap' }}>
            <Send size={13} /> Gửi Test
          </button>
        </div>
        {testStatus && (
          <div className={`badge ${testStatus.type === 'success' ? 'badge-success' : testStatus.type === 'error' ? 'badge-danger' : 'badge-warning'}`}
            style={{ padding: '6px 10px', fontSize: 11.5 }}>
            {testStatus.msg}
          </div>
        )}
      </div>

      {/* Footer save */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ShieldOk size={13} color="var(--success)" /> Mật khẩu lưu trữ an toàn trên thiết bị của bạn.
        </div>
        <button type="submit" className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} style={{ minWidth: 160 }}>
          {saved ? <><CheckCircle2 size={15} /> Đã Lưu!</> : <><Check size={15} /> Lưu Cài Đặt Mail</>}
        </button>
      </div>
    </form>
  );
};

/* ─────────────── TAB: BẢO MẬT ─────────────── */
const TabSecurity: React.FC<{ isAdmin: boolean; onNavigateTo?: (tab: string) => void; onClose: () => void }> = ({ isAdmin, onNavigateTo, onClose }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={14} /> Chính Sách Thiết Bị
      </div>
      {[
        { icon: '🔒', title: 'Một thiết bị / tài khoản', desc: 'Mỗi tài khoản nhân viên chỉ được đăng nhập trên 1 thiết bị tại 1 thời điểm.' },
        { icon: '⚡', title: 'Tự động kick', desc: 'Nếu Admin ngắt kết nối, phiên làm việc hiện tại sẽ bị đóng sau tối đa 10 giây.' },
        { icon: '👑', title: 'Admin không giới hạn', desc: 'Tài khoản Admin được phép đăng nhập trên nhiều thiết bị đồng thời.' },
        { icon: '🚫', title: 'Không thể đăng nhập chồng', desc: 'Nhân viên muốn đổi máy phải nhờ Admin ngắt thiết bị cũ trước.' },
      ].map(item => (
        <div key={item.title} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{item.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>

    {isAdmin && (
      <button
        className="btn btn-secondary"
        style={{ fontSize: 13 }}
        onClick={() => { if (onNavigateTo) onNavigateTo('users'); onClose(); }}
      >
        <Users size={14} /> Quản Lý Nhân Viên & Thiết Bị
      </button>
    )}

    <div style={{ background: 'rgba(16,185,129,.06)', borderRadius: 'var(--radius-md)', padding: '12px 14px', border: '1px solid rgba(16,185,129,.2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <ShieldCheck size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Dữ liệu được lưu trữ trên VPS riêng. Mọi thao tác đều được ghi log. Hệ thống không chia sẻ dữ liệu với bên thứ ba.
      </div>
    </div>
  </div>
);

/* ─────────────── TAB: HƯỚNG DẪN ─────────────── */


const StepRow: React.FC<{ n: number; text: string; sub?: string }> = ({ n, text, sub }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
      {n}
    </div>
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>{text}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const Tag: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, marginRight: 4, display: 'inline-block', marginBottom: 4 }}>
    {children}
  </span>
);

const InfoBox: React.FC<{ type: 'tip' | 'warn' | 'info'; children: React.ReactNode }> = ({ type, children }) => {
  const map = { tip: ['#10b981', '💡'], warn: ['#f59e0b', '⚠️'], info: ['#4f46e5', 'ℹ️'] };
  const [color, emoji] = map[type];
  return (
    <div style={{ background: `${color}0d`, border: `1px solid ${color}30`, borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
      <span style={{ flexShrink: 0 }}>{emoji}</span>
      <span>{children}</span>
    </div>
  );
};

const VisualDiagram: React.FC<{ items: { icon: string; label: string; color: string }[]; arrows?: boolean }> = ({ items, arrows }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: `${item.color}15`, border: `2px solid ${item.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {item.icon}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 60 }}>{item.label}</span>
        </div>
        {arrows && i < items.length - 1 && (
          <ArrowRight size={16} color="var(--text-dim)" style={{ flexShrink: 0, marginBottom: 16 }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const TabGuide: React.FC = () => {
  const [openSection, setOpenSection] = useState<string | null>('overview');
  const toggle = (id: string) => setOpenSection(p => p === id ? null : id);

  const sections: { id: string; icon: string; title: string; color: string; content: React.ReactNode }[] = [
    {
      id: 'overview',
      icon: '🗺️',
      title: 'Tổng Quan Hệ Thống',
      color: '#4f46e5',
      content: (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
            <strong style={{ color: 'var(--text-main)' }}>GomDon Pro Enterprise</strong> là hệ thống quản lý đối soát COD & logistics dành riêng cho các nhà gom đơn vận chuyển. Hệ thống giúp bạn tự động tính tiền, gửi email đối soát và quản lý công nợ cho hàng chục Shop cùng lúc.
          </p>
          <VisualDiagram arrows items={[
            { icon: '📁', label: 'File NVC', color: '#4f46e5' },
            { icon: '📊', label: 'File Shop', color: '#10b981' },
            { icon: '⚙️', label: 'Đối Soát', color: '#f59e0b' },
            { icon: '📧', label: 'Gửi Email', color: '#ec4899' },
            { icon: '💰', label: 'Công Nợ', color: '#14b8a6' },
          ]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            {[
              ['📊', 'Đối Soát Kéo Thả', 'J&T ghép 2 file; GHN nạp 1 file theo sheet/kỳ'],
              ['🏪', 'Quản Lý Shop', 'Lưu thông tin & biểu giá riêng từng khách'],
              ['🚚', 'Bảng Giá NVC', 'Cài giá sỉ từng hãng vận chuyển'],
              ['📧', 'Gửi Email', 'Gửi đối soát hàng loạt qua Gmail'],
              ['💳', 'Công Nợ', 'Theo dõi tiền COD & lịch đi tiền NH'],
              ['📈', 'Lịch Sử', 'Thống kê doanh thu theo kỳ & Shop'],
            ].map(([ic, t, d]) => (
              <div key={t} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{ic}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{t}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'reconcile',
      icon: '📊',
      title: 'Đối Soát Kéo Thả — Tính Tiền COD',
      color: '#4f46e5',
      content: (
        <div>
          <VisualDiagram arrows items={[
            { icon: '🗂️', label: 'Tải File NVC', color: '#4f46e5' },
            { icon: '🔗', label: 'Xác nhận cột', color: '#f59e0b' },
            { icon: '⚡', label: 'Kiểm tra chênh lệch', color: '#ec4899' },
            { icon: '📥', label: 'Xuất bảng kê', color: '#14b8a6' },
          ]} />
          <StepRow n={1} text="Chọn đúng hãng và kỳ" sub="Hiện chỉ dùng J&T và GHN. Với GHN, chọn chính xác một sheet/kỳ; app không tự gộp các sheet." />
          <StepRow n={2} text="Tải đúng cấu trúc file" sub="J&T bắt buộc tải File NVC và File đơn xuất từ App. GHN chỉ tải một file đối soát; app tự tách bảng COD và bảng cước." />
          <StepRow n={3} text="Xác nhận ánh xạ cột" sub="Kiểm tra mã vận đơn, COD, cước, trạng thái và định danh shop trước khi bấm đối soát. Không dùng mapping cũ nếu file NVC đổi mẫu." />
          <StepRow n={4} text="Xử lý đơn chưa khớp" sub="Mọi đơn chưa xác định được shop, trạng thái hoặc có lỗi công thức phải được xử lý trước. Không tự gán shop theo tên gần giống." />
          <StepRow n={5} text="Đối chiếu nguồn rồi xuất" sub="So sánh tổng nguồn NVC với bảng kê. Chỉ khi không còn đơn treo, xuất Excel/ZIP/email cho từng shop." />
          <InfoBox type="tip">Một shop có thể có nhiều SĐT và tên gọi khác (alias), nhưng mỗi định danh phải là duy nhất để tránh nhầm shop.</InfoBox>
          <InfoBox type="warn">Cước NVC bằng 0 nghĩa là không trừ cước shop lại trong kỳ này. Nếu thấy chênh lệch, đối chiếu theo từng mã vận đơn, không sửa tổng tiền thủ công.</InfoBox>
        </div>
      ),
    },
    {
      id: 'shop',
      icon: '🏪',
      title: 'Quản Lý Shop & Biểu Giá',
      color: '#10b981',
      content: (
        <div>
          <StepRow n={1} text="Thêm Shop Mới" sub="Vào tab Quản Lý Shop → bấm + Thêm Shop → điền tên, SĐT, số tài khoản ngân hàng." />
          <StepRow n={2} text="Cài Biểu Giá Riêng Theo Cân Nặng" sub="Mỗi Shop có bảng giá bậc thang độc lập. VD: 0–1kg: 20,000đ | 1.1–2kg: 25,000đ..." />
          <StepRow n={3} text="Cài Phụ Thu Cân Vượt Trội" sub="Nếu đơn vượt nấc cao nhất, hệ thống tự cộng thêm phụ thu theo step bạn cài." />
          <StepRow n={4} text="Cài Phí Hoàn Hàng" sub="Nhập % phí hoàn. VD: 20% → đơn hoàn 30,000đ tiền ship sẽ bị trừ thêm 6,000đ." />
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px', marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>📐 Ví Dụ Biểu Giá Linh Động:</div>
            {[
              ['0 → 0.5 kg', '15,000đ'],
              ['0.6 → 1 kg', '20,000đ'],
              ['1.1 → 2 kg', '25,000đ'],
              ['2.1 → 5 kg', '30,000đ'],
              ['> 5 kg', '+ 5,000đ / 1kg vượt'],
            ].map(([r, p]) => (
              <div key={r} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <span>{r}</span>
                <strong style={{ color: 'var(--success)' }}>{p}</strong>
              </div>
            ))}
          </div>
          <InfoBox type="tip">Khi thêm nấc mới, hệ thống tự gợi ý khoảng tiếp theo (VD: sau 0–1kg sẽ gợi ý 1.1–2kg).</InfoBox>
        </div>
      ),
    },
    {
      id: 'carrier',
      icon: '🚚',
      title: 'Bảng Giá NVC (Hãng Vận Chuyển)',
      color: '#f59e0b',
      content: (
        <div>
          <StepRow n={1} text="Chỉ Admin cập nhật cấu hình" sub="Bảng giá và profile hãng là cấu hình tài chính. Người xem chỉ có quyền đọc." />
          <StepRow n={2} text="Cài Giá Cước Gốc Bậc Thang" sub="Cài bảng giá sỉ bạn ký với NVC để theo dõi lợi nhuận. Số cước đối soát thực tế vẫn lấy ưu tiên từ file NVC." />
          <StepRow n={3} text="Cấu Hình Ánh Xạ Cột" sub="Mỗi NVC có thể đổi tên cột. Chỉ lưu profile sau khi đã kiểm tra bằng file mẫu thật." />
          <StepRow n={4} text="Cấu Hình Cột Xuất" sub="Chọn các cột xuất ra file Excel riêng cho từng khách sau khi đối soát." />
          <InfoBox type="info">Bảng giá NVC dùng để tính lợi nhuận gộp của bạn. Giá bán cho Shop được cài riêng trong tab Quản Lý Shop.</InfoBox>
        </div>
      ),
    },
    {
      id: 'email',
      icon: '📧',
      title: 'Gửi Email Đối Soát Hàng Loạt',
      color: '#ec4899',
      content: (
        <div>
          <StepRow n={1} text="Cài Đặt Gmail" sub="Tab Email → Cài Gmail → nhập địa chỉ Gmail + App Password (không dùng mật khẩu Gmail thường)." />
          <StepRow n={2} text="Soạn Nội Dung Email" sub="Viết nội dung mẫu với biến động: {shopName}, {period}, {totalCOD}, {totalFee}, {netCOD}..." />
          <StepRow n={3} text="Chọn Kỳ & Danh Sách Shop" sub="Chọn kỳ đối soát cần gửi, tích chọn shop muốn gửi (hoặc chọn tất cả)." />
          <StepRow n={4} text="Xem Trước & Gửi" sub="Bấm Xem Trước để kiểm tra email từng shop. Sau khi OK → bấm Gửi Tất Cả." />
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px', marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>🔤 Biến Động Trong Email:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                ['{shopName}', 'Tên Shop'],
                ['{period}', 'Kỳ đối soát'],
                ['{totalCOD}', 'Tổng COD thu hộ'],
                ['{totalFee}', 'Tổng phí ship'],
                ['{netCOD}', 'Tiền thực nhận'],
                ['{orderCount}', 'Số đơn hàng'],
              ].map(([v, d]) => (
                <div key={v} style={{ fontSize: 11.5, display: 'flex', gap: 4 }}>
                  <code style={{ background: 'var(--primary)', color: '#fff', padding: '1px 5px', borderRadius: 4, fontSize: 10.5 }}>{v}</code>
                  <span style={{ color: 'var(--text-muted)' }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
          <InfoBox type="warn">App Password khác với mật khẩu Gmail. Tạo tại: Google Account → Bảo mật → Xác minh 2 bước → App Passwords.</InfoBox>
        </div>
      ),
    },
    {
      id: 'debt',
      icon: '💳',
      title: 'Công Nợ & Quản Lý Đi Tiền',
      color: '#14b8a6',
      content: (
        <div>
          <StepRow n={1} text="Xem Bảng Công Nợ Tổng Hợp" sub="Tab Công Nợ → bảng tổng hợp số tiền COD còn nợ từng Shop, đã đi bao nhiêu, còn lại bao nhiêu." />
          <StepRow n={2} text="Đánh Dấu Đã Đi Tiền" sub="Sau khi chuyển khoản ngân hàng cho Shop → bấm Đánh Dấu Đã Đi → nhập số tiền & ngày." />
          <StepRow n={3} text="Xem Lịch Sử Đi Tiền" sub="Mỗi Shop có timeline lịch sử đi tiền chi tiết: ngày, số tiền, kỳ nào." />
          <StepRow n={4} text="VietQR Tự Động" sub="Bấm biểu tượng QR → hệ thống tạo mã QR chuyển khoản ngân hàng tự động từ STK Shop đã lưu." />
          <InfoBox type="tip">Công nợ được tự động tính từ dữ liệu đối soát. Bạn chỉ cần đánh dấu khi đã thực sự chuyển khoản.</InfoBox>
        </div>
      ),
    },
    {
      id: 'backup',
      icon: '💾',
      title: 'Sao Lưu & Khôi Phục Dữ Liệu',
      color: '#6366f1',
      content: (
        <div>
          <StepRow n={1} text="Sao Lưu Dữ Liệu" sub="Sidebar → Sao Lưu Dữ Liệu → Tab Sao Lưu → Tải Về File JSON. Lưu file này nơi an toàn." />
          <StepRow n={2} text="Khôi Phục Từ File" sub="Dán nội dung JSON đã sao lưu; hệ thống tạo snapshot an toàn phía server trước khi khôi phục." />
          <StepRow n={3} text="Đồng Bộ Lên Server" sub="Dữ liệu được tự động đồng bộ lên VPS mỗi khi có thay đổi. Bạn có thể dùng từ nhiều máy tính." />
          <InfoBox type="warn">Khôi phục làm thay đổi dữ liệu hiện tại. Chỉ Admin thực hiện sau khi đã tạo và kiểm tra bản sao lưu.</InfoBox>
          <InfoBox type="tip">Nên sao lưu định kỳ hàng tuần và trước mỗi kỳ đối soát lớn.</InfoBox>
        </div>
      ),
    },
    {
      id: 'users',
      icon: '👥',
      title: 'Quản Lý Tài Khoản Nhân Viên',
      color: '#8b5cf6',
      content: (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { role: 'ADMIN', color: '#4f46e5', desc: 'Toàn quyền, không giới hạn thiết bị' },
              { role: 'ACCOUNTANT', color: '#10b981', desc: 'Đối soát, email, công nợ. 1 thiết bị.' },
              { role: 'STAFF', color: '#f59e0b', desc: 'Chỉ xem & đối soát cơ bản. 1 thiết bị.' },
            ].map(r => (
              <div key={r.role} style={{ background: `${r.color}10`, border: `1px solid ${r.color}30`, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                <Tag color={r.color}>{r.role}</Tag>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{r.desc}</div>
              </div>
            ))}
          </div>
          <StepRow n={1} text="Tạo Tài Khoản" sub="Tab Nhân Viên → + Thêm → nhập tên đăng nhập, mật khẩu, họ tên, phân quyền." />
          <StepRow n={2} text="Khóa / Mở Tài Khoản" sub="Bấm biểu tượng khóa để tạm ngưng truy cập mà không xóa tài khoản." />
          <StepRow n={3} text="Ngắt Thiết Bị (Kick)" sub="Nếu nhân viên cần đổi máy → bấm Ngắt TB trong cột Thiết Bị → họ đăng nhập máy mới được." />
          <InfoBox type="info">Phiên đăng nhập nhân viên được kiểm tra 10 giây/lần. Nếu bị kick, hệ thống tự đăng xuất ngay.</InfoBox>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg,rgba(79,70,229,.1),rgba(16,185,129,.07))', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: 16, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 32 }}>📖</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-main)' }}>Hướng Dẫn Sử Dụng GomDon Pro</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Bấm vào từng mục bên dưới để xem hướng dẫn chi tiết từng tính năng.</div>
        </div>
      </div>

      {sections.map(sec => (
        <div key={sec.id} style={{ marginBottom: 8, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => toggle(sec.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', background: openSection === sec.id ? `${sec.color}0e` : 'var(--bg-primary)',
              border: 'none', cursor: 'pointer', transition: 'background .15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{sec.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: openSection === sec.id ? sec.color : 'var(--text-main)' }}>{sec.title}</span>
            </div>
            <ChevronRight size={15} color="var(--text-dim)" style={{ transform: openSection === sec.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {openSection === sec.id && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              {sec.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─────────────── TAB: TÀI KHOẢN (ADMIN ONLY) ─────────────── */
const TabAccounts: React.FC<{ currentUser?: UserAccount }> = ({ currentUser }) => {
  if (!currentUser) return null;
  return (
    <div style={{ padding: '16px 20px' }}>
      <UserManagementView currentUser={currentUser} />
    </div>
  );
};

/* ─────────────── MAIN MODAL ─────────────── */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, theme, setTheme, userRole = 'STAFF', currentUser, onSaved, onNavigateTo,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const isAdmin = userRole === 'ADMIN';
  const TAB_LIST = isAdmin ? BASE_TABS : BASE_TABS.filter(t => t.id !== 'accounts');

  useEffect(() => {
    if (isOpen) setActiveTab('company');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ 
          maxWidth: activeTab === 'accounts' ? 1080 : 760, 
          width: '95vw',
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          transition: 'max-width 0.25s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(79,70,229,.07),rgba(16,185,129,.05))', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)' }}>Cài Đặt Hệ Thống</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>GomDon Pro Enterprise</div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', flexShrink: 0, overflowX: 'auto' }}>
          {TAB_LIST.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '11px 18px',
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-dim)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13, whiteSpace: 'nowrap', transition: 'all .15s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: activeTab === 'accounts' ? 0 : '20px 24px' }}>
          {activeTab === 'company' && <TabCompany onSaved={onSaved} isAdmin={isAdmin} />}
          {activeTab === 'ui' && <TabUI theme={theme} setTheme={setTheme} />}
          {activeTab === 'email' && <TabEmail />}
          {activeTab === 'security' && <TabSecurity isAdmin={isAdmin} onNavigateTo={onNavigateTo} onClose={onClose} />}
          {activeTab === 'accounts' && isAdmin && <TabAccounts currentUser={currentUser} />}
          {activeTab === 'guide' && <TabGuide />}
        </div>
      </div>
    </div>
  );
};
