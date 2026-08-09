import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Mail, 
  QrCode, 
  Eye, 
  RefreshCw, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  Sparkles,
  ArrowUpDown,
  XCircle,
  UserCheck,
  RotateCcw,
  Settings2
} from 'lucide-react';
import type { 
  Shop, 
  CarrierWholesaleTier, 
  ReconciliationSession, 
  ShopSettlementStatement,
  ColumnMappingConfig,
  ReconciledOrder
} from '../types';
import { ExcelService } from '../services/excelService';
import { autoDetectColumns } from '../services/smartColumnDetector';
import { performReconciliation, calculateWeightFee } from '../services/reconciliationService';
import { StatementPreviewModal } from './StatementPreviewModal';
import { VietQRModal } from './VietQRModal';
import { NewShopsOnboardingModal } from './NewShopsOnboardingModal';
import { ColumnMappingModal } from './ColumnMappingModal';
import { ExportColumnConfigModal } from './ExportColumnConfigModal';
import { CarrierProfileConfigModal } from './CarrierProfileConfigModal';
import { useToast, useConfirm } from './UIFeedback';
import confetti from 'canvas-confetti';

import { StorageService } from '../services/storage';

interface ReconciliationViewProps {
  shops: Shop[];
  carriers: CarrierWholesaleTier[];
  currentSession: ReconciliationSession | null;
  setCurrentSession: (session: ReconciliationSession | null) => void;
  onNavigateToEmail: (session: ReconciliationSession) => void;
  onSaveShops: (shops: Shop[]) => void;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  shops,
  carriers,
  currentSession,
  setCurrentSession,
  onNavigateToEmail,
  onSaveShops,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  // Upload States
  const [nvcFile, setNvcFile] = useState<File | null>(null);
  const [appFile, setAppFile] = useState<File | null>(null);
  
  // Drag states for visual feedback
  const [isDraggingNvc, setIsDraggingNvc] = useState(false);
  const [isDraggingApp, setIsDraggingApp] = useState(false);

  const [nvcHeaders, setNvcHeaders] = useState<string[]>([]);
  const [nvcRows, setNvcRows] = useState<Record<string, any>[]>([]);
  
  // Initialize with saved mapping preferences
  const savedMappings = StorageService.getColumnMappings();
  const [nvcMapping, setNvcMapping] = useState<ColumnMappingConfig>(savedMappings.nvc || { waybillColumn: '' });

  const [appHeaders, setAppHeaders] = useState<string[]>([]);
  const [appRows, setAppRows] = useState<Record<string, any>[]>([]);
  const [appMapping, setAppMapping] = useState<ColumnMappingConfig>(savedMappings.app || { waybillColumn: '' });

  const [selectedCarrierId, setSelectedCarrierId] = useState<string>(carriers[0]?.carrierId || 'ghtk');
  const selectedCarrierTier = carriers.find(c => c.carrierId === selectedCarrierId || c.id === selectedCarrierId) || carriers[0];

  // Auto-sync column mapping when selected carrier changes
  React.useEffect(() => {
    if (selectedCarrierId) {
      const carrierMapping = StorageService.getCarrierMapping(selectedCarrierId);
      if (carrierMapping.nvc) setNvcMapping(carrierMapping.nvc);
      if (carrierMapping.app) setAppMapping(carrierMapping.app);
    }
  }, [selectedCarrierId]);

