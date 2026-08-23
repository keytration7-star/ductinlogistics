import { 
  FileSpreadsheet, 
  Store, 
  Truck, 
  BarChart3, 
  ShieldCheck,
  CreditCard,
  Award,
  Send,
  Settings,
  UserCheck
} from 'lucide-react';
import type { UserAccount } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme?: 'dark' | 'light';
  setTheme?: (theme: 'dark' | 'light') => void;
  onOpenSettingsModal: () => void;
  currentUser: UserAccount;
  activeCarrierId?: string | null;
  activeCarrierName?: string;
  onSwitchCarrier?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, onOpenSettingsModal, currentUser,
  activeCarrierId, activeCarrierName, onSwitchCarrier,
}) => {
  // Grouped Navigation Items per business domain
  const navGroups = [
    {
      title: 'VẬN HÀNH',
      items: [
        { 
          id: 'reconciliation', 
          label: 'Đối Soát Kéo Thả', 
          desc: 'Ghép 2 file & tính tiền COD',
          icon: FileSpreadsheet,
          badge: 'Chính',
          roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
        },
        { 
          id: 'debt', 
          label: 'Công Nợ & Đi Tiền', 
          desc: 'Quản lý đi tiền NH cho Shop',
          icon: CreditCard,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT']
        },
        { 
          id: 'audit', 
          label: 'Rà Soát Dữ Liệu', 
          desc: 'Lọc lệch & đơn hoàn',
          icon: ShieldCheck,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT', 'STAFF']
        },
        { 
          id: 'shops', 
          label: 'Shop & Biểu Phí', 
          desc: 'Cấu hình giá shop theo bậc',
          icon: Store,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
        },
      ]
    },
    {
      title: 'ĐỐI TÁC & BẢNG GIÁ',
      items: [
        { 
          id: 'carriers', 
          label: 'Bảng Giá NVC Gốc', 
          desc: 'Biểu phí gốc từ nhà vận chuyển',
          icon: Truck,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT']
        },
        { 
          id: 'ctv', 
          label: 'Cộng Tác Viên (CTV)', 
          desc: 'Quản lý hoa hồng & lệch giá',
          icon: Award,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT']
        },
        { 
          id: 'history', 
          label: 'Lịch Sử & Báo Cáo', 
          desc: 'Doanh thu & lợi nhuận các kỳ',
          icon: BarChart3,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
        },
      ]
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { 
          id: 'reports', 
          label: 'Gửi Báo Cáo Đối Soát', 
          desc: 'Email • Zalo ZNS • Telegram',
          icon: Send,
          badge: 'Đa Kênh',
          roles: ['ADMIN', 'ACCOUNTANT']
        },
      ]
    }
  ];


  return (
    <aside className="sidebar-aside">
      {/* Top Branding & User Header */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: '12px 14px 10px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {/* 1. BRANDING HEADER */}
          <div 
            onClick={() => setActiveTab('reconciliation')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <Truck size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14.5, fontWeight: 750, letterSpacing: '-0.025em', color: 'var(--text-main)' }}>
                  KẾ TOÁN <span style={{ color: 'var(--primary)' }}>PRO</span>
                </span>
                <span className="badge badge-primary" style={{ fontSize: 9, padding: '1px 5px' }}>
                  ENTERPRISE
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                Hệ Thống Đối Soát & Quản Trị
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Navigation Menu */}
        <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {navGroups.map(group => {
            const allowedItems = group.items.filter(i => i.roles.includes(currentUser.role));
            if (allowedItems.length === 0) return null;
            return (
              <div key={group.title}>
                <div style={{
                  fontSize: 10.5,
                  fontWeight: 750,
                  color: '#475569',
                  letterSpacing: '0.075em',
                  padding: '7px 9px 4px',
                  textTransform: 'uppercase',
                }}>
                  {group.title}
                </div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {allowedItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id || (item.id === 'reports' && (activeTab === 'emails' || activeTab === 'zalo' || activeTab === 'telegram'));
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div className="sidebar-icon-box" style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            background: isActive 
                              ? 'rgba(255, 255, 255, 0.25)' 
                              : 'var(--bg-tertiary)',
                            color: isActive 
                              ? '#ffffff' 
                              : 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                          }}>
                            <Icon size={17} />
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                        </div>

                        {item.badge && (
                          <span className={`badge ${isActive ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: 9, padding: '2px 6px', fontWeight: 800, flexShrink: 0 }}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls & Security Area */}
      <div style={{
        padding: '14px 14px 18px',
        borderTop: '1px solid #cfe2fe',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'rgba(219, 234, 254, 0.45)',
      }}>

        {/* Switch Carrier Row (if handler provided) */}
        {onSwitchCarrier && (
          <button
            onClick={onSwitchCarrier}
            className="btn btn-secondary btn-sm"
            style={{ 
              width: '100%', 
              fontSize: 12, 
              padding: '7px 10px', 
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
              border: '1.5px solid rgba(79, 70, 229, 0.25)',
              color: 'var(--primary)',
              fontWeight: 800,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.06)',
            }}
            title="Bấm để đổi sang Hãng vận chuyển khác hoặc quay về Hub Đơn Vị Vận Chuyển"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <Truck size={15} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeCarrierName ? `Hãng: ${activeCarrierName}` : 'Đổi Hãng Vận Chuyển'}
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 2 }}>
              Đổi 🔄
            </span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          
          {/* User role status */}
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <UserCheck size={13} color="var(--success)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.role === 'ADMIN' ? 'Quản Trị Viên' : 'Vận Hành'}
            </span>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettingsModal}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
            title="Cài đặt hệ thống, Sao lưu dữ liệu & Hướng dẫn"
          >
            <Settings size={13} />
            <span>Cài Đặt</span>
          </button>
        </div>

        {/* Security & Version Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10.5,
          color: 'var(--text-muted)',
          padding: '2px 4px',
        }}>
          <ShieldCheck size={13} color="var(--success)" />
          <span>Bảo mật nội bộ • Kế Toán PRO Enterprise</span>
        </div>
      </div>
    </aside>
  );
};
