import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
  Sun, 
  Moon, 
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
  Globe
} from 'lucide-react';
import { useToast, useConfirm } from './UIFeedback';
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
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  onLogout: () => void;
}

// Brand color palette helper for carrier cards
const CARRIER_THEMES: Record<string, { bgGradient: string; border: string; badgeBg: string; badgeText: string; accentColor: string }> = {
  jnt: {
    bgGradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(220, 38, 38, 0.04) 100%)',
    border: 'rgba(239, 68, 68, 0.35)',
    badgeBg: '#fee2e2',
    badgeText: '#b91c1c',
    accentColor: '#dc2626',
  },
  ghn: {
    bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.04) 100%)',
    border: 'rgba(249, 115, 22, 0.35)',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    accentColor: '#ea580c',
  },
  vtp: {
    bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(29, 78, 216, 0.04) 100%)',
    border: 'rgba(37, 99, 235, 0.35)',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
    accentColor: '#2563eb',
  },
  spx: {
    bgGradient: 'linear-gradient(135deg, rgba(234, 88, 12, 0.12) 0%, rgba(244, 63, 94, 0.04) 100%)',
    border: 'rgba(234, 88, 12, 0.35)',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    accentColor: '#f97316',
  },
  ghtk: {
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.04) 100%)',
    border: 'rgba(16, 185, 129, 0.35)',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    accentColor: '#059669',
  },
};

const DEFAULT_THEME = {
  bgGradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(79, 70, 229, 0.04) 100%)',
  border: 'rgba(99, 102, 241, 0.35)',
  badgeBg: '#e0e7ff',
  badgeText: '#4338ca',
  accentColor: '#4f46e5',
};

