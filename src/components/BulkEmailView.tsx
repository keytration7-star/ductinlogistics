import React, { useState, useEffect, useRef } from 'react';
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
  Eye,
  Timer,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Zap,
  Search,
  Settings as SettingsIcon,
} from 'lucide-react';
import type { ReconciliationSession, EmailSettings, ShopSettlementStatement, ZaloZnsSettings } from '../types';
import { EmailService } from '../services/emailService';
import { ExcelService } from '../services/excelService';
import { StorageService } from '../services/storage';
import { ZaloZnsService } from '../services/zaloZnsService';
import { ZaloZnsConfigModal } from './ZaloZnsConfigModal';

interface BulkEmailViewProps {
  currentSession: ReconciliationSession | null;
  emailSettings: EmailSettings;
  onSaveEmailSettings: (settings: EmailSettings) => void;
  activeCarrierId?: string;
  activeCarrierName?: string;
  initialChannel?: 'zalo' | 'email';
}

const MOCK_DEMO_STATEMENT: ShopSettlementStatement = {
  shopId: 'shop_mock_demo',
  shopCode: 'SHOP_DEMO_01',
  shopName: 'Shop Thời Trang Mẫu (Xem Trước)',
  shopEmail: 'chushop.demo@gmail.com',
  shopPhone: '0988.123.456',
  shopAddress: 'Hà Nội',
  periodName: 'Kỳ 16/08 - 22/08/2026',
  totalOrders: 35,
  deliveredOrders: 35,
  returnedOrders: 0,
  inTransitOrders: 0,
  totalCod: 18500000,
  totalShopFee: 805000,
  totalShopOtherFee: 0,
  totalNetPayout: 17695000,
  totalNvcCost: 630000,
  totalProfit: 175000,
  emailStatus: 'idle',
  bankInfo: {
    bankName: 'MB Bank',
    accountNumber: '999988886666',
    accountHolder: 'NGUYỄN VĂN DEMO',
  },
  orders: [],
};

