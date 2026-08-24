import React, { useState, useEffect } from 'react';
import {
  X, Building2, Mail, ShieldCheck, BookOpen,
  Check, ChevronRight,
  FileSpreadsheet, ArrowRight, Smartphone,
  Filter, CheckCircle2, Lock, Users,
  Settings, Eye, EyeOff, Server, HelpCircle, ExternalLink,
  Send, ShieldCheck as ShieldOk, MessageSquare,
  Zap, Bot, RotateCcw, Database, Download, Upload,
  RefreshCcw, FolderArchive, Trash2, AlertTriangle
} from 'lucide-react';
import type { CompanyInfo, EmailSettings, ZaloZnsSettings, TelegramSettings, UserAccount } from '../types';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import { EmailService } from '../services/emailService';
import { TelegramService } from '../services/telegramService';
import { UserManagementView } from './UserManagementView';
import { useToast, useConfirm } from './UIFeedback';

import { AuditLogView } from './AuditLogView';
import { FileText } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  setTheme?: (t: 'dark' | 'light') => void;
  userRole?: string;
  currentUser?: UserAccount;
  onSaved?: () => void;
  onNavigateTo?: (tab: string) => void;
}

type SettingsTab = 'company' | 'notifications' | 'backup' | 'security' | 'accounts' | 'audit' | 'guide';

const BASE_TABS: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
  { id: 'company', icon: <Building2 size={15} />, label: 'Công Ty' },
  { id: 'notifications', icon: <Send size={15} />, label: 'Gửi Thông Báo' },
  { id: 'backup', icon: <Database size={15} />, label: 'Sao Lưu Dữ Liệu' }, // ADMIN only
  { id: 'security', icon: <ShieldCheck size={15} />, label: 'Bảo Mật' },
  { id: 'accounts', icon: <Users size={15} />, label: 'Tài Khoản' }, // ADMIN only
  { id: 'audit', icon: <FileText size={15} />, label: 'Nhật Ký Kiểm Toán' }, // ADMIN only
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
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Thông Tin Công Ty / Doanh Nghiệp</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Hiển thị trên Email gửi khách & báo cáo đối soát</div>
        </div>
      </div>

      {field('Tên Công Ty / Doanh Nghiệp (*)', 'companyName', 'VD: Công Ty Logistics & Đối Soát Vận Chuyển', <Building2 size={13} />)}
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


