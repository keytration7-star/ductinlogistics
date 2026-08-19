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
  UserCheck,
  CreditCard,
  Settings,
  Award
} from 'lucide-react';
import type { UserAccount } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onOpenBackupModal: () => void;
  onOpenCompanyModal: () => void;
  onOpenSettingsModal: () => void;
  currentUser: UserAccount;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, theme, setTheme, onOpenBackupModal, onOpenCompanyModal, onOpenSettingsModal, currentUser, onLogout,
}) => {
  const { showConfirm } = useConfirm();
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
          id: 'carriers', 
          label: 'Bảng Giá NVC Gốc', 
          desc: 'J&T, SPX, GHN, GHTK...',
          icon: Truck,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
        },
      ]
    },
    {
      title: 'QUẢN TRỊ',
      items: [
        { 
          id: 'shops', 
          label: 'Danh Sách Shop & Biểu Giá', 
          desc: 'Bảng giá riêng từng khách',
          icon: Store,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT', 'STAFF', 'VIEWER']
        },
        { 
          id: 'ctv', 
          label: 'Cộng Tác Viên (CTV)', 
          desc: 'Bảng hoa hồng & chia thưởng',
          icon: Award,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT']
        },
        {
          id: 'users',
          label: 'Tài Khoản & Phân Quyền',
          desc: 'Quản lý tài khoản nhân viên',
          icon: Users,
          badge: null,
          roles: ['ADMIN']
        }
      ]
    },
    {
      title: 'TÀI CHÍNH & BÁO CÁO',
      items: [
        { 
          id: 'history', 
          label: 'Lợi Nhuận & Lịch Sử', 
          desc: 'Dòng tiền & Lợi nhuận ròng',
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
          id: 'emails', 
          label: 'Gửi Email Hàng Loạt', 
          desc: 'Gửi bảng kê tự động cho Shop',
          icon: Mail,
          badge: null,
          roles: ['ADMIN', 'ACCOUNTANT']
        },
      ]
    }
  ];

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
      width: 270,
      minWidth: 270,
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: '14px 14px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
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
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <Truck size={19} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                  GOMDON <span style={{ color: 'var(--primary)' }}>PRO</span>
                </span>
                <span className="badge badge-primary" style={{ fontSize: 9, padding: '1px 5px' }}>
                  ENTERPRISE
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
                Hệ Thống Đối Soát & Quản Trị
              </div>
            </div>
          </div>

          {/* 2. USER PROFILE BLOCK */}
          <div style={{
            background: 'var(--bg-primary)',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div 
              onClick={() => {
                if (currentUser.role === 'ADMIN') onOpenCompanyModal();
              }}
              title={currentUser.role === 'ADMIN' ? "Bấm để cài đặt thông tin Công Ty / Nhà Gom Đơn" : `Tài khoản ${currentUser.fullName}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: currentUser.role === 'ADMIN' ? 'pointer' : 'default', flex: 1 }}
            >
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}>
                {currentUser.fullName ? currentUser.fullName.slice(0, 2).toUpperCase() : 'U'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>
                  {currentUser.fullName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  {getRoleBadge()}
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirmLogout}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 6px', color: 'var(--danger)', flexShrink: 0, marginLeft: 4 }}
              title="Đăng xuất"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Grouped Navigation Menu */}
        <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {navGroups.map(group => {
            const allowedItems = group.items.filter(i => i.roles.includes(currentUser.role));
            if (allowedItems.length === 0) return null;
            return (
              <div key={group.title}>
                <div style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  letterSpacing: '0.06em',
                  padding: '0 8px 6px',
                }}>
                  {group.title}
                </div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {allowedItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <Icon size={16} className="sidebar-icon" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                        </div>

                        {item.badge && (
                          <span className={`badge ${isActive ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: 9, padding: '1px 5px', flexShrink: 0 }}>
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

          {/* Settings Button */}
          <button
            onClick={onOpenSettingsModal}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 8px', fontSize: 11.5 }}
            title="Cài đặt hệ thống & hướng dẫn sử dụng"
          >
            <Settings size={13} />
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
