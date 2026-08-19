import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import type { CtvProfile, CtvCommissionRule } from '../types';
import { Users, Plus, Edit2, Trash2, Check, X, DollarSign, Award, Search, Truck, CreditCard, Calculator } from 'lucide-react';
import { useToast, useConfirm } from './UIFeedback';

const AVAILABLE_CARRIERS = [
  { id: 'ALL', name: '🌐 Tất Cả Hãng Vận Chuyển' },
  { id: 'jnt', name: '📦 J&T Express' },
  { id: 'spx', name: '⚡ Shopee Express (SPX)' },
  { id: 'ghn', name: '🚀 Giao Hàng Nhanh (GHN)' },
  { id: 'ghtk', name: '🛵 Giao Hàng Tiết Kiệm (GHTK)' },
  { id: 'vtp', name: '📮 Viettel Post' },
  { id: 'nlj', name: '🦁 Ninjavan' },
];

import { VIETNAM_BANKS as FULL_VIETNAM_BANKS } from '../constants/banks';

const VIETNAM_BANKS = FULL_VIETNAM_BANKS.map(b => b.shortName);

export const CtvManagementView: React.FC = () => {
  const [ctvs, setCtvs] = useState<CtvProfile[]>(() => StorageService.getCtvs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCtv, setEditingCtv] = useState<CtvProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [testWeight, setTestWeight] = useState<number>(1.5);
  const [testCarrierId, setTestCarrierId] = useState<string>('jnt');

  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const handleOpenAdd = () => {
    const newCtv: CtvProfile = {
      id: `ctv_${Date.now()}`,
      code: `CTV_${(ctvs.length + 1).toString().padStart(2, '0')}`,
      name: '',
      phone: '',
      email: '',
      notes: '',
      assignedCarriers: ['ALL'],
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
    setEditingCtv(newCtv);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ctv: CtvProfile) => {
    const ctvCopy: CtvProfile = JSON.parse(JSON.stringify(ctv));
    if (!ctvCopy.assignedCarriers || ctvCopy.assignedCarriers.length === 0) {
      ctvCopy.assignedCarriers = ['ALL'];
    }
    if (!ctvCopy.bankAccount) {
      ctvCopy.bankAccount = { bankName: 'MB Bank', accountNumber: '', accountHolder: ctvCopy.name };
    }
    setEditingCtv(ctvCopy);
    setIsModalOpen(true);
  };

  const handleDelete = async (ctvId: string, name: string) => {
    const ok = await showConfirm({
      title: 'Xóa Cộng Tác Viên',
      message: `Bạn có chắc chắn muốn xóa Cộng Tác Viên "${name}" không?`,
      danger: true,
    });
    if (!ok) return;

    const updated = ctvs.filter(c => c.id !== ctvId);
    setCtvs(updated);
    StorageService.saveCtvs(updated);
    showToast(`Đã xóa CTV ${name}`, 'success');
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCtv) return;

    if (!editingCtv.name.trim()) {
      showToast('Vui lòng nhập tên Cộng tác viên', 'warning');
      return;
    }

    const index = ctvs.findIndex(c => c.id === editingCtv.id);
    let updated: CtvProfile[];
    if (index >= 0) {
      updated = [...ctvs];
      updated[index] = editingCtv;
    } else {
      updated = [editingCtv, ...ctvs];
    }

    setCtvs(updated);
    StorageService.saveCtvs(updated);
    setIsModalOpen(false);
    setEditingCtv(null);
    showToast('Đã lưu cấu hình Cộng tác viên', 'success');
  };

  const handleAddRule = () => {
    if (!editingCtv) return;
    const rules = editingCtv.commissionRules || [];
    const lastMax = rules.length > 0 ? rules[rules.length - 1].maxWeight : 0;
    const newRule: CtvCommissionRule = {
      minWeight: lastMax,
      maxWeight: lastMax + 2,
      commissionPrice: 2000,
    };
    setEditingCtv({
      ...editingCtv,
      commissionRules: [...rules, newRule],
    });
  };

  const handleRemoveRule = (index: number) => {
    if (!editingCtv) return;
    const rules = [...(editingCtv.commissionRules || [])];
    rules.splice(index, 1);
    setEditingCtv({ ...editingCtv, commissionRules: rules });
  };

  const handleRuleChange = (index: number, field: keyof CtvCommissionRule, val: number) => {
    if (!editingCtv) return;
    const rules = [...(editingCtv.commissionRules || [])];
    rules[index] = { ...rules[index], [field]: val };
    setEditingCtv({ ...editingCtv, commissionRules: rules });
  };

  const toggleCarrierAssignment = (carrierId: string) => {
    if (!editingCtv) return;
    let current = editingCtv.assignedCarriers || ['ALL'];

    if (carrierId === 'ALL') {
      current = ['ALL'];
    } else {
      current = current.filter(c => c !== 'ALL');
      if (current.includes(carrierId)) {
        current = current.filter(c => c !== carrierId);
      } else {
        current.push(carrierId);
      }
      if (current.length === 0) current = ['ALL'];
    }

    setEditingCtv({
      ...editingCtv,
      assignedCarriers: current,
    });
  };

  const filteredCtvs = ctvs.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award color="var(--primary)" size={24} />
            <span>Quản Lý Cộng Tác Viên (CTV) & Phân Quyền Theo Hãng Vận Chuyển</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            Phân bổ CTV phụ trách từng bên vận chuyển (J&T, SPX, GHN...) hoặc toàn bộ các bên, cùng bảng tính hoa hồng bậc cân nặng riêng.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={16} />
          <span>Thêm CTV Mới</span>
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
        <Search size={18} color="var(--text-dim)" />
        <input
          type="text"
          placeholder="Tìm theo Mã CTV, Tên, Số điện thoại..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%', outline: 'none', fontSize: 14 }}
        />
      </div>

      {/* Table */}
      <div className="table-container glass-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã CTV</th>
              <th>Họ Và Tên & Liên Hệ</th>
              <th>Hãng Vận Chuyển Phụ Trách</th>
              <th>Tài Khoản Nhận Hoa Hồng</th>
              <th>Bảng Hoa Hồng Bậc Cân Nặng</th>
              <th>Trạng Thái</th>
              <th style={{ textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredCtvs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                  Chưa có Cộng tác viên nào. Bấm "Thêm CTV Mới" để tạo.
                </td>
              </tr>
            ) : (
              filteredCtvs.map((ctv) => {
                const assigned = ctv.assignedCarriers || ['ALL'];
                const isAll = assigned.includes('ALL');

                return (
                  <tr key={ctv.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'rgba(79,70,229,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                        {ctv.code}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{ctv.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📞 {ctv.phone || 'Chưa có SĐT'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>✉️ {ctv.email || 'Chưa có email'}</div>
                    </td>

                    <td>
                      {isAll ? (
                        <span className="badge badge-success" style={{ fontSize: 11 }}>
                          🌐 Tất Cả Hãng Vận Chuyển
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {assigned.map(cId => {
                            const found = AVAILABLE_CARRIERS.find(ac => ac.id === cId);
                            return (
                              <span key={cId} className="badge badge-neutral" style={{ fontSize: 10 }}>
                                {found ? found.name : cId.toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td>
                      {ctv.bankAccount?.bankName && ctv.bankAccount?.accountNumber ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{ctv.bankAccount.bankName}</div>
                          <div className="mono" style={{ fontSize: 12, color: 'var(--primary)' }}>{ctv.bankAccount.accountNumber}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{ctv.bankAccount.accountHolder}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa cập nhật STK</span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                        {(ctv.commissionRules || []).map((r, i) => (
                          <div key={i} style={{ color: 'var(--text-secondary)' }}>
                            • <b>{r.minWeight}kg - {r.maxWeight}kg</b>: <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{r.commissionPrice.toLocaleString('vi-VN')} đ/đơn</span>
                          </div>
                        ))}
                        {ctv.extraWeightPrice > 0 && (
                          <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 11 }}>
                            + Mỗi {ctv.extraWeightStep}kg sau: +{ctv.extraWeightPrice.toLocaleString('vi-VN')} đ/kg
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: ctv.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: ctv.active ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {ctv.active ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <button onClick={() => handleOpenEdit(ctv)} className="btn btn-secondary btn-sm" title="Sửa thông tin CTV">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(ctv.id, ctv.name)} className="btn btn-danger btn-sm" title="Xóa CTV">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && editingCtv && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Award size={20} color="var(--primary)" />
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>
                    {editingCtv.id ? `Cấu hình CTV: ${editingCtv.name || editingCtv.code}` : 'Thêm Cộng Tác Viên Mới'}
                  </h3>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
                {/* 1. THÔNG TIN CƠ BẢN */}
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} /> 1. THÔNG TIN CƠ BẢN CỘNG TÁC VIÊN
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Mã CTV (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="CTV_01, CTV_MINH..."
                      value={editingCtv.code}
                      onChange={(e) => setEditingCtv({ ...editingCtv, code: e.target.value.toUpperCase() })}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Họ Và Tên CTV (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn Minh"
                      value={editingCtv.name}
                      onChange={(e) => setEditingCtv({ ...editingCtv, name: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Số điện thoại (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="0912345678"
                      value={editingCtv.phone}
                      onChange={(e) => setEditingCtv({ ...editingCtv, phone: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Email liên hệ</label>
                    <input
                      type="email"
                      placeholder="ctv@gmail.com"
                      value={editingCtv.email || ''}
                      onChange={(e) => setEditingCtv({ ...editingCtv, email: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* 2. PHÂN QUYỀN HÃNG VẬN CHUYỂN PHỤ TRÁCH */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Truck size={16} /> 2. HÃNG VẬN CHUYỂN PHỤ TRÁCH (PHẠM VI TÍNH HOA HỒNG)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    CTV chỉ được nhận hoa hồng đối với các đơn hàng thuộc hãng vận chuyển mà họ phụ trách bên dưới:
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {AVAILABLE_CARRIERS.map(c => {
                      const isChecked = (editingCtv.assignedCarriers || ['ALL']).includes(c.id);
                      return (
                        <label
                          key={c.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: isChecked ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            background: isChecked ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-secondary)',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: isChecked ? 700 : 400,
                            color: isChecked ? 'var(--primary)' : 'var(--text-main)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCarrierAssignment(c.id)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3. TÀI KHOẢN NGÂN HÀNG & VIETQR */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <CreditCard size={16} /> 3. TÀI KHOẢN NGÂN HÀNG NHẬN HOA HỒNG & VIETQR LIVE
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(79, 70, 229, 0.05) 100%)',
                    padding: 14,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px',
                    gap: 14,
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <div className="input-group">
                        <label className="input-label">Tên Ngân hàng</label>
                        <select
                          value={editingCtv.bankAccount?.bankName || 'MB Bank'}
                          onChange={(e) => setEditingCtv({
                            ...editingCtv,
                            bankAccount: { ...editingShopBankAccount(editingCtv), bankName: e.target.value }
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
                          placeholder="STK nhận tiền hoa hồng..."
                          value={editingCtv.bankAccount?.accountNumber || ''}
                          onChange={(e) => setEditingCtv({
                            ...editingCtv,
                            bankAccount: { ...editingShopBankAccount(editingCtv), accountNumber: e.target.value }
                          })}
                          className="input-field mono"
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Tên chủ tài khoản</label>
                        <input
                          type="text"
                          placeholder="NGUYEN VAN A"
                          value={editingCtv.bankAccount?.accountHolder || ''}
                          onChange={(e) => setEditingCtv({
                            ...editingCtv,
                            bankAccount: { ...editingShopBankAccount(editingCtv), accountHolder: e.target.value.toUpperCase() }
                          })}
                          className="input-field"
                        />
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      {editingCtv.bankAccount?.accountNumber ? (
                        <>
                          <img
                            src={`https://img.vietqr.io/image/${(editingCtv.bankAccount.bankName || 'MBBank').replace(/\s+/g, '')}-${editingCtv.bankAccount.accountNumber}-compact.png?addInfo=Hoa%20hong%20CTV%20${editingCtv.code}&accountName=${encodeURIComponent(editingCtv.bankAccount.accountHolder || editingCtv.name)}`}
                            alt="VietQR Code"
                            style={{ width: 100, height: 100, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: '#fff', padding: 3 }}
                          />
                          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Mã VietQR CTV</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>Gõ STK xem VietQR Live</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. BẢNG HOA HỒNG CHI TẢI THEO BẬC CÂN NẶNG */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DollarSign size={16} /> 4. BẢNG HOA HỒNG CHI TẢI THEO BẬC CÂN NẶNG (VNĐ / ĐƠN)
                    </span>
                    <button type="button" onClick={handleAddRule} className="btn btn-secondary btn-sm">
                      <Plus size={14} /> Thêm Bậc Cân
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(editingCtv.commissionRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 40px', gap: 10, alignItems: 'center', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Từ (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.minWeight}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleRuleChange(idx, 'minWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0)}
                            className="input-field"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Đến (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.maxWeight}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleRuleChange(idx, 'maxWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0)}
                            className="input-field"
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Hoa hồng chia CTV (VNĐ / Đơn)</label>
                          <input
                            type="number"
                            step="500"
                            placeholder="0"
                            value={rule.commissionPrice === 0 ? '' : rule.commissionPrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleRuleChange(idx, 'commissionPrice', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                            className="input-field"
                            style={{ padding: '6px 10px', fontSize: 13, fontWeight: 700, color: 'var(--success)' }}
                          />
                        </div>

                        <div style={{ paddingTop: 16, textAlign: 'center' }}>
                          <button type="button" onClick={() => handleRemoveRule(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: 'var(--bg-secondary)', padding: 14, borderRadius: 8, border: '1px dashed var(--border-color)', marginTop: 10 }}>
                    <div className="input-group">
                      <label className="input-label">Mỗi nấc cân vượt (kg)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editingCtv.extraWeightStep}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingCtv({ ...editingCtv, extraWeightStep: parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 1 })}
                        className="input-field"
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Cộng thêm hoa hồng (+ VNĐ / kg)</label>
                      <input
                        type="number"
                        step="500"
                        placeholder="0"
                        value={editingCtv.extraWeightPrice === 0 ? '' : editingCtv.extraWeightPrice}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingCtv({ ...editingCtv, extraWeightPrice: parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0 })}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. THỬ TÍNH HOA HỒNG LIVE */}
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
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Thử tính hoa hồng cho hãng:</span>
                    <select
                      value={testCarrierId}
                      onChange={(e) => setTestCarrierId(e.target.value)}
                      className="select-field"
                      style={{ padding: '2px 6px', fontSize: 11 }}
                    >
                      {AVAILABLE_CARRIERS.map(ac => (
                        <option key={ac.id} value={ac.id}>{ac.name}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 12 }}>với cân nặng:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={testWeight}
                      onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0.1)}
                      className="input-field"
                      style={{ width: 65, padding: '2px 6px', fontSize: 11 }}
                    />
                    <span style={{ fontSize: 12 }}>kg</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hoa hồng CTV nhận:</span>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>
                      {new Intl.NumberFormat('vi-VN').format(StorageService.calculateCtvCommission(editingCtv, testWeight, testCarrierId))} đ
                    </span>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Ghi chú CTV</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú khu vực quản lý, tỷ lệ chia thưởng..."
                    value={editingCtv.notes || ''}
                    onChange={(e) => setEditingCtv({ ...editingCtv, notes: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-tertiary)', flexShrink: 0 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Hủy Bỏ</button>
                <button type="submit" className="btn btn-primary"><Check size={16} /> <span>Lưu CTV</span></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper for Bank Account object fallback
function editingShopBankAccount(ctv: CtvProfile) {
  return ctv.bankAccount || { bankName: 'MB Bank', accountNumber: '', accountHolder: ctv.name };
}
