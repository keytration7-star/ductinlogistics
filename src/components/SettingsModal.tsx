import React, { useState, useEffect } from 'react';
import {
  X, Building2, Palette, Mail, ShieldCheck, BookOpen,
  Check, Sun, Moon, ChevronRight,
  FileSpreadsheet, ArrowRight, Smartphone,
  Filter, CheckCircle2, Info, Monitor, Lock, Users,
  Settings
} from 'lucide-react';
import type { CompanyInfo } from '../types';
import { StorageService } from '../services/storage';
import { useToast } from './UIFeedback';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  userRole?: string;
  onSaved?: () => void;
  onNavigateTo?: (tab: string) => void;
}

type SettingsTab = 'company' | 'ui' | 'email' | 'security' | 'guide';

const TAB_LIST: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
  { id: 'company', icon: <Building2 size={15} />, label: 'Công Ty' },
  { id: 'ui', icon: <Palette size={15} />, label: 'Giao Diện' },
  { id: 'email', icon: <Mail size={15} />, label: 'Email' },
  { id: 'security', icon: <ShieldCheck size={15} />, label: 'Bảo Mật' },
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

/* ─────────────── TAB: EMAIL ─────────────── */
const TabEmail: React.FC<{ onNavigateTo?: (tab: string) => void; onClose: () => void }> = ({ onNavigateTo, onClose }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.08),rgba(79,70,229,.06))', borderRadius: 'var(--radius-md)', padding: '20px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
      <Mail size={40} color="var(--primary)" style={{ marginBottom: 10 }} />
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)', marginBottom: 6 }}>Cấu Hình Gửi Email Đối Soát</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Cài đặt Gmail, nội dung mẫu, chữ ký và danh sách nhận — trong tab Email chính.
      </div>
      <button
        className="btn btn-primary"
        onClick={() => { if (onNavigateTo) onNavigateTo('email'); onClose(); }}
      >
        <Mail size={14} /> Mở Tab Cấu Hình Email
      </button>
    </div>

    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: '16px 18px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text-main)' }}>📋 Những Gì Có Thể Cài Đặt Trong Email:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          ['📧 Gmail gửi', 'Địa chỉ Gmail và App Password'],
          ['✍️ Tên người gửi', 'Hiển thị trên hộp thư của khách'],
          ['📝 Nội dung mẫu', 'Template body email với biến động ({tên}, {tiền}...)'],
          ['📅 Kỳ đối soát', 'Tiêu đề email và ghi chú kỳ'],
          ['👁️ Xem trước', 'Preview email trước khi gửi hàng loạt'],
        ].map(([t, d]) => (
          <div key={t} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 140, color: 'var(--text-main)' }}>{t}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

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
              ['📊', 'Đối Soát Kéo Thả', 'Ghép 2 file tự động, tính COD từng shop'],
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
            { icon: '🗂️', label: 'Tải File Shop', color: '#10b981' },
            { icon: '🔗', label: 'Kéo Thả Ghép', color: '#f59e0b' },
            { icon: '⚡', label: 'Tính Tiền', color: '#ec4899' },
            { icon: '📥', label: 'Xuất File', color: '#14b8a6' },
          ]} />
          <StepRow n={1} text="Tải File NVC (Hãng Vận Chuyển)" sub="Vào tab Đối Soát → Kéo thả file Excel của NVC vào vùng bên trái. Hệ thống tự nhận diện cột vận đơn, cân nặng, COD..." />
          <StepRow n={2} text="Tải File Shop (Dữ Liệu Đơn)" sub="Kéo thả file Excel của Shop (hoặc nhiều shop) vào vùng bên phải." />
          <StepRow n={3} text="Kéo Thả Ghép Dữ Liệu" sub="Kéo từng file shop sang ô ghép với file NVC tương ứng. Hệ thống hiển thị preview kết quả." />
          <StepRow n={4} text="Kiểm Tra & Lưu Kỳ Đối Soát" sub="Xem bảng tổng hợp số tiền từng shop, chỉnh sửa nếu cần, sau đó bấm Lưu Kỳ." />
          <StepRow n={5} text="Xuất File Excel Từng Khách" sub="Bấm nút Xuất Excel → mỗi shop được 1 file riêng với bảng tính chi tiết." />
          <InfoBox type="tip">Hệ thống tự động khớp mã vận đơn giữa 2 file và tính giá theo biểu giá đã cài cho từng Shop.</InfoBox>
          <InfoBox type="warn">Nếu file Excel có cột bị sai tên, vào <strong>Cấu Hình Ánh Xạ Cột</strong> để map lại đúng cột.</InfoBox>
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
          <StepRow n={1} text="Thêm Hãng Vận Chuyển" sub="Tab Bảng Giá NVC → bấm + Thêm NVC → nhập tên & mã hãng (VD: GHTK, GHN, BEST)." />
          <StepRow n={2} text="Cài Giá Cước Gốc Bậc Thang" sub="Cài bảng giá sỉ bạn ký với NVC. Dùng để tính lợi nhuận (chênh lệch với giá bán cho Shop)." />
          <StepRow n={3} text="Cấu Hình Ánh Xạ Cột" sub="Mỗi NVC có file Excel khác nhau. Cài 1 lần để hệ thống biết cột nào là mã vận đơn, cân nặng, COD..." />
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
          <StepRow n={2} text="Khôi Phục Từ File" sub="Tab Khôi Phục → Chọn file .json đã tải về → hệ thống ghi đè dữ liệu hiện tại." />
          <StepRow n={3} text="Đồng Bộ Lên Server" sub="Dữ liệu được tự động đồng bộ lên VPS mỗi khi có thay đổi. Bạn có thể dùng từ nhiều máy tính." />
          <InfoBox type="warn">Khi Khôi Phục sẽ ghi đè toàn bộ dữ liệu hiện tại. Hãy sao lưu trước khi thực hiện!</InfoBox>
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

/* ─────────────── MAIN MODAL ─────────────── */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, theme, setTheme, userRole = 'STAFF', onSaved, onNavigateTo,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    if (isOpen) setActiveTab('company');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'company' && <TabCompany onSaved={onSaved} isAdmin={isAdmin} />}
          {activeTab === 'ui' && <TabUI theme={theme} setTheme={setTheme} />}
          {activeTab === 'email' && <TabEmail onNavigateTo={onNavigateTo} onClose={onClose} />}
          {activeTab === 'security' && <TabSecurity isAdmin={isAdmin} onNavigateTo={onNavigateTo} onClose={onClose} />}
          {activeTab === 'guide' && <TabGuide />}
        </div>
      </div>
    </div>
  );
};
