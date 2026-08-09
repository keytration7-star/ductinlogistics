import React from 'react';
import { 
  FileSpreadsheet, 
  Store, 
  Truck, 
  Mail, 
  BarChart3, 
  Sparkles, 
  Sun, 
  Moon, 
  Database,
  Download
} from 'lucide-react';
import { SampleDataService } from '../services/sampleDataService';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onLoadSampleData: () => void;
  onOpenBackupModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
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
                GOMDON <span style={{ color: 'var(--primary)' }}>PRO</span>
              </span>
              <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 6px' }}>
                LOGISTICS HUB
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Hệ Thống Quản Trị & Đối Soát Nhà Gom Đơn
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isActive ? 'var(--brand-gradient)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 10px var(--primary-glow)' : 'none',
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 1-Click Demo Sample Button */}
          <button
            onClick={onLoadSampleData}
            className="btn btn-primary btn-sm"
            title="Tự động nạp 60 đơn mẫu gồm Shop A, Shop B, Shop C để chạy thử nghiệm đối soát ngay lập tức"
          >
            <Sparkles size={15} />
            <span>Chạy Demo 1-Click</span>
          </button>

          {/* Download Sample Files Button */}
          <button
            onClick={() => SampleDataService.downloadSampleFiles()}
            className="btn btn-secondary btn-sm"
            title="Tải về 2 file Excel mẫu (File NVC & File App) để xem thử định dạng"
          >
            <Download size={14} />
            <span>Tải 2 File Mẫu</span>
          </button>

          {/* Backup / Restore Button */}
          <button
            onClick={onOpenBackupModal}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px' }}
            title="Sao lưu & Khôi phục dữ liệu Shop / Biểu giá"
          >
            <Database size={16} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px' }}
            title="Chuyển đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#6366f1" />}
          </button>
        </div>
      </div>
    </header>
  );
};
