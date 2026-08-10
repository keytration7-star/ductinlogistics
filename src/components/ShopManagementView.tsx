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
  Sliders
} from 'lucide-react';
import type { Shop, WeightStepRule, UserAccount } from '../types';
import { calculateWeightFee } from '../services/reconciliationService';

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

  const [testWeight, setTestWeight] = useState<number>(1.5);

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

    </div>
  );
};
