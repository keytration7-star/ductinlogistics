import React, { useState } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { 
  ShieldCheck, 
  UploadCloud, 
  FileSpreadsheet, 
  Search, 
  Zap, 
  AlertTriangle, 
  Layers, 
  Building2, 
  RefreshCw,
  AlertCircle,
  Truck,
  Store,
  FileText,
  Trash2
} from 'lucide-react';
import type { ReconciliationSession, Shop, UserAccount } from '../types';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';

interface DataAuditViewProps {
  sessions: ReconciliationSession[];
  shops: Shop[];
  currentUser: UserAccount;
  onRefreshSessions?: () => void;
  onNavigateToPayout?: () => void;
}

export interface AuditOrderItem {
  id: string;
  trackingCode: string;
  carrierName: string;
  fileName: string;
  periodName: string;
  shopCode: string;
  shopName: string;
  cod: number;
  nvcFee: number;
  shopFee: number;
  netPayout: number;
  statusBucket: 'VALID' | 'MISSING' | 'DUPLICATE' | 'NEW_SHOP';
  statusReason: string;
  existingSessionName?: string;
}

export interface NvcFileItem {
  file: File;
  periodName: string;
}

export const DataAuditView: React.FC<DataAuditViewProps> = ({
  sessions,
  shops,
  currentUser: _currentUser,
  onRefreshSessions,
  onNavigateToPayout,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const [nvcFiles, setNvcFiles] = useState<NvcFileItem[]>([]);
  const [appFiles, setAppFiles] = useState<File[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [_auditFiles, setAuditFiles] = useState<{ name: string; type: 'nvc' | 'app'; size: number; orderCount: number }[]>([]);
  const [auditOrders, setAuditOrders] = useState<AuditOrderItem[]>([]);
  const [activeBucketFilter, setActiveBucketFilter] = useState<'ALL' | 'MISSING' | 'DUPLICATE' | 'NEW_SHOP' | 'VALID'>('ALL');
  const [selectedCarrierFilter, setSelectedCarrierFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper format currency
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  // Helper carrier detector using Real Historical Session Data & Row Metadata (No hardcoded rules)
  const detectCarrierFromHistoryOrMetadata = (
    trackingCode: string, 
    fileName: string, 
    row: Record<string, any>
  ): string => {
    const cleanCode = (trackingCode || '').trim().toUpperCase();

    // 1. Check Real Historical Saved Sessions Data in System
    if (cleanCode && sessions && sessions.length > 0) {
      for (const sess of sessions) {
        if (sess.statements) {
          for (const stmt of sess.statements) {
            if (stmt.orders) {
              const matchedOrd = stmt.orders.find(o => o.waybill && o.waybill.trim().toUpperCase() === cleanCode);
              if (matchedOrd && (matchedOrd.carrierId || sess.carrierName)) {
                return sess.carrierName || matchedOrd.carrierId;
              }
            }
          }
        }
      }
    }

    // 2. Check Row Metadata column (Cột Hãng Vận Chuyển trong file)
    const rowCarrier = String(
      row['Hãng vận chuyển'] || row['NVC'] || row['Đơn vị vận chuyển'] || row['Carrier'] || row['Nha_Van_Chuyen'] || ''
    ).trim();

    if (rowCarrier && rowCarrier.length > 1) {
      return rowCarrier;
    }

    // 3. Extract from filename if filename specifies carrier
    const fUpper = fileName.toUpperCase();
    if (fUpper.includes('GHN')) return 'GHN';
    if (fUpper.includes('J&T') || fUpper.includes('JT')) return 'J&T Express';
    if (fUpper.includes('SPX') || fUpper.includes('SHOPEE')) return 'SPX (Shopee Express)';
    if (fUpper.includes('VTP') || fUpper.includes('VIETTEL')) return 'ViettelPost';
    if (fUpper.includes('GHTK')) return 'GHTK';
    if (fUpper.includes('BEST')) return 'Best Express';

    return 'Hãng Vận Chuyển';
  };

  // Handle NVC Files Upload
  const handleNvcFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selected = Array.from(event.target.files).map(f => ({
        file: f,
        periodName: f.name.replace(/\.[^/.]+$/, ''),
      }));
      setNvcFiles(prev => [...prev, ...selected]);
      showToast(`Đã thêm ${selected.length} file Đối Soát NVC kèm tên kỳ tự động.`, 'info');
    }
  };

  const updateNvcPeriodName = (index: number, newPeriodName: string) => {
    setNvcFiles(prev => prev.map((item, i) => i === index ? { ...item, periodName: newPeriodName } : item));
  };

  // Handle App Files Upload
  const handleAppFilesSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selected = Array.from(event.target.files);
      setAppFiles(prev => [...prev, ...selected]);
      showToast(`Đã thêm ${selected.length} file Đơn Xuất App.`, 'info');
    }
  };

  const removeNvcFile = (index: number) => {
    setNvcFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeAppFile = (index: number) => {
    setAppFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Process Dual-Zone Cross-Period Audit Engine
  const handleRunAudit = async () => {
    if (nvcFiles.length === 0 && appFiles.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 file Đối Soát NVC hoặc 1 file Đơn Xuất App.', 'warning');
      return;
    }

    setIsProcessing(true);
    showToast(`Đang rà soát đối chiếu dữ liệu giữa ${nvcFiles.length} file NVC và ${appFiles.length} file App...`, 'info');

    try {
      const fileSummaryList: { name: string; type: 'nvc' | 'app'; size: number; orderCount: number }[] = [];
      const extractedOrders: AuditOrderItem[] = [];
      const seenTrackingCodes = new Set<string>();

      // 1. Build lookup map from App Files (System Export Files)
      const appOrdersMap = new Map<string, {
        shopCode: string;
        shopName: string;
        shopPhone: string;
        shopAddress: string;
        cod: number;
        weight: number;
      }>();

      for (const file of appFiles) {
        const { rows } = await ExcelService.parseExcelFile(file);
        let appCount = 0;

        rows.forEach((row: Record<string, any>) => {
          const trackingCode = String(
            row['Mã vận đơn'] || row['MÃ VẬN ĐƠN'] || row['Ma_Van_Don'] || row['tracking_code'] || row['MaBD'] || row['Mã Đơn'] || ''
          ).trim().toUpperCase();

          if (!trackingCode || trackingCode.length < 5) return;
          appCount++;

          const shopCode = String(row['Mã Shop'] || row['Mã shop'] || row['MA_SHOP'] || row['Shop'] || '').trim();
          const shopName = String(row['Tên Shop'] || row['Tên shop'] || row['TEN_SHOP'] || row['Shop Name'] || 'Shop ' + shopCode).trim();
          const shopPhone = String(row['SĐT Shop'] || row['SĐT'] || row['Phone'] || '').trim();
          const shopAddress = String(row['Địa Chỉ Shop'] || row['Địa chỉ'] || row['Address'] || '').trim();
          const cod = parseFloat(String(row['Tiền COD'] || row['COD'] || row['Thu hộ'] || 0).replace(/[^0-9.]/g, '')) || 0;
          const weight = parseFloat(String(row['Khối lượng'] || row['Trọng lượng'] || row['Weight'] || 0).replace(/[^0-9.]/g, '')) || 0;

          appOrdersMap.set(trackingCode, {
            shopCode,
            shopName,
            shopPhone,
            shopAddress,
            cod,
            weight,
          });
        });

        fileSummaryList.push({
          name: file.name,
          type: 'app',
          size: file.size,
          orderCount: appCount,
        });
      }

      // 2. Build lookup map from saved sessions in system
      const savedOrdersMap = new Map<string, string>(); // trackingCode -> sessionName
      sessions.forEach(sess => {
        sess.statements.forEach(stmt => {
          if (stmt.orders) {
            stmt.orders.forEach(ord => {
              if (ord.waybill) {
                savedOrdersMap.set(ord.waybill.trim().toUpperCase(), sess.sessionName);
              }
            });
          }
        });
      });

      const shopCodeMap = new Map<string, Shop>();
      shops.forEach(s => {
        if (s.code) shopCodeMap.set(s.code.trim().toUpperCase(), s);
        if (s.name) shopCodeMap.set(s.name.trim().toLowerCase(), s);
      });

      // 3. Process Carrier NVC Files
      if (nvcFiles.length > 0) {
        for (let i = 0; i < nvcFiles.length; i++) {
          const item = nvcFiles[i];
          const file = item.file;
          const customPeriod = item.periodName || file.name.replace(/\.[^/.]+$/, '');
          const { rows } = await ExcelService.parseExcelFile(file);

          let fileOrderCount = 0;

          rows.forEach((row: Record<string, any>, idx: number) => {
            const trackingCode = String(
              row['Mã vận đơn'] || row['MÃ VẬN ĐƠN'] || row['Ma_Van_Don'] || row['tracking_code'] || row['MaBD'] || row['Mã Đơn'] || ''
            ).trim().toUpperCase();

            if (!trackingCode || trackingCode.length < 5) return;

            fileOrderCount++;

            const appMatch = appOrdersMap.get(trackingCode);

            let shopCodeRaw = appMatch?.shopCode || String(row['Mã Shop'] || row['Mã shop'] || row['MA_SHOP'] || row['Shop'] || '').trim();
            let shopNameRaw = appMatch?.shopName || String(row['Tên Shop'] || row['Tên shop'] || row['TEN_SHOP'] || row['Shop Name'] || 'Shop ' + shopCodeRaw).trim();
            
            const codRaw = parseFloat(String(row['Tiền COD'] || row['COD'] || row['Thu hộ'] || appMatch?.cod || 0).replace(/[^0-9.]/g, '')) || 0;
            const feeRaw = parseFloat(String(row['Cước'] || row['Tổng Cước'] || row['Cước Shop'] || 0).replace(/[^0-9.]/g, '')) || 0;
            const netPayout = codRaw - feeRaw;

            const matchedShop = shopCodeMap.get(shopCodeRaw.toUpperCase()) || shopCodeMap.get(shopNameRaw.toLowerCase());
            const existingSession = savedOrdersMap.get(trackingCode);

            let bucket: 'VALID' | 'MISSING' | 'DUPLICATE' | 'NEW_SHOP' = 'MISSING';
            let reason = appMatch ? `Khớp thông tin từ File Đơn Xuất App - Đơn bị sót thuộc ${customPeriod}` : `Đơn bị sót thuộc ${customPeriod} chưa đối soát & chưa đi tiền`;

            if (seenTrackingCodes.has(trackingCode)) {
              bucket = 'DUPLICATE';
              reason = `Đơn trùng lặp xuất hiện nhiều lần trong các file vừa tải`;
            } else if (existingSession) {
              bucket = 'VALID';
              reason = `Đã đối soát hợp lệ ở kỳ "${existingSession}"`;
            } else if (!matchedShop) {
              bucket = 'NEW_SHOP';
              reason = `Shop "${shopNameRaw}" chưa có trong danh sách Quản lý Shop`;
            }

            seenTrackingCodes.add(trackingCode);

            extractedOrders.push({
              id: `audit_${i}_${idx}_${Date.now()}`,
              trackingCode,
              carrierName: detectCarrierFromHistoryOrMetadata(trackingCode, file.name, row),
              fileName: file.name,
              periodName: customPeriod,
              shopCode: matchedShop ? matchedShop.code : (shopCodeRaw || 'SHOP_NEW'),
              shopName: matchedShop ? matchedShop.name : shopNameRaw,
              cod: codRaw,
              nvcFee: feeRaw,
              shopFee: feeRaw,
              netPayout,
              statusBucket: bucket,
              statusReason: reason,
              existingSessionName: existingSession,
            });
          });

          fileSummaryList.push({
            name: `${file.name} (${customPeriod})`,
            type: 'nvc',
            size: file.size,
            orderCount: fileOrderCount,
          });
        }
      }

      setAuditFiles(fileSummaryList);
      setAuditOrders(extractedOrders);
      showToast(`Đã hoàn tất rà soát đối chiếu ${extractedOrders.length} đơn từ ${fileSummaryList.length} file!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi khi rà soát dữ liệu: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute Bucket Statistics
  const missingOrders = auditOrders.filter(o => o.statusBucket === 'MISSING');
  const duplicateOrders = auditOrders.filter(o => o.statusBucket === 'DUPLICATE');
  const newShopOrders = auditOrders.filter(o => o.statusBucket === 'NEW_SHOP');
  const validOrders = auditOrders.filter(o => o.statusBucket === 'VALID');

  const totalMissingNetPayout = missingOrders.reduce((sum, o) => sum + o.netPayout, 0);

  // Compute missing shops summary
  const missingShopsMap = new Map<string, {
    shopCode: string;
    shopName: string;
    missingCount: number;
    totalCod: number;
    totalShopFee: number;
    totalNetPayout: number;
    files: Set<string>;
  }>();

  missingOrders.forEach(ord => {
    const existing = missingShopsMap.get(ord.shopCode) || {
      shopCode: ord.shopCode,
      shopName: ord.shopName,
      missingCount: 0,
      totalCod: 0,
      totalShopFee: 0,
      totalNetPayout: 0,
      files: new Set<string>(),
    };

    existing.missingCount += 1;
    existing.totalCod += ord.cod;
    existing.totalShopFee += ord.shopFee;
    existing.totalNetPayout += ord.netPayout;
    existing.files.add(ord.fileName);

    missingShopsMap.set(ord.shopCode, existing);
  });

  const missingShopsSummary = Array.from(missingShopsMap.values());

  // Auto Create Supplementary Session for Missing Orders
  const handleCreateSupplementarySession = async () => {
    if (missingOrders.length === 0) {
      showToast('Không có đơn hàng/Khách hàng bị sót nào để lập Kỳ Đối Soát Bù.', 'info');
      return;
    }

    const ok = await showConfirm({
      title: `Tạo Kỳ Đối Soát Bù (${missingShopsSummary.length} Khách Hàng - ${missingOrders.length} Đơn)`,
      message: `Hệ thống sẽ gom ${missingOrders.length} đơn bị thiếu từ ${missingShopsSummary.length} Khách Hàng thành các Kỳ Đối Soát Bù (phân loại theo từng Hãng vận chuyển) với nhãn [DỮ LIỆU BÙ KỲ SÓT] và tổng thực chuyển ${formatVND(totalMissingNetPayout)}. Bạn có muốn tiếp tục?`,
      confirmText: 'Lập Kỳ Đối Soát Bù ngay',
    });

    if (!ok) return;

    // Group missing orders by Carrier & Shop
    const carrierGroups = new Map<string, AuditOrderItem[]>();
    missingOrders.forEach(ord => {
      const cName = ord.carrierName || 'Hãng Vận Chuyển';
      const list = carrierGroups.get(cName) || [];
      list.push(ord);
      carrierGroups.set(cName, list);
    });

    let createdCount = 0;

    carrierGroups.forEach((cOrders, carrierName) => {
      const shopStatementsMap = new Map<string, any>();

      cOrders.forEach(ord => {
        const existing = shopStatementsMap.get(ord.shopCode) || {
          shopId: ord.shopCode,
          shopCode: ord.shopCode,
          shopName: ord.shopName,
          shopPhone: '',
          shopEmail: '',
          shopAddress: '',
          bankInfo: { bankName: '', accountNumber: '', accountHolder: '' },
          periodName: `Bù Kỳ ${ord.periodName}`,
          totalOrders: 0,
          deliveredOrders: 0,
          returnedOrders: 0,
          inTransitOrders: 0,
          totalCod: 0,
          totalShopFee: 0,
          totalShopOtherFee: 0,
          totalNetPayout: 0,
          totalNvcCost: 0,
          totalProfit: 0,
          orders: [],
          emailStatus: 'idle',
          isSupplementary: true,
          supplementaryNotes: `Bù dữ liệu đối soát ${carrierName} (${ord.fileName})`,
        };

        existing.totalCod += ord.cod;
        existing.totalShopFee += ord.shopFee;
        existing.totalNetPayout += ord.netPayout;
        existing.totalOrders += 1;

        shopStatementsMap.set(ord.shopCode, existing);
      });

      const statements = Array.from(shopStatementsMap.values());
      const cNetPayout = cOrders.reduce((sum, o) => sum + o.netPayout, 0);

      const sessName = `Kỳ Đối Soát Bù - ${carrierName} (${new Date().toLocaleDateString('vi-VN')}) - ${statements.length} Khách (${cOrders.length} Đơn)`;

      const newSession: ReconciliationSession = {
        id: `sess_bu_${carrierName.replace(/\s+/g, '_')}_${Date.now()}`,
        sessionName: sessName,
        carrierId: carrierName,
        carrierName: carrierName,
        createdAt: new Date().toISOString(),
        nvcFileName: `Multi-Period Audit (${carrierName})`,
        totalOrders: cOrders.length,
        matchedOrdersCount: cOrders.length,
        unmatchedOrdersCount: 0,
        totalCod: cOrders.reduce((sum, o) => sum + o.cod, 0),
        totalNvcCost: cOrders.reduce((sum, o) => sum + o.nvcFee, 0),
        totalShopRevenue: cOrders.reduce((sum, o) => sum + o.shopFee, 0),
        totalNetPayout: cNetPayout,
        totalProfit: 0,
        statements,
        unmatchedOrders: [],
        payoutStatus: 'UNPAID',
        isSupplementary: true,
        supplementaryNotes: `Kỳ đối soát bù dữ liệu ${carrierName} cho ${statements.length} Khách hàng`,
      };

      StorageService.saveSession(newSession);
      createdCount++;
    });

    showToast(`Đã tạo thành công ${createdCount} Kỳ Đối Soát Bù phân loại theo từng Hãng Vận Chuyển!`, 'success');

    if (onRefreshSessions) onRefreshSessions();
    if (onNavigateToPayout) onNavigateToPayout();
  };

  // Unique Carriers in audit results
  const availableCarriers = Array.from(new Set(auditOrders.map(o => o.carrierName)));

  // Filter orders by active bucket, carrier & search query
  const filteredOrders = auditOrders.filter(ord => {
    if (activeBucketFilter !== 'ALL' && ord.statusBucket !== activeBucketFilter) return false;
    if (selectedCarrierFilter !== 'ALL' && ord.carrierName !== selectedCarrierFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ord.trackingCode.toLowerCase().includes(q) ||
      ord.shopName.toLowerCase().includes(q) ||
      ord.shopCode.toLowerCase().includes(q) ||
      ord.fileName.toLowerCase().includes(q) ||
      ord.carrierName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header Title */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={26} color="var(--primary)" />
            Rà Soát Dữ Liệu & Kiểm Thử Đối Soát Đa Kỳ (2 Vùng Kéo Thả File)
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Kéo thả hàng loạt File Đối Soát NVC và File Đơn Xuất App để khớp nối chuẩn xác 100% Khách Hàng, phát hiện đơn bị thiếu & lập Kỳ Bù.
          </p>
        </div>

        {auditOrders.length > 0 && (
          <button
            onClick={handleCreateSupplementarySession}
            className="btn btn-primary"
            style={{ fontSize: 13, fontWeight: 800, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Zap size={16} />
            <span>Tạo Kỳ Đối Soát Bù ({missingOrders.length} Đơn Sót)</span>
          </button>
        )}
      </div>

      {/* DUAL DRAG & DROP ZONES (2 VÙNG KÉO THẢ GIỐNG ĐỐI SOÁT) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        
        {/* ZONE 1: FILE ĐỐI SOÁT NVC */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: 24, 
            border: '2px dashed var(--primary)', 
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.03) 0%, rgba(79, 70, 229, 0.08) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={20} />
              </div>
              <div>
                <strong style={{ fontSize: 15, color: 'var(--primary)' }}>VÙNG 1: File Đối Soát NVC</strong>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>File Excel đối soát do hãng vận chuyển gửi</div>
              </div>
            </div>
            <span className="badge badge-primary">{nvcFiles.length} file</span>
          </div>

          <input 
            type="file" 
            multiple 
            accept=".xlsx, .xls, .csv" 
            onChange={handleNvcFilesSelect} 
            style={{ display: 'none' }} 
            id="nvc-batch-input" 
          />
          <label 
            htmlFor="nvc-batch-input" 
            style={{ 
              cursor: 'pointer', 
              padding: '20px 16px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px dashed var(--primary)', 
              background: 'rgba(79, 70, 229, 0.05)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <UploadCloud size={28} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>+ Thêm/Kéo thả các File Đối Soát NVC</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>GHN, J&T Express, ViettelPost, SPX...</span>
          </label>

          {/* List of uploaded NVC files with editable Period Name */}
          {nvcFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {nvcFiles.map((item, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '8px 12px', 
                  background: 'var(--bg-card)', 
                  borderRadius: 8, 
                  fontSize: 12, 
                  border: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, minWidth: 140, flex: 1 }}>
                    <FileSpreadsheet size={16} color="var(--primary)" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={item.file.name}>
                      {item.file.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Tên Kỳ:</span>
                    <input
                      type="text"
                      value={item.periodName}
                      onChange={(e) => updateNvcPeriodName(idx, e.target.value)}
                      placeholder="Nhập tên kỳ đối soát..."
                      className="input-field"
                      style={{ padding: '3px 8px', fontSize: 11, width: 150, fontWeight: 700, color: 'var(--primary)' }}
                    />
                  </div>

                  <button onClick={() => removeNvcFile(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} title="Xóa file này">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ZONE 2: FILE ĐƠN XUẤT APP / HỆ THỐNG */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: 24, 
            border: '2px dashed var(--success)', 
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, rgba(16, 185, 129, 0.08) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={20} />
              </div>
              <div>
                <strong style={{ fontSize: 15, color: 'var(--success)' }}>VÙNG 2: File Đơn Xuất App / Hệ Thống</strong>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>File đơn xuất từ phần mềm Shop (Pancake, TPOS, Nhanh...)</div>
              </div>
            </div>
            <span className="badge badge-success">{appFiles.length} file</span>
          </div>

          <input 
            type="file" 
            multiple 
            accept=".xlsx, .xls, .csv" 
            onChange={handleAppFilesSelect} 
            style={{ display: 'none' }} 
            id="app-batch-input" 
          />
          <label 
            htmlFor="app-batch-input" 
            style={{ 
              cursor: 'pointer', 
              padding: '20px 16px', 
              borderRadius: 'var(--radius-md)', 
              border: '1px dashed var(--success)', 
              background: 'rgba(16, 185, 129, 0.05)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <UploadCloud size={28} color="var(--success)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>+ Thêm/Kéo thả các File Đơn Xuất App</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>File Excel xuất danh sách đơn của Shop/Hệ thống</span>
          </label>

          {/* List of uploaded App files */}
          {appFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
              {appFiles.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: 'var(--bg-card)', borderRadius: 6, fontSize: 12, border: '1px solid var(--border-color)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <FileText size={14} color="var(--success)" />
                    {f.name}
                  </span>
                  <button onClick={() => removeAppFile(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ACTION BUTTON TO TRIGGER AUDIT */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleRunAudit}
          disabled={isProcessing || (nvcFiles.length === 0 && appFiles.length === 0)}
          className="btn btn-primary"
          style={{ fontSize: 15, fontWeight: 800, padding: '12px 36px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--radius-lg)' }}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="spin" size={18} />
              <span>Đang Rà Soát & Đối Chiếu Dữ Liệu Đa Kỳ...</span>
            </>
          ) : (
            <>
              <Search size={18} />
              <span>BẮT ĐẦU RÀ SOÁT & ĐỐI CHIẾU DỮ LIỆU CÁC FILE</span>
            </>
          )}
        </button>
      </div>

      {/* KPI Overview Metric Bar */}
      {auditOrders.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {/* Stat 1: Total Orders */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng Đơn Rà Soát</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{auditOrders.length} đơn</div>
            </div>
          </div>

          {/* Stat 2: Missing Orders */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '4px solid var(--danger)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>Đơn Bị Sót / Khuyết</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>{missingOrders.length} đơn</div>
              <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Thiếu: {formatVND(totalMissingNetPayout)}</div>
            </div>
          </div>

          {/* Stat 3: Duplicate Orders */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>Đơn Trùng Lập</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--warning)' }}>{duplicateOrders.length} đơn</div>
            </div>
          </div>

          {/* Stat 4: Unregistered Shops */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(14, 165, 233, 0.12)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase' }}>Shop Chưa Đăng Ký</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--info)' }}>{newShopOrders.length} đơn</div>
            </div>
          </div>
        </div>
      )}

      {/* 🏬 MISSING SHOPS AUDIT BREAKDOWN PANEL */}
      {missingShopsSummary.length > 0 && (
        <div className="glass-panel" style={{ padding: 20, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={20} />
              Danh Sách Khách Hàng (Shop) Bị Thiếu / Sót Kỳ Đối Soát ({missingShopsSummary.length} Shop)
            </h3>
            <button
              onClick={handleCreateSupplementarySession}
              className="btn btn-danger btn-sm"
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px' }}
            >
              <Zap size={14} />
              <span>Tạo Kỳ Đối Soát Bù Đã Đánh Dấu</span>
            </button>
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)' }}>
                <tr>
                  <th>Mã Shop</th>
                  <th>Tên Khách Hàng (Shop)</th>
                  <th>File / Kỳ Nguồn Bị Sót</th>
                  <th style={{ textAlign: 'right' }}>Số Đơn Khuyết</th>
                  <th style={{ textAlign: 'right' }}>Tổng COD</th>
                  <th style={{ textAlign: 'right' }}>Cước Shop</th>
                  <th style={{ textAlign: 'right' }}>Thực Chuyển Bù</th>
                  <th style={{ textAlign: 'center' }}>Đánh Dấu Dữ Liệu Bù</th>
                </tr>
              </thead>
              <tbody>
                {missingShopsSummary.map(shopSum => (
                  <tr key={shopSum.shopCode}>
                    <td><strong className="mono" style={{ color: 'var(--primary)', fontSize: 13 }}>{shopSum.shopCode}</strong></td>
                    <td><strong style={{ fontSize: 13 }}>{shopSum.shopName}</strong></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {Array.from(shopSum.files).join(', ')}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                      {shopSum.missingCount} đơn
                    </td>
                    <td className="mono" style={{ color: 'var(--info)', textAlign: 'right' }}>{formatVND(shopSum.totalCod)}</td>
                    <td className="mono" style={{ color: '#92400e', textAlign: 'right' }}>-{formatVND(shopSum.totalShopFee)}</td>
                    <td className="mono" style={{ fontWeight: 800, color: 'var(--primary)', textAlign: 'right' }}>
                      {formatVND(shopSum.totalNetPayout)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-warning" style={{ fontSize: 10, fontWeight: 700 }}>
                        🏷️ Dữ Liệu Bù Kỳ Sót
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Filter Tabs & Audit Results Table */}
      {auditOrders.length > 0 && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveBucketFilter('ALL')}
                className={`btn btn-sm ${activeBucketFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                Tất Cả ({auditOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('MISSING')}
                className={`btn btn-sm ${activeBucketFilter === 'MISSING' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🔴 Đơn Bị Sót ({missingOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('DUPLICATE')}
                className={`btn btn-sm ${activeBucketFilter === 'DUPLICATE' ? 'btn-warning' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🟡 Đơn Trùng ({duplicateOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('NEW_SHOP')}
                className={`btn btn-sm ${activeBucketFilter === 'NEW_SHOP' ? 'btn-info' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🟠 Shop Mới ({newShopOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('VALID')}
                className={`btn btn-sm ${activeBucketFilter === 'VALID' ? 'btn-success' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🟢 Hợp Lệ ({validOrders.length})
              </button>
            </div>

            {/* Carrier Filter & Search Box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {availableCarriers.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Truck size={14} color="var(--primary)" />
                  <select
                    value={selectedCarrierFilter}
                    onChange={(e) => setSelectedCarrierFilter(e.target.value)}
                    className="input-field"
                    style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700 }}
                  >
                    <option value="ALL">🚚 Tất Cả Hãng ({availableCarriers.length})</option>
                    {availableCarriers.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder="Tìm mã vận đơn, shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
                />
              </div>
            </div>
          </div>

          {/* Bounded Scrollable Table */}
          <div style={{
            maxHeight: 520,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            position: 'relative',
          }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th>Mã Vận Đơn</th>
                  <th>Hãng / File Nguồn</th>
                  <th>Tên Shop</th>
                  <th style={{ textAlign: 'right' }}>Tiền COD</th>
                  <th style={{ textAlign: 'right' }}>Cước Shop</th>
                  <th style={{ textAlign: 'right' }}>Thực Chuyển</th>
                  <th style={{ textAlign: 'center' }}>Kết Quả Rà Soát</th>
                  <th>Đánh Giá & Cảnh Báo Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(ord => (
                    <tr key={ord.id}>
                      <td><strong className="mono" style={{ color: 'var(--primary)', fontSize: 13 }}>{ord.trackingCode}</strong></td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: 9 }}>{ord.carrierName}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{ord.fileName}</div>
                      </td>
                      <td>
                        <strong>{ord.shopName}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ord.shopCode}</div>
                      </td>
                      <td className="mono" style={{ color: 'var(--info)', textAlign: 'right' }}>{formatVND(ord.cod)}</td>
                      <td className="mono" style={{ color: '#92400e', textAlign: 'right' }}>-{formatVND(ord.shopFee)}</td>
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--primary)', textAlign: 'right' }}>{formatVND(ord.netPayout)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {ord.statusBucket === 'VALID' && <span className="badge badge-success" style={{ fontSize: 10 }}>🟢 Hợp Lệ</span>}
                        {ord.statusBucket === 'MISSING' && <span className="badge badge-danger" style={{ fontSize: 10 }}>🔴 Sót / Khuyết</span>}
                        {ord.statusBucket === 'DUPLICATE' && <span className="badge badge-warning" style={{ fontSize: 10 }}>🟡 Trùng Lập</span>}
                        {ord.statusBucket === 'NEW_SHOP' && <span className="badge badge-info" style={{ fontSize: 10 }}>🟠 Shop Mới</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ color: ord.statusBucket === 'MISSING' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: ord.statusBucket === 'MISSING' ? 700 : 400 }}>
                          {ord.statusReason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
