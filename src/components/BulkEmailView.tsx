import React, { useState, useEffect } from 'react';
import { useToast } from './UIFeedback';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  RotateCcw, 
  Download, 
  FileSpreadsheet, 
  Layers, 
  Copy, 
  Check, 
  Clock, 
  X, 
  Play, 
  CheckCircle,
  Edit2,
  Save,
  AlertCircle,
  Info
} from 'lucide-react';
import type { ReconciliationSession, EmailSettings, ShopSettlementStatement } from '../types';
import { EmailService } from '../services/emailService';
import { ExcelService } from '../services/excelService';
import { StorageService } from '../services/storage';

interface BulkEmailViewProps {
  currentSession: ReconciliationSession | null;
  emailSettings: EmailSettings;
  onSaveEmailSettings: (settings: EmailSettings) => void;
}

export const BulkEmailView: React.FC<BulkEmailViewProps> = ({
  currentSession,
  emailSettings,
  onSaveEmailSettings,
}) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<EmailSettings>(emailSettings);
  const [selectedShopId, setSelectedShopId] = useState<string>(
    currentSession?.statements[0]?.shopId || ''
  );
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });
  const [shopStatuses, setShopStatuses] = useState<Record<string, { status: 'idle' | 'sending' | 'sent' | 'failed'; message?: string }>>({});
  const [copiedBody, setCopiedBody] = useState(false);

  // Scheduling State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledTargetTime, setScheduledTargetTime] = useState<Date | null>(null);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('');
  const [customDateTimeInput, setCustomDateTimeInput] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');

  // Inline Shop Email Editing State
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [tempEmailMap, setTempEmailMap] = useState<Record<string, string>>({});
  const [selectedCarrierTab, setSelectedCarrierTab] = useState<string>('default');

  const CARRIER_TABS = [
    { id: 'default', label: '🌐 Mặc Định (Tất Cả)' },
    { id: 'jnt', label: '📦 J&T Express' },
    { id: 'spx', label: '⚡ Shopee Express (SPX)' },
    { id: 'ghn', label: '🚀 Giao Hàng Nhanh (GHN)' },
    { id: 'ghtk', label: '🛵 GHTK' },
    { id: 'vtp', label: '📮 Viettel Post' },
  ];

  // Helper to get active subject and body template for selected carrier tab
  const activeSubject = selectedCarrierTab === 'default'
    ? settings.subjectTemplate
    : (settings.carrierTemplates?.[selectedCarrierTab]?.subjectTemplate || settings.subjectTemplate);

  const activeBody = selectedCarrierTab === 'default'
    ? settings.bodyTemplate
    : (settings.carrierTemplates?.[selectedCarrierTab]?.bodyTemplate || settings.bodyTemplate);

  const handleUpdateActiveSubject = (val: string) => {
    if (selectedCarrierTab === 'default') {
      setSettings({ ...settings, subjectTemplate: val });
    } else {
      const cTemplates = { ...(settings.carrierTemplates || {}) };
      cTemplates[selectedCarrierTab] = {
        ...(cTemplates[selectedCarrierTab] || { subjectTemplate: settings.subjectTemplate, bodyTemplate: settings.bodyTemplate }),
        subjectTemplate: val,
      };
      setSettings({ ...settings, carrierTemplates: cTemplates });
    }
  };

  const handleUpdateActiveBody = (val: string) => {
    if (selectedCarrierTab === 'default') {
      setSettings({ ...settings, bodyTemplate: val });
    } else {
      const cTemplates = { ...(settings.carrierTemplates || {}) };
      cTemplates[selectedCarrierTab] = {
        ...(cTemplates[selectedCarrierTab] || { subjectTemplate: settings.subjectTemplate, bodyTemplate: settings.bodyTemplate }),
        bodyTemplate: val,
      };
      setSettings({ ...settings, carrierTemplates: cTemplates });
    }
  };

  const statements = currentSession?.statements || [];
  const selectedStatement = statements.find(s => s.shopId === selectedShopId) || statements[0];
  const missingShopEmailsCount = statements.filter(s => !s.shopEmail || !s.shopEmail.includes('@')).length;

  // Auto-populate missing emails from StorageService registered shops
  React.useEffect(() => {
    if (!currentSession || !currentSession.statements.length) return;
    const registeredShops = StorageService.getShops();
    let hasChanges = false;

    currentSession.statements.forEach(stmt => {
      if (!stmt.shopEmail || !stmt.shopEmail.includes('@')) {
        const normName = stmt.shopName.toLowerCase().trim();
        const found = registeredShops.find(s =>
          s.id === stmt.shopId ||
          (s.code && s.code === stmt.shopCode) ||
          s.name.toLowerCase().trim() === normName
        );
        if (found && found.email && found.email.includes('@')) {
          stmt.shopEmail = found.email;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      StorageService.saveSession(currentSession);
    }
  }, [currentSession]);

  const handleSaveShopEmail = (stmt: ShopSettlementStatement, newEmailInput: string) => {
    const cleanEmail = newEmailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showToast('Vui lòng nhập địa chỉ email nhận hợp lệ (có chứa ký tự @).', 'warning');
      return;
    }

    // 1. Update in-memory statement
    stmt.shopEmail = cleanEmail;

    // 2. Save to registeredShops in StorageService
    const shops = StorageService.getShops();
    const targetShop = shops.find(s => s.id === stmt.shopId || s.name.toLowerCase().trim() === stmt.shopName.toLowerCase().trim());
    if (targetShop) {
      targetShop.email = cleanEmail;
      StorageService.saveShops(shops);
    }

    // 3. Save to current session in StorageService if active
    if (currentSession) {
      const targetStmt = currentSession.statements.find(s => s.shopId === stmt.shopId);
      if (targetStmt) targetStmt.shopEmail = cleanEmail;
      StorageService.saveSession(currentSession);
    }

    setEditingShopId(null);
    showToast(`Đã lưu Email nhận cho Shop ${stmt.shopName}!`, 'success');
  };

  // Schedule Countdown & Auto-Trigger Effect
  useEffect(() => {
    if (!scheduledTargetTime) {
      setTimeRemainingStr('');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = scheduledTargetTime.getTime();
      const diff = target - now;

      if (diff <= 0) {
        // Time reached! Trigger automatic send
        clearInterval(interval);
        setScheduledTargetTime(null);
        setTimeRemainingStr('');
        handleStartBatchSend();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemainingStr(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledTargetTime]);

  const handleSaveSettings = () => {
    onSaveEmailSettings(settings);
    showToast('Đã lưu mẫu email thành công!', 'success');
  };

  const handleInsertVariable = (varName: string) => {
    handleUpdateActiveBody(activeBody + varName);
  };

  const handleStartBatchSend = async () => {
    if (statements.length === 0) {
      showToast('Chưa có danh sách shop đối soát nào trong kỳ này.', 'warning');
      return;
    }

    // Cancel any active schedule if manually triggered
    setScheduledTargetTime(null);
    setIsSendingBatch(true);
    setSendProgress({ sent: 0, total: statements.length });

    const newStatuses: Record<string, { status: 'idle' | 'sending' | 'sent' | 'failed'; message?: string }> = {};

    await EmailService.sendBatchEmails(statements, settings, currentSession?.carrierId, (shopId: string, status: 'sending' | 'sent' | 'failed', message?: string) => {
      newStatuses[shopId] = { status, message };
      setShopStatuses({ ...newStatuses });
      if (status === 'sent' || status === 'failed') {
        setSendProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
      }
    });

    setIsSendingBatch(false);
  };

  // Schedule Helpers
  const setQuickSchedule = (minutesFromNow: number) => {
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    setScheduledTargetTime(target);
    setIsScheduleModalOpen(false);
  };

  const setSpecificTimeToday = (hour: number, minute: number) => {
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= Date.now()) {
      // If time already passed today, set for tomorrow
      target.setDate(target.getDate() + 1);
    }
    setScheduledTargetTime(target);
    setIsScheduleModalOpen(false);
  };

  const handleApplyCustomSchedule = () => {
    if (!customDateTimeInput) return;
    const target = new Date(customDateTimeInput);
    if (target.getTime() <= Date.now()) {
      showToast('Thời gian hẹn phải ở tương lai.', 'warning');
      return;
    }
    setScheduledTargetTime(target);
    setIsScheduleModalOpen(false);
  };

  const handleCancelSchedule = () => {
    setScheduledTargetTime(null);
    setTimeRemainingStr('');
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  const activeCarrierId = selectedCarrierTab !== 'default' ? selectedCarrierTab : currentSession?.carrierId;

  const previewRendered = selectedStatement 
    ? EmailService.renderEmail(selectedStatement, settings, activeCarrierId)
    : { subject: '', body: '' };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(previewRendered.body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={24} color="var(--primary)" />
            Gửi Email Đối Soát & Bảng Kê Tự Động Cho Từng Shop
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Hệ thống cá nhân hóa nội dung email (Tên Shop, tiền COD, tiền thực nhận) và tự động đính kèm file Excel bảng kê chi tiết.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          
          {/* Schedule Email Button */}
          {statements.length > 0 && (
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className={`btn btn-lg ${scheduledTargetTime ? 'btn-warning' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              title="Hẹn giờ để hệ thống tự động gửi email"
            >
              <Clock size={18} />
              <span>{scheduledTargetTime ? '⏰ Đang Hẹn Giờ' : 'Hẹn Giờ Tự Động Gửi'}</span>
            </button>
          )}

          {/* Send Immediately Button */}
          {statements.length > 0 && (
            <button
              onClick={handleStartBatchSend}
              disabled={isSendingBatch}
              className="btn btn-primary btn-lg"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {isSendingBatch ? (
                <>
                  <RotateCcw size={18} className="animate-spin" />
                  <span>Đang gửi ({sendProgress.sent}/{sendProgress.total})...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>GỬI EMAIL TẤT CẢ {statements.length} SHOP</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* SENDER EMAIL MISSING ALERT BANNER */}
      {(!settings.senderEmail || !settings.emailPassword) && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--danger)',
          fontSize: 13,
          fontWeight: 700,
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>Chưa cài đặt Gmail người gửi! Vui lòng mở menu Cài Đặt ⚙️ ở góc màn hình để thiết lập Gmail & Mật khẩu ứng dụng 16 ký tự.</span>
        </div>
      )}

      {/* MISSING SHOP RECEIVER EMAILS WARNING BANNER */}
      {missingShopEmailsCount > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          color: 'var(--text-main)',
        }}>
          <Info size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
          <span>
            Có <strong style={{ color: 'var(--warning)' }}>{missingShopEmailsCount} Shop</strong> chưa có địa chỉ Email nhận. Bạn có thể gõ nhập trực tiếp Email cho từng Shop ngay tại bảng bên dưới.
          </span>
        </div>
      )}

      {/* ACTIVE SCHEDULE COUNTDOWN BANNER */}
      {scheduledTargetTime && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(79, 70, 229, 0.12) 100%)',
          border: '2px solid var(--warning)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: 'var(--shadow-md)',
          animation: 'pulse 2s infinite',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--warning)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                ĐÃ BẬT HẸN GIỜ GỬI TỰ ĐỘNG CHO {statements.length} SHOP
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Sẽ tự động gửi vào lúc: <strong style={{ color: 'var(--primary)' }}>{scheduledTargetTime.toLocaleTimeString('vi-VN')} ({scheduledTargetTime.toLocaleDateString('vi-VN')})</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                Thời gian còn lại:
              </div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: 'var(--warning)' }}>
                {timeRemainingStr || '00:00:00'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleStartBatchSend}
                className="btn btn-primary btn-sm"
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700 }}
              >
                <Play size={14} />
                <span>Gửi Luôn Bây Giờ</span>
              </button>

              <button
                onClick={handleCancelSchedule}
                className="btn btn-secondary btn-sm"
                style={{ padding: '8px 12px', fontSize: 12, color: 'var(--danger)' }}
              >
                <X size={14} />
                <span>Hủy Hẹn Giờ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Template & Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 20,
      }}>
        {/* 1. Template Config */}
        <div className="glass-panel" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              1. Cấu Hình Mẫu Email Đối Soát
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Đang chỉnh: <strong style={{ color: 'var(--primary)' }}>{CARRIER_TABS.find(t => t.id === selectedCarrierTab)?.label}</strong>
            </span>
          </div>

          {/* Carrier Template Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14, background: 'var(--bg-secondary)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            {CARRIER_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCarrierTab(tab.id)}
                className={`btn btn-sm ${selectedCarrierTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 9px', fontSize: 11, fontWeight: selectedCarrierTab === tab.id ? 700 : 400 }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="input-group">
            <label className="input-label">Tiêu đề Email ({CARRIER_TABS.find(t => t.id === selectedCarrierTab)?.label})</label>
            <input
              type="text"
              value={activeSubject}
              onChange={(e) => handleUpdateActiveSubject(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="input-label" style={{ marginBottom: 6, display: 'block' }}>
              Chèn biến động nhanh:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { tag: '{TEN_SHOP}', label: 'Tên Shop' },
                { tag: '{KY_DOI_SOAT}', label: 'Kỳ Đối Soát' },
                { tag: '{TONG_DON}', label: 'Tổng Đơn' },
                { tag: '{TONG_COD}', label: 'Tổng COD' },
                { tag: '{TONG_CUOC}', label: 'Tổng Cước' },
                { tag: '{THUC_TRA}', label: 'Tiền Thực Trả' },
                { tag: '{NGAN_HANG}', label: 'Tên Ngân Hàng' },
                { tag: '{SO_TAI_KHOAN}', label: 'Số Tài Khoản' },
                { tag: '{CHU_TAI_KHOAN}', label: 'Chủ Tài Khoản' },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleInsertVariable(item.tag)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  +{item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Nội dung Email ({CARRIER_TABS.find(t => t.id === selectedCarrierTab)?.label})</label>
            <textarea
              rows={11}
              value={activeBody}
              onChange={(e) => handleUpdateActiveBody(e.target.value)}
              className="textarea-field"
              style={{ fontSize: 13, lineHeight: 1.6 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={handleSaveSettings} className="btn btn-secondary btn-sm">
              💾 Lưu Mẫu Email Này
            </button>
          </div>
        </div>

        {/* 2. Preview Panel */}
        <div className="glass-panel" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                2. Xem Trước Email (Bản Shop Nhận)
              </h3>
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('html')}
                  className={`btn btn-sm ${previewMode === 'html' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 8px', fontSize: 11 }}
                >
                  ✨ Giao Diện Logistics
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('text')}
                  className={`btn btn-sm ${previewMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 8px', fontSize: 11 }}
                >
                  📝 Văn Bản Thuần
                </button>
              </div>
            </div>

            {statements.length > 0 && (
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="select-field"
                style={{ width: 220, padding: '4px 8px', fontSize: 12 }}
              >
                {statements.map(s => (
                  <option key={s.shopId} value={s.shopId}>
                    {s.shopName} ({formatVND(s.totalNetPayout)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedStatement ? (
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}>
              <div style={{ fontSize: 13, borderBottom: '1px solid var(--border-color)', padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gửi tới Shop <strong>{selectedStatement.shopName}</strong>:</span>
                  {EmailService.getEmailsForStatement(selectedStatement).length === 0 ? (
                    <span className="badge badge-warning" style={{ fontSize: 11 }}>Chưa có email</span>
                  ) : (
                    EmailService.getEmailsForStatement(selectedStatement).map(em => (
                      <span key={em} className="badge badge-primary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                        ✉️ {em}
                      </span>
                    ))
                  )}
                </div>
                <div style={{ fontWeight: 700, marginTop: 6, color: 'var(--primary)' }}>
                  {previewRendered.subject}
                </div>
              </div>

              {previewMode === 'html' ? (
                <div style={{ padding: 10, background: '#f1f5f9', maxHeight: 420, overflowY: 'auto' }}>
                  <iframe
                    title="Email HTML Preview"
                    srcDoc={EmailService.renderHtmlEmail(selectedStatement, settings, activeCarrierId)}
                    style={{
                      width: '100%',
                      height: 520,
                      border: 'none',
                      borderRadius: 8,
                      background: '#ffffff',
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  fontSize: 12.5,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  color: 'var(--text-main)',
                  padding: 16,
                  maxHeight: 350,
                  overflowY: 'auto',
                }}>
                  {previewRendered.body}
                </div>
              )}

              <div style={{
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                borderTop: '1px dashed var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileSpreadsheet size={15} />
                  <span>Đính kèm: Bang_ke_doi_soat_{selectedStatement.shopCode}.xlsx</span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleCopyBody}
                    className="btn btn-secondary btn-sm"
                    title="Sao chép nội dung email"
                  >
                    {copiedBody ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    <span>{copiedBody ? 'Đã chép' : 'Sao chép'}</span>
                  </button>

                  <a
                    href={EmailService.generateMailtoUri(selectedStatement, settings)}
                    className="btn btn-primary btn-sm"
                  >
                    <Send size={13} />
                    <span>Mở Ứng Dụng Mail</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu kỳ đối soát. Vui lòng tiến hành đối soát ở tab "Đối Soát Kéo Thả" trước.
            </div>
          )}
        </div>

      </div>

      {/* 3. Batch Queue Table */}
      {statements.length > 0 && (
        <div className="table-container glass-panel">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="var(--primary)" />
              Danh Sách Hàng Đợi Gửi Mail ({statements.length} Shop)
            </h4>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Shop Nhận Đối Soát</th>
                <th>Địa Chỉ Email</th>
                <th>Số Tiền Thực Trả</th>
                <th>Trạng Thái Gửi</th>
                <th style={{ textAlign: 'right' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((stmt, idx) => {
                const statusObj = shopStatuses[stmt.shopId] || { status: 'idle' };
                return (
                  <tr key={stmt.shopId}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong>{stmt.shopName}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Mã: {stmt.shopCode}</div>
                    </td>
                    <td>
                      {editingShopId === stmt.shopId || (!stmt.shopEmail && !stmt.shopEmail.includes('@')) ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="email"
                            className="input-field"
                            style={{ padding: '3px 8px', fontSize: 12, width: 210 }}
                            placeholder="Gõ email Shop (VD: shop@gmail.com)..."
                            value={tempEmailMap[stmt.shopId] ?? stmt.shopEmail ?? ''}
                            onChange={e => setTempEmailMap({ ...tempEmailMap, [stmt.shopId]: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleSaveShopEmail(stmt, tempEmailMap[stmt.shopId] ?? stmt.shopEmail ?? '');
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                            onClick={() => handleSaveShopEmail(stmt, tempEmailMap[stmt.shopId] ?? stmt.shopEmail ?? '')}
                            title="Lưu email này cho Shop"
                          >
                            <Save size={12} /> Lưu
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {EmailService.getEmailsForStatement(stmt).length === 0 ? (
                            <span style={{ fontSize: 12, color: 'var(--danger)', fontStyle: 'italic' }}>Chưa có email</span>
                          ) : (
                            EmailService.getEmailsForStatement(stmt).map(em => (
                              <span key={em} className="badge badge-neutral mono" style={{ fontSize: 11 }}>
                                ✉️ {em}
                              </span>
                            ))
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setTempEmailMap({ ...tempEmailMap, [stmt.shopId]: EmailService.getEmailsForStatement(stmt).join(', ') || stmt.shopEmail });
                              setEditingShopId(stmt.shopId);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', padding: 2 }}
                            title="Chỉnh sửa hoặc thêm email nhận cho Shop này (cách phẩy)"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--success)' }}>
                      {formatVND(stmt.totalNetPayout)}
                    </td>
                    <td>
                      {statusObj.status === 'idle' && (
                        <span className="badge badge-neutral">Sẵn sàng</span>
                      )}
                      {statusObj.status === 'sending' && (
                        <span className="badge badge-warning">Đang gửi...</span>
                      )}
                      {statusObj.status === 'sent' && (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Đã gửi thành công
                        </span>
                      )}
                      {statusObj.status === 'failed' && (
                        <span className="badge badge-danger" title={statusObj.message}>
                          Lỗi: {statusObj.message}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={async () => {
                            const recipientEmails = EmailService.getEmailsForStatement(stmt);
                            if (recipientEmails.length === 0) {
                              showToast('Shop chưa có địa chỉ email nhận.', 'warning');
                              return;
                            }
                            setShopStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'sending' } }));
                            const excelBase64 = EmailService.generateExcelBase64(stmt);
                            const { subject, body } = EmailService.renderEmail(stmt, settings, activeCarrierId);
                            const htmlBody = EmailService.renderHtmlEmail(stmt, settings, activeCarrierId);
                            const toHeader = recipientEmails.join(', ');

                            const res = await EmailService.sendRealEmail({
                              senderName: settings.senderName,
                              senderEmail: settings.senderEmail,
                              emailPassword: settings.emailPassword,
                              smtpHost: settings.smtpHost,
                              smtpPort: settings.smtpPort,
                              to: toHeader,
                              subject,
                              text: body,
                              html: htmlBody,
                              attachments: excelBase64 ? [{
                                filename: `Bang_ke_doi_soat_${stmt.shopCode || stmt.shopName}.xlsx`,
                                content: excelBase64,
                              }] : undefined,
                            });
                            if (res.success) {
                              setShopStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'sent', message: `Đã gửi thành công tới ${recipientEmails.length} mail` } }));
                            } else {
                              setShopStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'failed', message: res.error } }));
                            }
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '5px 9px', fontSize: 11 }}
                          title="Gửi ngay cho riêng Shop này qua SMTP"
                        >
                          <Send size={12} />
                          <span>Gửi ngay</span>
                        </button>

                        <button
                          onClick={() => ExcelService.downloadShopStatement(stmt)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 8px' }}
                          title="Tải file Excel"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {isScheduleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsScheduleModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                  Hẹn Giờ Tự Động Gửi Email Hàng Loạt
                </h3>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Bạn làm xong đối soát vào buổi sáng và muốn tự động gửi bảng kê cho các Shop vào khung giờ chiều? Hãy chọn mốc thời gian dưới đây:
              </div>

              {/* Quick Presets for Today */}
              <div>
                <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>
                  Khung giờ phổ biến trong ngày:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSpecificTimeToday(11, 30)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '8px 12px', justifyContent: 'flex-start' }}
                  >
                    <Clock size={14} color="var(--primary)" />
                    <span>Trưa nay: <strong>11:30</strong></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpecificTimeToday(14, 0)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '8px 12px', justifyContent: 'flex-start' }}
                  >
                    <Clock size={14} color="var(--primary)" />
                    <span>Đầu chiều: <strong>14:00</strong></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpecificTimeToday(16, 30)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '8px 12px', justifyContent: 'flex-start' }}
                  >
                    <Clock size={14} color="var(--primary)" />
                    <span>Cuối chiều: <strong>16:30</strong></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSpecificTimeToday(17, 30)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '8px 12px', justifyContent: 'flex-start' }}
                  >
                    <Clock size={14} color="var(--primary)" />
                    <span>Tối nay: <strong>17:30</strong></span>
                  </button>
                </div>
              </div>

              {/* Countdown Presets */}
              <div>
                <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>
                  Gửi sau khoảng thời gian:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setQuickSchedule(15)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Sau 15 phút
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSchedule(30)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Sau 30 phút
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSchedule(60)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    Sau 1 giờ
                  </button>
                </div>
              </div>

              {/* Custom Date & Time Picker */}
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <label className="input-label">Hoặc chọn ngày giờ chính xác:</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input
                    type="datetime-local"
                    value={customDateTimeInput}
                    onChange={(e) => setCustomDateTimeInput(e.target.value)}
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomSchedule}
                    className="btn btn-primary"
                  >
                    <CheckCircle size={15} />
                    <span>Đặt Lịch</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
