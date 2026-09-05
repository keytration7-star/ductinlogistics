import React, { useState, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';
import type { CtvProfile, Shop, ReconciliationSession, UserAccount } from '../types';
import { 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Store, 
  FileSpreadsheet, 
  Download, 
  ArrowRightLeft, 
  Edit2, 
  Save, 
  Calculator, 
  Award, 
  CreditCard, 
  Sliders, 
  UserCheck 
} from 'lucide-react';
import { useToast, useConfirm } from './UIFeedback';
import { VIETNAM_BANKS as FULL_VIETNAM_BANKS } from '../constants/banks';
import { getCarrierTheme } from './CarriersPricingView';

const VIETNAM_BANKS = FULL_VIETNAM_BANKS.map(b => b.shortName);

interface CtvManagementViewProps {
  shops?: Shop[];
  onSaveShops?: (shops: Shop[]) => void;
  sessions?: ReconciliationSession[];
  currentUser?: UserAccount;
  activeCarrierId?: string;
  activeCarrierName?: string;
}

export const CtvManagementView: React.FC<CtvManagementViewProps> = ({
  shops = [],
  onSaveShops,
  sessions = [],
  currentUser,
  activeCarrierId = 'jnt',
  activeCarrierName = 'J&T Express',
}) => {
  const [ctvs, setCtvs] = useState<CtvProfile[]>(() => StorageService.getCtvs());
  const [selectedCtvId, setSelectedCtvId] = useState<string>(() => {
    const list = StorageService.getCtvs();
    return list.length > 0 ? list[0].id : '';
  });

  // Right-side active sub-tab for selected CTV
  const [activeDetailTab, setActiveDetailTab] = useState<'shops' | 'policy' | 'settlement'>('shops');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('latest');
  const [testWeight, setTestWeight] = useState<number>(1.5);

  // Modals
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUnassignedShopIds, setSelectedUnassignedShopIds] = useState<string[]>([]);
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const isAdmin = currentUser?.role === 'ADMIN' || !currentUser;
  const carrierTheme = useMemo(() => getCarrierTheme(activeCarrierId, activeCarrierName), [activeCarrierId, activeCarrierName]);

  // Currently Selected CTV
  const selectedCtv = useMemo(() => {
    return ctvs.find(c => c.id === selectedCtvId) || ctvs[0] || null;
  }, [ctvs, selectedCtvId]);

  // Form state for editing currently selected CTV in real-time
  const [editingCtvForm, setEditingCtvForm] = useState<CtvProfile | null>(() => selectedCtv);

  // Sync editing form when selected CTV changes
  React.useEffect(() => {
    if (selectedCtv) {
      setEditingCtvForm(JSON.parse(JSON.stringify(selectedCtv)));
    } else {
      setEditingCtvForm(null);
    }
  }, [selectedCtvId, ctvs]);

  // Filtered CTV List (Left Column)
  const filteredCtvs = useMemo(() => {
    return ctvs.filter(c => {
      if (statusFilter === 'active' && !c.active) return false;
      if (statusFilter === 'inactive' && c.active) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q));
    });
  }, [ctvs, statusFilter, searchTerm]);

  // Shops belonging to the selected CTV
  const ctvShops = useMemo(() => {
    if (!selectedCtv) return [];
    return shops.filter(s => s.ctvId === selectedCtv.id).filter(s => {
      if (!shopSearchQuery) return true;
      const q = shopSearchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q));
    });
  }, [shops, selectedCtv, shopSearchQuery]);

  // Direct Gom Don shops without any CTV
  const unassignedShops = useMemo(() => {
    return shops.filter(s => !s.ctvId);
  }, [shops]);

  // ──────────────────────────────────────────
  // 👥 CTV MASTER ACTIONS
  // ──────────────────────────────────────────
  const handleCreateNewCtv = () => {
    const newCtv: CtvProfile = {
      id: `ctv_${Date.now()}`,
      code: `CTV_${(ctvs.length + 1).toString().padStart(2, '0')}`,
      name: 'Cộng Tác Viên Mới',
      phone: '',
      email: '',
      notes: '',
      assignedCarriers: [activeCarrierId],
      bankAccount: {
        bankName: 'MB Bank',
        accountNumber: '',
        accountHolder: '',
      },
      commissionRules: [
        { minWeight: 0, maxWeight: 1, commissionPrice: 1000 },
        { minWeight: 1, maxWeight: 3, commissionPrice: 2000 },
        { minWeight: 3, maxWeight: 5, commissionPrice: 3000 },
      ],
      extraWeightStep: 1,
      extraWeightPrice: 500,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newCtv, ...ctvs];
    setCtvs(updated);
    StorageService.saveCtvs(updated);
    setSelectedCtvId(newCtv.id);
    showToast(`Đã tạo CTV mới: ${newCtv.code}. Hãy cập nhật thông tin ở bảng bên phải!`, 'success');
  };

  const handleSaveSelectedCtv = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCtvForm) return;

    if (!editingCtvForm.name.trim()) {
      showToast('Vui lòng nhập tên Cộng tác viên', 'warning');
      return;
    }
    if (!editingCtvForm.code.trim()) {
      showToast('Vui lòng nhập mã CTV', 'warning');
      return;
    }

    const ctvToSave: CtvProfile = {
      ...editingCtvForm,
      name: editingCtvForm.name.trim(),
      code: editingCtvForm.code.trim().toUpperCase(),
    };

    const updated = ctvs.map(c => c.id === ctvToSave.id ? ctvToSave : c);
    setCtvs(updated);
    StorageService.saveCtvs(updated);
    showToast(`Đã lưu thành công thông tin & biểu phí CTV: ${ctvToSave.name}`, 'success');
  };

  const handleDeleteCtv = async (ctv: CtvProfile) => {
    const ok = await showConfirm({
      title: 'Xóa Cộng Tác Viên',
      message: `Xóa CTV "${ctv.name}" (${ctv.code})? Các shop thuộc CTV này sẽ được chuyển về Nhà Gom quản lý trực tiếp.`,
      danger: true,
      confirmText: 'Xóa CTV',
    });
    if (!ok) return;

    const updatedCtvs = ctvs.filter(c => c.id !== ctv.id);
    setCtvs(updatedCtvs);
    StorageService.saveCtvs(updatedCtvs);

    // Unassign shops
    const updatedShops = shops.map(s => s.ctvId === ctv.id ? { ...s, ctvId: undefined, ctvName: undefined } : s);
    if (onSaveShops) onSaveShops(updatedShops);
    else StorageService.saveShops(updatedShops);

    if (updatedCtvs.length > 0) {
      setSelectedCtvId(updatedCtvs[0].id);
    } else {
      setSelectedCtvId('');
    }

    showToast(`Đã xóa CTV ${ctv.name} thành công.`, 'success');
  };

  // ──────────────────────────────────────────
  // 🏪 SHOP MANAGEMENT UNDER CTV
  // ──────────────────────────────────────────
  const handleOpenAddShop = () => {
    if (!selectedCtv) {
      showToast('Vui lòng chọn 1 CTV trước khi thêm Shop!', 'warning');
      return;
    }

    const newShop: Shop = {
      id: `shop_${Date.now()}`,
      code: `SHOP_${(shops.length + 1).toString().padStart(3, '0')}`,
      name: '',
      phone: '',
      email: '',
      address: '',
      bankAccount: {
        bankName: 'MB Bank',
        accountNumber: '',
        accountHolder: '',
      },
      pricingPlan: {
        id: `plan_${Date.now()}`,
        name: `Biểu giá ${selectedCtv.name}`,
        weightRules: [
          { minWeight: 0, maxWeight: 0.5, price: 16000 },
          { minWeight: 0.5, maxWeight: 1, price: 18000 },
          { minWeight: 1, maxWeight: 2, price: 22000 },
          { minWeight: 2, maxWeight: 3, price: 26000 },
        ],
        extraStepWeight: 0.5,
        extraStepPrice: 2500,
        returnFeePercent: 50,
        insuranceFeePercent: 0,
        fixedSurcharge: 0,
      },
      ctvId: selectedCtv.id,
      ctvName: selectedCtv.name,
      carrierId: activeCarrierId,
      createdAt: new Date().toISOString(),
      active: true,
    };

    setEditingShop(newShop);
    setIsShopModalOpen(true);
  };

  const handleOpenEditShop = (shop: Shop) => {
    setEditingShop(JSON.parse(JSON.stringify(shop)));
    setIsShopModalOpen(true);
  };

  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    if (!editingShop.name.trim()) {
      showToast('Vui lòng nhập tên Khách hàng / Shop', 'warning');
      return;
    }

    const shopToSave: Shop = {
      ...editingShop,
      name: editingShop.name.trim(),
      code: editingShop.code?.trim().toUpperCase() || `SHOP_${Date.now().toString().slice(-4)}`,
      ctvId: selectedCtv?.id || editingShop.ctvId,
      ctvName: selectedCtv?.name || editingShop.ctvName,
    };

    let updated: Shop[];
    const exists = shops.some(s => s.id === shopToSave.id);
    if (exists) {
      updated = shops.map(s => s.id === shopToSave.id ? shopToSave : s);
      showToast(`Đã cập nhật Shop: ${shopToSave.name}`, 'success');
    } else {
      updated = [shopToSave, ...shops];
      showToast(`Đã thêm mới Shop: ${shopToSave.name} cho CTV ${selectedCtv?.name}`, 'success');
    }

    if (onSaveShops) onSaveShops(updated);
    else StorageService.saveShops(updated);
    setIsShopModalOpen(false);
  };

  const handleRemoveShopFromCtv = async (shop: Shop) => {
    const ok = await showConfirm({
      title: 'Chuyển Shop Về Nhà Gom',
      message: `Chuyển quyền quản lý Shop "${shop.name}" từ CTV "${selectedCtv?.name}" về Nhà Gom trực tiếp?`,
      warning: true,
    });
    if (!ok) return;

    const updated = shops.map(s => s.id === shop.id ? { ...s, ctvId: undefined, ctvName: undefined } : s);
    if (onSaveShops) onSaveShops(updated);
    else StorageService.saveShops(updated);
    showToast(`Đã chuyển Shop "${shop.name}" về Nhà Gom.`, 'success');
  };

  const handleAssignShopsToCtv = () => {
    if (!selectedCtv) return;
    if (selectedUnassignedShopIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 Shop!', 'warning');
      return;
    }

    const updated = shops.map(s => {
      if (selectedUnassignedShopIds.includes(s.id)) {
        return {
          ...s,
          ctvId: selectedCtv.id,
          ctvName: selectedCtv.name,
        };
      }
      return s;
    });

    if (onSaveShops) onSaveShops(updated);
    else StorageService.saveShops(updated);

    showToast(`Đã gán ${selectedUnassignedShopIds.length} Shop cho CTV ${selectedCtv.name}!`, 'success');
    setSelectedUnassignedShopIds([]);
    setIsAssignModalOpen(false);
  };

  // ──────────────────────────────────────────
  // 📊 SETTLEMENT FOR SELECTED CTV
  // ──────────────────────────────────────────
  const activeSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    if (selectedSessionId === 'latest') return sessions[0];
    return sessions.find(s => s.id === selectedSessionId) || sessions[0];
  }, [sessions, selectedSessionId]);

  const ctvSessionOrders = useMemo(() => {
    if (!activeSession || !selectedCtv) return [];
    const orders: any[] = [];

    for (const stmt of activeSession.statements || []) {
      for (const order of stmt.orders || []) {
        const orderCtvId = order.ctvId || shops.find(s => s.id === order.shopId || s.phone === order.shopPhone)?.ctvId;
        if (orderCtvId === selectedCtv.id) {
          orders.push({ ...order, ctvId: orderCtvId });
        }
      }
    }
    return orders;
  }, [activeSession, selectedCtv, shops]);

  const settlementSummary = useMemo(() => {
    const totalOrders = ctvSessionOrders.length;
    const delivered = ctvSessionOrders.filter(o => o.status === 'delivered').length;
    const returned = ctvSessionOrders.filter(o => o.status === 'returned').length;
    const totalCod = ctvSessionOrders.reduce((sum, o) => sum + (o.codAmount || 0), 0);
    const totalShopFee = ctvSessionOrders.reduce((sum, o) => sum + (o.shopCalculatedFee || 0), 0);
    const totalNvcFee = ctvSessionOrders.reduce((sum, o) => sum + (o.nvcBaseFee || 0), 0);
    const totalCommission = ctvSessionOrders.reduce((sum, o) => sum + (o.ctvCommission || 0), 0);

    return {
      totalOrders,
      delivered,
      returned,
      totalCod,
      totalShopFee,
      totalNvcFee,
      totalCommission,
    };
  }, [ctvSessionOrders]);

  const handleExportCtvExcel = async () => {
    if (!activeSession || !selectedCtv) return;
    if (ctvSessionOrders.length === 0) {
      showToast(`Không có đơn hàng nào của CTV ${selectedCtv.name} trong kỳ đối soát này!`, 'warning');
      return;
    }
    try {
      const companyInfo = StorageService.getCompanyInfo();
      await ExcelService.downloadSingleCtvStatementReport(selectedCtv, activeSession, ctvSessionOrders, companyInfo);
      showToast(`Đã xuất Bảng Kê Đối Soát CTV ${selectedCtv.name}!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi xuất Excel: ${err?.message || err}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      
      {/* 🌟 TOP HEADER BANNER (Consistent with Shop & Biểu Phí) */}
      <div className="glass-panel" style={{
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: 12,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
        border: '1.5px solid var(--border-color)',
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        minHeight: 46,
      }}>
        {/* Left: Carrier Badge & Module Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: carrierTheme.cardBg,
            color: carrierTheme.badgeText,
            border: `1.5px solid ${carrierTheme.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <Award size={15} />
          </div>
          {activeCarrierName && (
            <span className="badge" style={{
              fontSize: 11,
              padding: '3px 9px',
              fontWeight: 800,
              background: carrierTheme.gradient,
              color: '#ffffff',
              boxShadow: carrierTheme.shadowGlow,
              borderRadius: 6,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}>
              HÃNG: {activeCarrierName.toUpperCase()}
            </span>
          )}
          <span style={{
            fontSize: 11.5,
            fontWeight: 800,
            color: 'var(--text-dim)',
            background: 'var(--bg-secondary)',
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            whiteSpace: 'nowrap',
          }}>
            👥 CỘNG TÁC VIÊN ({ctvs.length} CTV)
          </span>
        </div>

        {/* Right: Floating Selected CTV Header Card */}
        {selectedCtv && editingCtvForm ? (
          <div style={{
            background: '#ffffff',
            border: `1.5px solid ${carrierTheme.cardBorder || 'var(--border-color)'}`,
            borderRadius: 10,
            padding: '4px 10px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            {/* CTV Badge & Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                minWidth: 42,
                height: 28,
                padding: '0 6px',
                borderRadius: 6,
                background: carrierTheme.gradient,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: 11,
                boxShadow: carrierTheme.shadowGlow,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}>
                {editingCtvForm.code}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  {editingCtvForm.name}
                </strong>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: editingCtvForm.active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: editingCtvForm.active ? '#10b981' : '#ef4444',
                  whiteSpace: 'nowrap',
                }}>
                  {editingCtvForm.active ? 'Hoạt động' : 'Tạm dừng'}
                </span>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#d97706',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '1px 6px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}>
                  🏪 {ctvShops.length} Shop
                </span>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 6, borderLeft: '1px solid var(--border-color)' }}>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDeleteCtv(selectedCtv)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px', fontSize: 10.5, color: '#dc2626', borderColor: '#fca5a5', whiteSpace: 'nowrap' }}
                  title="Xóa CTV này"
                >
                  <Trash2 size={12} />
                  <span>Xóa CTV</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleSaveSelectedCtv()}
                  className="btn btn-sm"
                  style={{
                    padding: '5px 14px',
                    fontSize: 11.5,
                    fontWeight: 800,
                    background: carrierTheme.gradient,
                    color: '#ffffff',
                    boxShadow: carrierTheme.shadowGlow,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Save size={12} />
                  <span>Lưu Thay Đổi</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(241, 245, 249, 0.6)',
            border: '1.5px dashed var(--border-color)',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}>
            <span>👈 Chọn hoặc tạo CTV bên trái để cấu hình</span>
          </div>
        )}
      </div>

      {/* 🌟 2-COLUMN BALANCED MASTER-DETAIL WORKSPACE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr',
        gap: 14,
        alignItems: 'start',
      }}>
        
        {/* ◀️ LEFT COLUMN: DANH SÁCH CỘNG TÁC VIÊN */}
        <div className="glass-panel" style={{
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-color)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-sm)',
          position: 'sticky',
          top: 10,
          height: 'calc(100vh - 120px)',
          overflow: 'hidden',
        }}>
          {/* Action Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isAdmin && (
              <button
                type="button"
                onClick={handleCreateNewCtv}
                className="btn btn-primary btn-sm"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: carrierTheme.gradient || 'var(--brand-gradient)',
                  boxShadow: carrierTheme.shadowGlow || '0 2px 8px rgba(79, 70, 229, 0.25)',
                }}
              >
                <Plus size={14} />
                <span>+ Thêm CTV Mới</span>
              </button>
            )}

            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Tìm tên, mã, SĐT CTV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="input-field"
              style={{ padding: '5px 8px', fontSize: 11.5 }}
            >
              <option value="all">Tất cả CTV ({ctvs.length})</option>
              <option value="active">Đang hoạt động ({ctvs.filter(c => c.active).length})</option>
              <option value="inactive">Tạm ngừng ({ctvs.filter(c => !c.active).length})</option>
            </select>
          </div>

          {/* Master List Header Label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 2px 6px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--text-dim)',
            letterSpacing: '0.02em',
          }}>
            <span>DANH SÁCH CTV ({filteredCtvs.length})</span>
            <span style={{ color: 'var(--primary)' }}>{activeCarrierName}</span>
          </div>

          {/* Scrollable CTV List Items */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingRight: 2,
          }}>
            {filteredCtvs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 14px',
                fontSize: 12,
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                <UserCheck size={30} style={{ opacity: 0.35, color: 'var(--primary)' }} />
                <div>Không tìm thấy CTV nào phù hợp.</div>
              </div>
            ) : (
              filteredCtvs.map(ctv => {
                const isSelected = selectedCtv?.id === ctv.id;
                const shopCount = shops.filter(s => s.ctvId === ctv.id).length;

                return (
                  <div
                    key={ctv.id}
                    onClick={() => setSelectedCtvId(ctv.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.15)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="mono" style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: isSelected ? 'var(--primary)' : 'rgba(79, 70, 229, 0.12)',
                          color: isSelected ? '#fff' : 'var(--primary)',
                        }}>
                          {ctv.code}
                        </span>
                        <strong style={{ fontSize: 13, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                          {ctv.name}
                        </strong>
                      </div>

                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: ctv.active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: ctv.active ? '#10b981' : '#ef4444',
                      }}>
                        {ctv.active ? 'Bật' : 'Tắt'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      <span>{ctv.phone ? `📞 ${ctv.phone}` : 'Chưa có SĐT'}</span>
                      <span style={{
                        fontWeight: 800,
                        color: shopCount > 0 ? '#d97706' : 'var(--text-dim)',
                        background: shopCount > 0 ? '#fef3c7' : 'transparent',
                        padding: shopCount > 0 ? '1px 5px' : 0,
                        borderRadius: 4,
                      }}>
                        🏪 {shopCount} Shop
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ▶️ RIGHT COLUMN: CTV DETAIL & MANAGEMENT WORKSPACE */}
        {selectedCtv && editingCtvForm ? (
          <div className="glass-panel" style={{
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            height: 'calc(100vh - 120px)',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border-color)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-sm)',
          }}>
            {/* 📑 SHARP, MODERN SEGMENTED TABS */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              padding: 4,
              borderRadius: 10,
              border: '1.5px solid var(--border-color)',
              gap: 6,
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
            }}>
              {/* TAB 1 */}
              <button
                type="button"
                onClick={() => setActiveDetailTab('shops')}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeDetailTab === 'shops' ? 'var(--primary)' : 'transparent',
                  color: activeDetailTab === 'shops' ? '#ffffff' : 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  boxShadow: activeDetailTab === 'shops' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none',
                }}
              >
                <Store size={15} />
                <span>Khách Hàng (Shop)</span>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: activeDetailTab === 'shops' ? 'rgba(255,255,255,0.25)' : 'rgba(79, 70, 229, 0.12)',
                  color: activeDetailTab === 'shops' ? '#fff' : 'var(--primary)',
                }}>
                  {ctvShops.length}
                </span>
              </button>

              {/* TAB 2 */}
              <button
                type="button"
                onClick={() => setActiveDetailTab('policy')}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeDetailTab === 'policy' ? 'var(--primary)' : 'transparent',
                  color: activeDetailTab === 'policy' ? '#ffffff' : 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  boxShadow: activeDetailTab === 'policy' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none',
                }}
              >
                <Sliders size={15} />
                <span>Cấu Hình & Biểu Hoa Hồng</span>
              </button>

              {/* TAB 3 */}
              <button
                type="button"
                onClick={() => setActiveDetailTab('settlement')}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeDetailTab === 'settlement' ? 'var(--primary)' : 'transparent',
                  color: activeDetailTab === 'settlement' ? '#ffffff' : 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  boxShadow: activeDetailTab === 'settlement' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none',
                }}
              >
                <FileSpreadsheet size={15} />
                <span>Đối Soát & Quyết Toán</span>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: activeDetailTab === 'settlement' ? 'rgba(255,255,255,0.25)' : 'rgba(16, 185, 129, 0.15)',
                  color: activeDetailTab === 'settlement' ? '#fff' : '#059669',
                }}>
                  {ctvSessionOrders.length} đơn
                </span>
              </button>
            </div>

            {/* ────────────────────────────────────────── */}
            {/* 🏪 PANEL 1: SHOPS BELONGING TO THIS CTV */}
            {/* ────────────────────────────────────────── */}
            {activeDetailTab === 'shops' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Action Toolbar for Shops */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '4px 0',
                }}>
                  <div style={{ position: 'relative', minWidth: 280 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
                    <input
                      type="text"
                      placeholder="Tìm shop theo tên, mã, SĐT..."
                      value={shopSearchQuery}
                      onChange={(e) => setShopSearchQuery(e.target.value)}
                      className="input-field"
                      style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
                    />
                    {shopSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setShopSearchQuery('')}
                        style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(79, 70, 229, 0.06)',
                        border: '1.5px solid rgba(79, 70, 229, 0.3)',
                        color: 'var(--primary)',
                      }}
                    >
                      <ArrowRightLeft size={14} />
                      <span>Gán Shop Từ Nhà Gom ({unassignedShops.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddShop}
                      className="btn btn-primary btn-sm"
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: carrierTheme.gradient || 'var(--brand-gradient)',
                        boxShadow: carrierTheme.shadowGlow,
                      }}
                    >
                      <Plus size={14} />
                      <span>+ Thêm Shop Mới Cho CTV</span>
                    </button>
                  </div>
                </div>

                {/* Table of Shops */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)' }}>
                          <th style={{ padding: '10px 12px', width: 45, textAlign: 'center' }}>STT</th>
                          <th style={{ padding: '10px 12px' }}>Mã Shop</th>
                          <th style={{ padding: '10px 12px' }}>Tên Khách Hàng / Shop</th>
                          <th style={{ padding: '10px 12px' }}>Số Điện Thoại</th>
                          <th style={{ padding: '10px 12px' }}>Địa Chỉ Shop</th>
                          <th style={{ padding: '10px 12px' }}>Biểu Giá Bán Cước</th>
                          <th style={{ padding: '10px 12px' }}>STK Nhận Tiền COD</th>
                          <th style={{ padding: '10px 12px', width: 90, textAlign: 'center' }}>Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ctvShops.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
                              <Store size={36} style={{ opacity: 0.35, color: 'var(--primary)', marginBottom: 8 }} />
                              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}>Chưa có khách hàng nào thuộc CTV {selectedCtv.name}.</div>
                              <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-dim)' }}>
                                Bấm <strong>"+ Thêm Shop Mới Cho CTV"</strong> hoặc <strong>"Gán Shop Từ Nhà Gom"</strong> ở trên để phân quyền quản lý!
                              </div>
                            </td>
                          </tr>
                        ) : (
                          ctvShops.map((shop, idx) => (
                            <tr key={shop.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-dim)' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span className="mono" style={{ fontWeight: 800, background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4 }}>
                                  {shop.code}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-main)' }}>
                                {shop.name}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                {shop.phone ? <span className="mono">📞 {shop.phone}</span> : <span style={{ color: 'var(--text-dim)' }}>---</span>}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {shop.address || '---'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  {shop.pricingPlan?.name || 'Biểu giá chuẩn'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 11.5 }}>
                                {shop.bankAccount?.accountNumber ? (
                                  <span className="mono">{shop.bankAccount.accountNumber} ({shop.bankAccount.bankName})</span>
                                ) : (
                                  <span style={{ color: 'var(--text-dim)' }}>Chưa có</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditShop(shop)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '4px 6px' }}
                                    title="Sửa thông tin & biểu giá shop"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveShopFromCtv(shop)}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '4px 6px', color: '#f59e0b' }}
                                    title="Chuyển về Nhà Gom"
                                  >
                                    <ArrowRightLeft size={13} />
                                  </button>
                                </div>
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

            {/* ────────────────────────────────────────── */}
            {/* 📝 PANEL 2: CTV PROFILE & COMMISSION POLICY */}
            {/* ────────────────────────────────────────── */}
            {activeDetailTab === 'policy' && (
              <form onSubmit={handleSaveSelectedCtv} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Section 1: Basic Identity & Bank Account */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={15} /> 1. THÔNG TIN ĐỊNH DANH & LIÊN HỆ CTV
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12 }}>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Mã CTV *</label>
                      <input
                        type="text"
                        value={editingCtvForm.code}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, code: e.target.value.toUpperCase() })}
                        className="input-field mono"
                        style={{ fontWeight: 800 }}
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Họ Tên Cộng Tác Viên *</label>
                      <input
                        type="text"
                        value={editingCtvForm.name}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, name: e.target.value })}
                        className="input-field"
                        style={{ fontWeight: 700 }}
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Trạng Thái Hoạt Động</label>
                      <select
                        value={editingCtvForm.active ? 'active' : 'inactive'}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, active: e.target.value === 'active' })}
                        className="input-field"
                        style={{ fontWeight: 700 }}
                      >
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm ngừng</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Số Điện Thoại</label>
                      <input
                        type="text"
                        value={editingCtvForm.phone || ''}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, phone: e.target.value })}
                        className="input-field"
                        placeholder="VD: 0912345678"
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Email Nhận Báo Cáo Đối Soát</label>
                      <input
                        type="email"
                        value={editingCtvForm.email || ''}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, email: e.target.value })}
                        className="input-field"
                        placeholder="ctv@example.com"
                      />
                    </div>
                  </div>

                  {/* Bank Account */}
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 10, border: '1px solid var(--border-color)', marginTop: 4 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-main)' }}>
                      <CreditCard size={14} color="var(--primary)" /> Tài Khoản Ngân Hàng Nhận Hoa Hồng CTV
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="input-label" style={{ fontSize: 10.5 }}>Ngân Hàng</label>
                        <select
                          value={editingCtvForm.bankAccount?.bankName || 'MB Bank'}
                          onChange={(e) => setEditingCtvForm({
                            ...editingCtvForm,
                            bankAccount: { ...(editingCtvForm.bankAccount || { accountNumber: '', accountHolder: editingCtvForm.name }), bankName: e.target.value }
                          })}
                          className="input-field"
                          style={{ fontSize: 12 }}
                        >
                          {VIETNAM_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: 10.5 }}>Số Tài Khoản</label>
                        <input
                          type="text"
                          value={editingCtvForm.bankAccount?.accountNumber || ''}
                          onChange={(e) => setEditingCtvForm({
                            ...editingCtvForm,
                            bankAccount: { ...(editingCtvForm.bankAccount || { bankName: 'MB Bank', accountHolder: editingCtvForm.name }), accountNumber: e.target.value }
                          })}
                          className="input-field mono"
                          style={{ fontSize: 12, fontWeight: 700 }}
                          placeholder="Nhập số tài khoản..."
                        />
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: 10.5 }}>Chủ Tài Khoản</label>
                        <input
                          type="text"
                          value={editingCtvForm.bankAccount?.accountHolder || ''}
                          onChange={(e) => setEditingCtvForm({
                            ...editingCtvForm,
                            bankAccount: { ...(editingCtvForm.bankAccount || { bankName: 'MB Bank', accountNumber: '' }), accountHolder: e.target.value }
                          })}
                          className="input-field"
                          style={{ fontSize: 12 }}
                          placeholder="Họ và tên..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Commission Policy & Live Calculator */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid rgba(79, 70, 229, 0.25)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Award size={15} /> 2. BẢNG CHÍNH SÁCH HOA HỒNG BẬC CÂN NẶNG (VNĐ / ĐƠN)
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-dim)' }}>
                        Hệ thống tự động cộng hoa hồng cho CTV trên từng đơn phát sinh từ các Shop thuộc CTV này.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const rules = editingCtvForm.commissionRules || [];
                        const lastMax = rules.length > 0 ? rules[rules.length - 1].maxWeight : 0;
                        setEditingCtvForm({
                          ...editingCtvForm,
                          commissionRules: [...rules, { minWeight: lastMax, maxWeight: lastMax + 2, commissionPrice: 2000 }]
                        });
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
                    >
                      + Thêm Bậc Khối Lượng
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(editingCtvForm.commissionRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          step="0.5"
                          value={rule.minWeight}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const rules = [...editingCtvForm.commissionRules];
                            rules[idx].minWeight = val;
                            setEditingCtvForm({ ...editingCtvForm, commissionRules: rules });
                          }}
                          className="input-field"
                          style={{ width: 70, textAlign: 'center', fontSize: 12 }}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.5"
                          value={rule.maxWeight}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const rules = [...editingCtvForm.commissionRules];
                            rules[idx].maxWeight = val;
                            setEditingCtvForm({ ...editingCtvForm, commissionRules: rules });
                          }}
                          className="input-field"
                          style={{ width: 70, textAlign: 'center', fontSize: 12 }}
                        />
                        <span style={{ fontSize: 12 }}>kg:</span>
                        <input
                          type="number"
                          step="500"
                          value={rule.commissionPrice}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const rules = [...editingCtvForm.commissionRules];
                            rules[idx].commissionPrice = val;
                            setEditingCtvForm({ ...editingCtvForm, commissionRules: rules });
                          }}
                          className="input-field"
                          style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#059669' }}
                        />
                        <span style={{ fontSize: 12 }}>VNĐ</span>
                        {editingCtvForm.commissionRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const rules = editingCtvForm.commissionRules.filter((_, i) => i !== idx);
                              setEditingCtvForm({ ...editingCtvForm, commissionRules: rules });
                            }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8, paddingTop: 10, borderTop: '1px dashed rgba(79, 70, 229, 0.2)' }}>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Mỗi nấc vượt cân (kg)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editingCtvForm.extraWeightStep}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, extraWeightStep: parseFloat(e.target.value) || 1 })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 11 }}>Cộng thêm hoa hồng (+ VNĐ / nấc)</label>
                      <input
                        type="number"
                        step="500"
                        value={editingCtvForm.extraWeightPrice}
                        onChange={(e) => setEditingCtvForm({ ...editingCtvForm, extraWeightPrice: parseInt(e.target.value, 10) || 0 })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  {/* Calculator preview */}
                  <div style={{
                    background: 'rgba(79, 70, 229, 0.06)',
                    padding: '10px 14px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 6,
                    border: '1px solid rgba(79, 70, 229, 0.15)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calculator size={16} color="var(--primary)" />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>Thử tính với đơn nặng:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={testWeight}
                        onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0.1)}
                        className="input-field"
                        style={{ width: 65, padding: '3px 6px', textAlign: 'center', fontSize: 12 }}
                      />
                      <span style={{ fontSize: 12 }}>kg</span>
                    </div>

                    <div style={{ fontSize: 12.5 }}>
                      Hoa hồng CTV nhận: <strong className="mono" style={{ color: '#059669', fontSize: 14 }}>
                        {new Intl.NumberFormat('vi-VN').format(StorageService.calculateCtvCommission(editingCtvForm, testWeight, activeCarrierId))} đ
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 800, padding: '8px 22px', background: carrierTheme.gradient, boxShadow: carrierTheme.shadowGlow }}>
                    <Save size={15} /> <span>Lưu Toàn Bộ Cài Đặt CTV</span>
                  </button>
                </div>
              </form>
            )}

            {/* ────────────────────────────────────────── */}
            {/* 📊 PANEL 3: SETTLEMENT & RECONCILIATION */}
            {/* ────────────────────────────────────────── */}
            {activeDetailTab === 'settlement' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Session Selector & Export */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800 }}>Kỳ Đối Soát:</span>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="input-field"
                      style={{ fontWeight: 800, fontSize: 12.5, minWidth: 220 }}
                    >
                      {sessions.length === 0 ? (
                        <option value="">Chưa có kỳ đối soát</option>
                      ) : (
                        sessions.map((sess, sIdx) => (
                          <option key={sess.id} value={sess.id}>
                            {sIdx === 0 ? '🌟 Mới nhất: ' : ''}{sess.sessionName}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCtvExcel}
                    disabled={ctvSessionOrders.length === 0}
                    className="btn btn-primary btn-sm"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: carrierTheme.gradient || 'var(--brand-gradient)',
                      boxShadow: carrierTheme.shadowGlow,
                    }}
                  >
                    <Download size={14} />
                    <span>Xuất Excel Bảng Kê CTV {selectedCtv.name}</span>
                  </button>
                </div>

                {/* 4 Financial KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>TỔNG ĐƠN KHÁCH CTV</div>
                    <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{settlementSummary.totalOrders} đơn</div>
                    <div style={{ fontSize: 10.5, color: '#10b981', marginTop: 2 }}>✓ {settlementSummary.delivered} TC • ✕ {settlementSummary.returned} Hoàn</div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>TỔNG COD THU HỘ</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary)', marginTop: 2 }}>
                      {new Intl.NumberFormat('vi-VN').format(settlementSummary.totalCod)} đ
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>Tiền COD các shop CTV</div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '12px 14px', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>CƯỚC THU TỪ SHOP</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#d97706', marginTop: 2 }}>
                      {new Intl.NumberFormat('vi-VN').format(settlementSummary.totalShopFee)} đ
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>Theo giá CTV cài đặt</div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', border: '1.5px solid #10b981' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#047857' }}>💎 HOA HỒNG CTV NHẬN</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#059669', marginTop: 2 }}>
                      {new Intl.NumberFormat('vi-VN').format(settlementSummary.totalCommission)} đ
                    </div>
                    <div style={{ fontSize: 10.5, color: '#047857', marginTop: 2, fontWeight: 700 }}>Thực nhận kỳ này</div>
                  </div>
                </div>

                {/* Orders table */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{ overflowX: 'auto', maxHeight: '50vh' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1.5px solid var(--border-color)' }}>
                          <th style={{ padding: '8px 10px', width: 40, textAlign: 'center' }}>STT</th>
                          <th style={{ padding: '8px 10px' }}>Mã Vận Đơn</th>
                          <th style={{ padding: '8px 10px' }}>Tên Shop</th>
                          <th style={{ padding: '8px 10px' }}>Người Nhận</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Khối Lượng</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Trạng Thái</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tiền COD</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cước Thu Shop</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontWeight: 800 }}>Hoa Hồng CTV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ctvSessionOrders.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
                              Không có đơn hàng nào của khách thuộc CTV {selectedCtv.name} trong kỳ đối soát này.
                            </td>
                          </tr>
                        ) : (
                          ctvSessionOrders.map((order, idx) => (
                            <tr key={order.id || idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                              <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-dim)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 10px' }}><span className="mono" style={{ fontWeight: 800, color: 'var(--primary)' }}>{order.waybill}</span></td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{order.shopName}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{order.receiverName || '---'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }} className="mono">{order.weight} kg</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  background: order.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: order.status === 'delivered' ? '#10b981' : '#ef4444',
                                }}>
                                  {order.status === 'delivered' ? 'Giao TC' : (order.status === 'returned' ? 'Hoàn' : order.statusText || order.status)}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }} className="mono">{order.codAmount ? `${new Intl.NumberFormat('vi-VN').format(order.codAmount)} đ` : '0 đ'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }} className="mono">{new Intl.NumberFormat('vi-VN').format(order.shopCalculatedFee || 0)} đ</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }} className="mono">+{new Intl.NumberFormat('vi-VN').format(order.ctvCommission || 0)} đ</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', borderRadius: 14 }}>
            Vui lòng chọn hoặc tạo mới một Cộng Tác Viên ở cột bên trái.
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────── */}
      {/* 🏪 MODAL: THÊM / SỬA SHOP CHO CTV */}
      {/* ────────────────────────────────────────── */}
      {isShopModalOpen && editingShop && selectedCtv && (
        <div className="modal-backdrop" onClick={() => setIsShopModalOpen(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '90%', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {editingShop.id.startsWith('shop_') && !shops.some(s => s.id === editingShop.id) ? `Thêm Shop Mới Cho CTV: ${selectedCtv.name}` : `Sửa Shop: ${editingShop.name}`}
                </h3>
                <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>CTV Phụ Trách: <strong>{selectedCtv.name} ({selectedCtv.code})</strong></span>
              </div>
              <button type="button" onClick={() => setIsShopModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveShop}>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Mã Shop *</label>
                    <input
                      type="text"
                      value={editingShop.code}
                      onChange={(e) => setEditingShop({ ...editingShop, code: e.target.value.toUpperCase() })}
                      className="input-field mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Tên Khách Hàng / Shop *</label>
                    <input
                      type="text"
                      value={editingShop.name}
                      onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Số Điện Thoại</label>
                    <input
                      type="text"
                      value={editingShop.phone || ''}
                      onChange={(e) => setEditingShop({ ...editingShop, phone: e.target.value })}
                      className="input-field"
                      placeholder="VD: 0912345678"
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: 11 }}>Email Nhận Bảng Kê</label>
                    <input
                      type="email"
                      value={editingShop.email || ''}
                      onChange={(e) => setEditingShop({ ...editingShop, email: e.target.value })}
                      className="input-field"
                      placeholder="shop@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label" style={{ fontSize: 11 }}>Địa Chỉ Shop</label>
                  <input
                    type="text"
                    value={editingShop.address || ''}
                    onChange={(e) => setEditingShop({ ...editingShop, address: e.target.value })}
                    className="input-field"
                    placeholder="Địa chỉ gửi hàng..."
                  />
                </div>

                {/* Bank Account */}
                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={14} color="var(--primary)" /> Tài Khoản Ngân Hàng Nhận Tiền COD Của Shop
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="input-label" style={{ fontSize: 10.5 }}>Ngân Hàng</label>
                      <select
                        value={editingShop.bankAccount?.bankName || 'MB Bank'}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          bankAccount: { ...(editingShop.bankAccount || { accountNumber: '', accountHolder: editingShop.name }), bankName: e.target.value }
                        })}
                        className="input-field"
                        style={{ fontSize: 12 }}
                      >
                        {VIETNAM_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 10.5 }}>Số Tài Khoản</label>
                      <input
                        type="text"
                        value={editingShop.bankAccount?.accountNumber || ''}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          bankAccount: { ...(editingShop.bankAccount || { bankName: 'MB Bank', accountHolder: editingShop.name }), accountNumber: e.target.value }
                        })}
                        className="input-field mono"
                        style={{ fontSize: 12 }}
                        placeholder="Số tài khoản..."
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 10.5 }}>Chủ Tài Khoản</label>
                      <input
                        type="text"
                        value={editingShop.bankAccount?.accountHolder || ''}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          bankAccount: { ...(editingShop.bankAccount || { bankName: 'MB Bank', accountNumber: '' }), accountHolder: e.target.value }
                        })}
                        className="input-field"
                        style={{ fontSize: 12 }}
                        placeholder="Tên chủ tài khoản..."
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Plan */}
                <div style={{ background: 'rgba(16, 185, 129, 0.04)', padding: 12, borderRadius: 10, border: '1.5px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#047857' }}>💰 Biểu Giá Cước Bán Tính Cho Khách Của CTV (VNĐ)</div>
                    <button
                      type="button"
                      onClick={() => {
                        const rules = editingShop.pricingPlan?.weightRules || [];
                        const lastMax = rules.length > 0 ? rules[rules.length - 1].maxWeight : 0;
                        setEditingShop({
                          ...editingShop,
                          pricingPlan: {
                            ...editingShop.pricingPlan,
                            weightRules: [...rules, { minWeight: lastMax, maxWeight: lastMax + 1, price: 20000 }]
                          }
                        });
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      + Thêm Nấc Cước
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(editingShop.pricingPlan?.weightRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          step="0.5"
                          value={rule.minWeight}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const rules = [...(editingShop.pricingPlan?.weightRules || [])];
                            rules[idx].minWeight = val;
                            setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, weightRules: rules } });
                          }}
                          className="input-field"
                          style={{ width: 65, textAlign: 'center', fontSize: 11.5 }}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          step="0.5"
                          value={rule.maxWeight}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const rules = [...(editingShop.pricingPlan?.weightRules || [])];
                            rules[idx].maxWeight = val;
                            setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, weightRules: rules } });
                          }}
                          className="input-field"
                          style={{ width: 65, textAlign: 'center', fontSize: 11.5 }}
                        />
                        <span style={{ fontSize: 11 }}>kg:</span>
                        <input
                          type="number"
                          step="500"
                          value={rule.price}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const rules = [...(editingShop.pricingPlan?.weightRules || [])];
                            rules[idx].price = val;
                            setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, weightRules: rules } });
                          }}
                          className="input-field"
                          style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: '#047857' }}
                        />
                        <span style={{ fontSize: 11 }}>VNĐ</span>
                        {editingShop.pricingPlan?.weightRules && editingShop.pricingPlan.weightRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const rules = editingShop.pricingPlan.weightRules.filter((_, i) => i !== idx);
                              setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, weightRules: rules } });
                            }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10, paddingTop: 8, borderTop: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                    <div>
                      <label className="input-label" style={{ fontSize: 10.5 }}>Mỗi nấc vượt (kg)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editingShop.pricingPlan?.extraStepWeight || 0.5}
                        onChange={(e) => setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, extraStepWeight: parseFloat(e.target.value) || 0.5 } })}
                        className="input-field"
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 10.5 }}>Cước vượt (+ VNĐ)</label>
                      <input
                        type="number"
                        step="500"
                        value={editingShop.pricingPlan?.extraStepPrice || 2500}
                        onChange={(e) => setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, extraStepPrice: parseInt(e.target.value, 10) || 0 } })}
                        className="input-field"
                        style={{ fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label className="input-label" style={{ fontSize: 10.5 }}>Phí hoàn (% cước)</label>
                      <input
                        type="number"
                        step="5"
                        value={editingShop.pricingPlan?.returnFeePercent || 50}
                        onChange={(e) => setEditingShop({ ...editingShop, pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: parseInt(e.target.value, 10) || 0 } })}
                        className="input-field"
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setIsShopModalOpen(false)} className="btn btn-secondary btn-sm">Hủy</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 800 }}><Check size={14} /> <span>Lưu Shop Cho CTV</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────── */}
      {/* 🤝 MODAL: GÁN SHOP TỪ NHÀ GOM SANG CTV */}
      {/* ────────────────────────────────────────── */}
      {isAssignModalOpen && selectedCtv && (
        <div className="modal-backdrop" onClick={() => setIsAssignModalOpen(false)} style={{ zIndex: 1100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '90%', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Gán Khách Hàng Cho CTV: {selectedCtv.name}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>Chọn các Shop trực tiếp của Nhà Gom để chuyển giao quản lý cho CTV này.</p>
              </div>
              <button type="button" onClick={() => setIsAssignModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
              {unassignedShops.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
                  Không có Shop nào chưa được gán CTV. Tất cả các Shop đã có người phụ trách.
                </div>
              ) : (
                unassignedShops.map(s => {
                  const isChecked = selectedUnassignedShopIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: isChecked ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                        background: isChecked ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUnassignedShopIds([...selectedUnassignedShopIds, s.id]);
                          } else {
                            setSelectedUnassignedShopIds(selectedUnassignedShopIds.filter(id => id !== s.id));
                          }
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{s.name} <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>({s.code})</span></div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>SĐT: {s.phone || '---'} • {s.address || 'Chưa có địa chỉ'}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Đã chọn: <strong>{selectedUnassignedShopIds.length}</strong> shop
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="btn btn-secondary btn-sm">Hủy</button>
                <button
                  type="button"
                  onClick={handleAssignShopsToCtv}
                  disabled={selectedUnassignedShopIds.length === 0}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 800 }}
                >
                  <Check size={14} /> <span>Gán Ngay Cho {selectedCtv.name}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

