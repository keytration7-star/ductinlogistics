import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { 
  Plus, 
  Search, 
  Trash2, 
  Store, 
  CreditCard, 
  Calculator, 
  Check, 
  Sliders, 
  Zap, 
  Phone, 
  Save,
  X,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  GitMerge,
  CheckSquare,
  Square
} from 'lucide-react';
import type { Shop, WeightStepRule, UserAccount, ReconciliationSession, ShopPricingPlan } from '../types';
import { calculateWeightFee, detectUnregisteredShopsFromOrders } from '../services/reconciliationService';
import type { DetectedNewShop } from '../services/reconciliationService';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';
import { normalizeHeader, autoDetectColumns, parseNumber } from '../services/smartColumnDetector';

interface ShopManagementViewProps {
  shops: Shop[];
  onSaveShops: (shops: Shop[]) => void;
  currentUser?: UserAccount;
  sourceSession?: ReconciliationSession | null;
  activeCarrierId?: string;
  activeCarrierName?: string;
}

import { VIETNAM_BANKS as FULL_VIETNAM_BANKS } from '../constants/banks';

const VIETNAM_BANKS = FULL_VIETNAM_BANKS.map(b => b.shortName);

// 🎨 Palette for visually distinguishing eligible merge shop groups (same phone / same name)
const GROUP_COLORS = [
  { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', text: '#b45309', badge: '#fef3c7', dot: '#d97706', label: 'Cam' },
  { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', text: '#047857', badge: '#d1fae5', dot: '#059669', label: 'Xanh Lá' },
  { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', text: '#1d4ed8', badge: '#dbeafe', dot: '#2563eb', label: 'Xanh Dương' },
  { bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7', text: '#7e22ce', badge: '#f3e8ff', dot: '#9333ea', label: 'Tím' },
  { bg: 'rgba(236, 72, 153, 0.08)', border: '#ec4899', text: '#be185d', badge: '#fce7f3', dot: '#db2777', label: 'Hồng' },
  { bg: 'rgba(20, 184, 166, 0.08)', border: '#14b8a6', text: '#0f766e', badge: '#ccfbf1', dot: '#0d9488', label: 'Ngọc' },
  { bg: 'rgba(249, 115, 22, 0.08)', border: '#f97316', text: '#c2410c', badge: '#ffedd5', dot: '#ea580c', label: 'Cam Đậm' },
  { bg: 'rgba(99, 102, 241, 0.08)', border: '#6366f1', text: '#4338ca', badge: '#e0e7ff', dot: '#4f46e5', label: 'Chàm' },
];

/**
 * 🎨 Dynamic Field Styler:
 * - Green soft background & border if filled
 * - Amber warning background & border if important & empty
 * - Clean white if optional & empty
 */
const getInputStyle = (value: any, isRequired: boolean = false, customStyle?: React.CSSProperties): React.CSSProperties => {
  const isFilled = value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '0';
  if (isFilled) {
    return {
      background: 'rgba(16, 185, 129, 0.06)',
      border: '1.5px solid #10b981',
      color: '#065f46',
      fontWeight: 600,
      borderRadius: 'var(--radius-md)',
      transition: 'all 0.2s ease',
      ...customStyle,
    };
  }
  if (isRequired) {
    return {
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1.5px solid #f59e0b',
      color: '#92400e',
      borderRadius: 'var(--radius-md)',
      transition: 'all 0.2s ease',
      ...customStyle,
    };
  }
  return {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: 'var(--text-main)',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.2s ease',
    ...customStyle,
  };
};

const renderFieldAlert = (value: any, isRequired: boolean = false, customWarningText: string = 'Cần bổ sung') => {
  const isFilled = value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '0';
  if (!isFilled && isRequired) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10.5,
        fontWeight: 800,
        color: '#b45309',
        background: '#fef3c7',
        padding: '1px 6px',
        borderRadius: 4,
        border: '1px solid #fde68a',
        letterSpacing: '0.01em',
      }}>
        <AlertTriangle size={11} color="#d97706" />
        <span>{customWarningText}</span>
      </span>
    );
  }
  if (isFilled) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 10,
        fontWeight: 800,
        color: '#059669',
        background: '#ecfdf5',
        padding: '1px 5px',
        borderRadius: 4,
        border: '1px solid #a7f3d0',
      }}>
        <Check size={10} color="#059669" />
        <span>Đã có</span>
      </span>
    );
  }
  return null;
};