export const BulkEmailView: React.FC<BulkEmailViewProps> = ({
  currentSession,
  emailSettings,
  onSaveEmailSettings,
  activeCarrierId,
  activeCarrierName,
  initialChannel = 'email',
}) => {
  const { showToast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  
  // All stored sessions
  const allStoredSessions = StorageService.getSessions();

  // Combine currentSession if not present in storage
  const allAvailableSessions = React.useMemo(() => {
    const list = [...allStoredSessions];
    if (currentSession && !list.some(s => s.id === currentSession.id)) {
      list.unshift(currentSession);
    }
    return list;
  }, [allStoredSessions, currentSession]);

  // Filter by active carrier, or fallback to all available sessions if no carrier-match
  const displaySessions = React.useMemo(() => {
    if (!activeCarrierId) return allAvailableSessions;
    const target = activeCarrierId.toLowerCase();
    const filtered = allAvailableSessions.filter(s => {
      const sCarrier = (s.carrierId || '').toLowerCase();
      const sCarrierName = (s.carrierName || '').toLowerCase();
      if (target === 'ghn' || target.includes('ghn') || target.includes('nhanh')) {
        return sCarrier === 'ghn' || sCarrier.includes('ghn') || sCarrierName.includes('nhanh') || sCarrierName.includes('ghn');
      }
      if (target === 'jnt' || target.includes('jnt') || target.includes('j&t')) {
        return sCarrier === 'jnt' || sCarrier.includes('jnt') || sCarrierName.includes('j&t') || sCarrierName.includes('jnt');
      }
      if (target === 'ghtk' || target.includes('ghtk') || target.includes('tiet_kiem')) {
        return sCarrier === 'ghtk' || sCarrier.includes('ghtk') || sCarrierName.includes('tiet kiem');
      }
      if (target === 'vtp' || target.includes('vtp') || target.includes('viettel')) {
        return sCarrier === 'vtp' || sCarrier.includes('vtp') || sCarrierName.includes('viettel');
      }
      if (target === 'spx' || target.includes('spx') || target.includes('shopee')) {
        return sCarrier === 'spx' || sCarrier.includes('spx') || sCarrierName.includes('shopee');
      }
      return sCarrier === target || sCarrier.includes(target) || target.includes(sCarrier);
    });
    return filtered.length > 0 ? filtered : allAvailableSessions;
  }, [allAvailableSessions, activeCarrierId]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    if (currentSession?.id) return currentSession.id;
    return displaySessions[0]?.id ?? '';
  });

  React.useEffect(() => {
    if (currentSession?.id) {
      setSelectedSessionId(currentSession.id);
    } else if (displaySessions.length > 0 && !displaySessions.some(s => s.id === selectedSessionId)) {
      setSelectedSessionId(displaySessions[0].id);
    }
  }, [currentSession, displaySessions]);

  const activeSession = displaySessions.find(s => s.id === selectedSessionId) || currentSession || displaySessions[0] || null;
  const statements = activeSession?.statements || [];
  const hasUnmatchedOrders = (activeSession?.unmatchedOrdersCount || 0) > 0;

  const [settings, setSettings] = useState<EmailSettings>(emailSettings);

  // Active Notification Channel: 'zalo' | 'email'
  const [activeChannel, setActiveChannel] = useState<'zalo' | 'email'>(initialChannel);

  React.useEffect(() => {
    if (initialChannel) {
      setActiveChannel(initialChannel);
    }
  }, [initialChannel]);
  const [zaloSettings, setZaloSettings] = useState<ZaloZnsSettings>(() => StorageService.getZaloZnsSettings());
  const [isZaloConfigOpen, setIsZaloConfigOpen] = useState(false);
  const [isSendingZaloBatch, setIsSendingZaloBatch] = useState(false);
  const [zaloProgress, setZaloProgress] = useState<{ sent: number; total: number; success: number; failed: number }>({ sent: 0, total: 0, success: 0, failed: 0 });
  const [zaloStatuses, setZaloStatuses] = useState<Record<string, { status: 'idle' | 'sending' | 'sent' | 'failed'; message?: string; messageId?: string }>>({});
  const [zaloSearchQuery, setZaloSearchQuery] = useState('');

  const [selectedShopId, setSelectedShopId] = useState<string>(
    statements[0]?.shopId || ''
  );
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });
  const [shopStatuses, setShopStatuses] = useState<Record<string, { status: 'idle' | 'sending' | 'sent' | 'failed'; message?: string }>>({});
  const [copiedBody, setCopiedBody] = useState(false);

  // Sending Delay Interval State (Anti-spam / Rate limiting)
  const [sendIntervalSec, setSendIntervalSec] = useState<number>(2);

  // Scheduling State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledTargetTime, setScheduledTargetTime] = useState<Date | null>(null);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('');
  const [customDateTimeInput, setCustomDateTimeInput] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');

  // Inline Shop Email Editing State
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [tempEmailMap, setTempEmailMap] = useState<Record<string, string>>({});
  const initialCarrierTab = activeCarrierId || 'default';
  const [selectedCarrierTab, setSelectedCarrierTab] = useState<string>(initialCarrierTab);

  React.useEffect(() => {
    if (activeCarrierId) {
      setSelectedCarrierTab(activeCarrierId);
    }
  }, [activeCarrierId]);

  React.useEffect(() => {
    if (statements.length > 0 && (!selectedShopId || !statements.some(s => s.shopId === selectedShopId))) {
      setSelectedShopId(statements[0].shopId);
    }
  }, [statements, selectedShopId]);

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

  // Determine effective statement for preview
  const isMockPreview = statements.length === 0;
  const selectedStatement: ShopSettlementStatement = isMockPreview 
    ? {
        ...MOCK_DEMO_STATEMENT,
        periodName: activeCarrierName ? `Kỳ Đối Soát ${activeCarrierName}` : 'Kỳ 16/08 - 22/08/2026'
      }
    : (statements.find(s => s.shopId === selectedShopId) || statements[0]);

  const missingShopEmailsCount = statements.filter(s => !s.shopEmail || !s.shopEmail.includes('@')).length;

  // Auto-populate missing emails from StorageService registered shops
  React.useEffect(() => {
    if (!activeSession || !activeSession.statements.length) return;
    const registeredShops = StorageService.getShops();
    let hasChanges = false;

    activeSession.statements.forEach(stmt => {
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
      StorageService.saveSession(activeSession);
    }
  }, [activeSession]);

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

    // 3. Save to active session in StorageService if active
    if (activeSession) {
      const targetStmt = activeSession.statements.find(s => s.shopId === stmt.shopId);
      if (targetStmt) targetStmt.shopEmail = cleanEmail;
      StorageService.saveSession(activeSession);
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
    if (hasUnmatchedOrders) {
      setScheduledTargetTime(null);
      showToast('Kỳ đối soát còn đơn chưa khớp nên không thể gửi email hoặc bảng kê cho shop.', 'warning');
      return;
    }
    if (statements.length === 0) {
      showToast('Chưa có danh sách shop đối soát nào trong kỳ này.', 'warning');
      return;
    }

    // Cancel any active schedule if manually triggered
    setScheduledTargetTime(null);
    setIsSendingBatch(true);
    setSendProgress({ sent: 0, total: statements.length });

    const newStatuses: Record<string, { status: 'idle' | 'sending' | 'sent' | 'failed'; message?: string }> = {};

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      newStatuses[stmt.shopId] = { status: 'sending' };
      setShopStatuses({ ...newStatuses });

      const recipientEmails = EmailService.getEmailsForStatement(stmt);
      if (recipientEmails.length === 0) {
        newStatuses[stmt.shopId] = { status: 'failed', message: 'Shop chưa có địa chỉ Email nhận hợp lệ' };
        setShopStatuses({ ...newStatuses });
        setSendProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
        continue;
      }

      if (!settings.senderEmail || !settings.emailPassword) {
        newStatuses[stmt.shopId] = { status: 'failed', message: 'Chưa cài đặt Gmail gửi hoặc Mật khẩu ứng dụng trong Cài Đặt ⚙️' };
        setShopStatuses({ ...newStatuses });
        setSendProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
        continue;
      }

      const excelBase64 = EmailService.generateExcelBase64(stmt);
      const { subject, body } = EmailService.renderEmail(stmt, settings, activeCarrierId);
      const htmlBody = EmailService.renderHtmlEmail(stmt, settings, activeCarrierId);

      const res = await EmailService.sendRealEmail({
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        emailPassword: settings.emailPassword,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        to: recipientEmails.join(', '),
        subject,
        text: body,
        html: htmlBody,
        attachments: excelBase64 ? [{
          filename: `Bang_ke_doi_soat_${stmt.shopCode || stmt.shopName}.xlsx`,
          content: excelBase64,
        }] : undefined,
      });

      if (res.success) {
        newStatuses[stmt.shopId] = { status: 'sent', message: `Đã gửi thành công tới ${recipientEmails.length} email` };
      } else {
        newStatuses[stmt.shopId] = { status: 'failed', message: res.error || 'Lỗi gửi mail' };
      }
      setShopStatuses({ ...newStatuses });
      setSendProgress(prev => ({ ...prev, sent: prev.sent + 1 }));

      // Delay interval between sending emails
      if (i < statements.length - 1 && sendIntervalSec > 0) {
        await new Promise(resolve => setTimeout(resolve, sendIntervalSec * 1000));
      }
    }

    setIsSendingBatch(false);
    showToast('Đã hoàn tất tiến trình gửi email đối soát hàng loạt!', 'success');
  };

  // Zalo ZNS Handlers
  const handleSaveZaloSettings = (newSettings: ZaloZnsSettings) => {
    setZaloSettings(newSettings);
    StorageService.saveZaloZnsSettings(newSettings);
  };

  const handleStartZaloBatchSend = async () => {
    if (hasUnmatchedOrders) {
      showToast('Kỳ đối soát còn đơn chưa khớp nên không thể gửi ZNS cho shop.', 'warning');
      return;
    }
    if (statements.length === 0) {
      showToast('Chưa có danh sách shop đối soát nào trong kỳ này.', 'warning');
      return;
    }

    setIsSendingZaloBatch(true);
    setZaloProgress({ sent: 0, total: statements.length, success: 0, failed: 0 });

    const newStatuses = { ...zaloStatuses };
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      newStatuses[stmt.shopId] = { status: 'sending' };
      setZaloStatuses({ ...newStatuses });

      const res = await ZaloZnsService.sendSingleZns(stmt.shopPhone || '', stmt, activeSession!, zaloSettings);
      
      if (res.success) {
        successCount++;
        newStatuses[stmt.shopId] = { status: 'sent', messageId: res.messageId, message: 'Đã gửi thành công qua Zalo ZNS' };
      } else {
        failedCount++;
        newStatuses[stmt.shopId] = { status: 'failed', message: res.error || 'Lỗi gửi ZNS' };
      }

      setZaloStatuses({ ...newStatuses });
      setZaloProgress({
        sent: i + 1,
        total: statements.length,
        success: successCount,
        failed: failedCount,
      });

      if (i < statements.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    setIsSendingZaloBatch(false);
    showToast(`Đã hoàn tất gửi Zalo ZNS! Thành công: ${successCount}, Lỗi: ${failedCount}`, successCount > 0 ? 'success' : 'warning');
  };

  const handleSendSingleZalo = async (stmt: ShopSettlementStatement) => {
    if (hasUnmatchedOrders) {
      showToast('Kỳ còn đơn chưa khớp nên không thể gửi ZNS.', 'warning');
      return;
    }
    setZaloStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'sending' } }));
    const res = await ZaloZnsService.sendSingleZns(stmt.shopPhone || '', stmt, activeSession!, zaloSettings);
    if (res.success) {
      setZaloStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'sent', messageId: res.messageId, message: 'Đã gửi thành công' } }));
      showToast(`Đã gửi tin nhắn Zalo ZNS thành công tới ${stmt.shopName}!`, 'success');
    } else {
      setZaloStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'failed', message: res.error } }));
      showToast(`Lỗi gửi Zalo ZNS: ${res.error}`, 'error');
    }
  };

  const handleOpenZaloDirectChat = (phone: string, stmt: ShopSettlementStatement) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const memo = `Kính gửi ${stmt.shopName},\n${zaloSettings.companyName || 'ĐỨC TÍN LOGISTICS'} gửi bảng kê đối soát kỳ ${activeSession?.sessionName || ''}:\n- Tổng đơn: ${stmt.totalOrders} đơn\n- Thu hộ COD: ${new Intl.NumberFormat('vi-VN').format(stmt.totalCod)} đ\n- Tổng cước: ${new Intl.NumberFormat('vi-VN').format(stmt.totalShopFee + stmt.totalShopOtherFee)} đ\n- THỰC NHẬN: ${new Intl.NumberFormat('vi-VN').format(stmt.totalNetPayout)} đ\nSTK: ${stmt.bankInfo?.bankName || ''} - ${stmt.bankInfo?.accountNumber || ''} (${stmt.bankInfo?.accountHolder || ''})\nTrân trọng cảm ơn Quý Khách!`;
    navigator.clipboard.writeText(memo);
    showToast(`Đã sao chép nội dung tóm tắt đối soát & mở Zalo chat với ${phone}`, 'success');
    window.open(`https://zalo.me/${cleanPhone}`, '_blank');
  };

  // Schedule Helpers
  const setQuickSchedule = (minutesFromNow: number) => {
    if (hasUnmatchedOrders) {
      showToast('Cần xử lý toàn bộ đơn chưa khớp trước khi hẹn gửi email.', 'warning');
      return;
    }
    const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
    setScheduledTargetTime(target);
    setIsScheduleModalOpen(false);
    showToast(`Đã hẹn giờ tự động gửi sau ${minutesFromNow} phút!`, 'info');
  };

  const setSpecificTimeToday = (hour: number, minute: number) => {
    if (hasUnmatchedOrders) {
      showToast('Cần xử lý toàn bộ đơn chưa khớp trước khi hẹn gửi email.', 'warning');
      return;
    }
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    setScheduledTargetTime(target);
    setIsScheduleModalOpen(false);
    showToast(`Đã hẹn giờ tự động gửi vào lúc ${target.toLocaleTimeString('vi-VN')}!`, 'info');
  };

  const handleApplyCustomSchedule = () => {
    if (hasUnmatchedOrders) {
      showToast('Cần xử lý toàn bộ đơn chưa khớp trước khi hẹn gửi email.', 'warning');
      return;
    }
    if (!customDateTimeInput) return;
    const target = new Date(customDateTimeInput);
    if (target.getTime() <= Date.now()) {
      showToast('Thời gian hẹn phải ở tương lai.', 'warning');
      return;
    }
    setScheduledTargetTime(target);
    setIsScheduleModalOpen(false);
    showToast(`Đã hẹn giờ tự động gửi vào ${target.toLocaleString('vi-VN')}!`, 'info');
  };

  const handleCancelSchedule = () => {
    setScheduledTargetTime(null);
    setTimeRemainingStr('');
    showToast('Đã hủy lịch hẹn gửi email tự động.', 'info');
  };

  const handleSelectShopAndScroll = (shopId: string) => {
    setSelectedShopId(shopId);
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  const filteredZaloStatements = statements.filter(stmt => {
    if (!zaloSearchQuery) return true;
    const q = zaloSearchQuery.toLowerCase();
    return (
      stmt.shopName.toLowerCase().includes(q) ||
      stmt.shopCode.toLowerCase().includes(q) ||
      (stmt.shopPhone && stmt.shopPhone.includes(q))
    );
  });

  const currentCarrierId = activeCarrierId || (selectedCarrierTab !== 'default' ? selectedCarrierTab : activeSession?.carrierId);

  const previewRendered = EmailService.renderEmail(selectedStatement, settings, currentCarrierId);

  const handleCopyBody = () => {
    navigator.clipboard.writeText(previewRendered.body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* 🌟 CHANNEL SELECTOR TABS: ZALO ZNS VS GMAIL */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#ffffff',
        padding: '8px 12px',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <button
          type="button"
          onClick={() => setActiveChannel('zalo')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '12px 20px',
            borderRadius: 12,
            border: activeChannel === 'zalo' ? '1.5px solid #0068ff' : '1px solid transparent',
            background: activeChannel === 'zalo' ? 'linear-gradient(135deg, #0068ff 0%, #0052cc 100%)' : '#f8fafc',
            color: activeChannel === 'zalo' ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: activeChannel === 'zalo' ? '0 4px 14px rgba(0, 104, 255, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <MessageSquare size={20} />
          <span>💬 GỬI ZALO ZNS DOANH NGHIỆP (TỰ ĐỘNG 100%)</span>
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            background: activeChannel === 'zalo' ? '#ffffff' : '#e0f2fe',
            color: activeChannel === 'zalo' ? '#0068ff' : '#0369a1',
            padding: '2px 8px',
            borderRadius: 12,
            textTransform: 'uppercase',
          }}>
            Tích Xanh OA
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('email')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '12px 20px',
            borderRadius: 12,
            border: activeChannel === 'email' ? '1.5px solid var(--primary)' : '1px solid transparent',
            background: activeChannel === 'email' ? 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)' : '#f8fafc',
            color: activeChannel === 'email' ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: activeChannel === 'email' ? '0 4px 14px rgba(79, 70, 229, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Mail size={20} />
          <span>✉️ GỬI EMAIL HÀNG LOẠT (HTML & FILE EXCEL)</span>
        </button>
      </div>

      {/* ======================= TAB 1: ZALO ZNS DOANH NGHIỆP ======================= */}
      {activeChannel === 'zalo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            background: '#ffffff',
            padding: '18px 24px',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px -3px rgba(0,0,0,0.04)',
          }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, margin: 0, color: 'var(--text-main)' }}>
                <MessageSquare size={24} color="#0068ff" />
                Gửi Thông Báo Đối Soát Qua Zalo ZNS (Tích Xanh Doanh Nghiệp)
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Gửi tin nhắn thông báo đối soát trực tiếp đến Số Điện Thoại của khách hàng qua Zalo Notification Service.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Session Selector */}
              {displaySessions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1' }}>
                  <Layers size={16} color="#0068ff" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Kỳ:</span>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => {
                      setSelectedSessionId(e.target.value);
                      const target = displaySessions.find(s => s.id === e.target.value);
                      if (target?.statements?.length) {
                        setSelectedShopId(target.statements[0].shopId);
                      }
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#0068ff',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      maxWidth: 260,
                    }}
                  >
                    {displaySessions.map((ses, idx) => (
                      <option key={ses.id || idx} value={ses.id}>
                        {ses.sessionName || `Kỳ ${ses.id}`} ({ses.statements.length} Shop • {ses.carrierName || 'NVC'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mode Indicator */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                background: zaloSettings.isTestMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${zaloSettings.isTestMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                fontSize: 12,
                fontWeight: 700,
                color: zaloSettings.isTestMode ? '#b45309' : '#047857',
              }}>
                {zaloSettings.isTestMode ? <Zap size={15} /> : <ShieldCheck size={15} />}
                <span>{zaloSettings.isTestMode ? '⚡ Chế độ Thử Nghiệm / Demo' : '🟢 Zalo OA Live Production'}</span>
              </div>

              {/* Zalo Config Button */}
              <button
                type="button"
                onClick={() => setIsZaloConfigOpen(true)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontWeight: 700 }}
              >
                <SettingsIcon size={16} />
                <span>Cấu Hình Zalo ZNS</span>
              </button>

              {/* Send Zalo Bulk Button */}
              <button
                type="button"
                onClick={handleStartZaloBatchSend}
                disabled={isSendingZaloBatch || hasUnmatchedOrders || statements.length === 0}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #0068ff 0%, #0052cc 100%)',
                  borderColor: '#0068ff',
                }}
              >
                {isSendingZaloBatch ? (
                  <>
                    <RotateCcw size={16} className="animate-spin" />
                    <span>Đang gửi ZNS ({zaloProgress.sent}/{zaloProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>GỬI ZALO ZNS TẤT CẢ {statements.length > 0 ? `(${statements.length} SHOP)` : 'HÀNG LOẠT'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Progress Banner when batch sending */}
          {isSendingZaloBatch && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 104, 255, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1.5px solid #0068ff',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#0068ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={16} className="animate-spin" />
                  Đang gửi tin nhắn Zalo ZNS tới các Shop...
                </span>
                <span>
                  Tiến độ: <strong>{zaloProgress.sent} / {zaloProgress.total}</strong> ({Math.round((zaloProgress.sent / (zaloProgress.total || 1)) * 100)}%)
                </span>
              </div>
              {/* Progress bar line */}
              <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.round((zaloProgress.sent / (zaloProgress.total || 1)) * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0068ff 0%, #10b981 100%)',
                  transition: 'width 0.2s ease',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Thành công: {zaloProgress.success}</span>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>✗ Lỗi: {zaloProgress.failed}</span>
              </div>
            </div>
          )}

          {/* 2 Columns: Left (Shop Table) + Right (Mobile Mockup Preview) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(450px, 1fr) 380px',
            gap: 20,
            alignItems: 'start',
          }}>
            {/* Left Column: Shop Table */}
            <div className="glass-panel" style={{ padding: 20, borderRadius: 16, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Danh Sách Shop Nhận ZNS ({filteredZaloStatements.length})
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Kỳ đối soát: <strong>{activeSession?.sessionName || 'Chưa chọn'}</strong>
                  </div>
                </div>

                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Tìm Shop hoặc SĐT..."
                    value={zaloSearchQuery}
                    onChange={(e) => setZaloSearchQuery(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ maxHeight: 520, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th>STT</th>
                      <th>Tên Shop & Mã</th>
                      <th>SĐT Zalo</th>
                      <th style={{ textAlign: 'right' }}>Thực Nhận</th>
                      <th style={{ textAlign: 'center' }}>Trạng Thái ZNS</th>
                      <th style={{ textAlign: 'right' }}>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredZaloStatements.map((stmt, idx) => {
                      const isSelected = selectedShopId === stmt.shopId;
                      const statusObj = zaloStatuses[stmt.shopId];
                      return (
                        <tr 
                          key={stmt.shopId}
                          onClick={() => setSelectedShopId(stmt.shopId)}
                          style={{
                            background: isSelected ? 'rgba(0, 104, 255, 0.05)' : undefined,
                            cursor: 'pointer',
                          }}
                        >
                          <td>{idx + 1}</td>
                          <td>
                            <div>
                              <strong style={{ fontSize: 13, color: isSelected ? '#0068ff' : undefined }}>{stmt.shopName}</strong>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mã: {stmt.shopCode}</div>
                            </div>
                          </td>
                          <td>
                            {stmt.shopPhone ? (
                              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{stmt.shopPhone}</span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>⚠️ Thiếu SĐT</span>
                            )}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                            {formatVND(stmt.totalNetPayout)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {statusObj?.status === 'sending' && (
                              <span className="badge badge-info" style={{ fontSize: 10 }}>
                                <RotateCcw size={10} className="animate-spin" style={{ display: 'inline', marginRight: 3 }} />
                                Đang gửi...
                              </span>
                            )}
                            {statusObj?.status === 'sent' && (
                              <span className="badge badge-success" style={{ fontSize: 10 }}>
                                ✓ Đã gửi ZNS
                              </span>
                            )}
                            {statusObj?.status === 'failed' && (
                              <span className="badge badge-danger" style={{ fontSize: 10 }} title={statusObj.message}>
                                ✗ Lỗi ZNS
                              </span>
                            )}
                            {(!statusObj || statusObj.status === 'idle') && (
                              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                                Chưa gửi
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleSendSingleZalo(stmt)}
                                disabled={hasUnmatchedOrders}
                                className="btn btn-sm btn-primary"
                                style={{ padding: '3px 8px', fontSize: 11, background: '#0068ff', borderColor: '#0068ff' }}
                                title="Gửi tin ZNS chính thức qua Zalo OA"
                              >
                                <Send size={11} />
                                <span>Gửi</span>
                              </button>

                              {stmt.shopPhone && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenZaloDirectChat(stmt.shopPhone || '', stmt)}
                                  className="btn btn-sm btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11, color: '#0068ff' }}
                                  title="Mở chat Zalo cá nhân (Zalo 1-Click)"
                                >
                                  <MessageSquare size={11} />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => ExcelService.downloadShopStatement(stmt)}
                                className="btn btn-sm btn-secondary"
                                style={{ padding: '3px 8px', fontSize: 11, color: 'var(--success)' }}
                                title="Tải file Excel bảng kê của Shop này"
                              >
                                <Download size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Mobile Zalo ZNS Mockup Preview */}
            <div style={{
              background: '#f1f5f9',
              borderRadius: 24,
              padding: '16px 14px',
              border: '3px solid #cbd5e1',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {/* Mobile Header Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
              }}>
                <span>09:41</span>
                <span>Zalo Notification</span>
                <span>🔋 100%</span>
              </div>

              {/* Zalo OA Header */}
              <div style={{
                background: '#ffffff',
                padding: '12px 14px',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: '#0068ff',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                }}>
                  {zaloSettings.companyName ? zaloSettings.companyName.charAt(0) : 'D'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <strong style={{ fontSize: 13, color: '#0f172a' }}>{zaloSettings.companyName || 'ĐỨC TÍN LOGISTICS'}</strong>
                    <span style={{ color: '#0068ff', fontSize: 13 }}>✓</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Zalo Official Account</div>
                </div>
              </div>

              {/* ZNS Message Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: 16,
                padding: 16,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {/* Card Title */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0068ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    THÔNG BÁO GIAO DỊCH
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginTop: 3 }}>
                    Quyết Toán Đối Soát COD
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Kính gửi Shop: <strong style={{ color: '#0f172a' }}>{selectedStatement.shopName}</strong>
                  </div>
                </div>

                {/* Summary Parameter Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Kỳ đối soát:</span>
                    <strong>{activeSession?.sessionName || selectedStatement.periodName}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tổng đơn hoàn thành:</span>
                    <strong>{selectedStatement.totalOrders} đơn</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tiền thu hộ COD:</span>
                    <strong style={{ color: '#0284c7' }}>{formatVND(selectedStatement.totalCod)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tổng cước & phí DV:</span>
                    <strong style={{ color: '#b45309' }}>-{formatVND(selectedStatement.totalShopFee + selectedStatement.totalShopOtherFee)}</strong>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'rgba(0, 104, 255, 0.08)',
                    borderRadius: 8,
                    border: '1px solid rgba(0, 104, 255, 0.2)',
                  }}>
                    <span style={{ fontWeight: 800, color: '#0068ff' }}>THỰC NHẬN:</span>
                    <span className="mono" style={{ fontWeight: 900, fontSize: 14, color: '#0068ff' }}>
                      {formatVND(selectedStatement.totalNetPayout)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                    <span>Tài khoản nhận:</span>
                    <span style={{ textAlign: 'right' }}>
                      {selectedStatement.bankInfo?.bankName ? `${selectedStatement.bankInfo.bankName} - ${selectedStatement.bankInfo.accountNumber}` : 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>

                {/* Action CTA Button */}
                <div style={{
                  marginTop: 6,
                  padding: '10px',
                  borderRadius: 10,
                  background: '#0068ff',
                  color: '#ffffff',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: '0 2px 8px rgba(0, 104, 255, 0.3)',
                  cursor: 'pointer',
                }}>
                  📄 Xem & Tải Bảng Kê Chi Tiết
                </div>

                <div style={{ fontSize: 10.5, color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                  Tin nhắn tự động từ {zaloSettings.companyName || 'ĐỨC TÍN LOGISTICS'}. Vui lòng liên hệ kế toán nếu có thắc mắc.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: EMAIL HÀNG LOẠT ======================= */}
      {activeChannel === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header & Action Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        background: '#ffffff',
        padding: '18px 24px',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 15px -3px rgba(0,0,0,0.04)',
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, margin: 0, color: 'var(--text-main)' }}>
            <Mail size={24} color="var(--primary)" />
            Gửi Email Đối Soát & Bảng Kê Tự Động Cho Từng Shop
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Hệ thống cá nhân hóa nội dung email (Tên Shop, tiền COD, tiền thực nhận, STK) và tự động đính kèm file Excel bảng kê chi tiết.
          </p>
        </div>

        {/* Action Controls & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          
          {/* Session Selector */}
          {displaySessions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 10, border: '1.5px solid #cbd5e1' }}>
              <Layers size={16} color="var(--primary)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Kỳ:</span>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  const target = displaySessions.find(s => s.id === e.target.value);
                  if (target?.statements?.length) {
                    setSelectedShopId(target.statements[0].shopId);
                  }
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--primary)',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  maxWidth: 260,
                }}
              >
                {displaySessions.map((ses, idx) => (
                  <option key={ses.id || idx} value={ses.id}>
                    {ses.sessionName || `Kỳ ${ses.id}`} ({ses.statements.length} Shop • {ses.carrierName || 'NVC'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Send Interval / Rate Limit Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
            <Timer size={16} color="var(--primary)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Giãn cách gửi:</span>
            <select
              value={sendIntervalSec}
              onChange={(e) => setSendIntervalSec(Number(e.target.value))}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--primary)',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
              title="Khoảng thời gian nghỉ giữa mỗi lượt gửi để chống bị Gmail khóa rate limit"
            >
              <option value={1}>1 giây / mail</option>
              <option value={2}>2 giây / mail (Khuyên dùng)</option>
              <option value={3}>3 giây / mail</option>
              <option value={5}>5 giây / mail (An toàn nhất)</option>
              <option value={10}>10 giây / mail</option>
            </select>
          </div>

          {/* Schedule Email Button */}
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            disabled={hasUnmatchedOrders || statements.length === 0}
            className={`btn ${scheduledTargetTime ? 'btn-warning' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontWeight: 700 }}
            title="Hẹn giờ để hệ thống tự động gửi email"
          >
            <Clock size={16} />
            <span>{scheduledTargetTime ? '⏰ Đang Hẹn Giờ' : 'Hẹn Giờ Gửi Tự Động'}</span>
          </button>

          {/* Send Immediately Button */}
          <button
            onClick={handleStartBatchSend}
            disabled={isSendingBatch || hasUnmatchedOrders || statements.length === 0}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontWeight: 800 }}
          >
            {isSendingBatch ? (
              <>
                <RotateCcw size={16} className="animate-spin" />
                <span>Đang gửi ({sendProgress.sent}/{sendProgress.total})...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>GỬI EMAIL {statements.length > 0 ? `TẤT CẢ ${statements.length} SHOP` : 'HÀNG LOẠT'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SENDER EMAIL MISSING ALERT BANNER */}
      {(!settings.senderEmail || !settings.emailPassword) && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
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

      {hasUnmatchedOrders && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>Kỳ này còn {activeSession?.unmatchedOrdersCount} đơn chưa khớp. Email, file Excel và lịch hẹn gửi bị khóa cho đến khi đối soát hoàn tất.</span>
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
                disabled={hasUnmatchedOrders}
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

      {/* Main Grid: Template Editor & Live Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 20,
      }}>
        {/* 1. Template Config */}
        <div className="glass-panel" style={{
          padding: 24,
          background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.03) 0%, rgba(255, 255, 255, 1) 100%)',
          border: '1.5px solid rgba(79, 70, 229, 0.25)',
          borderRadius: 16,
          boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                1. Cấu Hình Mẫu Email Đối Soát {activeCarrierName ? `Cho ${activeCarrierName}` : ''}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {activeCarrierName 
                  ? `Mẫu email đối soát tùy biến riêng cho các đơn hàng của hãng ${activeCarrierName}.`
                  : 'Tùy biến nội dung email gửi cho khách hàng.'}
              </div>
            </div>
            {activeCarrierName && (
              <span style={{
                fontSize: 11,
                background: 'rgba(79, 70, 229, 0.1)',
                color: 'var(--primary)',
                padding: '3px 10px',
                borderRadius: 20,
                fontWeight: 700,
              }}>
                🚚 Mẫu Riêng: {activeCarrierName}
              </span>
            )}
          </div>

          {/* Carrier Template Tabs */}
          {!activeCarrierId && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, background: '#f8fafc', padding: 6, borderRadius: 12, border: '1.5px solid #cbd5e1' }}>
              {CARRIER_TABS.map(tab => {
                const isSelected = selectedCarrierTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCarrierTab(tab.id)}
                    className="btn btn-sm"
                    style={{
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: isSelected ? 800 : 600,
                      background: isSelected ? 'var(--primary)' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                      boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="input-group">
            <label className="input-label">
              Tiêu đề Email {activeCarrierName ? `(${activeCarrierName})` : `(${CARRIER_TABS.find(t => t.id === selectedCarrierTab)?.label})`}
            </label>
            <input
              type="text"
              value={activeSubject}
              onChange={(e) => handleUpdateActiveSubject(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="input-label" style={{ marginBottom: 8, display: 'block', fontWeight: 700, color: '#1e293b' }}>
              Chèn biến động nhanh:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { tag: '{TEN_SHOP}', label: 'Tên Shop', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
                { tag: '{KY_DOI_SOAT}', label: 'Kỳ Đối Soát', bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' },
                { tag: '{TONG_DON}', label: 'Tổng Đơn', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
                { tag: '{TONG_COD}', label: 'Tổng COD', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
                { tag: '{TONG_CUOC}', label: 'Tổng Cước', bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
                { tag: '{THUC_TRA}', label: 'Tiền Thực Trả', bg: '#ffe4e6', color: '#be123c', border: '#fecdd3' },
                { tag: '{NGAN_HANG}', label: 'Tên Ngân Hàng', bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd' },
                { tag: '{SO_TAI_KHOAN}', label: 'Số Tài Khoản', bg: '#cff4fc', color: '#055160', border: '#9eeaf9' },
                { tag: '{CHU_TAI_KHOAN}', label: 'Chủ Tài Khoản', bg: '#cff4fc', color: '#055160', border: '#9eeaf9' },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleInsertVariable(item.tag)}
                  className="btn btn-sm"
                  style={{
                    fontSize: 11,
                    padding: '4px 9px',
                    fontWeight: 700,
                    background: item.bg,
                    color: item.color,
                    border: `1px solid ${item.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                  }}
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
            <button onClick={handleSaveSettings} className="btn btn-primary btn-sm" style={{ padding: '7px 14px', fontWeight: 700 }}>
              💾 Lưu Mẫu Email Này
            </button>
          </div>
        </div>

        {/* 2. Interactive Live Preview Panel */}
        <div 
          ref={previewRef}
          id="email-preview-panel"
          className="glass-panel" 
          style={{
            padding: 24,
            background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, rgba(255, 255, 255, 1) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 16,
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.03)',
          }}
        >
          {/* Preview Header & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={18} />
                2. Xem Trước Email (Bản Shop Nhận)
              </h3>
              
              {isMockPreview && (
                <span style={{
                  fontSize: 11,
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Sparkles size={12} /> Mẫu Minh Họa Trực Quan
                </span>
              )}

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

            {/* Shop Selector Dropdown */}
            {statements.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Xem Shop:</span>
                <select
                  value={selectedShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  className="select-field"
                  style={{ width: 240, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}
                >
                  {statements.map((s, idx) => (
                    <option key={s.shopId || idx} value={s.shopId}>
                      {idx + 1}. {s.shopName} ({formatVND(s.totalNetPayout)})
                    </option>
                  ))}
                </select>
              </div>
            ) : displaySessions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Xem kỳ khác:</span>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="select-field"
                  style={{ width: 200, padding: '3px 6px', fontSize: 11 }}
                >
                  {displaySessions.map((ses, idx) => (
                    <option key={ses.id || idx} value={ses.id}>
                      {ses.sessionName || `Kỳ ${ses.id}`} ({ses.statements.length} Shop)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Email Preview Frame */}
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            {/* Subject line header */}
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

            {/* Email Body Preview */}
            {previewMode === 'html' ? (
              <div style={{ padding: 10, background: '#f1f5f9', maxHeight: 420, overflowY: 'auto' }}>
                <iframe
                  title="Email HTML Preview"
                  srcDoc={EmailService.renderHtmlEmail(selectedStatement, settings, currentCarrierId)}
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

            {/* Footer with actions */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              borderTop: '1px dashed var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileSpreadsheet size={15} />
                <span>Đính kèm: Bang_ke_doi_soat_{selectedStatement.shopCode || selectedStatement.shopName}.xlsx</span>
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
        </div>
      </div>

      {/* 3. Queue Table: Shop List & Per-Shop Preview/Send Actions */}
      {statements.length > 0 ? (
        <div className="glass-panel" style={{ padding: 24, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Layers size={18} color="var(--primary)" />
                Danh Sách Hàng Đợi Gửi Mail ({statements.length} Shop)
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Click nút <strong style={{ color: 'var(--primary)' }}>👁️ Xem Trước</strong> ở từng dòng để kiểm tra nội dung email và bảng kê riêng của Shop đó.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-primary" style={{ fontSize: 12 }}>
                ✉️ {statements.length - missingShopEmailsCount}/{statements.length} Shop đã có Email
              </span>
              {missingShopEmailsCount > 0 && (
                <span className="badge badge-warning" style={{ fontSize: 12 }}>
                  ⚠️ {missingShopEmailsCount} Shop chưa có Email
                </span>
              )}
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>STT</th>
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
                const isSelected = stmt.shopId === selectedShopId;
                const isEditing = editingShopId === stmt.shopId;

                return (
                  <tr 
                    key={stmt.shopId || idx}
                    style={{
                      background: isSelected ? 'rgba(79, 70, 229, 0.05)' : undefined,
                      borderLeft: isSelected ? '4px solid var(--primary)' : undefined,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <td>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {stmt.shopName}
                        {isSelected && (
                          <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                            Đang xem
                          </span>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        Mã: {stmt.shopCode}
                      </div>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="text"
                            className="input-field"
                            style={{ padding: '3px 8px', fontSize: 12, width: 220 }}
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
                    <td className="mono" style={{ fontWeight: 700, color: stmt.totalNetPayout >= 0 ? 'var(--success)' : 'var(--danger)' }}>
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
                        
                        {/* Preview This Shop's Email Button */}
                        <button
                          onClick={() => handleSelectShopAndScroll(stmt.shopId)}
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '5px 9px', fontSize: 11, fontWeight: 700 }}
                          title="Xem trước nội dung email của Shop này"
                        >
                          <Eye size={12} />
                          <span>{isSelected ? 'Đang xem' : 'Xem trước'}</span>
                        </button>

                        {/* Send Single Shop Immediately */}
                        <button
                          onClick={async () => {
                            if (hasUnmatchedOrders) {
                              showToast('Không thể gửi bảng kê khi kỳ còn đơn chưa khớp.', 'warning');
                              return;
                            }
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
                              showToast(`Đã gửi mail thành công cho ${stmt.shopName}!`, 'success');
                            } else {
                              setShopStatuses(prev => ({ ...prev, [stmt.shopId]: { status: 'failed', message: res.error } }));
                              showToast(`Gửi thất bại cho ${stmt.shopName}: ${res.error}`, 'error');
                            }
                          }}
                          className="btn btn-primary btn-sm"
                          disabled={hasUnmatchedOrders}
                          style={{ padding: '5px 9px', fontSize: 11 }}
                          title="Gửi ngay cho riêng Shop này qua SMTP"
                        >
                          <Send size={12} />
                          <span>Gửi ngay</span>
                        </button>

                        {/* Download Statement Excel */}
                        <button
                          onClick={() => {
                            if (hasUnmatchedOrders) {
                              showToast('Không thể tải bảng kê khi kỳ còn đơn chưa khớp.', 'warning');
                              return;
                            }
                            ExcelService.downloadShopStatement(stmt);
                          }}
                          className="btn btn-secondary btn-sm"
                          disabled={hasUnmatchedOrders}
                          style={{ padding: '5px 8px' }}
                          title="Tải file Excel bảng kê"
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
      ) : (
        <div className="glass-panel" style={{
          padding: '36px 24px',
          borderRadius: 16,
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(248,250,252,0.9) 0%, rgba(241,245,249,0.9) 100%)',
          border: '1px dashed #cbd5e1'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Mail size={28} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-main)' }}>
            Chưa có kỳ đối soát nào của {activeCarrierName || 'hãng này'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto 16px', lineHeight: 1.5 }}>
            Hệ thống chưa có dữ liệu bảng kê đối soát cho <strong>{activeCarrierName || 'hãng này'}</strong>. Bạn có thể xem trước mẫu email bên trên ngay bây giờ, hoặc vào mục <strong>"Đối Soát Kéo Thả"</strong> để tải file và chạy đối soát cho hãng này.
          </p>
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

      {/* Close Email Tab Container */}
      </div>
      )}

      {/* Zalo ZNS Configuration Modal */}
      {isZaloConfigOpen && (
        <ZaloZnsConfigModal
          settings={zaloSettings}
          onSave={handleSaveZaloSettings}
          onClose={() => setIsZaloConfigOpen(false)}
        />
      )}

    </div>
  );
};
