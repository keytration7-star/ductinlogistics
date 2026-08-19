import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import type { CtvProfile, CtvCommissionRule } from '../types';
import { Users, Plus, Edit2, Trash2, Check, X, DollarSign, Award, Search } from 'lucide-react';
import { useToast, useConfirm } from './UIFeedback';

export const CtvManagementView: React.FC = () => {
  const [ctvs, setCtvs] = useState<CtvProfile[]>(() => StorageService.getCtvs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCtv, setEditingCtv] = useState<CtvProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
      commissionRules: [
        { minWeight: 0, maxWeight: 1, commissionPrice: 500 },
        { minWeight: 1, maxWeight: 3, commissionPrice: 2000 },
        { minWeight: 3, maxWeight: 5, commissionPrice: 5000 },
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
    setEditingCtv(JSON.parse(JSON.stringify(ctv)));
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
            <span>Quản Lý Cộng Tác Viên (CTV) & Bảng Hoa Hồng</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            Quản lý danh sách CTV, cài đặt hoa hồng chia theo bậc cân nặng cho từng cộng tác viên
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
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã CTV</th>
              <th>Họ Và Tên</th>
              <th>Số Điện Thoại</th>
              <th>Email</th>
              <th>Bảng Hoa Hồng Bậc Cân NẶng</th>
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
              filteredCtvs.map((ctv) => (
                <tr key={ctv.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'rgba(79,70,229,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                      {ctv.code}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ctv.name}</td>
                  <td>{ctv.phone || '-'}</td>
                  <td>{ctv.email || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      {(ctv.commissionRules || []).map((r, i) => (
                        <div key={i} style={{ color: 'var(--text-secondary)' }}>
                          • <b>{r.minWeight}kg - {r.maxWeight}kg</b>: <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{r.commissionPrice.toLocaleString('vi-VN')} đ/đơn</span>
                        </div>
                      ))}
                      {ctv.extraWeightPrice > 0 && (
                        <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <button onClick={() => handleOpenEdit(ctv)} className="btn btn-secondary btn-sm" title="Sửa CTV">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleDelete(ctv.id, ctv.name)} className="btn btn-danger btn-sm" title="Xóa CTV">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && editingCtv && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={16} /> 1. THÔNG TIN CƠ BẢN CỘNG TÁC VIÊN
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
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

                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DollarSign size={16} /> 2. BẢNG HOA HỒNG CHI TẢI THEO BẬC CÂN NẶNG
                  </span>
                  <button type="button" onClick={handleAddRule} className="btn btn-secondary btn-sm">
                    <Plus size={14} /> Thêm Bậc Cân
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(editingCtv.commissionRules || []).map((rule, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 40px', gap: 10, alignItems: 'center', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Từ (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={rule.minWeight}
                          onChange={(e) => handleRuleChange(idx, 'minWeight', parseFloat(e.target.value) || 0)}
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
                          onChange={(e) => handleRuleChange(idx, 'maxWeight', parseFloat(e.target.value) || 0)}
                          className="input-field"
                          style={{ padding: '6px 10px', fontSize: 13 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Hoa hồng chia CTV (VNĐ / Đơn)</label>
                        <input
                          type="number"
                          step="500"
                          value={rule.commissionPrice}
                          onChange={(e) => handleRuleChange(idx, 'commissionPrice', parseInt(e.target.value) || 0)}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, background: 'var(--bg-secondary)', padding: 14, borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                  <div className="input-group">
                    <label className="input-label">Mỗi nấc cân vượt (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editingCtv.extraWeightStep}
                      onChange={(e) => setEditingCtv({ ...editingCtv, extraWeightStep: parseFloat(e.target.value) || 1 })}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Cộng thêm hoa hồng (+ VNĐ / kg)</label>
                    <input
                      type="number"
                      step="500"
                      value={editingCtv.extraWeightPrice}
                      onChange={(e) => setEditingCtv({ ...editingCtv, extraWeightPrice: parseInt(e.target.value) || 0 })}
                      className="input-field"
                    />
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
