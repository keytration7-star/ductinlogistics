import React from 'react';
import { 
  FileSpreadsheet, 
  Store, 
  Truck, 
  Mail, 
  BarChart3, 
  Database,
  RefreshCw
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLoadSampleData: () => void;
  onOpenBackupModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onLoadSampleData,
  onOpenBackupModal,
}) => {
  const navItems = [
    { id: 'reconciliation', label: 'Đối Soát Kéo Thả', icon: FileSpreadsheet },
    { id: 'shops', label: 'Quản Lý Shop & Bảng Giá', icon: Store },
    { id: 'carriers', label: 'Bảng Giá NVC Sỉ', icon: Truck },
    { id: 'emails', label: 'Gửi Email Hàng Loạt', icon: Mail },
    { id: 'history', label: 'Lịch Sử & Lợi Nhuận', icon: BarChart3 },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1600,
        margin: '0 auto',
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('reconciliation')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
            color: '#fff',
          }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>
                KẾ TOÁN <span style={{ color: 'var(--primary)' }}>PRO</span>
              </span>
              <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px' }}>
                ENTERPRISE
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Hệ Thống Kế Toán & Đối Soát Vận Chuyển
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-secondary)',
          padding: '4px 6px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-tab ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Header Actions */}
        <div className="header-actions">
          {/* Load Sample Data */}
          <button
            onClick={onLoadSampleData}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12 }}
            title="Nạp dữ liệu mẫu để thử nghiệm nhanh"
          >
            <RefreshCw size={14} />
            <span>Nạp Dữ Liệu Mẫu</span>
          </button>

          {/* Backup Database */}
          <button
            onClick={onOpenBackupModal}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px' }}
            title="Sao lưu & Khôi phục dữ liệu Shop / Biểu giá"
          >
            <Database size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