/* ─────────────── TAB: THÔNG BÁO ĐA KÊNH (EMAIL • ZALO • TELEGRAM) ─────────────── */
const TabNotifications: React.FC = () => {
  const { showToast } = useToast();
  const [channel, setChannel] = useState<'email' | 'zalo' | 'telegram'>('email');

  /* 1. Email State */
  const [emailForm, setEmailForm] = useState<EmailSettings>(() => StorageService.getEmailSettings());
  const [showEmailPwd, setShowEmailPwd] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<{ type: 'success' | 'error' | 'sending'; msg: string } | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);

  /* 2. Zalo ZNS State */
  const [zaloForm, setZaloForm] = useState<ZaloZnsSettings>(() => StorageService.getZaloZnsSettings());
  const [zaloSaved, setZaloSaved] = useState(false);

  /* 3. Telegram State */
  const [telegramForm, setTelegramForm] = useState<TelegramSettings>(() => StorageService.getTelegramSettings());
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [telegramSaved, setTelegramSaved] = useState(false);

  /* Handlers: Email */
  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.senderEmail.trim()) { showToast('Vui lòng nhập địa chỉ Email gửi', 'warning'); return; }
    if (!(emailForm.emailPassword ?? '').trim()) { showToast('Vui lòng nhập Mật khẩu ứng dụng (App Password)', 'warning'); return; }
    StorageService.saveEmailSettings(emailForm);
    setEmailSaved(true);
    showToast('Đã lưu cài đặt Gmail thành công!', 'success');
    setTimeout(() => setEmailSaved(false), 2000);
  };

  const handleTestEmail = async () => {
    if (!emailForm.senderEmail || !emailForm.emailPassword) {
      setTestEmailStatus({ type: 'error', msg: 'Vui lòng điền Email gửi và Mật khẩu App Password trước.' });
      return;
    }
    if (!testEmail.trim()) {
      setTestEmailStatus({ type: 'error', msg: 'Vui lòng nhập email nhận để gửi thử.' });
      return;
    }
    setTestEmailStatus({ type: 'sending', msg: 'Đang kết nối SMTP và gửi email thử...' });
    const res = await EmailService.sendRealEmail({
      senderName: emailForm.senderName,
      senderEmail: emailForm.senderEmail,
      emailPassword: emailForm.emailPassword,
      smtpHost: emailForm.smtpHost || 'smtp.gmail.com',
      smtpPort: emailForm.smtpPort || 465,
      to: testEmail.trim(),
      subject: `【KIỂM TRA】Thử nghiệm kết nối Email từ ${emailForm.senderName}`,
      text: `Xin chào,\n\nĐây là email gửi thử nghiệm tự động từ hệ thống Kế Toán PRO.\nTài khoản gửi: ${emailForm.senderEmail}\nThời gian: ${new Date().toLocaleString('vi-VN')}\n\nNếu bạn nhận được email này, cấu hình đã hoàn toàn chính xác!`,
    });
    setTestEmailStatus(res.success
      ? { type: 'success', msg: `✓ Thành công! Đã gửi email thử tới: ${testEmail}.` }
      : { type: 'error', msg: `✕ Lỗi: ${res.error}` }
    );
  };

  /* Handlers: Zalo */
  const handleSaveZalo = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveZaloZnsSettings(zaloForm);
    setZaloSaved(true);
    showToast('Đã lưu cấu hình Zalo ZNS thành công!', 'success');
    setTimeout(() => setZaloSaved(false), 2000);
  };

  /* Handlers: Telegram */
  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveTelegramSettings(telegramForm);
    setTelegramSaved(true);
    showToast('Đã lưu cấu hình Telegram Bot thành công!', 'success');
    setTimeout(() => setTelegramSaved(false), 2000);
  };

  const handleCheckTelegramBot = async () => {
    if (!telegramForm.botToken?.trim()) {
      showToast('Vui lòng nhập Bot Token trước khi kiểm tra!', 'warning');
      return;
    }
    setIsCheckingBot(true);
    const res = await TelegramService.getBotInfo(telegramForm.botToken);
    setIsCheckingBot(false);
    if (res.success) {
      showToast(`✅ Kết nối Bot thành công: ${res.botName} (@${res.username})`, 'success');
    } else {
      showToast(`❌ Lỗi Bot: ${res.error}`, 'error');
    }
  };

  const handleTestTelegramPing = async () => {
    if (!telegramForm.botToken?.trim() || !telegramForm.defaultChatId?.trim()) {
      showToast('Vui lòng nhập đầy đủ Bot Token và Chat ID trước khi test!', 'warning');
      return;
    }
    setIsTestingPing(true);
    const res = await TelegramService.testConnection(telegramForm.botToken, telegramForm.defaultChatId);
    setIsTestingPing(false);
    if (res.success) {
      showToast('🚀 Đã gửi tin nhắn kiểm tra thành công vào Telegram!', 'success');
    } else {
      showToast(`❌ Lỗi gửi tin: ${res.error}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* 🌟 3 SUB-TABS: GMAIL • ZALO ZNS • TELEGRAM BOT */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 255, 0.95) 100%)',
        padding: '5px',
        borderRadius: 12,
        border: '1.5px solid #dbe6f2',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
      }}>
        {/* Sub-tab 1: Gmail */}
        <button
          type="button"
          onClick={() => setChannel('email')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            border: channel === 'email' ? '1.5px solid #4f46e5' : '1px solid transparent',
            background: channel === 'email' ? 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)' : 'transparent',
            color: channel === 'email' ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: channel === 'email' ? '0 3px 10px rgba(79, 70, 229, 0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Mail size={15} />
          <span>1. Cài Đặt Gmail / SMTP</span>
        </button>

        {/* Sub-tab 2: Zalo ZNS */}
        <button
          type="button"
          onClick={() => setChannel('zalo')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            border: channel === 'zalo' ? '1.5px solid #0068ff' : '1px solid transparent',
            background: channel === 'zalo' ? 'linear-gradient(135deg, #0068ff 0%, #0052cc 100%)' : 'transparent',
            color: channel === 'zalo' ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: channel === 'zalo' ? '0 3px 10px rgba(0, 104, 255, 0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <MessageSquare size={15} />
          <span>2. Cài Đặt Zalo ZNS (OA)</span>
        </button>

        {/* Sub-tab 3: Telegram Bot */}
        <button
          type="button"
          onClick={() => setChannel('telegram')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            border: channel === 'telegram' ? '1.5px solid #0088cc' : '1px solid transparent',
            background: channel === 'telegram' ? 'linear-gradient(135deg, #0088cc 0%, #006699 100%)' : 'transparent',
            color: channel === 'telegram' ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: channel === 'telegram' ? '0 3px 10px rgba(0, 136, 204, 0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Send size={15} />
          <span>3. Cài Đặt Telegram Bot</span>
        </button>
      </div>

      {/* ──────────────── 1. SUB-TAB: GMAIL / SMTP ──────────────── */}
      {channel === 'email' && (
        <form onSubmit={handleSaveEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(79,70,229,.08),rgba(16,185,129,.06))', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mail size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Cài Đặt Gmail / SMTP Gửi Email Đối Soát</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Thiết lập tài khoản Gmail để tự động gửi bảng kê COD và đính kèm file Excel cho các Shop</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Tên Hiển Thị Người Gửi (*)</label>
              <input type="text" className="input-field" required placeholder="VD: Công Ty Logistics & Gom Đơn"
                value={emailForm.senderName} onChange={e => setEmailForm({ ...emailForm, senderName: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Địa Chỉ Email Gửi (*)</label>
              <input type="email" className="input-field" required placeholder="doisoat@gmail.com"
                value={emailForm.senderEmail} onChange={e => setEmailForm({ ...emailForm, senderEmail: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <Lock size={13} /> Mật Khẩu Ứng Dụng — Gmail App Password (16 ký tự) (*)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showEmailPwd ? 'text' : 'password'}
                className="input-field"
                required
                placeholder="Nhập 16 ký tự App Password (VD: abcd efgh ijkl mnop)..."
                value={emailForm.emailPassword}
                onChange={e => setEmailForm({ ...emailForm, emailPassword: e.target.value })}
                style={{ paddingRight: 40, fontFamily: showEmailPwd ? 'monospace' : 'inherit', padding: '7px 10px', fontSize: 12.5 }}
              />
              <button type="button" onClick={() => setShowEmailPwd(!showEmailPwd)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
                {showEmailPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}><Server size={13} /> SMTP Host</label>
              <input type="text" className="input-field" placeholder="smtp.gmail.com"
                value={emailForm.smtpHost || 'smtp.gmail.com'} onChange={e => setEmailForm({ ...emailForm, smtpHost: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Port</label>
              <input type="number" className="input-field" placeholder="465"
                value={emailForm.smtpPort || 465} onChange={e => setEmailForm({ ...emailForm, smtpPort: parseInt(e.target.value) || 465 })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
          </div>

          {/* Guide */}
          <div style={{ background: 'rgba(79,70,229,.06)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 11.5 }}>
            <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <HelpCircle size={13} /> Cách lấy "Mật khẩu ứng dụng" Gmail (16 ký tự):
            </div>
            <ol style={{ paddingLeft: 18, margin: 0, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <li>Vào: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>myaccount.google.com/security <ExternalLink size={10} /></a></li>
              <li>Bật <strong style={{ color: 'var(--text-main)' }}>"Xác minh 2 bước"</strong></li>
              <li>Tìm <strong style={{ color: 'var(--text-main)' }}>"Mật khẩu ứng dụng"</strong> → Tạo mới → Copy 16 ký tự → Dán vào ô trên</li>
            </ol>
          </div>

          {/* Test Ping */}
          <div style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>🧪 Gửi Email Test Kết Nối:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="email" className="input-field" placeholder="Email nhận thử (ví dụ: your@gmail.com)..."
                value={testEmail} onChange={e => setTestEmail(e.target.value)}
                style={{ flex: 1, padding: '5px 10px', fontSize: 12 }} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleTestEmail} style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}>
                <Send size={12} /> Gửi Test
              </button>
            </div>
            {testEmailStatus && (
              <div className={`badge ${testEmailStatus.type === 'success' ? 'badge-success' : testEmailStatus.type === 'error' ? 'badge-danger' : 'badge-warning'}`}
                style={{ padding: '4px 8px', fontSize: 11 }}>
                {testEmailStatus.msg}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldOk size={13} color="var(--success)" /> Mật khẩu lưu trữ an toàn trên thiết bị của bạn.
            </div>
            <button type="submit" className={`btn ${emailSaved ? 'btn-success' : 'btn-primary'} btn-sm`} style={{ minWidth: 140, fontWeight: 700 }}>
              {emailSaved ? <><CheckCircle2 size={14} /> Đã Lưu!</> : <><Check size={14} /> Lưu Cài Đặt Gmail</>}
            </button>
          </div>
        </form>
      )}

      {/* ──────────────── 2. SUB-TAB: ZALO ZNS (OA) ──────────────── */}
      {channel === 'zalo' && (
        <form onSubmit={handleSaveZalo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(0, 104, 255, 0.08) 0%, rgba(16, 185, 129, 0.06) 100%)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#0068ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageSquare size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Cấu Hình Zalo ZNS (Zalo Notification Service)</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Gửi tin nhắn đối soát tự động có Tích Xanh Doanh Nghiệp đến SĐT khách hàng</div>
            </div>
          </div>

          {/* Test mode banner */}
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: zaloForm.isTestMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${zaloForm.isTestMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {zaloForm.isTestMode ? <Zap size={16} color="#d97706" /> : <ShieldCheck size={16} color="#059669" />}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: zaloForm.isTestMode ? '#b45309' : '#047857' }}>
                  {zaloForm.isTestMode ? 'Chế độ Thử Nghiệm / Demo (Mô Phỏng Gửi)' : 'Chế độ Chạy Thật (Live Production)'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {zaloForm.isTestMode ? 'Cho phép test gửi tin nhắn ZNS không tốn phí Zalo' : 'Tin nhắn sẽ được gửi thật qua Zalo API chính thức'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setZaloForm({ ...zaloForm, isTestMode: !zaloForm.isTestMode })}
              className={`btn btn-sm ${zaloForm.isTestMode ? 'btn-warning' : 'btn-success'}`}
              style={{ fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
            >
              {zaloForm.isTestMode ? 'Chuyển sang Live 🟢' : 'Chuyển sang Test ⚡'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Tên Doanh Nghiệp Hiển Thị (*)</label>
              <input type="text" className="input-field" placeholder="VD: CÔNG TY LOGISTICS & GOM ĐƠN"
                value={zaloForm.companyName || ''} onChange={e => setZaloForm({ ...zaloForm, companyName: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Template ID (Mã mẫu ZNS)</label>
              <input type="text" className="input-field" placeholder="VD: 312890"
                value={zaloForm.templateId || ''} onChange={e => setZaloForm({ ...zaloForm, templateId: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Zalo App ID</label>
              <input type="text" className="input-field" placeholder="VD: 123456789012345"
                value={zaloForm.appId || ''} onChange={e => setZaloForm({ ...zaloForm, appId: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: 11 }}>Secret Key</label>
              <input type="password" className="input-field" placeholder="Zalo App Secret Key"
                value={zaloForm.secretKey || ''} onChange={e => setZaloForm({ ...zaloForm, secretKey: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Access Token (OA Token)</label>
            <input type="password" className="input-field" placeholder="Dán Access Token Zalo OA vào đây..."
              value={zaloForm.accessToken || ''} onChange={e => setZaloForm({ ...zaloForm, accessToken: e.target.value })} style={{ padding: '7px 10px', fontSize: 12.5 }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldOk size={13} color="var(--success)" /> Cấu hình Zalo ZNS lưu trữ an toàn.
            </div>
            <button type="submit" className={`btn ${zaloSaved ? 'btn-success' : 'btn-primary'} btn-sm`} style={{ minWidth: 140, fontWeight: 700 }}>
              {zaloSaved ? <><CheckCircle2 size={14} /> Đã Lưu!</> : <><Check size={14} /> Lưu Cài Đặt Zalo</>}
            </button>
          </div>
        </form>
      )}

      {/* ──────────────── 3. SUB-TAB: TELEGRAM BOT ──────────────── */}
      {channel === 'telegram' && (
        <form onSubmit={handleSaveTelegram} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(0, 136, 204, 0.08) 0%, rgba(34, 158, 217, 0.06) 100%)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Cấu Hình Telegram Bot Đối Soát</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Tự động gửi bảng kê COD, cước phí và file Excel vào nhóm/kênh Telegram</div>
            </div>
          </div>

          {/* Sandbox mode toggle */}
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: telegramForm.isSandbox ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${telegramForm.isSandbox ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {telegramForm.isSandbox ? <Zap size={16} color="#d97706" /> : <ShieldCheck size={16} color="#059669" />}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: telegramForm.isSandbox ? '#b45309' : '#047857' }}>
                  {telegramForm.isSandbox ? 'Chế độ Demo Sandbox (Giả lập gửi)' : 'Chế độ Chạy Thật (Live Production)'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {telegramForm.isSandbox ? 'Kiểm tra giao diện gửi Telegram mà không bắn API thật' : 'Tin nhắn và tài liệu sẽ được gửi trực tiếp tới Telegram Bot API'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTelegramForm({ ...telegramForm, isSandbox: !telegramForm.isSandbox })}
              className={`btn btn-sm ${telegramForm.isSandbox ? 'btn-warning' : 'btn-success'}`}
              style={{ fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
            >
              {telegramForm.isSandbox ? 'Chuyển sang Live 🟢' : 'Chuyển sang Sandbox ⚡'}
            </button>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Telegram Bot Token (*)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="password"
                className="input-field mono"
                placeholder="VD: 7123456789:AAFlm3..."
                value={telegramForm.botToken || ''}
                onChange={e => setTelegramForm({ ...telegramForm, botToken: e.target.value })}
                style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
              />
              <button
                type="button"
                onClick={handleCheckTelegramBot}
                disabled={isCheckingBot}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11.5, padding: '6px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}
              >
                {isCheckingBot ? <RotateCcw size={13} className="animate-spin" /> : <Bot size={13} />}
                <span>Kiểm Tra Bot</span>
              </button>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Chat ID / Nhóm Mặc Định</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="input-field mono"
                placeholder="VD: -100123456789 hoặc @ten_channel"
                value={telegramForm.defaultChatId || ''}
                onChange={e => setTelegramForm({ ...telegramForm, defaultChatId: e.target.value })}
                style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
              />
              <button
                type="button"
                onClick={handleTestTelegramPing}
                disabled={isTestingPing}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11.5, padding: '6px 12px', whiteSpace: 'nowrap', fontWeight: 700 }}
              >
                {isTestingPing ? <RotateCcw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Gửi Test Thử</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldOk size={13} color="var(--success)" /> Bot Token lưu trữ an toàn trên thiết bị.
            </div>
            <button type="submit" className={`btn ${telegramSaved ? 'btn-success' : 'btn-primary'} btn-sm`} style={{ minWidth: 140, fontWeight: 700 }}>
              {telegramSaved ? <><CheckCircle2 size={14} /> Đã Lưu!</> : <><Check size={14} /> Lưu Cài Đặt Telegram</>}
            </button>
          </div>
        </form>
      )}

    </div>
  );
};

/* ─────────────── TAB: SAO LƯU & DỮ LIỆU ─────────────── */
const TabBackup: React.FC<{ onDataReloaded?: () => void }> = ({ onDataReloaded }) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [importJson, setImportJson] = useState('');
  const [serverSnapshots, setServerSnapshots] = useState<{ filename: string; sizeBytes: number; createdAt: string; modifiedAt: string }[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  const hasConfirmedOperationalReset = resetConfirmation
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase() === 'XOA DU LIEU';

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const list = await StorageService.getServerSnapshots();
      setServerSnapshots(list);
    } catch {
      // ignore
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleExport = () => {
    const jsonStr = StorageService.exportDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GomDonPro_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file sao lưu JSON thành công!', 'success');
  };

  const handleImport = async () => {
    if (!importJson.trim()) {
      showToast('Vui lòng dán chuỗi JSON sao lưu vào ô dưới.', 'warning');
      return;
    }
    const ok = await showConfirm({
      title: 'Khôi Phục Dữ Liệu',
      message: 'Hành động này sẽ ghi đè dữ liệu hiện tại bằng dữ liệu từ file sao lưu. Bạn có chắc chắn muốn tiếp tục?',
      confirmText: 'Khôi Phục Ngay',
      warning: true,
    });
    if (!ok) return;

    const res = StorageService.importDatabaseBackup(importJson);
    if (res) {
      showToast('Khôi phục dữ liệu thành công!', 'success');
      onDataReloaded?.();
    } else {
      showToast('Định dạng JSON không hợp lệ. Vui lòng kiểm tra lại.', 'error');
    }
  };

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    const ok = await StorageService.createManualServerSnapshot();
    setIsCreatingSnapshot(false);
    if (ok) {
      showToast('Đã tạo bản snapshot trên server thành công!', 'success');
      loadSnapshots();
    } else {
      showToast('Không thể tạo snapshot trên server.', 'error');
    }
  };

  const handleRestoreSnapshot = async (filename: string) => {
    const ok = await showConfirm({
      title: 'Khôi Phục Snapshot VPS',
      message: `Khôi phục toàn bộ dữ liệu hệ thống về thời điểm của bản snapshot "${filename}"?`,
      confirmText: 'Khôi Phục Snapshot',
      warning: true,
    });
    if (!ok) return;

    const res = await StorageService.restoreServerSnapshot(filename);
    if (res) {
      showToast('Đã khôi phục snapshot thành công!', 'success');
      onDataReloaded?.();
    } else {
      showToast('Khôi phục snapshot thất bại.', 'error');
    }
  };

  const handleClearOperationalData = async () => {
    if (!hasConfirmedOperationalReset) return;
    const ok = await showConfirm({
      title: 'Xóa Dữ Liệu Vận Hành',
      message: 'App sẽ xóa toàn bộ kỳ đối soát, công nợ/phiếu đi tiền và nhật ký vận hành. Danh sách shop, biểu giá, hãng vận chuyển, tài khoản và cấu hình được giữ nguyên. Một snapshot VPS sẽ được tạo tự động trước khi xóa.',
      confirmText: 'Xóa Dữ Liệu Vận Hành',
      danger: true,
    });
    if (!ok) return;

    const snapshotted = await StorageService.createManualServerSnapshot();
    if (!snapshotted) {
      showToast('Không tạo được snapshot VPS nên dữ liệu chưa bị xóa.', 'error');
      return;
    }

    await StorageService.clearOperationalData();
    onDataReloaded?.();
    setResetConfirmation('');
    showToast('Đã xóa dữ liệu vận hành. Danh sách shop & cấu hình vẫn được giữ nguyên.', 'success');
    loadSnapshots();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. XUẤT SAO LƯU */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={16} color="var(--primary)" />
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>1. Xuất Dữ Liệu Sao Lưu (Backup JSON)</div>
          </div>
          <button onClick={handleExport} className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
            <Download size={13} /> Tải File Backup (.JSON)
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Tải toàn bộ cơ sở dữ liệu hiện tại (Danh sách Shop, Biểu giá, Hãng vận chuyển, Kỳ đối soát, Công nợ, Cấu hình) về máy tính cá nhân để lưu trữ an toàn.
        </div>
      </div>

      {/* 2. KHÔI PHỤC TỪ JSON */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Upload size={16} color="var(--success)" />
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>2. Khôi Phục Dữ Liệu Từ File JSON</div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
          Dán nội dung file JSON sao lưu vào ô dưới đây rồi nhấn Khôi Phục.
        </div>
        <textarea
          className="input-field"
          rows={3}
          placeholder="Dán nội dung file JSON sao lưu vào đây..."
          value={importJson}
          onChange={e => setImportJson(e.target.value)}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, marginBottom: 10, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={() => setImportJson('')}
            disabled={!importJson.trim()}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11.5 }}
          >
            Xóa Trắng Ô
          </button>
          <button
            onClick={handleImport}
            disabled={!importJson.trim()}
            className="btn btn-success btn-sm"
            style={{ fontWeight: 700, fontSize: 11.5 }}
          >
            <Upload size={13} /> Khôi Phục Dữ Liệu
          </button>
        </div>
      </div>

      {/* 3. SNAPSHOT SERVER VPS */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderArchive size={16} color="#0284c7" />
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>3. Bản Sao Lưu Trên Server (VPS Snapshot)</div>
          </div>
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="btn btn-secondary btn-sm"
            style={{ fontWeight: 700, fontSize: 11.5 }}
          >
            {isCreatingSnapshot ? <RotateCcw size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
            <span>Tạo Snapshot Ngay</span>
          </button>
        </div>
        
        {loadingSnapshots ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Đang tải danh sách snapshot...</div>
        ) : serverSnapshots.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 0' }}>Chưa có bản snapshot nào trên server.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {serverSnapshots.map((snp, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 11.5 }}>
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>{snp.filename}</strong>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 1 }}>
                    {snp.modifiedAt ? new Date(snp.modifiedAt).toLocaleString('vi-VN') : ''} • {(snp.sizeBytes / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  onClick={() => handleRestoreSnapshot(snp.filename)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  Khôi Phục
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. XÓA DỮ LIỆU VẬN HÀNH (RESET) */}
      <div style={{ background: 'rgba(239, 68, 68, 0.04)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={16} color="var(--danger)" />
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)' }}>4. Xóa Dữ Liệu Vận Hành Cũ (Reset Kỳ Đối Soát)</div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
          Chỉ xóa toàn bộ các kỳ đối soát, phiếu đi tiền và lịch sử vận hành. <strong style={{ color: 'var(--text-main)' }}>Danh sách Shop, Biểu giá, Hãng vận chuyển và Tài khoản được giữ nguyên 100%.</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Nhập chữ 'XOA DU LIEU' để xác nhận..."
            value={resetConfirmation}
            onChange={e => setResetConfirmation(e.target.value)}
            style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
          />
          <button
            onClick={handleClearOperationalData}
            disabled={!hasConfirmedOperationalReset}
            className="btn btn-danger btn-sm"
            style={{ fontWeight: 700, whiteSpace: 'nowrap', opacity: hasConfirmedOperationalReset ? 1 : 0.4 }}
          >
            <Trash2 size={13} /> Xóa Dữ Liệu Vận Hành
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── TAB: BẢO MẬT & XÁC THỰC ─────────────── */
const TabSecurity: React.FC<{ 
  isAdmin: boolean; 
  currentUser?: UserAccount;
  onSwitchToAccounts?: () => void;
  onOpenAuditLogs?: () => void;
}> = ({ isAdmin, currentUser, onSwitchToAccounts, onOpenAuditLogs }) => {
  const { showToast } = useToast();
  const [pinCode, setPinCode] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(currentUser?.twoFactorEnabled));
  const [isToggling2FA, setIsToggling2FA] = useState(false);

  // Local storage for Auto-Lock & Inactivity timer preferences
  const [autoLockMin, setAutoLockMin] = useState<number>(() => {
    const v = localStorage.getItem('gomdon_autolock_minutes');
    return v ? parseInt(v, 10) : 15;
  });

  const [inactivityHours, setInactivityHours] = useState<number>(() => {
    const v = localStorage.getItem('gomdon_inactivity_hours');
    return v ? parseInt(v, 10) : 4;
  });

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.length < 4 || pinCode.length > 6 || !/^\d+$/.test(pinCode)) {
      showToast('Mã PIN phải gồm từ 4 đến 6 chữ số.', 'warning');
      return;
    }
    setIsSavingPin(true);
    try {
      const res = await AuthService.setQuickPin(pinCode);
      if (res.success) {
        showToast('Đã thiết lập Mã PIN khóa màn hình thành công!', 'success');
        setPinCode('');
      } else {
        showToast(res.error || 'Lỗi thiết lập Mã PIN.', 'error');
      }
    } catch {
      showToast('Lỗi mạng khi lưu Mã PIN.', 'error');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleToggle2FA = async () => {
    if (!twoFactorEnabled && !currentUser?.email) {
      showToast('Tài khoản cần có Email để nhận mã OTP trước khi bật 2FA.', 'warning');
      return;
    }
    setIsToggling2FA(true);
    const targetState = !twoFactorEnabled;
    try {
      const res = await AuthService.toggle2FA(targetState);
      if (res.success) {
        setTwoFactorEnabled(targetState);
        showToast(`Đã ${targetState ? 'bật' : 'tắt'} Xác thực 2 bước (2FA) thành công!`, 'success');
      } else {
        showToast(res.error || 'Lỗi cập nhật 2FA.', 'error');
      }
    } catch {
      showToast('Lỗi mạng khi cập nhật 2FA.', 'error');
    } finally {
      setIsToggling2FA(false);
    }
  };

  const handleSaveTimers = () => {
    localStorage.setItem('gomdon_autolock_minutes', String(autoLockMin));
    localStorage.setItem('gomdon_inactivity_hours', String(inactivityHours));
    showToast('Đã lưu cấu hình thời gian khóa màn hình & phiên làm việc!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* 1. MÃ PIN KHÓA MÀN HÌNH NHANH */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={15} color="var(--primary)" />
          <span>1. Mã PIN Mở Khóa Màn Hình Nhanh</span>
          {currentUser?.hasPin && (
            <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>Đã thiết lập</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          Mã PIN 4-6 số dùng để mở khóa màn hình nhanh khi bạn rời máy tính mà không cần gõ lại mật khẩu dài.
        </div>
        <form onSubmit={handleSavePin} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Nhập 4-6 số PIN mới..."
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
            className="input-field mono"
            style={{ width: 220, padding: '7px 12px', fontSize: 13, letterSpacing: 2 }}
          />
          <button
            type="submit"
            disabled={isSavingPin || pinCode.length < 4}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 700 }}
          >
            {isSavingPin ? 'Đang lưu...' : 'Lưu Mã PIN'}
          </button>
        </form>
      </div>

      {/* 2. XÁC THỰC 2 BƯỚC (2FA QUA EMAIL) */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} color="var(--success)" />
            <span>2. Xác Thực 2 Bước (2FA OTP Qua Email)</span>
          </div>
          <button
            type="button"
            onClick={handleToggle2FA}
            disabled={isToggling2FA}
            className={`btn btn-sm ${twoFactorEnabled ? 'btn-danger' : 'btn-success'}`}
            style={{ fontWeight: 700, padding: '5px 14px' }}
          >
            {twoFactorEnabled ? 'Tắt 2FA' : 'Bật 2FA'}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Khi bật tính năng này, sau khi nhập mật khẩu, hệ thống sẽ gửi một mã OTP 6 số ngẫu nhiên về email <strong>{currentUser?.email || '(Chưa cài email)'}</strong> để xác thực trước khi cho phép vào phần mềm.
        </div>
      </div>

      {/* 3. THỜI GIAN KHÓA MÀN HÌNH & HẾT HẠN PHIÊN */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={15} color="var(--warning)" />
          <span>3. Thời Gian Khóa Màn Hình & Hết Hạn Phiên Tự Động</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>
              Tự động Khóa Màn Hình sau:
            </label>
            <select
              value={autoLockMin}
              onChange={(e) => setAutoLockMin(Number(e.target.value))}
              className="input-field"
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value={5}>⏱️ 5 phút không thao tác</option>
              <option value={15}>⏱️ 15 phút không thao tác (Khuyên dùng)</option>
              <option value={30}>⏱️ 30 phút không thao tác</option>
              <option value={60}>⏱️ 1 tiếng không thao tác</option>
              <option value={0}>🚫 Tắt tự động khóa</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>
              Tự động Đăng Xuất Hết Phiên sau:
            </label>
            <select
              value={inactivityHours}
              onChange={(e) => setInactivityHours(Number(e.target.value))}
              className="input-field"
              style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
            >
              <option value={2}>⏳ 2 tiếng không dùng</option>
              <option value={4}>⏳ 4 tiếng không dùng (Khuyên dùng)</option>
              <option value={8}>⏳ 8 tiếng (Hết ca làm việc)</option>
              <option value={12}>⏳ 12 tiếng</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveTimers}
          className="btn btn-primary btn-sm"
          style={{ fontWeight: 700, alignSelf: 'flex-end' }}
        >
          Lưu Cài Đặt Thời Gian
        </button>
      </div>

      {/* 4. CHÍNH SÁCH BẢO VỆ THIẾT BỊ & AUDIT TRAIL */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldOk size={15} color="var(--primary)" />
          <span>4. Kiểm Soát Thiết Bị & Nhật Ký Hoạt Động</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {isAdmin && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                onClick={onSwitchToAccounts}
              >
                <Users size={14} /> Quản Lý Nhân Viên & Thiết Bị
              </button>

              {onOpenAuditLogs && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  onClick={onOpenAuditLogs}
                >
                  <FileText size={14} color="var(--primary)" /> Xem Nhật Ký Kiểm Toán (Audit Trail)
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
};

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
            <strong style={{ color: 'var(--text-main)' }}>Kế Toán PRO Enterprise</strong> là hệ thống quản lý kế toán & đối soát COD vận chuyển chuyên nghiệp. Hệ thống giúp bạn tự động tính tiền cước, xuất bảng kê, gửi thông báo đối soát và quản lý công nợ cho hàng chục Shop cùng lúc.
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
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-main)' }}>Hướng Dẫn Sử Dụng Kế Toán PRO</div>
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
  isOpen, onClose, theme: _theme, setTheme: _setTheme, userRole = 'STAFF', currentUser, onSaved, onNavigateTo: _onNavigateTo,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const isAdmin = userRole === 'ADMIN';
  const TAB_LIST = isAdmin ? BASE_TABS : BASE_TABS.filter(t => t.id !== 'accounts' && t.id !== 'backup' && t.id !== 'audit');

  useEffect(() => {
    if (isOpen) setActiveTab('company');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ 
          maxWidth: (activeTab === 'accounts' || activeTab === 'audit') ? 1100 : 760, 
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kế Toán PRO Enterprise</div>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: (activeTab === 'accounts' || activeTab === 'audit') ? 16 : '20px 24px' }}>
          {activeTab === 'company' && <TabCompany onSaved={onSaved} isAdmin={isAdmin} />}
          {activeTab === 'notifications' && <TabNotifications />}
          {activeTab === 'backup' && isAdmin && <TabBackup onDataReloaded={onSaved} />}
          {activeTab === 'security' && (
            <TabSecurity 
              isAdmin={isAdmin} 
              currentUser={currentUser}
              onSwitchToAccounts={() => setActiveTab('accounts')} 
              onOpenAuditLogs={() => setActiveTab('audit')}
            />
          )}
          {activeTab === 'accounts' && isAdmin && <TabAccounts currentUser={currentUser} />}
          {activeTab === 'audit' && isAdmin && <AuditLogView />}
          {activeTab === 'guide' && <TabGuide />}
        </div>
      </div>
    </div>
  );
};
