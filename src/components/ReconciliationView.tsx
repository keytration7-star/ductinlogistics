import React, { useState, useRef, useMemo, useEffect } from 'react';
import { generateSmartSessionName } from '../utils/periodUtils';
import { 
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
  Sparkles,
  ArrowUpDown,
  XCircle,
  UserCheck,
  RotateCcw,
  Settings2,
  ArrowLeft,
  ArrowRight,
  Store,
  Sliders,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { 
  Shop, 
  CarrierWholesaleTier, 
  ReconciliationSession, 
  ShopSettlementStatement,
  ColumnMappingConfig,
  ReconciledOrder,
  UserAccount,
  ShopPricingPlan
} from '../types';
import { ExcelService } from '../services/excelService';
import { autoDetectColumns, isSummaryOrInvalidWaybill, parseNumber, parseWeightToKg } from '../services/smartColumnDetector';
import { performReconciliation, calculateWeightFee, checkDuplicateWaybills, findRegisteredShop, extractRowField, type DuplicateCheckResult } from '../services/reconciliationService';
import { StatementPreviewModal } from './StatementPreviewModal';
import { VietQRModal } from './VietQRModal';
import { ColumnMappingModal } from './ColumnMappingModal';
import { ExportColumnConfigModal } from './ExportColumnConfigModal';
import { CarrierProfileConfigModal } from './CarrierProfileConfigModal';
import { DuplicateConflictModal } from './DuplicateConflictModal';
import { useToast, useConfirm } from './UIFeedback';

import { StorageService } from '../services/storage';
import { AuditService } from '../services/auditService';

interface SearchableShopPickerProps {
  shops: Shop[];
  selectedShopId: string;
  onSelectShop: (shopId: string) => void;
  onAssign: () => void;
}

function SearchableShopPicker({ shops, selectedShopId, onSelectShop, onAssign }: SearchableShopPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeShops = useMemo(() => shops.filter(s => s.active), [shops]);
  const selectedShop = useMemo(() => activeShops.find(s => s.id === selectedShopId), [activeShops, selectedShopId]);

  const filteredShops = useMemo(() => {
    if (!query.trim()) return activeShops;
    const q = query.trim().toLowerCase();
    return activeShops.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q)) ||
      (s.nameAliases || []).some(a => a.toLowerCase().includes(q))
    );
  }, [activeShops, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="select-field"
          style={{
            padding: '6px 12px',
            fontSize: 12,
            minWidth: 230,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: selectedShop ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
            borderColor: selectedShop ? 'var(--primary)' : 'var(--border-color)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontWeight: selectedShop ? 600 : 400,
            color: selectedShop ? 'var(--primary-dark)' : 'var(--text-muted)'
          }}
        >
          {selectedShop ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{selectedShop.name}</span>
              {selectedShop.phone && <span style={{ fontSize: 11, color: '#059669', background: 'rgba(16, 185, 129, 0.1)', padding: '1px 5px', borderRadius: 4 }}>📞 {selectedShop.phone}</span>}
            </span>
          ) : (
            <span>-- Chọn Shop để gán --</span>
          )}
          <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
        </button>

        <button
          disabled={!selectedShopId}
          onClick={onAssign}
          className="btn btn-primary btn-sm"
          style={{ padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <UserCheck size={13} />
          <span>Gán đơn</span>
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          width: 320,
          maxHeight: 280,
          background: 'var(--bg-primary, #ffffff)',
          border: '1px solid var(--border-color, #cbd5e1)',
          borderRadius: 8,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #f8fafc)' }}>
            <input
              type="text"
              autoFocus
              placeholder="🔍 Tìm tên shop, SĐT..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                border: '1px solid var(--border-color, #cbd5e1)',
                borderRadius: 6,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 220, padding: 4 }}>
            {filteredShops.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Không tìm thấy Shop khớp với từ khóa
              </div>
            ) : (
              filteredShops.map(shop => {
                const isSelected = shop.id === selectedShopId;
                return (
                  <div
                    key={shop.id}
                    onClick={() => {
                      onSelectShop(shop.id);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--primary-bg, rgba(59, 130, 246, 0.12))' : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      borderBottom: '1px solid rgba(226, 232, 240, 0.4)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{shop.name}</strong>
                      <span className="badge badge-secondary" style={{ fontSize: 10 }}>{shop.code}</span>
                    </div>
                    {shop.phone && (
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                        📞 {shop.phone}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReconciliationViewProps {
  shops: Shop[];
  carriers: CarrierWholesaleTier[];
  currentSession: ReconciliationSession | null;
  setCurrentSession: (session: ReconciliationSession | null) => void;
  onNavigateToEmail: (session: ReconciliationSession) => void;
  currentUser: UserAccount;
  onSaveShops: (shops: Shop[]) => void;
  activeCarrierId?: string;
}

export type CustomShopSubGroup = {
  id: string;
  name: string;
  entryKeys: string[];
  targetShopId?: string;
};


const createOnboardingPricingPlan = (shopName?: string): ShopPricingPlan => ({
  id: `plan_onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: shopName ? `Biểu giá ${shopName}` : 'Biểu giá cước bậc thang',
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

const isVerifiedCarrier = (carrier?: CarrierWholesaleTier): boolean => {
  const identity = `${carrier?.carrierId || ''} ${carrier?.carrierName || ''}`;
  return /(^|[^a-z])j\s*&?\s*t([^a-z]|$)|\bjnt\b|\bghn\b|giao\s*hang\s*nhanh/i.test(identity);
};

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  shops,
  carriers,
  currentSession,
  setCurrentSession,
  onNavigateToEmail,
  currentUser,
  onSaveShops,
  activeCarrierId,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const isAdmin = currentUser.role === 'ADMIN';

  // 4-Step Guided Wizard State: 1 = Nạp File, 2 = Khớp Nối & Kiểm Tra, 3 = Nhận Diện Shop, 4 = Kết Quả Đối Soát & Bảng Kê Chi Tiết
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(currentSession ? 4 : 1);

  // Sync wizard step to Step 4 ONLY when a new/different session is loaded from external sources (e.g. History click)
  const prevSessionIdRef = useRef<string | null>(currentSession?.id || null);
  useEffect(() => {
    if (currentSession && currentSession.id !== prevSessionIdRef.current) {
      prevSessionIdRef.current = currentSession.id;
      setWizardStep(4);
    }
  }, [currentSession]);

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
  
  const initialCarrierId = activeCarrierId || localStorage.getItem('gomdon_last_selected_carrier') || 'jnt';
  const [selectedCarrierId, setSelectedCarrierIdState] = useState<string>(initialCarrierId);

  // Sync when activeCarrierId changes from Hub
  React.useEffect(() => {
    if (activeCarrierId) {
      setSelectedCarrierIdState(activeCarrierId);
    }
  }, [activeCarrierId]);

  const fallbackCarrier: CarrierWholesaleTier = {
    id: selectedCarrierId || 'jnt',
    carrierId: selectedCarrierId || 'jnt',
    carrierName: selectedCarrierId === 'jnt' ? 'J&T Express' : (selectedCarrierId || 'NVC').toUpperCase(),
    weightRules: [{ minWeight: 0, maxWeight: 1, price: 20000 }],
    extraStepWeight: 1,
    extraStepPrice: 3500,
    returnFeePercent: 50,
  };

  const selectedCarrierTier = (carriers && carriers.length > 0)
    ? (carriers.find(c => c.carrierId === selectedCarrierId || c.id === selectedCarrierId) || carriers[0])
    : fallbackCarrier;
  const isJntCarrier = /(^|[^a-z])j\s*&?\s*t([^a-z]|$)|\bjnt\b/i.test(`${selectedCarrierTier?.carrierId || ''} ${selectedCarrierTier?.carrierName || ''}`);
  const isGhnCarrier = /\bghn\b|giao\s*hang\s*nhanh/i.test(`${selectedCarrierTier?.carrierId || ''} ${selectedCarrierTier?.carrierName || ''}`);
  const isVerifiedSelectedCarrier = isVerifiedCarrier(selectedCarrierTier);

  // Mode: J&T is 2-Files mode, GHN and all other carriers are 1-File mode
  const [reconcileMode, setReconcileMode] = useState<'1file' | '2files'>(isJntCarrier ? '2files' : '1file');

  // Auto-sync column mapping & mode when selected carrier changes
  React.useEffect(() => {
    if (selectedCarrierId) {
      const carrierMapping = StorageService.getCarrierMapping(selectedCarrierId);
      if (carrierMapping.nvc) setNvcMapping(carrierMapping.nvc);
      if (carrierMapping.app) setAppMapping(carrierMapping.app);
    }
    if (isJntCarrier) {
      setReconcileMode('2files');
    } else {
      setReconcileMode('1file');
    }
  }, [selectedCarrierId, isJntCarrier]);

  const getYesterdayIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const [sessionPeriodName, setSessionPeriodName] = useState<string>('');
  const [sessionPeriodDate, setSessionPeriodDate] = useState<string>(getYesterdayIso());

  // Auto-generate smart session period name when carrier or file changes
  React.useEffect(() => {
    const existingSessions = StorageService.getSessions();
    const carrierObj = carriers.find(c => c.id === selectedCarrierId || c.carrierId === selectedCarrierId);
    const cName = carrierObj ? carrierObj.carrierName : selectedCarrierId;
    const combinedRows = [...nvcRows, ...appRows];
    
    const smartName = generateSmartSessionName(cName, existingSessions, combinedRows);
    setSessionPeriodName(smartName);
  }, [selectedCarrierId, carriers, nvcRows, appRows]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [, setIsMappingConfirmed] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [configCarrier, setConfigCarrier] = useState<CarrierWholesaleTier | null>(null);
  const [ghnSheets, setGhnSheets] = useState<{ name: string; rowCount: number }[]>([]);
  const [selectedGhnSheet, setSelectedGhnSheet] = useState('');

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
  const [unmatchedSearchTerm, setUnmatchedSearchTerm] = useState('');

  // New shop pricing inputs (key = name|phone) — full plan per new shop
  const [newShopPricingMap, setNewShopPricingMap] = useState<Record<string, ShopPricingPlan>>({});
  const [expandedNewShopKey, setExpandedNewShopKey] = useState<string | null>(null);
  const [newShopTestWeights, setNewShopTestWeights] = useState<Record<string, number>>({});

  const filteredUnmatchedOrders = useMemo(() => {
    if (!currentSession) return [];
    if (!unmatchedSearchTerm.trim()) return currentSession.unmatchedOrders;
    const term = unmatchedSearchTerm.trim().toLowerCase();
    return currentSession.unmatchedOrders.filter(o =>
      o.waybill.toLowerCase().includes(term) ||
      (o.shopName && o.shopName.toLowerCase().includes(term)) ||
      (o.shopPhone && o.shopPhone.includes(term)) ||
      (o.receiverName && o.receiverName.toLowerCase().includes(term)) ||
      (o.receiverPhone && o.receiverPhone.includes(term)) ||
      (o.productName && o.productName.toLowerCase().includes(term))
    );
  }, [currentSession, unmatchedSearchTerm]);

  // Step 2 Fast Preview KPI Stats
  const quickPreviewStats = useMemo(() => {
    if (nvcRows.length === 0) return null;

    let totalOrders = 0;
    let totalCod = 0;
    let totalNvcFee = 0;
    let totalShopFee = 0;

    const waybillCol = nvcMapping.waybillColumn;
    const codCol = nvcMapping.codColumn;
    const feeCol = nvcMapping.feeColumn;
    const otherFeeCol = nvcMapping.otherFeeColumn;
    const additionalFeeCols = nvcMapping.additionalFeeColumns || [];
    const otherFeeCols = Array.from(new Set([otherFeeCol, ...additionalFeeCols].filter(Boolean))) as string[];
    const weightCol = nvcMapping.weightColumn;

    const carrierPricing: ShopPricingPlan = {
      id: selectedCarrierTier?.carrierId || 'carrier_nvc',
      name: selectedCarrierTier?.carrierName || 'Giá sỉ NVC',
      weightRules: selectedCarrierTier?.weightRules && selectedCarrierTier.weightRules.length > 0 ? selectedCarrierTier.weightRules : [
        { minWeight: 0, maxWeight: 1, price: 14000 },
        { minWeight: 1, maxWeight: 3, price: 20000 },
        { minWeight: 3, maxWeight: 5, price: 25000 },
      ],
      extraStepWeight: selectedCarrierTier?.extraStepWeight || 1,
      extraStepPrice: selectedCarrierTier?.extraStepPrice || 3500,
      returnFeePercent: selectedCarrierTier?.returnFeePercent !== undefined ? selectedCarrierTier.returnFeePercent : 50,
      insuranceFeePercent: 0,
      fixedSurcharge: 0,
    };

    const fallbackPricing: ShopPricingPlan = {
      id: 'plan_fallback',
      name: 'Bảng giá Tiêu chuẩn',
      weightRules: [
        { minWeight: 0, maxWeight: 1, price: 22000 },
        { minWeight: 1, maxWeight: 3, price: 28000 },
        { minWeight: 3, maxWeight: 5, price: 35000 },
      ],
      extraStepWeight: 1,
      extraStepPrice: 5000,
      returnFeePercent: 50,
      insuranceFeePercent: 0,
      fixedSurcharge: 0,
    };

    const appByWaybill = new Map<string, Record<string, any>>();
    if (reconcileMode === '2files' && appRows.length > 0) {
      const appWbCol = appMapping.waybillColumn;
      for (const row of appRows) {
        const wb = row[appWbCol];
        if (wb && !isSummaryOrInvalidWaybill(wb)) {
          appByWaybill.set(wb.toString().trim().toUpperCase(), row);
        }
      }
    }

    for (const row of nvcRows) {
      const rawWb = row[waybillCol];
      if (isSummaryOrInvalidWaybill(rawWb)) continue;
      totalOrders++;

      const cod = codCol ? parseNumber(row[codCol]) : 0;
      const nvcFee = feeCol ? parseNumber(row[feeCol]) : 0;
      const nvcOther = otherFeeCols.reduce((sum, col) => sum + parseNumber(row[col]), 0);
      totalCod += cod;

      const wbKey = rawWb.toString().trim().toUpperCase();
      const appRow = reconcileMode === '1file' ? row : appByWaybill.get(wbKey);
      
      let shopName = '';
      let shopPhone = '';
      if (reconcileMode === '1file') {
        shopName = extractRowField(undefined, row, nvcMapping.shopNameColumn, ['ten_shop', 'ten_cua_hang', 'shop']) || '';
        shopPhone = extractRowField(undefined, row, nvcMapping.shopPhoneColumn, ['sdt_shop', 'phone_shop', 'sdt_gui']) || '';
      } else if (appRow) {
        shopName = String(appMapping.shopNameColumn ? appRow[appMapping.shopNameColumn] || '' : '').trim();
        shopPhone = String(appMapping.shopPhoneColumn ? appRow[appMapping.shopPhoneColumn] || '' : '').trim();
      }

      const matchRes = findRegisteredShop(shops, { name: shopName, phone: shopPhone });
      const plan = matchRes.matched ? matchRes.shop.pricingPlan : fallbackPricing;
      
      const weightVal = weightCol ? row[weightCol] : (appRow && appMapping.weightColumn ? appRow[appMapping.weightColumn] : 0.5);
      const weight = parseWeightToKg(weightVal);
      
      // If fee column is mapped in file, use the exact fee from file (including 0đ). Only calculate by weight if no fee column exists in file.
      const effectiveNvcFee = feeCol ? nvcFee : calculateWeightFee(weight, carrierPricing);
      totalNvcFee += (effectiveNvcFee + nvcOther);

      // 🔑 J&T CORE RULE: Only charge Shop shipping fee if the NVC carrier actually charged a fee for this order (nvcFee > 0 or nvcOther > 0). If NVC fee is 0đ, Shop fee is strictly 0đ!
      const nvcHasFee = !feeCol || (effectiveNvcFee > 0 || nvcOther > 0);
      const sFee = nvcHasFee ? (calculateWeightFee(weight, plan) + (plan.fixedSurcharge || 0)) : 0;
      totalShopFee += sFee;
    }

    const estimatedProfit = totalShopFee - totalNvcFee;
    const estimatedShopPayout = totalCod - totalShopFee;

    return {
      totalOrders,
      totalCod,
      totalNvcFee,
      totalShopFee,
      estimatedProfit,
      estimatedShopPayout,
    };
  }, [nvcRows, appRows, nvcMapping, appMapping, reconcileMode, shops, selectedCarrierTier]);

  // Scan and categorize shops in uploaded files into (1) Existing Registered Shops vs (2) Unregistered New Shops
  const scannedShopAnalysis = useMemo(() => {
    const rowsToScan = reconcileMode === '2files' ? appRows : nvcRows;
    const nameCol = reconcileMode === '2files' ? appMapping.shopNameColumn : (nvcMapping.shopNameColumn || 'ten_shop');
    const phoneCol = reconcileMode === '2files' ? (appMapping.shopPhoneColumn || appMapping.receiverPhoneColumn) : (nvcMapping.shopPhoneColumn || 'sdt_shop');
    const codCol = nvcMapping.codColumn;

    const existingMap = new Map<string, {
      shop: Shop;
      aliasesInFile: Set<string>;
      phonesInFile: Set<string>;
      orderCount: number;
      totalCod: number;
    }>();

    const newMap = new Map<string, {
      name: string;
      phone: string;
      orderCount: number;
      totalCod: number;
      pricingPlan: ShopPricingPlan;
    }>();

    // Map nvc rows by waybill for COD lookup
    const nvcCodByWaybill = new Map<string, number>();
    if (codCol && nvcRows.length > 0) {
      const wbCol = nvcMapping.waybillColumn;
      for (const row of nvcRows) {
        const wb = row[wbCol];
        if (wb) {
          nvcCodByWaybill.set(wb.toString().trim().toUpperCase(), parseNumber(row[codCol]));
        }
      }
    }

    rowsToScan.forEach(row => {
      let rawName = '';
      let rawPhone = '';
      if (reconcileMode === '1file') {
        rawName = extractRowField(undefined, row, nvcMapping.shopNameColumn, ['ten_shop', 'ten_cua_hang', 'shop']) || '';
        rawPhone = extractRowField(undefined, row, nvcMapping.shopPhoneColumn, ['sdt_shop', 'phone_shop', 'sdt_gui']) || '';
      } else {
        rawName = String(nameCol ? row[nameCol] || '' : '').trim();
        rawPhone = String(phoneCol ? row[phoneCol] || '' : '').trim();
      }

      if (!rawName && !rawPhone) return;

      const wb = row[reconcileMode === '2files' ? appMapping.waybillColumn : nvcMapping.waybillColumn];
      const cod = wb ? (nvcCodByWaybill.get(wb.toString().trim().toUpperCase()) || 0) : 0;

      const matchRes = findRegisteredShop(shops, { name: rawName, phone: rawPhone });

      if (matchRes.matched) {
        const s = matchRes.shop;
        const current = existingMap.get(s.id) || {
          shop: s,
          aliasesInFile: new Set<string>(),
          phonesInFile: new Set<string>(),
          orderCount: 0,
          totalCod: 0,
        };
        if (rawName) current.aliasesInFile.add(rawName);
        if (rawPhone) current.phonesInFile.add(rawPhone);
        current.orderCount += 1;
        current.totalCod += cod;
        existingMap.set(s.id, current);
      } else {
        const key = `${rawName.toLowerCase()}|${rawPhone.replace(/\D/g, '')}`;
        const current = newMap.get(key) || {
          name: rawName || 'Shop Chưa Đặt Tên',
          phone: rawPhone,
          orderCount: 0,
          totalCod: 0,
          pricingPlan: createOnboardingPricingPlan(),
        };
        current.orderCount += 1;
        current.totalCod += cod;
        newMap.set(key, current);
      }
    });

    const existingList = Array.from(existingMap.values()).map(item => ({
      ...item,
      aliasesInFile: Array.from(item.aliasesInFile),
      phonesInFile: Array.from(item.phonesInFile),
    })).sort((a, b) => b.orderCount - a.orderCount);

    const newList = Array.from(newMap.values()).sort((a, b) => b.orderCount - a.orderCount);

    return {
      existingShops: existingList,
      newShops: newList,
      hasNewShops: newList.length > 0,
    };
  }, [reconcileMode, appRows, nvcRows, appMapping, nvcMapping, shops]);

  const getNewShopPricingPlan = (key: string, shopName?: string): ShopPricingPlan => {
    if (newShopPricingMap[key]) return newShopPricingMap[key];
    return createOnboardingPricingPlan(shopName);
  };

  const updateNewShopPricingPlan = (key: string, updater: (plan: ShopPricingPlan) => ShopPricingPlan, shopName?: string) => {
    setNewShopPricingMap(prev => {
      const current = prev[key] || getNewShopPricingPlan(key, shopName);
      return {
        ...prev,
        [key]: updater({
          ...current,
          weightRules: current.weightRules.map(r => ({ ...r })),
        }),
      };
    });
  };

  const addNewShopWeightRule = (key: string, shopName?: string) => {
    updateNewShopPricingPlan(key, plan => {
      const lastRule = plan.weightRules[plan.weightRules.length - 1];
      const newMin = lastRule ? Math.round((lastRule.maxWeight + 0.1) * 10) / 10 : 0;
      const newMax = lastRule ? Math.ceil(newMin + 2) : 1;
      const newPrice = lastRule ? lastRule.price + 5000 : 20000;
      return {
        ...plan,
        weightRules: [...plan.weightRules, { minWeight: newMin, maxWeight: newMax, price: newPrice }],
      };
    }, shopName);
  };

  const removeNewShopWeightRule = (key: string, index: number, shopName?: string) => {
    updateNewShopPricingPlan(key, plan => ({
      ...plan,
      weightRules: plan.weightRules.filter((_, i) => i !== index),
    }), shopName);
  };

  const handleAddNewScannedShops = (newShopsList: { name: string; phone: string; pricingPlan: ShopPricingPlan }[]) => {
    if (!isAdmin) {
      showToast('Chỉ Admin mới có quyền thêm Shop mới.', 'error');
      return;
    }
    const createdShops: Shop[] = newShopsList.map((item, idx) => {
      const key = `${item.name.toLowerCase()}|${item.phone.replace(/\D/g, '')}`;
      const pricingPlan = newShopPricingMap[key] || getNewShopPricingPlan(key, item.name);
      return {
        id: `shop_${Date.now()}_${idx}`,
        code: `SHOP-${String(shops.length + idx + 1).padStart(3, '0')}`,
        name: item.name,
        phone: item.phone,
        email: '',
        address: '',
        bankAccount: { bankName: '', accountNumber: '', accountHolder: '' },
        active: true,
        createdAt: new Date().toISOString(),
        pricingPlan,
        carrierId: activeCarrierId || selectedCarrierId || 'jnt',
        nameAliases: [],
        phoneAliases: [],
      };
    });

    const updatedShops = [...shops, ...createdShops];
    onSaveShops(updatedShops);
    showToast(`Đã thêm thành công ${createdShops.length} Shop mới kèm biểu giá cước vào Danh Mục Shop!`, 'success');
  };

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
      if (!isVerifiedSelectedCarrier) {
        showToast('Chỉ nhận file đối soát J&T hoặc GHN trong giai đoạn hiện tại.', 'warning');
        return;
      }
      setNvcFile(file);
      const parsed = await ExcelService.parseExcelFile(file);
      if (isGhnCarrier && parsed.format !== 'ghn_settlement' && parsed.format !== 'ghn_cod_transfer') {
        setNvcFile(null);
        showToast('File này không đúng cấu trúc đối soát GHN đã hỗ trợ (biên bản 2 bảng hoặc phiên chuyển tiền COD). Vui lòng kiểm tra lại hãng/file.', 'error');
        return;
      }
      if (!isGhnCarrier && (parsed.format === 'ghn_settlement' || parsed.format === 'ghn_cod_transfer')) {
        setNvcFile(null);
        showToast(`Bạn đang chọn ${selectedCarrierTier?.carrierName || 'hãng khác'}, nhưng file có cấu trúc biên bản GHN. Vui lòng chọn đúng thẻ GHN trước khi nhập.`, 'error');
        return;
      }
      if (isGhnCarrier && (parsed.format === 'ghn_settlement' || parsed.format === 'ghn_cod_transfer')) {
        if (!parsed.sheets?.length) throw new Error('Không tìm thấy sheet đối soát GHN hợp lệ');
        // A workbook may contain several settlement periods. Never pick one automatically:
        // mixing or settling the wrong period is a financial error.
        setGhnSheets(parsed.sheets);
        setSelectedGhnSheet('');
        setNvcHeaders([]);
        setNvcRows([]);
        setIsMappingConfirmed(false);
        setNvcMapping({ waybillColumn: '' });
        const ignored = parsed.ignoredSheetNames?.length || 0;
        showToast(
          ignored > 0
            ? `Đã nhận diện ${parsed.sheets.length} sheet GHN đúng cấu trúc. ${ignored} sheet cũ/khác cấu trúc sẽ không được nhập. Hãy chọn chính xác sheet/kỳ cần đối soát.`
            : `Đã nhận diện ${parsed.sheets.length} sheet GHN (${parsed.format === 'ghn_cod_transfer' ? 'Phiên chuyển tiền COD' : 'Biên bản COD + cước'}). Hãy chọn chính xác sheet/kỳ cần đối soát trước khi app nạp dữ liệu.`,
          ignored > 0 ? 'warning' : 'success'
        );
        return;
      }
      const { headers, rows } = parsed;
      setGhnSheets([]);
      setSelectedGhnSheet('');
      setNvcHeaders(headers);
      setNvcRows(rows);
      setIsMappingConfirmed(false);
      const saved = StorageService.getCarrierMapping(selectedCarrierId);
      const detectedMapping = autoDetectColumns(headers, 'nvc', saved.nvc, rows);
      setNvcMapping(detectedMapping);
      // 🔑 Lưu headers của hãng này để dùng khi mở cài đặt mà chưa có file
      const savedHeaders = StorageService.getCarrierHeaders(selectedCarrierId);
      StorageService.saveCarrierHeaders(selectedCarrierId, headers, savedHeaders.appHeaders);
    } catch (err) {
      showToast('Không thể đọc file đối soát NVC. Vui lòng kiểm tra định dạng Excel (.xlsx, .xls, .csv)', 'error');
      console.error(err);
    }
  };

  const handleGhnSheetChange = async (sheetName: string) => {
    if (!nvcFile || !sheetName) return;
    try {
      const parsed = await ExcelService.parseExcelFile(nvcFile, { sheetNames: [sheetName] });
      setSelectedGhnSheet(sheetName);
      setNvcHeaders(parsed.headers);
      setNvcRows(parsed.rows);
      setIsMappingConfirmed(false);
      const saved = StorageService.getCarrierMapping(selectedCarrierId);
      setNvcMapping(autoDetectColumns(parsed.headers, 'nvc', saved.nvc, parsed.rows));
      const savedHeaders = StorageService.getCarrierHeaders(selectedCarrierId);
      StorageService.saveCarrierHeaders(selectedCarrierId, parsed.headers, savedHeaders.appHeaders);
    } catch (error) {
      console.error(error);
      showToast('Không thể đọc sheet GHN đã chọn.', 'error');
    }
  };

  // Process App File(s) - Supports multi-file selection & auto-header-stripping merge
  const handleAppFilesChange = async (filesInput: FileList | File[]) => {
    try {
      const filesArray = Array.from(filesInput);
      if (filesArray.length === 0) return;

      if (filesArray.length === 1) {
        const file = filesArray[0];
        setAppFile(file);
        const { headers, rows } = await ExcelService.parseExcelFile(file);
        setAppHeaders(headers);
        setAppRows(rows);
        setIsMappingConfirmed(false);
        const saved = StorageService.getCarrierMapping(selectedCarrierId);
        const detectedMapping = autoDetectColumns(headers, 'app', saved.app, rows);
        setAppMapping(detectedMapping);
        const savedHeaders = StorageService.getCarrierHeaders(selectedCarrierId);
        StorageService.saveCarrierHeaders(selectedCarrierId, savedHeaders.nvcHeaders, headers);
      } else {
        // Multi-file J&T exports can legitimately differ in optional columns
        // (for example product, warehouse or print columns).  Do not compare
        // whole schemas position-by-position: normalize each file to the
        // identity/logistics fields that reconciliation actually uses.
        const canonicalHeaders = {
          waybill: 'Mã vận đơn (chuẩn hóa đa file)',
          shopName: 'Tên người gửi (chuẩn hóa đa file)',
          shopPhone: 'SĐT người gửi (chuẩn hóa đa file)',
          shopAddress: 'Địa chỉ người gửi (chuẩn hóa đa file)',
          shopCode: 'Mã shop (chuẩn hóa đa file)',
          receiverName: 'Tên người nhận (chuẩn hóa đa file)',
          receiverPhone: 'SĐT người nhận (chuẩn hóa đa file)',
          receiverAddress: 'Địa chỉ người nhận (chuẩn hóa đa file)',
          weight: 'Trọng lượng (chuẩn hóa đa file)',
          cod: 'COD (chuẩn hóa đa file)',
          status: 'Trạng thái (chuẩn hóa đa file)',
        };
        const normalizedHeaders = Object.values(canonicalHeaders);
        let combinedRows: Record<string, any>[] = [];
        const saved = StorageService.getCarrierMapping(selectedCarrierId);

        for (const file of filesArray) {
          const { headers, rows } = await ExcelService.parseExcelFile(file);
          const fileMapping = autoDetectColumns(headers, 'app', saved.app, rows);
          const missingRequired: string[] = [];
          if (!fileMapping.waybillColumn) missingRequired.push('Mã vận đơn');
          if (!fileMapping.shopNameColumn) missingRequired.push('Tên người gửi/Shop');
          if (!fileMapping.shopPhoneColumn) missingRequired.push('SĐT người gửi/Shop');
          if (missingRequired.length > 0) {
            throw new Error(`File “${file.name}” thiếu cột bắt buộc: ${missingRequired.join(', ')}. App không gộp file này để tránh nhầm đơn hoặc nhầm shop.`);
          }

          combinedRows.push(...rows.map(row => ({
            ...row,
            [canonicalHeaders.waybill]: row[fileMapping.waybillColumn],
            [canonicalHeaders.shopName]: row[fileMapping.shopNameColumn || ''],
            [canonicalHeaders.shopPhone]: row[fileMapping.shopPhoneColumn || ''],
            [canonicalHeaders.shopAddress]: row[fileMapping.shopAddressColumn || ''],
            [canonicalHeaders.shopCode]: row[fileMapping.shopCodeColumn || ''],
            [canonicalHeaders.receiverName]: row[fileMapping.receiverNameColumn || ''],
            [canonicalHeaders.receiverPhone]: row[fileMapping.receiverPhoneColumn || ''],
            [canonicalHeaders.receiverAddress]: row[fileMapping.receiverAddressColumn || ''],
            [canonicalHeaders.weight]: row[fileMapping.weightColumn || ''],
            [canonicalHeaders.cod]: row[fileMapping.codColumn || ''],
            [canonicalHeaders.status]: row[fileMapping.statusColumn || ''],
          })));
        }

        const mergedFile = new File([], `Gộp ${filesArray.length} file Excel App (${combinedRows.length} dòng)`);
        setAppFile(mergedFile);
        setAppHeaders(normalizedHeaders);
        setAppRows(combinedRows);
        setIsMappingConfirmed(false);

        const normalizedMapping: ColumnMappingConfig = {
          waybillColumn: canonicalHeaders.waybill,
          shopNameColumn: canonicalHeaders.shopName,
          shopPhoneColumn: canonicalHeaders.shopPhone,
          shopAddressColumn: canonicalHeaders.shopAddress,
          shopCodeColumn: canonicalHeaders.shopCode,
          receiverNameColumn: canonicalHeaders.receiverName,
          receiverPhoneColumn: canonicalHeaders.receiverPhone,
          receiverAddressColumn: canonicalHeaders.receiverAddress,
          weightColumn: canonicalHeaders.weight,
          codColumn: canonicalHeaders.cod,
          statusColumn: canonicalHeaders.status,
        };
        setAppMapping(normalizedMapping);
        const savedHeaders = StorageService.getCarrierHeaders(selectedCarrierId);
        StorageService.saveCarrierHeaders(selectedCarrierId, savedHeaders.nvcHeaders, normalizedHeaders);

        showToast(`Đã chuẩn hóa và gộp ${filesArray.length} file Excel App (${combinedRows.length.toLocaleString('vi-VN')} dòng). Mã đơn trùng vẫn sẽ bị chặn ở bước đối soát.`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể đọc file đơn hàng từ App. Vui lòng kiểm tra định dạng Excel (.xlsx, .xls, .csv)', 'error');
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAppFilesChange(e.dataTransfer.files);
    }
  };

  // Duplicate Conflict Modal States
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<DuplicateCheckResult | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [targetShopsForExec, setTargetShopsForExec] = useState<Shop[]>(shops);

  const executeReconciliation = (effectiveShops: Shop[], customNvcRows?: Record<string, any>[]) => {
    setIsProcessing(true);

    setTimeout(() => {
      const carrierTier = carriers.find(c => c.carrierId === selectedCarrierId) || carriers[0];
      const rowsToUse = customNvcRows || nvcRows;
      
      const session = performReconciliation(
        rowsToUse,
        nvcMapping,
        reconcileMode === '1file' ? [] : appRows,
        appMapping,
        effectiveShops,
        carrierTier,
        sessionPeriodName,
        nvcFile?.name || 'File_NVC.xlsx',
        reconcileMode === '1file' ? undefined : appFile?.name,
        reconcileMode
      );

      if (sessionPeriodDate) {
        session.createdAt = new Date(sessionPeriodDate + 'T12:00:00.000Z').toISOString();
      }

      prevSessionIdRef.current = session.id;
      setCurrentSession(session);
      setWizardStep(4);
      AuditService.logAction(
        currentUser.username,
        currentUser.role,
        'CREATE_RECONCILIATION_SESSION',
        `Tạo kỳ “${session.sessionName}” (${session.carrierName}): ${session.matchedOrdersCount} đơn hợp lệ, ${session.unmatchedOrdersCount} đơn chờ kiểm tra, tổng cần trả ${session.totalNetPayout.toLocaleString('vi-VN')}đ.`
      );
      setIsProcessing(false);
      showToast(
        session.unmatchedOrdersCount > 0
          ? `Đã lập phiên kiểm tra: ${session.unmatchedOrdersCount} đơn đang treo và chưa thể xuất bảng kê.`
          : `Đã đối soát xong ${session.matchedOrdersCount} đơn. Bạn có thể kiểm tra và xuất bảng kê.`,
        session.unmatchedOrdersCount > 0 ? 'warning' : 'success'
      );
    }, 400);
  };

  const handleCheckDuplicatesAndProceed = (effectiveShops: Shop[]) => {
    setTargetShopsForExec(effectiveShops);
    const dupResult = checkDuplicateWaybills(nvcRows, nvcMapping.waybillColumn, StorageService.getSessions(), nvcMapping.codColumn);

    if (dupResult.hasConflict) {
      setDuplicateCheckResult(dupResult);
      setIsDuplicateModalOpen(true);
    } else {
      executeReconciliation(effectiveShops);
    }
  };

  const handleFilterNewOnlyConflict = () => {
    if (!duplicateCheckResult) return;
    const waybillCol = nvcMapping.waybillColumn;
    const filteredRows = nvcRows.filter(row => {
      const val = row[waybillCol];
      if (!val) return true;
      const key = val.toString().trim().toUpperCase();
      return !duplicateCheckResult.duplicateWaybills.has(key);
    });

    setIsDuplicateModalOpen(false);
    showToast(`Đã lọc nạp thành công ${duplicateCheckResult.uniqueNewRowsCount} đơn hàng mới!`, 'success');
    executeReconciliation(targetShopsForExec, filteredRows);
  };

  // Run reconciliation with auto new shops detection
  const handleRunReconciliation = async () => {
    if (isJntCarrier && reconcileMode !== '2files') {
      showToast('J&T bắt buộc dùng 2 file (NVC + App) để xác định đúng shop.', 'warning');
      setReconcileMode('2files');
      return;
    }

    if (nvcRows.length === 0 || (reconcileMode === '2files' && appRows.length === 0)) {
      showToast(reconcileMode === '1file' ? 'Vui lòng tải lên File Excel Đối Soát.' : 'Vui lòng tải lên cả 2 file: File Đối Soát NVC và File Đơn Hàng từ App.', 'warning');
      return;
    }

    // Only block if waybill column is completely undetectable
    if (!nvcMapping.waybillColumn) {
      showToast('Chưa tự động nhận diện được cột Mã vận đơn trong File NVC. Vui lòng mở Cài đặt để chọn cột.', 'warning');
      setShowMappingModal(true);
      return;
    }

    if (reconcileMode === '2files' && !appMapping.waybillColumn) {
      showToast('Chưa nhận diện được cột Mã vận đơn trong File App. Vui lòng mở Cài đặt để chọn cột.', 'warning');
      setShowMappingModal(true);
      return;
    }

    // Proceed straight to duplicate check & reconciliation
    handleCheckDuplicatesAndProceed(shops);
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
      setGhnSheets([]);
      setSelectedGhnSheet('');
      setIsMappingConfirmed(false);
      setSelectedAssignShops({});
      setCurrentSession(null);
      setWizardStep(1);
    }
  };

  // Manually Assign Unmatched Order to a Shop
  const handleAssignUnmatchedOrder = (order: ReconciledOrder, targetShopId: string) => {
    if (!currentSession || !targetShopId) return;
    const hasPayout = StorageService.getPaymentRecords().some(payment => !payment.voidedAt && payment.sessionId === currentSession.id);
    if (hasPayout) {
      showToast('Kỳ này đã phát sinh đi tiền nên bị khóa chỉnh sửa. Hãy hủy/đảo bản ghi đi tiền trước, sau đó mới điều chỉnh đối soát.', 'error');
      return;
    }
    if (!isAdmin) {
      showToast('Chỉ Admin mới được phép gán thủ công đơn vào shop.', 'error');
      return;
    }
    if (!order.canManualAssignShop) {
      showToast('Không thể gán thủ công: đơn này có lỗi dữ liệu/đối soát cần được xử lý tại file hoặc cấu hình trước.', 'error');
      return;
    }

    const targetShop = shops.find(s => s.id === targetShopId && s.active);
    if (!targetShop) return;

    // Manual assignment only fixes the shop identity; it must retain exactly
    // the same fee rules as the automatic reconciliation.
    let shopCalculatedFee = 0;
    let shopOtherFee = 0;
    let declaredFee = 0;

    if (order.nvcBaseFee > 0 || order.nvcOtherFee > 0) {
      shopCalculatedFee = calculateWeightFee(order.weight, targetShop.pricingPlan);
      if (order.status === 'returned' || order.status === 'returning') {
        const returnRatio = (targetShop.pricingPlan.returnFeePercent !== undefined ? targetShop.pricingPlan.returnFeePercent : 50) / 100;
        shopCalculatedFee = Math.round(shopCalculatedFee * returnRatio);
      }
      shopOtherFee = targetShop.pricingPlan.fixedSurcharge || 0;
      if (order.isPartialDelivery && targetShop.pricingPlan.partialDeliveryFee) {
        shopOtherFee += targetShop.pricingPlan.partialDeliveryFee;
      }
      if (targetShop.pricingPlan.insuranceFeePercent && targetShop.pricingPlan.insuranceFeePercent > 0 && order.codAmount > 0) {
        shopOtherFee += Math.round((order.codAmount * targetShop.pricingPlan.insuranceFeePercent) / 100);
      }
      if (order.declaredValue && order.declaredValue > 0 && targetShop.pricingPlan.declaredFeePercent && targetShop.pricingPlan.declaredFeePercent > 0) {
        declaredFee = Math.round((order.declaredValue * targetShop.pricingPlan.declaredFeePercent) / 100);
        shopOtherFee += declaredFee;
      }
    }

    const netShopPayout = order.codAmount - shopCalculatedFee - shopOtherFee;
    const profitMargin = (shopCalculatedFee + shopOtherFee) - (order.nvcBaseFee + order.nvcOtherFee);
    const ctv = targetShop.ctvId ? StorageService.getCtvs().find(item => item.id === targetShop.ctvId) : undefined;
    const ctvCommission = ctv ? StorageService.calculateCtvCommission(ctv, order.weight, selectedCarrierTier?.carrierId || order.carrierId) : 0;
    const isDelivered = order.status === 'delivered';
    const isReturned = order.status === 'returned' || order.status === 'returning';
    const isInTransit = !isDelivered && !isReturned;

    const updatedOrder: ReconciledOrder = {
      ...order,
      shopId: targetShop.id,
      shopName: targetShop.name,
      shopPhone: targetShop.phone,
      shopAddress: targetShop.address,
      shopCalculatedFee,
      shopOtherFee,
      declaredFee,
      netShopPayout,
      profitMargin,
      ctvId: targetShop.ctvId,
      ctvName: targetShop.ctvName,
      ctvCommission,
      matched: true,
      shopMatchMethod: 'manual_admin',
      matchError: undefined,
      canManualAssignShop: false,
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
        deliveredOrders: stmt.deliveredOrders + (isDelivered ? 1 : 0),
        returnedOrders: stmt.returnedOrders + (isReturned ? 1 : 0),
        inTransitOrders: stmt.inTransitOrders + (isInTransit ? 1 : 0),
        partialOrders: (stmt.partialOrders || 0) + (updatedOrder.isPartialDelivery ? 1 : 0),
        totalCod: stmt.totalCod + updatedOrder.codAmount,
        totalShopFee: stmt.totalShopFee + updatedOrder.shopCalculatedFee,
        totalShopOtherFee: stmt.totalShopOtherFee + updatedOrder.shopOtherFee,
        totalNetPayout: stmt.totalNetPayout + updatedOrder.netShopPayout,
        totalNvcCost: stmt.totalNvcCost + (updatedOrder.nvcBaseFee + updatedOrder.nvcOtherFee),
        totalProfit: stmt.totalProfit + updatedOrder.profitMargin,
        totalDeliveredCod: (stmt.totalDeliveredCod || 0) + (isDelivered ? updatedOrder.codAmount : 0),
        totalDeliveredFee: (stmt.totalDeliveredFee || 0) + (isDelivered ? updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee : 0),
        totalReturnedFee: (stmt.totalReturnedFee || 0) + (isReturned ? updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee : 0),
        totalPartialCod: (stmt.totalPartialCod || 0) + (updatedOrder.isPartialDelivery ? updatedOrder.codAmount : 0),
        totalPartialFee: (stmt.totalPartialFee || 0) + (updatedOrder.isPartialDelivery ? updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee : 0),
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
        deliveredOrders: isDelivered ? 1 : 0,
        returnedOrders: isReturned ? 1 : 0,
        inTransitOrders: isInTransit ? 1 : 0,
        partialOrders: updatedOrder.isPartialDelivery ? 1 : 0,
        totalCod: updatedOrder.codAmount,
        totalShopFee: updatedOrder.shopCalculatedFee,
        totalShopOtherFee: updatedOrder.shopOtherFee,
        totalNetPayout: updatedOrder.netShopPayout,
        totalNvcCost: updatedOrder.nvcBaseFee + updatedOrder.nvcOtherFee,
        totalProfit: updatedOrder.profitMargin,
        totalDeliveredCod: isDelivered ? updatedOrder.codAmount : 0,
        totalDeliveredFee: isDelivered ? updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee : 0,
        totalReturnedFee: isReturned ? updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee : 0,
        totalPartialCod: updatedOrder.isPartialDelivery ? updatedOrder.codAmount : 0,
        totalPartialFee: updatedOrder.isPartialDelivery ? updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee : 0,
        orders: [updatedOrder],
        emailStatus: 'idle',
      });
    }

    const updatedSession: ReconciliationSession = {
      ...currentSession,
      matchedOrdersCount: currentSession.matchedOrdersCount + 1,
      unmatchedOrdersCount: newUnmatched.length,
      totalCod: currentSession.totalCod + updatedOrder.codAmount,
      totalNvcCost: currentSession.totalNvcCost + updatedOrder.nvcBaseFee + updatedOrder.nvcOtherFee,
      totalShopRevenue: currentSession.totalShopRevenue + updatedOrder.shopCalculatedFee + updatedOrder.shopOtherFee,
      totalNetPayout: currentSession.totalNetPayout + updatedOrder.netShopPayout,
      totalProfit: currentSession.totalProfit + updatedOrder.profitMargin,
      totalCtvCommission: (currentSession.totalCtvCommission || 0) + ctvCommission,
      statements: updatedStatements,
      unmatchedOrders: newUnmatched,
    };

    setCurrentSession(updatedSession);
    AuditService.logAction(
      currentUser.username,
      currentUser.role,
      'MANUAL_SHOP_ASSIGNMENT',
      `Gán thủ công vận đơn ${order.waybill} vào shop ${targetShop.code} (${targetShop.name}); tiền trả shop ${netShopPayout.toLocaleString('vi-VN')}đ.`
    );
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
  const unmatchedSourceCod = currentSession?.unmatchedOrders.reduce((sum, order) => sum + order.codAmount, 0) || 0;
  const unmatchedSourceNvcFee = currentSession?.unmatchedOrders.reduce((sum, order) => sum + order.nvcBaseFee + order.nvcOtherFee, 0) || 0;
  const sourceCodTotal = (currentSession?.totalCod || 0) + unmatchedSourceCod;
  const sourceNvcFeeTotal = (currentSession?.totalNvcCost || 0) + unmatchedSourceNvcFee;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* 🌟 4-Step Guided Workflow Stepper Header */}
      {(() => {
        const hasBothFiles = reconcileMode === '2files' ? (!!nvcFile && !!appFile) : (!!nvcFile);
        const step1Done = hasBothFiles;

        const getStep1Desc = () => {
          if (reconcileMode === '2files') {
            if (hasBothFiles) return `✓ Đã nạp 2 file (${(nvcRows.length + appRows.length).toLocaleString('vi-VN')} dòng)`;
            if (nvcFile && !appFile) return 'Đã có File J&T (Thiếu File App)';
            if (!nvcFile && appFile) return 'Đã có File App (Thiếu File J&T)';
            return 'Nạp File J&T + File App';
          }
          return nvcFile ? `✓ Đã nạp ${nvcRows.length.toLocaleString('vi-VN')} dòng` : 'Nạp File Excel NVC';
        };

        const getStep2Desc = () => {
          if (wizardStep > 2) return '✓ Dữ liệu hợp lệ';
          if (hasBothFiles) return '👉 Kiểm tra trường dữ liệu';
          return reconcileMode === '2files' ? 'Chờ nạp đủ 2 file' : 'Chờ nạp file';
        };

        const getStep3Desc = () => {
          if (scannedShopAnalysis.hasNewShops) {
            return `⚠️ Có ${scannedShopAnalysis.newShops.length} Shop mới cần thêm`;
          }
          if (scannedShopAnalysis.existingShops.length > 0) {
            return `✓ Khớp 100% (${scannedShopAnalysis.existingShops.length} Shop)`;
          }
          return 'Kiểm tra danh sách Shop';
        };

        const getStep4Desc = () => {
          if (!currentSession) return 'Chờ tính cước';
          if (currentSession.unmatchedOrdersCount > 0) return `⚠️ ${currentSession.unmatchedOrdersCount} đơn chưa khớp`;
          return `✓ ${currentSession.statements.length} Shop đối soát`;
        };

        const steps = [
          { step: '01', stepNum: 1, title: 'CHỌN HÃNG & NẠP FILE', desc: getStep1Desc(), active: wizardStep === 1, done: wizardStep > 1 || step1Done },
          { step: '02', stepNum: 2, title: 'KHỚP NỐI & KIỂM TRA', desc: getStep2Desc(), active: wizardStep === 2, done: wizardStep > 2 },
          { step: '03', stepNum: 3, title: 'KIỂM TRA & DUYỆT SHOP MỚI', desc: getStep3Desc(), active: wizardStep === 3, done: wizardStep > 3 || (!scannedShopAnalysis.hasNewShops && !!currentSession) },
          { step: '04', stepNum: 4, title: 'BẢNG KÊ & XUẤT BÁO CÁO', desc: getStep4Desc(), active: wizardStep === 4, done: false },
        ];

        return (
          <div className="glass-panel" style={{
            padding: '14px 18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 10,
            alignItems: 'center',
          }}>
            {steps.map((item) => (
              <div 
                key={item.step} 
                onClick={() => {
                  if (item.stepNum === 1) setWizardStep(1);
                  else if (item.stepNum === 2) {
                    if (hasBothFiles || currentSession) setWizardStep(2);
                    else showToast(reconcileMode === '2files' ? 'Vui lòng nạp đủ 2 file ở Bước 1 trước!' : 'Vui lòng nạp file ở Bước 1 trước!', 'warning');
                  } else if (item.stepNum === 3) {
                    if (currentSession) setWizardStep(3);
                    else if (hasBothFiles) { setWizardStep(2); showToast('Vui lòng bấm "Tiến Hành Đối Soát & Tính Cước" ở Bước 2 trước!', 'info'); }
                    else showToast('Chưa có dữ liệu đối soát!', 'warning');
                  } else if (item.stepNum === 4) {
                    if (currentSession) setWizardStep(4);
                    else showToast('Chưa có dữ liệu đối soát để xuất báo cáo!', 'warning');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: item.active ? 'rgba(79, 70, 229, 0.10)' : item.done ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-tertiary)',
                  border: item.active ? '2px solid var(--primary)' : item.done ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: item.active ? 'var(--primary)' : item.done ? '#10b981' : 'var(--bg-secondary)',
                  color: item.done || item.active ? '#ffffff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  flexShrink: 0,
                  boxShadow: item.active ? '0 0 12px rgba(79, 70, 229, 0.4)' : 'none',
                }}>
                  {item.done && !item.active ? <CheckCircle2 size={17} /> : item.step}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: item.active ? 'var(--primary)' : item.done ? '#10b981' : 'var(--text-dim)', letterSpacing: '0.04em' }}>
                    STEP {item.step} {item.active ? '● ĐANG XEM' : item.done ? '✓ ĐÃ XONG' : ''}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: item.active ? 'var(--primary)' : item.done ? '#059669' : 'var(--text-muted)', marginTop: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 🚀 BƯỚC 1: CHỌN HÃNG & NẠP FILE */}
      {wizardStep === 1 && (
        <div className="glass-panel" style={{ padding: 20 }}>
          {/* CARRIER WORKSPACE HEADER BANNER */}
          <div style={{
            background: isJntCarrier
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.03) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)',
            border: isJntCarrier ? '1.5px solid rgba(239, 68, 68, 0.35)' : '1.5px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            {/* Left: Carrier Icon & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: isJntCarrier ? '#dc2626' : '#059669',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}>
                {isJntCarrier ? '📦' : '🚚'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 900, color: isJntCarrier ? '#dc2626' : '#059669' }}>
                    {isJntCarrier ? 'MODULE ĐỐI SOÁT J&T EXPRESS' : `MODULE ĐỐI SOÁT ${(selectedCarrierTier?.carrierName || 'NVC').toUpperCase()}`}
                  </span>
                  <span style={{
                    fontSize: 10,
                    background: isJntCarrier ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isJntCarrier ? '#dc2626' : '#059669',
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontWeight: 800,
                  }}>
                    {isJntCarrier ? '2 FILE (ĐỐI SOÁT + APP)' : '1 FILE DUY NHẤT'}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.2 }}>
                  {isJntCarrier 
                    ? 'Ghép File Đối Soát J&T + File App (tự động cước 0đ đơn chưa giao).' 
                    : `Đối soát trực tiếp từ File Excel đối soát của ${selectedCarrierTier?.carrierName || 'NVC'}.`}
                </div>
              </div>
            </div>

            {/* Right: Merged Controls (Ngày Chốt Kỳ + Tên Kỳ Đối Soát + Nút Ánh Xạ Cột) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                padding: '4px 10px',
                borderRadius: 8,
                border: '1.5px solid var(--border-color)',
              }}>
                <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 700, whiteSpace: 'nowrap' }}>🗓️ Ngày Chốt:</label>
                <input
                  type="date"
                  value={sessionPeriodDate}
                  onChange={(e) => setSessionPeriodDate(e.target.value)}
                  className="input-field"
                  style={{ padding: '3px 8px', fontSize: 11.5, width: 130, fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'transparent' }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#ffffff',
                padding: '4px 10px',
                borderRadius: 8,
                border: '1.5px solid var(--border-color)',
              }}>
                <label style={{ fontSize: 11.5, color: '#334155', fontWeight: 700, whiteSpace: 'nowrap' }}>Tên Kỳ:</label>
                <input
                  type="text"
                  value={sessionPeriodName}
                  onChange={(e) => setSessionPeriodName(e.target.value)}
                  className="input-field"
                  placeholder="Nhập tên kỳ đối soát..."
                  style={{ padding: '3px 8px', fontSize: 11.5, width: 230, fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'transparent' }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isAdmin) setConfigCarrier(selectedCarrierTier);
                }}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: 11.5,
                  padding: '6px 12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#fff',
                  border: isJntCarrier ? '1.5px solid #dc2626' : '1.5px solid #059669',
                  color: isJntCarrier ? '#dc2626' : '#059669',
                  borderRadius: 8,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Cài đặt ánh xạ cột cho file đối soát"
              >
                <Settings2 size={14} color={isJntCarrier ? '#dc2626' : '#059669'} />
                <span>⚙️ Ánh xạ cột</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                style={{
                  fontSize: 11.5,
                  padding: '6px 12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#fff',
                  border: '1.5px solid var(--primary)',
                  color: 'var(--primary)',
                  borderRadius: 8,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Cài đặt và tùy chọn cột khi xuất file Excel cho Shop và Báo cáo tổng"
              >
                <Settings2 size={14} color="var(--primary)" />
                <span>⚙️ Cài đặt xuất file</span>
              </button>
            </div>
          </div>

          {/* GHN Multiple Sheets Selector (If applicable) */}
          {isGhnCarrier && ghnSheets.length > 0 && (
            <div style={{ width: '100%', marginBottom: 14, padding: '8px 12px', background: 'rgba(79, 70, 229, 0.06)', border: '1px solid var(--primary-glow)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-main)' }}>
                <strong>Phiên GHN cần đối soát:</strong> File có {ghnSheets.length} sheet. Chọn đúng sheet cần đối soát:
              </div>
              <select value={selectedGhnSheet} onChange={(event) => handleGhnSheetChange(event.target.value)} className="select-field" style={{ minWidth: 190 }}>
                <option value="" disabled>-- Chọn sheet/kỳ GHN --</option>
                {ghnSheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name} ({sheet.rowCount} dòng)</option>)}
              </select>
            </div>
          )}

          {/* Dropzone Layout: Dynamic 1-File Full Width vs 2-Files Dual Grid */}
          {reconcileMode === '1file' ? (
            /* Single File Hero Dropzone Mode */
            <div style={{ marginBottom: 20 }}>
              <div 
                onClick={() => nvcFileInputRef.current?.click()}
                onDragOver={handleNvcDragOver}
                onDragEnter={handleNvcDragOver}
                onDragLeave={handleNvcDragLeave}
                onDrop={handleNvcDrop}
                style={{
                  border: `2px dashed ${isDraggingNvc ? 'var(--primary)' : nvcFile ? 'var(--success)' : 'var(--primary)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px 24px',
                  background: isDraggingNvc ? 'rgba(79, 70, 229, 0.08)' : nvcFile ? 'var(--success-bg)' : 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  transform: isDraggingNvc ? 'scale(1.01)' : 'none',
                  boxShadow: isDraggingNvc ? '0 0 20px var(--primary-glow)' : '0 4px 12px rgba(0,0,0,0.03)',
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
                    style={{ position: 'absolute', top: 14, right: 14, padding: '4px 8px' }}
                    title="Đổi file khác"
                  >
                    <XCircle size={14} color="var(--danger)" />
                    <span>Đổi File Khác</span>
                  </button>
                )}

                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: nvcFile ? 'var(--success)' : isDraggingNvc ? 'var(--primary)' : 'rgba(79, 70, 229, 0.1)',
                  color: nvcFile ? '#fff' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  {nvcFile ? <CheckCircle2 size={30} /> : <FileSpreadsheet size={30} color="var(--primary)" />}
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {isDraggingNvc ? 'THẢ FILE EXCEL ĐỐI SOÁT VÀO ĐÂY' : nvcFile ? `✓ ĐÃ TẢI FILE: ${nvcFile.name}` : `📄 TẢI LÊN FILE EXCEL ĐỐI SOÁT ${selectedCarrierTier?.carrierName.toUpperCase()}`}
                </h3>
                
                <p style={{ fontSize: 13, color: 'var(--text-dim)', maxWidth: 650, margin: '0 auto 10px', lineHeight: 1.5 }}>
                  {nvcFile ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                      Đã đọc thành công <strong>{nvcRows.length.toLocaleString('vi-VN')} dòng đơn hàng</strong> từ file. Hệ thống sẽ tự động bóc tách phân loại Shop theo Tên cửa hàng & SĐT có sẵn trong file.
                    </span>
                  ) : (
                    'Kéo và thả trực tiếp File Excel đối soát từ NVC vào đây. Ở Chế độ 1 File, hệ thống tự động bóc tách danh sách Shop theo cột Tên cửa hàng / SĐT mà không cần file App.'
                  )}
                </p>

                {nvcFile && nvcMapping.waybillColumn && (
                  <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.1)', padding: '4px 12px', borderRadius: 20 }}>
                    ✓ Đã tự động nhận diện cột Mã vận đơn: <strong className="mono">[{nvcMapping.waybillColumn}]</strong>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Dual Files 50-50 Grid Mode */
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
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && handleAppFilesChange(e.target.files)}
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                      ✓ Đã nhận diện cột Shop: <strong className="mono">[{appMapping.shopNameColumn || 'Mặc định'}]</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Tự động đối chiếu với {shops.length} Shop trong hệ thống
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Action Controls Bar for Step 1 */}
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
              type="button"
              onClick={() => setWizardStep(2)}
              className="btn btn-primary btn-lg"
              disabled={reconcileMode === '2files' ? (!nvcFile || !appFile) : (!nvcFile)}
              style={{ minWidth: 280, fontWeight: 800, padding: '12px 24px', fontSize: 13.5 }}
            >
              <span>TIẾP THEO: KHỚP NỐI & KIỂM TRA (BƯỚC 2)</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 🚀 BƯỚC 2: KHỚP NỐI & KIỂM TRA DỮ LIỆU */}
      {wizardStep === 2 && (
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Step 2 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={22} />
                <span>BƯỚC 2: KHỚP NỐI & KIỂM TRA DỮ LIỆU ĐƠN HÀNG</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Kiểm tra các trường dữ liệu, số lượng dòng đơn và bảng ánh xạ cột trước khi tiến hành tính cước đối soát.
              </div>
            </div>

            <button
              type="button"
              onClick={() => { if (isAdmin) setConfigCarrier(selectedCarrierTier); }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Settings2 size={15} />
              <span>⚙️ Cấu Hình Ánh Xạ Cột</span>
            </button>
          </div>

          {/* 2 Data Inspection Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 16,
          }}>
            {/* Card 1: File NVC */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '18px 20px', border: '1.5px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: isJntCarrier ? '#dc2626' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📄 File Đối Soát NVC:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 13 }}>{selectedCarrierTier?.carrierName}</span>
                </div>
                <span className="badge badge-success" style={{ fontSize: 11 }}>{nvcRows.length.toLocaleString('vi-VN')} dòng</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tên tệp Excel:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{nvcFile?.name || 'File_NVC.xlsx'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cột Mã Vận Đơn:</span>
                  <strong className="mono" style={{ color: 'var(--primary)' }}>[{nvcMapping.waybillColumn || 'Chưa nhận diện'}]</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cột Tiền Thu Hộ (COD):</span>
                  <strong className="mono">[{nvcMapping.codColumn || 'Mặc định'}]</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cột Cước Phí NVC:</span>
                  <strong className="mono">[{nvcMapping.weightColumn || nvcMapping.feeColumn || 'Mặc định'}]</strong>
                </div>
              </div>
            </div>

            {/* Card 2: File App (if 2 files mode) */}
            {reconcileMode === '2files' && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '18px 20px', border: '1.5px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📱 File Đơn Hàng Xuất Từ App</span>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: 11 }}>{appRows.length.toLocaleString('vi-VN')} dòng</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tên tệp Excel:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{appFile?.name || 'File_App.xlsx'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cột Tên Shop:</span>
                    <strong className="mono" style={{ color: '#4f46e5' }}>[{appMapping.shopNameColumn || 'Mặc định'}]</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cột SĐT Shop:</span>
                    <strong className="mono">[{appMapping.shopPhoneColumn || appMapping.receiverPhoneColumn || 'Mặc định'}]</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Đối chiếu Shop:</span>
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>
                      ✓ Tự động khớp theo Danh mục Shop
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Verification Strip */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(79, 70, 229, 0.06) 100%)',
            border: '1.5px solid #10b981',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={18} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>
                Dữ liệu đã khớp nối sẵn sàng! Biểu cước sỉ của <strong>{selectedCarrierTier?.carrierName}</strong> và danh mục <strong>{shops.length} Shop</strong> đã được kết nối để tính tiền tự động.
              </div>
            </div>
          </div>

          {/* Action Bar of Step 2 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingTop: 16,
            borderTop: '1px solid var(--border-color)',
          }}>
            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className="btn btn-secondary btn-lg"
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              <ArrowLeft size={16} />
              <span>Quay Lại Bước 1 (Nạp File)</span>
            </button>

            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className="btn btn-primary btn-lg"
              style={{ minWidth: 310, fontWeight: 900, fontSize: 14, padding: '12px 28px', background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)' }}
            >
              <span>TIẾP THEO: DUYỆT & CẤU HÌNH SHOP (BƯỚC 3) ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* 🚀 BƯỚC 3: KIỂM TRA & XÁC NHẬN SHOP MỚI PHÁT HIỆN */}
      {wizardStep === 3 && (
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Step 3 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Store size={22} />
                <span>BƯỚC 3: KIỂM TRA & XÁC NHẬN DANH SÁCH SHOP TRONG KỲ</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Hệ thống tự động đối chiếu các Shop trong file với Danh mục Shop & Cấu hình gộp shop đã lưu trong hệ thống.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {scannedShopAnalysis.hasNewShops ? (
                <span className="badge badge-warning" style={{ fontSize: 12, padding: '5px 12px', fontWeight: 800 }}>
                  ⚠️ Phát hiện {scannedShopAnalysis.newShops.length} Shop mới
                </span>
              ) : (
                <span className="badge badge-success" style={{ fontSize: 12, padding: '5px 12px', fontWeight: 800 }}>
                  ✓ 100% Shop đã có hồ sơ
                </span>
              )}
            </div>
          </div>

          {/* Quick Preview KPIs */}
          {quickPreviewStats && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
              border: '1.5px solid var(--primary-glow)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                📊 SỐ LIỆU DỰ TÍNH NHANH TỪ FILE ĐỐI SOÁT
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                gap: 10,
              }}>
                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700 }}>TỔNG ĐƠN HÀNG</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0' }}>
                    {quickPreviewStats.totalOrders.toLocaleString('vi-VN')} <span style={{ fontSize: 11, fontWeight: 500 }}>đơn</span>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700 }}>TỔNG COD THU HỘ</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--info)', margin: '3px 0' }}>
                    {formatVND(quickPreviewStats.totalCod)}
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700 }}>CƯỚC GỐC NVC</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--warning)', margin: '3px 0' }}>
                    {formatVND(quickPreviewStats.totalNvcFee)}
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 700 }}>CƯỚC THU SHOP</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)', margin: '3px 0' }}>
                    {formatVND(quickPreviewStats.totalShopFee)}
                  </div>
                </div>

                <div style={{ background: quickPreviewStats.estimatedProfit >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${quickPreviewStats.estimatedProfit >= 0 ? '#10b981' : '#ef4444'}` }}>
                  <div style={{ fontSize: 10.5, color: quickPreviewStats.estimatedProfit >= 0 ? '#059669' : '#dc2626', fontWeight: 800 }}>LỢI NHUẬN RÒNG</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: quickPreviewStats.estimatedProfit >= 0 ? '#059669' : '#dc2626', margin: '3px 0' }}>
                    {quickPreviewStats.estimatedProfit >= 0 ? '+' : ''}{formatVND(quickPreviewStats.estimatedProfit)}
                  </div>
                </div>

                <div style={{ background: 'rgba(79, 70, 229, 0.08)', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--primary)' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--primary)', fontWeight: 800 }}>THỰC CHUYỂN SHOP</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)', margin: '3px 0' }}>
                    {formatVND(quickPreviewStats.estimatedShopPayout)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TRƯỜNG HỢP A: PHÁT HIỆN SHOP MỚI CẦN THÊM */}
          {scannedShopAnalysis.hasNewShops && (
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1.5px solid #f59e0b', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid rgba(245, 158, 11, 0.25)', paddingBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 900, color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={19} color="#d97706" />
                    <span>PHÁT HIỆN {scannedShopAnalysis.newShops.length} SHOP MỚI CHƯA CÓ TRONG HỆ THỐNG</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>
                    💡 Quý khách có thể thiết lập <strong>Biểu giá cước bậc thang riêng</strong> cho từng Shop mới ngay bên dưới trước khi bấm lưu.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddNewScannedShops(scannedShopAnalysis.newShops)}
                  className="btn btn-warning"
                  style={{ fontWeight: 800, fontSize: 13, padding: '9px 20px', background: '#f59e0b', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)' }}
                >
                  💾 Thêm Tất Cả {scannedShopAnalysis.newShops.length} Shop Mới Vào Danh Mục Shop
                </button>
              </div>

              {/* Danh sách từng Shop mới kèm Editor Biểu Giá Cước Đầy Đủ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {scannedShopAnalysis.newShops.map((newShop, idx) => {
                  const key = `${newShop.name.toLowerCase()}|${newShop.phone.replace(/\D/g, '')}`;
                  const plan = getNewShopPricingPlan(key, newShop.name);
                  const isExpanded = expandedNewShopKey === null ? true : expandedNewShopKey === key;
                  const testWeight = newShopTestWeights[key] ?? 1.5;
                  const calculatedTestFee = calculateWeightFee(testWeight, plan);

                  return (
                    <div
                      key={key}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: 12,
                        padding: '16px 18px',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {/* Header Shop Mới */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: '#fef3c7',
                            color: '#b45309',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <strong style={{ fontSize: 14.5, color: 'var(--text-main)' }}>{newShop.name}</strong>
                            {newShop.phone && (
                              <span style={{ fontSize: 12, color: '#059669', marginLeft: 8, fontWeight: 600 }}>
                                📞 {newShop.phone}
                              </span>
                            )}
                          </div>
                          <span className="badge badge-warning" style={{ fontSize: 11, fontWeight: 700 }}>
                            Chưa có hồ sơ
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                            • <strong>{newShop.orderCount.toLocaleString('vi-VN')}</strong> đơn (COD: {formatVND(newShop.totalCod)})
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setExpandedNewShopKey(isExpanded ? '__none__' : key)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11.5, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                          >
                            <Sliders size={13} color="var(--primary)" />
                            <span>{isExpanded ? 'Thu gọn biểu giá' : '⚙️ Tùy chỉnh biểu giá'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* KHỐI BIỂU GIÁ CƯỚC BẬC THANG RIÊNG THEO CÂN NẶNG (Chuẩn theo ảnh mẫu) */}
                      {isExpanded && (
                        <div style={{
                          background: 'rgba(79, 70, 229, 0.035)',
                          border: '1px solid rgba(79, 70, 229, 0.18)',
                          borderRadius: 10,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}>
                          {/* Header Biểu Giá */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 800 }}>
                              <Sliders size={15} />
                              <span>3. BIỂU GIÁ CƯỚC BẬC THANG RIÊNG THEO CÂN NẶNG</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => addNewShopWeightRule(key, newShop.name)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Plus size={12} />
                              <span>+ Thêm Nấc Cân Nặng</span>
                            </button>
                          </div>

                          {/* Bảng Nấc Cân Nặng */}
                          <div style={{
                            background: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 9,
                          }}>
                            {plan.weightRules.map((rule, rIdx) => (
                              <div
                                key={rIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                  paddingBottom: 6,
                                  borderBottom: rIdx < plan.weightRules.length - 1 ? '1px dashed rgba(0, 0, 0, 0.06)' : 'none',
                                }}
                              >
                                <span style={{ width: 85, fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                                  {rIdx === 0 ? 'Từ 0 đến' : `Từ ${rule.minWeight} đến`}
                                </span>
                                
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={rule.maxWeight}
                                  onChange={(e) => {
                                    const val = Number(e.target.value || 0);
                                    updateNewShopPricingPlan(key, p => ({
                                      ...p,
                                      weightRules: p.weightRules.map((item, idx2) => idx2 === rIdx ? { ...item, maxWeight: val } : item),
                                    }), newShop.name);
                                  }}
                                  className="input-field"
                                  style={{ width: 75, padding: '4px 8px', fontSize: 12, textAlign: 'center' }}
                                />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg:</span>

                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={rule.price === 0 ? '' : rule.price}
                                  placeholder={rIdx === 0 ? 'Bắt buộc nhập' : '0'}
                                  onChange={(e) => {
                                    const val = Number(e.target.value || 0);
                                    updateNewShopPricingPlan(key, p => ({
                                      ...p,
                                      weightRules: p.weightRules.map((item, idx2) => idx2 === rIdx ? { ...item, price: val } : item),
                                    }), newShop.name);
                                  }}
                                  className="input-field"
                                  style={{ flex: 1, minWidth: 120, padding: '4px 8px', fontSize: 12 }}
                                />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>VNĐ</span>

                                {plan.weightRules.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeNewShopWeightRule(key, rIdx, newShop.name)}
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '4px 7px' }}
                                    title="Xóa nấc cân này"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            ))}

                            {/* Cấu hình Vượt cân & Phí hoàn */}
                            <div style={{
                              marginTop: 6,
                              paddingTop: 10,
                              borderTop: '1px solid var(--border-color)',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                              gap: 10,
                              alignItems: 'flex-end',
                            }}>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  Vượt cân: Mỗi thêm
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={plan.extraStepWeight || 1}
                                    onChange={(e) => {
                                      const val = Number(e.target.value || 1);
                                      updateNewShopPricingPlan(key, p => ({ ...p, extraStepWeight: val }), newShop.name);
                                    }}
                                    className="input-field"
                                    style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                                  />
                                  <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>kg</span>
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  Cước cộng thêm
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="500"
                                    value={plan.extraStepPrice ?? 5000}
                                    onChange={(e) => {
                                      const val = Number(e.target.value || 0);
                                      updateNewShopPricingPlan(key, p => ({ ...p, extraStepPrice: val }), newShop.name);
                                    }}
                                    className="input-field"
                                    style={{ width: '100%', padding: '4px 8px', fontSize: 12 }}
                                  />
                                  <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>đ</span>
                                </div>
                              </div>

                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                                  Phí chuyển hoàn (%)
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={plan.returnFeePercent ?? 50}
                                    onChange={(e) => {
                                      const val = Number(e.target.value || 0);
                                      updateNewShopPricingPlan(key, p => ({ ...p, returnFeePercent: val }), newShop.name);
                                    }}
                                    className="input-field"
                                    style={{ width: 60, padding: '4px 6px', fontSize: 12, textAlign: 'center' }}
                                  />
                                  <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>%</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNewShopPricingPlan(key, p => ({ ...p, returnFeePercent: 0 }), newShop.name)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700 }}
                                  >
                                    0%
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateNewShopPricingPlan(key, p => ({ ...p, returnFeePercent: 50 }), newShop.name)}
                                    className="btn btn-primary btn-sm"
                                    style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700 }}
                                  >
                                    50%
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Khung Thử Tính Cước Trực Tiếp (Dashed Box) */}
                          <div style={{
                            background: 'rgba(79, 70, 229, 0.05)',
                            border: '1.5px dashed var(--primary)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Calculator size={15} color="var(--primary)" />
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                                Thử tính cước với cân nặng:
                              </span>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={testWeight}
                                onChange={(e) => {
                                  const val = Number(e.target.value || 0.1);
                                  setNewShopTestWeights(prev => ({ ...prev, [key]: val }));
                                }}
                                className="input-field"
                                style={{ width: 65, padding: '3px 6px', fontSize: 12, textAlign: 'center' }}
                              />
                              <span style={{ fontSize: 12 }}>kg</span>
                            </div>

                            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                              Cước tính ra: <strong className="mono" style={{ fontSize: 14.5, color: '#059669' }}>{formatVND(calculatedTestFee)}</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TRƯỜNG HỢP B: DANH SÁCH SHOP ĐÃ CÓ HỒ SƠ & TỰ ĐỘNG KHỚP THEO CẤU HÌNH GỘP SHOP */}
          <div style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: 'var(--text-main)' }}>
                    DANH SÁCH {scannedShopAnalysis.existingShops.length} SHOP ĐÃ CÓ HỒ SƠ (TỰ ĐỘNG KHỚP THEO CẤU HÌNH GỘP SHOP)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                    Tất cả các tên phụ, SĐT phụ trong file sẽ tự động được gom về đúng Shop chính đã thiết lập trong Quản Lý Shop.
                  </div>
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>STT</th>
                    <th>SHOP CHÍNH (MÃ SHOP)</th>
                    <th>TÊN / SĐT NHẬN DIỆN TỪ FILE (ĐÃ GỘP)</th>
                    <th>BIỂU PHÍ CƯỚC ÁP DỤNG</th>
                    <th style={{ textAlign: 'right' }}>SỐ ĐƠN</th>
                    <th style={{ textAlign: 'right' }}>TỔNG COD</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedShopAnalysis.existingShops.map((item, idx) => (
                    <tr key={item.shop.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--primary)' }}>{item.shop.name}</strong>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>[{item.shop.code}]</span>
                        </div>
                        {item.shop.nameAliases && item.shop.nameAliases.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 20,
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: '#fff',
                              letterSpacing: '0.02em',
                            }}>
                              🔗 ĐÃ GỘP ({item.shop.nameAliases.length})
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: 'var(--text-main)' }}>
                          {item.aliasesInFile.join(', ')}
                        </div>
                        {item.phonesInFile.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            📞 {item.phonesInFile.join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                          {item.shop.pricingPlan?.name || 'Biểu cước chuẩn'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">
                        {item.orderCount.toLocaleString('vi-VN')} đơn
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">
                        {formatVND(item.totalCod)}
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: 11 }}>✓ Đã Khớp</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar of Step 3 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingTop: 16,
            borderTop: '1px solid var(--border-color)',
          }}>
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className="btn btn-secondary btn-lg"
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              <ArrowLeft size={16} />
              <span>Quay Lại Bước 2 (Kiểm Tra File)</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (scannedShopAnalysis.hasNewShops) {
                  handleAddNewScannedShops(scannedShopAnalysis.newShops);
                }
                await handleRunReconciliation();
                setWizardStep(4);
              }}
              className="btn btn-primary btn-lg"
              disabled={isProcessing}
              style={{ minWidth: 320, fontWeight: 900, fontSize: 14, padding: '12px 28px', background: 'linear-gradient(135deg, #10b981 0%, #4f46e5 100%)' }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Đang Tính Cước & Lập Bảng Kê...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>TIẾN HÀNH ĐỐI SOÁT & TÍNH CƯỚC (BƯỚC 4) ➔</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 🚀 BƯỚC 4: KẾT QUẢ ĐỐI SOÁT & BẢNG KÊ CHI TIẾT TỪNG SHOP */}
      {wizardStep === 4 && currentSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {currentSession.unmatchedOrdersCount > 0 && (
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)' }}>
              <AlertTriangle size={20} />
              <div style={{ fontSize: 13 }}>
                <strong>Chưa thể chốt hoặc xuất bảng kê.</strong> Có {currentSession.unmatchedOrdersCount} đơn chưa xác định được shop/trạng thái hoặc cần kiểm tra dữ liệu. Mở tab <strong>“Đơn Chưa Khớp”</strong> để xử lý trước.
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ padding: 16, borderLeft: '4px solid var(--info)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginBottom: 10 }}>Đối Chiếu Nguồn NVC → Bảng Kê</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, fontSize: 12 }}>
              <div><div style={{ color: 'var(--text-muted)' }}>Đơn từ file NVC</div><strong>{currentSession.totalOrders.toLocaleString('vi-VN')} đơn</strong></div>
              <div><div style={{ color: 'var(--text-muted)' }}>Đơn đã vào bảng kê</div><strong style={{ color: 'var(--success)' }}>{currentSession.matchedOrdersCount.toLocaleString('vi-VN')} đơn</strong></div>
              <div><div style={{ color: 'var(--text-muted)' }}>Đơn đang chờ kiểm tra</div><strong style={{ color: currentSession.unmatchedOrdersCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{currentSession.unmatchedOrdersCount.toLocaleString('vi-VN')} đơn</strong></div>
              <div><div style={{ color: 'var(--text-muted)' }}>COD theo toàn bộ file NVC</div><strong>{formatVND(sourceCodTotal)}</strong><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Đã vào bảng kê: {formatVND(currentSession.totalCod)} • Chờ: {formatVND(unmatchedSourceCod)}</div></div>
              <div><div style={{ color: 'var(--text-muted)' }}>Cước theo toàn bộ file NVC</div><strong>{formatVND(sourceNvcFeeTotal)}</strong><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Đã vào bảng kê: {formatVND(currentSession.totalNvcCost)} • Chờ: {formatVND(unmatchedSourceNvcFee)}</div></div>
            </div>
          </div>
          
          {/* Financial KPI Summary Dashboard */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 16,
          }}>
            {/* Panel 1: Dòng Tiền Khách Hàng (Shop Payout) */}
            <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={18} /> 💳 BÁO CÁO DÒNG TIỀN KHÁCH HÀNG (SHOP)
                </span>
                <span style={{ fontSize: 11, background: 'rgba(79,70,229,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  {currentSession.statements.length} Shop Đối Soát
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>TỔNG ĐƠN HÀNG</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
                    {currentSession.totalOrders.toLocaleString('vi-VN')} <span style={{ fontSize: 12, fontWeight: 400 }}>đơn</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--success)' }}>
                    ✓ {currentSession.matchedOrdersCount} đã khớp • {currentSession.unmatchedOrdersCount} chưa khớp
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>TỔNG TIỀN COD THU HỘ</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--info)', margin: '4px 0' }}>
                    {formatVND(currentSession.totalCod)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tiền NVC đã thu từ người nhận</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>DOANH THU CƯỚC THU SHOP</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                    {formatVND(currentSession.totalShopRevenue)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Cước tính theo bảng giá Shop</div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.12) 100%)', padding: '12px 14px', borderRadius: 8, border: '1px solid rgba(79,70,229,0.3)' }}>
                  <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>THỰC CHUYỂN TRẢ SHOP</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)', margin: '4px 0' }}>
                    {formatVND(currentSession.totalNetPayout)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>= COD thu - Cước & Phí Shop</div>
                </div>
              </div>
            </div>

            {/* Panel 2: Lợi Nhuận & Hiệu Quả Nhà Gom (Profit & Ops) */}
            <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={18} /> 📈 BÁO CÁO LỢI NHUẬN NHÀ GOM ĐƠN
                </span>
                <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  Hiệu Quả Kinh Doanh
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>CƯỚC GỐC PHẢI TRẢ NVC</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)', margin: '4px 0' }}>
                    {formatVND(currentSession.totalNvcCost)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Theo giá sỉ mua NVC {currentSession.carrierName}</div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(16,185,129,0.12) 100%)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700 }}>LỢI NHUẬN RỒNG (LÃI THUẦN)</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)', margin: '4px 0' }}>
                    +{formatVND(currentSession.totalProfit)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>= Cước Shop thu - Cước NVC trả</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>HOA HỒNG CHI TRẢ CTV</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>
                    {formatVND(currentSession.totalCtvCommission || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Hoa hồng chia cho các CTV</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => ExcelService.downloadCtvCommissionReport(currentSession)}
                    disabled={currentSession.unmatchedOrdersCount > 0}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
                  >
                    <Download size={14} color="var(--primary)" />
                    <span>Tải Báo Cáo Hoa Hồng CTV</span>
                  </button>
                </div>
              </div>
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
                type="button"
                onClick={() => setShowExportModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                title="Tùy chọn bật/tắt cột xuất file Excel cho Shop và Báo cáo tổng"
              >
                <Settings2 size={15} color="var(--primary)" />
                <span>⚙️ Cài đặt cột xuất</span>
              </button>

              <button
                onClick={() => ExcelService.downloadMasterProfitReport(currentSession)}
                disabled={currentSession.unmatchedOrdersCount > 0}
                className="btn btn-secondary btn-sm"
              >
                <FileSpreadsheet size={15} />
                <span>Xuất Báo Cáo Lợi Nhuận Tổng (.xlsx)</span>
              </button>

              <button
                onClick={handleDownloadAllZip}
                disabled={zipProgress.active || currentSession.unmatchedOrdersCount > 0}
                className="btn btn-success btn-sm"
              >
                <Download size={15} />
                <span>
                  {zipProgress.active ? `Đang nén ZIP (${zipProgress.percent}%)...` : 'Tải Toàn Bộ Hồ Sơ (ZIP Từng Thư Mục Shop)'}
                </span>
              </button>

              <button
                onClick={() => onNavigateToEmail(currentSession)}
                disabled={currentSession.unmatchedOrdersCount > 0}
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
                              disabled={currentSession.unmatchedOrdersCount > 0}
                              className="btn btn-secondary btn-sm"
                              title={currentSession.unmatchedOrdersCount > 0 ? 'Cần xử lý toàn bộ đơn chưa khớp trước khi xuất bảng kê' : 'Tải file Excel (.xlsx) riêng của Shop'}
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
              <div style={{ padding: 16, background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 700 }}>
                    <AlertTriangle size={18} />
                    <span>Có {currentSession.unmatchedOrders.length} đơn chưa đủ điều kiện đưa vào bảng kê</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Xem thông tin Shop/Người nhận đọc từ file bên dưới để chọn đúng Shop cần gán từ menu thả xuống.
                  </p>
                </div>

                <div style={{ minWidth: 260 }}>
                  <input
                    type="text"
                    placeholder="🔍 Tìm mã đơn, tên/SĐT shop hoặc khách..."
                    value={unmatchedSearchTerm}
                    onChange={(e) => setUnmatchedSearchTerm(e.target.value)}
                    className="input-field"
                    style={{ padding: '6px 12px', fontSize: 12, width: '100%', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã Vận Đơn</th>
                    <th>Tên / SĐT Shop Đọc Từ File</th>
                    <th>Người Nhận & Hàng Hóa</th>
                    <th>Tiền COD</th>
                    <th>Cước NVC</th>
                    <th>Trạng Thái</th>
                    <th>Gán Thủ Công Cho Shop</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnmatchedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        {unmatchedSearchTerm ? `Không tìm thấy đơn nào khớp với từ khóa "${unmatchedSearchTerm}"` : 'Không có đơn chưa khớp'}
                      </td>
                    </tr>
                  ) : (
                    filteredUnmatchedOrders.map((order: ReconciledOrder, idx: number) => (
                      <tr key={order.id}>
                        <td>{idx + 1}</td>
                        <td><strong className="mono" style={{ color: 'var(--danger)' }}>{order.waybill}</strong></td>
                        <td>
                          <div>
                            <strong style={{ fontSize: 12, color: 'var(--text-main)' }}>{order.shopName || '-- Chưa có tên --'}</strong>
                            {order.shopPhone && <div className="mono" style={{ fontSize: 11, color: 'var(--primary)' }}>📞 {order.shopPhone}</div>}
                          </div>
                        </td>
                        <td>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{order.receiverName || 'Khách Nhận'} {order.receiverPhone ? `(${order.receiverPhone})` : ''}</div>
                            {order.productName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📦 {order.productName}</div>}
                          </div>
                        </td>
                        <td className="mono">{formatVND(order.codAmount)}</td>
                        <td className="mono">{formatVND(order.nvcBaseFee)}</td>
                        <td>{order.statusText}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {!isAdmin ? (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chỉ Admin được phép gán thủ công</span>
                            ) : (
                              <>
                                {order.matchError && (
                                  <div style={{ fontSize: 11, color: 'var(--danger)', fontStyle: 'italic', maxWidth: 240 }}>
                                    ⚠️ {order.matchError}
                                  </div>
                                )}
                                <div style={{ marginTop: 2 }}>
                                  <SearchableShopPicker
                                    shops={shops}
                                    selectedShopId={selectedAssignShops[order.id] || ''}
                                    onSelectShop={(shopId) => setSelectedAssignShops({
                                      ...selectedAssignShops,
                                      [order.id]: shopId
                                    })}
                                    onAssign={() => handleAssignUnmatchedOrder(order, selectedAssignShops[order.id])}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 4 Action Cards Grid in Step 4 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {/* Action 1: Xuất Excel Báo Cáo */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: 20, border: '1.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>1. Xuất Excel Báo Cáo Kỳ</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Tải file Excel tổng hợp gồm tất cả đơn hàng đã đối soát kèm phân tích chi tiết doanh thu & lợi nhuận.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => ExcelService.downloadMasterProfitReport(currentSession)}
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: 12.5, fontWeight: 700, padding: '10px 14px' }}
                >
                  <Download size={15} />
                  <span>Tải Báo Cáo & Phân Tích Lợi Nhuận (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Action 2: Tải ZIP Trọn Bộ */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: 20, border: '1.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Download size={22} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>2. Tải File ZIP Bảng Kê Shop</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Tự động đóng gói trọn bộ {currentSession.statements.length} file Excel bảng kê riêng biệt của từng Shop vào 1 file ZIP duy nhất.
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={zipProgress.active}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: 12.5, fontWeight: 800, padding: '10px 14px', background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)' }}
              >
                {zipProgress.active ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Đang nén ZIP ({zipProgress.percent}%)...</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>Tải File ZIP Trọn Bộ {currentSession.statements.length} Shop</span>
                  </>
                )}
              </button>
            </div>

            {/* Action 3: Gửi Email Hàng Loạt */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: 20, border: '1.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Mail size={22} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>3. Gửi Email Bảng Kê Hàng Loạt</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Mở ngay phân hệ Gửi Email với nội dung và bảng kê đối soát của kỳ này được nạp sẵn sàng 100%.
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToEmail(currentSession)}
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: 12.5, fontWeight: 800, padding: '10px 14px', borderColor: '#ec4899', color: '#db2777' }}
              >
                <Mail size={15} />
                <span>Chuyển Sang Gửi Email Ngay ➔</span>
              </button>
            </div>
          </div>

          {/* Action Bar of Step 4 */}
          <div className="glass-panel" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '16px 22px',
          }}>
            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className="btn btn-secondary btn-lg"
              style={{ fontWeight: 700, fontSize: 13 }}
            >
              <ArrowLeft size={16} />
              <span>Quay Lại Bước 3 (Duyệt & Cấu Hình Shop)</span>
            </button>

            <button
              type="button"
              onClick={handleResetReconciliation}
              className="btn btn-success btn-lg"
              style={{ fontWeight: 900, fontSize: 13.5, padding: '12px 26px' }}
            >
              <CheckCircle2 size={18} />
              <span>✓ Hoàn Tất & Làm Mới Phiên Đối Soát</span>
            </button>
          </div>
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
            requireAppMapping={reconcileMode === '2files'}
            hasLiveNvcFile={nvcHeaders.length > 0}
            hasLiveAppFile={appHeaders.length > 0}
            hasSavedNvcHeaders={savedH.nvcHeaders.length > 0}
            hasSavedAppHeaders={savedH.appHeaders.length > 0}
            onSaveMappings={(newNvc, newApp) => {
              if (configCid === selectedCarrierId) {
                setNvcMapping(newNvc);
                setAppMapping(newApp);
                setIsMappingConfirmed(true);
              }
              AuditService.logAction(
                currentUser.username,
                currentUser.role,
                'UPDATE_CARRIER_MAPPING',
                `Cập nhật profile/ánh xạ cột cho ${configCarrier.carrierName} (${configCid}).`
              );
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
          requireAppMapping={reconcileMode === '2files'}
          carrierId={selectedCarrierId}
          carrierName={selectedCarrierTier?.carrierName}
          onSaveMappings={(newNvc, newApp) => {
            setNvcMapping(newNvc);
            setAppMapping(newApp);
            setIsMappingConfirmed(true);
            AuditService.logAction(
              currentUser.username,
              currentUser.role,
              'CONFIRM_FILE_MAPPING',
              `Xác nhận ánh xạ cột cho file ${selectedCarrierTier?.carrierName || selectedCarrierId} của kỳ đang xử lý.`
            );
          }}
        />
      )}

      {/* Export Columns Config Modal */}
      {showExportModal && (() => {
        const savedH = selectedCarrierId ? StorageService.getCarrierHeaders(selectedCarrierId) : { nvcHeaders: [], appHeaders: [] };
        const nvcSet = new Set<string>(nvcHeaders.length > 0 ? nvcHeaders : savedH.nvcHeaders);
        const appSet = new Set<string>(appHeaders.length > 0 ? appHeaders : savedH.appHeaders);
        
        if (currentSession?.statements) {
          currentSession.statements.slice(0, 20).forEach(stmt => {
            (stmt.orders || []).slice(0, 10).forEach(ord => {
              if (ord.rawNvcData) Object.keys(ord.rawNvcData).forEach(k => { if (k && !k.startsWith('__')) nvcSet.add(k); });
              if (ord.rawAppData) Object.keys(ord.rawAppData).forEach(k => { if (k && !k.startsWith('__')) appSet.add(k); });
            });
          });
        }

        return (
          <ExportColumnConfigModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            carrierId={selectedCarrierId}
            carrierName={selectedCarrierTier?.carrierName}
            availableFileHeaders={{
              nvcHeaders: Array.from(nvcSet),
              appHeaders: Array.from(appSet),
            }}
          />
        );
      })()}

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

      {/* Duplicate Waybills Conflict Modal */}
      {duplicateCheckResult && (
        <DuplicateConflictModal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          checkResult={duplicateCheckResult}
          onFilterNewOnly={handleFilterNewOnlyConflict}
        />
      )}

    </div>
  );
};
