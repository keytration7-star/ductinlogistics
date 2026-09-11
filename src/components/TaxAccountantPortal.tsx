import React, { useState, useMemo, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { 
  Building2, 
  FileSpreadsheet, 
  Store, 
  Calendar, 
  Download, 
  Archive, 
  Search, 
  LogOut, 
  Eye, 
  X, 
  FileText,
  Truck,
  ArrowRight,
  Package,
  Layers,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Globe,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  UploadCloud,
  RefreshCw,
  FileUp
} from 'lucide-react';
import { useToast, useConfirm } from './UIFeedback';
import { getCarrierTheme } from './CarrierHubDashboard';
import { StorageService } from '../services/storage';
import { getCleanCarrierTag, ExcelService } from '../services/excelService';
import { calculateWeightFee, findRegisteredShop } from '../services/reconciliationService';
import { normalizeHeader } from '../services/smartColumnDetector';
import type { 
  ReconciliationSession, 
  Shop, 
  UserAccount, 
  ReconciledOrder, 
  ShopSettlementStatement,
  CarrierWholesaleTier
} from '../types';

interface TaxAccountantPortalProps {
  currentUser: UserAccount;
  carriers: CarrierWholesaleTier[];
  sessions: ReconciliationSession[];
  shops: Shop[];
  onLogout: () => void;
}


const SoftwareDeveloperFooter: React.FC = () => (
  <footer style={{
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    background: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid #e2e8f0',
    padding: '7px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)',
    fontSize: 12,
  }}>
    <div style={{
      maxWidth: 1600,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 12,
    }}>
      {/* Badge TQ */}
      <div style={{
        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
        color: '#ffffff',
        fontWeight: 900,
        fontSize: 10.5,
        padding: '2px 7px',
        borderRadius: 5,
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
      }}>
        TQ
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted, #64748b)' }}>Phát triển bởi:</span>
        <strong style={{ color: '#1e293b', fontWeight: 800 }}>CÔNG TY TNHH MTV CÔNG NGHỆ VÀ THƯƠNG MẠI TQ DIGITAL</strong>
      </div>

      <span style={{ color: '#cbd5e1' }}>|</span>

      <span style={{ color: '#475569' }}>Thôn Đại Lai 1, Trần Hưng Đạo, Hưng Yên</span>

      <span style={{ color: '#cbd5e1' }}>|</span>

      <a
        href="tel:0936833319"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: '#4f46e5',
          fontWeight: 800,
          textDecoration: 'none',
        }}
      >
        <span>📞</span>
        <span>09368.333.19</span>
      </a>
    </div>
  </footer>
);

// Common Excel Styling Helpers
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'double', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

