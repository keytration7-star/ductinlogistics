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
  Plus,
  Trash2,
  Sliders,
  Calculator
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
import { autoDetectColumns, normalizeHeader } from '../services/smartColumnDetector';
import { performReconciliation, calculateWeightFee, checkDuplicateWaybills, findRegisteredShop, normalizePhone, getShopPhones, type DuplicateCheckResult } from '../services/reconciliationService';
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
}

export type CustomShopSubGroup = {
  id: string;
  name: string;
  entryKeys: string[];
};

type ShopProposalEntry = { name: string; phone: string; address: string; count: number; existing: boolean; existingShopId?: string };
type ShopProposalDecision = 'pending' | 'merge' | 'separate' | 'custom_merge';
type ShopProposalGroup = {
  id: string;
  label: string;
  entries: ShopProposalEntry[];
  decision: ShopProposalDecision;
  targetShopId?: string;
  customMainName?: string;
  customSubGroups?: CustomShopSubGroup[];
  pricingPlan: ShopPricingPlan;
  testWeight: number;
};

const createOnboardingPricingPlan = (): ShopPricingPlan => ({
  id: `plan_onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: 'Biểu giá nhập khi xác nhận shop',
  // Zero is intentional only as an unconfirmed form value. Validation below
  // prevents creation until Admin enters a real shop fee.
  weightRules: [{ minWeight: 0, maxWeight: 1, price: 0 }],
  extraStepWeight: 1,
  extraStepPrice: 0,
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
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const isAdmin = currentUser.role === 'ADMIN';
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
  const savedCarrierId = localStorage.getItem('gomdon_last_selected_carrier');
  const savedCarrier = carriers.find(c => c.carrierId === savedCarrierId || c.id === savedCarrierId);
  const firstVerifiedCarrier = carriers.find(isVerifiedCarrier);
  const savedCarrierIdState = isVerifiedCarrier(savedCarrier)
    ? (savedCarrier?.carrierId || savedCarrier?.id || '')
    : (firstVerifiedCarrier?.carrierId || firstVerifiedCarrier?.id || 'jnt');
  const [selectedCarrierId, setSelectedCarrierIdState] = useState<string>(savedCarrierIdState);

  const setSelectedCarrierId = (id: string) => {
    const carrier = carriers.find(c => c.carrierId === id || c.id === id);
    if (!isVerifiedCarrier(carrier)) {
      showToast('Hiện chỉ cho phép đối soát J&T và GHN vì đây là hai hãng đã được kiểm chứng bằng file thực tế.', 'warning');
      return;
    }
    setSelectedCarrierIdState(id);
    localStorage.setItem('gomdon_last_selected_carrier', id);
  };

  const selectedCarrierTier = carriers.find(c => c.carrierId === selectedCarrierId || c.id === selectedCarrierId) || carriers[0];
  const isJntCarrier = /(^|[^a-z])j\s*&?\s*t([^a-z]|$)|\bjnt\b/i.test(`${selectedCarrierTier?.carrierId || ''} ${selectedCarrierTier?.carrierName || ''}`);
  const isGhnCarrier = /\bghn\b|giao\s*hang\s*nhanh/i.test(`${selectedCarrierTier?.carrierId || ''} ${selectedCarrierTier?.carrierName || ''}`);
  const isVerifiedSelectedCarrier = isVerifiedCarrier(selectedCarrierTier);

  // Auto-sync column mapping when selected carrier changes
  React.useEffect(() => {
    if (selectedCarrierId) {
      const carrierMapping = StorageService.getCarrierMapping(selectedCarrierId);
      if (carrierMapping.nvc) setNvcMapping(carrierMapping.nvc);
      if (carrierMapping.app) setAppMapping(carrierMapping.app);
    }
  }, [selectedCarrierId]);

  React.useEffect(() => {
    if (isJntCarrier) setReconcileMode('2files');
  }, [isJntCarrier]);

  React.useEffect(() => {
    if (isGhnCarrier) setReconcileMode('1file');
  }, [isGhnCarrier]);

  const [sessionPeriodName, setSessionPeriodName] = useState<string>('');

  // Auto-generate smart session period name when carrier or file changes
  React.useEffect(() => {
    const existingSessions = StorageService.getSessions();
    const carrierObj = carriers.find(c => c.id === selectedCarrierId || c.carrierId === selectedCarrierId);
    const cName = carrierObj ? carrierObj.carrierName : selectedCarrierId;
    const combinedRows = [...nvcRows, ...appRows];
    
    const smartName = generateSmartSessionName(cName, existingSessions, combinedRows);
    setSessionPeriodName(smartName);
  }, [selectedCarrierId, carriers, nvcRows, appRows]);

  const [reconcileMode, setReconcileMode] = useState<'1file' | '2files'>('2files');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [isMappingConfirmed, setIsMappingConfirmed] = useState(false);
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
  const [shopProposalGroups, setShopProposalGroups] = useState<ShopProposalGroup[]>([]);
  const [showShopProposal, setShowShopProposal] = useState(false);
  const [shopReviewConfirmed, setShopReviewConfirmed] = useState(false);

  // Custom merge checkbox states per group
  const [selectedEntryKeysMap, setSelectedEntryKeysMap] = useState<Record<string, string[]>>({});
  const [customGroupInputMap, setCustomGroupInputMap] = useState<Record<string, string>>({});

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

  const updateProposalPricing = (groupId: string, updater: (pricingPlan: ShopPricingPlan) => ShopPricingPlan) => {
    setShopProposalGroups(groups => groups.map(group => group.id === groupId
      ? { ...group, pricingPlan: updater({ ...group.pricingPlan, weightRules: group.pricingPlan.weightRules.map(rule => ({ ...rule })) }) }
      : group
    ));
  };

  const addProposalWeightRule = (group: ShopProposalGroup) => {
    updateProposalPricing(group.id, pricingPlan => {
      const lastRule = pricingPlan.weightRules[pricingPlan.weightRules.length - 1];
      const newMin = lastRule ? Math.round((lastRule.maxWeight + 0.1) * 10) / 10 : 0;
      const newMax = lastRule ? Math.ceil(newMin) : 1;
      const newPrice = lastRule ? lastRule.price + 5000 : 0;
      return { ...pricingPlan, weightRules: [...pricingPlan.weightRules, { minWeight: newMin, maxWeight: newMax, price: newPrice }] };
    });
  };

  const removeProposalWeightRule = (group: ShopProposalGroup, index: number) => {
    if (group.pricingPlan.weightRules.length <= 1) return;
    updateProposalPricing(group.id, pricingPlan => ({ ...pricingPlan, weightRules: pricingPlan.weightRules.filter((_, ruleIndex) => ruleIndex !== index) }));
  };

  const prepareShopProposals = (rows: Record<string, any>[], mapping: ColumnMappingConfig) => {
    const entries = new Map<string, ShopProposalEntry>();
    rows.forEach(row => {
      const name = String(mapping.shopNameColumn ? row[mapping.shopNameColumn] || '' : '').trim();
      const phone = String(mapping.shopPhoneColumn ? row[mapping.shopPhoneColumn] || '' : '').trim();
      const address = String(mapping.shopAddressColumn ? row[mapping.shopAddressColumn] || '' : '').trim();
      if (!name && !phone) return;
      const matched = findRegisteredShop(shops, { name, phone });
      const existing = matched.matched;
      const key = `${name.toLocaleLowerCase('vi-VN')}|${phone.replace(/\D/g, '')}`;
      const item = entries.get(key) || {
        name: name || 'Chưa có tên', phone, address, count: 0, existing,
        existingShopId: matched.matched ? matched.shop.id : undefined,
      };
      item.count += 1;
      if (!item.address && address) item.address = address;
      entries.set(key, item);
    });
    const values = [...entries.values()];
    // Build connected identity groups. This keeps a chain such as
    // Name A + Phone 1, Name A + Phone 2, Name B + Phone 2 in one review
    // block instead of silently splitting it into misleading subgroups.
    const parent = values.map((_, index) => index);
    const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
    const union = (a: number, b: number) => { const pa = find(a); const pb = find(b); if (pa !== pb) parent[pb] = pa; };
    values.forEach((item, index) => values.slice(index + 1).forEach((other, offset) => {
      const otherIndex = index + offset + 1;
      const samePhone = Boolean(item.phone) && item.phone.replace(/\D/g, '') === other.phone.replace(/\D/g, '');
      const sameName = Boolean(item.name) && item.name.toLocaleLowerCase('vi-VN') === other.name.toLocaleLowerCase('vi-VN');
      if (samePhone || sameName) union(index, otherIndex);
    }));
    const grouped = new Map<number, ShopProposalEntry[]>();
    values.forEach((item, index) => grouped.set(find(index), [...(grouped.get(find(index)) || []), item]));
    const proposals = [...grouped.values()].map((items, groupIndex) => {
      const names = new Set(items.map(item => item.name));
      const phones = new Set(items.map(item => item.phone).filter(Boolean));
      const existingShopIds = [...new Set(items.map(item => item.existingShopId).filter(Boolean))] as string[];
      const allFullyMatched = items.every(item => item.existing && item.existingShopId) && existingShopIds.length === items.length;

      const label = allFullyMatched
        ? 'Shop đã có hồ sơ (Đã ghép chuẩn từng Shop độc lập)'
        : items.length === 1
        ? (items[0].existing ? 'Shop đã có hồ sơ' : 'Shop mới cần xác nhận')
        : `Xung đột định danh: ${names.size} tên · ${phones.size} SĐT`;

      return {
        id: `identity-group-${groupIndex}`,
        label,
        entries: items,
        decision: (allFullyMatched || (items.length === 1 && items[0].existing) ? 'separate' : 'pending') as ShopProposalDecision,
        targetShopId: existingShopIds.length === 1 ? existingShopIds[0] : undefined,
        pricingPlan: createOnboardingPricingPlan(),
        testWeight: 1.5,
      };
    });
    const hasUnresolvedProposals = proposals.some(group => {
      const allFullyMatched = group.entries.every(item => item.existing && item.existingShopId)
        && new Set(group.entries.map(item => item.existingShopId)).size === group.entries.length;
      return !allFullyMatched && (group.entries.some(entry => !entry.existing) || group.entries.length > 1);
    });

    setShopProposalGroups(proposals);
    setShopReviewConfirmed(!hasUnresolvedProposals);
    setShowShopProposal(hasUnresolvedProposals);
  };

  // Covers drafts preserved while navigating tabs or after a hot update: the
  // review is not tied only to the original file-input event.
  React.useEffect(() => {
    if (appRows.length > 0 && appMapping.shopNameColumn) {
      prepareShopProposals(appRows, appMapping);
    }
  // Re-run only when the loaded App file or its identity mapping changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appRows, appMapping.shopNameColumn, appMapping.shopPhoneColumn, appMapping.shopAddressColumn]);

  const saveShopProposals = () => {
    if (!isAdmin) return;
    const unresolved = shopProposalGroups.filter(group =>
      (group.entries.length > 1 || group.entries.some(entry => !entry.existing)) && group.decision === 'pending'
    );
    if (unresolved.length > 0) {
      showToast(`Còn ${unresolved.length} nhóm shop xung đột/mới chưa được Admin chọn cách xử lý (Tách hoặc Gộp).`, 'warning');
      return;
    }
    const missingTargets = shopProposalGroups.filter(group => group.decision === 'merge' && group.entries.length > 1 && !group.targetShopId);
    if (missingTargets.length > 0) {
      showToast('Vui lòng chọn shop chính để gộp tiền về cho từng nhóm xung đột.', 'warning');
      return;
    }
    const pricingMissing = shopProposalGroups.filter(group => {
      const willCreateShop = group.entries.some(entry => !entry.existing)
        && !(group.decision === 'merge' && group.targetShopId);
      return willCreateShop && (group.pricingPlan.weightRules[0]?.price || 0) <= 0;
    });
    if (pricingMissing.length > 0) {
      showToast(`Còn ${pricingMissing.length} nhóm shop mới chưa có cước 0–1kg. Không thể tạo shop có biểu giá 0đ.`, 'warning');
      return;
    }
    const missingCustomMerge = shopProposalGroups.filter(group => group.decision === 'custom_merge' && (!group.customSubGroups || group.customSubGroups.length === 0));
    if (missingCustomMerge.length > 0) {
      showToast('Vui lòng tích chọn các shop và bấm nút "Tạo Shop" cho nhóm gộp tùy chỉnh.', 'warning');
      return;
    }
    const additions: Shop[] = [];
    const updates = new Map<string, Shop>();
    shopProposalGroups.forEach((group, groupIndex) => {
      if (group.decision === 'custom_merge') {
        if (group.customSubGroups?.length) {
          group.customSubGroups.forEach((subGroup, subIndex) => {
            const subEntries = group.entries.filter(e => subGroup.entryKeys.includes(`${e.name.toLocaleLowerCase('vi-VN')}|${e.phone.replace(/\D/g, '')}`));
            if (subEntries.length === 0) return;
            const primaryPhone = subEntries.find(e => e.phone)?.phone || '';
            const normalizedEntryPhone = normalizePhone(primaryPhone);
            const existingShopWithSamePhone = shops.find(s =>
              s.active && s.phone && normalizedEntryPhone && getShopPhones(s).includes(normalizedEntryPhone)
            );
            const pricingPlanToUse = existingShopWithSamePhone
              ? JSON.parse(JSON.stringify(existingShopWithSamePhone.pricingPlan))
              : { ...group.pricingPlan, id: `${group.pricingPlan.id}_${groupIndex}_custom_${subIndex}`, weightRules: group.pricingPlan.weightRules.map(rule => ({ ...rule })) };
            const bankAccountToUse = existingShopWithSamePhone
              ? { ...existingShopWithSamePhone.bankAccount }
              : { bankName: '', accountNumber: '', accountHolder: subGroup.name };

            const aliasList = subEntries.map(e => e.name).filter(n => normalizeHeader(n) !== normalizeHeader(subGroup.name));
            const allPhones = [...new Set(subEntries.map(e => e.phone).filter(Boolean))];

            additions.push({
              id: `shop_import_custom_${Date.now()}_${groupIndex}_${subIndex}`,
              code: `SHOP_${Date.now().toString().slice(-6)}_${groupIndex}_${subIndex}`,
              name: subGroup.name,
              phone: primaryPhone,
              phoneList: allPhones,
              nameAliases: aliasList,
              email: '',
              address: subEntries[0]?.address || '',
              bankAccount: bankAccountToUse,
              pricingPlan: pricingPlanToUse,
              notes: `Gộp shop tùy chỉnh từ ${subEntries.length} tên shop (${subEntries.map(e => e.name).join(', ')})`,
              createdAt: new Date().toISOString(),
              active: true
            });
          });
        }

        const mergedKeys = new Set((group.customSubGroups || []).flatMap(sg => sg.entryKeys));
        const unmergedEntries = group.entries.filter(e => !mergedKeys.has(`${e.name.toLocaleLowerCase('vi-VN')}|${e.phone.replace(/\D/g, '')}`));
        
        unmergedEntries.forEach((entry, setIndex) => {
          const exactMatchShop = shops.find(s => s.active && normalizeHeader(s.name) === normalizeHeader(entry.name));
          if (exactMatchShop) return;
          const normalizedEntryPhone = normalizePhone(entry.phone || '');
          const existingShopWithSamePhone = shops.find(s =>
            s.active && s.phone && normalizedEntryPhone && getShopPhones(s).includes(normalizedEntryPhone)
          );
          const pricingPlanToUse = existingShopWithSamePhone
            ? JSON.parse(JSON.stringify(existingShopWithSamePhone.pricingPlan))
            : { ...group.pricingPlan, id: `${group.pricingPlan.id}_${groupIndex}_rem_${setIndex}`, weightRules: group.pricingPlan.weightRules.map(rule => ({ ...rule })) };
          const bankAccountToUse = existingShopWithSamePhone
            ? { ...existingShopWithSamePhone.bankAccount }
            : { bankName: '', accountNumber: '', accountHolder: entry.name };

          additions.push({
            id: `shop_import_rem_${Date.now()}_${groupIndex}_${setIndex}`,
            code: `SHOP_${Date.now().toString().slice(-6)}_${groupIndex}_${setIndex}`,
            name: entry.name,
            phone: entry.phone,
            phoneList: [entry.phone].filter(Boolean),
            nameAliases: [],
            email: '',
            address: entry.address,
            bankAccount: bankAccountToUse,
            pricingPlan: pricingPlanToUse,
            notes: `Tách shop riêng từ tên chưa gộp`,
            createdAt: new Date().toISOString(),
            active: true
          });
        });

        return;
      }

      if (group.decision === 'merge') {
        const original = shops.find(shop => shop.id === group.targetShopId);
        if (original) {
          const target = updates.get(original.id) || { ...original, phoneList: [...(original.phoneList || [])], nameAliases: [...(original.nameAliases || [])] };
          if (group.customMainName && group.customMainName.trim()) {
            target.name = group.customMainName.trim();
          }
          const phoneList = new Set([target.phone, ...(target.phoneList || [])].filter(Boolean));
          const aliasList = new Set((target.nameAliases || []).filter(Boolean));
          group.entries.forEach(entry => {
            if (entry.phone) phoneList.add(entry.phone);
            if (entry.name && entry.name !== target.name) aliasList.add(entry.name);
          });
          target.phoneList = [...phoneList];
          target.nameAliases = [...aliasList];
          updates.set(target.id, target);
          return;
        }

        // If no existing shop targeted, create a new merged shop profile from all group entries!
        let targetIndex = 0;
        if (group.targetShopId && group.targetShopId.startsWith('entry_')) {
          targetIndex = parseInt(group.targetShopId.replace('entry_', ''), 10) || 0;
        }
        const selectedMainName = (group.customMainName && group.customMainName.trim())
          || (group.entries[targetIndex] ? group.entries[targetIndex].name : group.entries[0].name);
        
        const primaryPhone = group.entries[0]?.phone || '';
        const normalizedEntryPhone = normalizePhone(primaryPhone);
        const existingShopWithSamePhone = shops.find(s =>
          s.active && s.phone && normalizedEntryPhone && getShopPhones(s).includes(normalizedEntryPhone)
        );
        const pricingPlanToUse = existingShopWithSamePhone
          ? JSON.parse(JSON.stringify(existingShopWithSamePhone.pricingPlan))
          : { ...group.pricingPlan, id: `${group.pricingPlan.id}_${groupIndex}_merge`, weightRules: group.pricingPlan.weightRules.map(rule => ({ ...rule })) };
        const bankAccountToUse = existingShopWithSamePhone
          ? { ...existingShopWithSamePhone.bankAccount }
          : { bankName: '', accountNumber: '', accountHolder: selectedMainName };

        const aliasList = group.entries.map(e => e.name).filter(n => normalizeHeader(n) !== normalizeHeader(selectedMainName));
        const allPhones = [...new Set(group.entries.map(e => e.phone).filter(Boolean))];

        additions.push({
          id: `shop_import_merge_${Date.now()}_${groupIndex}`,
          code: `SHOP_${Date.now().toString().slice(-6)}_${groupIndex}`,
          name: selectedMainName,
          phone: primaryPhone,
          phoneList: allPhones,
          nameAliases: aliasList,
          email: '',
          address: group.entries[0]?.address || '',
          bankAccount: bankAccountToUse,
          pricingPlan: pricingPlanToUse,
          notes: `Gộp tất cả ${group.entries.length} tên shop (${group.entries.map(e => e.name).join(', ')})`,
          createdAt: new Date().toISOString(),
          active: true
        });
        return;
      }
      const entriesToCreate = group.entries.filter(entry => {
        const exactMatchShop = shops.find(s => s.active && normalizeHeader(s.name) === normalizeHeader(entry.name));
        return !exactMatchShop;
      });
      if (entriesToCreate.length === 0) return;

      entriesToCreate.forEach((entry, setIndex) => {
        const normalizedEntryPhone = normalizePhone(entry.phone || '');
        const existingShopWithSamePhone = shops.find(s =>
          s.active && s.phone && normalizedEntryPhone && getShopPhones(s).includes(normalizedEntryPhone)
        );
        const pricingPlanToUse = existingShopWithSamePhone
          ? JSON.parse(JSON.stringify(existingShopWithSamePhone.pricingPlan))
          : { ...group.pricingPlan, id: `${group.pricingPlan.id}_${groupIndex}_${setIndex}`, weightRules: group.pricingPlan.weightRules.map(rule => ({ ...rule })) };
        const bankAccountToUse = existingShopWithSamePhone
          ? { ...existingShopWithSamePhone.bankAccount }
          : { bankName: '', accountNumber: '', accountHolder: entry.name };

        if (existingShopWithSamePhone && existingShopWithSamePhone.nameAliases?.length) {
          const target = updates.get(existingShopWithSamePhone.id) || { ...existingShopWithSamePhone, nameAliases: [...(existingShopWithSamePhone.nameAliases || [])] };
          target.nameAliases = (target.nameAliases || []).filter(alias => normalizeHeader(alias) !== normalizeHeader(entry.name));
          updates.set(target.id, target);
        }

        additions.push({
          id: `shop_import_${Date.now()}_${groupIndex}_${setIndex}`,
          code: `SHOP_${Date.now().toString().slice(-6)}_${groupIndex}_${setIndex}`,
          name: entry.name,
          phone: entry.phone,
          phoneList: [entry.phone].filter(Boolean),
          nameAliases: [],
          email: '',
          address: entry.address,
          bankAccount: bankAccountToUse,
          pricingPlan: pricingPlanToUse,
          notes: `Tách shop riêng từ nhóm xung đột (${entry.count} đơn)${existingShopWithSamePhone ? ` - Kế thừa biểu giá & ngân hàng của ${existingShopWithSamePhone.name}` : ''}`,
          createdAt: new Date().toISOString(),
          active: true
        });
      });
    });
    const updatedShops = shops.map(shop => updates.get(shop.id) || shop);
    onSaveShops([...additions, ...updatedShops]);
    setShopReviewConfirmed(true);
    setShowShopProposal(false);
    const mergedCount = updates.size;
    showToast(`Đã xác nhận: thêm ${additions.length} shop mới${mergedCount ? `, cập nhật ${mergedCount} hồ sơ shop` : ''}. Biểu giá cơ bản đã được lưu cùng hồ sơ shop.`, 'success');
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
        prepareShopProposals(rows, detectedMapping);
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
        prepareShopProposals(combinedRows, normalizedMapping);
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

      setCurrentSession(session);
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
    if (!isVerifiedSelectedCarrier) {
      showToast('Chỉ có profile J&T và GHN đã được kiểm chứng. Không thể tính đối soát cho hãng khác.', 'warning');
      return;
    }
    if (isJntCarrier && reconcileMode !== '2files') {
      showToast('J&T bắt buộc dùng 2 file (NVC + App) để xác định đúng shop.', 'warning');
      setReconcileMode('2files');
      return;
    }

    if (nvcRows.length === 0 || (reconcileMode === '2files' && appRows.length === 0)) {
      showToast(reconcileMode === '1file' ? 'Vui lòng tải lên File Excel Đối Soát.' : 'Vui lòng tải lên cả 2 file: File Đối Soát NVC và File Đơn Hàng từ App.', 'warning');
      return;
    }

    if (!isMappingConfirmed) {
      showToast('Để tránh nhầm cột khi NVC đổi mẫu file, vui lòng xác nhận ánh xạ cột của file đang tải trước khi tính.', 'warning');
      setShowMappingModal(true);
      return;
    }

    const missingNvcFields = [
      !nvcMapping.waybillColumn && 'Mã vận đơn',
      !nvcMapping.codColumn && 'Tiền COD',
      !nvcMapping.feeColumn && 'Cước NVC',
    ].filter(Boolean);
    if (missingNvcFields.length > 0) {
      showToast(`Chưa xác nhận cột ${missingNvcFields.join(', ')} của File NVC. Vui lòng mở Cài đặt thẻ hãng trước khi tính.`, 'warning');
      setShowMappingModal(true);
      return;
    }

    if (reconcileMode === '2files' && (!appMapping.waybillColumn || (!appMapping.shopPhoneColumn && !appMapping.shopCodeColumn && !appMapping.shopNameColumn))) {
      showToast('File App cần xác nhận Mã vận đơn và ít nhất một thông tin nhận diện shop (SĐT, mã shop/kho hoặc tên shop).', 'warning');
      setShowMappingModal(true);
      return;
    }

    if (isJntCarrier && reconcileMode === '2files' && (!appMapping.shopNameColumn && !appMapping.shopPhoneColumn && !appMapping.shopCodeColumn)) {
      showToast('File App cần xác nhận ít nhất một cột nhận diện shop (Tên người gửi, SĐT người gửi hoặc Mã shop).', 'warning');
      setShowMappingModal(true);
      return;
    }

    if (isJntCarrier && reconcileMode === '2files' && !shopReviewConfirmed) {
      showToast('Chưa được đối soát: Admin cần xác nhận danh sách shop đọc từ File App trước.', 'warning');
      setShowShopProposal(true);
      return;
    }

    if (reconcileMode === '1file' && (!nvcMapping.shopPhoneColumn && !nvcMapping.shopCodeColumn && !nvcMapping.shopNameColumn)) {
      showToast('File NVC cần xác nhận ít nhất một cột nhận diện shop (SĐT gửi, mã shop/kho hoặc tên shop).', 'warning');
      setShowMappingModal(true);
      return;
    }

    if (!nvcMapping.statusColumn && !(reconcileMode === '2files' && appMapping.statusColumn)) {
      showToast('Cần xác nhận cột Trạng thái từ File NVC hoặc File App. App không tự coi đơn là giao thành công.', 'warning');
      setShowMappingModal(true);
      return;
    }

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
      setShopProposalGroups([]);
      setShopReviewConfirmed(false);
      setShowShopProposal(false);
      setCurrentSession(null);
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
      <div className="glass-panel" style={{
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 10,
        alignItems: 'center',
      }}>
        {[
          { step: '01', title: 'CHỌN HÃNG & CHẾ ĐỘ', desc: selectedCarrierTier?.carrierName || 'Chọn NVC', active: true, done: !!selectedCarrierId },
          { step: '02', title: 'TẢI FILE EXCEL', desc: nvcFile ? `${nvcFile.name.slice(0, 16)}...` : 'Kéo thả file', active: !!nvcFile, done: !!nvcFile },
          { step: '03', title: 'KHỚP NỐI & KIỂM TRA', desc: currentSession ? `${currentSession.matchedOrdersCount} đơn đã khớp` : 'Chờ đối soát', active: !!currentSession, done: !!currentSession && currentSession.unmatchedOrdersCount === 0 },
          { step: '04', title: 'XÁC NHẬN & XUẤT FILE', desc: currentSession ? (currentSession.unmatchedOrdersCount > 0 ? `${currentSession.unmatchedOrdersCount} đơn cần xử lý` : `${currentSession.statements.length} shop sẵn sàng`) : 'Xuất Excel / ZIP', active: !!currentSession, done: !!currentSession && currentSession.unmatchedOrdersCount === 0 },
        ].map((item) => (
          <div key={item.step} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: item.done ? 'var(--success-bg)' : item.active ? 'rgba(79, 70, 229, 0.06)' : 'var(--bg-tertiary)',
            border: item.done ? '1px solid var(--success-border)' : item.active ? '1px solid var(--primary-glow)' : '1px solid var(--border-color)',
          }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: item.done ? 'var(--success)' : item.active ? 'var(--primary)' : 'var(--bg-secondary)',
              color: item.done || item.active ? '#ffffff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0,
            }}>
              {item.done ? <CheckCircle2 size={15} /> : item.step}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: item.done ? 'var(--success)' : item.active ? 'var(--primary)' : 'var(--text-dim)', letterSpacing: '0.04em' }}>
                STEP {item.step}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2-File Upload Dropzones */}
      <div className="glass-panel" style={{ padding: 20 }}>
        {/* Compact Mode Selector & Period Name Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.7) 100%)',
          padding: '10px 16px',
          borderRadius: 12,
          border: '1.5px solid rgba(226, 232, 240, 0.9)',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          {/* Mode Selector Toggle Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              ⚙️ CHẾ ĐỘ NHẬP FILE:
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => !isGhnCarrier && setReconcileMode('2files')}
                className={`btn btn-sm ${reconcileMode === '2files' ? 'btn-primary' : 'btn-secondary'}`}
                disabled={isGhnCarrier}
                title={isGhnCarrier ? 'GHN dùng một file đối soát, app tự tách bảng COD và cước' : undefined}
                style={{ fontSize: 12, padding: '5px 12px', fontWeight: reconcileMode === '2files' ? 700 : 500, opacity: isGhnCarrier ? 0.5 : 1, cursor: isGhnCarrier ? 'not-allowed' : 'pointer' }}
              >
                📄📄 2 File (NVC + App - Vd: J&T)
              </button>
              <button
                type="button"
                onClick={() => !isJntCarrier && setReconcileMode('1file')}
                className={`btn btn-sm ${reconcileMode === '1file' ? 'btn-primary' : 'btn-secondary'}`}
                disabled={isJntCarrier}
                title={isJntCarrier ? 'J&T bắt buộc ghép File NVC và File App' : undefined}
                style={{ fontSize: 12, padding: '5px 12px', fontWeight: reconcileMode === '1file' ? 700 : 500, opacity: isJntCarrier ? 0.5 : 1, cursor: isJntCarrier ? 'not-allowed' : 'pointer' }}
              >
                📄 1 File Duy Nhất (Vd: GHN / GHTK)
              </button>
            </div>
          </div>

          {/* Period Name Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>Tên Kỳ Đối Soát:</label>
            <input
              type="text"
              value={sessionPeriodName}
              onChange={(e) => setSessionPeriodName(e.target.value)}
              className="input-field"
              placeholder="Nhập tên kỳ đối soát..."
              style={{ padding: '5px 12px', fontSize: 12, width: 280, fontWeight: 700, color: 'var(--primary)' }}
            />
          </div>

          {isGhnCarrier && ghnSheets.length > 0 && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(79, 70, 229, 0.06)', border: '1px solid var(--primary-glow)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-main)' }}>
                <strong>Phiên GHN cần đối soát:</strong> File có {ghnSheets.length} sheet. App chỉ nạp một sheet/phiên để không trộn dòng tiền.
              </div>
              <select value={selectedGhnSheet} onChange={(event) => handleGhnSheetChange(event.target.value)} className="select-field" style={{ minWidth: 190 }}>
                <option value="" disabled>-- Chọn sheet/kỳ GHN --</option>
                {ghnSheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name} ({sheet.rowCount} dòng)</option>)}
              </select>
            </div>
          )}
        </div>

        {/* CARRIER CARDS SELECTOR */}
        <div style={{ marginBottom: 20, background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📦 Chọn Thẻ Đơn Vị Vận Chuyển Đối Soát:</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                (Bấm vào thẻ để chọn/bỏ chọn, bấm nút để cấu hình cách đọc file nhập)
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
              const isVerified = isVerifiedCarrier(c);
              return (
                <div
                  key={c.id || c.carrierId}
                  onClick={() => isVerified && setSelectedCarrierId(c.carrierId || c.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected 
                      ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.14) 0%, rgba(16, 185, 129, 0.10) 100%)' 
                      : 'var(--bg-primary)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    cursor: isVerified ? 'pointer' : 'not-allowed',
                    opacity: isVerified ? 1 : 0.5,
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
                        onChange={() => isVerified && setSelectedCarrierId(c.carrierId || c.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!isVerified}
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
                        if (isAdmin && isVerified) setConfigCarrier(c);
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
                      disabled={!isAdmin || !isVerified}
                      title={!isVerified ? 'Hãng chưa có file mẫu kiểm chứng; chưa cho phép cấu hình đối soát' : isAdmin ? `Bấm để cấu hình ánh xạ file nhập cho ${c.carrierName}` : 'Chỉ Admin được phép thay đổi cấu hình hãng'}
                    >
                      <Settings2 size={13} color="var(--primary)" />
                      <span>Ánh xạ file</span>
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
                {isDraggingNvc ? 'THẢ FILE EXCEL ĐỐI SOÁT VÀO ĐÂY' : nvcFile ? `✓ ĐÃ TẢI FILE: ${nvcFile.name}` : '📄 TẢI LÊN FILE EXCEL ĐỐI SOÁT DUY NHẤT (VÍ DỤ GHN / GHTK / VIETTEL POST)'}
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
                    setShopProposalGroups([]);
                    setShopReviewConfirmed(false);
                    setShowShopProposal(false);
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                  <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                    ✓ Đã nhận diện cột Shop: <strong className="mono">[{appMapping.shopNameColumn || 'Mặc định'}]</strong>
                  </div>
                  <button type="button" className={shopReviewConfirmed ? 'btn btn-secondary btn-sm' : 'btn btn-warning btn-sm'} style={{ fontSize: 11, padding: '4px 8px' }} onClick={event => { event.stopPropagation(); prepareShopProposals(appRows, appMapping); }}>
                    {shopReviewConfirmed ? 'Xem lại shop từ file App' : `Xác nhận ${shopProposalGroups.reduce((sum, group) => sum + group.entries.length, 0)} định danh shop`}
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

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
            disabled={isProcessing || nvcRows.length === 0 || (reconcileMode === '2files' && appRows.length === 0)}
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

        </div>
      )}

      {/* Unified Carrier Profile Config Modal */}
      {showShopProposal && (
        <div className="modal-overlay" onClick={() => setShowShopProposal(false)}>
          <div className="modal-content" style={{ maxWidth: 860, maxHeight: '88vh', overflowY: 'auto' }} onClick={event => event.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Xác nhận shop đọc từ File App</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>App không tự tạo hoặc tự gộp shop. Admin phải xác nhận mọi shop mới hoặc nhóm Tên/SĐT liên quan trước khi đối soát.</p>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '9px 11px', borderRadius: 'var(--radius-md)' }}>Danh sách dưới đây là toàn bộ định danh đọc từ file. Nhãn xanh là hồ sơ đã khớp chính xác; nhãn vàng là dữ liệu mới. Với một tên/nhiều SĐT hoặc một SĐT/nhiều tên, hãy chọn gộp hoặc tách rõ ràng.</div>
              {shopProposalGroups.map(group => (
                <div key={group.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{group.label}</strong>
                    {(group.entries.length > 1 || group.entries.some(entry => !entry.existing)) && (
                      <select
                        value={group.decision}
                        onChange={event => setShopProposalGroups(groups => groups.map(item => item.id === group.id ? { ...item, decision: event.target.value as ShopProposalDecision } : item))}
                        className="select-field"
                        style={{ width: 340, padding: '6px 8px', fontSize: 12, fontWeight: 700 }}
                      >
                        <option value="pending">-- Admin chọn cách xử lý --</option>
                        <option value="separate">Tạo/Giữ shop độc lập theo từng định danh</option>
                        <option value="merge">Gộp tất cả vào một shop (thêm tên/SĐT phụ)</option>
                        <option value="custom_merge">🎨 Gộp shop tùy chỉnh (Tích chọn gom từng nhóm)</option>
                      </select>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 9, marginTop: 12 }}>
                    {group.entries.map(entry => {
                      const entryKey = `${entry.name.toLocaleLowerCase('vi-VN')}|${entry.phone.replace(/\D/g, '')}`;
                      const mergedSubGroup = (group.customSubGroups || []).find(sg => sg.entryKeys.includes(entryKey));
                      const isSelected = (selectedEntryKeysMap[group.id] || []).includes(entryKey);
                      const accent = mergedSubGroup ? '#2563eb' : entry.existing ? '#059669' : '#d97706';
                      const surface = mergedSubGroup ? 'rgba(37, 99, 235, 0.08)' : entry.existing ? 'rgba(16, 185, 129, 0.07)' : 'rgba(245, 158, 11, 0.08)';
                      const border = mergedSubGroup ? 'rgba(37, 99, 235, 0.45)' : entry.existing ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.48)';

                      return (
                        <div key={entryKey} style={{ border: `1px solid ${border}`, borderLeft: `4px solid ${accent}`, background: surface, borderRadius: 'var(--radius-sm)', padding: '10px 12px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {group.decision === 'custom_merge' && (
                                <input
                                  type="checkbox"
                                  disabled={!!mergedSubGroup}
                                  checked={!!mergedSubGroup || isSelected}
                                  onChange={(e) => {
                                    const prev = selectedEntryKeysMap[group.id] || [];
                                    if (e.target.checked) {
                                      setSelectedEntryKeysMap({ ...selectedEntryKeysMap, [group.id]: [...prev, entryKey] });
                                    } else {
                                      setSelectedEntryKeysMap({ ...selectedEntryKeysMap, [group.id]: prev.filter(k => k !== entryKey) });
                                    }
                                  }}
                                  style={{ width: 16, height: 16, cursor: mergedSubGroup ? 'not-allowed' : 'pointer' }}
                                />
                              )}
                              <strong style={{ color: 'var(--text-main)', fontSize: 13 }}>{entry.name}</strong>
                            </div>
                            {mergedSubGroup ? (
                              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>
                                ✓ Đã gộp vào Shop: <strong>{mergedSubGroup.name}</strong>
                              </span>
                            ) : (
                              <span className={`badge ${entry.existing ? 'badge-success' : 'badge-warning'}`}>
                                {entry.existing ? '✓ Đã có hồ sơ' : '+ Shop mới'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 7, fontSize: 12, color: 'var(--text-main)' }}>
                            <span className="mono" style={{ fontWeight: 700, color: accent }}>{entry.phone || 'Chưa có SĐT'}</span>
                            <span style={{ color: 'var(--text-muted)' }}>•</span>
                            <span><strong>{entry.count}</strong> đơn</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>📍 {entry.address || 'Chưa có địa chỉ kho gửi'}</div>
                        </div>
                      );
                    })}
                  </div>

                  {group.decision === 'custom_merge' && (
                    <div style={{ marginTop: 14, background: 'rgba(79, 70, 229, 0.05)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid rgba(79, 70, 229, 0.25)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(group.customSubGroups || []).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <strong style={{ fontSize: 12, color: 'var(--primary)' }}>Các nhóm shop đã gom tạo thành công:</strong>
                          {group.customSubGroups?.map(sg => (
                            <div key={sg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                                🏪 Shop mới: <strong style={{ color: 'var(--primary)' }}>{sg.name}</strong> ({sg.entryKeys.length} tên nhãn gửi gộp)
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }}
                                onClick={() => {
                                  setShopProposalGroups(groups => groups.map(g => g.id === group.id ? { ...g, customSubGroups: (g.customSubGroups || []).filter(item => item.id !== sg.id) } : g));
                                }}
                              >
                                🗑️ Hủy gộp nhóm này
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>
                            ✨ Tích chọn các ô shop ở trên để gom thành 1 nhóm shop riêng:
                          </label>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Đã tích: <strong>{(selectedEntryKeysMap[group.id] || []).length}</strong> shop
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="Gõ tên Shop gộp (Ví dụ: Shop Kiều Nhung Tổng)"
                            value={customGroupInputMap[group.id] || ''}
                            onChange={e => setCustomGroupInputMap({ ...customGroupInputMap, [group.id]: e.target.value })}
                            className="input-field"
                            style={{ flex: 1, minWidth: 240, padding: '7px 10px', fontSize: 12, fontWeight: 700 }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={(selectedEntryKeysMap[group.id] || []).length < 1 || !(customGroupInputMap[group.id] || '').trim()}
                            onClick={() => {
                              const selectedKeys = selectedEntryKeysMap[group.id] || [];
                              const customName = (customGroupInputMap[group.id] || '').trim();
                              if (selectedKeys.length === 0 || !customName) return;

                              const newSubGroup: CustomShopSubGroup = {
                                id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                name: customName,
                                entryKeys: [...selectedKeys],
                              };

                              setShopProposalGroups(groups => groups.map(g => g.id === group.id ? { ...g, customSubGroups: [...(g.customSubGroups || []), newSubGroup] } : g));
                              setSelectedEntryKeysMap({ ...selectedEntryKeysMap, [group.id]: [] });
                              setCustomGroupInputMap({ ...customGroupInputMap, [group.id]: '' });
                              showToast(`Đã gom thành công nhóm shop "${customName}"!`, 'success');
                            }}
                            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700 }}
                          >
                            ➕ Tạo Shop từ {(selectedEntryKeysMap[group.id] || []).length} tên đã chọn
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {group.decision === 'merge' && (group.entries.length > 1 || group.entries.some(entry => entry.existing)) && (
                    <div style={{ marginTop: 12, background: '#fffbeb', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid #fcd34d', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 4 }}>
                          ✏️ Tên Shop gộp đại diện (In trên Bảng Kê Excel & Báo cáo):
                        </label>
                        <input
                          type="text"
                          placeholder={`Ví dụ: ${group.entries[0]?.name || 'Shop Gộp Mới'} (Bỏ trống sẽ tự lấy tên đầu tiên)`}
                          value={group.customMainName || ''}
                          onChange={event => {
                            const val = event.target.value;
                            setShopProposalGroups(groups => groups.map(item => item.id === group.id ? { ...item, customMainName: val } : item));
                          }}
                          className="input-field"
                          style={{ width: '100%', padding: '7px 10px', fontSize: 13, fontWeight: 700, borderColor: '#f59e0b', background: '#fff' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                          Chọn shop chính để gộp tất cả các tên/SĐT trong nhóm này về 1 Bảng kê:
                        </label>
                        <select
                          value={group.targetShopId || ''}
                          onChange={event => setShopProposalGroups(groups => groups.map(item => item.id === group.id ? { ...item, targetShopId: event.target.value } : item))}
                          className="select-field"
                          style={{ width: '100%', padding: '7px 9px', fontSize: 12, fontWeight: 600 }}
                        >
                          <optgroup label="Tên shop đại diện (Trong nhóm này)">
                            {group.entries.map((entry, idx) => (
                              <option key={`entry_${idx}`} value={`entry_${idx}`}>
                                {entry.name} ({entry.count} đơn - SĐT: {entry.phone || 'Không SĐT'})
                              </option>
                            ))}
                          </optgroup>
                          {shops.filter(shop => shop.active).length > 0 && (
                            <optgroup label="Hồ sơ Shop đã có sẵn trong danh mục">
                              {shops.filter(shop => shop.active).map(shop => (
                                <option key={shop.id} value={shop.id}>
                                  {shop.code} · {shop.name} · {shop.phone}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </div>
                  )}
                  {group.entries.some(entry => !entry.existing) && !(group.decision === 'merge' && group.targetShopId) && <div style={{ marginTop: 16, padding: 15, borderRadius: 'var(--radius-md)', background: 'rgba(79, 70, 229, 0.045)', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--primary)', fontSize: 14, fontWeight: 800 }}><Sliders size={16} /> Biểu giá cước bậc thang theo cân nặng</div>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => addProposalWeightRule(group)} style={{ fontSize: 11, padding: '4px 9px' }}><Plus size={13} /> Thêm nấc cân nặng</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Áp dụng cho shop mới tạo từ nhóm này. Cước 0–1kg là bắt buộc; các nấc sau giúp app tính đúng theo biểu giá riêng.</p>
                    <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.pricingPlan.weightRules.map((rule, index) => <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <div style={{ width: 100, fontSize: 12, fontWeight: 700 }}>{index === 0 ? 'Từ 0 đến' : `Từ ${rule.minWeight} đến`}</div>
                        <input type="number" min="0.1" step="0.1" value={rule.maxWeight} className="input-field" style={{ width: 82, padding: '5px 8px', fontSize: 12 }} onChange={event => updateProposalPricing(group.id, pricingPlan => {
                          const weightRules = pricingPlan.weightRules.map((item, ruleIndex) => ruleIndex === index ? { ...item, maxWeight: Number(event.target.value || 0) } : item);
                          return { ...pricingPlan, weightRules };
                        })} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg:</span>
                        <input type="number" min="0" step="500" value={rule.price === 0 ? '' : rule.price} placeholder={index === 0 ? 'Bắt buộc nhập' : '0'} className="input-field" style={{ flex: 1, minWidth: 130, padding: '5px 8px', fontSize: 12 }} onChange={event => updateProposalPricing(group.id, pricingPlan => {
                          const weightRules = pricingPlan.weightRules.map((item, ruleIndex) => ruleIndex === index ? { ...item, price: Number(event.target.value || 0) } : item);
                          return { ...pricingPlan, weightRules };
                        })} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>VNĐ</span>
                        {group.pricingPlan.weightRules.length > 1 && <button type="button" className="btn btn-danger btn-sm" style={{ padding: '4px 6px' }} onClick={() => removeProposalWeightRule(group, index)} title="Xóa nấc cân"><Trash2 size={12} /></button>}
                      </div>)}
                      <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vượt cân: mỗi thêm<input type="number" min="0.1" step="0.1" value={group.pricingPlan.extraStepWeight} className="input-field" style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }} onChange={event => updateProposalPricing(group.id, pricingPlan => ({ ...pricingPlan, extraStepWeight: Number(event.target.value || 1) }))} /></label>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cước cộng thêm (đ)<input type="number" min="0" step="500" value={group.pricingPlan.extraStepPrice === 0 ? '' : group.pricingPlan.extraStepPrice} placeholder="0" className="input-field" style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }} onChange={event => updateProposalPricing(group.id, pricingPlan => ({ ...pricingPlan, extraStepPrice: Number(event.target.value || 0) }))} /></label>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phí chuyển hoàn (%)<input type="number" min="0" max="100" value={group.pricingPlan.returnFeePercent} className="input-field" style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }} onChange={event => updateProposalPricing(group.id, pricingPlan => ({ ...pricingPlan, returnFeePercent: Number(event.target.value || 0) }))} /></label>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phụ thu cố định (đ)<input type="number" min="0" step="500" value={group.pricingPlan.fixedSurcharge === 0 ? '' : group.pricingPlan.fixedSurcharge} placeholder="0" className="input-field" style={{ width: '100%', marginTop: 4, padding: '5px 8px', fontSize: 12 }} onChange={event => updateProposalPricing(group.id, pricingPlan => ({ ...pricingPlan, fixedSurcharge: Number(event.target.value || 0) }))} /></label>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, background: 'rgba(79, 70, 229, 0.06)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Calculator size={15} color="var(--primary)" /><span style={{ fontSize: 12, fontWeight: 700 }}>Thử tính cước:</span><input type="number" min="0.1" step="0.1" value={group.testWeight} className="input-field" style={{ width: 72, padding: '4px 7px', fontSize: 12 }} onChange={event => setShopProposalGroups(groups => groups.map(item => item.id === group.id ? { ...item, testWeight: Number(event.target.value || 0.1) } : item))} /><span style={{ fontSize: 12 }}>kg</span></div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cước tính ra: <strong className="mono" style={{ fontSize: 15, color: 'var(--success)' }}>{new Intl.NumberFormat('vi-VN').format(calculateWeightFee(group.testWeight, group.pricingPlan))} đ</strong></div>
                    </div>
                  </div>}
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowShopProposal(false)}>Để sau</button>
              <button type="button" className="btn btn-primary" disabled={!isAdmin} onClick={saveShopProposals}>Xác nhận danh sách shop</button>
            </div>
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