export const TaxAccountantPortal: React.FC<TaxAccountantPortalProps> = ({
  currentUser,
  carriers = [],
  sessions = [],
  shops = [],
  theme,
  setTheme,
  onLogout,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  // Active carrier selection: null = Hub view (select carrier card), 'all' | carrierId = inside carrier workspace
  const [activeCarrierId, setActiveCarrierId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'sessions' | 'shops' | 'monthly'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [hubSearchTerm, setHubSearchTerm] = useState('');
  
  // Selected session for viewing details modal
  const [selectedSession, setSelectedSession] = useState<ReconciliationSession | null>(null);
  const [selectedShopStmt, setSelectedShopStmt] = useState<ShopSettlementStatement | null>(null);

  // Date range filter for monthly/quarterly tax report
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);

  // Compute live statistics per carrier for the Hub cards
  const carrierStats = useMemo(() => {
    const statsMap = new Map<string, { shopCount: number; sessionCount: number; orderCount: number; totalCod: number; totalServiceFee: number; totalNetPayout: number; lastSessionDate?: string }>();

    carriers.forEach(c => {
      const cShops = shops.filter(s => (s.carrierId || 'jnt') === c.carrierId);
      const cSessions = sessions.filter(sess => (sess.carrierId || 'jnt') === c.carrierId);
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
  }, [carriers, shops, sessions]);

  // Active carrier metadata
  const activeCarrierObj = useMemo(() => {
    if (!activeCarrierId || activeCarrierId === 'all') return null;
    return carriers.find(c => c.carrierId === activeCarrierId) || {
      id: activeCarrierId,
      carrierId: activeCarrierId,
      carrierName: activeCarrierId.toUpperCase(),
    };
  }, [carriers, activeCarrierId]);

  // Filtered carriers for Hub
  const filteredCarriers = useMemo(() => {
    if (!hubSearchTerm) return carriers;
    const term = hubSearchTerm.toLowerCase();
    return carriers.filter(c => 
      c.carrierName.toLowerCase().includes(term) || 
      c.carrierId.toLowerCase().includes(term)
    );
  }, [carriers, hubSearchTerm]);

  // Filtered sessions for the selected carrier
  const filteredSessions = useMemo(() => {
    return sessions.filter(sess => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (sess.carrierId || 'jnt') === activeCarrierId;
      const name = sess.sessionName || '';
      const matchSearch = !searchQuery || 
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sess.carrierId && sess.carrierId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sess.carrierName && sess.carrierName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCarrier && matchSearch;
    });
  }, [sessions, activeCarrierId, searchQuery]);

  // Filtered shops for the selected carrier
  const filteredShops = useMemo(() => {
    return shops.filter(s => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (s.carrierId || 'jnt') === activeCarrierId;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.bankAccount?.accountNumber && s.bankAccount.accountNumber.includes(q));
      return matchCarrier && matchSearch;
    });
  }, [shops, activeCarrierId, searchQuery]);

  // Aggregated data for Monthly/Quarterly report for the selected carrier
  const monthlyAggregatedData = useMemo(() => {
    const from = new Date(fromDate).getTime();
    const to = new Date(toDate + 'T23:59:59').getTime();

    const inRangeSessions = sessions.filter(sess => {
      const matchCarrier = !activeCarrierId || activeCarrierId === 'all' || (sess.carrierId || 'jnt') === activeCarrierId;
      const sessDate = new Date(sess.createdAt).getTime();
      return matchCarrier && sessDate >= from && sessDate <= to;
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
    }>();

    inRangeSessions.forEach(sess => {
      totalOrders += sess.totalOrders;
      totalCod += sess.totalCod;
      totalServiceRevenue += (sess.totalShopRevenue || 0);
      totalNetPayout += sess.totalNetPayout;

      (sess.statements || []).forEach(stmt => {
        const key = stmt.shopId || stmt.shopName;
        if (!shopMap.has(key)) {
          const shopObj = shops.find(s => s.id === stmt.shopId || s.name === stmt.shopName);
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
          });
        }

        const sData = shopMap.get(key)!;
        sData.sessionCount += 1;
        sData.totalOrders += stmt.totalOrders;
        sData.totalCod += stmt.totalCod;
        sData.totalServiceFee += (stmt.totalShopFee + stmt.totalShopOtherFee);
        sData.totalNetPayout += stmt.totalNetPayout;
      });
    });

    return {
      sessionCount: inRangeSessions.length,
      totalOrders,
      totalCod,
      totalServiceRevenue,
      totalNetPayout,
      shopBreakdown: Array.from(shopMap.values()).sort((a, b) => b.totalOrders - a.totalOrders),
    };
  }, [sessions, shops, activeCarrierId, fromDate, toDate]);

  // --------------------------------------------------------------------------
  // EXPORT 1: Multi-Sheet Excel for Single Session
  // --------------------------------------------------------------------------
  const exportSessionMultiSheet = (session: ReconciliationSession) => {
    try {
      const wb = XLSX.utils.book_new();
      const sessTitle = session.sessionName || 'Kỳ đối soát';

      // Sheet 1: Tổng Hợp Các Shop
      const summaryRows: any[][] = [
        ['BẢNG TỔNG HỢP ĐỐI SOÁT DOANH THU & COD KHÁCH HÀNG (BÁO CÁO THUẾ)'],
        [`Kỳ đối soát: ${sessTitle}`],
        [`Hãng vận chuyển: ${(session.carrierName || session.carrierId || 'jnt').toUpperCase()} | Ngày lập: ${new Date(session.createdAt).toLocaleDateString('vi-VN')}`],
        [],
        ['STT', 'Mã Shop', 'Tên Shop / Khách Hàng', 'Số Điện Thoại', 'Tài Khoản Ngân Hàng', 'Tổng Số Đơn', 'Tổng COD Thu Hộ (VNĐ)', 'Doanh Thu Cước Dịch Vụ (VNĐ)', 'Thực Trả Khách Hàng (VNĐ)']
      ];

      (session.statements || []).forEach((stmt, idx) => {
        const bankStr = stmt.bankInfo?.accountNumber 
          ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber} (${stmt.bankInfo.accountHolder || ''})`
          : 'Chưa cập nhật';
        summaryRows.push([
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
      });

      // Total Row
      summaryRows.push([
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

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'TỔNG HỢP CÁC SHOP');

      // Sheets 2..N: Individual Shop Detail Tabs
      (session.statements || []).forEach((stmt) => {
        const cleanSheetName = (stmt.shopName || 'Shop')
          .replace(/[\\/*?:[\]]/g, '')
          .slice(0, 30);

        const shopRows: any[][] = [
          [`CHI TIẾT ĐỐI SOÁT - ${stmt.shopName.toUpperCase()}`],
          [`Mã Shop: ${stmt.shopCode || '-'} | SĐT: ${stmt.shopPhone || '-'} | Kỳ: ${sessTitle}`],
          [`STK: ${stmt.bankInfo?.accountNumber || '-'} - ${stmt.bankInfo?.bankName || ''} (${stmt.bankInfo?.accountHolder || ''})`],
          [`Tổng đơn: ${stmt.totalOrders} | Tổng COD: ${stmt.totalCod.toLocaleString('vi-VN')} đ | Cước dịch vụ: ${(stmt.totalShopFee + stmt.totalShopOtherFee).toLocaleString('vi-VN')} đ | Thực nhận: ${stmt.totalNetPayout.toLocaleString('vi-VN')} đ`],
          [],
          ['STT', 'Mã Vận Đơn', 'Người Nhận', 'Số Điện Thoại', 'Địa Chỉ Nhận', 'Ngày Tạo / Gửi', 'Trạng Thái', 'Tiền COD (VNĐ)', 'Cước Phí Dịch Vụ (VNĐ)', 'Thực Chuyển Đơn (VNĐ)']
        ];

        (stmt.orders || []).forEach((ord: ReconciledOrder, oIdx: number) => {
          const dateStr = ord.rawNvcData?.['Ngày tạo'] || ord.rawNvcData?.['Ngày gửi'] || ord.rawAppData?.['Ngày tạo'] || '-';
          shopRows.push([
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
        });

        const wsShop = XLSX.utils.aoa_to_sheet(shopRows);
        XLSX.utils.book_append_sheet(wb, wsShop, cleanSheetName);
      });

      const safeName = sessTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      XLSX.writeFile(wb, `Bao_Cao_Thue_Tong_Hop_${safeName}.xlsx`);
      showToast('Đã tải thành công file báo cáo tổng hợp đa Tab!', 'success');
    } catch (err: any) {
      showToast('Lỗi khi xuất file Excel: ' + (err?.message || err), 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 2: Single Shop Excel File
  // --------------------------------------------------------------------------
  const exportSingleShopExcel = (sessionName: string, stmt: ShopSettlementStatement) => {
    try {
      const wb = XLSX.utils.book_new();
      const shopRows: any[][] = [
        [`BIÊN BẢN ĐỐI SOÁT DOANH THU & CƯỚC DỊCH VỤ`],
        [`Đơn vị / Shop: ${stmt.shopName.toUpperCase()}`],
        [`Mã khách hàng: ${stmt.shopCode || '-'} | SĐT: ${stmt.shopPhone || '-'}`],
        [`Kỳ đối soát: ${sessionName}`],
        [`Tài khoản nhận tiền: ${stmt.bankInfo?.bankName || ''} - ${stmt.bankInfo?.accountNumber || ''} (${stmt.bankInfo?.accountHolder || ''})`],
        [],
        ['TỔNG KẾT DOANH THU & TIỀN THANH TOÁN', ''],
        ['Tổng số đơn hàng thực hiện:', stmt.totalOrders],
        ['Tổng tiền COD thu hộ:', stmt.totalCod],
        ['Doanh thu cước dịch vụ vận chuyển:', stmt.totalShopFee + stmt.totalShopOtherFee],
        ['Tổng tiền thực nhận (Chuyển khoản):', stmt.totalNetPayout],
        [],
        ['BẢNG KÊ CHI TIẾT CÁC ĐƠN HÀNG TRONG KỲ', ''],
        ['STT', 'Mã Vận Đơn', 'Người Nhận', 'SĐT Nhận', 'Địa Chỉ', 'Ngày Gửi', 'Trạng Thái Đơn', 'Tiền COD (VNĐ)', 'Cước Phí Dịch Vụ (VNĐ)', 'Thực Nhận Từng Đơn (VNĐ)']
      ];

      (stmt.orders || []).forEach((ord: ReconciledOrder, idx: number) => {
        const dateStr = ord.rawNvcData?.['Ngày tạo'] || ord.rawNvcData?.['Ngày gửi'] || ord.rawAppData?.['Ngày tạo'] || '-';
        shopRows.push([
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
      });

      const ws = XLSX.utils.aoa_to_sheet(shopRows);
      XLSX.utils.book_append_sheet(wb, ws, 'BIÊN BẢN ĐỐI SOÁT');

      const safeShop = stmt.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
      XLSX.writeFile(wb, `BBDS_${safeShop}_${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      showToast(`Đã xuất biên bản cho Shop ${stmt.shopName}!`, 'success');
    } catch (err: any) {
      showToast('Lỗi khi xuất file: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 3: ZIP Package containing all shop files
  // --------------------------------------------------------------------------
  const exportSessionZipPackage = async (session: ReconciliationSession) => {
    try {
      showToast('Đang khởi tạo gói file ZIP trọn bộ các Shop...', 'info');
      const zip = new JSZip();
      const sessTitle = session.sessionName || 'Kỳ đối soát';

      (session.statements || []).forEach(stmt => {
        const wb = XLSX.utils.book_new();
        const shopRows: any[][] = [
          [`BIÊN BẢN ĐỐI SOÁT DỊCH VỤ GIAO HÀNG`],
          [`Khách hàng: ${stmt.shopName.toUpperCase()}`],
          [`Mã: ${stmt.shopCode || '-'} | SĐT: ${stmt.shopPhone || '-'} | Kỳ: ${sessTitle}`],
          [`STK: ${stmt.bankInfo?.bankName || ''} - ${stmt.bankInfo?.accountNumber || ''} (${stmt.bankInfo?.accountHolder || ''})`],
          [],
          ['Tổng số đơn:', stmt.totalOrders],
          ['Tổng tiền COD thu hộ:', stmt.totalCod],
          ['Doanh thu cước dịch vụ:', stmt.totalShopFee + stmt.totalShopOtherFee],
          ['Tổng thanh toán chuyển khoản:', stmt.totalNetPayout],
          [],
          ['STT', 'Mã Vận Đơn', 'Người Nhận', 'SĐT', 'Địa Chỉ', 'Ngày Giao', 'Trạng Thái', 'Tiền COD (VNĐ)', 'Cước Phí (VNĐ)', 'Thực Chuyển (VNĐ)']
        ];

        (stmt.orders || []).forEach((ord: ReconciledOrder, idx: number) => {
          const dateStr = ord.rawNvcData?.['Ngày tạo'] || ord.rawNvcData?.['Ngày gửi'] || ord.rawAppData?.['Ngày tạo'] || '-';
          shopRows.push([
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
        });

        const ws = XLSX.utils.aoa_to_sheet(shopRows);
        XLSX.utils.book_append_sheet(wb, ws, 'BIÊN BẢN');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const safeShop = stmt.shopName.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
        zip.file(`BBDS_${safeShop}.xlsx`, wbout);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Goi_File_Doi_Soat_Shop_${sessTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);

      showToast('Đã tải thành công trọn bộ file ZIP!', 'success');
    } catch (err: any) {
      showToast('Lỗi nén file ZIP: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 4: Flat Data Table for MISA / FAST Accounting Software Import
  // --------------------------------------------------------------------------
  const exportFlatMisaData = (session: ReconciliationSession) => {
    try {
      const sessTitle = session.sessionName || 'Kỳ đối soát';
      const rows: any[][] = [
        [
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
        ]
      ];

      (session.statements || []).forEach(stmt => {
        (stmt.orders || []).forEach((ord: ReconciledOrder) => {
          rows.push([
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
        });
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'DU_LIEU_MISA');

      XLSX.writeFile(wb, `Du_Lieu_Ke_Toan_MISA_${sessTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
      showToast('Đã xuất bảng kê dạng phẳng chuẩn import phần mềm kế toán!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất dữ liệu: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 5: Shop Legal Directory for Tax Declaration
  // --------------------------------------------------------------------------
  const exportShopLegalDirectory = () => {
    try {
      const carrierLabel = activeCarrierObj ? activeCarrierObj.carrierName : 'Tất Cả Hãng';
      const rows: any[][] = [
        [`DANH MỤC KHÁCH HÀNG & THÔNG TIN PHÁP LÝ KHAI THUẾ - ${carrierLabel.toUpperCase()}`],
        [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`],
        [],
        ['STT', 'Mã Khách Hàng', 'Tên Đơn Vị / Shop', 'Số Điện Thoại', 'Email', 'Địa Chỉ Kinh Doanh', 'Ngân Hàng', 'Số Tài Khoản', 'Chủ Tài Khoản', 'Trạng Thái']
      ];

      filteredShops.forEach((s, idx) => {
        rows.push([
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
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'DANH_SACH_SHOP');

      const safeCarrier = carrierLabel.replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `Danh_Sach_Khach_Hang_Khai_Thue_${safeCarrier}_${todayStr}.xlsx`);
      showToast('Đã xuất danh bạ khách hàng khai thuế thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất danh bạ shop: ' + err?.message, 'error');
    }
  };

  // --------------------------------------------------------------------------
  // EXPORT 6: Monthly / Quarterly Consolidated Tax Report
  // --------------------------------------------------------------------------
  const exportMonthlyConsolidatedTaxReport = () => {
    try {
      const carrierLabel = activeCarrierObj ? activeCarrierObj.carrierName : 'Tất Cả Hãng';
      const rows: any[][] = [
        [`BÁO CÁO DOANH THU DỊCH VỤ VẬN CHUYỂN & DÒNG TIỀN COD (${carrierLabel.toUpperCase()})`],
        [`Thời gian: Từ ngày ${fromDate} đến ngày ${toDate}`],
        [`Tổng số kỳ đối soát: ${monthlyAggregatedData.sessionCount} kỳ | Tổng số đơn: ${monthlyAggregatedData.totalOrders.toLocaleString('vi-VN')}`],
        [`Tổng tiền COD luân chuyển: ${monthlyAggregatedData.totalCod.toLocaleString('vi-VN')} đ`],
        [`Tổng Doanh Thu Cước Dịch Vụ (Chưa VAT): ${monthlyAggregatedData.totalServiceRevenue.toLocaleString('vi-VN')} đ`],
        [`Tổng Thực Chi Trả Khách Hàng: ${monthlyAggregatedData.totalNetPayout.toLocaleString('vi-VN')} đ`],
        [],
        ['STT', 'Mã Khách Hàng', 'Tên Khách Hàng / Shop', 'Số Điện Thoại', 'Tài Khoản Ngân Hàng', 'Số Kỳ Tham Gia', 'Tổng Số Đơn', 'Tổng COD Thu Hộ (VNĐ)', 'Doanh Thu Cước Dịch Vụ (VNĐ)', 'Tổng Thực Trả (VNĐ)']
      ];

      monthlyAggregatedData.shopBreakdown.forEach((s, idx) => {
        rows.push([
          idx + 1,
          s.shopCode,
          s.shopName,
          s.phone,
          s.bankInfo,
          s.sessionCount,
          s.totalOrders,
          s.totalCod,
          s.totalServiceFee,
          s.totalNetPayout
        ]);
      });

      rows.push([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        monthlyAggregatedData.sessionCount,
        monthlyAggregatedData.totalOrders,
        monthlyAggregatedData.totalCod,
        monthlyAggregatedData.totalServiceRevenue,
        monthlyAggregatedData.totalNetPayout
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'BAO_CAO_THUE_TONG_HOP');

      const safeCarrier = carrierLabel.replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `Bao_Cao_Doanh_Thu_Thue_${safeCarrier}_${fromDate}_den_${toDate}.xlsx`);
      showToast('Đã xuất báo cáo thuế định kỳ thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi xuất báo cáo định kỳ: ' + err?.message, 'error');
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
      <div style={{ minHeight: '100vh', background: 'var(--bg-app, #f8fafc)', color: 'var(--text-main, #1e293b)', display: 'flex', flexDirection: 'column' }}>
        
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

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn btn-secondary"
              style={{ padding: '8px 12px', borderRadius: 8 }}
              title="Đổi giao diện Sáng / Tối"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

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
              const theme = CARRIER_THEMES[carrier.carrierId] || DEFAULT_THEME;
              const stats = carrierStats.get(carrier.carrierId) || { shopCount: 0, sessionCount: 0, orderCount: 0, totalCod: 0, totalServiceFee: 0, totalNetPayout: 0, lastSessionDate: undefined };

              return (
                <div
                  key={carrier.id}
                  onClick={() => {
                    setActiveCarrierId(carrier.carrierId);
                    setActiveTab('sessions');
                  }}
                  style={{
                    background: 'var(--surface, #ffffff)',
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
                    e.currentTarget.style.boxShadow = '0 12px 30px -4px rgba(124, 58, 237, 0.2)';
                    e.currentTarget.style.borderColor = '#7c3aed';
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
                    background: theme.bgGradient,
                  }} />

                  {/* Card Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          background: theme.bgGradient,
                          border: `1.5px solid ${theme.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: theme.accentColor,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
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
                      background: 'var(--bg-app, #f8fafc)',
                      borderRadius: 12,
                      padding: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Store size={12} />
                          <span>Shop:</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
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
                        background: '#7c3aed',
                        borderColor: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 700,
                        padding: '8px 16px',
                        borderRadius: 10,
                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
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
      </div>
    );
  }

  // =========================================================================
  // LEVEL 2: INSIDE CARRIER TAX WORKSPACE (GHN / J&T / ALL)
  // =========================================================================
  const currentCarrierTitle = activeCarrierId === 'all' 
    ? 'HỢP NHẤT TOÀN BỘ HÃNG' 
    : (activeCarrierObj?.carrierName || activeCarrierId.toUpperCase());
  
  const currentCarrierTheme = CARRIER_THEMES[activeCarrierId] || DEFAULT_THEME;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app, #f8fafc)', color: 'var(--text-main, #1e293b)', display: 'flex', flexDirection: 'column' }}>
      
      {/* 🏛️ TOP NAVIGATION BAR */}
      <header style={{
        background: 'var(--surface, #ffffff)',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Back to Carrier Hub Button */}
          <button
            onClick={() => setActiveCarrierId(null)}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 700,
              padding: '8px 12px',
              borderRadius: 8,
              background: '#f1f5f9',
            }}
            title="Quay lại danh sách thẻ hãng"
          >
            <ArrowLeft size={16} />
            <span>Đổi Hãng Vận Chuyển</span>
          </button>

          <div style={{ width: 1, height: 28, background: 'var(--border, #e2e8f0)' }} />

          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: activeCarrierId === 'all' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : currentCarrierTheme.bgGradient,
            border: `1.5px solid ${currentCarrierTheme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: activeCarrierId === 'all' ? '#fff' : currentCarrierTheme.accentColor,
          }}>
            <Truck size={20} />
          </div>

          <div>
            <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
              {currentCarrierTitle}
              <span style={{ fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                TAX WORKSPACE
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
              Không gian xuất bảng kê thuế & đối soát dữ liệu của hãng {currentCarrierTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* User badge */}
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
            <span className="badge badge-primary" style={{ fontSize: 10, background: '#7c3aed', color: '#fff' }}>Kế Toán Thuế</span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', borderRadius: 8 }}
            title="Đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

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

      {/* 🧭 TAB NAVIGATION BAR */}
      <div style={{
        background: 'var(--surface, #ffffff)',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        padding: '0 24px',
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={() => setActiveTab('sessions')}
          style={{
            padding: '14px 20px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: activeTab === 'sessions' ? '#7c3aed' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'sessions' ? '3px solid #7c3aed' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <FileSpreadsheet size={18} />
          1. BÁO CÁO ĐỐI SOÁT THEO KỲ ({filteredSessions.length})
        </button>

        <button
          onClick={() => setActiveTab('shops')}
          style={{
            padding: '14px 20px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: activeTab === 'shops' ? '#7c3aed' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'shops' ? '3px solid #7c3aed' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <Store size={18} />
          2. DANH MỤC KHÁCH HÀNG / SHOP ({filteredShops.length})
        </button>

        <button
          onClick={() => setActiveTab('monthly')}
          style={{
            padding: '14px 20px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: activeTab === 'monthly' ? '#7c3aed' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'monthly' ? '3px solid #7c3aed' : '3px solid transparent',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={18} />
          3. BÁO CÁO THUẾ TỔNG HỢP (THÁNG / QUÝ)
        </button>
      </div>

      {/* 📦 MAIN CONTENT BODY */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1440, width: '100%', margin: '0 auto' }}>

        {/* ========================================================================= */}
        {/* TAB 1: BÁO CÁO ĐỐI SOÁT THEO KỲ                                           */}
        {/* ========================================================================= */}
        {activeTab === 'sessions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Filter & Search Bar */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              padding: '16px 20px',
              borderRadius: 12,
              border: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={`Tìm theo tên kỳ đối soát của ${currentCarrierTitle}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 36, width: '100%' }}
                />
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Hiển thị: <strong>{filteredSessions.length}</strong> kỳ đối soát ({currentCarrierTitle})
              </div>
            </div>

            {/* Sessions Cards / List */}
            {filteredSessions.length === 0 ? (
              <div style={{
                background: 'var(--surface, #ffffff)',
                padding: '60px 20px',
                borderRadius: 12,
                textAlign: 'center',
                border: '1px dashed var(--border, #cbd5e1)'
              }}>
                <FileSpreadsheet size={48} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 16, fontWeight: 700 }}>Chưa có kỳ đối soát nào cho {currentCarrierTitle}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Khi bộ phận đối soát hoàn tất phiên của hãng này, số liệu sẽ tự động hiển thị tại đây để kế toán tải file.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredSessions.map((sess) => {
                  const carrierBadgeColor = (sess.carrierId || 'jnt') === 'ghn' ? '#f97316' : '#ef4444';
                  const carrierName = sess.carrierName || ((sess.carrierId || 'jnt') === 'ghn' ? 'GHN' : 'J&T Express');
                  const sessTitle = sess.sessionName || 'Kỳ đối soát';

                  return (
                    <div
                      key={sess.id}
                      style={{
                        background: 'var(--surface, #ffffff)',
                        borderRadius: 14,
                        border: '1px solid var(--border, #e2e8f0)',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      }}
                    >
                      {/* Session Header Card */}
                      <div style={{
                        padding: '18px 22px',
                        borderBottom: '1px solid var(--border, #f1f5f9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 16,
                        background: 'linear-gradient(to right, rgba(124, 58, 237, 0.02), transparent)'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              background: carrierBadgeColor,
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 6
                            }}>
                              {carrierName}
                            </span>
                            <span style={{ fontSize: 17, fontWeight: 800 }}>{sessTitle}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            Ngày tạo: {new Date(sess.createdAt).toLocaleDateString('vi-VN')} lúc {new Date(sess.createdAt).toLocaleTimeString('vi-VN')} • {sess.statements?.length || 0} Shop đối soát
                          </div>
                        </div>

                        {/* 4 Multi-Download Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* 1. Tải file tổng đa Sheet */}
                          <button
                            onClick={() => exportSessionMultiSheet(sess)}
                            className="btn btn-primary"
                            style={{
                              background: '#7c3aed',
                              borderColor: '#7c3aed',
                              padding: '8px 14px',
                              fontSize: 12,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                            title="Tải 1 file Excel chứa Sheet tổng và từng Sheet chi tiết từng Shop"
                          >
                            <Download size={14} />
                            Tải File Đa Sheet (.xlsx)
                          </button>

                          {/* 2. Tải file ZIP trọn bộ shop */}
                          <button
                            onClick={() => exportSessionZipPackage(sess)}
                            className="btn btn-secondary"
                            style={{
                              padding: '8px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                            title="Tải 1 file ZIP chứa từng file Excel riêng biệt của từng Shop"
                          >
                            <Archive size={14} />
                            Tải Gói (.ZIP)
                          </button>

                          {/* 3. Xuất MISA flat data */}
                          <button
                            onClick={() => exportFlatMisaData(sess)}
                            className="btn btn-secondary"
                            style={{
                              padding: '8px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                            title="Xuất bảng dữ liệu phẳng để import vào phần mềm kế toán MISA / FAST"
                          >
                            <FileText size={14} />
                            Xuất MISA
                          </button>
                        </div>
                      </div>

                      {/* Summary Metrics Row */}
                      <div style={{
                        padding: '14px 22px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 16,
                        background: 'var(--bg-app, #f8fafc)',
                        borderBottom: '1px solid var(--border, #f1f5f9)'
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Tổng Số Đơn Hàng</div>
                          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{sess.totalOrders.toLocaleString('vi-VN')} đơn</div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Tổng Tiền COD Thu Hộ</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                            {sess.totalCod.toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Doanh Thu Cước Dịch Vụ</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
                            {(sess.totalShopRevenue || 0).toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Thực Trả Khách Hàng (Shop)</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
                            {sess.totalNetPayout.toLocaleString('vi-VN')} đ
                          </div>
                        </div>
                      </div>

                      {/* Shop Breakdown Table */}
                      <div style={{ padding: '0 22px 16px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)' }}>
                              <th style={{ padding: '8px 6px' }}>STT</th>
                              <th style={{ padding: '8px 10px' }}>Khách Hàng (Shop)</th>
                              <th style={{ padding: '8px 10px' }}>Số Tài Khoản Nhận</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Số Đơn</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tổng COD</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cước Dịch Vụ</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Thực Trả Shop</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(sess.statements || []).map((stmt, sIdx) => {
                              const bankStr = stmt.bankInfo?.accountNumber
                                ? `${stmt.bankInfo.bankName || ''} - ${stmt.bankInfo.accountNumber}`
                                : 'Chưa cập nhật';

                              return (
                                <tr key={sIdx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: 13 }}>
                                  <td style={{ padding: '10px 6px', color: 'var(--text-muted)' }}>{sIdx + 1}</td>
                                  <td style={{ padding: '10px 10px' }}>
                                    <div style={{ fontWeight: 700 }}>{stmt.shopName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mã: {stmt.shopCode || '-'}</div>
                                  </td>
                                  <td style={{ padding: '10px 10px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>{bankStr}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stmt.bankInfo?.accountHolder || ''}</div>
                                  </td>
                                  <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700 }}>
                                    {stmt.totalOrders}
                                  </td>
                                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                                    {stmt.totalCod.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                                    {(stmt.totalShopFee + stmt.totalShopOtherFee).toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                    {stmt.totalNetPayout.toLocaleString('vi-VN')} đ
                                  </td>
                                  <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                      {/* Tải Excel Shop */}
                                      <button
                                        onClick={() => exportSingleShopExcel(sessTitle, stmt)}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
                                        title="Tải riêng file Excel của Shop này"
                                      >
                                        <Download size={12} /> Excel
                                      </button>

                                      {/* Xem chi tiết đơn */}
                                      <button
                                        onClick={() => {
                                          setSelectedSession(sess);
                                          setSelectedShopStmt(stmt);
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: 11 }}
                                        title="Xem chi tiết các mã vận đơn"
                                      >
                                        <Eye size={12} /> Chi Tiết
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DANH MỤC KHÁCH HÀNG (SHOP DIRECTORY)                               */}
        {/* ========================================================================= */}
        {activeTab === 'shops' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header & Export Button */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              padding: '16px 20px',
              borderRadius: 12,
              border: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={`Tìm theo tên shop, mã khách, SĐT của ${currentCarrierTitle}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 36, width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Tổng: <strong>{filteredShops.length}</strong> khách hàng ({currentCarrierTitle})
                </div>

                <button
                  onClick={exportShopLegalDirectory}
                  className="btn btn-primary"
                  style={{
                    background: '#7c3aed',
                    borderColor: '#7c3aed',
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Download size={14} />
                  Xuất Danh Bạ Shop Khai Thuế (.xlsx)
                </button>
              </div>
            </div>

            {/* Shop Table */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: 14,
              border: '1px solid var(--border, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 14px' }}>STT</th>
                      <th style={{ padding: '12px 14px' }}>Mã Khách</th>
                      <th style={{ padding: '12px 14px' }}>Tên Khách Hàng / Đơn Vị</th>
                      <th style={{ padding: '12px 14px' }}>Số Điện Thoại</th>
                      <th style={{ padding: '12px 14px' }}>Địa Chỉ Kinh Doanh</th>
                      <th style={{ padding: '12px 14px' }}>Thông Tin Ngân Hàng</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Trạng Thái</th>
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
                        <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: 13 }}>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>
                            {s.code || '-'}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                            {s.name}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {s.phone || '-'}
                          </td>
                          <td style={{ padding: '12px 14px', maxWidth: 220, fontSize: 12 }}>
                            {s.address || '-'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>
                              {s.bankAccount?.bankName ? `${s.bankAccount.bankName} - ${s.bankAccount.accountNumber}` : 'Chưa cập nhật'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {s.bankAccount?.accountHolder || ''}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{
                              background: s.active !== false ? '#dcfce7' : '#f1f5f9',
                              color: s.active !== false ? '#166534' : '#64748b',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6
                            }}>
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
        {/* TAB 3: BÁO CÁO THUẾ TỔNG HỢP (THÁNG / QUÝ)                                 */}
        {/* ========================================================================= */}
        {activeTab === 'monthly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Date Range Filter Bar */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              padding: '18px 22px',
              borderRadius: 12,
              border: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Chọn khoảng thời gian:</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Từ ngày:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="input-field"
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Đến ngày:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="input-field"
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  />
                </div>

                {/* Quick select buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => {
                      setFromDate(firstDayOfMonth);
                      setToDate(todayStr);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600 }}
                  >
                    Tháng Này
                  </button>

                  <button
                    onClick={() => {
                      const prevMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                      const prevMonthLast = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                      setFromDate(prevMonthFirst);
                      setToDate(prevMonthLast);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600 }}
                  >
                    Tháng Trước
                  </button>
                </div>
              </div>

              {/* Export Monthly Report Button */}
              <button
                onClick={exportMonthlyConsolidatedTaxReport}
                className="btn btn-primary"
                style={{
                  background: '#7c3aed',
                  borderColor: '#7c3aed',
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Download size={15} />
                Xuất Báo Cáo Doanh Thu Thuế ({currentCarrierTitle})
              </button>
            </div>

            {/* 4 Summary KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--surface, #ffffff)', padding: '18px', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Kỳ Đối Soát Trong Khoảng</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{monthlyAggregatedData.sessionCount} kỳ</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{monthlyAggregatedData.totalOrders.toLocaleString('vi-VN')} tổng đơn</div>
              </div>

              <div style={{ background: 'var(--surface, #ffffff)', padding: '18px', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Tổng COD Thu Hộ Luân Chuyển</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                  {monthlyAggregatedData.totalCod.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tiền hàng thu hộ từ khách</div>
              </div>

              <div style={{ background: 'var(--surface, #ffffff)', padding: '18px', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Doanh Thu Cước Dịch Vụ</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
                  {monthlyAggregatedData.totalServiceRevenue.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Doanh thu chịu thuế GTGT/TNDN</div>
              </div>

              <div style={{ background: 'var(--surface, #ffffff)', padding: '18px', borderRadius: 12, border: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Thực Chi Trả Khách Hàng</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                  {monthlyAggregatedData.totalNetPayout.toLocaleString('vi-VN')} đ
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tổng chuyển khoản cho các Shop</div>
              </div>
            </div>

            {/* Aggregated Shop Breakdown Table */}
            <div style={{
              background: 'var(--surface, #ffffff)',
              borderRadius: 14,
              border: '1px solid var(--border, #e2e8f0)',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', fontWeight: 800, fontSize: 15 }}>
                BẢNG PHÂN BỔ DOANH THU & DÒNG TIỀN THEO TỪNG KHÁCH HÀNG ({currentCarrierTitle})
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 14px' }}>STT</th>
                      <th style={{ padding: '12px 14px' }}>Mã Khách</th>
                      <th style={{ padding: '12px 14px' }}>Tên Khách Hàng / Shop</th>
                      <th style={{ padding: '12px 14px' }}>Số Điện Thoại</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Số Kỳ Tham Gia</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Tổng Số Đơn</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Tổng COD Luân Chuyển</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Doanh Thu Cước Dịch Vụ</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Tổng Thực Trả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAggregatedData.shopBreakdown.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: 13 }}>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>{s.shopCode}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>{s.shopName}</td>
                        <td style={{ padding: '12px 14px' }}>{s.phone}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600 }}>{s.sessionCount} kỳ</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>{s.totalOrders.toLocaleString('vi-VN')}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                          {s.totalCod.toLocaleString('vi-VN')} đ
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                          {s.totalServiceFee.toLocaleString('vi-VN')} đ
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                          {s.totalNetPayout.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 👁️ MODAL: CHI TIẾT ĐƠN HÀNG CỦA SHOP                                     */}
      {selectedSession && selectedShopStmt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 1000,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  CHI TIẾT ĐƠN HÀNG: {selectedShopStmt.shopName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Kỳ đối soát: {selectedSession.sessionName} • Tổng cộng {selectedShopStmt.orders?.length || 0} đơn hàng
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedSession(null);
                  setSelectedShopStmt(null);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: 8 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Table Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #e2e8f0)', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px' }}>STT</th>
                    <th style={{ padding: '8px' }}>Mã Vận Đơn</th>
                    <th style={{ padding: '8px' }}>Người Nhận</th>
                    <th style={{ padding: '8px' }}>SĐT</th>
                    <th style={{ padding: '8px' }}>Trạng Thái</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Tiền COD</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Cước Dịch Vụ</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Thực Chuyển</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedShopStmt.orders || []).map((ord: ReconciledOrder, idx: number) => (
                    <tr key={ord.id || idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: 12 }}>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
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
