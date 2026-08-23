import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ReconciliationView } from './components/ReconciliationView';
import { ShopManagementView } from './components/ShopManagementView';
import { CarriersPricingView } from './components/CarriersPricingView';
import { BulkEmailView } from './components/BulkEmailView';
import { HistoryAndAnalyticsView } from './components/HistoryAndAnalyticsView';
import { DebtAndPayoutView } from './components/DebtAndPayoutView';
import { DataAuditView } from './components/DataAuditView';
import { CtvManagementView } from './components/CtvManagementView';
import { LoginView } from './components/LoginView';
import { BackupModal } from './components/BackupModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { SettingsModal } from './components/SettingsModal';
import { SecurityWatermark } from './components/SecurityWatermark';
import { UIFeedbackProvider } from './components/UIFeedback';
import { CarrierHubDashboard } from './components/CarrierHubDashboard';
import { Truck, Database, Sun, Moon, Settings, LogOut } from 'lucide-react';

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
  const [reportsChannel, setReportsChannel] = useState<'zalo' | 'email' | 'telegram'>('email');

  const [shops, setShops] = useState<Shop[]>([]);
  const [carriers, setCarriers] = useState<CarrierWholesaleTier[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(StorageService.getEmailSettings());

  const [currentSession, setCurrentSession] = useState<ReconciliationSession | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [dataConnection, setDataConnection] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [networkPing, setNetworkPing] = useState<number | null>(null);
  const [vpsStats, setVpsStats] = useState<{
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    totalMB: number;
    usedMB: number;
    uptimeHours: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const measureHealth = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/system/status');
        const ping = Math.round(performance.now() - t0);
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          setNetworkPing(ping);
          if (data?.vps) {
            setVpsStats({
              cpuUsagePercent: data.vps.cpuUsagePercent ?? 0,
              memoryUsagePercent: data.vps.memory?.usagePercent ?? 0,
              totalMB: data.vps.memory?.totalMB ?? 0,
              usedMB: data.vps.memory?.usedMB ?? 0,
              uptimeHours: data.vps.uptimeHours ?? '0',
            });
          }
        } else {
          setNetworkPing(null);
        }
      } catch {
        if (isMounted) setNetworkPing(null);
      }
    };

    measureHealth();
    const timer = setInterval(measureHealth, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    // Data APIs require a server-issued session. Loading before login would
    // either fail or show stale browser cache, so sync only after auth exists.
    if (currentUser) loadAllData();
    else setDataConnection('offline');
  }, [currentUser]);

  // Synchronize currentSession with activeCarrierId: When switching carrier, load the matching carrier session or reset to null
  useEffect(() => {
    if (activeCarrierId) {
      const isMatching = currentSession && (currentSession.carrierId || 'jnt') === activeCarrierId;
      if (!isMatching) {
        const matchingSessions = sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId);
        setCurrentSession(matchingSessions.length > 0 ? matchingSessions[0] : null);
      }
    }
  }, [activeCarrierId, sessions]);

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

  // Filter shops strictly belonging to the currently selected Carrier workspace
  const carrierShops = useMemo(() => {
    if (!activeCarrierId) return shops;
    return shops.filter(s => (s.carrierId || 'jnt') === activeCarrierId);
  }, [shops, activeCarrierId]);

  const handleSaveShops = (updatedCarrierShops: Shop[]) => {
    if (!activeCarrierId) {
      setShops(updatedCarrierShops);
      StorageService.saveShops(updatedCarrierShops);
      return;
    }
    // Isolate by carrier: Preserve shops of other carriers, replace/update shops for this carrier
    const otherShops = shops.filter(s => (s.carrierId || 'jnt') !== activeCarrierId);
    const taggedCarrierShops = updatedCarrierShops.map(s => ({
      ...s,
      carrierId: s.carrierId || activeCarrierId,
    }));
    const newAllShops = [...otherShops, ...taggedCarrierShops];
    setShops(newAllShops);
    StorageService.saveShops(newAllShops);
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

  // 🏛️ TAX ACCOUNTANT DEDICATED WORKSPACE: Isolated environment for tax & compliance
  if (currentUser.role === 'TAX_ACCOUNTANT') {
    return (
      <UIFeedbackProvider>
        <TaxAccountantPortal
          currentUser={currentUser}
          carriers={carriers}
          sessions={sessions}
          shops={shops}
          onLogout={handleLogout}
        />
      </UIFeedbackProvider>
    );
  }

  // 🚚 CARRIER HUB DASHBOARD: Render when no specific carrier is selected
  if (!activeCarrierId) {
    return (
      <UIFeedbackProvider>
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
          {/* Top Bar for Hub */}
          <header className="app-top-header" style={{
            padding: '0 32px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 16,
              }}>
                GD
              </div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                  HỆ THỐNG QUẢN TRỊ ĐỐI SOÁT DÒNG TIỀN
                </h1>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Trung Tâm Điều Hành & Vận Hành Đa Hãng Vận Chuyển
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`badge ${dataConnection === 'connected' ? 'badge-success' : dataConnection === 'offline' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                {dataConnection === 'connected' ? '● Đã đồng bộ dữ liệu' : dataConnection === 'offline' ? '● Chưa kết nối máy chủ' : '● Đang kiểm tra'}
              </span>

              {/* 💾 Sao Lưu Dữ Liệu Button */}
              {currentUser.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setIsBackupModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, borderRadius: 8 }}
                  title="Sao lưu & Phục hồi cơ sở dữ liệu"
                >
                  <Database size={15} />
                  <span>Sao Lưu Dữ Liệu</span>
                </button>
              )}

              {/* ⚙️ Cài Đặt Hệ Thống Button */}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 10px', borderRadius: 8 }}
                title="Cài đặt hệ thống, tài khoản & hướng dẫn"
              >
                <Settings size={15} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginLeft: 4 }}>
                <span>{currentUser.fullName}</span>
                <span className="badge badge-primary" style={{ fontSize: 10 }}>{currentUser.role}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{ color: '#ef4444', fontWeight: 700, borderRadius: 8 }}
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

          {/* Database Backup / Restore Modal on Hub */}
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

          {/* Company Info Settings Modal on Hub */}
          <CompanySettingsModal
            isOpen={isCompanyModalOpen}
            onClose={() => setIsCompanyModalOpen(false)}
            onSaved={loadAllData}
            userRole={currentUser.role}
          />

          {/* Settings Modal — Cài đặt & Hướng dẫn sử dụng on Hub */}
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
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
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Vertical Sidebar on Left */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeCarrierId={activeCarrierId}
        activeCarrierName={activeCarrierObj.carrierName}
        onSwitchCarrier={() => {
          setActiveCarrierId(null);
          sessionStorage.removeItem('gomdon_active_carrier_id');
        }}
      />

      {/* Main Right Content Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* Minimal Enterprise Top Header - 100% FIXED STICKY AT TOP */}
        <header className="app-top-header" style={{
          padding: '0 28px',
        }}>
          {/* Breadcrumb with Active Carrier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
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
            {activeTab === 'reconciliation' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Đối Soát Kéo Thả</span>}
            {activeTab === 'shops' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Shop & Biểu Phí</span>}
            {activeTab === 'debt' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Công Nợ & Đi Tiền Bank</span>}
            {activeTab === 'audit' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Rà Soát Dữ Liệu</span>}
            {activeTab === 'carriers' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Bảng Giá NVC Gốc</span>}
            {activeTab === 'ctv' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Cộng Tác Viên (CTV)</span>}
            {activeTab === 'history' && <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Lịch Sử & Báo Cáo</span>}
            {(activeTab === 'reports' || activeTab === 'emails' || activeTab === 'zalo' || activeTab === 'telegram') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span 
                  onClick={() => { setActiveTab('reports'); }}
                  style={{ fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Gửi Báo Cáo Đối Soát
                </span>
                <span>/</span>
                <span style={{ 
                  fontWeight: 800, 
                  color: reportsChannel === 'zalo' ? '#0068ff' : reportsChannel === 'telegram' ? '#0088cc' : 'var(--primary)' 
                }}>
                  {reportsChannel === 'zalo' && '💬 Zalo ZNS (OA)'}
                  {reportsChannel === 'telegram' && '✈️ Telegram Bot'}
                  {reportsChannel === 'email' && '✉️ Gmail / SMTP'}
                </span>
              </div>
            )}
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge ${dataConnection === 'connected' ? 'badge-success' : dataConnection === 'offline' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11, padding: '4px 9px' }} title={dataConnection === 'connected' ? 'Dữ liệu đã đồng bộ với máy chủ trong phiên này.' : dataConnection === 'offline' ? 'Chưa kết nối được máy chủ; chỉ nên xem dữ liệu cục bộ, không nên chốt đối soát.' : 'Đang kiểm tra kết nối dữ liệu.'}>
              {dataConnection === 'connected' ? '● Đã đồng bộ dữ liệu' : dataConnection === 'offline' ? '● Chưa kết nối máy chủ' : '● Đang kiểm tra'}
            </span>

            {/* User Profile & Logout Block on Top Right */}
            <div style={{
              background: 'var(--bg-card)',
              padding: '4px 8px 4px 6px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div 
                onClick={() => {
                  if (currentUser.role === 'ADMIN') setIsCompanyModalOpen(true);
                }}
                title={currentUser.role === 'ADMIN' ? "Bấm để cài đặt thông tin Công Ty / Doanh Nghiệp" : `Tài khoản ${currentUser.fullName}`}
                style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: currentUser.role === 'ADMIN' ? 'pointer' : 'default' }}
              >
                <div style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 11,
                  flexShrink: 0,
                }}>
                  {currentUser.fullName ? currentUser.fullName.slice(0, 2).toUpperCase() : 'U'}
                </div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-main)', lineHeight: 1.2 }}>
                    {currentUser.fullName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    {currentUser.role === 'ADMIN' && <span className="badge badge-danger" style={{ fontSize: 8.5, padding: '1px 4px' }}>👑 Admin</span>}
                    {currentUser.role === 'ACCOUNTANT' && <span className="badge badge-primary" style={{ fontSize: 8.5, padding: '1px 4px', fontWeight: 700 }}>💼 Kế Toán</span>}
                    {currentUser.role === 'STAFF' && <span className="badge badge-success" style={{ fontSize: 8.5, padding: '1px 4px' }}>🧑‍💼 Vận Hành</span>}
                    {currentUser.role === 'VIEWER' && <span className="badge badge-neutral" style={{ fontSize: 8.5, padding: '1px 4px' }}>👁️ Xem</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 6px', color: 'var(--danger)', marginLeft: 2 }}
                title="Đăng xuất khỏi hệ thống"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Container underneath the Fixed Top Header */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}>
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
                shops={carrierShops}
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
                shops={carrierShops}
                onSaveShops={handleSaveShops}
                currentUser={currentUser}
                sourceSession={currentSession}
                activeCarrierId={activeCarrierId}
                activeCarrierName={activeCarrierObj.carrierName}
              />
            )}

            {activeTab === 'debt' && (
              <DebtAndPayoutView
                sessions={sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId)}
                shops={carrierShops}
                currentUser={currentUser}
                onRefreshSessions={() => {
                  const updatedSessions = StorageService.getSessions();
                  setSessions(updatedSessions);
                }}
                onNavigateToEmail={(session) => {
                  setCurrentSession(session);
                  setActiveTab('emails');
                }}
                onNavigateToZalo={(session) => {
                  setCurrentSession(session);
                  setActiveTab('zalo');
                }}
              />
            )}

            {activeTab === 'audit' && (
              <DataAuditView
                sessions={sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId)}
                shops={carrierShops}
                currentUser={currentUser}
                onRefreshSessions={() => {
                  const updatedSessions = StorageService.getSessions();
                  setSessions(updatedSessions);
                }}
                onNavigateToPayout={() => setActiveTab('debt')}
                activeCarrierId={activeCarrierId}
                activeCarrierName={activeCarrierObj.carrierName}
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

            {(activeTab === 'reports' || activeTab === 'emails' || activeTab === 'zalo' || activeTab === 'telegram') && (
              <BulkEmailView
                currentSession={currentSession}
                emailSettings={emailSettings}
                onSaveEmailSettings={handleSaveEmailSettings}
                activeCarrierId={activeCarrierId}
                activeCarrierName={activeCarrierObj.carrierName}
                initialChannel={activeTab === 'zalo' ? 'zalo' : activeTab === 'telegram' ? 'telegram' : 'email'}
                onChannelChange={(ch) => setReportsChannel(ch)}
              />
            )}

            {activeTab === 'history' && (
              <HistoryAndAnalyticsView
                sessions={sessions.filter(s => (s.carrierId || 'jnt') === activeCarrierId)}
                shops={carrierShops}
                onSelectSession={(session) => {
                  handleSetCurrentSession({ ...session });
                  setActiveTab('reconciliation');
                }}
                onNavigateToEmail={(session) => {
                  setCurrentSession(session);
                  setActiveTab('emails');
                }}
                onNavigateToZalo={(session) => {
                  setCurrentSession(session);
                  setActiveTab('zalo');
                }}
                onRefreshSessions={() => {
                  const updatedSessions = StorageService.getSessions();
                  setSessions(updatedSessions);
                  if (currentSession && !updatedSessions.some(s => s.id === currentSession.id)) {
                    setCurrentSession(null);
                  }
                }}
              />
            )}

            {activeTab === 'ctv' && (
              <CtvManagementView
                activeCarrierId={activeCarrierId}
                activeCarrierName={activeCarrierObj.carrierName}
              />
            )}
          </main>
        </div>

        {/* 🌟 100% FIXED ENTERPRISE FOOTER — CÙNG 1 HÀNG DUY NHẤT (NO WRAP) */}
        <footer style={{
          height: 38,
          minHeight: 38,
          maxHeight: 38,
          borderTop: '1px solid var(--border-color)',
          padding: '0 20px',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          zIndex: 80,
          boxShadow: '0 -1px 6px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{
            maxWidth: '100%',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: 16,
            overflow: 'hidden',
          }}>
            {/* Left Info: Status, User, Real-time Ping & VPS Server Metrics */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 1,
            }}>
              <span>Phiên làm việc: <strong style={{ color: 'var(--text-main)' }}>{currentUser.fullName}</strong> ({currentUser.username})</span>

              <span>•</span>

              {/* Real-time Network Ping */}
              <div 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: networkPing === null ? 'rgba(239, 68, 68, 0.08)' : networkPing < 80 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${networkPing === null ? 'rgba(239, 68, 68, 0.25)' : networkPing < 80 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                  color: networkPing === null ? 'var(--danger)' : networkPing < 80 ? 'var(--success)' : '#d97706',
                  fontWeight: 700,
                  fontSize: 10.5,
                }}
                title="Tốc độ đường truyền mạng thực tế (Network Latency / Ping)"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: networkPing === null ? 'var(--danger)' : networkPing < 80 ? 'var(--success)' : '#d97706' }}></span>
                <span>{networkPing !== null ? `⚡ Ping: ${networkPing}ms` : '⚡ Mất kết nối'}</span>
              </div>

              <span>•</span>

              {/* VPS Server Status: CPU & RAM */}
              <div 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(79, 70, 229, 0.06)',
                  border: '1px solid rgba(79, 70, 229, 0.18)',
                  color: 'var(--text-main)',
                  fontWeight: 650,
                  fontSize: 10.5,
                }}
                title={`Tình trạng hệ thống VPS Server: CPU: ${vpsStats?.cpuUsagePercent || 0}% | RAM: ${vpsStats?.usedMB || 0}/${vpsStats?.totalMB || 0}MB (${vpsStats?.memoryUsagePercent || 0}%) | Uptime: ${vpsStats?.uptimeHours || 0}h`}
              >
                <span style={{ color: 'var(--primary)', fontWeight: 800 }}>🖥️ VPS:</span>
                <span>CPU: <strong style={{ color: (vpsStats?.cpuUsagePercent || 0) > 80 ? 'var(--danger)' : 'var(--primary)' }}>{vpsStats ? `${vpsStats.cpuUsagePercent}%` : 'Đang đo...'}</strong></span>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span>RAM: <strong style={{ color: (vpsStats?.memoryUsagePercent || 0) > 85 ? 'var(--danger)' : 'var(--primary)' }}>{vpsStats ? `${vpsStats.memoryUsagePercent}%` : 'Đang đo...'}</strong></span>
              </div>
            </div>

            {/* Right Info: TQ Digital Developer branding on single line */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '2px 10px',
              borderRadius: 6,
              background: 'rgba(79, 70, 229, 0.04)',
              border: '1px solid rgba(79, 70, 229, 0.15)',
              fontSize: 10.5,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 8.5,
                flexShrink: 0,
              }}>
                TQ
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Phát triển bởi:</span>
              <strong style={{ color: 'var(--text-main)' }}>CÔNG TY TNHH MTV CÔNG NGHỆ VÀ THƯƠNG MẠI TQ DIGITAL</strong>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <a href="tel:0936833319" style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}>
                📞 09368.333.19
              </a>
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
