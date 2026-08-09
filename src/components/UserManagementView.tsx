import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Lock, 
  Unlock, 
  KeyRound, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X
} from 'lucide-react';
import { AuthService } from '../services/authService';
import type { UserAccount, UserRole } from '../types';

interface UserManagementViewProps {
  currentUser: UserAccount;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => AuthService.getUsers());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState<UserAccount | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // New user form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'STAFF' as UserRole,
    phone: '',
    email: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const res = AuthService.createUser(formData);
    if (res.success) {
      setUsers(AuthService.getUsers());
      setShowCreateModal(false);
      setFormData({
        username: '',
        password: '',
        fullName: '',
        role: 'STAFF',
        phone: '',
        email: '',
      });
      showToast('Đã tạo tài khoản nhân viên mới thành công!');
    } else {
      setFormError(res.error || 'Không thể tạo tài khoản.');
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);

    const res = AuthService.updateUser(editingUser.id, {
      fullName: editingUser.fullName,
      role: editingUser.role,
      phone: editingUser.phone,
      email: editingUser.email,
    });

    if (res.success) {
      setUsers(AuthService.getUsers());
      setEditingUser(null);
      showToast('Đã cập nhật thông tin tài khoản!');
    } else {
      setFormError(res.error || 'Cập nhật thất bại.');
    }
  };

  const handleToggleLock = (user: UserAccount) => {
    const action = user.active ? 'khóa' : 'mở khóa';
    if (window.confirm(`Bạn có chắc muốn ${action} tài khoản "${user.fullName}" (${user.username})?`)) {
      const res = AuthService.toggleUserActive(user.id);
      if (res.success) {
        setUsers(AuthService.getUsers());
        showToast(`Đã ${action} tài khoản thành công!`);
      } else {
        alert(res.error || 'Thao tác thất bại.');
      }
    }
  };

  const handleDeleteUser = (user: UserAccount) => {
    if (window.confirm(`CẢNH BÁO: Bạn có chắc muốn xóa vĩnh viễn tài khoản "${user.fullName}" (${user.username})?`)) {
      const res = AuthService.deleteUser(user.id);
      if (res.success) {
        setUsers(AuthService.getUsers());
        showToast('Đã xóa tài khoản thành công!');
      } else {
        alert(res.error || 'Không thể xóa tài khoản.');
      }
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChangeUser) return;

    const res = AuthService.changePassword(passwordChangeUser.id, newPasswordInput);
    if (res.success) {
      setPasswordChangeUser(null);
      setNewPasswordInput('');
      showToast('Đã đổi mật khẩu thành công!');
    } else {
      alert(res.error || 'Đổi mật khẩu thất bại.');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return <span className="badge badge-danger" style={{ fontWeight: 700 }}>👑 Quản Trị Viên (Admin)</span>;
      case 'ACCOUNTANT':
        return <span className="badge badge-primary" style={{ fontWeight: 700 }}>💼 Kế Toán / Đối Soát</span>;
      case 'STAFF':
        return <span className="badge badge-success">🧑‍💼 Nhân Viên Vận Hành</span>;
      case 'VIEWER':
        return <span className="badge badge-neutral">👁️ Khách Xem (Chỉ Đọc)</span>;
      default:
        return <span className="badge badge-neutral">{role}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Toast Notification */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          background: 'var(--success)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          animation: 'slideIn 0.3s ease',
        }}>
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={24} color="var(--primary)" />
              Quản Lý Tài Khoản & Phân Quyền Nhân Viên
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Tạo tài khoản, cấp quyền truy cập theo vai trò (Admin, Kế toán, Nhân viên, Người xem) và quản lý bảo mật.
            </p>
          </div>

          <button
            onClick={() => {
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <UserPlus size={18} />
            <span>Thêm Tài Khoản Mới</span>
          </button>
        </div>
      </div>

      {/* Role Permission Matrix Infobox */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
      }}>
        <div style={{ fontSize: 12 }}>
          <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: 2 }}>👑 ADMIN (Toàn quyền):</strong>
          Quản lý tài khoản, xem lãi gom đơn, cài đặt cước sỉ, xóa/sao lưu dữ liệu.
        </div>
        <div style={{ fontSize: 12 }}>
          <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: 2 }}>💼 KẾ TOÁN (Đối soát):</strong>
          Kéo file đối soát, quản lý shop, xuất Excel/ZIP, gửi email bảng kê, xem doanh thu & lãi.
        </div>
        <div style={{ fontSize: 12 }}>
          <strong style={{ color: 'var(--success)', display: 'block', marginBottom: 2 }}>🧑‍💼 NHÂN VIÊN (Vận hành):</strong>
          Đối soát đơn, xem thông tin shop & đơn hàng (ẩn số liệu lợi nhuận ròng nội bộ).
        </div>
        <div style={{ fontSize: 12 }}>
          <strong style={{ color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>👁️ NGƯỜI XEM (Chỉ đọc):</strong>
          Chỉ xem tra cứu dữ liệu, không thể sửa đổi hoặc xóa thông tin.
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container glass-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ & Tên</th>
              <th>Tên Đăng Nhập</th>
              <th>Vai Trò / Quyền Hạn</th>
              <th>Liên Hệ</th>
              <th>Trạng Thái</th>
              <th>Lần Đăng Nhập Cuối</th>
              <th style={{ textAlign: 'center' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => {
              const isSuperAdmin = u.username.toLowerCase() === 'ductin-admin';
              return (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.6 }}>
                  <td>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {u.fullName}
                      {isSuperAdmin && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                          (Chủ Sở Hữu)
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <strong className="mono" style={{ color: 'var(--primary)' }}>
                      {u.username}
                    </strong>
                  </td>
                  <td>{getRoleBadge(u.role)}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>{u.phone || '—'}</div>
                    {u.email && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.email}</div>}
                  </td>
                  <td>
                    {u.active ? (
                      <span className="badge badge-success">Đang hoạt động</span>
                    ) : (
                      <span className="badge badge-danger">Đang bị khóa</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      
                      {/* Change Password */}
                      <button
                        onClick={() => {
                          setPasswordChangeUser(u);
                          setNewPasswordInput('');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        title="Đổi mật khẩu"
                      >
                        <KeyRound size={13} />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setFormError(null);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit3 size={13} />
                      </button>

                      {/* Lock / Unlock (Not allowed for super admin) */}
                      {!isSuperAdmin && (
                        <button
                          onClick={() => handleToggleLock(u)}
                          className={`btn btn-sm ${u.active ? 'btn-secondary' : 'btn-success'}`}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          title={u.active ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                        >
                          {u.active ? <Lock size={13} color="var(--warning)" /> : <Unlock size={13} />}
                        </button>
                      )}

                      {/* Delete (Not allowed for super admin or self) */}
                      {!isSuperAdmin && u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          title="Xóa tài khoản"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={20} color="var(--primary)" />
                Tạo Tài Khoản Nhân Viên Mới
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div className="badge badge-danger" style={{ padding: '8px 12px', fontSize: 12 }}>
                  {formError}
                </div>
              )}

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Họ và Tên (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Kế Toán"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Tên Đăng Nhập (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="ketoan_01"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Mật Khẩu Ban Đầu (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Vai Trò & Phân Quyền (*)</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="select-field"
                >
                  <option value="ACCOUNTANT">💼 Kế Toán (Được đối soát, xuất file, gửi mail, quản lý shop)</option>
                  <option value="STAFF">🧑‍💼 Nhân Viên Vận Hành (Được đối soát, ẩn số liệu lợi nhuận)</option>
                  <option value="ADMIN">👑 Quản Trị Viên (Toàn quyền quản trị hệ thống)</option>
                  <option value="VIEWER">👁️ Người Xem (Chỉ được xem / đọc dữ liệu)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Số Điện Thoại</label>
                  <input
                    type="text"
                    placeholder="0912..."
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Email</label>
                  <input
                    type="email"
                    placeholder="nhanvien@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  <UserPlus size={15} />
                  <span>Tạo Tài Khoản</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="var(--primary)" />
                Cập Nhật Tài Khoản ({editingUser.username})
              </h3>
              <button onClick={() => setEditingUser(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div className="badge badge-danger" style={{ padding: '8px 12px', fontSize: 12 }}>
                  {formError}
                </div>
              )}

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Họ và Tên</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Vai Trò & Phân Quyền</label>
                <select
                  disabled={editingUser.username.toLowerCase() === 'ductin-admin'}
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                  className="select-field"
                >
                  <option value="ACCOUNTANT">💼 Kế Toán (Được đối soát, xuất file, gửi mail, quản lý shop)</option>
                  <option value="STAFF">🧑‍💼 Nhân Viên Vận Hành (Được đối soát, ẩn số liệu lợi nhuận)</option>
                  <option value="ADMIN">👑 Quản Trị Viên (Toàn quyền quản trị hệ thống)</option>
                  <option value="VIEWER">👁️ Người Xem (Chỉ được xem / đọc dữ liệu)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Email</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {passwordChangeUser && (
        <div className="modal-overlay" onClick={() => setPasswordChangeUser(null)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} color="var(--primary)" />
                Đổi Mật Khẩu
              </h3>
              <button onClick={() => setPasswordChangeUser(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Đổi mật khẩu cho tài khoản: <strong style={{ color: 'var(--primary)' }}>{passwordChangeUser.username}</strong> ({passwordChangeUser.fullName})
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Mật Khẩu Mới (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập mật khẩu mới..."
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setPasswordChangeUser(null)} className="btn btn-secondary">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Cập Nhật Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
