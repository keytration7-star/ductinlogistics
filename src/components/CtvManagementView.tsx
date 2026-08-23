import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import type { CtvProfile, CtvCommissionRule } from '../types';
import { Users, Plus, Edit2, Trash2, Check, X, DollarSign, Award, Search, Truck, CreditCard, Calculator, Ban, Phone, Mail } from 'lucide-react';
import { useToast, useConfirm } from './UIFeedback';

import { VIETNAM_BANKS as FULL_VIETNAM_BANKS } from '../constants/banks';

const VIETNAM_BANKS = FULL_VIETNAM_BANKS.map(b => b.shortName);

interface CtvManagementViewProps {
  activeCarrierId?: string;
  activeCarrierName?: string;
}

export const CtvManagementView: React.FC<CtvManagementViewProps> = ({
  activeCarrierId = 'jnt',
  activeCarrierName = 'J&T Express',
}) => {
  const [ctvs, setCtvs] = useState<CtvProfile[]>(() => StorageService.getCtvs());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCtv, setEditingCtv] = useState<CtvProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [testWeight, setTestWeight] = useState<number>(1.5);

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
    setEditingCtv(newCtv);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ctv: CtvProfile) => {
    const ctvCopy: CtvProfile = JSON.parse(JSON.stringify(ctv));
    if (!ctvCopy.assignedCarriers || ctvCopy.assignedCarriers.length === 0) {
      ctvCopy.assignedCarriers = [activeCarrierId];
    }
    if (!ctvCopy.bankAccount) {
      ctvCopy.bankAccount = { bankName: 'MB Bank', accountNumber: '', accountHolder: ctvCopy.name };
    }
    setEditingCtv(ctvCopy);
    setIsModalOpen(true);
  };

  const handleDeactivate = async (ctvId: string, name: string) => {
    const ok = await showConfirm({
      title: 'Ngừng Hoạt Động Cộng Tác Viên',
      message: `Ngừng tính hoa hồng cho CTV "${name}" ở các kỳ sau? Hồ sơ và lịch sử hoa hồng đã có sẽ được giữ nguyên.`,
      warning: true,
      confirmText: 'Ngừng hoạt động',
    });
    if (!ok) return;

    const updated = ctvs.map(c => c.id === ctvId ? { ...c, active: false } : c);
    setCtvs(updated);
    StorageService.saveCtvs(updated);
    showToast(`Đã ngừng hoạt động CTV ${name}; lịch sử vẫn được giữ lại.`, 'success');
  };

  const handleActivate = (ctvId: string, name: string) => {
    const updated = ctvs.map(c => c.id === ctvId ? { ...c, active: true } : c);
    setCtvs(updated);
    StorageService.saveCtvs(updated);
    showToast(`Đã kích hoạt lại CTV ${name}.`, 'success');
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCtv) return;

    if (!editingCtv.name.trim()) {
      showToast('Vui lòng nhập tên Cộng tác viên', 'warning');
      return;
    }

    // Always assign current active carrier
    const ctvToSave: CtvProfile = {
      ...editingCtv,
      assignedCarriers: [activeCarrierId],
    };

    const index = ctvs.findIndex(c => c.id === ctvToSave.id);
    let updated: CtvProfile[];
    if (index >= 0) {
      updated = [...ctvs];
      updated[index] = ctvToSave;
    } else {
      updated = [ctvToSave, ...ctvs];
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

  // Filter CTVs for current active carrier
  const filteredCtvs = ctvs.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    
    if (!matchesSearch) return false;

    if (statusFilter === 'active' && !c.active) return false;
    if (statusFilter === 'inactive' && c.active) return false;

    // Filter by active carrier
    const assigned = c.assignedCarriers || ['ALL'];
    return assigned.includes('ALL') || assigned.includes(activeCarrierId);
  });

  const activeCount = filteredCtvs.filter(c => c.active).length;
  const inactiveCount = filteredCtvs.filter(c => !c.active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 🌟 1. TOP HEADER FROSTED PORCELAIN */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border-color)',
        borderRadius: 16,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(79, 70, 229, 0.3)',
            flexShrink: 0,
          }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 16.5, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                Quản Lý Cộng Tác Viên (CTV) Phụ Trách {activeCarrierName}
              </h2>
              <span style={{
                fontSize: 10.5,
                background: 'rgba(79, 70, 229, 0.12)',
                color: 'var(--primary)',
                border: '1px solid rgba(79, 70, 229, 0.25)',
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 800,
              }}>
                {filteredCtvs.length} CTV {activeCarrierName.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0' }}>
              Danh sách CTV và chính sách hoa hồng bậc cân nặng áp dụng cho các đơn hàng của hãng <strong>{activeCarrierName}</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn btn-primary btn-sm"
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            padding: '7px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--brand-gradient)',
            boxShadow: '0 2px 10px rgba(79, 70, 229, 0.25)',
          }}
        >
          <Plus size={15} />
          <span>+ Thêm CTV Mới</span>
        </button>
      </div>

      {/* 🌟 2. 3 THẺ KPI THỐNG KÊ NHANH */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        {/* KPI 1: Tổng số CTV */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--info-border)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(2, 132, 199, 0.15)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--info)', fontWeight: 700, textTransform: 'uppercase' }}>CTV {activeCarrierName}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)' }}>
              {filteredCtvs.length} <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--success)' }}>({activeCount} hoạt động)</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Hãng phụ trách */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid rgba(124, 58, 237, 0.3)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124, 58, 237, 0.15)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Truck size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase' }}>Hãng Vận Chuyển</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-main)' }}>
              {activeCarrierName}
            </div>
          </div>
        </div>

        {/* KPI 3: Bảng hoa hồng */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid var(--success-border)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>Chính Sách Hoa Hồng</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--success)' }}>
              Theo bậc cân nặng (VNĐ / đơn)
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 3. THANH TÌM KIẾM & BỘ LỌC TRẠNG THÁI */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        background: 'var(--bg-card)',
        padding: '8px 14px',
        borderRadius: 12,
        border: '1.5px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
          <Search size={16} color="var(--primary)" />
          <input
            type="text"
            placeholder={`Tìm CTV ${activeCarrierName} theo Mã, Tên, Số điện thoại...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              width: '100%',
              outline: 'none',
              fontSize: 12.5,
              fontWeight: 500,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Bộ lọc trạng thái */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="btn btn-sm"
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              fontWeight: statusFilter === 'all' ? 800 : 500,
              background: statusFilter === 'all' ? 'var(--primary)' : '#f1f5f9',
              color: statusFilter === 'all' ? '#fff' : 'var(--text-dim)',
              border: 'none',
            }}
          >
            Tất cả ({filteredCtvs.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className="btn btn-sm"
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              fontWeight: statusFilter === 'active' ? 800 : 500,
              background: statusFilter === 'active' ? '#10b981' : '#f1f5f9',
              color: statusFilter === 'active' ? '#fff' : 'var(--text-dim)',
              border: 'none',
            }}
          >
            Đang hoạt động ({activeCount})
          </button>

          {inactiveCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className="btn btn-sm"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: statusFilter === 'inactive' ? 800 : 500,
                background: statusFilter === 'inactive' ? '#ef4444' : '#f1f5f9',
                color: statusFilter === 'inactive' ? '#fff' : 'var(--text-dim)',
                border: 'none',
              }}
            >
              Tạm khóa ({inactiveCount})
            </button>
          )}
        </div>
      </div>

      {/* 🌟 4. BẢNG DANH SÁCH CỘNG TÁC VIÊN FROSTED PORCELAIN */}
      <div className="table-container glass-panel" style={{
        borderRadius: 14,
        border: '1.5px solid #dbe6f2',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfe 100%)',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
        overflow: 'hidden',
      }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>MÃ CTV</th>
              <th>HỌ VÀ TÊN & LIÊN HỆ</th>
              <th>TÀI KHOẢN NHẬN HOA HỒNG</th>
              <th>BẢNG HOA HỒNG BẬC CÂN NẶNG</th>
              <th style={{ width: 120 }}>TRẠNG THÁI</th>
              <th style={{ textAlign: 'right', width: 90 }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {filteredCtvs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-dim)' }}>
                  <Award size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div>Chưa có Cộng tác viên nào cho {activeCarrierName}.</div>
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 10, fontSize: 11.5 }}
                  >
                    <Plus size={13} /> Thêm CTV Mới
                  </button>
                </td>
              </tr>
            ) : (
              filteredCtvs.map((ctv) => {
                const initials = ctv.name ? ctv.name.split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase() : 'CTV';

                return (
                  <tr key={ctv.id}>
                    <td>
                      <span className="mono" style={{
                        fontWeight: 800,
                        fontSize: 11.5,
                        color: '#4338ca',
                        background: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        padding: '3px 8px',
                        borderRadius: 6,
                        display: 'inline-block',
                      }}>
                        {ctv.code}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                          color: '#3730a3',
                          fontWeight: 900,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-main)' }}>{ctv.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, marginTop: 1 }}>
                            {ctv.phone ? (
                              <span style={{ color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Phone size={11} /> {ctv.phone}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có SĐT</span>
                            )}
                            {ctv.email && (
                              <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Mail size={11} /> {ctv.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      {ctv.bankAccount?.bankName && ctv.bankAccount?.accountNumber ? (
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 8px', display: 'inline-block' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-main)' }}>{ctv.bankAccount.bankName}</div>
                          <div className="mono" style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 700 }}>{ctv.bankAccount.accountNumber}</div>
                          {ctv.bankAccount.accountHolder && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{ctv.bankAccount.accountHolder}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa cập nhật STK</span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5 }}>
                        {(ctv.commissionRules || []).map((r, i) => (
                          <div key={i} style={{ color: 'var(--text-secondary)' }}>
                            • <b>{r.minWeight}kg - {r.maxWeight}kg</b>: <strong style={{ color: '#047857' }}>+{r.commissionPrice.toLocaleString('vi-VN')} đ/đơn</strong>
                          </div>
                        ))}
                        {ctv.extraWeightPrice > 0 && (
                          <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: 10.5 }}>
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
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: ctv.active ? '#dcfce7' : '#fee2e2',
                        color: ctv.active ? '#047857' : '#b91c1c',
                        border: ctv.active ? '1px solid #86efac' : '1px solid #fca5a5',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ctv.active ? '#10b981' : '#ef4444' }} />
                        {ctv.active ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ctv)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', background: '#ffffff', border: '1px solid #cbd5e1' }}
                          title="Sửa thông tin CTV"
                        >
                          <Edit2 size={13} color="var(--primary)" />
                        </button>
                        {ctv.active ? (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(ctv.id, ctv.name)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '4px 8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}
                            title="Ngừng hoạt động, không xóa lịch sử"
                          >
                            <Ban size={13} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivate(ctv.id, ctv.name)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', background: '#dcfce7', border: '1px solid #86efac', color: '#059669' }}
                            title="Kích hoạt lại CTV"
                          >
                            <Check size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 🌟 5. MODAL ADD / EDIT CTV */}
      {isModalOpen && editingCtv && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{
            maxWidth: 760,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Modal Header */}
              <div style={{
                padding: '14px 20px',
                borderBottom: '1.5px solid #dbe6f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(180deg, #ffffff 0%, #f6faff 100%)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Award size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {editingCtv.id ? `Cấu hình CTV ${activeCarrierName}: ${editingCtv.name || editingCtv.code}` : `Thêm CTV Mới (${activeCarrierName})`}
                  </h3>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                  <X size={15} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, background: '#fbfcfe' }}>
                {/* 1. THÔNG TIN CƠ BẢN */}
                <div style={{ background: '#ffffff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Users size={15} /> 1. THÔNG TIN CƠ BẢN CỘNG TÁC VIÊN
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div className="input-group">
                      <label className="input-label" style={{ fontSize: 11 }}>Mã CTV (*)</label>
                      <input
                        type="text"
                        required
                        placeholder="CTV_01, CTV_MINH..."
                        value={editingCtv.code}
                        onChange={(e) => setEditingCtv({ ...editingCtv, code: e.target.value.toUpperCase() })}
                        className="input-field"
                        style={{ padding: '6px 10px', fontSize: 12.5 }}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" style={{ fontSize: 11 }}>Họ Và Tên CTV (*)</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Nguyễn Văn Minh"
                        value={editingCtv.name}
                        onChange={(e) => setEditingCtv({ ...editingCtv, name: e.target.value })}
                        className="input-field"
                        style={{ padding: '6px 10px', fontSize: 12.5 }}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" style={{ fontSize: 11 }}>Số điện thoại (*)</label>
                      <input
                        type="text"
                        required
                        placeholder="0912345678"
                        value={editingCtv.phone}
                        onChange={(e) => setEditingCtv({ ...editingCtv, phone: e.target.value })}
                        className="input-field"
                        style={{ padding: '6px 10px', fontSize: 12.5 }}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" style={{ fontSize: 11 }}>Email liên hệ</label>
                      <input
                        type="email"
                        placeholder="ctv@gmail.com"
                        value={editingCtv.email || ''}
                        onChange={(e) => setEditingCtv({ ...editingCtv, email: e.target.value })}
                        className="input-field"
                        style={{ padding: '6px 10px', fontSize: 12.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. TÀI KHOẢN NGÂN HÀNG & VIETQR */}
                <div style={{ background: '#ffffff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <CreditCard size={15} /> 2. TÀI KHOẢN NGÂN HÀNG NHẬN HOA HỒNG
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(79, 70, 229, 0.05) 100%)',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #d1fae5',
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px',
                    gap: 12,
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                      <div className="input-group">
                        <label className="input-label" style={{ fontSize: 11 }}>Tên Ngân hàng</label>
                        <select
                          value={editingCtv.bankAccount?.bankName || 'MB Bank'}
                          onChange={(e) => setEditingCtv({
                            ...editingCtv,
                            bankAccount: { ...editingShopBankAccount(editingCtv), bankName: e.target.value }
                          })}
                          className="select-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        >
                          {VIETNAM_BANKS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group">
                        <label className="input-label" style={{ fontSize: 11 }}>Số tài khoản</label>
                        <input
                          type="text"
                          placeholder="STK nhận tiền..."
                          value={editingCtv.bankAccount?.accountNumber || ''}
                          onChange={(e) => setEditingCtv({
                            ...editingCtv,
                            bankAccount: { ...editingShopBankAccount(editingCtv), accountNumber: e.target.value }
                          })}
                          className="input-field mono"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label" style={{ fontSize: 11 }}>Tên chủ tài khoản</label>
                        <input
                          type="text"
                          placeholder="NGUYEN VAN A"
                          value={editingCtv.bankAccount?.accountHolder || ''}
                          onChange={(e) => setEditingCtv({
                            ...editingCtv,
                            bankAccount: { ...editingShopBankAccount(editingCtv), accountHolder: e.target.value.toUpperCase() }
                          })}
                          className="input-field"
                          style={{ padding: '5px 8px', fontSize: 12 }}
                        />
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      {editingCtv.bankAccount?.accountNumber ? (
                        <>
                          <img
                            src={`https://img.vietqr.io/image/${(editingCtv.bankAccount.bankName || 'MBBank').replace(/\s+/g, '')}-${editingCtv.bankAccount.accountNumber}-compact.png?addInfo=Hoa%20hong%20CTV%20${editingCtv.code}&accountName=${encodeURIComponent(editingCtv.bankAccount.accountHolder || editingCtv.name)}`}
                            alt="VietQR Code"
                            style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: 2 }}
                          />
                          <div style={{ fontSize: 8.5, color: 'var(--text-dim)', marginTop: 2 }}>Mã VietQR CTV</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 9.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>Gõ STK xem VietQR</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. BẢNG HOA HỒNG CHI TRẢ THEO BẬC CÂN NẶNG */}
                <div style={{ background: '#ffffff', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DollarSign size={15} /> 3. BẢNG HOA HỒNG THEO BẬC CÂN NẶNG (VNĐ / ĐƠN)
                    </span>
                    <button type="button" onClick={handleAddRule} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}>
                      <Plus size={12} /> Thêm Bậc Cân
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(editingCtv.commissionRules || []).map((rule, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 36px', gap: 8, alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Từ (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.minWeight}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleRuleChange(idx, 'minWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0)}
                            className="input-field"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Đến (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.maxWeight}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleRuleChange(idx, 'maxWeight', parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 0)}
                            className="input-field"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Hoa hồng chia CTV (VNĐ / Đơn)</label>
                          <input
                            type="number"
                            step="500"
                            placeholder="0"
                            value={rule.commissionPrice === 0 ? '' : rule.commissionPrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleRuleChange(idx, 'commissionPrice', parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0)}
                            className="input-field"
                            style={{ padding: '4px 8px', fontSize: 12, fontWeight: 700, color: '#047857' }}
                          />
                        </div>

                        <div style={{ paddingTop: 14, textAlign: 'center' }}>
                          <button type="button" onClick={() => handleRemoveRule(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px dashed #cbd5e1', marginTop: 8 }}>
                    <div className="input-group">
                      <label className="input-label" style={{ fontSize: 10.5 }}>Mỗi nấc cân vượt (kg)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editingCtv.extraWeightStep}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingCtv({ ...editingCtv, extraWeightStep: parseFloat(e.target.value.replace(/^0+(?=\d)/, '')) || 1 })}
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" style={{ fontSize: 10.5 }}>Cộng thêm hoa hồng (+ VNĐ / kg)</label>
                      <input
                        type="number"
                        step="500"
                        placeholder="0"
                        value={editingCtv.extraWeightPrice === 0 ? '' : editingCtv.extraWeightPrice}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditingCtv({ ...editingCtv, extraWeightPrice: parseInt(e.target.value.replace(/^0+(?=\d)/, ''), 10) || 0 })}
                        className="input-field"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. THỬ TÍNH HOA HỒNG LIVE */}
                <div style={{
                  background: 'rgba(79, 70, 229, 0.05)',
                  padding: 10,
                  borderRadius: 10,
                  border: '1.5px dashed var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calculator size={15} color="var(--primary)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>Thử tính với cân nặng:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={testWeight}
                      onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0.1)}
                      className="input-field"
                      style={{ width: 65, padding: '3px 6px', fontSize: 12, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 12 }}>kg</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hoa hồng CTV nhận:</span>
                    <strong className="mono" style={{ fontSize: 14.5, color: '#059669' }}>
                      {new Intl.NumberFormat('vi-VN').format(StorageService.calculateCtvCommission(editingCtv, testWeight, activeCarrierId))} đ
                    </strong>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ fontSize: 11 }}>Ghi chú CTV</label>
                  <textarea
                    rows={2}
                    placeholder="Ghi chú khu vực quản lý, tỷ lệ chia thưởng..."
                    value={editingCtv.notes || ''}
                    onChange={(e) => setEditingCtv({ ...editingCtv, notes: e.target.value })}
                    className="input-field"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, background: '#ffffff', flexShrink: 0 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '6px 14px' }}>Hủy Bỏ</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '6px 18px', fontWeight: 800 }}><Check size={15} /> <span>Lưu CTV</span></button>
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

