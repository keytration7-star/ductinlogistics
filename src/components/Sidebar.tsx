import React from 'react';
import { useConfirm } from './UIFeedback';
import { 
  FileSpreadsheet, 
  Store, 
  Truck, 
  Mail, 
  BarChart3, 
  Sun, 
  Moon, 
  Database,
  ShieldCheck,
  Users,
  LogOut,
  UserCheck
} from 'lucide-react';
import type { UserAccount } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onOpenBackupModal: () => void;
  onOpenCompanyModal: () => void;
  currentUser: UserAccount;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, theme, setTheme, onOpenBackupModal, onOpenCompanyModal, currentUser, onLogout,
}) => {
  const { showConfirm } = useConfirm();
  const allNavItems = [
    { 
      id: 'reconciliation', 
      label: 'Đối Soát Kéo Thả', 
      desc: 'Ghép 2 file & tính tiền COD',
      icon: FileSpreadsheet,
      badge: 'Chính',
      roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
    },
    { 
      id: 'shops', 
      label: 'Quản Lý Shop & Bảng Giá', 
      desc: 'Cấu hình cước từng khách',
      icon: Store,
      badge: null,
      roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
    },
    { 
      id: 'carriers', 
      label: 'Bảng Giá NVC Sỉ', 
      desc: 'GHTK, GHN, Viettel Post...',
      icon: Truck,
      badge: null,
      roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
    },
    { 
      id: 'emails', 
      label: 'Gửi Mail Hàng Loạt', 
      desc: 'Gửi bảng kê tự động cho Shop',
      icon: Mail,
      badge: null,
      roles: ['ADMIN', 'ACCOUNTANT']
    },
    { 
      id: 'history', 
      label: 'Lịch Sử & Lợi Nhuận', 
      desc: 'Báo cáo dòng tiền & lãi ròng',
      icon: BarChart3,
      badge: null,
      roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
    },
    {
      id: 'users',
      label: 'Quản Lý Tài Khoản',
      desc: 'Phân quyền & tạo nhân viên',
      icon: Users,
      badge: 'Admin',
      roles: ['ADMIN']
    }
  ];

  const filteredNavItems = allNavItems.filter(item => item.roles.includes(currentUser.role));

  const getRoleBadge = () => {
    switch (currentUser.role) {
      case 'ADMIN':
        return <span className="badge badge-danger" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>👑 Admin</span>;
      case 'ACCOUNTANT':
        return <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>💼 Kế Toán</span>;
      case 'STAFF':
        return <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px' }}>🧑‍💼 Vận Hành</span>;
      case 'VIEWER':
        return <span className="badge badge-neutral" style={{ fontSize: 10, padding: '2px 6px' }}>👁️ Xem</span>;
      default:
        return null;
    }
  };

  const handleConfirmLogout = async () => {
    const ok = await showConfirm({
      title: 'Đăng Xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?',
      confirmText: 'Đăng Xuất',
      warning: true,
    });
    if (ok) onLogout();
  };

  return (
    <aside style={{
      width: 280,
      minWidth: 280,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Top Branding & User Header */}
      <div>
        <div style={{
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {/* 1. TOPMOST USER PROFILE CARD */}
          <div style={{
            background: 'var(--bg-primary)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div 
              onClick={onOpenCompanyModal}
              title="Bấm để cài đặt thông tin Công Ty / Nhà Gom Đơn"
              style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, cursor: 'pointer', flex: 1 }}
            >
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--brand-gradient)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12.5,
                flexShrink: 0,
                boxShadow: 'var(--shadow-glow)',
              }}>
                {currentUser.fullName ? currentUser.fullName.slice(0, 2).toUpperCase() : 'U'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {currentUser.fullName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {getRoleBadge()}
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirmLogout}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 8px', color: 'var(--danger)', flexShrink: 0, marginLeft: 4 }}
              title="Đăng xuất khỏi tài khoản"
            >
              <LogOut size={14} />
            </button>
          </div>


          {/* 2. GOMDON PRO HUB BRANDING */}
          <div 
            onClick={() => setActiveTab('reconciliation')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(79, 70, 229, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              flexShrink: 0,
            }}>
              <Truck size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-main)' }}>
                  GOMDON <span style={{ color: 'var(--primary)' }}>PRO</span>
                </span>
                <span className="badge badge-success" style={{ fontSize: 9, padding: '2px 5px' }}>
                  HUB
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500 }}>
                Đối Soát & Quản Trị Gom Đơn
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Navigation Menu */}
        <div style={{ padding: '14px 12px' }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '0 8px 8px',
          }}>
            Danh Mục Chức Năng
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: isActive ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={17} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                    <div>
                      <div style={{ lineHeight: 1.2 }}>{item.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2, fontWeight: 400 }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span className={`badge ${item.badge === 'Admin' ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: 9, padding: '2px 5px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Controls & Security Area */}
      <div style={{
        padding: '14px 14px 18px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--bg-tertiary)',
      }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          
          {/* Backup / Restore - Admin only */}
          {currentUser.role === 'ADMIN' ? (
            <button
              onClick={onOpenBackupModal}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: 11.5, padding: '6px 8px', justifyContent: 'flex-start' }}
              title="Sao lưu hoặc khôi phục cơ sở dữ liệu"
            >
              <Database size={13} />
              <span>Sao Lưu Dữ Liệu</span>
            </button>
          ) : (
            <div style={{ flex: 1, fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <UserCheck size={13} color="var(--success)" />
              <span>Phiên làm việc bảo mật</span>
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 8px', fontSize: 11.5 }}
            title="Chuyển đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? <Sun size={13} color="#f59e0b" /> : <Moon size={13} color="#4f46e5" />}
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
          <span>Bảo mật nội bộ • GomDon Pro Enterprise</span>
        </div>
      </div>
    </aside>
  );
};
