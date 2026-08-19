import React, { useState } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Store, 
  CreditCard, 
  Calculator, 
  Check, 
  X,
  Sliders,
  Eye,
  Zap,
  Phone,
  Mail,
  MapPin,
  UserCheck
} from 'lucide-react';
import type { Shop, WeightStepRule, UserAccount } from '../types';
import { calculateWeightFee, detectUnregisteredShopsFromOrders } from '../services/reconciliationService';
import type { DetectedNewShop } from '../services/reconciliationService';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';

interface ShopManagementViewProps {
  shops: Shop[];
  onSaveShops: (shops: Shop[]) => void;
  currentUser?: UserAccount;
}

const VIETNAM_BANKS = [
  'MB Bank',
  'Vietcombank',
  'Techcombank',
  'ACB',
  'VPBank',
  'BIDV',
  'Vietinbank',
  'Sacombank',
  'TPBank',
  'HDBank',
  'VIB',
  'SHB',
  'MSB',
  'SeABank',
  'OCB',
  'LienVietPostBank',
  'Khác',
];

export const ShopManagementView: React.FC<ShopManagementViewProps> = ({ shops, onSaveShops, currentUser }) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [viewingShop, setViewingShop] = useState<Shop | null>(null);
  const [detectedNewShops, setDetectedNewShops] = useState<DetectedNewShop[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [testWeight, setTestWeight] = useState<number>(1.5);

  // File Scanning Handler for New Shop Auto-Detection
  const handleScanExcelFileForNewShops = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        showToast(`Nhận diện thành công ${detected.length} Shop mới chưa có trong hệ thống!`, 'success');
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
      email: '',
      address: d.address,
      bankAccount: {
        bankName: 'MB Bank',
        accountNumber: '',
        accountHolder: d.name,
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
  };

  const filteredShops = shops.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAddModal = () => {
    const newShop: Shop = {
      id: `shop_${Date.now()}`,
      code: `SHOP_${shops.length + 1}`,
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
      },
      notes: '',
      createdAt: new Date().toISOString(),
      active: true,
    };
    setEditingShop(newShop);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (shop: Shop) => {
    setEditingShop(JSON.parse(JSON.stringify(shop)));
    setIsModalOpen(true);
  };

  const handleDeleteShop = async (shopId: string, shopName: string) => {
    if (currentUser?.role !== 'ADMIN') {
      await showConfirm({
        title: '🔒 Quyền Quản Trị Viên',
        message: 'Tài khoản Kế toán / Nhân viên không có quyền xóa Shop khỏi hệ thống. Chỉ Admin mới có quyền thực hiện thao tác này.',
        confirmText: 'Đã hiểu',
      });
      return;
    }
    const ok = await showConfirm({
      title: 'Xoá Shop',
      message: `Bạn có chắc chắn muốn xóa shop "${shopName}" khỏi hệ thống?`,
      confirmText: 'Xoá',
      danger: true,
    });
    if (ok) {
      const updated = shops.filter(s => s.id !== shopId);
      onSaveShops(updated);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;

    if (!editingShop.name.trim()) {
      showToast('Vui lòng nhập Tên Shop', 'warning');
      return;
    }

    const index = shops.findIndex(s => s.id === editingShop.id);
    let updatedShops: Shop[];

    if (index >= 0) {
      updatedShops = [...shops];
      updatedShops[index] = editingShop;
    } else {
      updatedShops = [editingShop, ...shops];
    }

    onSaveShops(updatedShops);
    setIsModalOpen(false);
    setEditingShop(null);
  };

  const handleAddWeightRule = () => {
    if (!editingShop) return;
    const currentRules = editingShop.pricingPlan.weightRules;
    const lastRule = currentRules[currentRules.length - 1];
    // Auto-suggest minWeight = previous maxWeight + 0.1, maxWeight = next round number
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Quản Lý Danh Sách Shop & Biểu Giá Riêng</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Mỗi Shop có một biểu giá cước bậc thang riêng theo cân nặng và thông tin tài khoản nhận tiền COD
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm shop, SĐT, mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 36 }}
            />
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleScanExcelFileForNewShops}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            disabled={isScanning}
            style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' }}
          >
            <Zap size={16} color="var(--warning)" />
            <span>{isScanning ? 'Đang Quét File...' : '⚡ Quét Shop Mới Từ File'}</span>
          </button>

          <button onClick={handleOpenAddModal} className="btn btn-primary">
            <Plus size={16} />
            <span>Thêm Shop Mới</span>
          </button>
        </div>
      </div>

      <div className="table-container glass-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã / Tên Shop</th>
              <th>Liên Hệ</th>
              <th>Biểu Giá Cước Từng Mốc</th>
              <th>Tài Khoản Nhận COD</th>
              <th>Ghi Chú</th>
              <th style={{ textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredShops.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  Không tìm thấy Shop nào phù hợp. Bấm "Thêm Shop Mới" để tạo mới.
                </td>
              </tr>
            ) : (
              filteredShops.map((shop) => (
                <tr key={shop.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 13,
                      }}>
                        {shop.code.slice(0, 4)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{shop.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          Mã: <strong className="mono">{shop.code}</strong>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ fontSize: 13 }}>
                      <strong>{shop.phone}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{shop.email || 'Chưa có email'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shop.address || 'Toàn quốc'}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {shop.pricingPlan.weightRules.map((rule, rIdx) => (
                          <span key={rIdx} className="badge badge-neutral" style={{ fontSize: 11 }}>
                            {rule.minWeight}-{rule.maxWeight}kg: <strong style={{ color: 'var(--primary)', marginLeft: 3 }}>{new Intl.NumberFormat('vi-VN').format(rule.price)}đ</strong>
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        Vượt cân: +{new Intl.NumberFormat('vi-VN').format(shop.pricingPlan.extraStepPrice)}đ / {shop.pricingPlan.extraStepWeight}kg • Hoàn {shop.pricingPlan.returnFeePercent}%
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{shop.bankAccount.bankName}</div>
                    <div className="mono" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
                      {shop.bankAccount.accountNumber}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {shop.bankAccount.accountHolder}
                    </div>
                  </td>

                  <td>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {shop.notes || '—'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setViewingShop(shop)}
                        className="btn btn-secondary btn-sm"
                        title="Xem chi tiết thông tin shop & mã VietQR"
                      >
                        <Eye size={14} color="var(--primary)" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(shop)}
                        className="btn btn-secondary btn-sm"
                        title="Chỉnh sửa thông tin & biểu giá"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteShop(shop.id, shop.name)}
                        className="btn btn-danger btn-sm"
                        title="Xóa shop"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && editingShop && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 850, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-tertiary)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Store size={20} color="var(--primary)" />
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                    {editingShop.name ? `Cấu hình: ${editingShop.name}` : 'Thêm Khách Hàng (Shop) Mới'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 6px' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
                
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Store size={16} /> 1. THÔNG TIN CƠ BẢN CỦA SHOP
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Tên Shop / Thương hiệu (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Shop Thời Trang Mina"
                      value={editingShop.name}
                      onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
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
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Số điện thoại gửi (*)</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>Có thể nhập nhiều SĐT cách nhau bằng dấu phẩy "," hoặc "/"</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 0912345678, 0987654321, 0909123456..."
                      value={editingShop.phone}
                      onChange={(e) => setEditingShop({ ...editingShop, phone: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Email nhận đối soát (*)</label>
                    <input
                      type="email"
                      placeholder="shop@gmail.com"
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Địa chỉ kho gửi hàng</label>
                    <input
                      type="text"
                      placeholder="Số 123 đường ABC, Quận XYZ, Hà Nội"
                      value={editingShop.address}
                      onChange={(e) => setEditingShop({ ...editingShop, address: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Công nợ cũ còn tồn (-/+ VNĐ)</label>
                    <input
                      type="number"
                      placeholder="0 (Ví dụ: -500000 nếu Shop nợ, +200000 nếu dư nợ)"
                      value={editingShop.previousDebt ?? ''}
                      onChange={(e) => setEditingShop({ ...editingShop, previousDebt: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  <CreditCard size={16} /> 2. THÔNG TIN TÀI KHOẢN NHẬN TIỀN COD
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Ngân hàng</label>
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
                      className="input-field"
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

                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sliders size={16} /> 3. BIỂU GIÁ CƯỚC BẬC THANG RIÊNG THEO CÂN NẶNG
                  </div>
                  <button
                    type="button"
                    onClick={handleAddWeightRule}
                    className="btn btn-secondary btn-sm"
                  >
                    <Plus size={14} />
                    <span>Thêm Nấc Cân Nặng</span>
                  </button>
                </div>

                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  {editingShop.pricingPlan.weightRules.map((rule, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 140, fontSize: 13, fontWeight: 600 }}>
                        {idx === 0 ? `Từ 0 đến` : `Từ ${rule.minWeight} đến`}
                      </div>
                      <div style={{ width: 110 }}>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={rule.maxWeight}
                          onChange={(e) => handleWeightRuleChange(idx, 'maxWeight', parseFloat(e.target.value) || 1)}
                          className="input-field"
                          style={{ padding: '6px 10px' }}
                        />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kg:</span>
                      
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          step="500"
                          value={rule.price}
                          onChange={(e) => handleWeightRuleChange(idx, 'price', parseInt(e.target.value) || 0)}
                          className="input-field"
                          style={{ padding: '6px 10px' }}
                        />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>VNĐ</span>

                      {editingShop.pricingPlan.weightRules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWeightRule(idx)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '6px 8px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                  }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vượt cân: Mỗi thêm</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <input
                          type="number"
                          step="0.5"
                          value={editingShop.pricingPlan.extraStepWeight}
                          onChange={(e) => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, extraStepWeight: parseFloat(e.target.value) || 1 }
                          })}
                          className="input-field"
                          style={{ padding: '6px 10px' }}
                        />
                        <span style={{ fontSize: 12 }}>kg</span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cước cộng thêm</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <input
                          type="number"
                          step="500"
                          value={editingShop.pricingPlan.extraStepPrice}
                          onChange={(e) => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, extraStepPrice: parseInt(e.target.value) || 0 }
                          })}
                          className="input-field"
                          style={{ padding: '6px 10px' }}
                        />
                        <span style={{ fontSize: 12 }}>đ</span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phí chuyển hoàn (%)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editingShop.pricingPlan.returnFeePercent}
                          onChange={(e) => setEditingShop({
                            ...editingShop,
                            pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: parseInt(e.target.value) || 0 }
                          })}
                          className="input-field"
                          style={{ padding: '6px 10px', width: 70 }}
                        />
                        <span style={{ fontSize: 12 }}>%</span>
                        
                        {/* Quick Presets */}
                        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                          <button
                            type="button"
                            onClick={() => setEditingShop({
                              ...editingShop,
                              pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: 0 }
                            })}
                            className={`btn btn-sm ${editingShop.pricingPlan.returnFeePercent === 0 ? 'btn-success' : 'btn-secondary'}`}
                            style={{ padding: '3px 6px', fontSize: 11 }}
                          >
                            Miễn hoàn (0%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingShop({
                              ...editingShop,
                              pricingPlan: { ...editingShop.pricingPlan, returnFeePercent: 50 }
                            })}
                            className={`btn btn-sm ${editingShop.pricingPlan.returnFeePercent === 50 ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '3px 6px', fontSize: 11 }}
                          >
                            50%
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calculator size={18} color="var(--primary)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Thử tính cước với cân nặng:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={testWeight}
                      onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0.1)}
                      className="input-field"
                      style={{ width: 80, padding: '4px 8px', fontSize: 13 }}
                    />
                    <span style={{ fontSize: 13 }}>kg</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cước tính ra:</span>
                    <span className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
                      {new Intl.NumberFormat('vi-VN').format(calculateWeightFee(testWeight, editingShop.pricingPlan))} đ
                    </span>
                  </div>
                </div>

              </div>

              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                background: 'var(--bg-tertiary)',
                flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy Bỏ
                </button>

                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>Lưu Cấu Hình Shop</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 1: XEM CHI TIẾT SHOP */}
      {viewingShop && (
        <div className="modal-overlay" onClick={() => setViewingShop(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
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
                  {viewingShop.code.slice(0, 4)}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{viewingShop.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Mã Shop: <strong className="mono" style={{ color: 'var(--primary)' }}>{viewingShop.code}</strong> • Ngày tạo: {new Date(viewingShop.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => setViewingShop(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Section 1: Contact & Branch Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={13} /> Số Điện Thoại
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{viewingShop.phone}</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={13} /> Email Đối Soát
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{viewingShop.email || 'Chưa cập nhật'}</div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <UserCheck size={13} /> CTV Quản Lý
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{viewingShop.ctvName || 'Chưa phân công'}</div>
                </div>
              </div>

              {/* Address */}
              <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={13} /> Địa Chỉ Kho Hàng
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-main)' }}>{viewingShop.address || 'Toàn quốc'}</div>
              </div>

              {/* Bank Account & VietQR Code Preview */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(79, 70, 229, 0.06) 100%)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={15} /> Tài Khoản Ngân Hàng Nhận COD (VietQR Ready)
                  </div>
                  {viewingShop.bankAccount?.bankName ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                        {viewingShop.bankAccount.bankName} • <span className="mono">{viewingShop.bankAccount.accountNumber}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        Chủ tài khoản: <strong>{viewingShop.bankAccount.accountHolder}</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--danger)' }}>⚠️ Chưa cập nhật tài khoản ngân hàng</div>
                  )}
                </div>

                {viewingShop.bankAccount?.accountNumber && (
                  <div style={{ textAlign: 'center' }}>
                    <img
                      src={`https://img.vietqr.io/image/${viewingShop.bankAccount.bankName.replace(/\s+/g, '')}-${viewingShop.bankAccount.accountNumber}-compact.png?addInfo=Doi%20soat%20shop%20${viewingShop.code}&accountName=${encodeURIComponent(viewingShop.bankAccount.accountHolder)}`}
                      alt="VietQR Code"
                      style={{ width: 110, height: 110, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: '#fff', padding: 4 }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Quét chuyển khoản nhanh</div>
                  </div>
                )}
              </div>

              {/* Pricing Plan */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sliders size={15} /> Biểu Giá Cước Bậc Thang
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {viewingShop.pricingPlan.weightRules.map((rule, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                      Nấc {idx + 1} ({rule.minWeight}-{rule.maxWeight}kg): <strong style={{ color: 'var(--primary)', marginLeft: 4 }}>{new Intl.NumberFormat('vi-VN').format(rule.price)} đ</strong>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Vượt cân: <strong>+{new Intl.NumberFormat('vi-VN').format(viewingShop.pricingPlan.extraStepPrice)}đ</strong> / {viewingShop.pricingPlan.extraStepWeight}kg • Tỷ lệ phí hoàn: <strong>{viewingShop.pricingPlan.returnFeePercent}%</strong>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 24px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => { const shop = viewingShop; setViewingShop(null); handleOpenEditModal(shop); }} className="btn btn-primary btn-sm">
                <Edit size={14} /> Chỉnh Sửa Shop
              </button>
              <button type="button" onClick={() => setViewingShop(null)} className="btn btn-secondary btn-sm">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL 2: QUÉT & ĐĂNG KÝ SHOP MỚI TỰ ĐỘNG TỪ FILE EXCEL */}
      {isScanModalOpen && (
        <div className="modal-overlay" onClick={() => setIsScanModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
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
                  <h3 style={{ fontSize: 17, fontWeight: 800 }}>Kết Quả Nhận Diện Shop Mới Từ File</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Phát hiện <strong style={{ color: 'var(--primary)' }}>{detectedNewShops.length} Shop mới</strong> chưa có trong hệ thống
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setIsScanModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
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
                  <div style={{ fontSize: 13, color: 'var(--text-main)', background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed var(--warning)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                    ⚡ <strong>Cơ chế tự động:</strong> Bấm nút bên dưới để đăng ký nhanh toàn bộ {detectedNewShops.length} Shop này vào danh sách quản lý với biểu giá cước mặc định. Bạn có thể chỉnh sửa lại biểu giá riêng cho từng Shop bất cứ lúc nào.
                  </div>

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Mã Tạo Tự Động</th>
                        <th>Tên Shop Trong File</th>
                        <th>Số Điện Thoại</th>
                        <th>Địa Chỉ</th>
                        <th>Số Đơn File</th>
                        <th>Tổng COD File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedNewShops.map((item, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td><strong className="mono" style={{ color: 'var(--primary)' }}>{item.code}</strong></td>
                          <td><strong style={{ color: 'var(--text-main)' }}>{item.name}</strong></td>
                          <td style={{ fontSize: 12 }}>{item.phone || 'N/A'}</td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.address || 'N/A'}
                          </td>
                          <td className="mono" style={{ fontWeight: 700 }}>{item.orderCount} đơn</td>
                          <td className="mono" style={{ fontWeight: 700, color: 'var(--success)' }}>
                            {new Intl.NumberFormat('vi-VN').format(item.totalCod)} đ
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
                <button type="button" onClick={handleRegisterAllDetectedShops} className="btn btn-primary">
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