export const TaxAccountantPortal: React.FC<TaxAccountantPortalProps> = ({
  currentUser,
  carriers = [],
  sessions = [],
  shops = [],
  onLogout,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  // ──────────────────────────────────────────
  // 🧭 TAX PORTAL URL ROUTER (SAAS / FB-STYLE DYNAMIC URLS)
  // ──────────────────────────────────────────
  const parseTaxRoute = () => {
    const path = window.location.pathname.toLowerCase();
    const search = new URLSearchParams(window.location.search);
    const segments = path.split('/').filter(Boolean);

    let carrierId: string | null = null;
    let tab: 'sessions' | 'shops' | 'monthly' | 'outbound' = 'sessions';
    let sessId: string | null = search.get('session_id') || null;

    if (segments[0] === 'tax-portal' || segments[0] === 'tax') {
      if (segments[1] === 'carrier' && segments[2]) {
        carrierId = segments[2];
      } else if (segments[1] === 'hub') {
        carrierId = null;
      }
    }

    if (search.has('tab')) {
      const t = search.get('tab');
      if (t === 'shops' || t === 'monthly' || t === 'sessions' || t === 'outbound') tab = t;
    }

    return { carrierId, tab, sessId };
  };

  const initialTaxRoute = parseTaxRoute();

  // Active carrier selection: null = Hub view (select carrier card), 'all' | carrierId = inside carrier workspace
  const [activeCarrierId, setActiveCarrierId] = useState<string | null>(initialTaxRoute.carrierId);
  const [activeTab, setActiveTab] = useState<'sessions' | 'shops' | 'monthly' | 'outbound'>(initialTaxRoute.tab);
  const [searchQuery, setSearchQuery] = useState('');
  const [hubSearchTerm, setHubSearchTerm] = useState('');

  // ──────────────────────────────────────────
  // 📦 TAB 4: BÁO CÁO CƯỚC ĐƠN GỬI THÁNG (FILE APP) STATE
  // ──────────────────────────────────────────
  const [outboundFile, setOutboundFile] = useState<File | null>(null);
  const [isParsingOutbound, setIsParsingOutbound] = useState(false);
  const [outboundSelectedMonth, setOutboundSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}`;
  });
  const [outboundRawRows, setOutboundRawRows] = useState<Record<string, any>[]>([]);
  const [outboundOrders, setOutboundOrders] = useState<any[]>([]);
  const [outboundSubTab, setOutboundSubTab] = useState<'shops' | 'orders'>('shops');
  const [outboundSearchQuery, setOutboundSearchQuery] = useState('');
  const [outboundShopFilter, setOutboundShopFilter] = useState('ALL');
  const [outboundPage, setOutboundPage] = useState(1);
  const [isDraggingOutbound, setIsDraggingOutbound] = useState(false);
  const [outboundVatRate, setOutboundVatRate] = useState<number>(8);
  const [outboundInvoiceRefCode, setOutboundInvoiceRefCode] = useState<string>('');
  
  // Selected session for viewing details modal
  const [selectedSession, setSelectedSession] = useState<ReconciliationSession | null>(null);
  const [selectedShopStmt, setSelectedShopStmt] = useState<ShopSettlementStatement | null>(null);

  // Selected session ID for Master-Detail Split Screen in Tab 1
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialTaxRoute.sessId);

  // 🌐 Bidirectional URL Sync for Tax Portal
  useEffect(() => {
    let targetPath = '/tax-portal';
    if (!activeCarrierId) {
      targetPath = '/tax-portal/hub';
    } else {
      targetPath = `/tax-portal/carrier/${activeCarrierId}`;
    }

    const queryParams = new URLSearchParams();
    if (activeCarrierId) {
      queryParams.set('tab', activeTab);
      if (selectedSessionId) {
        queryParams.set('session_id', selectedSessionId);
      }
    }

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const fullUrl = `${targetPath}${queryString}`;

    if (window.location.pathname + window.location.search !== fullUrl) {
      window.history.pushState(null, '', fullUrl);
    }
  }, [activeCarrierId, activeTab, selectedSessionId]);

  // 🔄 Browser Back / Forward Button Handling for Tax Portal
  useEffect(() => {
    const handlePopState = () => {
      const route = parseTaxRoute();
      setActiveCarrierId(route.carrierId);
      setActiveTab(route.tab);
      if (route.sessId) {
        setSelectedSessionId(route.sessId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 🔄 Always guarantee fresh fallback data from StorageService even if props are momentarily empty
  const effectiveSessions = useMemo(() => {
    if (sessions && sessions.length > 0) return sessions;
    return StorageService.getSessions();
  }, [sessions]);

  // 📦 Full session order cache for detailed tax ledger & export
  const [fullSessionsMap, setFullSessionsMap] = useState<Record<string, ReconciliationSession>>({});

  useEffect(() => {
    let isMounted = true;
    const loadFullSessions = async () => {
      const neededSessions = effectiveSessions.filter(s => {
        const full = fullSessionsMap[s.id];
        const hasOrders = full?.statements?.some(st => (st.orders?.length || 0) > 0);
        return !hasOrders;
      });

      if (neededSessions.length === 0) return;

      for (const sess of neededSessions) {
        try {
          const detail = await StorageService.getSessionDetail(sess.id);
          if (detail && isMounted) {
            setFullSessionsMap(prev => ({
              ...prev,
              [sess.id]: detail
            }));
          }
        } catch (e) {
          console.warn('[TaxAccountantPortal] Failed to load session detail:', sess.id, e);
        }
      }
    };

    loadFullSessions();
    return () => { isMounted = false; };
  }, [effectiveSessions]);

  const detailedSessions = useMemo(() => {
    return effectiveSessions.map(sess => {
      const detailed = fullSessionsMap[sess.id];
      if (detailed && detailed.statements && detailed.statements.some(st => (st.orders?.length || 0) > 0)) {
        return detailed;
      }
      return sess;
    });
  }, [effectiveSessions, fullSessionsMap]);

  const effectiveShops = useMemo(() => {
    if (shops && shops.length > 0) return shops;
    return StorageService.getShops();
  }, [shops]);

  const effectiveCarriers = useMemo(() => {
    if (carriers && carriers.length > 0) return carriers;
    return StorageService.getCarriers();
  }, [carriers]);

  // 📅 Intelligent Default Month/Year: Detect latest available session date, fallback to today
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const latestSessDate = useMemo(() => {
    if (!effectiveSessions || effectiveSessions.length === 0) return new Date();
    const sorted = effectiveSessions.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return new Date(sorted[0].createdAt || Date.now());
  }, [effectiveSessions]);

  const initMonth = latestSessDate.getMonth() + 1;
  const initYear = latestSessDate.getFullYear();
  const initStart = `${initYear}-${String(initMonth).padStart(2, '0')}-01`;
  const initLastDay = new Date(initYear, initMonth, 0).getDate();
  const initEnd = `${initYear}-${String(initMonth).padStart(2, '0')}-${String(initLastDay).padStart(2, '0')}`;

  const [fromDate, setFromDate] = useState<string>(initStart);
  const [toDate, setToDate] = useState<string>(initEnd);
  const [selectedMonth, setSelectedMonth] = useState<number>(initMonth);
  const [selectedYear, setSelectedYear] = useState<number>(initYear);
  const [vatRate, setVatRate] = useState<number>(8); // 8% Default VAT for logistics/transport
  const [invoiceRefCode, setInvoiceRefCode] = useState<string>('');
  
  // Modal for viewing detailed monthly orders of a specific shop
  const [viewingShopOrders, setViewingShopOrders] = useState<{
    shopId: string;
    shopCode: string;
    shopName: string;
    phone: string;
    bankInfo: string;
    totalOrders: number;
    totalCod: number;
    totalServiceFee: number;
    totalNetPayout: number;
    orders: any[];
  } | null>(null);
  const [modalOrderSearch, setModalOrderSearch] = useState<string>('');

  // Sub-view toggle in Monthly Tab ('shops' summary breakdown or 'orders' raw full ledger)
  const [monthlySubTab, setMonthlySubTab] = useState<'shops' | 'orders'>('shops');
  const [monthlyOrderSearch, setMonthlyOrderSearch] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPage, setOrderPage] = useState<number>(1);
  const ordersPerPage = 50;

  const applyMonthYear = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setFromDate(start);
    setToDate(end);
    setOrderPage(1);
  };

  // 📊 Discovered months that have actual reconciliation sessions
  const availableDataMonths = useMemo(() => {
    const monthMap = new Map<string, { month: number; year: number; label: string; orderCount: number; sessionCount: number }>();
    effectiveSessions.forEach(s => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (s.carrierId || 'jnt') === activeCarrierId;
      if (!matchCarrier) return;
      const d = new Date(s.createdAt);
      if (!isNaN(d.getTime())) {
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const key = `${y}-${m}`;
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            month: m,
            year: y,
            label: `Tháng ${m < 10 ? '0' + m : m}/${y}`,
            orderCount: 0,
            sessionCount: 0,
          });
        }
        const item = monthMap.get(key)!;
        item.orderCount += (s.totalOrders || 0);
        item.sessionCount += 1;
      }
    });
    return Array.from(monthMap.values()).sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
  }, [effectiveSessions, activeCarrierId]);

  // 🔄 Auto-select latest month with data if current selection has 0 sessions/orders
  useEffect(() => {
    if (availableDataMonths.length > 0) {
      const currentHasData = availableDataMonths.some(d => d.month === selectedMonth && d.year === selectedYear);
      if (!currentHasData) {
        const bestMonth = availableDataMonths[0];
        applyMonthYear(bestMonth.month, bestMonth.year);
      }
    }
  }, [availableDataMonths, selectedMonth, selectedYear]);

  // Compute live statistics per carrier for the Hub cards
  const carrierStats = useMemo(() => {
    const statsMap = new Map<string, { shopCount: number; sessionCount: number; orderCount: number; totalCod: number; totalServiceFee: number; totalNetPayout: number; lastSessionDate?: string }>();

    effectiveCarriers.forEach(c => {
      const cShops = effectiveShops.filter(s => (s.carrierId || 'jnt') === c.carrierId);
      const cSessions = effectiveSessions.filter(sess => (sess.carrierId || 'jnt') === c.carrierId);
      const totalOrders = cSessions.reduce((sum, s) => sum + (s.totalOrders || 0), 0);
      const totalCod = cSessions.reduce((sum, s) => sum + (s.totalCod || 0), 0);
      const totalServiceFee = cSessions.reduce((sum, s) => sum + (s.totalShopRevenue || 0), 0);
      const totalNetPayout = cSessions.reduce((sum, s) => sum + (s.totalNetPayout || 0), 0);
      
      const lastSession = cSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      statsMap.set(c.carrierId, {
        shopCount: cShops.length,
        sessionCount: cSessions.length,
        orderCount: totalOrders,
        totalCod,
        totalServiceFee,
        totalNetPayout,
        lastSessionDate: lastSession ? lastSession.createdAt : undefined,
      });
    });

    return statsMap;
  }, [effectiveCarriers, effectiveShops, effectiveSessions]);

  // Active carrier metadata
  const activeCarrierObj = useMemo(() => {
    if (!activeCarrierId || activeCarrierId === 'all') return null;
    return effectiveCarriers.find(c => c.carrierId === activeCarrierId) || {
      id: activeCarrierId,
      carrierId: activeCarrierId,
      carrierName: activeCarrierId.toUpperCase(),
    };
  }, [effectiveCarriers, activeCarrierId]);

  // Filtered carriers for Hub
  const filteredCarriers = useMemo(() => {
    if (!hubSearchTerm) return effectiveCarriers;
    const term = hubSearchTerm.toLowerCase();
    return effectiveCarriers.filter(c => 
      c.carrierName.toLowerCase().includes(term) || 
      c.carrierId.toLowerCase().includes(term)
    );
  }, [effectiveCarriers, hubSearchTerm]);

  // Filtered sessions for the selected carrier
  const filteredSessions = useMemo(() => {
    return effectiveSessions.filter(sess => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (sess.carrierId || 'jnt') === activeCarrierId;
      const name = sess.sessionName || '';
      const matchSearch = !searchQuery || 
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sess.carrierId ? sess.carrierId.toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
        (sess.carrierName ? sess.carrierName.toLowerCase().includes(searchQuery.toLowerCase()) : false);
      return matchCarrier && matchSearch;
    });
  }, [effectiveSessions, activeCarrierId, searchQuery]);

  // Active selected session for Tab 1 Detail panel
  const activeDetailSession = useMemo(() => {
    if (selectedSessionId) {
      const found = filteredSessions.find(s => s.id === selectedSessionId);
      if (found) return found;
    }
    return filteredSessions[0] || null;
  }, [filteredSessions, selectedSessionId]);

  // Filtered shops for the selected carrier
  const filteredShops = useMemo(() => {
    return effectiveShops.filter(s => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (s.carrierId || 'jnt') === activeCarrierId;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.bankAccount?.accountNumber && s.bankAccount.accountNumber.includes(q));
      return matchCarrier && matchSearch;
    });
  }, [effectiveShops, activeCarrierId, searchQuery]);

  // Aggregated data for Monthly/Quarterly report for the selected carrier
  const monthlyAggregatedData = useMemo(() => {
    const fromTime = new Date(fromDate + 'T00:00:00').getTime();
    const toTime = new Date(toDate + 'T23:59:59').getTime();

    const inRangeSessions = detailedSessions.filter(sess => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (sess.carrierId || 'jnt') === activeCarrierId;
      
      const sessDateStr = (sess.createdAt || '').slice(0, 10);
      const isDateInRange = sessDateStr >= fromDate && sessDateStr <= toDate;

      const sessTime = new Date(sess.createdAt).getTime();
      const isTimeInRange = !isNaN(sessTime) && sessTime >= fromTime && sessTime <= toTime;

      return matchCarrier && (isDateInRange || isTimeInRange);
    });

    let totalOrders = 0;
    let totalCod = 0;
    let totalServiceRevenue = 0;
    let totalNetPayout = 0;

    const shopMap = new Map<string, {
      shopId: string;
      shopCode: string;
      shopName: string;
      phone: string;
      bankInfo: string;
      sessionCount: number;
      totalOrders: number;
      totalCod: number;
      totalServiceFee: number;
      totalNetPayout: number;
      orders: any[];
    }>();

    inRangeSessions.forEach(sess => {
      totalOrders += (sess.totalOrders || 0);
      totalCod += (sess.totalCod || 0);
      totalServiceRevenue += (sess.totalShopRevenue || 0);
      totalNetPayout += (sess.totalNetPayout || 0);

      (sess.statements || []).forEach(stmt => {
        const key = stmt.shopId || stmt.shopName;
        if (!shopMap.has(key)) {
          const shopObj = effectiveShops.find(s => s.id === stmt.shopId || s.name === stmt.shopName);
          const bankStr = shopObj?.bankAccount?.accountNumber 
            ? `${shopObj.bankAccount.bankName || ''} - ${shopObj.bankAccount.accountNumber} (${shopObj.bankAccount.accountHolder || ''})`
            : (stmt.bankInfo?.accountNumber ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber}` : 'Chưa cập nhật');

          shopMap.set(key, {
            shopId: stmt.shopId,
            shopCode: stmt.shopCode || shopObj?.code || '-',
            shopName: stmt.shopName,
            phone: stmt.shopPhone || shopObj?.phone || '-',
            bankInfo: bankStr,
            sessionCount: 0,
            totalOrders: 0,
            totalCod: 0,
            totalServiceFee: 0,
            totalNetPayout: 0,
            orders: [],
          });
        }

        const sData = shopMap.get(key)!;
        sData.sessionCount += 1;
        sData.totalOrders += (stmt.totalOrders || 0);
        sData.totalCod += (stmt.totalCod || 0);
        sData.totalServiceFee += ((stmt.totalShopFee || 0) + (stmt.totalShopOtherFee || 0));
        sData.totalNetPayout += (stmt.totalNetPayout || 0);

        // Robust order extraction: stmt.orders -> sess.reconciledRows -> sess.orders
        let stmtOrders: any[] = stmt.orders || [];
        if (stmtOrders.length === 0 && Array.isArray((sess as any).reconciledRows)) {
          stmtOrders = (sess as any).reconciledRows.filter((r: any) =>
            (r.shopId && (r.shopId === stmt.shopId || r.shopId === sData.shopId)) ||
            (r.shopName && (r.shopName === stmt.shopName || r.shopName === sData.shopName))
          );
        }
        if (stmtOrders.length === 0 && Array.isArray((sess as any).orders)) {
          stmtOrders = (sess as any).orders.filter((r: any) =>
            (r.shopId && (r.shopId === stmt.shopId || r.shopId === sData.shopId)) ||
            (r.shopName && (r.shopName === stmt.shopName || r.shopName === sData.shopName))
          );
        }

        stmtOrders.forEach(ord => {
          sData.orders.push({
            ...ord,
            sessionName: sess.sessionName,
            sessionDate: sess.createdAt,
            carrierName: sess.carrierName || sess.carrierId || 'NVC',
            shopName: stmt.shopName || sData.shopName,
            shopCode: sData.shopCode,
          });
        });
      });
    });

    const shopBreakdown = Array.from(shopMap.values()).sort((a, b) => b.totalOrders - a.totalOrders);
    let allMonthlyOrders = shopBreakdown.flatMap(s => s.orders);

    // Fallback extraction if stmt.orders were not distributed by shop
    if (allMonthlyOrders.length === 0 && inRangeSessions.length > 0) {
      inRangeSessions.forEach(sess => {
        const rawRows = (sess as any).orders || (sess as any).reconciledRows || (sess as any).unmatchedOrders || [];
        rawRows.forEach((ord: any) => {
          allMonthlyOrders.push({
            ...ord,
            sessionName: sess.sessionName,
            sessionDate: sess.createdAt,
            carrierName: sess.carrierName || sess.carrierId || 'NVC',
            shopName: ord.shopName || 'Khách hàng',
            shopCode: ord.shopCode || '-',
          });
        });
      });
    }

    return {
      sessionCount: inRangeSessions.length,
      totalOrders,
      totalCod,
      totalServiceRevenue,
      totalNetPayout,
      shopBreakdown,
      allMonthlyOrders,
    };
  }, [detailedSessions, effectiveShops, activeCarrierId, fromDate, toDate]);

  // Helper to add Corporate Header to any worksheet
  const addCorporateHeader = (
    ws: ExcelJS.Worksheet,
    title: string,
    subtitle: string,
    numCols: number
  ) => {
    // 🌟 Bỏ ô lưới (showGridLines = false) để báo cáo phẳng sạch sẽ
    ws.views = [{ showGridLines: false }];

    const company = StorageService.getCompanyInfo();
    const companyTitle = (company.companyName || 'CÔNG TY LOGISTICS & VẬN TẢI ENTERPRISE').toUpperCase();
    const companySub = `Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`;

    // Row 1: Company Title (Gộp ô, In Đậm, Nền Xám Nhẹ, Chữ Xanh Navy)
    const r1 = ws.addRow([companyTitle]);
    ws.mergeCells(1, 1, 1, numCols);
    r1.height = 30;
    r1.getCell(1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF1E3A8A' } };
    r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    // Row 2: Company Subtitle
    const r2 = ws.addRow([companySub]);
    ws.mergeCells(2, 1, 2, numCols);
    r2.height = 20;
    r2.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    r2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    // Row 3: Report Title (Gộp ô, In đậm, Màu Tím Đậm / Indigo)
    const r3 = ws.addRow([title]);
    ws.mergeCells(3, 1, 3, numCols);
    r3.height = 26;
    r3.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF4338CA' } };
    r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: Subtitle / Period
    const r4 = ws.addRow([subtitle]);
    ws.mergeCells(4, 1, 4, numCols);
    r4.height = 20;
    r4.getCell(1).font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF334155' } };
    r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 5: Empty space
    const r5 = ws.addRow([]);
    r5.height = 10;
  };

  // Helper to format table headers
  const formatTableHeader = (row: ExcelJS.Row) => {
    row.height = 26;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = THIN_BORDER;
    });
  };

  // Helper to auto-fit column widths
  const autoFitColumns = (ws: ExcelJS.Worksheet, minWidths: number[] = []) => {
    ws.columns.forEach((col, idx) => {
      let maxLen = minWidths[idx] || 12;
      col.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber > 5) { // Skip merged title rows
          const cellLen = cell.value ? String(cell.value).length : 0;
          if (cellLen > maxLen) maxLen = cellLen;
        }
      });
      col.width = Math.min(Math.max(maxLen + 4, minWidths[idx] || 12), 48);
    });
  };

  // --------------------------------------------------------------------------
  // EXPORT 1: Multi-Sheet Professional Excel for Single Session
  // --------------------------------------------------------------------------
  const exportSessionMultiSheet = async (session: ReconciliationSession) => {
    try {
      showToast('Đang tạo file Excel báo cáo tổng hợp đa Sheet...', 'info');
      const workbook = new ExcelJS.Workbook();
      const sessTitle = session.sessionName || 'Kỳ đối soát';
      const carrierName = (session.carrierName || session.carrierId || 'jnt').toUpperCase();

      // ==========================================
      // SHEET 1: TỔNG HỢP CÁC SHOP
      // ==========================================
      const wsSummary = workbook.addWorksheet('TONG_HOP_CAC_SHOP');
      const summaryHeaders = [
        'STT', 
        'Mã Shop', 
        'Tên Shop / Khách Hàng', 
        'Số Điện Thoại', 
        'Tài Khoản Ngân Hàng', 
        'Số Đơn', 
        'Tổng COD Thu Hộ (VNĐ)', 
        'Doanh Thu Cước Dịch Vụ (VNĐ)', 
        'Thực Trả Khách Hàng (VNĐ)'
      ];

      addCorporateHeader(
        wsSummary,
        'BẢNG TỔNG HỢP ĐỐI SOÁT DOANH THU & COD KHÁCH HÀNG (BÁO CÁO THUẾ)',
        `Kỳ đối soát: ${sessTitle} | Hãng vận chuyển: ${carrierName} | Ngày lập: ${new Date(session.createdAt).toLocaleDateString('vi-VN')}`,
        summaryHeaders.length
      );

      // Header Row
      const hRow = wsSummary.addRow(summaryHeaders);
      formatTableHeader(hRow);

      // Data Rows
      (session.statements || []).forEach((stmt, idx) => {
        const bankStr = stmt.bankInfo?.accountNumber 
          ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber} (${stmt.bankInfo.accountHolder || ''})`
          : 'Chưa cập nhật';

        const row = wsSummary.addRow([
          idx + 1,
          stmt.shopCode || '-',
          stmt.shopName,
          stmt.shopPhone || '-',
          bankStr,
          stmt.totalOrders,
          stmt.totalCod,
          stmt.totalShopFee + stmt.totalShopOtherFee,
          stmt.totalNetPayout
        ]);

        row.height = 22;
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
          cell.border = THIN_BORDER;

          // STT
          if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          // Mã Shop, SĐT
          else if (colNum === 2 || colNum === 4) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          // Tên Shop, Ngân hàng
          else if (colNum === 3 || colNum === 5) cell.alignment = { horizontal: 'left', vertical: 'middle' };
          // Số đơn
          else if (colNum === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.numFmt = '#,##0';
          }
          // Các cột tiền: Định dạng VNĐ
          else if (colNum >= 7) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });
      });

      // 🌟 HÀNG TỔNG CỘNG: Tô chữ đỏ nền vàng rực rỡ theo yêu cầu!
      const totalRow = wsSummary.addRow([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        session.totalOrders,
        session.totalCod,
        session.totalShopRevenue || 0,
        session.totalNetPayout
      ]);

      const totalRowNum = totalRow.number;
      wsSummary.mergeCells(totalRowNum, 1, totalRowNum, 5);
      totalRow.height = 26;

      totalRow.eachCell((cell, colNum) => {
        // Nền vàng tươi + Chữ đỏ in đậm
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
        cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFDC2626' } };
        cell.border = TOTAL_BORDER;

        if (colNum === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.numFmt = '#,##0';
        } else if (colNum >= 7) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      autoFitColumns(wsSummary, [8, 14, 26, 16, 32, 12, 22, 22, 22]);

      // ==========================================
      // SHEETS 2..N: CHI TIẾT TỪNG SHOP
      // ==========================================
      (session.statements || []).forEach((stmt) => {
        const cleanSheetName = (stmt.shopName || 'Shop')
          .replace(/[\\/*?:[\]]/g, '')
          .slice(0, 30);

        const wsShop = workbook.addWorksheet(cleanSheetName);
        const shopHeaders = [
          'STT', 
          'Mã Vận Đơn', 
          'Người Nhận', 
          'Số Điện Thoại', 
          'Địa Chỉ Nhận', 
          'Ngày Tạo / Gửi', 
          'Trạng Thái', 
          'Tiền COD (VNĐ)', 
          'Cước Dịch Vụ (VNĐ)', 
          'Thực Nhận (VNĐ)'
        ];

        const shopSub = `Khách hàng: ${stmt.shopName.toUpperCase()} | Mã: ${stmt.shopCode || '-'} | SĐT: ${stmt.shopPhone || '-'} | Kỳ: ${sessTitle}`;
        addCorporateHeader(
          wsShop,
          `BẢNG KÊ CHI TIẾT ĐỐI SOÁT - ${stmt.shopName.toUpperCase()}`,
          shopSub,
          shopHeaders.length
        );

        // Header
        const sHeaderRow = wsShop.addRow(shopHeaders);
        formatTableHeader(sHeaderRow);

        // Data Rows
        (stmt.orders || []).forEach((ord: ReconciledOrder, oIdx: number) => {
          const dateStr = ord.rawNvcData?.['Ngày tạo'] || ord.rawNvcData?.['Ngày gửi'] || ord.rawAppData?.['Ngày tạo'] || '-';
          const r = wsShop.addRow([
            oIdx + 1,
            ord.waybill,
            ord.receiverName || '-',
            ord.receiverPhone || '-',
            ord.receiverAddress || '-',
            dateStr,
            ord.statusText || ord.status,
            ord.codAmount,
            ord.shopCalculatedFee + ord.shopOtherFee,
            ord.netShopPayout
          ]);

          r.height = 22;
          r.eachCell((cell, colNum) => {
            cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
            cell.border = THIN_BORDER;

            if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colNum === 2 || colNum === 4 || colNum === 6 || colNum === 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colNum === 3 || colNum === 5) cell.alignment = { horizontal: 'left', vertical: 'middle' };
            else if (colNum >= 8) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '#,##0 "đ"';
            }
          });
        });

        // 🌟 HÀNG TỔNG CỘNG CHO TỪNG SHOP: Nền vàng chữ đỏ
        const shopTotalRow = wsShop.addRow([
          'TỔNG CỘNG',
          '',
          '',
          '',
          '',
          '',
          `${stmt.totalOrders} đơn`,
          stmt.totalCod,
          stmt.totalShopFee + stmt.totalShopOtherFee,
          stmt.totalNetPayout
        ]);

        const sTotalRowNum = shopTotalRow.number;
        wsShop.mergeCells(sTotalRowNum, 1, sTotalRowNum, 6);
        shopTotalRow.height = 26;

        shopTotalRow.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
          cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFDC2626' } };
          cell.border = TOTAL_BORDER;

          if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum >= 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });

        autoFitColumns(wsShop, [8, 18, 20, 16, 28, 16, 16, 18, 18, 18]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeName = sessTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      saveAs(new Blob([buffer]), `Bao_Cao_Thue_Tong_Hop_${safeName}.xlsx`);
      showToast('Đã tải thành công file báo cáo tổng hợp đa Sheet cực đẹp!', 'success');
    } catch (err: any) {
      showToast('Lỗi khi xuất file Excel: ' + (err?.message || err), 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 2: Single Shop Professional Excel File
  // --------------------------------------------------------------------------
  const exportSingleShopExcel = async (sessionName: string, stmt: ShopSettlementStatement) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('BIEN_BAN_DOI_SOAT');
      const headers = [
        'STT', 
        'Mã Vận Đơn', 
        'Người Nhận', 
        'Số Điện Thoại', 
        'Địa Chỉ Nhận', 
        'Ngày Tạo / Gửi', 
        'Trạng Thái', 
        'Tiền COD (VNĐ)', 
        'Cước Phí (VNĐ)', 
        'Thực Nhận (VNĐ)'
      ];

      const bankStr = stmt.bankInfo?.accountNumber 
        ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber} (${stmt.bankInfo.accountHolder || ''})`
        : 'Chưa cập nhật';

      addCorporateHeader(
        ws,
        `BIÊN BẢN ĐỐI SOÁT DOANH THU & TIỀN THU HỘ (COD)`,
        `Khách hàng: ${stmt.shopName.toUpperCase()} | SĐT: ${stmt.shopPhone || '-'} | TK nhận: ${bankStr} | Kỳ: ${sessionName}`,
        headers.length
      );

      // Header Row
      const hRow = ws.addRow(headers);
      formatTableHeader(hRow);

      // Data Rows
      (stmt.orders || []).forEach((ord: ReconciledOrder, idx: number) => {
        const dateStr = ord.rawNvcData?.['Ngày tạo'] || ord.rawNvcData?.['Ngày gửi'] || ord.rawAppData?.['Ngày tạo'] || '-';
        const r = ws.addRow([
          idx + 1,
          ord.waybill,
          ord.receiverName || '-',
          ord.receiverPhone || '-',
          ord.receiverAddress || '-',
          dateStr,
          ord.statusText || ord.status,
          ord.codAmount,
          ord.shopCalculatedFee + ord.shopOtherFee,
          ord.netShopPayout
        ]);

        r.height = 22;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
          cell.border = THIN_BORDER;

          if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 2 || colNum === 4 || colNum === 6 || colNum === 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 3 || colNum === 5) cell.alignment = { horizontal: 'left', vertical: 'middle' };
          else if (colNum >= 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });
      });

      // 🌟 HÀNG TỔNG CỘNG: Nền vàng chữ đỏ
      const totalRow = ws.addRow([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        '',
        `${stmt.totalOrders} đơn`,
        stmt.totalCod,
        stmt.totalShopFee + stmt.totalShopOtherFee,
        stmt.totalNetPayout
      ]);

      const totalRowNum = totalRow.number;
      ws.mergeCells(totalRowNum, 1, totalRowNum, 6);
      totalRow.height = 26;

      totalRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
        cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFDC2626' } };
        cell.border = TOTAL_BORDER;

        if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum === 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum >= 8) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      autoFitColumns(ws, [8, 18, 20, 16, 28, 16, 16, 18, 18, 18]);

      const buffer = await workbook.xlsx.writeBuffer();
      const safeShop = stmt.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      saveAs(new Blob([buffer]), `BBDS_${safeShop}_${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      showToast(`Đã xuất biên bản cho Shop ${stmt.shopName}!`, 'success');
    } catch (err: any) {
      showToast('Lỗi khi xuất file: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 3: ZIP Package containing all styled shop files
  // --------------------------------------------------------------------------
  const exportSessionZipPackage = async (session: ReconciliationSession) => {
    try {
      showToast('Đang tạo gói file ZIP trọn bộ các Shop...', 'info');
      const zip = new JSZip();
      const sessTitle = session.sessionName || 'Kỳ đối soát';

      for (const stmt of session.statements || []) {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('BIEN_BAN_DOI_SOAT');
        const headers = [
          'STT', 
          'Mã Vận Đơn', 
          'Người Nhận', 
          'Số Điện Thoại', 
          'Địa Chỉ Nhận', 
          'Ngày Tạo / Gửi', 
          'Trạng Thái', 
          'Tiền COD (VNĐ)', 
          'Cước Phí (VNĐ)', 
          'Thực Nhận (VNĐ)'
        ];

        const bankStr = stmt.bankInfo?.accountNumber 
          ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber} (${stmt.bankInfo.accountHolder || ''})`
          : 'Chưa cập nhật';

        addCorporateHeader(
          ws,
          `BIÊN BẢN ĐỐI SOÁT DỊCH VỤ VẬN CHUYỂN`,
          `Khách hàng: ${stmt.shopName.toUpperCase()} | SĐT: ${stmt.shopPhone || '-'} | TK: ${bankStr} | Kỳ: ${sessTitle}`,
          headers.length
        );

        const hRow = ws.addRow(headers);
        formatTableHeader(hRow);

        (stmt.orders || []).forEach((ord: ReconciledOrder, idx: number) => {
          const dateStr = ord.rawNvcData?.['Ngày tạo'] || ord.rawNvcData?.['Ngày gửi'] || ord.rawAppData?.['Ngày tạo'] || '-';
          const r = ws.addRow([
            idx + 1,
            ord.waybill,
            ord.receiverName || '-',
            ord.receiverPhone || '-',
            ord.receiverAddress || '-',
            dateStr,
            ord.statusText || ord.status,
            ord.codAmount,
            ord.shopCalculatedFee + ord.shopOtherFee,
            ord.netShopPayout
          ]);

          r.height = 22;
          r.eachCell((cell, colNum) => {
            cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
            cell.border = THIN_BORDER;

            if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colNum === 2 || colNum === 4 || colNum === 6 || colNum === 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colNum === 3 || colNum === 5) cell.alignment = { horizontal: 'left', vertical: 'middle' };
            else if (colNum >= 8) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '#,##0 "đ"';
            }
          });
        });

        // Hàng tổng nền vàng chữ đỏ
        const totalRow = ws.addRow([
          'TỔNG CỘNG',
          '',
          '',
          '',
          '',
          '',
          `${stmt.totalOrders} đơn`,
          stmt.totalCod,
          stmt.totalShopFee + stmt.totalShopOtherFee,
          stmt.totalNetPayout
        ]);

        const totalRowNum = totalRow.number;
        ws.mergeCells(totalRowNum, 1, totalRowNum, 6);
        totalRow.height = 26;

        totalRow.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
          cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFDC2626' } };
          cell.border = TOTAL_BORDER;

          if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 7) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum >= 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });

        autoFitColumns(ws, [8, 18, 20, 16, 28, 16, 16, 18, 18, 18]);

        const buffer = await workbook.xlsx.writeBuffer();
        const safeShop = stmt.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
        const carrierTag = getCleanCarrierTag(session.carrierId, session.carrierName);
        zip.file(`BBDS_${carrierTag}_${safeShop}.xlsx`, buffer);
      }

      const carrierTag = getCleanCarrierTag(session.carrierId, session.carrierName);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Goi_File_Doi_Soat_${carrierTag}_${sessTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
      showToast('Đã tải thành công trọn bộ file ZIP đóng khung chuyên nghiệp!', 'success');
    } catch (err: any) {
      showToast('Lỗi nén file ZIP: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 4: Flat Data Table for MISA / FAST Accounting Software Import
  // --------------------------------------------------------------------------
  const exportFlatMisaData = async (session: ReconciliationSession) => {
    try {
      const sessTitle = session.sessionName || 'Kỳ đối soát';
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('DU_LIEU_MISA');

      const headers = [
        'Mã Chứng Từ',
        'Ngày Hạch Toán',
        'Mã Khách Hàng',
        'Tên Khách Hàng',
        'Mã Vận Đơn',
        'Người Nhận',
        'SĐT Người Nhận',
        'Địa Chỉ Giao',
        'Trạng Thái Đơn',
        'Tiền COD Thu Hộ (TK 1388)',
        'Doanh Thu Cước (TK 5113)',
        'Thực Chuyển Trả (TK 3388)'
      ];

      addCorporateHeader(
        ws,
        `BẢNG DỮ LIỆU ĐỐI SOÁT IMPORT PHẦN MỀM KẾ TOÁN (MISA / FAST)`,
        `Kỳ đối soát: ${sessTitle} | Ngày tạo: ${new Date(session.createdAt).toLocaleDateString('vi-VN')}`,
        headers.length
      );

      const hRow = ws.addRow(headers);
      formatTableHeader(hRow);

      (session.statements || []).forEach(stmt => {
        (stmt.orders || []).forEach((ord: ReconciledOrder) => {
          const r = ws.addRow([
            sessTitle,
            new Date(session.createdAt).toLocaleDateString('vi-VN'),
            stmt.shopCode || '-',
            stmt.shopName,
            ord.waybill,
            ord.receiverName || '-',
            ord.receiverPhone || '-',
            ord.receiverAddress || '-',
            ord.statusText || ord.status,
            ord.codAmount,
            ord.shopCalculatedFee + ord.shopOtherFee,
            ord.netShopPayout
          ]);

          r.height = 22;
          r.eachCell((cell, colNum) => {
            cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
            cell.border = THIN_BORDER;

            if (colNum <= 2 || colNum === 5 || colNum === 7 || colNum === 9) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colNum === 3 || colNum === 4 || colNum === 6 || colNum === 8) {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else if (colNum >= 10) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '#,##0';
            }
          });
        });
      });

      autoFitColumns(ws, [18, 16, 16, 24, 18, 20, 16, 28, 16, 22, 22, 22]);

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Du_Lieu_Ke_Toan_MISA_${sessTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      showToast('Đã xuất bảng kê dạng phẳng chuẩn MISA thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất dữ liệu: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 5: Shop Legal Directory for Tax Declaration
  // --------------------------------------------------------------------------
  const exportShopLegalDirectory = async () => {
    try {
      const carrierLabel = activeCarrierObj ? activeCarrierObj.carrierName : 'Tất Cả Hãng';
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('DANH_SACH_SHOP');

      const headers = [
        'STT', 
        'Mã Khách Hàng', 
        'Tên Đơn Vị / Shop', 
        'Số Điện Thoại', 
        'Email', 
        'Địa Chỉ Kinh Doanh', 
        'Ngân Hàng', 
        'Số Tài Khoản', 
        'Chủ Tài Khoản', 
        'Trạng Thái'
      ];

      addCorporateHeader(
        ws,
        `DANH MỤC KHÁCH HÀNG & HỒ SƠ PHÁP LÝ KHAI THUẾ - ${carrierLabel.toUpperCase()}`,
        `Ngày trích xuất: ${new Date().toLocaleDateString('vi-VN')} | Đơn vị quản lý: ${carrierLabel}`,
        headers.length
      );

      const hRow = ws.addRow(headers);
      formatTableHeader(hRow);

      filteredShops.forEach((s, idx) => {
        const r = ws.addRow([
          idx + 1,
          s.code || '-',
          s.name,
          s.phone || '-',
          s.email || '-',
          s.address || '-',
          s.bankAccount?.bankName || '-',
          s.bankAccount?.accountNumber || '-',
          s.bankAccount?.accountHolder || '-',
          s.active !== false ? 'Đang hoạt động' : 'Tạm dừng'
        ]);

        r.height = 22;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
          cell.border = THIN_BORDER;

          if (colNum === 1 || colNum === 2 || colNum === 4 || colNum === 8 || colNum === 10) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });

      autoFitColumns(ws, [8, 16, 26, 16, 22, 32, 22, 20, 24, 16]);

      const buffer = await workbook.xlsx.writeBuffer();
      const safeCarrier = carrierLabel.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(new Blob([buffer]), `Danh_Sach_Khach_Hang_Khai_Thue_${safeCarrier}_${todayStr}.xlsx`);
      showToast('Đã xuất danh bạ khách hàng khai thuế thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất danh bạ shop: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // 🔄 Helper: Ensure all in-range sessions have full order details loaded from API
  // --------------------------------------------------------------------------
  const ensureRangeSessionDetailsLoaded = async (): Promise<{
    inRangeSessions: ReconciliationSession[];
    shopBreakdown: any[];
    allMonthlyOrders: any[];
    sessionCount: number;
    totalOrders: number;
    totalCod: number;
    totalServiceRevenue: number;
    totalNetPayout: number;
  }> => {
    const fromTime = new Date(fromDate + 'T00:00:00').getTime();
    const toTime = new Date(toDate + 'T23:59:59').getTime();

    const inRange = effectiveSessions.filter(sess => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (sess.carrierId || 'jnt') === activeCarrierId;
      const sessDateStr = (sess.createdAt || '').slice(0, 10);
      const isDateInRange = sessDateStr >= fromDate && sessDateStr <= toDate;
      const sessTime = new Date(sess.createdAt).getTime();
      const isTimeInRange = !isNaN(sessTime) && sessTime >= fromTime && sessTime <= toTime;
      return matchCarrier && (isDateInRange || isTimeInRange);
    });

    const fullSessions: ReconciliationSession[] = [];
    for (const sess of inRange) {
      let full = fullSessionsMap[sess.id];
      const hasOrders = full?.statements?.some(st => (st.orders?.length || 0) > 0);
      if (!hasOrders) {
        full = await StorageService.getSessionDetail(sess.id) || sess;
        if (full && full.statements?.some(st => (st.orders?.length || 0) > 0)) {
          setFullSessionsMap(prev => ({ ...prev, [sess.id]: full! }));
        }
      }
      fullSessions.push(full || sess);
    }

    let totalOrders = 0;
    let totalCod = 0;
    let totalServiceRevenue = 0;
    let totalNetPayout = 0;

    const shopMap = new Map<string, any>();

    fullSessions.forEach(sess => {
      totalOrders += (sess.totalOrders || 0);
      totalCod += (sess.totalCod || 0);
      totalServiceRevenue += (sess.totalShopRevenue || 0);
      totalNetPayout += (sess.totalNetPayout || 0);

      (sess.statements || []).forEach(stmt => {
        const key = stmt.shopId || stmt.shopName;
        if (!shopMap.has(key)) {
          const shopObj = effectiveShops.find(s => s.id === stmt.shopId || s.name === stmt.shopName);
          const bankStr = shopObj?.bankAccount?.accountNumber 
            ? `${shopObj.bankAccount.bankName || ''} - ${shopObj.bankAccount.accountNumber} (${shopObj.bankAccount.accountHolder || ''})`
            : (stmt.bankInfo?.accountNumber ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber}` : 'Chưa cập nhật');

          shopMap.set(key, {
            shopId: stmt.shopId,
            shopCode: stmt.shopCode || shopObj?.code || '-',
            shopName: stmt.shopName,
            phone: stmt.shopPhone || shopObj?.phone || '-',
            bankInfo: bankStr,
            sessionCount: 0,
            totalOrders: 0,
            totalCod: 0,
            totalServiceFee: 0,
            totalNetPayout: 0,
            orders: [],
          });
        }

        const sData = shopMap.get(key)!;
        sData.sessionCount += 1;
        sData.totalOrders += (stmt.totalOrders || 0);
        sData.totalCod += (stmt.totalCod || 0);
        sData.totalServiceFee += ((stmt.totalShopFee || 0) + (stmt.totalShopOtherFee || 0));
        sData.totalNetPayout += (stmt.totalNetPayout || 0);

        let stmtOrders: any[] = stmt.orders || [];
        if (stmtOrders.length === 0 && Array.isArray((sess as any).reconciledRows)) {
          stmtOrders = (sess as any).reconciledRows.filter((r: any) =>
            (r.shopId && (r.shopId === stmt.shopId || r.shopId === sData.shopId)) ||
            (r.shopName && (r.shopName === stmt.shopName || r.shopName === sData.shopName))
          );
        }
        if (stmtOrders.length === 0 && Array.isArray((sess as any).orders)) {
          stmtOrders = (sess as any).orders.filter((r: any) =>
            (r.shopId && (r.shopId === stmt.shopId || r.shopId === sData.shopId)) ||
            (r.shopName && (r.shopName === stmt.shopName || r.shopName === sData.shopName))
          );
        }

        stmtOrders.forEach(ord => {
          sData.orders.push({
            ...ord,
            sessionName: sess.sessionName,
            sessionDate: sess.createdAt,
            carrierName: sess.carrierName || sess.carrierId || 'NVC',
            shopName: stmt.shopName || sData.shopName,
            shopCode: sData.shopCode,
          });
        });
      });
    });

    const shopBreakdown = Array.from(shopMap.values()).sort((a, b) => b.totalOrders - a.totalOrders);
    let allMonthlyOrders = shopBreakdown.flatMap(s => s.orders);

    if (allMonthlyOrders.length === 0 && fullSessions.length > 0) {
      fullSessions.forEach(sess => {
        const rawRows = (sess as any).orders || (sess as any).reconciledRows || (sess as any).unmatchedOrders || [];
        rawRows.forEach((ord: any) => {
          allMonthlyOrders.push({
            ...ord,
            sessionName: sess.sessionName,
            sessionDate: sess.createdAt,
            carrierName: sess.carrierName || sess.carrierId || 'NVC',
            shopName: ord.shopName || 'Khách hàng',
            shopCode: ord.shopCode || '-',
          });
        });
      });
    }

    return {
      inRangeSessions: fullSessions,
      shopBreakdown,
      allMonthlyOrders,
      sessionCount: fullSessions.length,
      totalOrders,
      totalCod,
      totalServiceRevenue,
      totalNetPayout
    };
  };

  // Helper for opening single shop modal with full loaded orders
  const handleOpenShopOrders = async (s: any) => {
    let shopOrders = s.orders || [];
    if (shopOrders.length === 0) {
      showToast(`Đang tải danh sách đơn hàng của Shop ${s.shopName}...`, 'info');
      const loaded = await ensureRangeSessionDetailsLoaded();
      const found = loaded.shopBreakdown.find(item => item.shopId === s.shopId || item.shopName === s.shopName);
      if (found && found.orders) {
        shopOrders = found.orders;
      }
    }
    setViewingShopOrders({
      ...s,
      orders: shopOrders
    });
    setModalOrderSearch('');
  };

  // --------------------------------------------------------------------------
  // EXPORT 6A: Single Shop Detailed Invoice Statement (Excel Chuẩn Thuế)
  // --------------------------------------------------------------------------
  const exportShopMonthlyInvoiceStatement = async (shopData: any) => {
    try {
      let ordersToExport = shopData.orders || [];
      if (ordersToExport.length === 0) {
        showToast(`Đang tải đơn hàng cho Shop ${shopData.shopName}...`, 'info');
        const loaded = await ensureRangeSessionDetailsLoaded();
        const found = loaded.shopBreakdown.find(s => s.shopId === shopData.shopId || s.shopName === shopData.shopName);
        if (found && found.orders && found.orders.length > 0) {
          ordersToExport = found.orders;
        }
      }

      if (ordersToExport.length === 0) {
        showToast(`Shop ${shopData?.shopName || ''} không có đơn hàng nào trong khoảng thời gian đã chọn.`, 'warning');
        return;
      }

      showToast(`Đang tạo Bảng kê Hóa đơn chi tiết cho Shop ${shopData.shopName}...`, 'info');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('BANG_KE_HOA_DON_GTGT');
      ws.views = [{ showGridLines: false }];

      const company = StorageService.getCompanyInfo();
      const carrierLabel = activeCarrierObj ? activeCarrierObj.carrierName : 'Tất Cả Hãng';
      const numCols = 11;

      // 1. Corporate Header
      const r1 = ws.addRow([(company.companyName || 'CÔNG TY LOGISTICS & VẬN TẢI ENTERPRISE').toUpperCase()]);
      ws.mergeCells(1, 1, 1, numCols);
      r1.height = 28;
      r1.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
      r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      const r2 = ws.addRow([`Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`]);
      ws.mergeCells(2, 1, 2, numCols);
      r2.height = 20;
      r2.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
      r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      // 2. Report Title
      const r3 = ws.addRow(['BẢNG KÊ CHI TIẾT CƯỚC DỊCH VỤ VẬN CHUYỂN ĐÍNH KÈM HÓA ĐƠN GTGT']);
      ws.mergeCells(3, 1, 3, numCols);
      r3.height = 26;
      r3.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF4338CA' } };
      r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const r4 = ws.addRow([`Kỳ cước: Tháng ${selectedMonth}/${selectedYear} (Từ ${fromDate} đến ${toDate}) | Hãng vận chuyển: ${carrierLabel}`]);
      ws.mergeCells(4, 1, 4, numCols);
      r4.height = 20;
      r4.getCell(1).font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF334155' } };
      r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // 3. Buyer Block
      const rSpace1 = ws.addRow([]);
      rSpace1.height = 8;

      const b1 = ws.addRow(['Đơn vị mua hàng (Khách hàng):', shopData.shopName, '', 'Mã khách hàng:', shopData.shopCode || '-']);
      b1.getCell(1).font = { bold: true, color: { argb: 'FF1E293B' } };
      b1.getCell(2).font = { bold: true, color: { argb: 'FF1D4ED8' } };
      b1.getCell(4).font = { bold: true };
      
      const b2 = ws.addRow(['Điện thoại liên hệ:', shopData.phone || '-', '', 'Kèm Hóa đơn GTGT số:', invoiceRefCode || 'Theo Hóa Đơn Điện Tử']);
      b2.getCell(1).font = { bold: true };
      b2.getCell(4).font = { bold: true };
      b2.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };

      const b3 = ws.addRow(['Tài khoản nhận tiền COD:', shopData.bankInfo || 'Chưa cập nhật', '', 'Thuế suất GTGT:', `${vatRate}%`]);
      b3.getCell(1).font = { bold: true };
      b3.getCell(4).font = { bold: true };
      b3.getCell(5).font = { bold: true, color: { argb: 'FF059669' } };

      const rSpace2 = ws.addRow([]);
      rSpace2.height = 8;

      // 4. Detailed Orders Table Header
      const headers = [
        'STT',
        'Kỳ / Ngày',
        'Mã Vận Đơn',
        'Tên Người Nhận',
        'SĐT Nhận',
        'Địa Chỉ Giao Hàng',
        'Cân Nặng (kg)',
        'Trạng Thái',
        'Cước Vận Chuyển Trước Thuế (VNĐ)',
        `Thuế VAT (${vatRate}%)`,
        'Tổng Tiền Cước (VNĐ)'
      ];

      const hRow = ws.addRow(headers);
      formatTableHeader(hRow);

      let totalWeight = 0;
      let totalPreTaxFee = 0;
      let totalVat = 0;
      let grandTotalFee = 0;

      ordersToExport.forEach((ord: any, idx: number) => {
        const orderFee = ord.shopCalculatedFee !== undefined ? ord.shopCalculatedFee : (ord.fee || 0);
        const vat = Math.round(orderFee * (vatRate / 100));
        const total = orderFee + vat;
        const w = ord.weight || 0.5;

        totalWeight += w;
        totalPreTaxFee += orderFee;
        totalVat += vat;
        grandTotalFee += total;

        const dateStr = ord.sessionName || (ord.sessionDate ? ord.sessionDate.slice(0, 10) : '-');
        const stText = ord.status === 'delivered' ? 'Giao thành công' : (ord.status === 'returned' ? 'Đã hoàn' : (ord.statusText || ord.status));

        const r = ws.addRow([
          idx + 1,
          dateStr,
          ord.waybill,
          ord.receiverName || 'Khách nhận',
          ord.receiverPhone || '',
          ord.receiverAddress || '',
          w,
          stText,
          orderFee,
          vat,
          total
        ]);

        r.height = 21;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF0F172A' } };
          cell.border = THIN_BORDER;

          if (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 5 || colNum === 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 4 || colNum === 6) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (colNum === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.numFmt = '0.00';
          } else if (colNum >= 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });
      });

      // 5. Total Row
      const totalRow = ws.addRow([
        'TỔNG CỘNG',
        '',
        `${ordersToExport.length} đơn`,
        '',
        '',
        '',
        totalWeight,
        '',
        totalPreTaxFee,
        totalVat,
        grandTotalFee
      ]);
      const totNum = totalRow.number;
      ws.mergeCells(totNum, 1, totNum, 2);
      totalRow.height = 26;
      totalRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
        cell.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FFDC2626' } };
        cell.border = TOTAL_BORDER;

        if (colNum <= 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum === 3 || colNum === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum === 7) cell.numFmt = '0.00 "kg"';
        } else if (colNum >= 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      // 6. Signature Block
      const rSpace3 = ws.addRow([]);
      rSpace3.height = 16;

      const signDate = new Date();
      const rDate = ws.addRow(['', '', '', '', '', '', '', '', `Ngày ${signDate.getDate()} tháng ${signDate.getMonth() + 1} năm ${signDate.getFullYear()}`]);
      ws.mergeCells(rDate.number, 9, rDate.number, 11);
      rDate.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      rDate.getCell(9).font = { italic: true, size: 10.5 };

      const rSign = ws.addRow(['NGƯỜI LẬP BẢNG', '', 'KẾ TOÁN TRƯỞNG', '', '', '', '', '', 'ĐẠI DIỆN BÊN BÁN (KÝ & ĐÓNG DẤU)']);
      ws.mergeCells(rSign.number, 1, rSign.number, 2);
      ws.mergeCells(rSign.number, 3, rSign.number, 5);
      ws.mergeCells(rSign.number, 9, rSign.number, 11);
      rSign.height = 24;
      [1, 3, 9].forEach(cIdx => {
        rSign.getCell(cIdx).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
        rSign.getCell(cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const rSignNote = ws.addRow(['(Ký, ghi rõ họ tên)', '', '(Ký, ghi rõ họ tên)', '', '', '', '', '', '(Ký, đóng dấu, ghi rõ họ tên)']);
      ws.mergeCells(rSignNote.number, 1, rSignNote.number, 2);
      ws.mergeCells(rSignNote.number, 3, rSignNote.number, 5);
      ws.mergeCells(rSignNote.number, 9, rSignNote.number, 11);
      [1, 3, 9].forEach(cIdx => {
        rSignNote.getCell(cIdx).font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
        rSignNote.getCell(cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      });

      autoFitColumns(ws, [6, 14, 18, 20, 14, 28, 12, 14, 20, 16, 20]);

      const buffer = await workbook.xlsx.writeBuffer();
      const safeShop = (shopData.shopCode || shopData.shopName).replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(new Blob([buffer]), `Bang_Ke_Hoa_Don_Thang_${selectedMonth}_${selectedYear}_${safeShop}.xlsx`);
      showToast(`Đã xuất bảng kê hóa đơn Shop ${shopData.shopName} thành công!`, 'success');
    } catch (err: any) {
      showToast('Lỗi xuất bảng kê hóa đơn: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 6B: Bulk ZIP All Shops Monthly Invoice Statements
  // --------------------------------------------------------------------------
  const exportAllShopsMonthlyInvoiceZip = async () => {
    try {
      showToast('Đang tổng hợp đơn hàng toàn bộ các Shop...', 'info');
      const loadedData = await ensureRangeSessionDetailsLoaded();
      const shopsWithOrders = loadedData.shopBreakdown.filter(s => s.orders.length > 0);

      if (shopsWithOrders.length === 0) {
        showToast(`Không có shop nào có đơn hàng trong khoảng thời gian đã chọn (Tháng ${selectedMonth}/${selectedYear}).`, 'warning');
        return;
      }

      showToast(`Đang tạo gói ZIP chứa ${shopsWithOrders.length} file Bảng kê Hóa đơn Excel...`, 'info');
      const zip = new JSZip();
      const company = StorageService.getCompanyInfo();
      const carrierLabel = activeCarrierObj ? activeCarrierObj.carrierName : 'Tất Cả Hãng';
      const numCols = 11;

      for (const shopData of shopsWithOrders) {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('BANG_KE_HOA_DON_GTGT');
        ws.views = [{ showGridLines: false }];

        // 1. Corporate Header
        const r1 = ws.addRow([(company.companyName || 'CÔNG TY LOGISTICS & VẬN TẢI ENTERPRISE').toUpperCase()]);
        ws.mergeCells(1, 1, 1, numCols);
        r1.height = 28;
        r1.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
        r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        const r2 = ws.addRow([`Địa chỉ: ${company.address || ''}${company.phone ? ' | SĐT: ' + company.phone : ''}${company.taxCode ? ' | MST: ' + company.taxCode : ''}`]);
        ws.mergeCells(2, 1, 2, numCols);
        r2.height = 20;
        r2.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
        r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        // 2. Report Title
        const r3 = ws.addRow(['BẢNG KÊ CHI TIẾT CƯỚC DỊCH VỤ VẬN CHUYỂN ĐÍNH KÈM HÓA ĐƠN GTGT']);
        ws.mergeCells(3, 1, 3, numCols);
        r3.height = 26;
        r3.getCell(1).font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF4338CA' } };
        r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        const r4 = ws.addRow([`Kỳ cước: Tháng ${selectedMonth}/${selectedYear} (Từ ${fromDate} đến ${toDate}) | Hãng vận chuyển: ${carrierLabel}`]);
        ws.mergeCells(4, 1, 4, numCols);
        r4.height = 20;
        r4.getCell(1).font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF334155' } };
        r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        const rSpace1 = ws.addRow([]);
        rSpace1.height = 8;

        const b1 = ws.addRow(['Đơn vị mua hàng (Khách hàng):', shopData.shopName, '', 'Mã khách hàng:', shopData.shopCode || '-']);
        b1.getCell(1).font = { bold: true, color: { argb: 'FF1E293B' } };
        b1.getCell(2).font = { bold: true, color: { argb: 'FF1D4ED8' } };
        b1.getCell(4).font = { bold: true };
        
        const b2 = ws.addRow(['Điện thoại liên hệ:', shopData.phone || '-', '', 'Kèm Hóa đơn GTGT số:', invoiceRefCode || 'Theo Hóa Đơn Điện Tử']);
        b2.getCell(1).font = { bold: true };
        b2.getCell(4).font = { bold: true };
        b2.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };

        const b3 = ws.addRow(['Tài khoản nhận tiền COD:', shopData.bankInfo || 'Chưa cập nhật', '', 'Thuế suất GTGT:', `${vatRate}%`]);
        b3.getCell(1).font = { bold: true };
        b3.getCell(4).font = { bold: true };
        b3.getCell(5).font = { bold: true, color: { argb: 'FF059669' } };

        const rSpace2 = ws.addRow([]);
        rSpace2.height = 8;

        const headers = [
          'STT',
          'Kỳ / Ngày',
          'Mã Vận Đơn',
          'Tên Người Nhận',
          'SĐT Nhận',
          'Địa Chỉ Giao Hàng',
          'Cân Nặng (kg)',
          'Trạng Thái',
          'Cước Vận Chuyển Trước Thuế (VNĐ)',
          `Thuế VAT (${vatRate}%)`,
          'Tổng Tiền Cước (VNĐ)'
        ];

        const hRow = ws.addRow(headers);
        formatTableHeader(hRow);

        let totalWeight = 0;
        let totalPreTaxFee = 0;
        let totalVat = 0;
        let grandTotalFee = 0;

        shopData.orders.forEach((ord: any, idx: number) => {
          const orderFee = ord.shopCalculatedFee !== undefined ? ord.shopCalculatedFee : (ord.fee || 0);
          const vat = Math.round(orderFee * (vatRate / 100));
          const total = orderFee + vat;
          const w = ord.weight || 0.5;

          totalWeight += w;
          totalPreTaxFee += orderFee;
          totalVat += vat;
          grandTotalFee += total;

          const dateStr = ord.sessionName || (ord.sessionDate ? ord.sessionDate.slice(0, 10) : '-');
          const stText = ord.status === 'delivered' ? 'Giao thành công' : (ord.status === 'returned' ? 'Đã hoàn' : (ord.statusText || ord.status));

          const r = ws.addRow([
            idx + 1,
            dateStr,
            ord.waybill,
            ord.receiverName || 'Khách nhận',
            ord.receiverPhone || '',
            ord.receiverAddress || '',
            w,
            stText,
            orderFee,
            vat,
            total
          ]);

          r.height = 21;
          r.eachCell((cell, colNum) => {
            cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF0F172A' } };
            cell.border = THIN_BORDER;

            if (colNum === 1 || colNum === 2 || colNum === 3 || colNum === 5 || colNum === 8) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colNum === 4 || colNum === 6) {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else if (colNum === 7) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.numFmt = '0.00';
            } else if (colNum >= 9) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              cell.numFmt = '#,##0 "đ"';
            }
          });
        });

        const totalRow = ws.addRow([
          'TỔNG CỘNG',
          '',
          `${shopData.orders.length} đơn`,
          '',
          '',
          '',
          totalWeight,
          '',
          totalPreTaxFee,
          totalVat,
          grandTotalFee
        ]);
        const totNum = totalRow.number;
        ws.mergeCells(totNum, 1, totNum, 2);
        totalRow.height = 26;
        totalRow.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
          cell.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FFDC2626' } };
          cell.border = TOTAL_BORDER;

          if (colNum <= 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 3 || colNum === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (colNum === 7) cell.numFmt = '0.00 "kg"';
          } else if (colNum >= 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });

        // Signature Block
        const rSpace3 = ws.addRow([]);
        rSpace3.height = 16;

        const signDate = new Date();
        const rDate = ws.addRow(['', '', '', '', '', '', '', '', `Ngày ${signDate.getDate()} tháng ${signDate.getMonth() + 1} năm ${signDate.getFullYear()}`]);
        ws.mergeCells(rDate.number, 9, rDate.number, 11);
        rDate.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        rDate.getCell(9).font = { italic: true, size: 10.5 };

        const rSign = ws.addRow(['NGƯỜI LẬP BẢNG', '', 'KẾ TOÁN TRƯỞNG', '', '', '', '', '', 'ĐẠI DIỆN BÊN BÁN (KÝ & ĐÓNG DẤU)']);
        ws.mergeCells(rSign.number, 1, rSign.number, 2);
        ws.mergeCells(rSign.number, 3, rSign.number, 5);
        ws.mergeCells(rSign.number, 9, rSign.number, 11);
        rSign.height = 24;
        [1, 3, 9].forEach(cIdx => {
          rSign.getCell(cIdx).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
          rSign.getCell(cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const rSignNote = ws.addRow(['(Ký, ghi rõ họ tên)', '', '(Ký, ghi rõ họ tên)', '', '', '', '', '', '(Ký, đóng dấu, ghi rõ họ tên)']);
        ws.mergeCells(rSignNote.number, 1, rSignNote.number, 2);
        ws.mergeCells(rSignNote.number, 3, rSignNote.number, 5);
        ws.mergeCells(rSignNote.number, 9, rSignNote.number, 11);
        [1, 3, 9].forEach(cIdx => {
          rSignNote.getCell(cIdx).font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
          rSignNote.getCell(cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        autoFitColumns(ws, [6, 14, 18, 20, 14, 28, 12, 14, 20, 16, 20]);

        const fileBuffer = await workbook.xlsx.writeBuffer();
        const safeShop = (shopData.shopCode || shopData.shopName).replace(/[^a-zA-Z0-9]/g, '_');
        zip.file(`Bang_Ke_Hoa_Don_Thang_${selectedMonth}_${selectedYear}_${safeShop}.xlsx`, fileBuffer);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `Goi_Bang_Ke_Hoa_Don_Thang_${selectedMonth}_${selectedYear}_${shopsWithOrders.length}_Shop.zip`);
      showToast(`Đã xuất trọn bộ gói ZIP cho ${shopsWithOrders.length} Shop thành công!`, 'success');
    } catch (err: any) {
      showToast('Lỗi tạo gói ZIP bảng kê hóa đơn: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 6C: Monthly / Quarterly Master Multi-Sheet Tax & Orders Report
  // --------------------------------------------------------------------------
  const exportMonthlyConsolidatedTaxReport = async () => {
    try {
      showToast('Đang kiểm tra và tải đầy đủ dữ liệu chi tiết...', 'info');
      const loadedData = await ensureRangeSessionDetailsLoaded();

      if (!loadedData || loadedData.allMonthlyOrders.length === 0) {
        showToast(`Không có đơn hàng nào trong khoảng thời gian đã chọn (Tháng ${selectedMonth}/${selectedYear}). Vui lòng chọn Tháng có phát sinh đối soát (VD: Tháng 8/2026) hoặc bấm "Toàn Bộ Lịch Sử".`, 'warning');
        return;
      }

      showToast(`Đang tạo file Excel Báo cáo Thuế & Danh sách toàn bộ ${loadedData.allMonthlyOrders.length.toLocaleString('vi-VN')} đơn hàng trong tháng...`, 'info');
      const carrierLabel = activeCarrierObj ? activeCarrierObj.carrierName : 'Tất Cả Hãng';
      const workbook = new ExcelJS.Workbook();

      // ==========================================
      // SHEET 1: BẢNG TỔNG HỢP DOANH THU HÓA ĐƠN CÁC SHOP
      // ==========================================
      const ws = workbook.addWorksheet('TONG_HOP_DOANH_THU_HOA_DON');
      const headers = [
        'STT', 
        'Mã Khách', 
        'Tên Khách Hàng / Shop', 
        'Số Điện Thoại', 
        'Tài Khoản Ngân Hàng', 
        'Số Kỳ', 
        'Tổng Số Đơn', 
        'Doanh Thu Cước Trước Thuế (VNĐ)',
        `Thuế VAT (${vatRate}%)`,
        'Tổng Tiền Trên Hóa Đơn (VNĐ)',
        'Tổng COD Thu Hộ (VNĐ)', 
        'Tổng Thực Trả Shop (VNĐ)'
      ];

      addCorporateHeader(
        ws,
        `BÁO CÁO DOANH THU HÓA ĐƠN DỊCH VỤ VẬN CHUYỂN & DÒNG TIỀN (${carrierLabel.toUpperCase()})`,
        `Kỳ cước: Tháng ${selectedMonth}/${selectedYear} (Từ ${fromDate} đến ${toDate}) | Thuế VAT: ${vatRate}% | Số kỳ: ${loadedData.sessionCount} | Tổng đơn: ${loadedData.totalOrders.toLocaleString('vi-VN')}`,
        headers.length
      );

      const hRow = ws.addRow(headers);
      formatTableHeader(hRow);

      let grandPreTax = 0;
      let grandVat = 0;
      let grandWithVat = 0;

      loadedData.shopBreakdown.forEach((s, idx) => {
        const preTax = s.totalServiceFee;
        const vat = Math.round(preTax * (vatRate / 100));
        const withVat = preTax + vat;

        grandPreTax += preTax;
        grandVat += vat;
        grandWithVat += withVat;

        const r = ws.addRow([
          idx + 1,
          s.shopCode,
          s.shopName,
          s.phone,
          s.bankInfo,
          s.sessionCount,
          s.totalOrders,
          preTax,
          vat,
          withVat,
          s.totalCod,
          s.totalNetPayout
        ]);

        r.height = 22;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
          cell.border = THIN_BORDER;

          if (colNum === 1 || colNum === 2 || colNum === 4 || colNum === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 3 || colNum === 5) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (colNum === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else if (colNum >= 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });
      });

      // HÀNG TỔNG CỘNG SHEET 1
      const totalRow = ws.addRow([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        `${loadedData.sessionCount} kỳ`,
        loadedData.totalOrders,
        grandPreTax,
        grandVat,
        grandWithVat,
        loadedData.totalCod,
        loadedData.totalNetPayout
      ]);

      const totalRowNum = totalRow.number;
      ws.mergeCells(totalRowNum, 1, totalRowNum, 5);
      totalRow.height = 26;

      totalRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
        cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFDC2626' } };
        cell.border = TOTAL_BORDER;

        if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum === 6 || colNum === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum === 7) cell.numFmt = '#,##0';
        } else if (colNum >= 8) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      autoFitColumns(ws, [8, 14, 26, 16, 30, 12, 14, 22, 18, 22, 22, 22]);

      // ==========================================
      // SHEET 2: TOÀN BỘ ĐƠN HÀNG TRONG THÁNG (RAW LEDGER)
      // ==========================================
      const wsDetail = workbook.addWorksheet('TOAN_BO_DON_HANG_TRONG_THANG');
      const detailHeaders = [
        'STT',
        'Tên Khách Hàng / Shop',
        'Mã Shop',
        'Kỳ Đối Soát',
        'Hãng Vận Chuyển',
        'Mã Vận Đơn',
        'Tên Người Nhận',
        'SĐT Người Nhận',
        'Địa Chỉ Giao Hàng',
        'Cân Nặng (kg)',
        'Trạng Thái',
        'Tiền COD Thu Hộ (VNĐ)',
        'Cước Dịch Vụ Trước Thuế (VNĐ)',
        `Thuế VAT (${vatRate}%)`,
        'Tổng Tiền Cước (VNĐ)'
      ];

      addCorporateHeader(
        wsDetail,
        `BẢNG KÊ TOÀN BỘ ĐƠN HÀNG CHI TIẾT TRONG THÁNG (${carrierLabel.toUpperCase()})`,
        `Thời gian: Từ ${fromDate} đến ${toDate} | Tổng cộng: ${loadedData.allMonthlyOrders.length.toLocaleString('vi-VN')} đơn hàng`,
        detailHeaders.length
      );

      const dHRow = wsDetail.addRow(detailHeaders);
      formatTableHeader(dHRow);

      let dTotalCod = 0;
      let dTotalPreTax = 0;
      let dTotalVat = 0;
      let dTotalWithVat = 0;

      loadedData.allMonthlyOrders.forEach((ord: any, idx: number) => {
        const orderFee = ord.shopCalculatedFee !== undefined ? ord.shopCalculatedFee : (ord.fee || 0);
        const vat = Math.round(orderFee * (vatRate / 100));
        const total = orderFee + vat;
        const cod = ord.codAmount || ord.cod || 0;
        const w = ord.weight || 0.5;

        dTotalCod += cod;
        dTotalPreTax += orderFee;
        dTotalVat += vat;
        dTotalWithVat += total;

        const stText = ord.status === 'delivered' ? 'Giao thành công' : (ord.status === 'returned' ? 'Đã hoàn' : (ord.statusText || ord.status));

        const r = wsDetail.addRow([
          idx + 1,
          ord.shopName,
          ord.shopCode || '-',
          ord.sessionName,
          ord.carrierName,
          ord.waybill,
          ord.receiverName || '',
          ord.receiverPhone || '',
          ord.receiverAddress || '',
          w,
          stText,
          cod,
          orderFee,
          vat,
          total
        ]);

        r.height = 20;
        r.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
          cell.border = THIN_BORDER;

          if (colNum === 1 || colNum === 3 || colNum === 4 || colNum === 5 || colNum === 6 || colNum === 8 || colNum === 11) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 2 || colNum === 7 || colNum === 9) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else if (colNum === 10) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.numFmt = '0.00';
          } else if (colNum >= 12) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
          }
        });
      });

      const dTotalRow = wsDetail.addRow([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        `${loadedData.allMonthlyOrders.length} đơn`,
        '',
        '',
        '',
        '',
        '',
        dTotalCod,
        dTotalPreTax,
        dTotalVat,
        dTotalWithVat
      ]);

      const dTotalRowNum = dTotalRow.number;
      wsDetail.mergeCells(dTotalRowNum, 1, dTotalRowNum, 5);
      dTotalRow.height = 26;

      dTotalRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF08A' } };
        cell.font = { name: 'Calibri', size: 11.5, bold: true, color: { argb: 'FFDC2626' } };
        cell.border = TOTAL_BORDER;

        if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum >= 12) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      autoFitColumns(wsDetail, [6, 22, 14, 18, 16, 18, 18, 14, 28, 12, 14, 18, 20, 16, 20]);

      const buffer = await workbook.xlsx.writeBuffer();
      const safeCarrier = carrierLabel.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(new Blob([buffer]), `Bao_Cao_Thue_Tong_Hop_Thang_${selectedMonth}_${selectedYear}_${safeCarrier}.xlsx`);
      showToast('Đã xuất báo cáo thuế tổng hợp đa Sheet thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất báo cáo định kỳ: ' + err?.message, 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 📦 TAB 4 HELPERS: XỬ LÝ FILE ĐƠN GỬI THÁNG & TÍNH CƯỚC THEO GIÁ SHOP
  // ─────────────────────────────────────────────────────────────────────────
  const extractOutboundField = (row: Record<string, any>, prioritizedKeywords: string[], excludeKeywords: string[] = []): string => {
    for (const kw of prioritizedKeywords) {
      for (const key of Object.keys(row)) {
        const norm = normalizeHeader(key);
        if (excludeKeywords.some(ex => norm.includes(ex))) continue;
        if (norm === kw || norm.includes(kw)) {
          const v = row[key];
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim();
          }
        }
      }
    }
    return '';
  };

  const extractOutboundNumber = (row: Record<string, any>, prioritizedKeywords: string[], defaultVal = 0): number => {
    for (const kw of prioritizedKeywords) {
      for (const key of Object.keys(row)) {
        const norm = normalizeHeader(key);
        if (norm === kw || norm.includes(kw)) {
          const v = row[key];
          if (v !== undefined && v !== null) {
            const cleaned = String(v).replace(/[^0-9.-]/g, '');
            const num = parseFloat(cleaned);
            if (!isNaN(num)) return num;
          }
        }
      }
    }
    return defaultVal;
  };

  const processOutboundOrders = (rawRows: Record<string, any>[], currentShops: Shop[] = effectiveShops) => {
    const orders: any[] = [];

    rawRows.forEach((row, idx) => {
      // Extract Waybill
      let waybill = extractOutboundField(row, [
        'ma_van_don', 'mvd', 'tracking_code', 'waybill', 'tracking', 'ma_don_hang', 'so_hieu', 'so_hd', 'ma_don'
      ]);
      if (!waybill) {
        const firstKey = Object.keys(row)[0];
        if (firstKey && row[firstKey]) {
          waybill = String(row[firstKey]).trim();
        }
      }
      if (!waybill) return;

      // Extract Shop info (Tên người gửi / Tên Shop - Loại trừ địa chỉ, số điện thoại)
      const rawShopName = extractOutboundField(row, [
        'ten_nguoi_gui', 'ten_shop', 'ten_khach_hang', 'sender_name', 'tai_khoan_gui', 'sender', 'khach_hang', 'nguoi_gui'
      ], ['dia_chi', 'sdt', 'phone', 'dien_thoai', 'mat_khau', 'email']);

      const rawShopCode = extractOutboundField(row, [
        'ma_don_kh', 'ma_shop', 'shop_code', 'customer_code', 'ma_khach_hang', 'ma_kh'
      ]);

      const rawShopPhone = extractOutboundField(row, [
        'so_dien_thoai_di_dong_cua_nguoi_gui', 'sdt_nguoi_gui', 'sdt_gui', 'sender_phone', 'sdt_shop', 'dien_thoai_gui', 'phone_gui', 'so_dt_gui'
      ], ['nhan', 'receiver', 'nguoi_nhan']);

      const rawShopAddress = extractOutboundField(row, [
        'dia_chi_nguoi_gui', 'dia_chi_gui', 'dia_chi_shop', 'sender_address'
      ]);

      // Extract Weight (kg) - Trọng lượng tính phí
      let weight = extractOutboundNumber(row, [
        'trong_luong_tinh_phi', 'khoi_luong_kg', 'tl_tinh_cuoc', 'trong_luong', 'khoi_luong', 'can_nang', 'weight', 'tl'
      ], 0.5);
      if (weight > 50) {
        weight = Math.round((weight / 1000) * 100) / 100;
      }
      if (weight <= 0) weight = 0.5;

      // Extract Date - Thời gian tạo đơn
      const shipDate = extractOutboundField(row, [
        'thoi_gian_tao_don', 'ngay_tao', 'ngay_gui', 'ngay_gui_hang', 'created_at', 'thoi_gian_tao', 'ngay_nhan_don', 'ngay_ky_nhan', 'thoi_gian_lay_hang', 'ngay', 'date'
      ]);

      // Extract Receiver info
      const receiverName = extractOutboundField(row, [
        'ten_nguoi_nhan', 'nguoi_nhan', 'receiver_name', 'ten_khach_nhan', 'receiver'
      ], ['gui', 'sender']);

      const receiverPhone = extractOutboundField(row, [
        'sdt_nguoi_nhan', 'sdt_nhan', 'receiver_phone', 'phone_nhan', 'dien_thoai_nhan'
      ], ['gui', 'sender']);

      const receiverProvince = extractOutboundField(row, [
        'dia_chi_nguoi_nhan', 'dia_chi_hanh_chinh', 'tinh_thanh', 'tinh_nhan', 'tinh', 'dia_chi', 'destination', 'dia_chi_nhan', 'receiver_address'
      ], ['gui', 'sender']);

      // Extract COD - Tiền thu hộ COD
      const codAmount = extractOutboundNumber(row, [
        'tien_thu_ho_cod', 'cod_thuc_thu', 'tien_cod', 'cod', 'tien_thu_ho', 'thu_ho', 'tong_thu_ho'
      ], 0);

      // Extract Status - Trạng thái vận đơn
      const rawStatus = extractOutboundField(row, [
        'trang_thai_van_don', 'trang_thai', 'status', 'tinh_trang', 'trang_thai_don'
      ]) || 'Đã gửi hàng';

      // Extract app fee (Cước phí NVC) if present
      const appFee = extractOutboundNumber(row, [
        'cuoc_phi', 'phi_van_chuyen', 'tien_cuoc', 'phi_dich_vu', 'tong_cuoc'
      ], 0);

      // Match with registered shops
      const matchResult = findRegisteredShop(currentShops, {
        phone: rawShopPhone,
        code: rawShopCode,
        name: rawShopName,
      });

      const matchedShop = matchResult.matched ? matchResult.shop : undefined;

      // Calculate fee using shop's tiered pricing plan
      let calculatedFee = 0;
      let pricingPlanName = 'Mặc định';
      if (matchedShop && matchedShop.pricingPlan) {
        calculatedFee = calculateWeightFee(weight, matchedShop.pricingPlan);
        if (matchedShop.pricingPlan.fixedSurcharge) {
          calculatedFee += matchedShop.pricingPlan.fixedSurcharge;
        }
        pricingPlanName = matchedShop.pricingPlan.name || 'Biểu giá Shop';
      } else {
        calculatedFee = calculateWeightFee(weight, {
          id: 'default_plan',
          name: 'Biểu phí chuẩn',
          carrierId: 'jnt',
          weightRules: [
            { minWeight: 0, maxWeight: 0.5, price: 22000 },
            { minWeight: 0.501, maxWeight: 1.0, price: 26000 },
            { minWeight: 1.001, maxWeight: 2.0, price: 32000 },
          ],
          extraStepWeight: 0.5,
          extraStepPrice: 5000,
          returnFeePercent: 0,
          insuranceFeePercent: 0,
          fixedSurcharge: 0,
        });
        pricingPlanName = 'Biểu phí chuẩn (22k)';
      }

      orders.push({
        id: `outbound_${idx}_${waybill}`,
        waybill,
        shopId: matchedShop?.id || 'UNASSIGNED',
        shopCode: matchedShop?.code || rawShopCode || 'KH_CHUA_GAN',
        shopName: matchedShop?.name || rawShopName || 'Khách vãng lai / Chưa gán',
        shopLegalName: (matchedShop as any)?.taxInfo?.businessName || (matchedShop as any)?.businessName || matchedShop?.name || rawShopName || 'Chưa đăng ký pháp nhân',
        shopTaxCode: (matchedShop as any)?.taxInfo?.taxCode || (matchedShop as any)?.taxCode || 'Chưa có MST',
        shopTaxAddress: (matchedShop as any)?.taxInfo?.address || (matchedShop as any)?.address || rawShopAddress || '',
        senderPhone: rawShopPhone || matchedShop?.phone || '',
        senderAddress: rawShopAddress || (matchedShop as any)?.address || '',
        receiverName: receiverName || '-',
        receiverPhone: receiverPhone || '-',
        receiverProvince: receiverProvince || '-',
        weight,
        codAmount,
        shipDate: shipDate || '-',
        status: rawStatus,
        appFee,
        calculatedFee,
        pricingPlanName,
        matchedShop,
      });
    });

    return orders;
  };

  const handleOutboundFileSelect = async (file: File) => {
    if (!file) return;
    try {
      setIsParsingOutbound(true);
      setOutboundFile(file);
      const parsed = await ExcelService.parseExcelFile(file);
      if (!parsed.rows || parsed.rows.length === 0) {
        showToast('File Excel không có dữ liệu hàng nào!', 'warning');
        setIsParsingOutbound(false);
        return;
      }

      setOutboundRawRows(parsed.rows);

      const processed = processOutboundOrders(parsed.rows, effectiveShops);
      setOutboundOrders(processed);
      setOutboundPage(1);

      const fname = file.name;
      const mMatch = fname.match(/(?:thang|t|m)[_ -]?0?([1-9]|1[0-2])[_ -]?(202[0-9])/i);
      if (mMatch) {
        const mm = String(mMatch[1]).padStart(2, '0');
        const yyyy = mMatch[2];
        setOutboundSelectedMonth(`${yyyy}-${mm}`);
      }

      showToast(`Đã nạp và tính cước thành công ${processed.length.toLocaleString('vi-VN')} đơn gửi!`, 'success');
    } catch (err: any) {
      showToast('Lỗi đọc file Excel đơn gửi: ' + (err?.message || err), 'error');
    } finally {
      setIsParsingOutbound(false);
    }
  };

  const handleRecalculateOutbound = () => {
    if (outboundRawRows.length === 0) {
      showToast('Chưa có dữ liệu file đơn gửi để tính lại!', 'warning');
      return;
    }
    const processed = processOutboundOrders(outboundRawRows, effectiveShops);
    setOutboundOrders(processed);
    showToast(`Đã cập nhật lại cước cho ${processed.length.toLocaleString('vi-VN')} đơn!`, 'success');
  };

  const outboundShopSummaries = useMemo(() => {
    const map = new Map<string, {
      shopId: string;
      shopCode: string;
      shopName: string;
      shopLegalName: string;
      shopTaxCode: string;
      shopTaxAddress: string;
      phone: string;
      orderCount: number;
      totalWeight: number;
      totalFee: number;
      totalCod: number;
      avgFee: number;
      orders: any[];
    }>();

    outboundOrders.forEach(ord => {
      const key = ord.shopId !== 'UNASSIGNED' ? ord.shopId : `${ord.shopCode}_${ord.shopName}`;
      if (!map.has(key)) {
        map.set(key, {
          shopId: ord.shopId,
          shopCode: ord.shopCode,
          shopName: ord.shopName,
          shopLegalName: ord.shopLegalName,
          shopTaxCode: ord.shopTaxCode,
          shopTaxAddress: ord.shopTaxAddress,
          phone: ord.senderPhone,
          orderCount: 0,
          totalWeight: 0,
          totalFee: 0,
          totalCod: 0,
          avgFee: 0,
          orders: [],
        });
      }
      const item = map.get(key)!;
      item.orderCount += 1;
      item.totalWeight += (ord.weight || 0);
      item.totalFee += (ord.calculatedFee || 0);
      item.totalCod += (ord.codAmount || 0);
      item.orders.push(ord);
    });

    const list = Array.from(map.values());
    list.forEach(item => {
      item.avgFee = item.orderCount > 0 ? Math.round(item.totalFee / item.orderCount) : 0;
    });

    return list.sort((a, b) => b.totalFee - a.totalFee);
  }, [outboundOrders]);

  const filteredOutboundOrders = useMemo(() => {
    return outboundOrders.filter(ord => {
      if (outboundShopFilter !== 'ALL') {
        const matchShop = ord.shopId === outboundShopFilter || ord.shopCode === outboundShopFilter;
        if (!matchShop) return false;
      }
      if (!outboundSearchQuery) return true;
      const q = outboundSearchQuery.toLowerCase();
      return (
        ord.waybill.toLowerCase().includes(q) ||
        ord.shopName.toLowerCase().includes(q) ||
        ord.shopCode.toLowerCase().includes(q) ||
        ord.receiverName.toLowerCase().includes(q) ||
        ord.receiverPhone.includes(q) ||
        ord.receiverProvince.toLowerCase().includes(q)
      );
    });
  }, [outboundOrders, outboundShopFilter, outboundSearchQuery]);

  const exportOutbound2SheetExcel = async () => {
    if (outboundOrders.length === 0) {
      showToast('Chưa có dữ liệu đơn gửi để xuất file!', 'warning');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'GomDon Tax Portal Pro';
      workbook.created = new Date();

      const [yStr, mStr] = outboundSelectedMonth.split('-');
      const monthDisplay = `Tháng ${mStr}/${yStr}`;

      const totalFeeAll = outboundOrders.reduce((sum, o) => sum + (o.calculatedFee || 0), 0);
      const totalWeightAll = outboundOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
      const totalVatAll = Math.round(totalFeeAll * (outboundVatRate / 100));
      const totalInvoiceAll = totalFeeAll + totalVatAll;

      // ─────────────────────────────────────────────
      // SHEET 1: BANG_KE_CUOC_THEO_SHOP
      // ─────────────────────────────────────────────
      const wsShop = workbook.addWorksheet('BANG_KE_CUOC_THEO_SHOP', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', paperSize: 9 }
      });

      wsShop.mergeCells('A1:L1');
      const titleCell = wsShop.getCell('A1');
      titleCell.value = `BẢNG KÊ TỔNG HỢP DOANH THU CƯỚC ĐƠN GỬI THEO KHÁCH HÀNG - ${monthDisplay.toUpperCase()}`;
      titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      wsShop.getRow(1).height = 36;

      wsShop.getCell('A2').value = `Đơn vị hạch toán: CÔNG TY CỔ PHẦN GOM ĐƠN LOGISTICS`;
      wsShop.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
      wsShop.getCell('A3').value = `Kỳ tính cước: ${monthDisplay} (Dựa trên File phát sinh đơn gửi)`;
      wsShop.getCell('A3').font = { name: 'Arial', size: 10, bold: true };
      wsShop.getCell('H2').value = `Thuế suất GTGT: ${outboundVatRate}%`;
      wsShop.getCell('H2').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      wsShop.getCell('H3').value = `Mã ký hiệu / HĐ: ${outboundInvoiceRefCode || 'HDDT-' + outboundSelectedMonth.replace('-', '')}`;
      wsShop.getCell('H3').font = { name: 'Arial', size: 10 };

      const shopHeaders = [
        'STT',
        'MÃ SHOP',
        'TÊN KHÁCH HÀNG / SHOP',
        'TÊN PHÁP NHÂN XUẤT HÓA ĐƠN',
        'MÃ SỐ THUẾ (MST)',
        'SỐ ĐIỆN THOẠI',
        'SỐ ĐƠN GỬI',
        'TỔNG CÂN NẶNG (KG)',
        'ĐƠN GIÁ TB/ĐƠN (Đ)',
        'DOANH THU CƯỚC TRƯỚC THUẾ (Đ)',
        `THUẾ GTGT (${outboundVatRate}%) (Đ)`,
        'TỔNG TIỀN THANH TOÁN (+VAT) (Đ)'
      ];

      const headerRowShop = wsShop.getRow(5);
      headerRowShop.values = shopHeaders;
      headerRowShop.height = 28;
      headerRowShop.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      });

      let currentRowIdx = 6;
      outboundShopSummaries.forEach((s, idx) => {
        const vatVal = Math.round(s.totalFee * (outboundVatRate / 100));
        const totalWithVat = s.totalFee + vatVal;

        const row = wsShop.getRow(currentRowIdx);
        row.values = [
          idx + 1,
          s.shopCode,
          s.shopName,
          s.shopLegalName,
          s.shopTaxCode,
          s.phone || '-',
          s.orderCount,
          s.totalWeight,
          s.avgFee,
          s.totalFee,
          vatVal,
          totalWithVat
        ];
        row.height = 22;

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 10 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          if (colNum === 1) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 2) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { name: 'Arial', size: 10, bold: true };
          } else if (colNum === 5 || colNum === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.numFmt = '#,##0';
            cell.font = { name: 'Arial', size: 10, bold: true };
          } else if (colNum === 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0.00 "kg"';
          } else if (colNum >= 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
            if (colNum === 10 || colNum === 12) {
              cell.font = { name: 'Arial', size: 10, bold: true };
            }
          }
        });

        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          });
        }

        currentRowIdx++;
      });

      const totalRowShop = wsShop.getRow(currentRowIdx);
      totalRowShop.values = [
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        `${outboundShopSummaries.length} Shops`,
        outboundOrders.length,
        totalWeightAll,
        outboundOrders.length > 0 ? Math.round(totalFeeAll / outboundOrders.length) : 0,
        totalFeeAll,
        totalVatAll,
        totalInvoiceAll
      ];
      wsShop.mergeCells(`A${currentRowIdx}:E${currentRowIdx}`);
      totalRowShop.height = 28;
      totalRowShop.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E293B' } },
          bottom: { style: 'double', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };

        if (colNum === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 6 || colNum === 7) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum === 7) cell.numFmt = '#,##0';
        } else if (colNum === 8) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00 "kg"';
        } else if (colNum >= 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
          if (colNum === 12) {
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFB91C1C' } };
          }
        }
      });

      const shopColWidths = [6, 16, 26, 30, 18, 16, 14, 18, 18, 24, 20, 26];
      shopColWidths.forEach((w, i) => {
        wsShop.getColumn(i + 1).width = w;
      });

      // ─────────────────────────────────────────────
      // SHEET 2: CHI_TIET_DON_GUI_TRONG_THANG
      // ─────────────────────────────────────────────
      const wsDetail = workbook.addWorksheet('CHI_TIET_DON_GUI_TRONG_THANG', {
        views: [{ showGridLines: true }],
        pageSetup: { orientation: 'landscape', paperSize: 9 }
      });

      wsDetail.mergeCells('A1:O1');
      const titleCell2 = wsDetail.getCell('A1');
      titleCell2.value = `BẢNG KÊ CHI TIẾT TỪNG ĐƠN HÀNG GỬI TRONG ${monthDisplay.toUpperCase()}`;
      titleCell2.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
      wsDetail.getRow(1).height = 36;

      wsDetail.getCell('A2').value = `Tổng số lượng đơn phát sinh: ${outboundOrders.length.toLocaleString('vi-VN')} đơn`;
      wsDetail.getCell('A2').font = { name: 'Arial', size: 10, bold: true };
      wsDetail.getCell('A3').value = `Thời gian xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`;
      wsDetail.getCell('A3').font = { name: 'Arial', size: 10, italic: true };

      const detailHeaders = [
        'STT',
        'MÃ VẬN ĐƠN',
        'NGÀY GỬI',
        'MÃ SHOP',
        'TÊN SHOP',
        'NGƯỜI NHẬN',
        'SĐT NHẬN',
        'TỈNH/THÀNH NHẬN',
        'TRỌNG LƯỢNG (KG)',
        'CƯỚC THU SHOP (Đ)',
        `THUẾ VAT ${outboundVatRate}% (Đ)`,
        'TỔNG CƯỚC (+VAT) (Đ)',
        'TIỀN THU HỘ COD (Đ)',
        'TRẠNG THÁI ĐƠN',
        'BẢNG GIÁ ÁP DỤNG'
      ];

      const headerRowDetail = wsDetail.getRow(5);
      headerRowDetail.values = detailHeaders;
      headerRowDetail.height = 28;
      headerRowDetail.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF064E3B' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
      });

      let currentDetailIdx = 6;
      outboundOrders.forEach((ord, idx) => {
        const vat = Math.round(ord.calculatedFee * (outboundVatRate / 100));
        const total = ord.calculatedFee + vat;

        const row = wsDetail.getRow(currentDetailIdx);
        row.values = [
          idx + 1,
          ord.waybill,
          ord.shipDate,
          ord.shopCode,
          ord.shopName,
          ord.receiverName,
          ord.receiverPhone,
          ord.receiverProvince,
          ord.weight,
          ord.calculatedFee,
          vat,
          total,
          ord.codAmount,
          ord.status,
          ord.pricingPlanName
        ];
        row.height = 20;

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 9.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          if (colNum === 1) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: 'Courier New', size: 9.5, bold: true };
          } else if (colNum === 3 || colNum === 4 || colNum === 7 || colNum === 14) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0.00 "kg"';
          } else if (colNum === 10 || colNum === 11 || colNum === 12 || colNum === 13) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
            if (colNum === 10 || colNum === 12) {
              cell.font = { name: 'Arial', size: 9.5, bold: true };
            }
          }
        });

        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          });
        }

        currentDetailIdx++;
      });

      const totalRowDetail = wsDetail.getRow(currentDetailIdx);
      const totalCodAll = outboundOrders.reduce((sum, o) => sum + (o.codAmount || 0), 0);
      totalRowDetail.values = [
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        '',
        '',
        `${outboundOrders.length} Đơn`,
        totalWeightAll,
        totalFeeAll,
        totalVatAll,
        totalInvoiceAll,
        totalCodAll,
        '',
        ''
      ];
      wsDetail.mergeCells(`A${currentDetailIdx}:G${currentDetailIdx}`);
      totalRowDetail.height = 26;
      totalRowDetail.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF065F46' } },
          bottom: { style: 'double', color: { argb: 'FF065F46' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };

        if (colNum === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 8) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNum === 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00 "kg"';
        } else if (colNum >= 10 && colNum <= 13) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      const detailColWidths = [6, 22, 14, 16, 24, 20, 16, 18, 16, 20, 18, 22, 20, 18, 20];
      detailColWidths.forEach((w, i) => {
        wsDetail.getColumn(i + 1).width = w;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeMonth = outboundSelectedMonth.replace('-', '_');
      saveAs(new Blob([buffer]), `Bao_Cao_Cuoc_Don_Gui_Thang_${safeMonth}_2Sheet.xlsx`);
      showToast('Đã xuất Báo Cáo Cước Đơn Gửi 2 Sheet thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất báo cáo cước đơn gửi: ' + (err?.message || err), 'error');
    }
  };

  const exportOutboundSingleShopExcel = async (shopItem: any) => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'GomDon Tax Portal Pro';
      workbook.created = new Date();

      const [yStr, mStr] = outboundSelectedMonth.split('-');
      const monthDisplay = `Tháng ${mStr}/${yStr}`;

      const ws = workbook.addWorksheet(`CUOC_${shopItem.shopCode}`.slice(0, 31), {
        views: [{ showGridLines: true }]
      });

      ws.mergeCells('A1:K1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `BẢNG KÊ CHI TIẾT CƯỚC VẬN CHUYỂN - ${shopItem.shopName.toUpperCase()}`;
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 34;

      ws.getCell('A2').value = `Đơn vị phát hành: CÔNG TY CỔ PHẦN GOM ĐƠN LOGISTICS`;
      ws.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
      ws.getCell('A3').value = `Khách hàng / Shop: ${shopItem.shopName} (${shopItem.shopCode}) | MST: ${shopItem.shopTaxCode || '-'}`;
      ws.getCell('A3').font = { name: 'Arial', size: 10, bold: true };
      ws.getCell('A4').value = `Kỳ phát sinh cước: ${monthDisplay} | Tổng số đơn: ${shopItem.orderCount} đơn`;
      ws.getCell('A4').font = { name: 'Arial', size: 10 };

      const headers = [
        'STT', 'MÃ VẬN ĐƠN', 'NGÀY GỬI', 'NGƯỜI NHẬN', 'SĐT', 'ĐỊA CHỈ / TỈNH', 
        'TRỌNG LƯỢNG (KG)', 'CƯỚC CHƯA THUẾ (Đ)', `THUẾ VAT ${outboundVatRate}% (Đ)`, 'TỔNG CƯỚC (+VAT) (Đ)', 'TRẠNG THÁI'
      ];

      const headerRow = ws.getRow(6);
      headerRow.values = headers;
      headerRow.height = 26;
      headerRow.eachCell(cell => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      let rIdx = 7;
      shopItem.orders.forEach((ord: any, idx: number) => {
        const vat = Math.round(ord.calculatedFee * (outboundVatRate / 100));
        const total = ord.calculatedFee + vat;

        const row = ws.getRow(rIdx);
        row.values = [
          idx + 1,
          ord.waybill,
          ord.shipDate,
          ord.receiverName,
          ord.receiverPhone,
          ord.receiverProvince,
          ord.weight,
          ord.calculatedFee,
          vat,
          total,
          ord.status
        ];
        row.height = 20;

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 9.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 2) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            cell.font = { name: 'Courier New', size: 9.5, bold: true };
          } else if (colNum === 3 || colNum === 5 || colNum === 11) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNum === 7) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0.00 "kg"';
          } else if (colNum >= 8 && colNum <= 10) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0 "đ"';
            if (colNum === 10) cell.font = { name: 'Arial', size: 9.5, bold: true };
          }
        });
        rIdx++;
      });

      const totalRow = ws.getRow(rIdx);
      const vatAll = Math.round(shopItem.totalFee * (outboundVatRate / 100));
      totalRow.values = [
        'TỔNG CỘNG', '', '', '', '', '',
        shopItem.totalWeight,
        shopItem.totalFee,
        vatAll,
        shopItem.totalFee + vatAll,
        ''
      ];
      ws.mergeCells(`A${rIdx}:F${rIdx}`);
      totalRow.height = 26;
      totalRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 10.5, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum === 7) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00 "kg"';
        } else if (colNum >= 8 && colNum <= 10) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0 "đ"';
        }
      });

      const colWidths = [6, 20, 14, 20, 16, 18, 16, 20, 18, 22, 18];
      colWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeCode = shopItem.shopCode.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(new Blob([buffer]), `Bang_Ke_Cuoc_${safeCode}_Thang_${outboundSelectedMonth.replace('-', '_')}.xlsx`);
      showToast(`Đã xuất bảng kê cước cho shop ${shopItem.shopName}!`, 'success');
    } catch (err: any) {
      showToast('Lỗi xuất bảng kê shop: ' + (err?.message || err), 'error');
    }
  };

  const exportOutboundAllShopsZip = async () => {
    if (outboundOrders.length === 0 || outboundShopSummaries.length === 0) {
      showToast('Chưa có dữ liệu đơn gửi để đóng gói ZIP!', 'warning');
      return;
    }
    try {
      showToast('Đang đóng gói toàn bộ bảng kê Shop thành file ZIP...', 'info');
      const zip = new JSZip();
      const [yStr, mStr] = outboundSelectedMonth.split('-');
      const safeMonth = outboundSelectedMonth.replace('-', '_');

      for (const s of outboundShopSummaries) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'GomDon Tax Portal Pro';
        const ws = wb.addWorksheet(`CUOC_${s.shopCode}`.slice(0, 31), {
          views: [{ showGridLines: true }]
        });
        ws.mergeCells('A1:K1');
        const titleCell = ws.getCell('A1');
        titleCell.value = `BẢNG KÊ CHI TIẾT CƯỚC VẬN CHUYỂN - ${s.shopName.toUpperCase()}`;
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 34;

        ws.getCell('A2').value = `Đơn vị phát hành: CÔNG TY CỔ PHẦN GOM ĐƠN LOGISTICS`;
        ws.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
        ws.getCell('A3').value = `Khách hàng: ${s.shopName} | SĐT: ${s.phone || '-'} | MST: ${s.shopTaxCode || '-'}`;
        ws.getCell('A3').font = { name: 'Arial', size: 10, bold: true };
        ws.getCell('A4').value = `Kỳ cước: Tháng ${mStr}/${yStr} | Thuế suất: ${outboundVatRate}%`;
        ws.getCell('A4').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };

        const headers = ['STT', 'Mã Vận Đơn', 'Ngày Gửi', 'Người Nhận', 'SĐT Nhận', 'Địa Chỉ / Tỉnh Thành', 'Cân Nặng (kg)', 'Cước Chưa Thuế (đ)', `VAT (${outboundVatRate}%) (đ)`, 'Tổng Cước (+VAT) (đ)', 'Tiền COD (đ)'];
        const hRow = ws.getRow(6);
        hRow.values = headers;
        hRow.height = 26;
        hRow.eachCell(cell => {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        let rIdx = 7;
        let sTotalWeight = 0;
        let sTotalFee = 0;
        let sTotalVat = 0;
        let sTotalWithVat = 0;
        let sTotalCod = 0;

        (s.orders || []).forEach((ord: any, idx: number) => {
          const vat = Math.round(ord.calculatedFee * (outboundVatRate / 100));
          const total = ord.calculatedFee + vat;
          sTotalWeight += ord.weight || 0;
          sTotalFee += ord.calculatedFee || 0;
          sTotalVat += vat;
          sTotalWithVat += total;
          sTotalCod += ord.codAmount || 0;

          const row = ws.getRow(rIdx);
          row.values = [
            idx + 1,
            ord.waybill,
            ord.shipDate,
            ord.receiverName,
            ord.receiverPhone,
            ord.receiverProvince,
            ord.weight,
            ord.calculatedFee,
            vat,
            total,
            ord.codAmount
          ];
          row.height = 20;
          row.eachCell((cell, colNum) => {
            cell.font = { name: 'Arial', size: 9.5 };
            if (colNum === 1 || colNum === 3 || colNum === 5) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            else if (colNum === 7) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0.00 "kg"'; }
            else if (colNum >= 8) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0 "đ"'; }
          });
          rIdx++;
        });

        const totalRow = ws.getRow(rIdx);
        totalRow.values = ['TỔNG CỘNG', '', '', '', '', `${(s.orders || []).length} Đơn`, sTotalWeight, sTotalFee, sTotalVat, sTotalWithVat, sTotalCod];
        ws.mergeCells(`A${rIdx}:E${rIdx}`);
        totalRow.height = 26;
        totalRow.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 10.5, bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
          if (colNum === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
          else if (colNum === 7) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0.00 "kg"'; }
          else if (colNum >= 8) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0 "đ"'; }
        });

        const colWidths = [6, 20, 14, 20, 16, 22, 16, 20, 18, 22, 18];
        colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        const buf = await wb.xlsx.writeBuffer();
        const safeName = s.shopName.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_-]/g, '_');
        zip.file(`Bang_Ke_Cuoc_${safeName}_${s.shopCode}.xlsx`, buf);
      }

      const zipContent = await zip.generateAsync({ type: 'blob' });
      saveAs(zipContent, `Bo_Bang_Ke_Cuoc_Don_Gui_Thang_${safeMonth}_ZIP.zip`);
      showToast('Đã xuất toàn bộ bảng kê Shop thành file ZIP thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi đóng gói file ZIP: ' + (err?.message || err), 'error');
    }
  };

  const handleLogoutClick = async () => {
    const ok = await showConfirm({
      title: 'ĐĂNG XUẤT',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi Cổng Kế Toán Thuế?',
      confirmText: 'Đăng xuất',
      danger: false
    });
    if (ok) onLogout();
  };

  // =========================================================================
  // LEVEL 1: CARRIER HUB VIEW FOR TAX ACCOUNTANT (SELECT CARRIER CARD)
  // =========================================================================
  if (!activeCarrierId) {
    const totalSystemCod = sessions.reduce((sum, s) => sum + (s.totalCod || 0), 0);

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-app, #f8fafc)', color: 'var(--text-main, #1e293b)', display: 'flex', flexDirection: 'column', paddingBottom: 48 }}>
        
        {/* TOP BAR */}
        <header style={{
          background: 'var(--surface, #ffffff)',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 900,
              fontSize: 16,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
            }}>
              KT
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                KẾ TOÁN PRO ENTERPRISE
                <span style={{ fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  TAX PORTAL
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
                Hệ thống báo cáo thuế & đối soát dữ liệu đa hãng vận chuyển
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Back to Gom Don App for ADMIN */}
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/app/hub';
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, borderRadius: 8, padding: '7px 12px' }}
                title="Quay lại giao diện vận hành gom đơn"
              >
                <ArrowLeft size={15} />
                <span>Quay Lại Quản Trị Gom Đơn</span>
              </button>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              background: 'var(--bg-app, #f1f5f9)',
              borderRadius: 30,
              border: '1px solid var(--border, #e2e8f0)'
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{currentUser.fullName || currentUser.username}</span>
              <span className="badge badge-primary" style={{ fontSize: 10, background: '#7c3aed', color: '#fff' }}>KẾ TOÁN THUẾ</span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogoutClick}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', borderRadius: 8, color: '#ef4444', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <LogOut size={16} />
              <span style={{ fontWeight: 600 }}>Đăng Xuất</span>
            </button>
          </div>
        </header>

        {/* HERO BANNER */}
        <main style={{ flex: 1, padding: '32px 32px 60px', maxWidth: 1440, width: '100%', margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)',
            borderRadius: 24,
            padding: '32px 36px',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 40px -15px rgba(79, 70, 229, 0.35)',
            marginBottom: 32,
          }}>
            <div style={{ position: 'relative', zIndex: 2, maxWidth: 800 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(255, 255, 255, 0.18)',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 14,
                letterSpacing: 0.5,
              }}>
                <Building2 size={14} />
                <span>CỔNG KẾ TOÁN THUẾ • TRUNG TÂM ĐA HÃNG VẬN CHUYỂN</span>
              </div>

              <h1 style={{
                fontSize: 30,
                fontWeight: 900,
                lineHeight: 1.25,
                margin: '0 0 10px 0',
                color: '#ffffff',
              }}>
                Bảng Điều Khiển Hãng Vận Chuyển
              </h1>

              <p style={{
                fontSize: 14.5,
                color: '#e0e7ff',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Chọn một Hãng vận chuyển bên dưới để vào không gian tải file đối soát tổng hợp đa sheet, danh bạ khách hàng khai thuế và báo cáo doanh thu theo kỳ của riêng hãng đó.
              </p>
            </div>
          </div>

          {/* 4 GLOBAL METRICS STRIP */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}>
            <div style={{ background: 'var(--surface, #ffffff)', padding: '18px 20px', borderRadius: 16, border: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Hãng Hoạt Động</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
                  {carriers.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>đơn vị</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface, #ffffff)', padding: '18px 20px', borderRadius: 16, border: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng Kỳ Đối Soát</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
                  {sessions.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>kỳ</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface, #ffffff)', padding: '18px 20px', borderRadius: 16, border: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng Tiền COD Luân Chuyển</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
                  {totalSystemCod.toLocaleString('vi-VN')} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>đ</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface, #ffffff)', padding: '18px 20px', borderRadius: 16, border: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={22} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Shop Khách Hàng</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
                  {shops.length} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>shop</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION HEADER & SEARCH */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Danh Sách Thẻ Không Gian Hãng</span>
                <span style={{ fontSize: 12, background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>
                  {filteredCarriers.length} Hãng
                </span>
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                Bấm chọn một hãng để bắt đầu xuất báo cáo thuế, bảng kê đối soát hoặc hồ sơ khách hàng.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 260 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm hãng vận chuyển..."
                  value={hubSearchTerm}
                  onChange={(e) => setHubSearchTerm(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 34, fontSize: 12.5, borderRadius: 10, width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* CARRIER CARDS GRID */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 20,
          }}>
            {filteredCarriers.map(carrier => {
              const theme = getCarrierTheme(carrier.carrierId, carrier.carrierName);
              const stats = carrierStats.get(carrier.carrierId) || { shopCount: 0, sessionCount: 0, orderCount: 0, totalCod: 0, totalServiceFee: 0, totalNetPayout: 0, lastSessionDate: undefined };

              return (
                <div
                  key={carrier.id}
                  onClick={() => {
                    setActiveCarrierId(carrier.carrierId);
                    setActiveTab('sessions');
                  }}
                  style={{
                    background: theme.cardBg,
                    borderRadius: 20,
                    border: `1.5px solid ${theme.border}`,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = theme.shadowGlow;
                    e.currentTarget.style.borderColor = theme.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                >
                  {/* Top subtle gradient decoration bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 6,
                    background: theme.gradient,
                  }} />

                  {/* Card Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          background: theme.iconBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          boxShadow: theme.shadowGlow,
                        }}>
                          <Truck size={22} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                            {carrier.carrierName}
                          </h3>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>
                            MÃ HÃNG: <strong style={{ color: theme.accentColor }}>{carrier.carrierId.toUpperCase()}</strong>
                          </div>
                        </div>
                      </div>

                      <span style={{
                        background: theme.badgeBg,
                        color: theme.badgeText,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: 20,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accentColor }} />
                        Sẵn sàng
                      </span>
                    </div>

                    {/* Summary Metric Stats */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                      marginTop: 16,
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      borderRadius: 12,
                      padding: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Store size={12} />
                          <span>Shop:</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: theme.primary, marginTop: 2 }}>
                          {stats.shopCount} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>shop</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <FileSpreadsheet size={12} />
                          <span>Kỳ ĐS:</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                          {stats.sessionCount} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>kỳ</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Package size={12} />
                          <span>Tổng đơn:</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                          {stats.orderCount.toLocaleString('vi-VN')} <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-muted)' }}>đơn</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card CTA Action Button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border, #f1f5f9)',
                    paddingTop: 16,
                    marginTop: 4,
                  }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                      <span>{stats.lastSessionDate ? `ĐS gần nhất: ${new Date(stats.lastSessionDate).toLocaleDateString('vi-VN')}` : 'Chưa có kỳ đối soát'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCarrierId(carrier.carrierId);
                        setActiveTab('sessions');
                      }}
                      className="btn btn-primary btn-sm"
                      style={{
                        background: theme.buttonGradient,
                        borderColor: 'transparent',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 700,
                        padding: '8px 16px',
                        borderRadius: 10,
                        boxShadow: theme.shadowGlow,
                      }}
                    >
                      <span>Vào Không Gian {carrier.carrierName.split(' ')[0]}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* SPECIAL CARD: TOÀN BỘ HÃNG VẬN CHUYỂN (HỢP NHẤT TOÀN DOANH NGHIỆP) */}
            <div
              onClick={() => {
                setActiveCarrierId('all');
                setActiveTab('sessions');
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(79, 70, 229, 0.02) 100%)',
                borderRadius: 20,
                border: '1.5px dashed #7c3aed',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 16,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px -4px rgba(124, 58, 237, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}>
                    <Globe size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                      Hợp Nhất Toàn Bộ Hãng
                    </h3>
                    <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>
                      TỔNG HỢP TOÀN DOANH NGHIỆP
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.5 }}>
                  Xem và xuất báo cáo thuế hợp nhất toàn bộ các hãng vận chuyển (J&T, GHN, SPX...) trong cùng một bảng kê tổng hợp.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border, #f1f5f9)', paddingTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', borderColor: '#ddd6fe' }}
                >
                  <span>Vào Báo Cáo Hợp Nhất</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* 🏢 FOOTER THÔNG TIN ĐƠN VỊ PHÁT TRIỂN PHẦN MỀM (TQ DIGITAL) */}
        <SoftwareDeveloperFooter />
      </div>
    );
  }

  // =========================================================================
  // LEVEL 2: INSIDE CARRIER TAX WORKSPACE (GHN / J&T / ALL)
  // =========================================================================
  const currentCarrierTitle = activeCarrierId === 'all' 
    ? 'HỢP NHẤT TOÀN BỘ HÃNG' 
    : (activeCarrierObj?.carrierName || activeCarrierId.toUpperCase());
  
  const currentCarrierTheme = getCarrierTheme(activeCarrierId, activeCarrierObj?.carrierName);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app, #f8fafc)', color: 'var(--text-main, #1e293b)', display: 'flex', flexDirection: 'column', paddingBottom: 48 }}>
      
      {/* 🏛️ UNIFIED STICKY TOP CONTAINER (HEADER + 3 TABS BAR) */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--surface, #ffffff)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        {/* 1. Header Bar */}
        <header style={{
          padding: '10px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border, #e2e8f0)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Back to Carrier Hub Button */}
            <button
              onClick={() => setActiveCarrierId(null)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 8,
                background: '#f1f5f9',
                fontSize: 12,
              }}
              title="Quay lại danh sách thẻ hãng"
            >
              <ArrowLeft size={15} />
              <span>Đổi Hãng Vận Chuyển</span>
            </button>

            <div style={{ width: 1, height: 24, background: 'var(--border, #e2e8f0)' }} />

            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: activeCarrierId === 'all' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : currentCarrierTheme.iconBg,
              border: `1.5px solid ${currentCarrierTheme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <Truck size={18} />
            </div>

            <div>
              <div style={{ fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.2 }}>
                {currentCarrierTitle}
                <span style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', padding: '2px 7px', borderRadius: 4, fontWeight: 800 }}>
                  TAX WORKSPACE
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                Không gian xuất bảng kê thuế & đối soát dữ liệu của hãng {currentCarrierTitle}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Back to Gom Don App for ADMIN */}
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/app/hub';
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, borderRadius: 8, padding: '6px 12px', fontSize: 12 }}
                title="Quay lại giao diện vận hành gom đơn"
              >
                <ArrowLeft size={14} />
                <span>Quay Lại Gom Đơn</span>
              </button>
            )}

            {/* User badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 12px',
              background: 'var(--bg-app, #f1f5f9)',
              borderRadius: 20,
              border: '1px solid var(--border, #e2e8f0)'
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{currentUser.fullName || currentUser.username}</span>
              <span className="badge badge-primary" style={{ fontSize: 9.5, background: '#7c3aed', color: '#fff', padding: '1px 6px' }}>Kế Toán Thuế</span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogoutClick}
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px 12px', borderRadius: 8, color: '#ef4444', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <LogOut size={14} />
              <span style={{ fontWeight: 600 }}>Đăng Xuất</span>
            </button>
          </div>
        </header>

        {/* 2. 🧭 TAB NAVIGATION BAR (Segmented Floating Pills - Apple/Stripe UI) */}
        <div style={{
          padding: '8px 22px',
          display: 'flex',
          gap: 8,
          background: 'var(--surface, #ffffff)',
          borderBottom: '1.5px solid var(--border, #e2e8f0)',
        }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-app, #f1f5f9)',
            padding: '4px',
            borderRadius: 12,
            gap: 4,
            border: '1px solid var(--border, #e2e8f0)'
          }}>
            {[
              { id: 'sessions', label: `1. Báo Cáo Đối Soát Theo Kỳ (${filteredSessions.length})`, icon: FileSpreadsheet },
              { id: 'shops', label: `2. Danh Mục Khách Hàng / Shop (${filteredShops.length})`, icon: Store },
              { id: 'monthly', label: '3. Báo Cáo Thuế Tổng Hợp (Kỳ Đối Soát)', icon: Calendar },
              { id: 'outbound', label: `4. Báo Cáo Cước Đơn Gửi Tháng (File App)${outboundOrders.length > 0 ? ` (${outboundOrders.length.toLocaleString('vi-VN')})` : ''}`, icon: Package },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '8px 18px',
                    fontSize: 12.5,
                    fontWeight: isActive ? 800 : 600,
                    border: 'none',
                    borderRadius: 9,
                    background: isActive ? '#ffffff' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    color: isActive ? '#4f46e5' : 'var(--text-muted, #64748b)',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <Icon size={15} style={{ color: isActive ? '#4f46e5' : 'inherit' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 📦 MAIN CONTENT BODY */}
      <main style={{ flex: 1, padding: '16px 22px', maxWidth: 1600, width: '100%', margin: '0 auto' }}>

        {/* ========================================================================= */}
        {/* TAB 1: BÁO CÁO ĐỐI SOÁT THEO KỲ (MASTER-DETAIL SPLIT SCREEN)              */}
        {/* ========================================================================= */}
        {activeTab === 'sessions' && (
          <div>
            {filteredSessions.length === 0 ? (
              <div style={{
                background: 'var(--surface, #ffffff)',
                padding: '60px 20px',
                borderRadius: 18,
                textAlign: 'center',
                border: '1.5px dashed var(--border, #cbd5e1)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.04)',
              }}>
                <FileSpreadsheet size={48} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 16, fontWeight: 800 }}>Chưa có kỳ đối soát nào cho {currentCarrierTitle}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Khi bộ phận đối soát hoàn tất phiên của hãng này, số liệu sẽ tự động hiển thị tại đây để kế toán tải file.
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '380px 1fr',
                gap: 20,
                alignItems: 'start',
              }}>
                {/* 👈 CỘT TRÁI: DANH SÁCH CÁC KỲ ĐỐI SOÁT (MASTER LIST) */}
                <div style={{
                  background: 'var(--surface, #ffffff)',
                  borderRadius: 16,
                  border: '1.5px solid var(--border, #e2e8f0)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Header & Search Bar bên trái */}
                  <div style={{
                    padding: '14px 16px',
                    borderBottom: '1.5px solid var(--border, #e2e8f0)',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#334155' }}>
                        CÁC KỲ ĐỐI SOÁT
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#e0e7ff',
                        color: '#4338ca',
                        padding: '2px 8px',
                        borderRadius: 20
                      }}>
                        {filteredSessions.length} Kỳ
                      </span>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Tìm theo tên kỳ đối soát..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: 32, fontSize: 12, width: '100%', borderRadius: 8, height: 34 }}
                      />
                    </div>
                  </div>

                  {/* Danh sách các thẻ Kỳ có thể cuộn riêng */}
                  <div style={{
                    maxHeight: 'calc(100vh - 215px)',
                    minHeight: 480,
                    overflowY: 'auto',
                    padding: '10px',
                    background: 'var(--surface, #ffffff)',
                  }}>
                    {filteredSessions.map((sess) => {
                      const isSelected = activeDetailSession?.id === sess.id;
                      const sessionTheme = getCarrierTheme(sess.carrierId, sess.carrierName);

                      return (
                        <div
                          key={sess.id}
                          onClick={() => setSelectedSessionId(sess.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: isSelected ? `2px solid ${sessionTheme.primary}` : '1px solid var(--border, #e2e8f0)',
                            background: isSelected
                              ? sessionTheme.cardBg
                              : 'var(--surface, #ffffff)',
                            marginBottom: 8,
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isSelected
                              ? sessionTheme.shadowGlow
                              : '0 1px 3px rgba(0,0,0,0.02)',
                            position: 'relative',
                          }}
                        >
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              left: 0,
                              top: 10,
                              bottom: 10,
                              width: 4,
                              borderRadius: '0 4px 4px 0',
                              background: sessionTheme.primary,
                            }} />
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{
                              background: sessionTheme.badgeBg,
                              color: sessionTheme.badgeText,
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 4,
                            }}>
                              {sess.carrierName || sess.carrierId.toUpperCase()}
                            </span>

                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                              {new Date(sess.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>

                          <div style={{
                            fontSize: 13.5,
                            fontWeight: 800,
                            marginTop: 6,
                            color: isSelected ? sessionTheme.primary : 'var(--text-main)',
                            lineHeight: 1.3,
                          }}>
                            {sess.sessionName}
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 8,
                            paddingTop: 6,
                            borderTop: '1px dashed var(--border, #e2e8f0)',
                            fontSize: 11.5,
                          }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              <strong>{sess.statements?.length || 0}</strong> Shop • <strong>{sess.totalOrders}</strong> đơn
                            </span>

                            <span style={{ fontWeight: 800, color: sessionTheme.primary }}>
                              {sess.totalCod.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 👉 CỘT PHẢI: CHI TIẾT KỲ ĐỐI SOÁT ĐƯỢC CHỌN (DETAIL WORKSPACE) */}
                {activeDetailSession ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* 1. Header Banner Kỳ Đối Soát + Cụm Nút Xuất File Pro */}
                    <div style={{
                      background: 'var(--surface, #ffffff)',
                      borderRadius: 14,
                      border: '1.5px solid var(--border, #e2e8f0)',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{
                          background: currentCarrierTheme.badgeBg,
                          color: currentCarrierTheme.badgeText,
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 9px',
                          borderRadius: 6,
                          letterSpacing: 0.5,
                          flexShrink: 0,
                        }}>
                          {activeDetailSession.carrierName || (activeDetailSession.carrierId || 'jnt').toUpperCase()}
                        </span>
                        
                        <div style={{ minWidth: 0 }}>
                          <h2 style={{
                            fontSize: 16,
                            fontWeight: 900,
                            margin: 0,
                            color: 'var(--text-main)',
                            lineHeight: 1.2,
                          }}>
                            {activeDetailSession.sessionName}
                          </h2>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            <strong>{activeDetailSession.statements?.length || 0}</strong> Shop • Khởi tạo lúc {new Date(activeDetailSession.createdAt).toLocaleDateString('vi-VN')} {new Date(activeDetailSession.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Cụm 3 nút xuất file cao cấp (Chuẩn Excel Emerald Green + MISA + ZIP) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => exportSessionMultiSheet(activeDetailSession)}
                          className="btn btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            borderColor: 'transparent',
                            color: '#ffffff',
                            padding: '7px 16px',
                            fontSize: 12.5,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 8,
                            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                          }}
                          title="Tải 1 file Excel chứa Sheet tổng và từng Sheet chi tiết từng Shop"
                        >
                          <Download size={15} />
                          <span>Tải File Đa Sheet (.xlsx)</span>
                        </button>

                        <button
                          onClick={() => exportSessionZipPackage(activeDetailSession)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '7px 13px',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            borderRadius: 8,
                            background: '#f8fafc',
                            borderColor: '#cbd5e1',
                          }}
                          title="Tải gói file ZIP trọn bộ các Shop"
                        >
                          <Archive size={14} color="#6366f1" />
                          <span>Tải Gói (.ZIP)</span>
                        </button>

                        <button
                          onClick={() => exportFlatMisaData(activeDetailSession)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '7px 13px',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            borderRadius: 8,
                            background: '#f8fafc',
                            borderColor: '#cbd5e1',
                          }}
                          title="Xuất bảng dữ liệu phẳng import phần mềm kế toán MISA / FAST"
                        >
                          <FileText size={14} color="#ea580c" />
                          <span>Xuất MISA</span>
                        </button>
                      </div>
                    </div>

                    {/* 2. 4 Khối KPI Metrics Cao Cấp (Phân cấp tài chính + dải gradient) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 12,
                    }}>
                      {/* KPI 1: TỔNG SỐ ĐƠN */}
                      <div style={{
                        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                        borderRadius: 14,
                        border: '1.5px solid var(--border, #e2e8f0)',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: '#94a3b8',
                        }} />
                        <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.3 }}>
                          TỔNG SỐ ĐƠN HÀNG
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, color: '#1e293b', lineHeight: 1.2 }}>
                          {activeDetailSession.totalOrders.toLocaleString('vi-VN')} <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>đơn</span>
                        </div>
                      </div>

                      {/* KPI 2: TỔNG TIỀN COD */}
                      <div style={{
                        background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 60%)',
                        borderRadius: 14,
                        border: '1.5px solid rgba(37, 99, 235, 0.3)',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                        }} />
                        <div style={{ fontSize: 10.5, color: '#1d4ed8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.3 }}>
                          TỔNG TIỀN COD THU HỘ
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, color: '#1d4ed8', lineHeight: 1.2 }}>
                          {activeDetailSession.totalCod.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 700 }}>đ</span>
                        </div>
                      </div>

                      {/* KPI 3: DOANH THU CƯỚC */}
                      <div style={{
                        background: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 60%)',
                        borderRadius: 14,
                        border: '1.5px solid rgba(147, 51, 234, 0.3)',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(147, 51, 234, 0.06)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: 'linear-gradient(90deg, #c084fc, #7e22ce)',
                        }} />
                        <div style={{ fontSize: 10.5, color: '#7e22ce', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.3 }}>
                          DOANH THU CƯỚC DỊCH VỤ
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, color: '#7e22ce', lineHeight: 1.2 }}>
                          {(activeDetailSession.totalShopRevenue || 0).toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 700 }}>đ</span>
                        </div>
                      </div>

                      {/* KPI 4: THỰC TRẢ SHOP (NỔI BẬT NHẤT) */}
                      <div style={{
                        background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 60%)',
                        borderRadius: 14,
                        border: '1.5px solid rgba(16, 185, 129, 0.4)',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.08)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: 'linear-gradient(90deg, #10b981, #047857)',
                        }} />
                        <div style={{ fontSize: 10.5, color: '#047857', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.3 }}>
                          THỰC TRẢ KHÁCH HÀNG (SHOP)
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, color: '#047857', lineHeight: 1.2 }}>
                          {activeDetailSession.totalNetPayout.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 700 }}>đ</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Bảng Danh Sách Shop Chi Tiết Pro (Data Table Pro) */}
                    <div style={{
                      background: 'var(--surface, #ffffff)',
                      borderRadius: 14,
                      border: '1.5px solid var(--border, #e2e8f0)',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '10px 18px',
                        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderBottom: '1.5px solid var(--border, #e2e8f0)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#334155' }}>
                          BẢNG KÊ CHI TIẾT CÁC SHOP TRONG KỲ ({activeDetailSession.statements?.length || 0} SHOP)
                        </span>

                        <span style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 700 }}>
                          Khung cuộn tự động • Bấm Chi Tiết để xem từng mã vận đơn
                        </span>
                      </div>

                      <div style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 380, overflowY: 'auto', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <tr style={{ borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 11.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              <th style={{ padding: '10px 12px', width: 45, textAlign: 'center' }}>STT</th>
                              <th style={{ padding: '10px 14px' }}>Khách Hàng (Shop)</th>
                              <th style={{ padding: '10px 14px' }}>Tài Khoản Nhận</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center', width: 75 }}>Số Đơn</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tổng COD</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Cước Dịch Vụ</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thực Trả Shop</th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', width: 150 }}>Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(activeDetailSession.statements || []).map((stmt, sIdx) => {
                              const hasBank = Boolean(stmt.bankInfo?.accountNumber);
                              const bankName = stmt.bankInfo?.bankName || '';
                              const accNum = stmt.bankInfo?.accountNumber || '';
                              const holder = stmt.bankInfo?.accountHolder || '';

                              return (
                                <tr
                                  key={sIdx}
                                  style={{
                                    borderBottom: '1px solid var(--border, #f1f5f9)',
                                    fontSize: 12.5,
                                    transition: 'background 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                                    {sIdx + 1}
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{stmt.shopName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mã: {stmt.shopCode || '-'}</div>
                                  </td>
                                  <td style={{ padding: '10px 14px' }}>
                                    {hasBank ? (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{
                                            background: '#eff6ff',
                                            color: '#1d4ed8',
                                            padding: '1px 6px',
                                            borderRadius: 4,
                                            fontSize: 10.5,
                                            fontWeight: 800,
                                          }}>
                                            {bankName}
                                          </span>
                                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                            {accNum}
                                          </span>
                                        </div>
                                        {holder && (
                                          <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', marginTop: 2, fontWeight: 600 }}>
                                            {holder}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Chưa cập nhật STK</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800 }}>
                                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                                      {stmt.totalOrders}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace' }}>
                                    {stmt.totalCod.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#7e22ce', fontFamily: 'monospace' }}>
                                    {(stmt.totalShopFee + stmt.totalShopOtherFee).toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#047857', fontSize: 13, fontFamily: 'monospace' }}>
                                    {stmt.totalNetPayout.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                      <button
                                        type="button"
                                        onClick={() => exportSingleShopExcel(activeDetailSession.sessionName, stmt)}
                                        className="btn btn-sm"
                                        style={{
                                          padding: '4px 9px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          border: '1px solid #a7f3d0',
                                          borderRadius: 6,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                        }}
                                        title="Tải riêng file Excel của Shop này"
                                      >
                                        <Download size={11} /> Excel
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSession(activeDetailSession);
                                          setSelectedShopStmt(stmt);
                                        }}
                                        className="btn btn-sm"
                                        style={{
                                          padding: '4px 9px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          background: '#eff6ff',
                                          color: '#1d4ed8',
                                          border: '1px solid #bfdbfe',
                                          borderRadius: 6,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                        }}
                                        title="Xem chi tiết các mã vận đơn"
                                      >
                                        <Eye size={11} /> Chi Tiết
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
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--surface, #ffffff)',
                    borderRadius: 18,
                    border: '1.5px dashed var(--border, #cbd5e1)',
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}>
                    <FileSpreadsheet size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Vui lòng chọn một kỳ đối soát ở cột bên trái</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DANH MỤC KHÁCH HÀNG (SHOP DIRECTORY)                               */}
        {/* ========================================================================= */}
        {activeTab === 'shops' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header & Export Button */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              padding: '10px 18px',
              borderRadius: 14,
              border: '1.5px solid var(--border, #e2e8f0)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={`Tìm theo tên shop, mã khách, SĐT của ${currentCarrierTitle}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 34, width: '100%', fontSize: 12.5, borderRadius: 8, height: 36 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Tổng cộng:</span>
                  <span style={{
                    background: '#e0e7ff',
                    color: '#4338ca',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12
                  }}>
                    {filteredShops.length} Shop
                  </span>
                  <span>({currentCarrierTitle})</span>
                </div>

                <button
                  type="button"
                  onClick={exportShopLegalDirectory}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: 'transparent',
                    color: '#ffffff',
                    padding: '8px 16px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 8,
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Download size={15} />
                  <span>Xuất Danh Bạ Shop Khai Thuế (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Shop Table Pro */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: 14,
              border: '1.5px solid var(--border, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{
                padding: '10px 18px',
                background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                fontSize: 12,
                color: '#334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1.5px solid var(--border, #e2e8f0)'
              }}>
                <span style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  DANH MỤC {filteredShops.length} KHÁCH HÀNG / SHOP TRÊN HỆ THỐNG
                </span>
                <span style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 700 }}>
                  Khung cuộn tự động • Cố định tiêu đề
                </span>
              </div>

              <div style={{ maxHeight: 'calc(100vh - 230px)', minHeight: 400, overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <tr style={{ borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 11.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      <th style={{ padding: '10px 12px', width: 45, textAlign: 'center' }}>STT</th>
                      <th style={{ padding: '10px 14px', width: 140 }}>Mã Khách</th>
                      <th style={{ padding: '10px 14px' }}>Tên Khách Hàng / Đơn Vị</th>
                      <th style={{ padding: '10px 14px', width: 130 }}>Số Điện Thoại</th>
                      <th style={{ padding: '10px 14px' }}>Địa Chỉ Kinh Doanh</th>
                      <th style={{ padding: '10px 14px' }}>Thông Tin Ngân Hàng</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: 110 }}>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShops.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có shop nào thuộc {currentCarrierTitle}
                        </td>
                      </tr>
                    ) : (
                      filteredShops.map((s, idx) => (
                        <tr
                          key={s.id || idx}
                          style={{
                            borderBottom: '1px solid var(--border, #f1f5f9)',
                            fontSize: 12.5,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              padding: '2px 7px',
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                            }}>
                              {s.code || '-'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                              {s.name}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                            {s.phone || '-'}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 240, fontSize: 12, color: '#475569' }}>
                            {s.address || '-'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {s.bankAccount?.accountNumber ? (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                  }}>
                                    {s.bankAccount.bankName || 'Ngân Hàng'}
                                  </span>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                    {s.bankAccount.accountNumber}
                                  </span>
                                </div>
                                {s.bankAccount.accountHolder && (
                                  <div style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', marginTop: 2, fontWeight: 600 }}>
                                    {s.bankAccount.accountHolder}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Chưa cập nhật STK</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{
                              background: s.active !== false ? '#ecfdf5' : '#f1f5f9',
                              color: s.active !== false ? '#047857' : '#64748b',
                              border: s.active !== false ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.active !== false ? '#10b981' : '#94a3b8' }} />
                              {s.active !== false ? 'Hoạt động' : 'Tạm dừng'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: BÁO CÁO THUẾ & XUẤT HÓA ĐƠN KÈM BẢNG KÊ THÁNG (PRO)                */}
        {/* ========================================================================= */}
        {activeTab === 'monthly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Invoice & Period Control Panel */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              padding: '14px 20px',
              borderRadius: 14,
              border: '1.5px solid var(--border, #e2e8f0)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {/* Row 1: Month/Year Selector + Presets */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', padding: '4px 10px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <Calendar size={15} color="#1d4ed8" />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1d4ed8' }}>KỲ HÓA ĐƠN THÁNG:</span>
                  </div>

                  {/* Month Picker */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => applyMonthYear(Number(e.target.value), selectedYear)}
                    className="input-field"
                    style={{ padding: '5px 10px', fontSize: 13, fontWeight: 700, borderRadius: 8, borderColor: '#93c5fd', minWidth: 120, height: 34 }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>Tháng {m < 10 ? '0' + m : m}</option>
                    ))}
                  </select>

                  {/* Year Picker */}
                  <select
                    value={selectedYear}
                    onChange={(e) => applyMonthYear(selectedMonth, Number(e.target.value))}
                    className="input-field"
                    style={{ padding: '5px 10px', fontSize: 13, fontWeight: 700, borderRadius: 8, borderColor: '#93c5fd', minWidth: 90, height: 34 }}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>Năm {y}</option>
                    ))}
                  </select>

                  {/* Quick Preset Buttons & Discovered Data Months */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 4 }}>
                    {/* Discovered active months with real data */}
                    {availableDataMonths.map(dm => (
                      <button
                        key={dm.label}
                        type="button"
                        onClick={() => applyMonthYear(dm.month, dm.year)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '5px 11px',
                          fontSize: 12,
                          fontWeight: selectedMonth === dm.month && selectedYear === dm.year ? 800 : 700,
                          borderRadius: 6,
                          background: selectedMonth === dm.month && selectedYear === dm.year ? '#dbeafe' : '#f0fdf4',
                          borderColor: selectedMonth === dm.month && selectedYear === dm.year ? '#3b82f6' : '#86efac',
                          color: selectedMonth === dm.month && selectedYear === dm.year ? '#1d4ed8' : '#15803d',
                        }}
                        title={`Bấm để xem và xuất hóa đơn cho ${dm.label}`}
                      >
                        🔥 {dm.label} ({dm.orderCount.toLocaleString('vi-VN')} đơn)
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => applyMonthYear(now.getMonth() + 1, now.getFullYear())}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear() ? 800 : 600,
                        borderRadius: 6,
                      }}
                    >
                      Tháng Hiện Tại
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        applyMonthYear(prevDate.getMonth() + 1, prevDate.getFullYear());
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}
                    >
                      Tháng Trước
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFromDate('2020-01-01');
                        setToDate('2030-12-31');
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}
                      title="Gom tất cả các đơn hàng từ mọi kỳ đối soát từ trước tới nay"
                    >
                      Toàn Bộ Lịch Sử
                    </button>
                  </div>

                  {/* Date range manual refine */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>(Từ:</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '3px 6px', fontSize: 11.5, height: 30, borderRadius: 6 }}
                    />
                    <span>- Đến:</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="input-field"
                      style={{ padding: '3px 6px', fontSize: 11.5, height: 30, borderRadius: 6 }}
                    />
                    <span>)</span>
                  </div>
                </div>

                {/* VAT Rate & Invoice Ref Code Config */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Thuế suất VAT:</span>
                    <select
                      value={vatRate}
                      onChange={(e) => setVatRate(Number(e.target.value))}
                      className="input-field"
                      style={{ padding: '4px 8px', fontSize: 12, fontWeight: 800, color: '#059669', height: 32, borderRadius: 6, borderColor: '#a7f3d0' }}
                    >
                      <option value={8}>8% (Vận tải - NĐ 72)</option>
                      <option value={10}>10% (Tiêu chuẩn)</option>
                      <option value={0}>0% (Không chịu thuế)</option>
                      <option value={5}>5% (Ưu đãi)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Số HĐ GTGT:</span>
                    <input
                      type="text"
                      placeholder="VD: 0001234 / HĐĐT"
                      value={invoiceRefCode}
                      onChange={(e) => setInvoiceRefCode(e.target.value)}
                      className="input-field"
                      style={{ padding: '4px 8px', fontSize: 12, width: 140, height: 32, borderRadius: 6 }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Header Export Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--border, #f1f5f9)'
              }}>
                <div style={{ fontSize: 12.5, color: '#64748b' }}>
                  ⚡ Tổng hợp toàn bộ <strong>{monthlyAggregatedData.totalOrders.toLocaleString('vi-VN')}</strong> đơn hàng từ <strong>{monthlyAggregatedData.sessionCount}</strong> kỳ đối soát của <strong>{monthlyAggregatedData.shopBreakdown.length}</strong> khách hàng trong Tháng {selectedMonth}/{selectedYear}.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Export All Zip Button */}
                  <button
                    type="button"
                    onClick={exportAllShopsMonthlyInvoiceZip}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '7px 14px',
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 8,
                      background: '#faf5ff',
                      borderColor: '#d8b4fe',
                      color: '#7e22ce'
                    }}
                    title="Xuất nén ZIP chứa riêng file Bảng kê Hóa đơn Excel của từng Shop có đơn trong tháng"
                  >
                    <Archive size={15} color="#7e22ce" />
                    <span>Xuất Gói ZIP Bảng Kê Từng Shop</span>
                  </button>

                  {/* Export Consolidated Multi-Sheet Excel */}
                  <button
                    type="button"
                    onClick={exportMonthlyConsolidatedTaxReport}
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      borderColor: 'transparent',
                      color: '#ffffff',
                      padding: '7px 16px',
                      fontSize: 12.5,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 8,
                      boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                    }}
                    title="Xuất 1 file Excel 2 Sheet: Sheet 1 Tổng hợp Doanh thu Hóa đơn & Sheet 2 Sổ cái chi tiết toàn bộ đơn"
                  >
                    <Download size={15} />
                    <span>Xuất Báo Cáo Thuế 2 Sheet (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ⚠️ Zero Orders Warning Banner with Instant 1-Click Fix */}
            {monthlyAggregatedData.totalOrders === 0 && (
              <div style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', flexShrink: 0 }}>
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#92400e' }}>
                      Chưa có kỳ đối soát nào trong Tháng {selectedMonth}/{selectedYear} ({fromDate} đến {toDate})
                    </div>
                    <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                      {availableDataMonths.length > 0 
                        ? `Hệ thống ghi nhận có dữ liệu đối soát ở: ${availableDataMonths.map(d => `${d.label} (${d.orderCount.toLocaleString('vi-VN')} đơn)`).join(', ')}.`
                        : 'Hiện tại chưa có kỳ đối soát nào được tạo cho hãng này.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {availableDataMonths.map(dm => (
                    <button
                      key={dm.label}
                      type="button"
                      onClick={() => applyMonthYear(dm.month, dm.year)}
                      className="btn btn-sm"
                      style={{
                        background: '#d97706',
                        borderColor: '#d97706',
                        color: '#ffffff',
                        fontWeight: 800,
                        padding: '7px 14px',
                        borderRadius: 8,
                        fontSize: 12.5,
                        boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
                      }}
                    >
                      👉 Chuyển Sang {dm.label} ({dm.orderCount.toLocaleString('vi-VN')} đơn)
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setFromDate('2020-01-01');
                      setToDate('2030-12-31');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12.5 }}
                  >
                    Xem Toàn Bộ Lịch Sử
                  </button>
                </div>
              </div>
            )}

            {/* 4 Summary KPI Cards Pro */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid var(--border, #e2e8f0)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#94a3b8' }} />
                <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>Kỳ Đối Soát Trong Khoảng</div>
                <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, color: '#1e293b' }}>{monthlyAggregatedData.sessionCount} kỳ</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}><strong>{monthlyAggregatedData.totalOrders.toLocaleString('vi-VN')}</strong> tổng đơn đã gửi</div>
              </div>

              <div style={{
                background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 60%)',
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid rgba(37, 99, 235, 0.3)',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)' }} />
                <div style={{ fontSize: 10.5, color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>Tổng COD Thu Hộ Luân Chuyển</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1d4ed8', marginTop: 4 }}>
                  {monthlyAggregatedData.totalCod.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 700 }}>đ</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Tiền hàng thu hộ từ khách</div>
              </div>

              <div style={{
                background: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 60%)',
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid rgba(147, 51, 234, 0.3)',
                boxShadow: '0 2px 8px rgba(147, 51, 234, 0.06)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #c084fc, #7e22ce)' }} />
                <div style={{ fontSize: 10.5, color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>Cước Dịch Vụ Trước Thuế</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#7e22ce', marginTop: 4 }}>
                  {monthlyAggregatedData.totalServiceRevenue.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 700 }}>đ</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  + Thuế VAT ({vatRate}%): <strong>{Math.round(monthlyAggregatedData.totalServiceRevenue * (vatRate / 100)).toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 60%)',
                padding: '12px 16px',
                borderRadius: 14,
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.08)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #10b981, #047857)' }} />
                <div style={{ fontSize: 10.5, color: '#047857', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>Thực Chi Trả Khách Hàng</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#047857', marginTop: 4 }}>
                  {monthlyAggregatedData.totalNetPayout.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 700 }}>đ</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Tổng thực chuyển khoản cho các Shop</div>
              </div>
            </div>

            {/* Aggregated Shop Breakdown & All Monthly Orders Table Pro */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: 14,
              border: '1.5px solid var(--border, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              {/* Header with Sub-tab Switcher */}
              <div style={{
                padding: '10px 18px',
                borderBottom: '1.5px solid var(--border, #e2e8f0)',
                background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}>
                {/* Switcher Pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e2e8f0', padding: '3px', borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => setMonthlySubTab('shops')}
                    style={{
                      padding: '5px 14px',
                      fontSize: 12.5,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: monthlySubTab === 'shops' ? '#ffffff' : 'transparent',
                      color: monthlySubTab === 'shops' ? '#1e293b' : '#64748b',
                      boxShadow: monthlySubTab === 'shops' ? '0 2px 5px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🏢 BẢNG PHÂN BỔ SHOP ({monthlyAggregatedData.shopBreakdown.length} khách)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMonthlySubTab('orders');
                      setOrderPage(1);
                    }}
                    style={{
                      padding: '5px 14px',
                      fontSize: 12.5,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      background: monthlySubTab === 'orders' ? '#3b82f6' : 'transparent',
                      color: monthlySubTab === 'orders' ? '#ffffff' : '#64748b',
                      boxShadow: monthlySubTab === 'orders' ? '0 2px 5px rgba(59,130,246,0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📦 TOÀN BỘ ĐƠN HÀNG TRONG THÁNG ({monthlyAggregatedData.allMonthlyOrders.length.toLocaleString('vi-VN')} đơn)
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 700 }}>
                    Thuế suất: {vatRate}% • Tháng {selectedMonth}/{selectedYear} ({currentCarrierTitle})
                  </span>
                </div>
              </div>

              {/* VIEW 1: SHOP BREAKDOWN TABLE */}
              {monthlySubTab === 'shops' && (
                <div style={{ maxHeight: 'calc(100vh - 310px)', minHeight: 350, overflowY: 'auto', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <tr style={{ borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 11.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        <th style={{ padding: '10px 10px', width: 40, textAlign: 'center' }}>STT</th>
                        <th style={{ padding: '10px 12px', width: 110 }}>Mã Khách</th>
                        <th style={{ padding: '10px 14px' }}>Tên Khách Hàng / Shop</th>
                        <th style={{ padding: '10px 12px', width: 115 }}>Số Điện Thoại</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: 75 }}>Số Kỳ</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: 90 }}>Tổng Đơn</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng COD</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cước Chưa VAT</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thuế VAT ({vatRate}%)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng Tiền HĐ</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tổng Thực Trả</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: 180 }}>Hành Động Hóa Đơn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyAggregatedData.shopBreakdown.map((s, idx) => {
                        const shopVat = Math.round(s.totalServiceFee * (vatRate / 100));
                        const shopTotalInvoice = s.totalServiceFee + shopVat;

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid var(--border, #f1f5f9)',
                              fontSize: 12.5,
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '10px 10px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontSize: 11.5,
                                fontWeight: 800,
                                fontFamily: 'monospace',
                              }}>
                                {s.shopCode}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-main)' }}>
                              {s.shopName}
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                              {s.phone}
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700 }}>
                              <span style={{ background: '#f1f5f9', padding: '2px 7px', borderRadius: 6, fontSize: 11.5 }}>
                                {s.sessionCount}
                              </span>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 800 }}>
                              <span style={{ background: '#f1f5f9', padding: '2px 7px', borderRadius: 6, fontSize: 11.5 }}>
                                {s.totalOrders.toLocaleString('vi-VN')}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8', fontFamily: 'monospace' }}>
                              {s.totalCod.toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#7e22ce', fontFamily: 'monospace' }}>
                              {s.totalServiceFee.toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
                              {shopVat.toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                              {shopTotalInvoice.toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#047857', fontSize: 13, fontFamily: 'monospace' }}>
                              {s.totalNetPayout.toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                {/* View Orders Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenShopOrders(s)}
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Xem danh sách chi tiết toàn bộ đơn hàng của Shop trong tháng"
                                >
                                  <Eye size={13} />
                                  <span>Xem Đơn</span>
                                </button>

                                {/* Export Single Shop Invoice Statement */}
                                <button
                                  type="button"
                                  onClick={() => exportShopMonthlyInvoiceStatement(s)}
                                  className="btn btn-sm"
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    borderColor: 'transparent',
                                    color: '#ffffff',
                                    padding: '4px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                                  }}
                                  title="Xuất Bảng Kê Chi Tiết Cước Vận Chuyển Đính Kèm Hóa Đơn GTGT cho Shop này"
                                >
                                  <Download size={13} />
                                  <span>Bảng Kê HĐ</span>
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

              {/* VIEW 2: FULL RAW ALL-ORDERS MONTHLY LEDGER TABLE */}
              {monthlySubTab === 'orders' && (() => {
                let filtered = monthlyAggregatedData.allMonthlyOrders;
                if (orderStatusFilter !== 'all') {
                  if (orderStatusFilter === 'delivered') {
                    filtered = filtered.filter(o => o.status === 'delivered' || (o.statusText || '').toLowerCase().includes('thành công') || (o.statusText || '').toLowerCase().includes('phát thành công'));
                  } else if (orderStatusFilter === 'returned') {
                    filtered = filtered.filter(o => o.status === 'returned' || (o.statusText || '').toLowerCase().includes('hoàn') || (o.statusText || '').toLowerCase().includes('trả'));
                  } else if (orderStatusFilter === 'in_transit') {
                    filtered = filtered.filter(o => o.status === 'in_transit' || o.status === 'shipping' || (o.statusText || '').toLowerCase().includes('chuyển') || (o.statusText || '').toLowerCase().includes('giao'));
                  }
                }
                if (monthlyOrderSearch.trim()) {
                  const q = monthlyOrderSearch.trim().toLowerCase();
                  filtered = filtered.filter(o => 
                    (o.waybill || '').toLowerCase().includes(q) ||
                    (o.shopName || '').toLowerCase().includes(q) ||
                    (o.shopCode || '').toLowerCase().includes(q) ||
                    (o.receiverName || '').toLowerCase().includes(q) ||
                    (o.receiverPhone || '').toLowerCase().includes(q) ||
                    (o.receiverAddress || '').toLowerCase().includes(q) ||
                    (o.sessionName || '').toLowerCase().includes(q)
                  );
                }

                const totalPages = Math.max(1, Math.ceil(filtered.length / ordersPerPage));
                const currentPage = Math.min(orderPage, totalPages);
                const startIndex = (currentPage - 1) * ordersPerPage;
                const pageOrders = filtered.slice(startIndex, startIndex + ordersPerPage);

                let totalPageCod = 0;
                let totalPagePreTax = 0;
                let totalPageVat = 0;
                let totalPageWithVat = 0;

                filtered.forEach((ord: any) => {
                  const f = ord.shopCalculatedFee !== undefined ? ord.shopCalculatedFee : (ord.fee || 0);
                  const v = Math.round(f * (vatRate / 100));
                  totalPageCod += (ord.codAmount || ord.cod || 0);
                  totalPagePreTax += f;
                  totalPageVat += v;
                  totalPageWithVat += (f + v);
                });

                return (
                  <div>
                    {/* Search & Filter Toolbar */}
                    <div style={{
                      padding: '10px 18px',
                      background: '#ffffff',
                      borderBottom: '1px solid var(--border, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
                        <Search size={15} color="#64748b" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm mã vận đơn, tên shop, người nhận, SĐT, kỳ đối soát..."
                          value={monthlyOrderSearch}
                          onChange={(e) => {
                            setMonthlyOrderSearch(e.target.value);
                            setOrderPage(1);
                          }}
                          className="input-field"
                          style={{ flex: 1, padding: '5px 10px', fontSize: 12.5, height: 32, borderRadius: 6 }}
                        />
                        {monthlyOrderSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setMonthlyOrderSearch('');
                              setOrderPage(1);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Status Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Filter size={13} color="#64748b" />
                          <select
                            value={orderStatusFilter}
                            onChange={(e) => {
                              setOrderStatusFilter(e.target.value);
                              setOrderPage(1);
                            }}
                            className="input-field"
                            style={{ padding: '4px 8px', fontSize: 12, height: 32, borderRadius: 6 }}
                          >
                            <option value="all">Tất cả trạng thái ({monthlyAggregatedData.allMonthlyOrders.length})</option>
                            <option value="delivered">Giao thành công</option>
                            <option value="in_transit">Đang giao / Trung chuyển</option>
                            <option value="returned">Đã hoàn / Trả hàng</option>
                          </select>
                        </div>

                        {/* Quick KPI info */}
                        <div style={{ fontSize: 12, color: '#475569', background: '#f8fafc', padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          Khớp: <strong>{filtered.length.toLocaleString('vi-VN')}</strong> / {monthlyAggregatedData.allMonthlyOrders.length.toLocaleString('vi-VN')} đơn | Tiền Cước: <strong style={{ color: '#dc2626' }}>{totalPageWithVat.toLocaleString('vi-VN')} đ</strong>
                        </div>
                      </div>
                    </div>

                    {/* Table of Orders */}
                    <div style={{ maxHeight: 'calc(100vh - 370px)', minHeight: 350, overflowY: 'auto', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <tr style={{ borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 11.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                            <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>STT</th>
                            <th style={{ padding: '10px 10px', width: 110 }}>Kỳ / Ngày</th>
                            <th style={{ padding: '10px 10px', width: 135 }}>Mã Vận Đơn</th>
                            <th style={{ padding: '10px 12px' }}>Shop / Khách Gửi</th>
                            <th style={{ padding: '10px 10px', width: 120 }}>Người Nhận</th>
                            <th style={{ padding: '10px 10px', width: 105 }}>SĐT Nhận</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', width: 75 }}>TL (kg)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'center', width: 120 }}>Trạng Thái</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tiền COD</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Cước Trước Thuế</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>VAT ({vatRate}%)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng Tiền Cước</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageOrders.length === 0 ? (
                            <tr>
                              <td colSpan={12} style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                Không tìm thấy đơn hàng nào phù hợp với bộ lọc tìm kiếm.
                              </td>
                            </tr>
                          ) : (
                            pageOrders.map((ord: any, idx: number) => {
                              const orderFee = ord.shopCalculatedFee !== undefined ? ord.shopCalculatedFee : (ord.fee || 0);
                              const vat = Math.round(orderFee * (vatRate / 100));
                              const total = orderFee + vat;
                              const cod = ord.codAmount || ord.cod || 0;
                              const w = ord.weight || 0.5;
                              const stText = ord.status === 'delivered' ? 'Giao thành công' : (ord.status === 'returned' ? 'Đã hoàn' : (ord.statusText || ord.status));
                              const globalIdx = startIndex + idx + 1;

                              return (
                                <tr
                                  key={ord.id || ord.waybill || idx}
                                  style={{
                                    borderBottom: '1px solid var(--border, #f1f5f9)',
                                    fontSize: 12,
                                    transition: 'background 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <td style={{ padding: '8px 8px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>
                                    {globalIdx}
                                  </td>
                                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#475569' }}>
                                    {ord.sessionName || (ord.sessionDate ? ord.sessionDate.slice(0, 10) : '-')}
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{
                                      background: '#f1f5f9',
                                      color: '#1e293b',
                                      padding: '2px 6px',
                                      borderRadius: 5,
                                      fontWeight: 800,
                                      fontFamily: 'monospace',
                                      fontSize: 11.5
                                    }}>
                                      {ord.waybill}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{ord.shopName}</div>
                                    {ord.shopCode && ord.shopCode !== '-' && (
                                      <div style={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace' }}>{ord.shopCode}</div>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 10px', color: '#334155', fontWeight: 600 }}>
                                    {ord.receiverName || '-'}
                                  </td>
                                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#64748b', fontSize: 11.5 }}>
                                    {ord.receiverPhone || '-'}
                                  </td>
                                  <td style={{ padding: '8px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>
                                    {Number(w).toFixed(2)}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <span style={{
                                      padding: '2px 7px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      background: ord.status === 'delivered' ? '#ecfdf5' : (ord.status === 'returned' ? '#fef2f2' : '#eff6ff'),
                                      color: ord.status === 'delivered' ? '#047857' : (ord.status === 'returned' ? '#b91c1c' : '#1d4ed8'),
                                      border: `1px solid ${ord.status === 'delivered' ? '#a7f3d0' : (ord.status === 'returned' ? '#fecaca' : '#bfdbfe')}`
                                    }}>
                                      {stText}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
                                    {cod.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#7e22ce', fontFamily: 'monospace' }}>
                                    {orderFee.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
                                    {vat.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                                    {total.toLocaleString('vi-VN')} đ
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination & Export Footer Bar */}
                    <div style={{
                      padding: '10px 18px',
                      background: '#f8fafc',
                      borderTop: '1.5px solid var(--border, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10
                    }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Hiển thị <strong>{filtered.length === 0 ? 0 : startIndex + 1}</strong> - <strong>{Math.min(startIndex + ordersPerPage, filtered.length)}</strong> trên tổng <strong>{filtered.length.toLocaleString('vi-VN')}</strong> đơn hàng
                      </div>

                      {/* Pagination buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          <ChevronLeft size={13} />
                          <span>Trước</span>
                        </button>

                        <span style={{ fontSize: 12, fontWeight: 800, padding: '0 8px', color: '#1e293b' }}>
                          Trang {currentPage} / {totalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setOrderPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          <span>Sau</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>

                      {/* Direct Export 2 Sheet Button */}
                      <button
                        type="button"
                        onClick={exportMonthlyConsolidatedTaxReport}
                        className="btn btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          borderColor: 'transparent',
                          color: '#ffffff',
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 800,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        <Download size={14} />
                        <span>Xuất File Excel 2 Sheet</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* 📦 TAB 4: BÁO CÁO CƯỚC ĐƠN GỬI THÁNG (FILE APP / STORE EXPORT)       */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'outbound' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Header Banner & Action Bar */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: 16,
              padding: '20px 24px',
              border: '1px solid var(--border, #e2e8f0)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
                  }}>
                    <Package size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main, #1e293b)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      4. Báo Cáo Cước Đơn Gửi Tháng (File App)
                      <span style={{
                        fontSize: 11,
                        background: '#ede9fe',
                        color: '#6d28d9',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700
                      }}>
                        Theo Ngày Gửi Trong Tháng
                      </span>
                    </h2>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)', margin: '3px 0 0' }}>
                      Nạp file xuất từ App để tự động áp bảng giá Admin cho từng shop & xuất Báo cáo Thuế / Bảng kê Hóa đơn 2 Sheet.
                    </p>
                  </div>
                </div>

                {/* Right Top Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Month Picker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                    <Calendar size={15} color="#64748b" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Kỳ Báo Cáo:</span>
                    <input
                      type="month"
                      value={outboundSelectedMonth}
                      onChange={(e) => {
                        if (e.target.value) setOutboundSelectedMonth(e.target.value);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#1e293b',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* VAT Rate Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>VAT:</span>
                    <select
                      value={outboundVatRate}
                      onChange={(e) => setOutboundVatRate(Number(e.target.value))}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#dc2626',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={8}>8% (Logistics / Vận tải)</option>
                      <option value={10}>10% (Tiêu chuẩn)</option>
                      <option value={0}>0% (Không thuế)</option>
                    </select>
                  </div>

                  {/* Invoice Ref Code */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Ký Hiệu HĐ:</span>
                    <input
                      type="text"
                      placeholder={`HDDT-${outboundSelectedMonth.replace('-', '')}`}
                      value={outboundInvoiceRefCode}
                      onChange={(e) => setOutboundInvoiceRefCode(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#1e293b',
                        outline: 'none',
                        width: 120
                      }}
                    />
                  </div>

                  {/* Export 2-Sheet Excel Button */}
                  <button
                    type="button"
                    onClick={exportOutbound2SheetExcel}
                    disabled={outboundOrders.length === 0}
                    className="btn btn-sm"
                    style={{
                      background: outboundOrders.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#94a3b8',
                      borderColor: 'transparent',
                      color: '#ffffff',
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 800,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      cursor: outboundOrders.length > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: outboundOrders.length > 0 ? '0 2px 10px rgba(16, 185, 129, 0.3)' : 'none'
                    }}
                    title="Xuất file Báo cáo Thuế Cước Đơn Gửi 2 Sheet (.xlsx)"
                  >
                    <Download size={16} />
                    <span>Xuất Báo Cáo 2 Sheet (.xlsx)</span>
                  </button>

                  {/* Export ZIP Button */}
                  <button
                    type="button"
                    onClick={exportOutboundAllShopsZip}
                    disabled={outboundOrders.length === 0}
                    className="btn btn-sm"
                    style={{
                      background: outboundOrders.length > 0 ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : '#94a3b8',
                      borderColor: 'transparent',
                      color: '#ffffff',
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 800,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      cursor: outboundOrders.length > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: outboundOrders.length > 0 ? '0 2px 10px rgba(79, 70, 229, 0.3)' : 'none'
                    }}
                    title="Tải toàn bộ Bảng kê từng Shop thành 1 file nén (.zip)"
                  >
                    <Archive size={16} />
                    <span>Tải Bộ Bảng Kê (File ZIP)</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              {outboundOrders.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOutbound(true);
                  }}
                  onDragLeave={() => setIsDraggingOutbound(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOutbound(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleOutboundFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => {
                    const input = document.getElementById('outbound-file-input');
                    if (input) input.click();
                  }}
                  style={{
                    border: isDraggingOutbound ? '2px dashed #7c3aed' : '2px dashed #cbd5e1',
                    background: isDraggingOutbound ? '#f5f3ff' : '#f8fafc',
                    borderRadius: 14,
                    padding: '36px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}
                >
                  <input
                    id="outbound-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleOutboundFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: '#ede9fe',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isParsingOutbound ? <RefreshCw size={28} className="animate-spin" /> : <UploadCloud size={30} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
                      {isParsingOutbound ? 'Đang đọc và phân tích dữ liệu file Excel...' : 'Kéo thả File Excel Đơn Gửi Trong Tháng vào đây hoặc Nhấn để chọn file'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                      Hỗ trợ định dạng .xlsx, .xls, .csv từ phần mềm Gom Đơn, Shop, hoặc App Quản lý vận đơn
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 12,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={20} color="#16a34a" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>
                        File hiện tại: <strong>{outboundFile?.name || 'File đơn gửi'}</strong> ({outboundOrders.length.toLocaleString('vi-VN')} đơn hàng)
                      </div>
                      <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 2 }}>
                        Kỳ tính cước: <strong>{outboundSelectedMonth}</strong> • Đã tự động khớp bảng giá và tính cước cho <strong>{outboundShopSummaries.length}</strong> shop.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleRecalculateOutbound}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                      title="Tính lại cước nếu có thay đổi bảng giá Shop"
                    >
                      <RefreshCw size={13} />
                      <span>Tính Lại Cước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('outbound-file-input-reupload');
                        if (input) input.click();
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <input
                        id="outbound-file-input-reupload"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleOutboundFileSelect(e.target.files[0]);
                          }
                        }}
                      />
                      <FileUp size={13} />
                      <span>Chọn File Khác</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. KPI Summary Cards (When Data Loaded) */}
            {outboundOrders.length > 0 && (() => {
              const totalOrders = outboundOrders.length;
              const totalWeight = outboundOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
              const totalFee = outboundOrders.reduce((sum, o) => sum + (o.calculatedFee || 0), 0);
              const totalVat = Math.round(totalFee * (outboundVatRate / 100));
              const totalInvoice = totalFee + totalVat;
              const totalShops = outboundShopSummaries.length;
              const avgWeight = totalOrders > 0 ? (totalWeight / totalOrders).toFixed(2) : '0.00';

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  {/* Card 1: Total Orders */}
                  <div style={{
                    background: 'var(--surface, #ffffff)',
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: '1px solid var(--border, #e2e8f0)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      TỔNG ĐƠN GỬI TRONG THÁNG
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#1e293b', marginTop: 4, fontFamily: 'monospace' }}>
                      {totalOrders.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>đơn</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                      TB cân nặng: <strong>{avgWeight} kg/đơn</strong>
                    </div>
                  </div>

                  {/* Card 2: Total Weight */}
                  <div style={{
                    background: 'var(--surface, #ffffff)',
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: '1px solid var(--border, #e2e8f0)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ fontSize: 11.5, color: '#0284c7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      TỔNG TRỌNG LƯỢNG TÍNH CƯỚC
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0284c7', marginTop: 4, fontFamily: 'monospace' }}>
                      {totalWeight.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span style={{ fontSize: 13, fontWeight: 600 }}>kg</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                      Tổng khối lượng phát sinh từ file
                    </div>
                  </div>

                  {/* Card 3: Total Service Fee (Pre-tax & Post-tax) */}
                  <div style={{
                    background: 'var(--surface, #ffffff)',
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ fontSize: 11.5, color: '#7c3aed', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      DOANH THU CƯỚC CHƯA THUẾ
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#7c3aed', marginTop: 4, fontFamily: 'monospace' }}>
                      {totalFee.toLocaleString('vi-VN')} đ
                    </div>
                    <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>
                      + VAT ({outboundVatRate}%): {totalVat.toLocaleString('vi-VN')} đ = {totalInvoice.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  {/* Card 4: Total Shops */}
                  <div style={{
                    background: 'var(--surface, #ffffff)',
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ fontSize: 11.5, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      SỐ SHOP PHÁT SINH ĐƠN
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', marginTop: 4, fontFamily: 'monospace' }}>
                      {totalShops} <span style={{ fontSize: 13, fontWeight: 600 }}>Shops</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                      Đã phân bổ doanh thu theo từng shop
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. Subtab Navigation & Data Views */}
            {outboundOrders.length > 0 && (
              <div style={{
                background: 'var(--surface, #ffffff)',
                borderRadius: 16,
                border: '1px solid var(--border, #e2e8f0)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
              }}>
                {/* Subtab Header Switcher */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border, #e2e8f0)',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setOutboundSubTab('shops')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: outboundSubTab === 'shops' ? '#4f46e5' : '#ffffff',
                        color: outboundSubTab === 'shops' ? '#ffffff' : '#64748b',
                        boxShadow: outboundSubTab === 'shops' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      🏢 Bảng Phân Bổ Theo Shop ({outboundShopSummaries.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setOutboundSubTab('orders')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: outboundSubTab === 'orders' ? '#4f46e5' : '#ffffff',
                        color: outboundSubTab === 'orders' ? '#ffffff' : '#64748b',
                        boxShadow: outboundSubTab === 'orders' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      📦 Toàn Bộ Đơn Gửi Trong Tháng ({outboundOrders.length.toLocaleString('vi-VN')})
                    </button>
                  </div>

                  {/* Subtab quick info */}
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    Kỳ tính cước: <strong style={{ color: '#1e293b' }}>{outboundSelectedMonth}</strong>
                  </div>
                </div>

                {/* Subtab 1: Shop Summary Breakdown */}
                {outboundSubTab === 'shops' && (
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{
                            borderBottom: '2px solid var(--border, #e2e8f0)',
                            textAlign: 'left',
                            fontSize: 11.5,
                            color: '#475569',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                            background: '#f8fafc'
                          }}>
                            <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>STT</th>
                            <th style={{ padding: '10px 10px', width: 110 }}>Mã Shop</th>
                            <th style={{ padding: '10px 10px' }}>Tên Khách Hàng / Shop</th>
                            <th style={{ padding: '10px 10px' }}>Pháp Nhân & MST</th>
                            <th style={{ padding: '10px 10px', textAlign: 'center' }}>Số Đơn</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng kg</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Đơn Giá TB</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Doanh Thu Cước (đ)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>VAT ({outboundVatRate}%)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng Hóa Đơn (đ)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'center', width: 110 }}>Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outboundShopSummaries.map((shopItem, idx) => {
                            const vat = Math.round(shopItem.totalFee * (outboundVatRate / 100));
                            const total = shopItem.totalFee + vat;

                            return (
                              <tr
                                key={shopItem.shopId + idx}
                                style={{
                                  borderBottom: '1px solid var(--border, #f1f5f9)',
                                  fontSize: 12.5,
                                  background: idx % 2 === 1 ? '#fafafa' : '#ffffff'
                                }}
                              >
                                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 10px' }}>
                                  <span style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 800,
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 11.5
                                  }}>
                                    {shopItem.shopCode}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 10px' }}>
                                  <div style={{ fontWeight: 800, color: '#1e293b' }}>{shopItem.shopName}</div>
                                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>SĐT: {shopItem.phone || '-'}</div>
                                </td>
                                <td style={{ padding: '10px 10px' }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{shopItem.shopLegalName}</div>
                                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>MST: {shopItem.shopTaxCode}</div>
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 800, color: '#1e293b' }}>
                                  {shopItem.orderCount.toLocaleString('vi-VN')}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                                  {shopItem.totalWeight.toFixed(2)}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
                                  {shopItem.avgFee.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#7c3aed', fontFamily: 'monospace' }}>
                                  {shopItem.totalFee.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
                                  {vat.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>
                                  {total.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => exportOutboundSingleShopExcel(shopItem)}
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 11.5,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4
                                    }}
                                    title="Tải bảng kê cước riêng cho shop này"
                                  >
                                    <Download size={12} />
                                    <span>Tải Excel</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          {(() => {
                            const totalOrd = outboundOrders.length;
                            const totalW = outboundOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
                            const totalF = outboundOrders.reduce((sum, o) => sum + (o.calculatedFee || 0), 0);
                            const totalV = Math.round(totalF * (outboundVatRate / 100));
                            const totalAll = totalF + totalV;

                            return (
                              <tr style={{
                                background: '#fef9c3',
                                borderTop: '2px solid #ca8a04',
                                fontWeight: 900,
                                fontSize: 13
                              }}>
                                <td colSpan={4} style={{ padding: '12px 10px', textAlign: 'center', color: '#854d0e' }}>
                                  TỔNG CỘNG ({outboundShopSummaries.length} SHOPS)
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#1e293b' }}>
                                  {totalOrd.toLocaleString('vi-VN')}
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#0284c7', fontFamily: 'monospace' }}>
                                  {totalW.toFixed(2)} kg
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#854d0e', fontFamily: 'monospace' }}>
                                  {totalOrd > 0 ? Math.round(totalF / totalOrd).toLocaleString('vi-VN') : 0} đ
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#7c3aed', fontFamily: 'monospace' }}>
                                  {totalF.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#854d0e', fontFamily: 'monospace' }}>
                                  {totalV.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', color: '#dc2626', fontFamily: 'monospace', fontSize: 14 }}>
                                  {totalAll.toLocaleString('vi-VN')} đ
                                </td>
                                <td></td>
                              </tr>
                            );
                          })()}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Detailed Parcel Table */}
                {outboundSubTab === 'orders' && (
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Filters Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
                        <div style={{
                          position: 'relative',
                          flex: 1,
                          maxWidth: 360
                        }}>
                          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            type="text"
                            placeholder="Tìm mã vận đơn, người nhận, SĐT, tỉnh thành..."
                            value={outboundSearchQuery}
                            onChange={(e) => {
                              setOutboundSearchQuery(e.target.value);
                              setOutboundPage(1);
                            }}
                            style={{
                              width: '100%',
                              padding: '7px 12px 7px 32px',
                              borderRadius: 8,
                              border: '1px solid var(--border, #cbd5e1)',
                              fontSize: 12.5,
                              outline: 'none'
                            }}
                          />
                        </div>

                        {/* Shop Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Filter size={15} color="#64748b" />
                          <select
                            value={outboundShopFilter}
                            onChange={(e) => {
                              setOutboundShopFilter(e.target.value);
                              setOutboundPage(1);
                            }}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--border, #cbd5e1)',
                              fontSize: 12.5,
                              fontWeight: 600,
                              background: '#ffffff',
                              outline: 'none'
                            }}
                          >
                            <option value="ALL">Tất cả Shop ({outboundOrders.length.toLocaleString('vi-VN')} đơn)</option>
                            {outboundShopSummaries.map(s => (
                              <option key={s.shopId} value={s.shopId}>
                                {s.shopName} ({s.shopCode}) - {s.orderCount} đơn
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Pagination Summary */}
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Hiển thị <strong>{Math.min(filteredOutboundOrders.length, (outboundPage - 1) * ordersPerPage + 1)}</strong> - <strong>{Math.min(filteredOutboundOrders.length, outboundPage * ordersPerPage)}</strong> / <strong>{filteredOutboundOrders.length.toLocaleString('vi-VN')}</strong> đơn
                      </div>
                    </div>

                    {/* Table of Orders */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{
                            borderBottom: '2px solid var(--border, #e2e8f0)',
                            textAlign: 'left',
                            fontSize: 11.5,
                            color: '#475569',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 0.3,
                            background: '#f8fafc'
                          }}>
                            <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>STT</th>
                            <th style={{ padding: '10px 10px' }}>Mã Vận Đơn</th>
                            <th style={{ padding: '10px 10px' }}>Ngày Gửi</th>
                            <th style={{ padding: '10px 10px' }}>Shop</th>
                            <th style={{ padding: '10px 10px' }}>Người Nhận</th>
                            <th style={{ padding: '10px 10px' }}>SĐT</th>
                            <th style={{ padding: '10px 10px' }}>Tỉnh / Thành</th>
                            <th style={{ padding: '10px 10px', textAlign: 'center' }}>Cân Nặng (kg)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Cước Thu Shop (đ)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tiền COD (đ)</th>
                            <th style={{ padding: '10px 10px', textAlign: 'center' }}>Trạng Thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOutboundOrders
                            .slice((outboundPage - 1) * ordersPerPage, outboundPage * ordersPerPage)
                            .map((ord, idx) => {
                              const globalIdx = (outboundPage - 1) * ordersPerPage + idx + 1;
                              return (
                                <tr
                                  key={ord.id || globalIdx}
                                  style={{
                                    borderBottom: '1px solid var(--border, #f1f5f9)',
                                    fontSize: 12,
                                    background: idx % 2 === 1 ? '#fafafa' : '#ffffff'
                                  }}
                                >
                                  <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{globalIdx}</td>
                                  <td style={{ padding: '8px 10px', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b' }}>
                                    {ord.waybill}
                                  </td>
                                  <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11.5 }}>
                                    {ord.shipDate}
                                  </td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <div style={{ fontWeight: 700, color: '#334155' }}>{ord.shopName}</div>
                                    <div style={{ fontSize: 10.5, color: '#1d4ed8', fontFamily: 'monospace' }}>{ord.shopCode}</div>
                                  </td>
                                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{ord.receiverName}</td>
                                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{ord.receiverPhone}</td>
                                  <td style={{ padding: '8px 10px' }}>{ord.receiverProvince}</td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                                    {ord.weight.toFixed(2)}
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#7c3aed', fontFamily: 'monospace' }}>
                                    {ord.calculatedFee.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
                                    {ord.codAmount.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <span style={{
                                      background: '#f1f5f9',
                                      color: '#475569',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: '2px 7px',
                                      borderRadius: 4
                                    }}>
                                      {ord.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {Math.ceil(filteredOutboundOrders.length / ordersPerPage) > 1 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderTop: '1px solid var(--border, #e2e8f0)'
                      }}>
                        <button
                          type="button"
                          onClick={() => setOutboundPage(prev => Math.max(1, prev - 1))}
                          disabled={outboundPage === 1}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <ChevronLeft size={14} /> Trang Trước
                        </button>

                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                          Trang {outboundPage} / {Math.ceil(filteredOutboundOrders.length / ordersPerPage)}
                        </div>

                        <button
                          type="button"
                          onClick={() => setOutboundPage(prev => Math.min(Math.ceil(filteredOutboundOrders.length / ordersPerPage), prev + 1))}
                          disabled={outboundPage >= Math.ceil(filteredOutboundOrders.length / ordersPerPage)}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          Trang Tiếp <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 🏢 FOOTER THÔNG TIN ĐƠN VỊ PHÁT TRIỂN PHẦN MỀM (TQ DIGITAL) */}
      <SoftwareDeveloperFooter />

      {/* 👁️ MODAL: CHI TIẾT TOÀN BỘ ĐƠN HÀNG THÁNG CỦA SHOP (XUẤT HÓA ĐƠN GTGT) */}
      {viewingShopOrders && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 110,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 1100,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid var(--border, #e2e8f0)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 22px',
              borderBottom: '1.5px solid var(--border, #e2e8f0)',
              background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                  <span>TOÀN BỘ ĐƠN HÀNG THÁNG {selectedMonth}/{selectedYear}:</span>
                  <span style={{ color: '#1d4ed8' }}>{viewingShopOrders.shopName}</span>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}>
                    {viewingShopOrders.shopCode}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  SĐT: <strong>{viewingShopOrders.phone || '-'}</strong> • STK/Ngân hàng: <strong>{viewingShopOrders.bankInfo || 'Chưa cập nhật'}</strong> • Tổng số <strong>{viewingShopOrders.orders.length}</strong> đơn gửi trong tháng
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Single Shop Excel Export Button */}
                <button
                  type="button"
                  onClick={() => exportShopMonthlyInvoiceStatement(viewingShopOrders)}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: 'transparent',
                    color: '#ffffff',
                    padding: '7px 14px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                  }}
                  title="Tải Bảng Kê Chi Tiết Cước Đính Kèm Hóa Đơn GTGT (.xlsx)"
                >
                  <Download size={14} />
                  <span>Xuất Bảng Kê Hóa Đơn Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingShopOrders(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '7px', borderRadius: 8 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick KPI in Modal */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 10,
              padding: '12px 22px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--border, #e2e8f0)'
            }}>
              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>TỔNG ĐƠN HÀNG</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', marginTop: 2 }}>
                  {viewingShopOrders.orders.length} <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>đơn</span>
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase' }}>TỔNG TIỀN COD</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#1d4ed8', marginTop: 2, fontFamily: 'monospace' }}>
                  {viewingShopOrders.totalCod.toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>CƯỚC TRƯỚC THUẾ</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#7e22ce', marginTop: 2, fontFamily: 'monospace' }}>
                  {viewingShopOrders.totalServiceFee.toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecdd3' }}>
                <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>TỔNG HÓA ĐƠN (+VAT {vatRate}%)</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#dc2626', marginTop: 2, fontFamily: 'monospace' }}>
                  {(viewingShopOrders.totalServiceFee + Math.round(viewingShopOrders.totalServiceFee * (vatRate / 100))).toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                <div style={{ fontSize: 10, color: '#047857', fontWeight: 800, textTransform: 'uppercase' }}>THỰC CHUYỂN SHOP</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#047857', marginTop: 2, fontFamily: 'monospace' }}>
                  {viewingShopOrders.totalNetPayout.toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>

            {/* Search Filter Bar inside Modal */}
            <div style={{ padding: '8px 22px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff' }}>
              <Search size={14} color="#64748b" />
              <input
                type="text"
                placeholder="Tìm theo mã vận đơn, tên người nhận, số điện thoại..."
                value={modalOrderSearch}
                onChange={(e) => setModalOrderSearch(e.target.value)}
                className="input-field"
                style={{ flex: 1, padding: '5px 10px', fontSize: 12, height: 32, borderRadius: 6 }}
              />
              {modalOrderSearch && (
                <button
                  type="button"
                  onClick={() => setModalOrderSearch('')}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                >
                  Xóa Lọc
                </button>
              )}
            </div>

            {/* Modal Table Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <tr style={{ borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 11.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    <th style={{ padding: '10px 8px', width: 35, textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '10px 10px', width: 110 }}>Kỳ / Ngày</th>
                    <th style={{ padding: '10px 10px', width: 140 }}>Mã Vận Đơn</th>
                    <th style={{ padding: '10px 10px' }}>Người Nhận</th>
                    <th style={{ padding: '10px 10px', width: 110 }}>SĐT Nhận</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', width: 80 }}>TL (kg)</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center', width: 110 }}>Trạng Thái</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tiền COD</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>Cước Trước Thuế</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>VAT ({vatRate}%)</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tổng Tiền Cước</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingShopOrders.orders
                    .filter((ord: any) => {
                      if (!modalOrderSearch) return true;
                      const q = modalOrderSearch.toLowerCase();
                      return (
                        (ord.waybill || '').toLowerCase().includes(q) ||
                        (ord.receiverName || '').toLowerCase().includes(q) ||
                        (ord.receiverPhone || '').toLowerCase().includes(q) ||
                        (ord.sessionName || '').toLowerCase().includes(q)
                      );
                    })
                    .map((ord: any, idx: number) => {
                      const orderFee = ord.shopCalculatedFee !== undefined ? ord.shopCalculatedFee : (ord.fee || 0);
                      const vat = Math.round(orderFee * (vatRate / 100));
                      const total = orderFee + vat;
                      const dateStr = ord.sessionName || (ord.sessionDate ? ord.sessionDate.slice(0, 10) : '-');

                      return (
                        <tr key={ord.id || idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: 12 }}>
                          <td style={{ padding: '8px 4px', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11.5 }}>{dateStr}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b' }}>
                            {ord.waybill}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{ord.receiverName || '-'}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{ord.receiverPhone || '-'}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 600 }}>{(ord.weight || 0.5).toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{
                              background: ord.status === 'delivered' ? '#dcfce7' : (ord.status === 'returned' ? '#fee2e2' : '#f1f5f9'),
                              color: ord.status === 'delivered' ? '#166534' : (ord.status === 'returned' ? '#991b1b' : '#64748b'),
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 4
                            }}>
                              {ord.status === 'delivered' ? 'Giao thành công' : (ord.status === 'returned' ? 'Đã hoàn' : (ord.statusText || ord.status))}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
                            {(ord.codAmount || 0).toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#7e22ce', fontFamily: 'monospace' }}>
                            {orderFee.toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
                            {vat.toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>
                            {total.toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-app, #f8fafc)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: 13 }}>
                Tổng cước hóa đơn (+VAT {vatRate}%): <strong style={{ color: '#dc2626', fontSize: 15 }}>
                  {(viewingShopOrders.totalServiceFee + Math.round(viewingShopOrders.totalServiceFee * (vatRate / 100))).toLocaleString('vi-VN')} đ
                </strong>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>•</span>
                Thực chuyển Shop: <strong style={{ color: '#047857', fontSize: 15 }}>{viewingShopOrders.totalNetPayout.toLocaleString('vi-VN')} đ</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => exportShopMonthlyInvoiceStatement(viewingShopOrders)}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: 'transparent',
                    color: '#ffffff',
                    padding: '7px 16px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Download size={15} /> Tải Bảng Kê Excel Cho Shop Này
                </button>

                <button
                  type="button"
                  onClick={() => setViewingShopOrders(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '7px 14px', borderRadius: 8 }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🏢 FOOTER THÔNG TIN ĐƠN VỊ PHÁT TRIỂN PHẦN MỀM (TQ DIGITAL) */}
      <SoftwareDeveloperFooter />

      {/* 👁️ MODAL: CHI TIẾT ĐƠN HÀNG CỦA SHOP PRO                                */}
      {selectedSession && selectedShopStmt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 1040,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid var(--border, #e2e8f0)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 22px',
              borderBottom: '1.5px solid var(--border, #e2e8f0)',
              background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                  <span>CHI TIẾT ĐƠN HÀNG:</span>
                  <span style={{ color: '#4f46e5' }}>{selectedShopStmt.shopName}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Kỳ đối soát: <strong>{selectedSession.sessionName}</strong> • Tổng cộng <strong>{selectedShopStmt.orders?.length || 0}</strong> đơn hàng
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => exportSingleShopExcel(selectedSession.sessionName, selectedShopStmt)}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: 'transparent',
                    color: '#ffffff',
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Xuất file Excel cho shop này"
                >
                  <Download size={13} />
                  <span>Xuất Excel Shop</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSession(null);
                    setSelectedShopStmt(null);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px', borderRadius: 8 }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick KPI in Modal */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              padding: '12px 22px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--border, #e2e8f0)'
            }}>
              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10.5, color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase' }}>TỔNG TIỀN COD</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#1d4ed8', marginTop: 2, fontFamily: 'monospace' }}>
                  {selectedShopStmt.totalCod.toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10.5, color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase' }}>CƯỚC DỊCH VỤ</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#7e22ce', marginTop: 2, fontFamily: 'monospace' }}>
                  {(selectedShopStmt.totalShopFee + selectedShopStmt.totalShopOtherFee).toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: 10.5, color: '#047857', fontWeight: 800, textTransform: 'uppercase' }}>THỰC TRẢ SHOP</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#047857', marginTop: 2, fontFamily: 'monospace' }}>
                  {selectedShopStmt.totalNetPayout.toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>

            {/* Modal Table Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
                  <tr style={{ borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 11.5, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '10px 10px' }}>Mã Vận Đơn</th>
                    <th style={{ padding: '10px 10px' }}>Người Nhận</th>
                    <th style={{ padding: '10px 10px' }}>SĐT</th>
                    <th style={{ padding: '10px 10px', textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>Tiền COD</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>Cước Dịch Vụ</th>
                    <th style={{ padding: '10px 10px', textAlign: 'right' }}>Thực Chuyển</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedShopStmt.orders || []).map((ord: ReconciledOrder, idx: number) => (
                    <tr key={ord.id || idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: 12 }}>
                      <td style={{ padding: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 700, fontFamily: 'monospace' }}>{ord.waybill}</td>
                      <td style={{ padding: '8px' }}>{ord.receiverName || '-'}</td>
                      <td style={{ padding: '8px' }}>{ord.receiverPhone || '-'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          background: ord.status === 'delivered' ? '#dcfce7' : '#f1f5f9',
                          color: ord.status === 'delivered' ? '#166534' : '#64748b',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          {ord.statusText || ord.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                        {ord.codAmount.toLocaleString('vi-VN')} đ
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                        {(ord.shopCalculatedFee + ord.shopOtherFee).toLocaleString('vi-VN')} đ
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        {ord.netShopPayout.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-app, #f8fafc)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: 13 }}>
                Tổng Thực Chuyển: <strong style={{ color: '#16a34a', fontSize: 15 }}>{selectedShopStmt.totalNetPayout.toLocaleString('vi-VN')} đ</strong>
              </div>

              <button
                onClick={() => exportSingleShopExcel(selectedSession.sessionName, selectedShopStmt)}
                className="btn btn-primary"
                style={{ background: '#7c3aed', borderColor: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} /> Tải Excel Cho Shop Này
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