export const ShopManagementView: React.FC<ShopManagementViewProps> = ({ 
  shops, 
  onSaveShops, 
  currentUser, 
  sourceSession,
  activeCarrierId,
  activeCarrierName,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  // New Shop Auto-Detector from Excel
  const [detectedNewShops, setDetectedNewShops] = useState<DetectedNewShop[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedShopIndexes, setExpandedShopIndexes] = useState<Set<number>>(new Set());

  // Batch Multi-Select State (Xóa hàng loạt, Gán biểu giá hàng loạt, Gộp hàng loạt)
  const [selectedBatchShopIds, setSelectedBatchShopIds] = useState<string[]>([]);

  // In-List Merge Shop Mode & Confirmation Modal
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedMergeShopIds, setSelectedMergeShopIds] = useState<string[]>([]);
  const [isMergeConfirmModalOpen, setIsMergeConfirmModalOpen] = useState(false);
  const [targetMainShopId, setTargetMainShopId] = useState<string>('');
  const [customMergeName, setCustomMergeName] = useState<string>('');

  const [batchPricingPlan] = useState<ShopPricingPlan>({
    id: `plan_batch_default`,
    name: 'Bảng giá Tiêu chuẩn cho Shop mới',
    weightRules: [
      { minWeight: 0, maxWeight: 1, price: 20000 },
      { minWeight: 1, maxWeight: 3, price: 28000 },
      { minWeight: 3, maxWeight: 5, price: 35000 },
    ],
    extraStepWeight: 1,
    extraStepPrice: 5000,
    returnFeePercent: 50,
    insuranceFeePercent: 0,
    fixedSurcharge: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proposedSessionIdRef = useRef<string | null>(null);

  // Weight calculator test
  const [testWeight, setTestWeight] = useState<number>(1.5);

  // Auto select first shop on initial render
  useEffect(() => {
    if (shops.length > 0 && !selectedShopId) {
      setSelectedShopId(shops[0].id);
      setEditingShop(JSON.parse(JSON.stringify(shops[0])));
    }
  }, [shops, selectedShopId]);

  // A reconciliation session can propose only the orders that failed solely because
  // their shop is not registered. It never creates a shop or clears the hold itself.
  useEffect(() => {
    if (!sourceSession || proposedSessionIdRef.current === sourceSession.id) return;
    proposedSessionIdRef.current = sourceSession.id;
    const identityOnlyOrders = sourceSession.unmatchedOrders.filter(order =>
      order.canManualAssignShop &&
      Boolean(order.shopName?.trim()) &&
      !/khách vãng lai|shop không tên/i.test(order.shopName)
    );
    const proposed = detectUnregisteredShopsFromOrders(identityOnlyOrders, shops);
    if (proposed.length > 0) setDetectedNewShops(proposed);
  }, [sourceSession, shops]);

  // When selected shop changes from left list
  const handleSelectShop = (shop: Shop) => {
    setSelectedShopId(shop.id);
    setEditingShop(JSON.parse(JSON.stringify(shop)));
  };

  const filteredShops = shops.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Add new shop
  const handleCreateNewShop = () => {
    const defaultPricingPlan = {
      id: `plan_${Date.now()}`,
      name: 'Bảng giá tùy chỉnh',
      weightRules: [
        { minWeight: 0, maxWeight: 1, price: 25000 },
        { minWeight: 1, maxWeight: 3, price: 30000 },
        { minWeight: 3, maxWeight: 5, price: 35000 },
      ],
      extraStepWeight: 1,
      extraStepPrice: 5000,
      returnFeePercent: 50,
      insuranceFeePercent: 0,
      fixedSurcharge: 0,
    };

    const newShop: Shop = {
      id: `shop_${Date.now()}`,
      code: `SHOP_${shops.length + 1}`,
      name: `Shop Mới ${shops.length + 1}`,
      phone: '',
      email: '',
      address: '',
      bankAccount: {
        bankName: 'MB Bank',
        accountNumber: '',
        accountHolder: '',
      },
      pricingPlan: defaultPricingPlan,
      carrierId: activeCarrierId || 'jnt',
      notes: '',
      createdAt: new Date().toISOString(),
      active: true,
    };

    const updated = [newShop, ...shops];
    onSaveShops(updated);
    setSelectedShopId(newShop.id);
    setEditingShop(JSON.parse(JSON.stringify(newShop)));
    showToast(`Đã tạo ${newShop.name}. Bạn có thể chỉnh sửa chi tiết ở bảng bên phải.`, 'success');
  };

  // Save changes to current shop directly from Right Panel
  const handleSaveCurrentShop = () => {
    if (!editingShop) return;

    if (!editingShop.name.trim()) {
      showToast('Vui lòng nhập Tên Shop', 'warning');
      return;
    }

    // Parse multi-phone numbers
    const rawPhones = editingShop.phone || '';
    const parsedPhones = rawPhones
      .split(/[,/;\s]+/)
      .map(p => p.trim())
      .filter(p => p.length >= 7);

    const rawEmails = editingShop.email || '';
    const parsedEmails = rawEmails
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    const parsedNameAliases = (editingShop.nameAliases || [])
      .flatMap(value => (value || '').split(/[,;\n]+/))
      .map(value => value.trim())
      .filter(Boolean);

    const shopToSave: Shop = {
      ...editingShop,
      phone: rawPhones,
      phoneList: parsedPhones.length > 0 ? parsedPhones : [rawPhones],
      nameAliases: parsedNameAliases,
      email: rawEmails,
      emailList: parsedEmails.length > 0 ? parsedEmails : (rawEmails ? [rawEmails] : []),
    };

    const normalizePhone = (value: string) => {
      const digits = value.replace(/\D/g, '');
      return digits.startsWith('84') && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
    };
    const candidatePhones = new Set(shopToSave.phoneList?.map(normalizePhone).filter(Boolean));
    const candidateNames = new Set([shopToSave.name, ...(shopToSave.nameAliases || [])].map(normalizeHeader).filter(Boolean));
    const conflictingShop = shops.find(shop => {
      if (shop.id === shopToSave.id || !shop.active) return false;
      const existingPhones = [shop.phone, ...(shop.phoneList || [])].map(normalizePhone);
      const existingNames = [shop.name, ...(shop.nameAliases || [])].map(normalizeHeader);
      return existingPhones.some(phone => candidatePhones.has(phone)) || existingNames.some(name => candidateNames.has(name));
    });
    if (conflictingShop) {
      showToast(`Không thể lưu: SĐT hoặc tên/alias này đã thuộc shop “${conflictingShop.name}”. Gộp vào cùng hồ sơ hoặc dùng định danh riêng.`, 'error');
      return;
    }

    const index = shops.findIndex(s => s.id === shopToSave.id);
    let updatedShops: Shop[];

    if (index >= 0) {
      updatedShops = [...shops];
      updatedShops[index] = shopToSave;
    } else {
      updatedShops = [shopToSave, ...shops];
    }

    onSaveShops(updatedShops);
    showToast(`Đã lưu thay đổi cho Shop "${shopToSave.name}"!`, 'success');
  };

  // Keep financial references stable: a shop is deactivated, never removed.
  const handleDeactivateShop = async (shopId: string, shopName: string) => {
    if (currentUser?.role !== 'ADMIN') {
      await showConfirm({
        title: '🔒 Quyền Quản Trị Viên',
        message: 'Tài khoản Kế toán / Nhân viên không có quyền ngừng hoạt động Shop. Chỉ Admin mới có quyền thực hiện thao tác này.',
        confirmText: 'Đã hiểu',
      });
      return;
    }
    const ok = await showConfirm({
      title: 'Ngừng Hoạt Động Shop',
      message: `Ngừng nhận diện đơn mới cho shop "${shopName}"? Hồ sơ, bảng kê, công nợ và lịch sử cũ sẽ được giữ nguyên.`,
      confirmText: 'Ngừng hoạt động',
      warning: true,
    });
    if (ok) {
      const updated = shops.map(shop => shop.id === shopId ? { ...shop, active: false } : shop);
      onSaveShops(updated);
      const replacement = updated.find(shop => shop.active && shop.id !== shopId) || updated.find(shop => shop.id !== shopId) || null;
      setSelectedShopId(replacement?.id || null);
      setEditingShop(replacement ? JSON.parse(JSON.stringify(replacement)) : null);
      showToast(`Đã ngừng hoạt động shop "${shopName}"; dữ liệu lịch sử vẫn được giữ.`, 'info');
    }
  };

  // A master shop may only be physically removed before it has any operational
  // or financial footprint. Historical references must remain auditable.
  const getShopUsage = (shopId: string) => {
    const persistedSessions = StorageService.getSessions();
    const allSessions = sourceSession && !persistedSessions.some(session => session.id === sourceSession.id)
      ? [sourceSession, ...persistedSessions]
      : persistedSessions;
    const sessionCount = allSessions.filter(session =>
      session.statements.some(statement => statement.shopId === shopId) ||
      session.unmatchedOrders.some(order => order.shopId === shopId)
    ).length;
    const paymentCount = StorageService.getPaymentRecords()
      .filter(payment => payment.shopId === shopId).length;

    return { sessionCount, paymentCount, canDelete: sessionCount === 0 && paymentCount === 0 };
  };

  const handleDeleteEmptyShop = async (shop: Shop) => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Chỉ Admin được xóa shop chưa phát sinh.', 'warning');
      return;
    }

    const usage = getShopUsage(shop.id);
    if (!usage.canDelete) {
      showToast(`Không thể xóa “${shop.name}”: shop đã có ${usage.sessionCount} kỳ đối soát và ${usage.paymentCount} phiếu đi tiền. Hãy dùng “Ngừng hoạt động” để giữ lịch sử.`, 'warning');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Xóa Shop Chưa Phát Sinh',
      message: `Xóa vĩnh viễn hồ sơ “${shop.name}” (${shop.code})? Shop này chưa có đơn đối soát hoặc phiếu đi tiền. Thao tác chỉ xóa hồ sơ shop và không thể hoàn tác từ màn hình này.`,
      confirmText: 'Xóa shop',
      warning: true,
    });
    if (!confirmed) return;

    const updated = shops.filter(item => item.id !== shop.id);
    onSaveShops(updated);
    const replacement = updated.find(item => item.active) || updated[0] || null;
    setSelectedShopId(replacement?.id || null);
    setEditingShop(replacement ? JSON.parse(JSON.stringify(replacement)) : null);
    showToast(`Đã xóa hồ sơ shop chưa phát sinh “${shop.name}”.`, 'success');
  };

  // File Scanning Handler for New Shop Auto-Detection (Supports MULTIPLE Excel files at once)
  const handleScanExcelFileForNewShops = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      showToast('Chỉ Admin được quét và đăng ký shop mới.', 'warning');
      return;
    }
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsScanning(true);
    try {
      const allOrders: { shopName: string; shopPhone: string; shopAddress: string; shopCode: string; nvcCod: number; codAmount: number }[] = [];

      for (const file of files) {
        const { rows, headers } = await ExcelService.parseExcelFile(file);
        if (rows.length === 0) continue;

        const mapping = autoDetectColumns(headers, 'app');

        const extractField = (r: Record<string, any>, col?: string, keywords: string[] = []): string => {
          if (col && r[col] !== undefined && r[col] !== null) {
            const val = String(r[col]).trim();
            if (val) return val;
          }
          for (const k of Object.keys(r)) {
            const norm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '_');
            if (keywords.some(kw => norm.includes(kw) || kw.includes(norm))) {
              const val = r[k];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
              }
            }
          }
          return '';
        };

        const orders = rows.map(r => {
          const shopName = extractField(r, mapping.shopNameColumn, [
            'ten_shop', 'ten_cua_hang', 'cua_hang', 'shop', 'store', 'ten_nguoi_gui', 'nguoi_gui', 'sender_name', 'khach_hang', 'ten_khach_hang', 'chu_shop', 'ten_kho'
          ]);

          const shopPhone = extractField(r, mapping.shopPhoneColumn, [
            'sdt_shop', 'sdt_nguoi_gui', 'so_dien_thoai_nguoi_gui', 'so_dien_thoai', 'sdt', 'phone', 'sender_phone', 'phone_shop'
          ]);

          const shopAddress = extractField(r, mapping.shopAddressColumn, [
            'dia_chi_nguoi_gui', 'dia_chi_kho', 'dia_chi', 'kho_gui', 'address', 'sender_address'
          ]);

          const shopCode = extractField(r, mapping.shopCodeColumn, [
            'ma_shop', 'ma_shop_kho', 'ma_kho', 'ma_cua_hang', 'store_id', 'client_id', 'shop_code'
          ]);

          const codVal = parseNumber(
            (mapping.codColumn ? r[mapping.codColumn] : '') ||
            r['Tiền COD'] ||
            r['COD'] ||
            r['Tiền thu hộ'] ||
            r['Tiền COD đã ký nhận'] ||
            0
          );

          return {
            shopName: shopName || (shopCode ? `Shop ${shopCode}` : (shopPhone ? `Shop ${shopPhone}` : '')),
            shopPhone,
            shopAddress,
            shopCode,
            nvcCod: codVal,
            codAmount: codVal,
          };
        });

        allOrders.push(...orders);
      }

      if (allOrders.length === 0) {
        showToast('Không tìm thấy dữ liệu đơn hàng nào trong các file Excel đã chọn.', 'warning');
        return;
      }

      const detected = detectUnregisteredShopsFromOrders(allOrders, shops).map((shop, idx) => ({
        ...shop,
        pricingPlan: {
          ...JSON.parse(JSON.stringify(batchPricingPlan)),
          id: `plan_shop_detected_${Date.now()}_${idx}`,
          name: `Biểu giá ${shop.name}`,
        }
      }));

      setDetectedNewShops(detected);
      // Auto expand first shop if there are detected shops
      if (detected.length > 0) {
        setExpandedShopIndexes(new Set([0]));
      }
      setIsScanModalOpen(true);
      if (detected.length === 0) {
        showToast(`Đã quét ${files.length} file: Tất cả Shop đều đã có sẵn trong hệ thống!`, 'info');
      } else {
        showToast(`Nhận diện thành công ${detected.length} Shop từ ${files.length} file Excel!`, 'success');
      }
    } catch (err: any) {
      showToast('Lỗi khi đọc file Excel: ' + (err.message || err), 'warning');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Helper to check if a shop has full required information to reconcile (Green Tick)
  const isShopReadyToReconcile = (shop: DetectedNewShop): boolean => {
    const hasName = Boolean(shop.name && shop.name.trim());
    const hasPhone = Boolean(shop.phone && shop.phone.trim());
    const hasPricing = Boolean(
      shop.pricingPlan &&
      shop.pricingPlan.weightRules &&
      shop.pricingPlan.weightRules.length > 0 &&
      shop.pricingPlan.weightRules.some(r => r.price > 0)
    );
    return hasName && hasPhone && hasPricing;
  };

  const toggleExpandShop = (idx: number) => {
    setExpandedShopIndexes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAllShops = () => {
    setExpandedShopIndexes(new Set(detectedNewShops.map((_, idx) => idx)));
  };

  const collapseAllShops = () => {
    setExpandedShopIndexes(new Set());
  };

  const applyTemplateToAllShops = () => {
    setDetectedNewShops(prev => prev.map(shop => ({
      ...shop,
      pricingPlan: {
        ...JSON.parse(JSON.stringify(batchPricingPlan)),
        id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `Biểu giá ${shop.name}`,
      }
    })));
    showToast(`Đã áp dụng biểu giá mẫu cho toàn bộ ${detectedNewShops.length} Shop! Tất cả đều đã sẵn sàng.`, 'success');
  };

  const updateShopPricingPlan = (idx: number, updater: (plan: ShopPricingPlan) => ShopPricingPlan) => {
    setDetectedNewShops(prev => {
      const updated = [...prev];
      const currentPlan = updated[idx].pricingPlan || JSON.parse(JSON.stringify(batchPricingPlan));
      updated[idx] = {
        ...updated[idx],
        pricingPlan: updater(currentPlan),
      };
      return updated;
    });
  };

  // Helper to detect eligible merge groups across current shops
  const getEligibleMergeGroups = (): { id: string; type: 'SAME_PHONE' | 'SAME_NAME'; label: string; matchKey: string; shops: Shop[] }[] => {
    const groups: { id: string; type: 'SAME_PHONE' | 'SAME_NAME'; label: string; matchKey: string; shops: Shop[] }[] = [];

    // 1. Group by cleaned phone number
    const phoneMap = new Map<string, Shop[]>();
    shops.forEach(shop => {
      const phones = [shop.phone, ...(shop.phoneList || [])]
        .flatMap(p => (p || '').split(/[,/;\s]+/))
        .map(p => p.replace(/[^0-9]/g, ''))
        .filter(p => p.length >= 7);

      const uniquePhones = Array.from(new Set(phones));
      uniquePhones.forEach(phone => {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        const existing = phoneMap.get(phone)!;
        if (!existing.some(s => s.id === shop.id)) {
          existing.push(shop);
        }
      });
    });

    phoneMap.forEach((shopsWithPhone, phone) => {
      if (shopsWithPhone.length >= 2) {
        groups.push({
          id: `phone_${phone}`,
          type: 'SAME_PHONE',
          label: `📞 Chung Số Điện Thoại: ${phone}`,
          matchKey: phone,
          shops: shopsWithPhone,
        });
      }
    });

    // 2. Group by normalized name
    const nameMap = new Map<string, Shop[]>();
    shops.forEach(shop => {
      const norm = normalizeHeader(shop.name);
      if (norm.length >= 3) {
        if (!nameMap.has(norm)) nameMap.set(norm, []);
        const existing = nameMap.get(norm)!;
        if (!existing.some(s => s.id === shop.id)) {
          existing.push(shop);
        }
      }
    });

    nameMap.forEach((shopsWithName, normName) => {
      if (shopsWithName.length >= 2) {
        // Don't duplicate if already grouped by phone
        const alreadyGrouped = groups.some(g => 
          g.shops.length === shopsWithName.length && 
          g.shops.every(s => shopsWithName.some(sw => sw.id === s.id))
        );
        if (!alreadyGrouped) {
          groups.push({
            id: `name_${normName}`,
            type: 'SAME_NAME',
            label: `🏷️ Chung Tên Shop: ${shopsWithName[0].name}`,
            matchKey: shopsWithName[0].name,
            shops: shopsWithName,
          });
        }
      }
    });

    return groups;
  };

  // 🎨 Memoized color map for shops belonging to same-phone or same-name groups
  const shopGroupColorMap = useMemo(() => {
    const map = new Map<string, { color: typeof GROUP_COLORS[0]; groupName: string; matchKey: string; count: number; groupId: string }>();
    const eligibleGroups = getEligibleMergeGroups();

    eligibleGroups.forEach((group, gIdx) => {
      const color = GROUP_COLORS[gIdx % GROUP_COLORS.length];
      group.shops.forEach(s => {
        map.set(s.id, {
          color,
          groupName: group.type === 'SAME_PHONE' ? `SĐT: ${group.matchKey}` : `Tên: ${group.matchKey}`,
          matchKey: group.matchKey,
          count: group.shops.length,
          groupId: group.id,
        });
      });
    });

    return map;
  }, [shops]);

  // Helper to validate whether selected shops satisfy merge condition
  const validateMergeSelection = (selectedShops: Shop[]): { eligible: boolean; reason: string; type?: 'SAME_PHONE' | 'SAME_NAME' } => {
    if (selectedShops.length < 2) {
      return { eligible: false, reason: 'Vui lòng chọn ít nhất 2 Shop để gộp.' };
    }

    // Condition 1: Check if all selected shops share at least 1 common phone number
    const allPhonesPerShop = selectedShops.map(s => {
      const phones = [s.phone, ...(s.phoneList || [])]
        .flatMap(p => (p || '').split(/[,/;\s]+/))
        .map(p => p.replace(/[^0-9]/g, ''))
        .filter(p => p.length >= 7);
      return new Set(phones);
    });

    const firstShopPhones = Array.from(allPhonesPerShop[0]);
    const commonPhones = firstShopPhones.filter(phone => 
      allPhonesPerShop.every(phoneSet => phoneSet.has(phone))
    );

    if (commonPhones.length > 0) {
      return {
        eligible: true,
        reason: `Hợp lệ: Các shop này có CÙNG SỐ ĐIỆN THOẠI (${commonPhones.join(', ')})`,
        type: 'SAME_PHONE',
      };
    }

    // Condition 2: Check if all selected shops share the same name (or name variant)
    const names = selectedShops.map(s => normalizeHeader(s.name));
    const firstName = names[0];
    const allSameName = names.every(n => n === firstName || n.includes(firstName) || firstName.includes(n));

    if (allSameName) {
      return {
        eligible: true,
        reason: `Hợp lệ: Các shop này có CÙNG TÊN SHOP (${selectedShops[0].name})`,
        type: 'SAME_NAME',
      };
    }

    return {
      eligible: false,
      reason: 'Không đủ điều kiện gộp: Các shop được chọn không cùng Số điện thoại và cũng không cùng Tên shop. Quy định: Chỉ được gộp các shop có 1 SĐT nhiều tên hoặc 1 Tên nhiều SĐT.',
    };
  };

  // Handler to execute shop merge
  const handleExecuteMergeShops = async (customShopsToMerge?: Shop[], customTargetId?: string, customName?: string) => {
    const targetShops = customShopsToMerge || shops.filter(s => selectedMergeShopIds.includes(s.id));
    if (targetShops.length < 2) {
      showToast('Vui lòng chọn ít nhất 2 Shop để gộp.', 'warning');
      return;
    }

    const validation = validateMergeSelection(targetShops);
    if (!validation.eligible) {
      showToast(validation.reason, 'warning');
      return;
    }

    const mainId = customTargetId || targetMainShopId || targetShops[0].id;
    const mainShop = targetShops.find(s => s.id === mainId) || targetShops[0];
    const otherShops = targetShops.filter(s => s.id !== mainShop.id);

    const ok = await showConfirm({
      title: 'Xác Nhận Gộp Shop',
      message: `Bạn có chắc chắn muốn gộp ${otherShops.length} shop (${otherShops.map(s => s.name).join(', ')}) vào Shop chính "${customName || customMergeName || mainShop.name}"? Dữ liệu đơn hàng sau này sẽ tự động gom về 1 bảng kê duy nhất.`,
      warning: true,
    });

    if (!ok) return;

    // Collect all aliases
    const allNames = new Set<string>();
    if (mainShop.name) allNames.add(mainShop.name);
    (mainShop.nameAliases || []).forEach(a => a && allNames.add(a));
    otherShops.forEach(s => {
      if (s.name) allNames.add(s.name);
      (s.nameAliases || []).forEach(a => a && allNames.add(a));
    });

    const finalMainName = (customName || customMergeName || '').trim() || mainShop.name;
    allNames.delete(finalMainName);

    // Collect all phones
    const allPhones = new Set<string>();
    if (mainShop.phone) allPhones.add(mainShop.phone);
    (mainShop.phoneList || []).forEach(p => p && allPhones.add(p));
    otherShops.forEach(s => {
      if (s.phone) allPhones.add(s.phone);
      (s.phoneList || []).forEach(p => p && allPhones.add(p));
    });

    const mergedShop: Shop = {
      ...mainShop,
      name: finalMainName,
      nameAliases: Array.from(allNames),
      phone: mainShop.phone || Array.from(allPhones)[0] || '',
      phoneList: Array.from(allPhones),
      notes: `${mainShop.notes || ''} [Đã gộp ${otherShops.length} shop: ${otherShops.map(s => s.name).join(', ')}]`.trim(),
    };

    const otherShopIds = new Set(otherShops.map(s => s.id));
    const updated = shops
      .filter(s => !otherShopIds.has(s.id))
      .map(s => s.id === mainShop.id ? mergedShop : s);

    onSaveShops(updated);
    setSelectedShopId(mergedShop.id);
    setEditingShop(JSON.parse(JSON.stringify(mergedShop)));
    setIsMergeConfirmModalOpen(false);
    setIsMergeMode(false);
    setSelectedMergeShopIds([]);
    setSelectedBatchShopIds([]);
    setCustomMergeName('');
    showToast(`Đã gộp thành công ${targetShops.length} Shop thành Shop chính "${mergedShop.name}"!`, 'success');
  };

  // Batch Delete Selected Shops
  const handleBatchDeleteShops = async () => {
    if (selectedBatchShopIds.length === 0) return;
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên (Admin) mới có quyền xóa Shop.', 'warning');
      return;
    }

    const shopsToDelete = shops.filter(s => selectedBatchShopIds.includes(s.id));
    const ok = await showConfirm({
      title: `Xác Nhận Xóa ${shopsToDelete.length} Shop`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${shopsToDelete.length} Shop (${shopsToDelete.slice(0, 3).map(s => s.name).join(', ')}${shopsToDelete.length > 3 ? '...' : ''}) khỏi hệ thống?`,
      danger: true,
    });

    if (!ok) return;

    const deleteIds = new Set(selectedBatchShopIds);
    const remainingShops = shops.filter(s => !deleteIds.has(s.id));
    onSaveShops(remainingShops);
    setSelectedBatchShopIds([]);
    setSelectedMergeShopIds([]);

    if (remainingShops.length > 0) {
      setSelectedShopId(remainingShops[0].id);
      setEditingShop(JSON.parse(JSON.stringify(remainingShops[0])));
    } else {
      setSelectedShopId(null);
      setEditingShop(null);
    }

    showToast(`Đã xóa thành công ${shopsToDelete.length} Shop khỏi hệ thống.`, 'success');
  };

  // Batch Apply Template Pricing to Selected Shops
  const handleBatchApplyTemplatePricing = async () => {
    if (selectedBatchShopIds.length === 0) return;
    if (!isAdmin) {
      showToast('Chỉ Admin mới có quyền cập nhật biểu giá hàng loạt.', 'warning');
      return;
    }

    const ok = await showConfirm({
      title: 'Áp Dụng Biểu Giá Tiêu Chuẩn',
      message: `Bạn có muốn áp dụng Biểu giá Tiêu chuẩn (0-1kg: 20k, 1-3kg: 28k, 3-5kg: 35k, vượt cân: 5k/kg) cho ${selectedBatchShopIds.length} Shop đã chọn không?`,
    });

    if (!ok) return;

    const batchIds = new Set(selectedBatchShopIds);
    const updated = shops.map(shop => {
      if (batchIds.has(shop.id)) {
        return {
          ...shop,
          pricingPlan: {
            ...JSON.parse(JSON.stringify(batchPricingPlan)),
            id: `plan_${shop.id}_${Date.now()}`,
            name: `Biểu giá ${shop.name}`,
          },
        };
      }
      return shop;
    });

    onSaveShops(updated);
    if (editingShop && batchIds.has(editingShop.id)) {
      const updatedEditing = updated.find(s => s.id === editingShop.id);
      if (updatedEditing) setEditingShop(JSON.parse(JSON.stringify(updatedEditing)));
    }
    showToast(`Đã cập nhật Biểu giá Tiêu chuẩn cho ${selectedBatchShopIds.length} Shop thành công!`, 'success');
  };

  // Register All Detected Shops
  const handleRegisterAllDetectedShops = () => {
    if (detectedNewShops.length === 0) return;
    if (!isAdmin) {
      showToast('Chỉ Admin được phép đăng ký shop mới.', 'warning');
      return;
    }

    const newShopsList: Shop[] = detectedNewShops.map((d, i) => {
      const finalPricing = (d.pricingPlan && d.pricingPlan.weightRules && d.pricingPlan.weightRules.some(r => r.price > 0))
        ? d.pricingPlan
        : {
            ...JSON.parse(JSON.stringify(batchPricingPlan)),
            id: `plan_shop_${Date.now()}_${i}`,
            name: `Biểu giá ${d.name}`,
          };

      return {
        id: `shop_import_${Date.now()}_${i}`,
        code: d.code || `SHOP_${Date.now().toString().slice(-4)}_${i}`,
        name: d.name,
        phone: d.phone,
        phoneList: d.phoneList || (d.phone ? [d.phone] : []),
        email: d.email || '',
        address: d.address,
        bankAccount: {
          bankName: d.bankName || 'MB Bank',
          accountNumber: d.accountNumber || '',
          accountHolder: d.accountHolder || d.name,
        },
        pricingPlan: finalPricing,
        carrierId: activeCarrierId || 'jnt',
        notes: `Đã nhập tự động từ file Excel (${d.orderCount} đơn)`,
        createdAt: new Date().toISOString(),
        active: true,
      };
    });

    const updated = [...newShopsList, ...shops];
    onSaveShops(updated);
    showToast(`Đã thêm thành công ${newShopsList.length} Shop mới vào Quản Lý Shop!`, 'success');
    setIsScanModalOpen(false);
    setDetectedNewShops([]);
    setExpandedShopIndexes(new Set());
    if (newShopsList.length > 0) {
      setSelectedShopId(newShopsList[0].id);
      setEditingShop(JSON.parse(JSON.stringify(newShopsList[0])));
    }
  };

  // Weight step rules helper
  const handleAddWeightRule = () => {
    if (!editingShop) return;
    const currentRules = editingShop.pricingPlan.weightRules;
    const lastRule = currentRules[currentRules.length - 1];
    const newMin = lastRule ? Math.round((lastRule.maxWeight + 0.1) * 10) / 10 : 0;
    const newMax = lastRule ? Math.ceil(newMin) : 1;
    const newPrice = lastRule ? lastRule.price + 5000 : 25000;

    const newRules: WeightStepRule[] = [
      ...currentRules,
      { minWeight: newMin, maxWeight: newMax, price: newPrice }
    ];

    setEditingShop({
      ...editingShop,
      pricingPlan: {
        ...editingShop.pricingPlan,
        weightRules: newRules,
      }
    });
  };

  const handleRemoveWeightRule = (index: number) => {
    if (!editingShop || editingShop.pricingPlan.weightRules.length <= 1) return;
    const newRules = editingShop.pricingPlan.weightRules.filter((_, idx) => idx !== index);
    setEditingShop({
      ...editingShop,
      pricingPlan: {
        ...editingShop.pricingPlan,
        weightRules: newRules,
      }
    });
  };

  const handleWeightRuleChange = (index: number, field: keyof WeightStepRule, val: number) => {
    if (!editingShop) return;
    const newRules = [...editingShop.pricingPlan.weightRules];
    newRules[index] = { ...newRules[index], [field]: val };
    setEditingShop({
      ...editingShop,
      pricingPlan: {
        ...editingShop.pricingPlan,
        weightRules: newRules,
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Store size={24} color="var(--primary)" />
              Quản Lý Danh Sách Shop & Biểu Giá Riêng
            </h2>
            {activeCarrierName && (
              <span className="badge badge-primary" style={{ fontSize: 12, padding: '4px 10px', fontWeight: 800, letterSpacing: '0.02em' }}>
                HÃNG: {activeCarrierName.toUpperCase()}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {activeCarrierName
              ? `Không gian quản lý độc lập danh sách Shop, SĐT & Biểu cước bậc thang riêng cho đơn vị ${activeCarrierName}.`
              : 'Giao diện 2 bảng trực quan: Chọn Shop ở danh sách bên trái để xem và chỉnh sửa thông tin chi tiết live ở bảng bên phải.'}
          </p>
        </div>
      </div>

      {detectedNewShops.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid #f4b860', borderRadius: 'var(--radius-md)', background: '#fffbeb' }}>
          <div style={{ fontSize: 13, color: '#92400e' }}>
            <strong>{detectedNewShops.length} shop mới được đề xuất</strong> từ kỳ đối soát {sourceSession?.sessionName ? `“${sourceSession.sessionName}”` : ''}. Chưa shop nào được tự tạo.
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsScanModalOpen(true)}>
            <Store size={14} />
            <span>Xem & bổ sung thông tin</span>
          </button>
        </div>
      )}

      {/* Hidden File Input for New Shop Auto-Detection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleScanExcelFileForNewShops}
        accept=".xlsx,.xls,.csv"
        multiple
        style={{ display: 'none' }}
      />

      {/* 🌟 2-COLUMN MASTER-DETAIL WORKSPACE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: 16,
        alignItems: 'start',
      }}>
        
        {/* 👈 LEFT PANEL: DANH SÁCH KHÁCH HÀNG (MASTER LIST) */}
        <div className="glass-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* Action Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
              <button
                type="button"
                onClick={handleCreateNewShop}
                className="btn btn-primary btn-sm"
                style={{ justifyContent: 'center', padding: '6px 8px', fontSize: 11.5 }}
              >
                <Plus size={14} />
                <span>+ Thêm Shop</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary btn-sm"
                disabled={isScanning || !isAdmin}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#047857',
                  border: '1.5px solid #10b981',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  fontSize: 11.5,
                }}
                title="Bóc tách tự động danh sách Shop từ File Đơn Hàng App"
              >
                <Zap size={14} color="#10b981" />
                <span>{isScanning ? 'Đang đọc...' : '📥 Nhập Excel'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isMergeMode) {
                    setIsMergeMode(false);
                    setSelectedMergeShopIds([]);
                  } else {
                    setIsMergeMode(true);
                    setSelectedMergeShopIds([]);
                  }
                }}
                className="btn btn-secondary btn-sm"
                disabled={shops.length < 2 || !isAdmin}
                style={{
                  background: isMergeMode ? 'var(--primary)' : 'rgba(79, 70, 229, 0.10)',
                  color: isMergeMode ? '#fff' : 'var(--primary)',
                  border: '1.5px solid var(--primary)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  fontSize: 11.5,
                }}
                title="Bật/Tắt chế độ chọn các Shop cùng màu để gộp"
              >
                <GitMerge size={14} />
                <span>{isMergeMode ? '✕ Hủy Gộp' : '🤝 Gộp Shop'}</span>
              </button>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Tìm tên, mã shop, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
              />
            </div>
          </div>

          {/* ⚡ BATCH ACTIONS TOOLBAR WHEN SHOPS ARE SELECTED (PLINKED AT THE VERY TOP) */}
          {!isMergeMode && selectedBatchShopIds.length > 0 && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--primary)',
              background: '#fff',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  ⚡ Thao tác {selectedBatchShopIds.length} Shop đã chọn:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBatchShopIds([])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Bỏ chọn
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  onClick={handleBatchDeleteShops}
                  className="btn btn-sm"
                  disabled={!isAdmin}
                  style={{
                    background: 'rgba(239, 68, 68, 0.10)',
                    color: '#dc2626',
                    border: '1px solid #ef4444',
                    fontWeight: 700,
                    fontSize: 11,
                    justifyContent: 'center',
                    padding: '6px 8px',
                  }}
                  title="Xóa vĩnh viễn các shop đã chọn"
                >
                  <Trash2 size={13} />
                  <span>Xóa ({selectedBatchShopIds.length}) Shop</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchApplyTemplatePricing}
                  className="btn btn-sm"
                  disabled={!isAdmin}
                  style={{
                    background: 'rgba(16, 185, 129, 0.10)',
                    color: '#047857',
                    border: '1px solid #10b981',
                    fontWeight: 700,
                    fontSize: 11,
                    justifyContent: 'center',
                    padding: '6px 8px',
                  }}
                  title="Gán biểu giá chuẩn cho các shop đã chọn"
                >
                  <Zap size={13} />
                  <span>Gán biểu giá chuẩn</span>
                </button>
              </div>

              {selectedBatchShopIds.length >= 2 && (() => {
                const selectedShops = shops.filter(s => selectedBatchShopIds.includes(s.id));
                const validation = validateMergeSelection(selectedShops);

                if (validation.eligible) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMergeShopIds(selectedBatchShopIds);
                        setTargetMainShopId(selectedShops[0].id);
                        setCustomMergeName(selectedShops[0].name);
                        setIsMergeConfirmModalOpen(true);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, padding: '7px 10px' }}
                    >
                      <GitMerge size={14} />
                      <span>Gộp {selectedBatchShopIds.length} Shop này thành 1 →</span>
                    </button>
                  );
                }

                return (
                  <div style={{ fontSize: 10.5, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4, background: '#fef2f2', padding: '4px 8px', borderRadius: 4 }}>
                    <AlertCircle size={12} color="#ef4444" style={{ flexShrink: 0 }} />
                    <span>Để gộp, các shop được tick chọn phải cùng SĐT hoặc cùng Tên (cùng màu).</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 🌟 ACTION BAR WHEN IN MERGE MODE (PLINKED AT THE VERY TOP) */}
          {isMergeMode && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--primary)',
              background: '#fff',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  Đã chọn: <strong style={{ color: 'var(--primary)', fontSize: 13 }}>{selectedMergeShopIds.length}</strong> Shop
                </span>
                {selectedMergeShopIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMergeShopIds([])}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>

              {(() => {
                const selectedShops = shops.filter(s => selectedMergeShopIds.includes(s.id));
                if (selectedShops.length === 0) {
                  return (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      💡 Tick chọn các shop <strong>cùng màu</strong> (cùng SĐT hoặc cùng Tên) ở dưới.
                    </div>
                  );
                }

                const validation = validateMergeSelection(selectedShops);

                if (validation.eligible) {
                  return (
                    <>
                      <div style={{ fontSize: 11.5, color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <CheckCircle2 size={14} color="#10b981" />
                        <span>{validation.reason}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetMainShopId(selectedShops[0].id);
                          setCustomMergeName(selectedShops[0].name);
                          setIsMergeConfirmModalOpen(true);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ fontWeight: 800, justifyContent: 'center', padding: '8px 12px', fontSize: 12.5 }}
                      >
                        <GitMerge size={15} />
                        <span>💾 XÁC NHẬN GỘP ({selectedShops.length}) →</span>
                      </button>
                    </>
                  );
                }

                return (
                  <div style={{ fontSize: 11, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 4, background: '#fef2f2', padding: '6px 8px', borderRadius: 4 }}>
                    <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0 }} />
                    <span>Chỉ được gộp các shop có CÙNG SĐT hoặc CÙNG TÊN (cùng màu).</span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Merge Mode Explanatory Notice */}
          {isMergeMode && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
              border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontSize: 11,
              color: 'var(--text-main)',
              lineHeight: 1.4,
            }}>
              <strong>🎨 Chế độ Gộp Shop:</strong> Các shop có <strong>cùng màu viền/nhóm</strong> (chung SĐT hoặc chung Tên) có thể gộp với nhau. Tick chọn các shop để gộp:
            </div>
          )}

          {/* Master Checkbox Header (Chọn 1 hoặc tất cả) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 2px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: 6,
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-main)',
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={filteredShops.length > 0 && filteredShops.every(s => selectedBatchShopIds.includes(s.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    const allFilteredIds = filteredShops.map(s => s.id);
                    setSelectedBatchShopIds(Array.from(new Set([...selectedBatchShopIds, ...allFilteredIds])));
                  } else {
                    const filteredIds = new Set(filteredShops.map(s => s.id));
                    setSelectedBatchShopIds(selectedBatchShopIds.filter(id => !filteredIds.has(id)));
                  }
                }}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer', width: 16, height: 16 }}
              />
              <span>Danh Sách Shop ({filteredShops.length})</span>
            </label>

            {selectedBatchShopIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800 }}>
                  Đã chọn {selectedBatchShopIds.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBatchShopIds([])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10.5, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Bỏ chọn
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Shop List */}
          <div style={{
            maxHeight: (isMergeMode || selectedBatchShopIds.length > 0) ? 'calc(100vh - 360px)' : 'calc(100vh - 240px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingRight: 2,
          }}>
            {filteredShops.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '24px 14px',
                fontSize: 12,
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}>
                <Store size={32} style={{ opacity: 0.35, color: 'var(--primary)' }} />
                <div>Chưa có Shop nào trong hệ thống.</div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, fontSize: 11.5 }}
                >
                  📥 Nhập Shop Từ File Excel (File App)
                </button>
              </div>
            ) : (
              [...filteredShops].sort((a, b) => {
                const ga = shopGroupColorMap.get(a.id);
                const gb = shopGroupColorMap.get(b.id);
                // Shops in a color group come first, ungrouped shops last
                if (ga && !gb) return -1;
                if (!ga && gb) return 1;
                if (ga && gb) {
                  // Same group: keep together (sort by groupId, then by name within group)
                  if (ga.groupId !== gb.groupId) return ga.groupId.localeCompare(gb.groupId);
                  return a.name.localeCompare(b.name, 'vi');
                }
                // Both ungrouped: merged shops first, then by name
                const aMerged = Boolean(a.nameAliases && a.nameAliases.length > 0);
                const bMerged = Boolean(b.nameAliases && b.nameAliases.length > 0);
                if (aMerged && !bMerged) return -1;
                if (!aMerged && bMerged) return 1;
                return a.name.localeCompare(b.name, 'vi');
              }).map((shop) => {
                const isSelected = selectedShopId === shop.id;
                const isBatchChecked = selectedBatchShopIds.includes(shop.id);
                const isMergeChecked = selectedMergeShopIds.includes(shop.id);
                const isChecked = isMergeMode ? isMergeChecked : isBatchChecked;
                const groupInfo = shopGroupColorMap.get(shop.id);
                const isMerged = Boolean(shop.nameAliases && shop.nameAliases.length > 0);

                return (
                  <div
                    key={shop.id}
                    onClick={() => {
                      if (isMergeMode) {
                        if (isMergeChecked) {
                          setSelectedMergeShopIds(selectedMergeShopIds.filter(id => id !== shop.id));
                        } else {
                          setSelectedMergeShopIds([...selectedMergeShopIds, shop.id]);
                        }
                      } else {
                        handleSelectShop(shop);
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: isChecked
                        ? (isMerged ? '2px solid #b45309' : '2px solid var(--primary)')
                        : isMerged
                          ? (isSelected ? '2px solid #d97706' : '1.5px solid rgba(245, 158, 11, 0.45)')
                          : groupInfo
                            ? `1.5px solid ${groupInfo.color.border}`
                            : (isSelected
                                ? '1.5px solid var(--primary)'
                                : '1.5px solid rgba(226, 232, 240, 0.9)'),
                      borderLeft: isChecked
                        ? (isMerged ? '6px solid #b45309' : '6px solid var(--primary)')
                        : isMerged
                          ? (isSelected ? '6px solid #d97706' : '5px solid #f59e0b')
                          : groupInfo
                            ? `6px solid ${groupInfo.color.border}`
                            : (isSelected
                                ? '5px solid var(--primary)'
                                : '1.5px solid rgba(226, 232, 240, 0.9)'),
                      background: isChecked
                        ? (isMerged ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.85) 0%, rgba(253, 230, 138, 0.5) 100%)' : 'rgba(79, 70, 229, 0.08)')
                        : isMerged
                          ? (isSelected
                              ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.75) 0%, rgba(255, 251, 235, 0.95) 100%)'
                              : 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.35) 100%)')
                          : groupInfo
                            ? groupInfo.color.bg
                            : (isSelected
                                ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%)'
                                : '#ffffff'),
                      boxShadow: isMerged
                        ? ((isSelected || isChecked) ? '0 8px 20px -4px rgba(217, 119, 6, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9)' : '0 4px 12px -2px rgba(217, 119, 6, 0.12)')
                        : ((isSelected || isChecked) ? '0 8px 18px -4px rgba(79, 70, 229, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 4px 10px -2px rgba(15, 23, 42, 0.03)'),
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    {/* Checkbox per shop */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMergeMode) {
                          if (isMergeChecked) {
                            setSelectedMergeShopIds(selectedMergeShopIds.filter(id => id !== shop.id));
                          } else {
                            setSelectedMergeShopIds([...selectedMergeShopIds, shop.id]);
                          }
                        } else {
                          if (isBatchChecked) {
                            setSelectedBatchShopIds(selectedBatchShopIds.filter(id => id !== shop.id));
                          } else {
                            setSelectedBatchShopIds([...selectedBatchShopIds, shop.id]);
                          }
                        }
                      }}
                      style={{
                        padding: '4px 2px',
                        color: isChecked ? (isMerged ? '#b45309' : 'var(--primary)') : isMerged ? '#d97706' : (groupInfo ? groupInfo.color.border : 'var(--text-dim)'),
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                      title={isChecked ? 'Bỏ chọn shop này' : 'Tick chọn shop này để thao tác'}
                    >
                      {isChecked ? <CheckSquare size={17} color={isMerged ? '#b45309' : 'var(--primary)'} /> : <Square size={17} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <strong style={{
                          fontSize: 13,
                          color: isChecked || isSelected
                            ? (isMerged ? '#92400e' : 'var(--primary)')
                            : (isMerged ? '#78350f' : 'var(--text-main)'),
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontWeight: isMerged ? 800 : 700,
                        }}>
                          {shop.name}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {isMerged && (
                            <span
                              style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: '#ffffff',
                                border: '1px solid #b45309',
                                fontSize: 9.5,
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: 5,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                boxShadow: '0 2px 5px rgba(217, 119, 6, 0.3)',
                                letterSpacing: '0.02em',
                              }}
                              title={`Shop đã gộp ${shop.nameAliases!.length} tên phụ: ${shop.nameAliases!.join(', ')}`}
                            >
                              <GitMerge size={10} />
                              <span>ĐÃ GỘP ({shop.nameAliases!.length})</span>
                            </span>
                          )}
                          <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: isMerged ? '#b45309' : 'var(--text-dim)' }}>
                            {shop.code}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: isMerged ? '#92400e' : 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={10} color={isMerged ? '#d97706' : undefined} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shop.phone || 'Chưa có SĐT'}
                        </span>
                      </div>

                      {/* 🌟 Hiển thị danh sách các Shop đã gộp bên dưới */}
                      {isMerged && shop.nameAliases && shop.nameAliases.length > 0 && (
                        <div style={{
                          marginTop: 6,
                          padding: '5px 8px',
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px dashed rgba(217, 119, 6, 0.4)',
                          borderRadius: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <GitMerge size={10} color="#d97706" />
                            <span>Gồm {shop.nameAliases.length} shop đã gộp:</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {shop.nameAliases.map((alias, aIdx) => (
                              <span
                                key={aIdx}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid rgba(217, 119, 6, 0.45)',
                                  color: '#78350f',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  boxShadow: '0 1px 2px rgba(217, 119, 6, 0.08)',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                • {alias}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Group color tag badge */}
                      {groupInfo && (
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            background: groupInfo.color.badge,
                            color: groupInfo.color.text,
                            border: `1px solid ${groupInfo.color.border}`,
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 3,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: groupInfo.color.dot }} />
                            {groupInfo.groupName}
                          </span>
                        </div>
                      )}

                      {!groupInfo && !isMerged && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📍 {shop.address || 'Toàn quốc'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 👉 RIGHT PANEL: BẢNG CHI TIẾT & SỬA TRỰC TIẾP (LIVE REVIEW & EDITOR) */}
        {editingShop ? (
          <div className="glass-panel" style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
            border: '1.5px solid rgba(226, 232, 240, 0.95)',
            borderRadius: 16,
          }}>
            
            {/* Top Toolbar Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 16,
                }}>
                  {editingShop.code.slice(0, 4)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{editingShop.name || 'Shop chưa đặt tên'}</h3>
                    {editingShop.nameAliases && editingShop.nameAliases.length > 0 && (
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#ffffff',
                          border: '1px solid #b45309',
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 10px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.35)',
                          letterSpacing: '0.02em',
                        }}
                        title={`Shop đã gộp ${editingShop.nameAliases.length} tên phụ: ${editingShop.nameAliases.join(', ')}`}
                      >
                        <GitMerge size={12} />
                        <span>ĐÃ GỘP {editingShop.nameAliases.length} SHOP</span>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Mã Shop: <strong className="mono" style={{ color: 'var(--primary)' }}>{editingShop.code}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(() => {
                  const usage = getShopUsage(editingShop.id);
                  const deleteTitle = usage.canDelete
                    ? 'Xóa shop chưa có dữ liệu vận hành'
                    : `Không thể xóa: đã có ${usage.sessionCount} kỳ đối soát hoặc ${usage.paymentCount} phiếu đi tiền`;
                  return (
                    <button
                      type="button"
                      onClick={() => handleDeleteEmptyShop(editingShop)}
                      className="btn btn-danger btn-sm"
                      disabled={!usage.canDelete}
                      style={{ padding: '6px 12px', opacity: usage.canDelete ? 1 : 0.5, cursor: usage.canDelete ? 'pointer' : 'not-allowed' }}
                      title={deleteTitle}
                    >
                      <Trash2 size={14} />
                      <span>Xóa shop trống</span>
                    </button>
                  );
                })()}
                {editingShop.active && <button
                  type="button"
                  onClick={() => handleDeactivateShop(editingShop.id, editingShop.name)}
                  className="btn btn-danger btn-sm"
                  style={{ padding: '6px 12px' }}
                  title="Ngừng hoạt động, không xóa lịch sử"
                >
                  <Ban size={14} />
                  <span>Ngừng hoạt động</span>
                </button>
                }

                <button
                  type="button"
                  onClick={handleSaveCurrentShop}
                  className="btn btn-primary"
                  style={{ padding: '6px 16px' }}
                >
                  <Save size={16} />
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </div>

            {/* Section 1: Thông tin cơ bản */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid rgba(226, 232, 240, 0.95)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.04)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Store size={15} /> 1. THÔNG TIN CƠ BẢN CỦA SHOP
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Tên Shop / Thương hiệu (*)</label>
                    {renderFieldAlert(editingShop.name, true, 'Bắt buộc')}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Shop Thời Trang Mina"
                    value={editingShop.name}
                    onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
                    className="input-field"
                    style={getInputStyle(editingShop.name, true)}
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Các tên nhãn gửi phụ (Gom đơn)</label>
                    {renderFieldAlert(editingShop.nameAliases && editingShop.nameAliases.length > 0 ? 'filled' : '', false)}
                  </div>
                  <input
                    type="text"
                    placeholder="VD: Kho Mina, Mina Official..."
                    value={(editingShop.nameAliases || []).join(', ')}
                    onChange={(e) => {
                      const val = e.target.value;
                      const list = val.split(',').map(s => s.trimStart());
                      setEditingShop({
                        ...editingShop,
                        nameAliases: list.filter(Boolean)
                      });
                    }}
                    className="input-field"
                    style={getInputStyle(editingShop.nameAliases && editingShop.nameAliases.length > 0 ? 'filled' : '', false)}
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Mã Shop (Duy nhất)</label>
                    {renderFieldAlert(editingShop.code, true, 'Bắt buộc')}
                  </div>
                  <input
                    type="text"
                    placeholder="SHOP_A, MINA..."
                    value={editingShop.code}
                    onChange={(e) => setEditingShop({ ...editingShop, code: e.target.value.toUpperCase() })}
                    className="input-field mono"
                    style={getInputStyle(editingShop.code, true)}
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Số điện thoại gửi (*)</label>
                    {renderFieldAlert(editingShop.phone, true, 'Bắt buộc')}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0912345678, 0987654321..."
                    value={editingShop.phone}
                    onChange={(e) => setEditingShop({ ...editingShop, phone: e.target.value })}
                    className="input-field"
                    style={getInputStyle(editingShop.phone, true)}
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Email nhận đối soát</label>
                    {renderFieldAlert(editingShop.email, false)}
                  </div>
                  <input
                    type="text"
                    placeholder="shop@gmail.com, ketoan@gmail.com..."
                    value={editingShop.email}
                    onChange={(e) => setEditingShop({ ...editingShop, email: e.target.value })}
                    className="input-field"
                    style={getInputStyle(editingShop.email, false)}
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Cộng Tác Viên (CTV) Quản Lý</label>
                    {renderFieldAlert(editingShop.ctvId, false)}
                  </div>
                  <select
                    value={editingShop.ctvId || ''}
                    onChange={(e) => {
                      const selectedCtvId = e.target.value;
                      const ctvs = StorageService.getCtvs();
                      const foundCtv = ctvs.find(c => c.id === selectedCtvId);
                      setEditingShop({
                        ...editingShop,
                        ctvId: selectedCtvId,
                        ctvName: foundCtv ? foundCtv.name : '',
                      });
                    }}
                    className="input-field"
                    style={getInputStyle(editingShop.ctvId, false)}
                  >
                    <option value="">-- Không phân công CTV --</option>
                    {StorageService.getCtvs().map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label className="input-label" style={{ margin: 0 }}>Công nợ cũ còn tồn (-/+ VNĐ)</label>
                    {renderFieldAlert(editingShop.previousDebt, false)}
                  </div>
                  <input
                    type="number"
                    placeholder="0 (-500000 nếu Shop nợ)"
                    value={editingShop.previousDebt ?? ''}
                    onChange={(e) => setEditingShop({ ...editingShop, previousDebt: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="input-field"
                    style={getInputStyle(editingShop.previousDebt, false)}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="input-label" style={{ margin: 0 }}>Địa chỉ kho gửi hàng</label>
                  {renderFieldAlert(editingShop.address, false)}
                </div>
                <input
                  type="text"
                  placeholder="Số 123 đường ABC, Quận XYZ, Hà Nội"
                  value={editingShop.address}
                  onChange={(e) => setEditingShop({ ...editingShop, address: e.target.value })}
                  className="input-field"
                  style={getInputStyle(editingShop.address, false)}
                />
              </div>
            </div>

            {/* Section 2: Tài khoản ngân hàng & VietQR Code Preview */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid rgba(226, 232, 240, 0.95)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.04)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <CreditCard size={15} /> 2. THÔNG TIN TÀI KHOẢN NGÂN HÀNG NHẬN COD & MÃ VIETQR LIVE
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(79, 70, 229, 0.05) 100%)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: '1fr 140px',
                gap: 16,
                alignItems: 'center',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="input-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="input-label" style={{ margin: 0 }}>Tên Ngân hàng (*)</label>
                      {renderFieldAlert(editingShop.bankAccount?.bankName, true, 'Bắt buộc')}
                    </div>
                    <select
                      value={editingShop.bankAccount?.bankName || ''}
                      onChange={(e) => setEditingShop({
                        ...editingShop,
                        bankAccount: { ...editingShop.bankAccount, bankName: e.target.value }
                      })}
                      className="select-field"
                      style={getInputStyle(editingShop.bankAccount?.bankName, true)}
                    >
                      {VIETNAM_BANKS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="input-label" style={{ margin: 0 }}>Số tài khoản (*)</label>
                      {renderFieldAlert(editingShop.bankAccount?.accountNumber, true, 'Bắt buộc để bắn VietQR')}
                    </div>
                    <input
                      type="text"
                      placeholder="091234567899"
                      value={editingShop.bankAccount?.accountNumber || ''}
                      onChange={(e) => setEditingShop({
                        ...editingShop,
                        bankAccount: { ...editingShop.bankAccount, accountNumber: e.target.value }
                      })}
                      className="input-field mono"
                      style={getInputStyle(editingShop.bankAccount?.accountNumber, true)}
                    />
                  </div>

                  <div className="input-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="input-label" style={{ margin: 0 }}>Tên chủ tài khoản (*)</label>
                      {renderFieldAlert(editingShop.bankAccount?.accountHolder, true, 'Bắt buộc tên chủ thẻ')}
                    </div>
                    <input
                      type="text"
                      placeholder="NGUYEN VAN A"
                      value={editingShop.bankAccount?.accountHolder || ''}
                      onChange={(e) => setEditingShop({
                        ...editingShop,
                        bankAccount: { ...editingShop.bankAccount, accountHolder: e.target.value.toUpperCase() }
                      })}
                      className="input-field"
                      style={getInputStyle(editingShop.bankAccount?.accountHolder, true)}
                    />
                  </div>
                </div>

                {/* Live VietQR Preview */}
                <div style={{ textAlign: 'center' }}>
                  {editingShop.bankAccount?.accountNumber ? (
                    <>
                      <img
                        src={`https://img.vietqr.io/image/${(editingShop.bankAccount?.bankName || 'MBBank').replace(/\s+/g, '')}-${editingShop.bankAccount?.accountNumber}-compact.png?addInfo=Doi%20soat%20shop%20${editingShop.code}&accountName=${encodeURIComponent(editingShop.bankAccount?.accountHolder || editingShop.name)}`}
                        alt="VietQR Code"
                        style={{ width: 110, height: 110, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#fff', padding: 4 }}
                      />
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Mã VietQR Chuyển Khoản</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#d97706', fontStyle: 'italic', background: '#fffbeb', padding: '10px 6px', borderRadius: 8, border: '1px dashed #f59e0b' }}>
                      <AlertTriangle size={14} color="#d97706" style={{ margin: '0 auto 4px', display: 'block' }} />
                      Nhập STK để tạo VietQR Live
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Biểu giá cước bậc thang */}
            <div style={{
              background: '#ffffff',
              border: '1.5px solid rgba(226, 232, 240, 0.95)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.04)',
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sliders size={15} /> 3. BIỂU GIÁ CƯỚC BẬC THANG RIÊNG THEO CÂN NẶNG
                </div>
                <button
                  type="button"
                  onClick={handleAddWeightRule}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  <Plus size={13} />
                  <span>Thêm Nấc Cân Nặng</span>
                </button>
              </div>

              <div style={{
                background: 'var(--bg-primary)',
                padding: 14,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {editingShop.pricingPlan.weightRules.map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 120, fontSize: 12, fontWeight: 600 }}>
                      {idx === 0 ? `Từ 0 đến` : `Từ ${rule.minWeight} đến`}
                    </div>
                    <div style={{ width: 90 }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={rule.maxWeight}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleWeightRuleChange(idx, 'maxWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 1)}
                        className="input-field"
                        style={getInputStyle(rule.maxWeight, true, { padding: '4px 8px', fontSize: 12 })}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg:</span>
                    
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        step="500"
                        placeholder="0"
                        value={rule.price === 0 ? '' : rule.price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleWeightRuleChange(idx, 'price', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                        className="input-field"
                        style={getInputStyle(rule.price, true, { padding: '4px 8px', fontSize: 12 })}
                      />
                      {rule.price === 0 && (
                        <span style={{ fontSize: 10.5, color: '#d97706', fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <AlertTriangle size={11} color="#d97706" /> Cần nhập giá
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>VNĐ</span>

                    {editingShop.pricingPlan.weightRules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveWeightRule(idx)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 6px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}

                <div style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vượt cân: Mỗi thêm</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <input
                        type="number"
                        step="0.5"
                        value={editingShop.pricingPlan.extraStepWeight}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          pricingPlan: {
                            ...editingShop.pricingPlan,
                            extraStepWeight: parseFloat(e.target.value) || 0.5
                          }
                        })}
                        className="input-field"
                        style={getInputStyle(editingShop.pricingPlan.extraStepWeight, false, { padding: '4px 8px', fontSize: 12 })}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kg</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cước cộng thêm</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <input
                        type="number"
                        step="500"
                        placeholder="0"
                        value={editingShop.pricingPlan.extraStepPrice === 0 ? '' : editingShop.pricingPlan.extraStepPrice}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          pricingPlan: { ...editingShop.pricingPlan, extraStepPrice: parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0 }
                        })}
                        className="input-field"
                        style={getInputStyle(editingShop.pricingPlan.extraStepPrice, false, { padding: '4px 8px', fontSize: 12 })}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>đ</span>
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: 'var(--bg-tertiary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                      🔄 Quy Định Phí Chuyển Hoàn Của Shop:
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <button
                        type="button"
                        onClick={() => setEditingShop({
                          ...editingShop,
                          pricingPlan: {
                            ...editingShop.pricingPlan,
                            returnFeeType: 'free',
                            returnFeePercent: 0,
                          }
                        })}
                        className={`btn btn-sm ${(editingShop.pricingPlan.returnFeeType === 'free' || (!editingShop.pricingPlan.returnFeeType && editingShop.pricingPlan.returnFeePercent === 0)) ? 'btn-success' : 'btn-secondary'}`}
                        style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span>🎁 Miễn phí hoàn (0 đ)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingShop({
                          ...editingShop,
                          pricingPlan: {
                            ...editingShop.pricingPlan,
                            returnFeeType: 'percent',
                            returnFeePercent: editingShop.pricingPlan.returnFeePercent > 0 ? editingShop.pricingPlan.returnFeePercent : 50,
                          }
                        })}
                        className={`btn btn-sm ${editingShop.pricingPlan.returnFeeType === 'percent' || (!editingShop.pricingPlan.returnFeeType && editingShop.pricingPlan.returnFeePercent > 0) ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span>📊 Tính theo % cước gửi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingShop({
                          ...editingShop,
                          pricingPlan: {
                            ...editingShop.pricingPlan,
                            returnFeeType: 'fixed',
                            returnFeeFixed: editingShop.pricingPlan.returnFeeFixed !== undefined ? editingShop.pricingPlan.returnFeeFixed : 10000,
                          }
                        })}
                        className={`btn btn-sm ${editingShop.pricingPlan.returnFeeType === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span>💵 Số tiền cố định / đơn</span>
                      </button>
                    </div>

                    {(editingShop.pricingPlan.returnFeeType === 'percent' || (!editingShop.pricingPlan.returnFeeType && editingShop.pricingPlan.returnFeePercent > 0)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(79, 70, 229, 0.05)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Tỷ lệ cước hoàn:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={editingShop.pricingPlan.returnFeePercent || 50}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, returnFeeType: 'percent', returnFeePercent: parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0 }
                          })}
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: 12, width: 70 }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 700 }}>% cước gửi</span>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                          {[30, 50, 70, 100].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setEditingShop({
                                ...editingShop,
                                pricingPlan: { ...editingShop.pricingPlan, returnFeeType: 'percent', returnFeePercent: pct }
                              })}
                              className={`btn btn-sm ${editingShop.pricingPlan.returnFeePercent === pct ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '2px 6px', fontSize: 10 }}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editingShop.pricingPlan.returnFeeType === 'fixed' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(79, 70, 229, 0.05)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>Số tiền thu mỗi đơn hoàn:</span>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={editingShop.pricingPlan.returnFeeFixed !== undefined ? editingShop.pricingPlan.returnFeeFixed : 10000}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, returnFeeType: 'fixed', returnFeeFixed: parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0 }
                          })}
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: 12, width: 100 }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 700 }}>đ / đơn</span>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                          {[5000, 10000, 15000, 20000].map(amt => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setEditingShop({
                                ...editingShop,
                                pricingPlan: { ...editingShop.pricingPlan, returnFeeType: 'fixed', returnFeeFixed: amt }
                              })}
                              className={`btn btn-sm ${editingShop.pricingPlan.returnFeeFixed === amt ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '2px 6px', fontSize: 10 }}
                            >
                              {amt / 1000}k
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Live Weight Calculator */}
            <div style={{
              background: 'rgba(79, 70, 229, 0.06)',
              padding: 12,
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={16} color="var(--primary)" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Thử tính cước với cân nặng:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={testWeight}
                  onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0.1)}
                  className="input-field"
                  style={{ width: 70, padding: '3px 6px', fontSize: 12 }}
                />
                <span style={{ fontSize: 12 }}>kg</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cước tính ra:</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>
                  {new Intl.NumberFormat('vi-VN').format(calculateWeightFee(testWeight, editingShop.pricingPlan))} đ
                </span>
              </div>
            </div>

            {/* Bottom Floating Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={handleSaveCurrentShop}
                className="btn btn-primary"
                style={{ padding: '8px 24px', fontSize: 13 }}
              >
                <Save size={16} />
                <span>Lưu Tất Cả Thay Đổi</span>
              </button>
            </div>

          </div>
        ) : (
          <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Vui lòng chọn 1 Shop ở danh sách bên trái để xem và chỉnh sửa thông tin chi tiết.
          </div>
        )}

      </div>

      {/* 🌟 MODAL: NHẬP & CẤU HÌNH DANH SÁCH SHOP TỰ ĐỘNG TỪ FILE EXCEL */}
      {isScanModalOpen && (
        <div className="modal-overlay" onClick={() => setIsScanModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 960, maxHeight: '92vh', overflowY: 'auto', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.10) 0%, rgba(79, 70, 229, 0.08) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--success)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                }}>
                  <Zap size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                    📥 Nhập Danh Sách Shop Từ File Excel (File Đơn Hàng App)
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Phát hiện <strong style={{ color: 'var(--primary)' }}>{detectedNewShops.length} Shop mới</strong> từ file Excel. Bạn hãy kiểm tra thông tin, biểu giá và lưu chính thức vào hệ thống.
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setIsScanModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {detectedNewShops.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <Store size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Tất cả các Shop trong file Excel đều đã có sẵn trong danh mục Quản Lý Shop!</div>
                </div>
              ) : (
                <>
                  {/* BATCH ACTION & SUMMARY STATS TOOLBAR */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)',
                    border: '1.5px solid rgba(79, 70, 229, 0.18)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#ecfdf5',
                        border: '1px solid #10b981',
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: '#065f46',
                      }}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <span>Đủ điều kiện đối soát: {detectedNewShops.filter(isShopReadyToReconcile).length} / {detectedNewShops.length} Shop</span>
                      </div>

                      {detectedNewShops.some(s => !isShopReadyToReconcile(s)) && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#fffbeb',
                          border: '1px solid #f59e0b',
                          padding: '5px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#92400e',
                        }}>
                          <AlertCircle size={15} color="#f59e0b" />
                          <span>Cần cài biểu giá: {detectedNewShops.filter(s => !isShopReadyToReconcile(s)).length} Shop</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={applyTemplateToAllShops}
                        className="btn btn-secondary btn-sm"
                        style={{
                          background: '#fff',
                          color: 'var(--primary)',
                          borderColor: 'var(--primary)',
                          fontWeight: 700,
                          fontSize: 11.5,
                        }}
                        title="Tự động áp dụng biểu giá chuẩn (0-1kg: 20k, 1-3kg: 28k...) cho toàn bộ shop để đạt tích xanh hàng loạt"
                      >
                        <Zap size={14} color="var(--primary)" />
                        <span>⚡ Áp dụng biểu giá chuẩn cho TẤT CẢ Shop</span>
                      </button>

                      {expandedShopIndexes.size === detectedNewShops.length ? (
                        <button
                          type="button"
                          onClick={collapseAllShops}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11.5 }}
                        >
                          <ChevronUp size={14} />
                          <span>Thu gọn tất cả</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={expandAllShops}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11.5 }}
                        >
                          <ChevronDown size={14} />
                          <span>Mở rộng tất cả</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SHOP LIST TABLE WITH PER-SHOP ACCORDION */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📋 Danh Sách Shop Đọc Từ File Excel ({detectedNewShops.length} Shop):</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                        💡 Click vào từng Shop để mở rộng và tùy chỉnh Biểu giá cước riêng. Khi đủ thông tin sẽ hiện <strong>Tích Xanh</strong>.
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1.5px solid var(--border-color)' }}>
                            <th style={{ width: 45, textAlign: 'center' }}>STT</th>
                            <th style={{ width: 145, textAlign: 'center' }}>Điều Kiện Đối Soát</th>
                            <th style={{ textAlign: 'left', minWidth: 150 }}>Tên Shop</th>
                            <th style={{ textAlign: 'left', minWidth: 110 }}>SĐT Shop</th>
                            <th style={{ textAlign: 'left', minWidth: 130 }}>Địa Chỉ Kho Gửi</th>
                            <th style={{ textAlign: 'left', minWidth: 110 }}>Ngân Hàng</th>
                            <th style={{ textAlign: 'left', minWidth: 110 }}>Số Tài Khoản</th>
                            <th style={{ textAlign: 'left', minWidth: 120 }}>Tên Chủ TK</th>
                            <th style={{ textAlign: 'center', width: 75 }}>Số Đơn</th>
                            <th style={{ width: 105, textAlign: 'center' }}>Biểu Giá</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detectedNewShops.map((item, idx) => {
                            const isReady = isShopReadyToReconcile(item);
                            const isExpanded = expandedShopIndexes.has(idx);
                            const pricing = item.pricingPlan || batchPricingPlan;

                            return (
                              <React.Fragment key={idx}>
                                <tr
                                  style={{
                                    background: isExpanded ? 'rgba(79, 70, 229, 0.04)' : idx % 2 === 0 ? '#fff' : 'var(--bg-secondary)',
                                    borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)',
                                    transition: 'background 0.15s ease',
                                  }}
                                >
                                  {/* STT & Expand Toggle */}
                                  <td
                                    style={{ textAlign: 'center', cursor: 'pointer' }}
                                    onClick={() => toggleExpandShop(idx)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontWeight: 700, color: 'var(--text-muted)' }}>
                                      {idx + 1}
                                      {isExpanded ? <ChevronUp size={13} color="var(--primary)" /> : <ChevronDown size={13} />}
                                    </div>
                                  </td>

                                  {/* TRẠNG THÁI TÍCH XANH */}
                                  <td style={{ textAlign: 'center' }}>
                                    {isReady ? (
                                      <div
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          border: '1.5px solid #10b981',
                                          padding: '3px 8px',
                                          borderRadius: 20,
                                          fontSize: 11,
                                          fontWeight: 800,
                                          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.15)',
                                        }}
                                        title="Shop đã đủ tên, SĐT và biểu giá cước riêng để tính toán đối soát chuẩn xác!"
                                      >
                                        <CheckCircle2 size={13} color="#10b981" />
                                        <span>✓ ĐỦ ĐIỀU KIỆN</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandShop(idx)}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          background: '#fffbeb',
                                          color: '#b45309',
                                          border: '1.5px solid #f59e0b',
                                          padding: '3px 8px',
                                          borderRadius: 20,
                                          fontSize: 10.5,
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                        }}
                                        title="Bấm vào để cài đặt biểu giá cước cho shop này"
                                      >
                                        <AlertCircle size={12} color="#f59e0b" />
                                        <span>Cài Biểu Giá</span>
                                      </button>
                                    )}
                                  </td>

                                  {/* TÊN SHOP */}
                                  <td>
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => {
                                        const updated = [...detectedNewShops];
                                        updated[idx] = { ...updated[idx], name: e.target.value };
                                        setDetectedNewShops(updated);
                                      }}
                                      className="input-field"
                                      style={{ padding: '4px 7px', fontSize: 11.5, fontWeight: 700, width: '100%' }}
                                    />
                                  </td>

                                  {/* SĐT SHOP */}
                                  <td>
                                    <input
                                      type="text"
                                      value={item.phone || ''}
                                      onChange={(e) => {
                                        const updated = [...detectedNewShops];
                                        updated[idx] = { ...updated[idx], phone: e.target.value };
                                        setDetectedNewShops(updated);
                                      }}
                                      className="input-field mono"
                                      style={{ padding: '4px 7px', fontSize: 11, width: '100%' }}
                                    />
                                  </td>

                                  {/* ĐỊA CHỈ */}
                                  <td>
                                    <input
                                      type="text"
                                      value={item.address || ''}
                                      onChange={(e) => {
                                        const updated = [...detectedNewShops];
                                        updated[idx] = { ...updated[idx], address: e.target.value };
                                        setDetectedNewShops(updated);
                                      }}
                                      className="input-field"
                                      style={{ padding: '4px 7px', fontSize: 11, width: '100%' }}
                                    />
                                  </td>

                                  {/* NGÂN HÀNG */}
                                  <td>
                                    <select
                                      value={item.bankName || 'MB Bank'}
                                      onChange={(e) => {
                                        const updated = [...detectedNewShops];
                                        updated[idx] = { ...updated[idx], bankName: e.target.value };
                                        setDetectedNewShops(updated);
                                      }}
                                      className="select-field"
                                      style={{ padding: '4px 6px', fontSize: 11, width: '100%' }}
                                    >
                                      {VIETNAM_BANKS.map(b => (
                                        <option key={b} value={b}>{b}</option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* SỐ TÀI KHOẢN */}
                                  <td>
                                    <input
                                      type="text"
                                      placeholder="STK..."
                                      value={item.accountNumber || ''}
                                      onChange={(e) => {
                                        const updated = [...detectedNewShops];
                                        updated[idx] = { ...updated[idx], accountNumber: e.target.value };
                                        setDetectedNewShops(updated);
                                      }}
                                      className="input-field mono"
                                      style={{ padding: '4px 7px', fontSize: 11, width: '100%' }}
                                    />
                                  </td>

                                  {/* CHỦ TÀI KHOẢN */}
                                  <td>
                                    <input
                                      type="text"
                                      placeholder="Chủ TK..."
                                      value={item.accountHolder || item.name}
                                      onChange={(e) => {
                                        const updated = [...detectedNewShops];
                                        updated[idx] = { ...updated[idx], accountHolder: e.target.value };
                                        setDetectedNewShops(updated);
                                      }}
                                      className="input-field"
                                      style={{ padding: '4px 7px', fontSize: 11, width: '100%' }}
                                    />
                                  </td>

                                  {/* SỐ ĐƠN */}
                                  <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                                    {item.orderCount} đơn
                                  </td>

                                  {/* ACTION: MỞ RỘNG BIỂU GIÁ */}
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandShop(idx)}
                                      className={`btn btn-sm ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ fontSize: 11, padding: '4px 8px' }}
                                    >
                                      <Sliders size={12} />
                                      <span>{isExpanded ? 'Thu Gọn' : 'Biểu Giá'}</span>
                                    </button>
                                  </td>
                                </tr>

                                {/* 🌟 EXPANDED ROW: ACCORDION CHỈNH SỬA BIỂU GIÁ RIÊNG CHO TỪNG SHOP */}
                                {isExpanded && (
                                  <tr style={{ background: 'rgba(79, 70, 229, 0.035)', borderBottom: '1.5px solid rgba(79, 70, 229, 0.25)' }}>
                                    <td colSpan={10} style={{ padding: '14px 20px' }}>
                                      <div style={{
                                        background: '#fff',
                                        padding: 16,
                                        borderRadius: 'var(--radius-md)',
                                        border: '1.5px solid rgba(79, 70, 229, 0.25)',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontSize: 13.5, fontWeight: 800 }}>
                                            <Sliders size={16} />
                                            <span>💎 Biểu Phí Cước Cân Nặng Riêng Của Shop: <strong style={{ color: 'var(--text-main)' }}>{item.name}</strong></span>
                                          </div>

                                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <button
                                              type="button"
                                              className="btn btn-secondary btn-sm"
                                              onClick={() => {
                                                const currentRules = pricing.weightRules;
                                                const lastRule = currentRules[currentRules.length - 1];
                                                const newMin = lastRule ? Math.round((lastRule.maxWeight + 0.1) * 10) / 10 : 0;
                                                const newMax = lastRule ? Math.ceil(newMin) : 1;
                                                const newPrice = lastRule ? lastRule.price + 5000 : 25000;
                                                updateShopPricingPlan(idx, plan => ({
                                                  ...plan,
                                                  weightRules: [...currentRules, { minWeight: newMin, maxWeight: newMax, price: newPrice }],
                                                }));
                                              }}
                                              style={{ fontSize: 11, padding: '4px 9px' }}
                                            >
                                              <Plus size={13} /> Thêm nấc cân nặng
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                toggleExpandShop(idx);
                                                showToast(`Đã lưu biểu giá cho shop "${item.name}"!`, 'success');
                                              }}
                                              className="btn btn-primary btn-sm"
                                              style={{ fontSize: 11, padding: '4px 12px', fontWeight: 700 }}
                                            >
                                              <Check size={13} /> Hoàn tất Shop này
                                            </button>
                                          </div>
                                        </div>

                                        {/* Nấc cân nặng */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                          {pricing.weightRules.map((rule, rIdx) => (
                                            <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                              <div style={{ width: 100, fontSize: 12, fontWeight: 700 }}>
                                                {rIdx === 0 ? 'Từ 0 đến' : `Từ ${rule.minWeight} đến`}
                                              </div>
                                              <input
                                                type="number"
                                                min="0.1"
                                                step="0.1"
                                                value={rule.maxWeight}
                                                className="input-field"
                                                style={{ width: 82, padding: '5px 8px', fontSize: 12 }}
                                                onChange={(e) => {
                                                  const val = Number(e.target.value || 0);
                                                  updateShopPricingPlan(idx, plan => ({
                                                    ...plan,
                                                    weightRules: plan.weightRules.map((r, i) => i === rIdx ? { ...r, maxWeight: val } : r),
                                                  }));
                                                }}
                                              />
                                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg:</span>
                                              <input
                                                type="number"
                                                min="0"
                                                step="500"
                                                value={rule.price === 0 ? '' : rule.price}
                                                placeholder={rIdx === 0 ? 'Bắt buộc nhập cước' : '0'}
                                                className="input-field"
                                                style={{ flex: 1, minWidth: 130, padding: '5px 8px', fontSize: 12, fontWeight: 700 }}
                                                onChange={(e) => {
                                                  const val = Number(e.target.value || 0);
                                                  updateShopPricingPlan(idx, plan => ({
                                                    ...plan,
                                                    weightRules: plan.weightRules.map((r, i) => i === rIdx ? { ...r, price: val } : r),
                                                  }));
                                                }}
                                              />
                                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>VNĐ</span>
                                              {pricing.weightRules.length > 1 && (
                                                <button
                                                  type="button"
                                                  className="btn btn-danger btn-sm"
                                                  style={{ padding: '4px 6px' }}
                                                  onClick={() => {
                                                    updateShopPricingPlan(idx, plan => ({
                                                      ...plan,
                                                      weightRules: plan.weightRules.filter((_, i) => i !== rIdx),
                                                    }));
                                                  }}
                                                  title="Xóa nấc cân này"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              )}
                                            </div>
                                          ))}

                                          <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
                                            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                              Vượt cân: mỗi thêm
                                              <input
                                                type="number"
                                                min="0.1"
                                                step="0.1"
                                                value={pricing.extraStepWeight}
                                                className="input-field"
                                                style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }}
                                                onChange={(e) => updateShopPricingPlan(idx, plan => ({ ...plan, extraStepWeight: Number(e.target.value || 1) }))}
                                              />
                                            </label>

                                            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                              Cước cộng thêm (đ)
                                              <input
                                                type="number"
                                                min="0"
                                                step="500"
                                                value={pricing.extraStepPrice === 0 ? '' : pricing.extraStepPrice}
                                                placeholder="0"
                                                className="input-field"
                                                style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }}
                                                onChange={(e) => updateShopPricingPlan(idx, plan => ({ ...plan, extraStepPrice: Number(e.target.value || 0) }))}
                                              />
                                            </label>

                                            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                              Phí chuyển hoàn (%)
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={pricing.returnFeePercent}
                                                className="input-field"
                                                style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }}
                                                onChange={(e) => updateShopPricingPlan(idx, plan => ({ ...plan, returnFeePercent: Number(e.target.value || 0) }))}
                                              />
                                            </label>

                                            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                              Phụ thu cố định (đ)
                                              <input
                                                type="number"
                                                min="0"
                                                step="500"
                                                value={pricing.fixedSurcharge === 0 ? '' : pricing.fixedSurcharge}
                                                placeholder="0"
                                                className="input-field"
                                                style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }}
                                                onChange={(e) => updateShopPricingPlan(idx, plan => ({ ...plan, fixedSurcharge: Number(e.target.value || 0) }))}
                                              />
                                            </label>
                                          </div>
                                        </div>

                                        {/* Test cước live */}
                                        <div style={{ marginTop: 10, background: 'rgba(79, 70, 229, 0.05)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <Calculator size={15} color="var(--primary)" />
                                            <span style={{ fontSize: 12, fontWeight: 700 }}>Thử tính cước cho {item.name}:</span>
                                            <input
                                              type="number"
                                              min="0.1"
                                              step="0.1"
                                              defaultValue={1.5}
                                              className="input-field"
                                              style={{ width: 72, padding: '4px 7px', fontSize: 12 }}
                                              id={`test_weight_${idx}`}
                                              onChange={(e) => {
                                                const w = Number(e.target.value || 0.1);
                                                const calculated = calculateWeightFee(w, pricing);
                                                const el = document.getElementById(`calc_result_${idx}`);
                                                if (el) el.innerText = `${new Intl.NumberFormat('vi-VN').format(calculated)} đ`;
                                              }}
                                            />
                                            <span style={{ fontSize: 12 }}>kg</span>
                                          </div>
                                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            Cước tính ra: <strong id={`calc_result_${idx}`} className="mono" style={{ fontSize: 15, color: 'var(--success)' }}>{new Intl.NumberFormat('vi-VN').format(calculateWeightFee(1.5, pricing))} đ</strong>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{
              padding: '16px 24px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                💡 Khi bấm lưu, tất cả <strong>{detectedNewShops.length} Shop</strong> sẽ được tạo hồ sơ vĩnh viễn với đúng biểu giá riêng của từng shop.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setIsScanModalOpen(false)} className="btn btn-secondary">
                  Đóng
                </button>
                {detectedNewShops.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRegisterAllDetectedShops}
                    className="btn btn-primary"
                    disabled={!isAdmin}
                    style={{ fontWeight: 800, padding: '8px 20px', fontSize: 13 }}
                  >
                    <Check size={16} />
                    <span>💾 LƯU TOÀN BỘ {detectedNewShops.length} SHOP VÀO HỆ THỐNG</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL XÁC NHẬN GỘP SHOP & CHỌN LẤY GIÁ + THÔNG TIN CHUẨN */}
      {isMergeConfirmModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMergeConfirmModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.10) 0%, rgba(245, 158, 11, 0.08) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                }}>
                  <GitMerge size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                    🤝 Cấu Hình Gộp Shop: Chọn Shop Chuẩn
                  </h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    Chọn Shop nào để lấy Biểu giá cước & Thông tin tài khoản ngân hàng.
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setIsMergeConfirmModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '3px 6px' }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            {(() => {
              const selectedShops = shops.filter(s => selectedMergeShopIds.includes(s.id));
              const mainId = targetMainShopId || selectedShops[0]?.id;

              return (
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
                      1. Chọn Shop làm chuẩn (lấy Biểu Giá & Tài Khoản Ngân Hàng):
                    </label>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedShops.map(shop => {
                        const isMain = shop.id === mainId;
                        return (
                          <div
                            key={shop.id}
                            onClick={() => {
                              setTargetMainShopId(shop.id);
                              if (!customMergeName || selectedShops.some(s => s.name === customMergeName)) {
                                setCustomMergeName(shop.name);
                              }
                            }}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-md)',
                              border: isMain ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              background: isMain ? 'rgba(79, 70, 229, 0.06)' : '#fff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="radio"
                                name="target_main_shop"
                                checked={isMain}
                                onChange={() => {
                                  setTargetMainShopId(shop.id);
                                  if (!customMergeName || selectedShops.some(s => s.name === customMergeName)) {
                                    setCustomMergeName(shop.name);
                                  }
                                }}
                                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                              />
                              <div>
                                <strong style={{ fontSize: 13, color: isMain ? 'var(--primary)' : 'var(--text-main)' }}>{shop.name}</strong>
                                <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginLeft: 6 }}>({shop.code})</span>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                  📞 {shop.phone || 'Chưa có SĐT'} · 🏦 {shop.bankAccount?.bankName || 'MB Bank'} ({shop.bankAccount?.accountNumber || 'Chưa có STK'})
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right', fontSize: 11.5 }}>
                              <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                {shop.pricingPlan?.name || 'Biểu giá chuẩn'}
                              </div>
                              <div style={{ color: 'var(--text-dim)', fontSize: 10.5 }}>
                                {shop.pricingPlan?.weightRules?.[0] ? `0-1kg: ${shop.pricingPlan.weightRules[0].price.toLocaleString('vi-VN')} đ` : 'Chưa cài'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
                      2. Tên Shop Đại Diện (In trên Bảng Kê Excel):
                    </label>
                    <input
                      type="text"
                      value={customMergeName}
                      onChange={(e) => setCustomMergeName(e.target.value)}
                      placeholder="Nhập tên shop hiển thị..."
                      className="input-field"
                      style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontWeight: 700 }}
                    />
                  </div>

                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-sm)',
                    padding: 12,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}>
                    <div>💡 <strong>Sau khi gộp:</strong></div>
                    <div>• Tên phụ nhận diện tự động: <strong>{selectedShops.map(s => s.name).join(', ')}</strong></div>
                    <div>• SĐT nhận diện tự động: <strong>{Array.from(new Set(selectedShops.map(s => s.phone))).join(', ')}</strong></div>
                    <div>• Đơn hàng của tất cả các tên/SĐT trên sẽ tự gom về 1 bảng kê duy nhất mang tên <strong>"{customMergeName || 'Shop chính'}"</strong>.</div>
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div style={{
              padding: '14px 20px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}>
              <button type="button" onClick={() => setIsMergeConfirmModalOpen(false)} className="btn btn-secondary">
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleExecuteMergeShops()}
                className="btn btn-primary"
                style={{ fontWeight: 800, padding: '8px 20px', fontSize: 13 }}
              >
                <Check size={16} />
                <span>✓ HOÀN TẤT GỘP VÀO SHOP CHÍNH</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