  const [sessionPeriodName, setSessionPeriodName] = useState<string>(
    `Kỳ Đối Soát Tháng ${new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}`
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [configCarrier, setConfigCarrier] = useState<CarrierWholesaleTier | null>(null);

  // Discovered New Shops from uploaded App file
  const [discoveredNewShops, setDiscoveredNewShops] = useState<{ name: string; phone: string; address: string; orderCount: number }[]>([]);
  const [isNewShopsModalOpen, setIsNewShopsModalOpen] = useState(false);

  // Result View States
  const [activeResultTab, setActiveResultTab] = useState<'statements' | 'allOrders' | 'unmatched'>('statements');
  const [searchShopQuery, setSearchShopQuery] = useState('');
  const [searchOrderQuery, setSearchOrderQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'orders' | 'cod' | 'fee' | 'net' | 'profit'>('orders');
  const [sortAsc, setSortAsc] = useState(false);

  // Selected Modal States
  const [previewStatement, setPreviewStatement] = useState<ShopSettlementStatement | null>(null);
  const [qrStatement, setQrStatement] = useState<ShopSettlementStatement | null>(null);

  // Unmatched manual assign map
  const [selectedAssignShops, setSelectedAssignShops] = useState<Record<string, string>>({});

  // Zip Download Progress State
  const [zipProgress, setZipProgress] = useState<{ active: boolean; percent: number; currentShop: string }>({
    active: false,
    percent: 0,
    currentShop: '',
  });

  const nvcFileInputRef = useRef<HTMLInputElement>(null);
  const appFileInputRef = useRef<HTMLInputElement>(null);

  // Process NVC File
  const handleNvcFileChange = async (file: File) => {
    try {
      setNvcFile(file);
      const { headers, rows } = await ExcelService.parseExcelFile(file);
      setNvcHeaders(headers);
      setNvcRows(rows);
      const saved = StorageService.getColumnMappings();
      const detectedMapping = autoDetectColumns(headers, 'nvc', saved.nvc);
      setNvcMapping(detectedMapping);
      StorageService.saveColumnMappings(detectedMapping, appMapping);
      // 🔑 Lưu headers của hãng này để dùng khi mở cài đặt mà chưa có file
      const savedHeaders = StorageService.getCarrierHeaders(selectedCarrierId);
      StorageService.saveCarrierHeaders(selectedCarrierId, headers, savedHeaders.appHeaders);
    } catch (err) {
      showToast('Không thể đọc file đối soát NVC. Vui lòng kiểm tra định dạng Excel (.xlsx, .xls, .csv)', 'error');
      console.error(err);
    }
  };

  // Process App File
  const handleAppFileChange = async (file: File) => {
    try {
      setAppFile(file);
      const { headers, rows } = await ExcelService.parseExcelFile(file);
      setAppHeaders(headers);
      setAppRows(rows);
      const saved = StorageService.getColumnMappings();
      const detectedMapping = autoDetectColumns(headers, 'app', saved.app);
      setAppMapping(detectedMapping);
      StorageService.saveColumnMappings(nvcMapping, detectedMapping);
      // 🔑 Lưu headers của hãng này để dùng khi mở cài đặt mà chưa có file
      const savedHeaders = StorageService.getCarrierHeaders(selectedCarrierId);
      StorageService.saveCarrierHeaders(selectedCarrierId, savedHeaders.nvcHeaders, headers);
    } catch (err) {
      showToast('Không thể đọc file đơn hàng từ App. Vui lòng kiểm tra định dạng Excel (.xlsx, .xls, .csv)', 'error');
      console.error(err);
    }
  };

  // HTML5 Drag & Drop handlers for Dropzone 1 (NVC)
  const handleNvcDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingNvc(true);
  };
  const handleNvcDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingNvc(false);
  };
  const handleNvcDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingNvc(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleNvcFileChange(e.dataTransfer.files[0]);
    }
  };

  // HTML5 Drag & Drop handlers for Dropzone 2 (App)
  const handleAppDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingApp(true);
  };
  const handleAppDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingApp(false);
  };
  const handleAppDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingApp(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAppFileChange(e.dataTransfer.files[0]);
    }
  };

  const executeReconciliation = (effectiveShops: Shop[]) => {
    setIsProcessing(true);

    setTimeout(() => {
      const carrierTier = carriers.find(c => c.carrierId === selectedCarrierId) || carriers[0];
      
      const session = performReconciliation(
        nvcRows,
        nvcMapping,
        appRows,
        appMapping,
        effectiveShops,
        carrierTier,
        sessionPeriodName,
        nvcFile?.name || 'File_NVC.xlsx',
        appFile?.name || 'File_App.xlsx'
      );

      setCurrentSession(session);
      setIsProcessing(false);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    }, 400);
  };

  // Run reconciliation with auto new shops detection
  const handleRunReconciliation = async () => {
    if (nvcRows.length === 0 || appRows.length === 0) {
      showToast('Vui lòng tải lên cả 2 file: File Đối Soát NVC và File Đơn Hàng từ App.', 'warning');
      return;
    }

    if (!nvcMapping.waybillColumn || !appMapping.waybillColumn) {
      showToast('Không tìm thấy cột Mã vận đơn. Vui lòng bấm ⚙️ Cài đặt thẻ hãng để chọn cột.', 'warning');
      setShowMappingModal(true);
      return;
    }

    // 1. Scan appRows to find unregistered new shops
    const shopCol = appMapping.shopNameColumn || '';
    const phoneCol = appMapping.shopPhoneColumn || '';
    const addrCol = appMapping.shopAddressColumn || '';

    const newShopsMap = new Map<string, { name: string; phone: string; address: string; orderCount: number }>();

    for (const row of appRows) {
      const sName = (shopCol ? String(row[shopCol] || '') : '').trim();
      const sPhone = (phoneCol ? String(row[phoneCol] || '') : '').trim();
      const sAddr = (addrCol ? String(row[addrCol] || '') : '').trim();

      if (!sName && !sPhone) continue;

      const cleanName = sName.toLowerCase();
      const cleanPhone = sPhone.replace(/[^0-9]/g, '');

      const isRegistered = shops.some(s => {
        const regName = s.name.toLowerCase().trim();
        const regCode = s.code.toLowerCase().trim();
        const regPhone = s.phone.replace(/[^0-9]/g, '');
        return (
          (cleanPhone && regPhone && cleanPhone === regPhone) ||
          (cleanName && regName && (cleanName.includes(regName) || regName.includes(cleanName))) ||
          (cleanName && regCode && cleanName.includes(regCode))
        );
      });

      if (!isRegistered) {
        const key = cleanPhone || cleanName;
        if (!newShopsMap.has(key)) {
          newShopsMap.set(key, {
            name: sName || `Shop ${cleanPhone || 'Mới'}`,
            phone: sPhone,
            address: sAddr,
            orderCount: 1,
          });
        } else {
          newShopsMap.get(key)!.orderCount += 1;
        }
      }
    }

    const unregList = Array.from(newShopsMap.values());
    if (unregList.length > 0) {
      setDiscoveredNewShops(unregList);
      setIsNewShopsModalOpen(true);
      return;
    }

    executeReconciliation(shops);
  };

  const handleSaveNewShopsAndContinue = (newShops: Shop[]) => {
    const updatedAllShops = [...shops, ...newShops];
    onSaveShops(updatedAllShops);
    setIsNewShopsModalOpen(false);
    executeReconciliation(updatedAllShops);
  };

  // Reset uploaded files and current session while preserving shops, pricing & column mapping
  const handleResetReconciliation = async () => {
    const ok = await showConfirm({
      title: 'Làm Mới File Đối Soát',
      message: 'Bạn có chắc muốn làm mới để tải lại 2 file Excel khác? Danh sách Shop, Bảng giá và Cấu hình ánh xạ cột sẽ được GIỮ NGUYÊN 100%.',
      confirmText: 'Làm Mới',
      cancelText: 'Giữ lại',
      warning: true,
    });
    if (ok) {
      setNvcFile(null);
      setAppFile(null);
      setNvcRows([]);
      setAppRows([]);
      setNvcHeaders([]);
      setAppHeaders([]);
      setCurrentSession(null);
    }
  };

  // Manually Assign Unmatched Order to a Shop
  const handleAssignUnmatchedOrder = (order: ReconciledOrder, targetShopId: string) => {
    if (!currentSession || !targetShopId) return;

    const targetShop = shops.find(s => s.id === targetShopId);
    if (!targetShop) return;

    // Recalculate fee for this order using target shop's pricing plan ONLY IF NVC charged fee (nvcBaseFee > 0)
    let shopCalculatedFee = 0;
    let shopOtherFee = 0;

    if (order.nvcBaseFee > 0) {
      shopCalculatedFee = calculateWeightFee(order.weight, targetShop.pricingPlan);
      if (order.status === 'returned' || order.status === 'returning') {
        const returnRatio = (targetShop.pricingPlan.returnFeePercent !== undefined ? targetShop.pricingPlan.returnFeePercent : 50) / 100;
        shopCalculatedFee = Math.round(shopCalculatedFee * returnRatio);
      }
      shopOtherFee = targetShop.pricingPlan.fixedSurcharge || 0;
    }

    const netShopPayout = order.codAmount - shopCalculatedFee - shopOtherFee;
    const profitMargin = (shopCalculatedFee + shopOtherFee) - (order.nvcBaseFee + order.nvcOtherFee);

    const updatedOrder: ReconciledOrder = {
      ...order,
      shopId: targetShop.id,
      shopName: targetShop.name,
      shopPhone: targetShop.phone,
      shopAddress: targetShop.address,
      shopCalculatedFee,
      shopOtherFee,
      netShopPayout,
      profitMargin,
      matched: true,
      matchError: undefined,
    };

    // Remove from unmatched
    const newUnmatched = currentSession.unmatchedOrders.filter(o => o.id !== order.id);

    // Add into existing statement or create new
    const updatedStatements = [...currentSession.statements];
    let stmtIndex = updatedStatements.findIndex(s => s.shopId === targetShop.id);

    if (stmtIndex >= 0) {
      const stmt = updatedStatements[stmtIndex];
      const newOrders = [...stmt.orders, updatedOrder];
      updatedStatements[stmtIndex] = {
        ...stmt,
        totalOrders: stmt.totalOrders + 1,
        deliveredOrders: stmt.deliveredOrders + (updatedOrder.status === 'delivered' ? 1 : 0),
        returnedOrders: stmt.returnedOrders + (updatedOrder.status === 'returned' ? 1 : 0),
        totalCod: stmt.totalCod + updatedOrder.codAmount,
        totalShopFee: stmt.totalShopFee + updatedOrder.shopCalculatedFee,
        totalShopOtherFee: stmt.totalShopOtherFee + updatedOrder.shopOtherFee,
        totalNetPayout: stmt.totalNetPayout + updatedOrder.netShopPayout,
        totalNvcCost: stmt.totalNvcCost + (updatedOrder.nvcBaseFee + updatedOrder.nvcOtherFee),
        totalProfit: stmt.totalProfit + updatedOrder.profitMargin,
        orders: newOrders,
      };
    } else {
      updatedStatements.push({
        shopId: targetShop.id,
        shopCode: targetShop.code,
        shopName: targetShop.name,
        shopPhone: targetShop.phone,
        shopEmail: targetShop.email,
        shopAddress: targetShop.address,
        bankInfo: targetShop.bankAccount,
        periodName: currentSession.sessionName,
        totalOrders: 1,
        deliveredOrders: updatedOrder.status === 'delivered' ? 1 : 0,
        returnedOrders: updatedOrder.status === 'returned' ? 1 : 0,
        inTransitOrders: 0,
        totalCod: updatedOrder.codAmount,
        totalShopFee: updatedOrder.shopCalculatedFee,
        totalShopOtherFee: updatedOrder.shopOtherFee,
        totalNetPayout: updatedOrder.netShopPayout,
        totalNvcCost: updatedOrder.nvcBaseFee + updatedOrder.nvcOtherFee,
        totalProfit: updatedOrder.profitMargin,
        orders: [updatedOrder],
        emailStatus: 'idle',
      });
    }

    const updatedSession: ReconciliationSession = {
      ...currentSession,
      matchedOrdersCount: currentSession.matchedOrdersCount + 1,
      unmatchedOrdersCount: newUnmatched.length,
      totalCod: currentSession.totalCod + updatedOrder.codAmount,
      totalShopRevenue: currentSession.totalShopRevenue + updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee,
      totalNetPayout: currentSession.totalNetPayout + updatedOrder.netShopPayout,
      totalProfit: currentSession.totalProfit + updatedOrder.profitMargin,
      statements: updatedStatements,
      unmatchedOrders: newUnmatched,
    };

    setCurrentSession(updatedSession);
  };

  // Download All as ZIP
  const handleDownloadAllZip = async () => {
    if (!currentSession) return;
    setZipProgress({ active: true, percent: 0, currentShop: 'Đang khởi tạo tệp ZIP...' });

    try {
      await ExcelService.downloadAllStatementsZip(currentSession, (percent, currentShop) => {
        setZipProgress({ active: true, percent, currentShop: `Đang đóng gói file: ${currentShop}...` });
      });
    } catch (e) {
      showToast('Có lỗi xảy ra khi tạo tệp ZIP.', 'error');
      console.error(e);
    } finally {
      setTimeout(() => {
        setZipProgress({ active: false, percent: 100, currentShop: '' });
      }, 800);
    }
  };

  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  // Sort statements
  const sortedStatements = currentSession ? [...currentSession.statements].sort((a, b) => {
    let diff = 0;
    if (sortField === 'name') diff = a.shopName.localeCompare(b.shopName);
    else if (sortField === 'orders') diff = a.totalOrders - b.totalOrders;
    else if (sortField === 'cod') diff = a.totalCod - b.totalCod;
    else if (sortField === 'fee') diff = a.totalShopFee - b.totalShopFee;
    else if (sortField === 'net') diff = a.totalNetPayout - b.totalNetPayout;
    else if (sortField === 'profit') diff = a.totalProfit - b.totalProfit;
    return sortAsc ? diff : -diff;
  }) : [];

  const handleToggleSort = (field: 'name' | 'orders' | 'cod' | 'fee' | 'net' | 'profit') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* 2-File Upload Dropzones */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <UploadCloud size={24} color="var(--primary)" />
              Bộ Xử Lý & Khớp Nối 2 File Excel Đối Soát
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Kéo và thả 2 file Excel trực tiếp vào ô bên dưới để tự động ghép theo Mã Vận Đơn, phân loại Shop và tính tiền COD.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Tên kỳ đối soát
            </label>
            <input
              type="text"
              value={sessionPeriodName}
              onChange={(e) => setSessionPeriodName(e.target.value)}
              className="input-field"
              style={{ padding: '6px 12px', fontSize: 13, width: 260 }}
            />
          </div>
        </div>

        {/* CARRIER CARDS SELECTOR */}
        <div style={{ marginBottom: 20, background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📦 Chọn Thẻ Đơn Vị Vận Chuyển Đối Soát:</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                (Bấm vào thẻ để chọn/bỏ chọn, bấm bánh răng ⚙️ để cài đặt Ánh Xạ Cột & Mẫu Xuất)
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
              Đang áp dụng: <strong>{selectedCarrierTier?.carrierName}</strong>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12,
          }}>
            {carriers.map(c => {
              const isSelected = c.carrierId === selectedCarrierId || c.id === selectedCarrierId;
              return (
                <div
                  key={c.id || c.carrierId}
                  onClick={() => setSelectedCarrierId(c.carrierId || c.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected 
                      ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.14) 0%, rgba(16, 185, 129, 0.10) 100%)' 
                      : 'var(--bg-primary)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.15)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Card Header: Checkbox + Code + ⚙️ Gear Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => setSelectedCarrierId(c.carrierId || c.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
                        title="Chọn / Bỏ chọn thẻ này"
                      />
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isSelected ? 'var(--primary)' : 'var(--bg-tertiary)',
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}>
                        {c.carrierId.toUpperCase()}
                      </span>
                    </div>

                    {/* BÁNH RĂNG CÀI ĐẶT THẺ NVC */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfigCarrier(c);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '3px 7px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        background: isSelected ? 'rgba(79, 70, 229, 0.15)' : 'var(--bg-tertiary)',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                      title={`Bấm để cài đặt Ánh Xạ Cột & Mẫu Xuất cho ${c.carrierName}`}
                    >
                      <Settings2 size={13} color="var(--primary)" />
                      <span>Cài đặt</span>
                    </button>
                  </div>

                  <div style={{
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                    lineHeight: 1.3,
                  }}>
                    {c.carrierName}
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Cước từ: <strong style={{ color: 'var(--text-main)' }}>{new Intl.NumberFormat('vi-VN').format(c.weightRules[0]?.price || 0)}đ</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2 Dropzones Grid with HTML5 Drag Events */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginBottom: 20,
        }}>
          
          {/* Dropzone 1: File NVC */}
          <div 
            onClick={() => nvcFileInputRef.current?.click()}
            onDragOver={handleNvcDragOver}
            onDragEnter={handleNvcDragOver}
            onDragLeave={handleNvcDragLeave}
            onDrop={handleNvcDrop}
            style={{
              border: `2px dashed ${isDraggingNvc ? 'var(--primary)' : nvcFile ? 'var(--success)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              background: isDraggingNvc ? 'rgba(79, 70, 229, 0.08)' : nvcFile ? 'var(--success-bg)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              transform: isDraggingNvc ? 'scale(1.02)' : 'none',
              boxShadow: isDraggingNvc ? '0 0 16px var(--primary-glow)' : 'none',
              position: 'relative',
            }}
          >
            <input
              type="file"
              ref={nvcFileInputRef}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleNvcFileChange(e.target.files[0])}
            />

            {nvcFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNvcFile(null);
                  setNvcRows([]);
                }}
                className="btn btn-secondary btn-sm"
                style={{ position: 'absolute', top: 10, right: 10, padding: '4px' }}
                title="Hủy chọn file này"
              >
                <XCircle size={14} color="var(--danger)" />
              </button>
            )}

            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: nvcFile ? 'var(--success)' : isDraggingNvc ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              {nvcFile ? <CheckCircle2 size={24} /> : <FileSpreadsheet size={24} color={isDraggingNvc ? '#fff' : 'var(--primary)'} />}
            </div>

            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {isDraggingNvc ? 'THẢ FILE ĐỐI SOÁT NVC VÀO ĐÂY' : '1. FILE ĐỐI SOÁT TỪ NVC'}
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {nvcFile ? (
                <strong style={{ color: 'var(--text-main)' }}>{nvcFile.name} ({nvcRows.length} dòng)</strong>
              ) : (
                'Kéo thả trực tiếp file Excel đối soát NVC vào đây (Có Mã đơn, COD, Cước...)'
              )}
            </p>

            {nvcFile && (
              <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                ✓ Đã nhận diện cột Mã vận đơn: <strong className="mono">[{nvcMapping.waybillColumn}]</strong>
              </div>
            )}
          </div>

          {/* Dropzone 2: File App */}
          <div 
            onClick={() => appFileInputRef.current?.click()}
            onDragOver={handleAppDragOver}
            onDragEnter={handleAppDragOver}
            onDragLeave={handleAppDragLeave}
            onDrop={handleAppDrop}
            style={{
              border: `2px dashed ${isDraggingApp ? 'var(--primary)' : appFile ? 'var(--success)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              background: isDraggingApp ? 'rgba(79, 70, 229, 0.08)' : appFile ? 'var(--success-bg)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              transform: isDraggingApp ? 'scale(1.02)' : 'none',
              boxShadow: isDraggingApp ? '0 0 16px var(--primary-glow)' : 'none',
              position: 'relative',
            }}
          >
            <input
              type="file"
              ref={appFileInputRef}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleAppFileChange(e.target.files[0])}
            />

            {appFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAppFile(null);
                  setAppRows([]);
                }}
                className="btn btn-secondary btn-sm"
                style={{ position: 'absolute', top: 10, right: 10, padding: '4px' }}
                title="Hủy chọn file này"
              >
                <XCircle size={14} color="var(--danger)" />
              </button>
            )}

            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: appFile ? 'var(--success)' : isDraggingApp ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              {appFile ? <CheckCircle2 size={24} /> : <FileSpreadsheet size={24} color={isDraggingApp ? '#fff' : 'var(--primary)'} />}
            </div>

            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {isDraggingApp ? 'THẢ FILE ĐƠN HÀNG APP VÀO ĐÂY' : '2. FILE ĐƠN HÀNG XUẤT TỪ APP'}
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              {appFile ? (
                <strong style={{ color: 'var(--text-main)' }}>{appFile.name} ({appRows.length} dòng)</strong>
              ) : (
                'Kéo thả trực tiếp file danh sách đơn xuất từ App vào đây (Có Tên Shop, SĐT...)'
              )}
            </p>

            {appFile && (
              <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                ✓ Đã nhận diện cột Shop: <strong className="mono">[{appMapping.shopNameColumn || 'Mặc định'}]</strong>
              </div>
            )}
          </div>

        </div>

        {/* Action Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 16,
          borderTop: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {(nvcFile || appFile || currentSession) && (
              <button
                onClick={handleResetReconciliation}
                className="btn btn-danger btn-sm"
                title="Hủy file đã tải và kết quả đối soát hiện tại (Giữ nguyên Danh sách Shop & Cài đặt cước)"
              >
                <RotateCcw size={15} />
                <span>Làm Mới / Hủy File</span>
              </button>
            )}
          </div>

          <button
            onClick={handleRunReconciliation}
            className="btn btn-primary btn-lg"
            disabled={isProcessing || nvcRows.length === 0 || appRows.length === 0}
            style={{ minWidth: 260 }}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Đang Ghép Nối & Tính Cước...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>TIẾN HÀNH ĐỐI SOÁT & TÍNH CƯỚC</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Dashboard */}
      {currentSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Financial KPI Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            <div className="kpi-card">
              <div className="kpi-title">
                <span>TỔNG SỐ ĐƠN HÀNG</span>
                <Layers size={18} color="var(--primary)" />
              </div>
              <div className="kpi-value">{currentSession.totalOrders.toLocaleString('vi-VN')}</div>
              <div className="kpi-subtext">
                <strong style={{ color: 'var(--success)' }}>{currentSession.matchedOrdersCount} đã khớp shop</strong> • {currentSession.unmatchedOrdersCount} chưa khớp
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-title">
                <span>TỔNG TIỀN COD THU HỘ</span>
                <DollarSign size={18} color="var(--info)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--info)' }}>
                {formatVND(currentSession.totalCod)}
              </div>
              <div className="kpi-subtext">Tiền NVC chuyển về tài khoản tổng</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-title">
                <span>CƯỚC TRẢ NVC (CHI PHÍ GỐC)</span>
                <DollarSign size={18} color="var(--warning)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>
                {formatVND(currentSession.totalNvcCost)}
              </div>
              <div className="kpi-subtext">Tính theo biểu giá mua sỉ {currentSession.carrierName}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-title">
                <span>DOANH THU CƯỚC THU SHOP</span>
                <DollarSign size={18} color="var(--primary)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--primary)' }}>
                {formatVND(currentSession.totalShopRevenue)}
              </div>
              <div className="kpi-subtext">Tổng cước trừ vào COD của các Shop</div>
            </div>

            <div className="kpi-card profit" style={{
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)',
              border: '1px solid var(--success-border)',
            }}>
              <div className="kpi-title" style={{ color: 'var(--success)' }}>
                <span>LỢI NHUẬN NHÀ GOM (LÃI THUẦN)</span>
                <TrendingUp size={18} color="var(--success)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>
                +{formatVND(currentSession.totalProfit)}
              </div>
              <div className="kpi-subtext" style={{ color: 'var(--text-main)' }}>
                = Doanh thu cước Shop - Cước gốc NVC
              </div>
            </div>

            <div className="kpi-card" style={{
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
            }}>
              <div className="kpi-title" style={{ color: 'var(--primary)' }}>
                <span>TỔNG TIỀN CẦN CHUYỂN CÁC SHOP</span>
                <CheckCircle2 size={18} color="var(--primary)" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--text-main)' }}>
                {formatVND(currentSession.totalNetPayout)}
              </div>
              <div className="kpi-subtext">= Tổng COD - Tổng Cước thu Shop</div>
            </div>
          </div>

          {/* Master Export Bar */}
          <div className="glass-panel" style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                Kỳ: <span style={{ color: 'var(--primary)' }}>{currentSession.sessionName}</span>
              </span>
              <span className="badge badge-success">
                {currentSession.statements.length} Shop đã phân loại
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => ExcelService.downloadMasterProfitReport(currentSession)}
                className="btn btn-secondary btn-sm"
              >
                <FileSpreadsheet size={15} />
                <span>Xuất Báo Cáo Lợi Nhuận Tổng (.xlsx)</span>
              </button>

              <button
                onClick={handleDownloadAllZip}
                disabled={zipProgress.active}
                className="btn btn-success btn-sm"
              >
                <Download size={15} />
                <span>
                  {zipProgress.active ? `Đang nén ZIP (${zipProgress.percent}%)...` : 'Tải Toàn Bộ Hồ Sơ (ZIP Từng Thư Mục Shop)'}
                </span>
              </button>

              <button
                onClick={() => onNavigateToEmail(currentSession)}
                className="btn btn-primary btn-sm"
              >
                <Mail size={15} />
                <span>Gửi Email Đối Soát Hàng Loạt</span>
              </button>
            </div>
          </div>

          {zipProgress.active && (
            <div style={{
              background: 'var(--bg-secondary)',
              padding: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--primary)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span>{zipProgress.currentShop}</span>
                <strong>{zipProgress.percent}%</strong>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${zipProgress.percent}%`, height: '100%', background: 'var(--brand-gradient)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {/* Sub Navigation Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: 12,
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setActiveResultTab('statements')}
                className={`btn btn-sm ${activeResultTab === 'statements' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Bảng Tổng Hợp Từng Shop ({currentSession.statements.length})
              </button>

              <button
                onClick={() => setActiveResultTab('allOrders')}
                className={`btn btn-sm ${activeResultTab === 'allOrders' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Chi Tiết Tất Cả Mã Vận Đơn ({currentSession.matchedOrdersCount})
              </button>

              {currentSession.unmatchedOrdersCount > 0 && (
                <button
                  onClick={() => setActiveResultTab('unmatched')}
                  className={`btn btn-sm ${activeResultTab === 'unmatched' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <AlertTriangle size={14} />
                  <span>Đơn Chưa Khớp ({currentSession.unmatchedOrdersCount})</span>
                </button>
              )}
            </div>

            {activeResultTab === 'statements' ? (
              <div style={{ position: 'relative', width: 240 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder="Lọc tên shop..."
                  value={searchShopQuery}
                  onChange={(e) => setSearchShopQuery(e.target.value)}
                  className="input-field"
                  style={{ padding: '6px 10px 6px 30px', fontSize: 13 }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select-field"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="delivered">Giao thành công</option>
                  <option value="returned">Chuyển hoàn</option>
                  <option value="in_transit">Đang giao</option>
                </select>

                <div style={{ position: 'relative', width: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    placeholder="Mã đơn, SĐT..."
                    value={searchOrderQuery}
                    onChange={(e) => setSearchOrderQuery(e.target.value)}
                    className="input-field"
                    style={{ padding: '6px 10px 6px 30px', fontSize: 13 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TAB 1: PER-SHOP STATEMENTS LIST WITH SORTING */}
          {activeResultTab === 'statements' && (
            <div className="table-container glass-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th onClick={() => handleToggleSort('name')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>Khách Hàng (Shop)</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleToggleSort('orders')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>Số Đơn</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleToggleSort('cod')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>Tổng COD Thu Hộ (+)</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleToggleSort('fee')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>Cước Tính Shop (-)</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th>Phí Khác (-)</th>
                    <th onClick={() => handleToggleSort('net')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>THỰC CHUYỂN CHO SHOP (=)</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleToggleSort('profit')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>Lợi Nhuận Gom Đơn</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStatements
                    .filter(s => s.shopName.toLowerCase().includes(searchShopQuery.toLowerCase()) || s.shopCode.toLowerCase().includes(searchShopQuery.toLowerCase()))
                    .map((stmt, idx) => (
                      <tr key={stmt.shopId}>
                        <td>{idx + 1}</td>
                        <td>
                          <div>
                            <strong style={{ fontSize: 14 }}>{stmt.shopName}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              Mã: <strong className="mono">{stmt.shopCode}</strong> • SĐT: {stmt.shopPhone || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {stmt.bankInfo.bankName} - {stmt.bankInfo.accountNumber} ({stmt.bankInfo.accountHolder})
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong>{stmt.totalOrders} đơn</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {stmt.deliveredOrders} xong • {stmt.returnedOrders} hoàn
                          </div>
                        </td>

                        <td className="mono" style={{ fontWeight: 600, color: 'var(--info)' }}>
                          {formatVND(stmt.totalCod)}
                        </td>

                        <td className="mono" style={{ fontWeight: 600, color: 'var(--warning)' }}>
                          {formatVND(stmt.totalShopFee)}
                        </td>

                        <td className="mono" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                          {formatVND(stmt.totalShopOtherFee)}
                        </td>

                        <td className="mono" style={{ fontWeight: 800, fontSize: 15, color: 'var(--success)' }}>
                          {formatVND(stmt.totalNetPayout)}
                        </td>

                        <td className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          +{formatVND(stmt.totalProfit)}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => setPreviewStatement(stmt)}
                              className="btn btn-secondary btn-sm"
                              title="Xem chi tiết bảng kê của Shop"
                            >
                              <Eye size={14} />
                              <span>Xem</span>
                            </button>

                            <button
                              onClick={() => ExcelService.downloadShopStatement(stmt)}
                              className="btn btn-secondary btn-sm"
                              title="Tải file Excel (.xlsx) riêng của Shop"
                            >
                              <Download size={14} />
                            </button>

                            <button
                              onClick={() => setQrStatement(stmt)}
                              className="btn btn-secondary btn-sm"
                              title="Mã VietQR chuyển tiền COD"
                            >
                              <QrCode size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: ALL RECONCILED ORDERS */}
          {activeResultTab === 'allOrders' && (
            <div className="table-container glass-panel" style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã Vận Đơn</th>
                    <th>Shop / Người Gửi</th>
                    <th>Người Nhận & Địa Chỉ</th>
                    <th>Khối Lượng</th>
                    <th>Tiền COD</th>
                    <th>Cước NVC</th>
                    <th>Cước Thu Shop</th>
                    <th>Lãi Gom</th>
                    <th>Thực Trả Shop</th>
                    <th>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSession.statements
                    .flatMap(s => s.orders)
                    .filter(order => {
                      const matchQuery = 
                        order.waybill.toLowerCase().includes(searchOrderQuery.toLowerCase()) ||
                        order.shopName.toLowerCase().includes(searchOrderQuery.toLowerCase()) ||
                        order.receiverPhone.includes(searchOrderQuery);
                      const matchStatus = statusFilter === 'ALL' || order.status === statusFilter;
                      return matchQuery && matchStatus;
                    })
                    .map((order, idx) => (
                      <tr key={order.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong className="mono" style={{ color: 'var(--primary)' }}>
                            {order.waybill}
                          </strong>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{order.shopName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{order.shopPhone}</div>
                        </td>
                        <td>
                          <div>{order.receiverName} ({order.receiverPhone})</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {order.receiverAddress}
                          </div>
                        </td>
                        <td>{order.weight} kg</td>
                        <td className="mono">{formatVND(order.codAmount)}</td>
                        <td className="mono" style={{ color: 'var(--text-dim)' }}>{formatVND(order.nvcBaseFee)}</td>
                        <td className="mono" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                          {formatVND(order.shopCalculatedFee)}
                        </td>
                        <td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                          +{formatVND(order.profitMargin)}
                        </td>
                        <td className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>
                          {formatVND(order.netShopPayout)}
                        </td>
                        <td>
                          <span className={`badge ${
                            order.status === 'delivered' ? 'badge-success' : 
                            order.status === 'returned' || order.status === 'returning' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {order.statusText || order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: UNMATCHED ORDERS WITH MANUAL ASSIGN CAPABILITY */}
          {activeResultTab === 'unmatched' && (
            <div className="table-container glass-panel">
              <div style={{ padding: 16, background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700 }}>
                  <AlertTriangle size={18} />
                  <span>Có {currentSession.unmatchedOrders.length} mã vận đơn không tìm thấy trong File Danh sách đơn xuất từ App</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Bạn có thể chỉ định gán đơn hàng vào Shop tương ứng ngay tại cột "Gán Cho Shop" bên dưới để hệ thống tự động tính lại cước.
                </p>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã Vận Đơn</th>
                    <th>Khối Lượng</th>
                    <th>Tiền COD</th>
                    <th>Cước NVC</th>
                    <th>Trạng Thái</th>
                    <th>Gán Thủ Công Cho Shop</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSession.unmatchedOrders.map((order, idx) => (
                    <tr key={order.id}>
                      <td>{idx + 1}</td>
                      <td><strong className="mono" style={{ color: 'var(--danger)' }}>{order.waybill}</strong></td>
                      <td>{order.weight} kg</td>
                      <td className="mono">{formatVND(order.codAmount)}</td>
                      <td className="mono">{formatVND(order.nvcBaseFee)}</td>
                      <td>{order.statusText}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <select
                            value={selectedAssignShops[order.id] || ''}
                            onChange={(e) => setSelectedAssignShops({
                              ...selectedAssignShops,
                              [order.id]: e.target.value
                            })}
                            className="select-field"
                            style={{ padding: '4px 8px', fontSize: 12, width: 220 }}
                          >
                            <option value="">-- Chọn Shop để gán --</option>
                            {shops.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                            ))}
                          </select>

                          <button
                            disabled={!selectedAssignShops[order.id]}
                            onClick={() => handleAssignUnmatchedOrder(order, selectedAssignShops[order.id])}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          >
                            <UserCheck size={13} />
                            <span>Gán đơn</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* Unified Carrier Profile Config Modal */}
      {configCarrier && (() => {
        const configCid = configCarrier.carrierId || configCarrier.id;
        // Merge: live headers (if file uploaded) + saved headers (from previous sessions)
        const savedH = StorageService.getCarrierHeaders(configCid);
        const mergedNvcHeaders = nvcHeaders.length > 0 ? nvcHeaders : savedH.nvcHeaders;
        const mergedAppHeaders = appHeaders.length > 0 ? appHeaders : savedH.appHeaders;
        // Use mapping for that carrier
        const configMapping = StorageService.getCarrierMapping(configCid);
        const configNvcMapping = configMapping.nvc || nvcMapping;
        const configAppMapping = configMapping.app || appMapping;
        return (
          <CarrierProfileConfigModal
            isOpen={!!configCarrier}
            onClose={() => setConfigCarrier(null)}
            carrierId={configCid}
            carrierName={configCarrier.carrierName}
            nvcHeaders={mergedNvcHeaders}
            appHeaders={mergedAppHeaders}
            nvcMapping={configNvcMapping}
            appMapping={configAppMapping}
            hasLiveNvcFile={nvcHeaders.length > 0}
            hasLiveAppFile={appHeaders.length > 0}
            hasSavedNvcHeaders={savedH.nvcHeaders.length > 0}
            hasSavedAppHeaders={savedH.appHeaders.length > 0}
            onSaveMappings={(newNvc, newApp) => {
              if (configCid === selectedCarrierId) {
                setNvcMapping(newNvc);
                setAppMapping(newApp);
              }
            }}
          />
        );
      })()}

      {/* Column Mapping Modal (Stand-alone fallback if triggered elsewhere) */}
      {showMappingModal && (
        <ColumnMappingModal
          isOpen={showMappingModal}
          onClose={() => setShowMappingModal(false)}
          nvcHeaders={nvcHeaders}
          appHeaders={appHeaders}
          nvcMapping={nvcMapping}
          appMapping={appMapping}
          carrierId={selectedCarrierId}
          carrierName={selectedCarrierTier?.carrierName}
          onSaveMappings={(newNvc, newApp) => {
            setNvcMapping(newNvc);
            setAppMapping(newApp);
          }}
        />
      )}

      {/* Export Columns Config Modal */}
      {showExportModal && (
        <ExportColumnConfigModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          carrierId={selectedCarrierId}
          carrierName={selectedCarrierTier?.carrierName}
        />
      )}

      {/* Statement Preview Modal */}
      {previewStatement && (
        <StatementPreviewModal
          statement={previewStatement}
          onClose={() => setPreviewStatement(null)}
          onOpenQr={(stmt) => setQrStatement(stmt)}
          onOpenEmail={() => {
            setPreviewStatement(null);
            if (currentSession) onNavigateToEmail(currentSession);
          }}
        />
      )}

      {/* VietQR Modal */}
      {qrStatement && (
        <VietQRModal
          statement={qrStatement}
          onClose={() => setQrStatement(null)}
        />
      )}

      {/* Discovered New Shops Onboarding Modal */}
      {isNewShopsModalOpen && discoveredNewShops.length > 0 && (
        <NewShopsOnboardingModal
          isOpen={isNewShopsModalOpen}
          onClose={() => setIsNewShopsModalOpen(false)}
          discoveredShops={discoveredNewShops}
          existingShops={shops}
          onSaveNewShopsAndContinue={handleSaveNewShopsAndContinue}
        />
      )}

    </div>
  );
};
