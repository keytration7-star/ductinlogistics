import React, { useState, useEffect, useRef } from 'react';
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
  Ban
} from 'lucide-react';
import type { Shop, WeightStepRule, UserAccount, ReconciliationSession } from '../types';
import { calculateWeightFee, detectUnregisteredShopsFromOrders } from '../services/reconciliationService';
import type { DetectedNewShop } from '../services/reconciliationService';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';
import { normalizeHeader } from '../services/smartColumnDetector';

interface ShopManagementViewProps {
  shops: Shop[];
  onSaveShops: (shops: Shop[]) => void;
  currentUser?: UserAccount;
  sourceSession?: ReconciliationSession | null;
}

import { VIETNAM_BANKS as FULL_VIETNAM_BANKS } from '../constants/banks';

const VIETNAM_BANKS = FULL_VIETNAM_BANKS.map(b => b.shortName);

export const ShopManagementView: React.FC<ShopManagementViewProps> = ({ shops, onSaveShops, currentUser, sourceSession }) => {
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

  // File Scanning Handler for New Shop Auto-Detection
  const handleScanExcelFileForNewShops = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      showToast('Chỉ Admin được quét và đề xuất đăng ký shop mới.', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const { rows } = await ExcelService.parseExcelFile(file);
      const orders = rows.map(r => ({
        shopName: String(r['Tên Shop'] || r['Shop'] || r['Store'] || r['Tên cửa hàng'] || r['Tên Kho'] || r['Nguoi_Gui'] || ''),
        shopCode: String(r['Mã Shop'] || r['Store ID'] || r['Mã Kho'] || ''),
        shopPhone: String(r['SĐT Shop'] || r['SĐT'] || r['Phone'] || r['SĐT Gửi'] || ''),
        shopAddress: String(r['Địa Chỉ'] || r['Địa chỉ gửi'] || ''),
        nvcCod: Number(r['Tiền COD'] || r['COD'] || r['Thu Hộ'] || 0),
      }));

      const detected = detectUnregisteredShopsFromOrders(orders, shops);
      setDetectedNewShops(detected);
      setIsScanModalOpen(true);
      if (detected.length === 0) {
        showToast('Tất cả Shop trong file Excel đã có sẵn trong hệ thống!', 'info');
      } else {
        showToast(`Nhận diện thành công ${detected.length} Shop mới!`, 'success');
      }
    } catch (err: any) {
      showToast('Lỗi khi đọc file Excel: ' + (err.message || err), 'warning');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Register All Detected Shops
  const handleRegisterAllDetectedShops = () => {
    if (detectedNewShops.length === 0) return;
    if (!isAdmin) {
      showToast('Chỉ Admin được phép đăng ký shop mới.', 'warning');
      return;
    }

    const defaultPricingPlan = {
      id: `plan_default_${Date.now()}`,
      name: 'Bảng giá Tiêu chuẩn',
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

    const newShopsList: Shop[] = detectedNewShops.map((d, i) => ({
      id: `shop_auto_${Date.now()}_${i}`,
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
      pricingPlan: JSON.parse(JSON.stringify(defaultPricingPlan)),
      notes: `Đã tự động nhận diện từ file Excel (${d.orderCount} đơn)`,
      createdAt: new Date().toISOString(),
      active: true,
    }));

    const updated = [...newShopsList, ...shops];
    onSaveShops(updated);
    showToast(`Đã tự động thêm ${newShopsList.length} Shop mới vào hệ thống!`, 'success');
    setIsScanModalOpen(false);
    setDetectedNewShops([]);
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
          <h2 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Store size={24} color="var(--primary)" />
            Quản Lý Danh Sách Shop & Biểu Giá Riêng
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Giao diện 2 bảng trực quan: Chọn Shop ở danh sách bên trái để xem và chỉnh sửa thông tin chi tiết live ở bảng bên phải.
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleCreateNewShop}
                className="btn btn-primary btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Plus size={14} />
                <span>+ Thêm Shop Mới</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary btn-sm"
                disabled={isScanning || !isAdmin}
                style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                title="Bóc tách tự động tên, SĐT, địa chỉ Shop mới từ file Excel"
              >
                <Zap size={14} color="var(--warning)" />
                <span>{isScanning ? 'Đang quét...' : '⚡ Quét File'}</span>
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

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Danh Sách Shop ({filteredShops.length})
          </div>

          {/* Scrollable Shop List */}
          <div style={{
            maxHeight: 'calc(100vh - 240px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingRight: 2,
          }}>
            {filteredShops.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                Không tìm thấy Shop nào. Bấm <strong>+ Thêm Shop Mới</strong> hoặc <strong>⚡ Quét File</strong>.
              </div>
            ) : (
              filteredShops.map((shop) => {
                const isSelected = selectedShopId === shop.id;
                return (
                  <div
                    key={shop.id}
                    onClick={() => handleSelectShop(shop)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 12,
                      border: isSelected ? '1.5px solid var(--primary)' : '1.5px solid rgba(226, 232, 240, 0.9)',
                      borderLeft: isSelected ? '5px solid var(--primary)' : '1.5px solid rgba(226, 232, 240, 0.9)',
                      background: isSelected ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%)' : '#ffffff',
                      boxShadow: isSelected ? '0 8px 18px -4px rgba(79, 70, 229, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)' : '0 4px 10px -2px rgba(15, 23, 42, 0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--primary)' : 'var(--bg-tertiary)',
                      color: isSelected ? '#fff' : 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                      flexShrink: 0,
                    }}>
                      {shop.code.slice(0, 4)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <strong style={{ fontSize: 13, color: isSelected ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shop.name}
                        </strong>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', flexShrink: 0 }}>
                          {shop.code}
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={10} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shop.phone || 'Chưa có SĐT'}
                        </span>
                      </div>

                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📍 {shop.address || 'Toàn quốc'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 👉 RIGHT PANEL: BẢNG CHI TIẾT & SỬA TRỰC TIẾP (LIVE REVIEW & EDITOR) */}
        {editingShop ? (
          <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            
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
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{editingShop.name || 'Shop chưa đặt tên'}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tên Shop / Nhãn Gửi (*)</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gõ tên shop (Nếu có nhiều nhãn gửi khác nhau, gõ phân cách bằng dấu phẩy)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: HNACH-MAT, HNACH MAT..."
                    value={[editingShop.name, ...(editingShop.nameAliases || [])].filter(Boolean).join(', ')}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const parts = raw.split(/[,;\n]+/).map(v => v.trim());
                      // Keep trailing spaces while typing single name
                      const mainName = parts[0] || '';
                      const aliases = parts.slice(1).filter(Boolean);
                      setEditingShop({
                        ...editingShop,
                        name: mainName,
                        nameAliases: aliases
                      });
                    }}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Mã Shop (Duy nhất)</label>
                  <input
                    type="text"
                    placeholder="SHOP_A, MINA..."
                    value={editingShop.code}
                    onChange={(e) => setEditingShop({ ...editingShop, code: e.target.value.toUpperCase() })}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Số điện thoại gửi (*)</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Nhập nhiều SĐT cách dấu phẩy ","</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0912345678, 0987654321..."
                    value={editingShop.phone}
                    onChange={(e) => setEditingShop({ ...editingShop, phone: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Email nhận đối soát (có thể gõ nhiều mail cách phẩy)</label>
                  <input
                    type="text"
                    placeholder="shop@gmail.com, ketoan@gmail.com..."
                    value={editingShop.email}
                    onChange={(e) => setEditingShop({ ...editingShop, email: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Cộng Tác Viên (CTV) Quản Lý</label>
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
                  <label className="input-label">Công nợ cũ còn tồn (-/+ VNĐ)</label>
                  <input
                    type="number"
                    placeholder="0 (-500000 nếu Shop nợ)"
                    value={editingShop.previousDebt ?? ''}
                    onChange={(e) => setEditingShop({ ...editingShop, previousDebt: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginTop: 10 }}>
                <label className="input-label">Địa chỉ kho gửi hàng</label>
                <input
                  type="text"
                  placeholder="Số 123 đường ABC, Quận XYZ, Hà Nội"
                  value={editingShop.address}
                  onChange={(e) => setEditingShop({ ...editingShop, address: e.target.value })}
                  className="input-field"
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
                    <label className="input-label">Tên Ngân hàng</label>
                    <select
                      value={editingShop.bankAccount.bankName}
                      onChange={(e) => setEditingShop({
                        ...editingShop,
                        bankAccount: { ...editingShop.bankAccount, bankName: e.target.value }
                      })}
                      className="select-field"
                    >
                      {VIETNAM_BANKS.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Số tài khoản</label>
                    <input
                      type="text"
                      placeholder="091234567899"
                      value={editingShop.bankAccount.accountNumber}
                      onChange={(e) => setEditingShop({
                        ...editingShop,
                        bankAccount: { ...editingShop.bankAccount, accountNumber: e.target.value }
                      })}
                      className="input-field mono"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Tên chủ tài khoản</label>
                    <input
                      type="text"
                      placeholder="NGUYEN VAN A"
                      value={editingShop.bankAccount.accountHolder}
                      onChange={(e) => setEditingShop({
                        ...editingShop,
                        bankAccount: { ...editingShop.bankAccount, accountHolder: e.target.value.toUpperCase() }
                      })}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Live VietQR Preview */}
                <div style={{ textAlign: 'center' }}>
                  {editingShop.bankAccount?.accountNumber ? (
                    <>
                      <img
                        src={`https://img.vietqr.io/image/${editingShop.bankAccount.bankName.replace(/\s+/g, '')}-${editingShop.bankAccount.accountNumber}-compact.png?addInfo=Doi%20soat%20shop%20${editingShop.code}&accountName=${encodeURIComponent(editingShop.bankAccount.accountHolder || editingShop.name)}`}
                        alt="VietQR Code"
                        style={{ width: 110, height: 110, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#fff', padding: 4 }}
                      />
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Mã VietQR Chuyển Khoản</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      Gõ STK để xem VietQR Live
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
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg:</span>
                    
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        step="500"
                        placeholder="0"
                        value={rule.price === 0 ? '' : rule.price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleWeightRuleChange(idx, 'price', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
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
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          pricingPlan: { ...editingShop.pricingPlan, extraStepWeight: parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 1 }
                        })}
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                      <span style={{ fontSize: 11 }}>kg</span>
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
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                      <span style={{ fontSize: 11 }}>đ</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Phí chuyển hoàn (%)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingShop.pricingPlan.returnFeePercent}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingShop({
                          ...editingShop,
                          pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0 }
                        })}
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: 12, width: 60 }}
                      />
                      <span style={{ fontSize: 11 }}>%</span>
                      
                      <div style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
                        <button
                          type="button"
                          onClick={() => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: 0 }
                          })}
                          className={`btn btn-sm ${editingShop.pricingPlan.returnFeePercent === 0 ? 'btn-success' : 'btn-secondary'}`}
                          style={{ padding: '2px 5px', fontSize: 10 }}
                        >
                          0%
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: 50 }
                          })}
                          className={`btn btn-sm ${editingShop.pricingPlan.returnFeePercent === 50 ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '2px 5px', fontSize: 10 }}
                        >
                          50%
                        </button>
                      </div>
                    </div>
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

      {/* 🌟 MODAL: QUÉT & ĐĂNG KÝ SHOP MỚI TỰ ĐỘNG TỪ FILE EXCEL */}
      {isScanModalOpen && (
        <div className="modal-overlay" onClick={() => setIsScanModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap size={22} color="var(--warning)" />
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800 }}>Kết Quả Nhận Diện Shop Mới</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Phát hiện <strong style={{ color: 'var(--primary)' }}>{detectedNewShops.length} Shop mới</strong>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setIsScanModalOpen(false)} className="btn btn-secondary btn-sm">
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {detectedNewShops.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                  Tất cả các Shop trong file Excel đều đã được đăng ký sẵn trong hệ thống!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-main)', background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed var(--warning)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                    ⚡ <strong>Thông tin đề xuất từ file Excel:</strong> Hệ thống bóc tách <strong>Tên người gửi, SĐT người gửi, địa chỉ kho gửi</strong>. Hãy kiểm tra, bổ sung Email/STK rồi mới đăng ký. App không tự tạo shop và các đơn vẫn được treo đến khi đối soát lại.
                  </div>

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Tên & SĐT Người Gửi (Quét File)</th>
                        <th>Địa Chỉ Gửi</th>
                        <th>Email Đối Soát</th>
                        <th>Ngân Hàng & STK</th>
                        <th>Số Đơn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedNewShops.map((item, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong style={{ color: 'var(--text-main)', fontSize: 12 }}>{item.name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--primary)' }}>SĐT: <strong>{item.phone || 'Chưa có'}</strong></div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Mã: <span className="mono">{item.code}</span></div>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.address || 'Toàn quốc'}
                          </td>
                          <td>
                            <input
                              type="email"
                              placeholder="Nhập email..."
                              value={item.email || ''}
                              onChange={(e) => {
                                const updated = [...detectedNewShops];
                                updated[idx] = { ...updated[idx], email: e.target.value };
                                setDetectedNewShops(updated);
                              }}
                              className="input-field"
                              style={{ padding: '3px 6px', fontSize: 11, width: 130 }}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <select
                                value={item.bankName || 'MB Bank'}
                                onChange={(e) => {
                                  const updated = [...detectedNewShops];
                                  updated[idx] = { ...updated[idx], bankName: e.target.value };
                                  setDetectedNewShops(updated);
                                }}
                                className="select-field"
                                style={{ padding: '2px 4px', fontSize: 10, width: 95 }}
                              >
                                {VIETNAM_BANKS.map(b => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                              </select>
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
                                style={{ padding: '3px 6px', fontSize: 11, width: 110 }}
                              />
                            </div>
                          </td>
                          <td className="mono" style={{ fontWeight: 700, fontSize: 11 }}>
                            {item.orderCount} đơn
                            <div style={{ fontSize: 10, color: 'var(--success)' }}>
                              {new Intl.NumberFormat('vi-VN').format(item.totalCod)} đ
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setIsScanModalOpen(false)} className="btn btn-secondary">
                Đóng
              </button>
              {detectedNewShops.length > 0 && (
                <button type="button" onClick={handleRegisterAllDetectedShops} className="btn btn-primary" disabled={!isAdmin}>
                  <Check size={16} />
                  <span>➕ Đăng Ký Tất Cả {detectedNewShops.length} Shop Mới</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
