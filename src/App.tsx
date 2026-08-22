import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ReconciliationView } from './components/ReconciliationView';
import { ShopManagementView } from './components/ShopManagementView';
import { CarriersPricingView } from './components/CarriersPricingView';
import { BulkEmailView } from './components/BulkEmailView';
import { HistoryAndAnalyticsView } from './components/HistoryAndAnalyticsView';
import { DebtAndPayoutView } from './components/DebtAndPayoutView';
import { DataAuditView } from './components/DataAuditView';
import { UserManagementView } from './components/UserManagementView';
import { CtvManagementView } from './components/CtvManagementView';
import { LoginView } from './components/LoginView';
import { BackupModal } from './components/BackupModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { SettingsModal } from './components/SettingsModal';
import { SecurityWatermark } from './components/SecurityWatermark';
import { UIFeedbackProvider } from './components/UIFeedback';
import { CarrierHubDashboard } from './components/CarrierHubDashboard';
import { Truck } from 'lucide-react';

import type { 
  Shop, 
  CarrierWholesaleTier, 
  ReconciliationSession, 
  EmailSettings,
  UserAccount
} from './types';
import { StorageService } from './services/storage';
import { AuthService } from './services/authService';

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  // Sessions created before server-side authentication have no access token.
  // Treat them as logged out so the UI can never look authenticated while its
  // data requests are correctly rejected by the server.
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    AuthService.getAccessToken() ? AuthService.getCurrentUser() : null
  );
  
  // Active Carrier Workspace Context (null = Carrier Hub Dashboard)
  const [activeCarrierId, setActiveCarrierId] = useState<string | null>(() => {
    return sessionStorage.getItem('gomdon_active_carrier_id') || null;
  });

  const [activeTab, setActiveTab] = useState<string>('reconciliation');

  const [shops, setShops] = useState<Shop[]>([]);
  const [carriers, setCarriers] = useState<CarrierWholesaleTier[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(StorageService.getEmailSettings());

  const [currentSession, setCurrentSession] = useState<ReconciliationSession | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [dataConnection, setDataConnection] = useState<'checking' | 'connected' | 'offline'>('checking');

  useEffect(() => {
    // Data APIs require a server-issued session. Loading before login would
    // either fail or show stale browser cache, so sync only after auth exists.
    if (currentUser) loadAllData();
    else setDataConnection('offline');
  }, [currentUser]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Single Device Session Protection for non-admin accounts
  useEffect(() => {
    if (!currentUser || currentUser.role === 'ADMIN') return;

    const checkInterval = setInterval(async () => {
      const result = await AuthService.checkDeviceSession(currentUser);
      if (result.isKicked) {
        setCurrentUser(null);
        alert(`🚨 PHIÊN ĐĂNG NHẬP BỊ NGẮT!\nTài khoản của bạn vừa được đăng nhập trên một thiết bị khác (${result.newDeviceName || 'thiết bị khác'}).\nMỗi tài khoản nhân viên chỉ được phép sử dụng trên 1 thiết bị tại 1 thời điểm.`);
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [currentUser]);

  const loadAllData = async () => {
    setDataConnection('checking');
    const synced = await StorageService.syncWithServer();
    const s = StorageService.getShops();
    const c = StorageService.getCarriers();
    const sess = StorageService.getSessions();
    const em = StorageService.getEmailSettings();
    setShops(s);
    setCarriers(c);
    setSessions(sess);
    setEmailSettings(em);
    setDataConnection(synced ? 'connected' : 'offline');
  };

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
    setActiveCarrierId(null);
    sessionStorage.removeItem('gomdon_active_carrier_id');
  };

  const handleSaveShops = (updatedShops: Shop[]) => {
    setShops(updatedShops);
    StorageService.saveShops(updatedShops);
  };

  const handleSaveCarriers = (updatedCarriers: CarrierWholesaleTier[]) => {
    setCarriers(updatedCarriers);
    StorageService.saveCarriers(updatedCarriers);
  };

  const handleSaveEmailSettings = (updatedSettings: EmailSettings) => {
    setEmailSettings(updatedSettings);
    StorageService.saveEmailSettings(updatedSettings);
  };

  const handleSetCurrentSession = (session: ReconciliationSession | null) => {
    setCurrentSession(session);
    if (session) {
      StorageService.saveSession(session);
      setSessions(StorageService.getSessions());
    }
  };

  // If not logged in, render the secure LoginView
  if (!currentUser) {
    return (
      <UIFeedbackProvider>
        <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />
      </UIFeedbackProvider>
    );
  }

  // 🚚 CARRIER HUB DASHBOARD: Render when no specific carrier is selected
  if (!activeCarrierId) {
    return (
      <UIFeedbackProvider>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
          {/* Top Bar for Hub */}
          <header style={{
            height: 56,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 13,
              }}>
                KT
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-main)' }}>
                KẾ TOÁN PRO ENTERPRISE
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className={`badge ${dataConnection === 'connected' ? 'badge-success' : dataConnection === 'offline' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                {dataConnection === 'connected' ? '● Đã đồng bộ dữ liệu' : dataConnection === 'offline' ? '● Chưa kết nối máy chủ' : '● Đang kiểm tra'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <span>{currentUser.fullName}</span>
                <span className="badge badge-primary" style={{ fontSize: 10 }}>{currentUser.role}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444', fontWeight: 700 }}
              >
                Đăng Xuất
              </button>
            </div>
          </header>

          <CarrierHubDashboard
            carriers={carriers}
            shops={shops}
            sessions={sessions}
            currentUser={currentUser}
            onSelectCarrier={(carrierId) => {
              setActiveCarrierId(carrierId);
              sessionStorage.setItem('gomdon_active_carrier_id', carrierId);
            }}
            onSaveCarriers={handleSaveCarriers}
            onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
            onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          />
        </div>
      </UIFeedbackProvider>
    );
  }

  const activeCarrierObj = carriers.find(c => c.carrierId === activeCarrierId) || {
    id: activeCarrierId,
    carrierId: activeCarrierId,
    carrierName: activeCarrierId.toUpperCase(),
    weightRules: [],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 50,
  };

  return (
    <UIFeedbackProvider>
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Vertical Sidebar on Left */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={setTheme}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeCarrierName={activeCarrierObj.carrierName}
        onBackToHub={() => {
          setActiveCarrierId(null);
          sessionStorage.removeItem('gomdon_active_carrier_id');
        }}
      />

      {/* Main Right Content Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflowY: 'auto',
      }}>
        {/* Minimal Enterprise Top Header */}
        <header style={{
          height: 54,
          minHeight: 54,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {/* Breadcrumb with Active Carrier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>GOMDON PRO ENTERPRISE</span>
            <span>/</span>
            <span 
              onClick={() => {
                setActiveCarrierId(null);
                sessionStorage.removeItem('gomdon_active_carrier_id');
              }}
              style={{
                fontWeight: 800,
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(79, 70, 229, 0.08)',
                border: '1px solid rgba(79, 70, 229, 0.2)',
              }}
              title="Click để đổi đơn vị vận chuyển hoặc quay về Hub"
            >
              <Truck size={14} />
              <span>{activeCarrierObj.carrierName}</span>
            </span>
            <span>/</span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              {activeTab === 'reconciliation' && 'Đối Soát Kéo Thả'}
              {activeTab === 'shops' && 'Danh Sách Shop & Biểu Giá'}
              {activeTab === 'debt' && 'Công Nợ & Đi Tiền Bank'}
              {activeTab === 'audit' && 'Rà Soát Dữ Liệu'}
              {activeTab === 'carriers' && 'Bảng Giá NVC Gốc'}
              {activeTab === 'ctv' && 'Cộng Tác Viên (CTV)'}
              {activeTab === 'emails' && 'Gửi Email Hàng Loạt'}
              {activeTab === 'history' && 'Lịch Sử & Lợi Nhuận'}
              {activeTab === 'users' && 'Quản Lý Tài Khoản'}
            </span>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setActiveCarrierId(null);
                sessionStorage.removeItem('gomdon_active_carrier_id');
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 800, fontSize: 11.5, color: 'var(--primary)', borderColor: 'var(--primary)' }}
            >
              🔄 Đổi Hãng Vận Chuyển
            </button>

            <span className={`badge ${dataConnection === 'connected' ? 'badge-success' : dataConnection === 'offline' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11, padding: '3px 8px' }} title={dataConnection === 'connected' ? 'Dữ liệu đã đồng bộ với máy chủ trong phiên này.' : dataConnection === 'offline' ? 'Chưa kết nối được máy chủ; chỉ nên xem dữ liệu cục bộ, không nên chốt đối soát.' : 'Đang kiểm tra kết nối dữ liệu.'}>
              {dataConnection === 'connected' ? '● Đã đồng bộ dữ liệu' : dataConnection === 'offline' ? '● Chưa kết nối máy chủ' : '● Đang kiểm tra'}
            </span>
          </div>
        </header>

        {/* Main Content Body */}
        <main style={{
          flex: 1,
          maxWidth: 1540,
          width: '100%',
          margin: '0 auto',
          padding: '24px 28px 60px',
        }}>
          <div style={{ display: activeTab === 'reconciliation' ? 'block' : 'none' }}>
            <ReconciliationView
              shops={shops}
              carriers={carriers}
              currentSession={currentSession}
              setCurrentSession={handleSetCurrentSession}
              currentUser={currentUser}
              onSaveShops={handleSaveShops}
              activeCarrierId={activeCarrierId}
              onNavigateToEmail={(session) => {
                handleSetCurrentSession(session);
                setActiveTab('emails');
              }}
            />
          </div>

          {activeTab === 'shops' && (
            <ShopManagementView
              shops={shops}
              onSaveShops={handleSaveShops}
              currentUser={currentUser}
              sourceSession={currentSession}
            />
          )}

          {activeTab === 'debt' && (
            <DebtAndPayoutView
              sessions={sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId)}
              shops={shops}
              currentUser={currentUser}
              onRefreshSessions={() => {
                const updatedSessions = StorageService.getSessions();
                setSessions(updatedSessions);
              }}
            />
          )}

          {activeTab === 'audit' && (
            <DataAuditView
              sessions={sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId)}
              shops={shops}
              currentUser={currentUser}
              onRefreshSessions={() => {
                const updatedSessions = StorageService.getSessions();
                setSessions(updatedSessions);
              }}
              onNavigateToPayout={() => setActiveTab('debt')}
            />
          )}

          {activeTab === 'carriers' && (
            <CarriersPricingView
              carriers={carriers}
              onSaveCarriers={handleSaveCarriers}
              currentUser={currentUser}
              activeCarrierId={activeCarrierId}
            />
          )}

          {activeTab === 'emails' && (
            <BulkEmailView
              currentSession={currentSession}
              emailSettings={emailSettings}
              onSaveEmailSettings={handleSaveEmailSettings}
            />
          )}

          {activeTab === 'history' && (
            <HistoryAndAnalyticsView
              sessions={sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId)}
              shops={shops}
              onSelectSession={(session) => {
                setCurrentSession(session);
                setActiveTab('reconciliation');
              }}
              onNavigateToEmail={(session) => {
                setCurrentSession(session);
                setActiveTab('emails');
              }}
            />
          )}

          {activeTab === 'ctv' && (
            <CtvManagementView />
          )}

          {activeTab === 'users' && currentUser.role === 'ADMIN' && (
            <UserManagementView currentUser={currentUser} />
          )}
        </main>

        {/* Bottom Footer */}
        <footer style={{
          borderTop: '1px solid var(--border-color)',
          padding: '16px 32px',
          fontSize: 12,
          color: 'var(--text-dim)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong>GOMDON PRO ENTERPRISE</strong> — Hệ thống quản trị, ghép mã vận đơn, tính cước bậc thang & đối soát dòng tiền COD cho Nhà gom đơn.
            </div>
            <div>
              Đang đăng nhập: <strong>{currentUser.fullName}</strong> ({currentUser.username})
            </div>
          </div>
        </footer>
      </div>

      {/* Database Backup / Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onDataReloaded={loadAllData}
        onOperationalDataCleared={() => {
          setCurrentSession(null);
          setSessions([]);
          loadAllData();
        }}
        currentUser={currentUser}
      />

      {/* Company Info Settings Modal */}
      <CompanySettingsModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        onSaved={loadAllData}
        userRole={currentUser.role}
      />

      {/* Settings Modal — Cài đặt & Hướng dẫn sử dụng */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        setTheme={setTheme}
        userRole={currentUser.role}
        currentUser={currentUser}
        onSaved={loadAllData}
        onNavigateTo={(tab) => { setActiveTab(tab); setIsSettingsModalOpen(false); }}
      />

      {/* Security Anti-Screenshot Watermark Overlay */}
      <SecurityWatermark currentUser={currentUser} />

    </div>
  </UIFeedbackProvider>
  );
}

export default App;
