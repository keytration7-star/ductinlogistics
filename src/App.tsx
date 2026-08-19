import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ReconciliationView } from './components/ReconciliationView';
import { ShopManagementView } from './components/ShopManagementView';
import { CarriersPricingView } from './components/CarriersPricingView';
import { BulkEmailView } from './components/BulkEmailView';
import { HistoryAndAnalyticsView } from './components/HistoryAndAnalyticsView';
import { DebtAndPayoutView } from './components/DebtAndPayoutView';
import { UserManagementView } from './components/UserManagementView';
import { CtvManagementView } from './components/CtvManagementView';
import { LoginView } from './components/LoginView';
import { BackupModal } from './components/BackupModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { SettingsModal } from './components/SettingsModal';
import { SecurityWatermark } from './components/SecurityWatermark';
import { UIFeedbackProvider } from './components/UIFeedback';

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
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => AuthService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<string>('reconciliation');

  const [shops, setShops] = useState<Shop[]>([]);
  const [carriers, setCarriers] = useState<CarrierWholesaleTier[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(StorageService.getEmailSettings());

  const [currentSession, setCurrentSession] = useState<ReconciliationSession | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

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
    await StorageService.syncWithServer();
    const s = StorageService.getShops();
    const c = StorageService.getCarriers();
    const sess = StorageService.getSessions();
    const em = StorageService.getEmailSettings();
    setShops(s);
    setCarriers(c);
    setSessions(sess);
    setEmailSettings(em);
  };

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
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

  const handleClearAllData = () => {
    StorageService.clearAllData();
    setShops([]);
    setSessions([]);
    setCurrentSession(null);
  };

  const handleClearSessionsOnly = () => {
    StorageService.clearSessionsOnly();
    setSessions([]);
    setCurrentSession(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem('gomdon_sessions_v1', JSON.stringify(updated));
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
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
      />


      {/* Main Right Content Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflowY: 'auto',
      }}>
        {/* Main Content Body */}
        <main style={{
          flex: 1,
          maxWidth: 1500,
          width: '100%',
          margin: '0 auto',
          padding: '28px 32px 60px',
        }}>
          {activeTab === 'reconciliation' && (
            <ReconciliationView
              shops={shops}
              carriers={carriers}
              currentSession={currentSession}
              setCurrentSession={handleSetCurrentSession}
              onNavigateToEmail={(session) => {
                handleSetCurrentSession(session);
                setActiveTab('emails');
              }}
              onSaveShops={handleSaveShops}
            />
          )}

          {activeTab === 'shops' && (
            <ShopManagementView
              shops={shops}
              onSaveShops={handleSaveShops}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'debt' && (
            <DebtAndPayoutView
              sessions={sessions}
              shops={shops}
              currentUser={currentUser}
              onRefreshSessions={() => {
                const updatedSessions = StorageService.getSessions();
                setSessions(updatedSessions);
              }}
            />
          )}

          {activeTab === 'carriers' && (
            <CarriersPricingView
              carriers={carriers}
              onSaveCarriers={handleSaveCarriers}
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
              sessions={sessions}
              shops={shops}
              onSelectSession={(session) => {
                setCurrentSession(session);
                setActiveTab('reconciliation');
              }}
              onNavigateToEmail={(session) => {
                setCurrentSession(session);
                setActiveTab('emails');
              }}
              onDeleteSession={handleDeleteSession}
              currentUser={currentUser}
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
        onClearAllData={handleClearAllData}
        onClearSessionsOnly={handleClearSessionsOnly}
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
