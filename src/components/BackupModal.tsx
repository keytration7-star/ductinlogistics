import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  X, 
  RefreshCcw, 
  Lock, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight,
  FolderArchive,
  Eraser
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { AuthService } from '../services/authService';
import type { UserAccount } from '../types';
import { useConfirm } from './UIFeedback';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataReloaded: () => void;
  onClearAllData: () => void;
  onClearSessionsOnly: () => void;
  currentUser: UserAccount;
}

export const BackupModal: React.FC<BackupModalProps> = ({ 
  isOpen, 
  onClose, 
  onDataReloaded, 
  onClearAllData,
  onClearSessionsOnly,
  currentUser,
}) => {
  const { showConfirm } = useConfirm();
  // Authentication Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Modal Horizontal Tabs: 'backup_restore' | 'cleanup'
  const [activeModalTab, setActiveModalTab] = useState<'backup_restore' | 'cleanup'>('backup_restore');

  const [importJson, setImportJson] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const users = AuthService.getUsers();
    // Find admin user or current user's password
    const adminUser = users.find(u => u.id === currentUser.id) || users.find(u => u.role === 'ADMIN');
    
    if (adminUser && adminUser.password === adminPasswordInput.trim()) {
      setIsAuthenticated(true);
      setAdminPasswordInput('');
      setAuthError(null);
    } else {
      setAuthError('Mật khẩu Admin không chính xác. Vui lòng thử lại.');
    }
  };

  const handleClose = () => {
    setIsAuthenticated(false);
    setAdminPasswordInput('');
    setAuthError(null);
    setStatusMsg(null);
    onClose();
  };

  const handleExport = () => {
    const jsonStr = StorageService.exportDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GomDonPro_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg({ type: 'success', text: 'Đã xuất file sao lưu JSON thành công!' });
  };

  const handleImport = () => {
    if (!importJson.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng dán chuỗi JSON sao lưu vào ô dưới.' });
      return;
    }

    const ok = StorageService.importDatabaseBackup(importJson);
    if (ok) {
      setStatusMsg({ type: 'success', text: 'Khôi phục dữ liệu thành công!' });
      onDataReloaded();
      setTimeout(() => handleClose(), 1200);
    } else {
      setStatusMsg({ type: 'error', text: 'Định dạng JSON không hợp lệ. Vui lòng kiểm tra lại.' });
    }
  };

  const handleClearSessions = async () => {
    const ok = await showConfirm({
      title: 'Xoá Lịch Sử Đối Soát',
      message: 'Bạn có chắc muốn xóa lịch sử các kỳ đối soát để úp lại file thử nghiệm? Danh sách Shop và Cài đặt bảng giá vận chuyển sẽ được GIỮ NGUYÊN 100%.',
      confirmText: 'Xoá Lịch Sử',
      warning: true,
    });
    if (ok) {
      onClearSessionsOnly();
      setStatusMsg({ type: 'success', text: 'Đã xóa kết quả đối soát! Danh sách Shop & Bảng giá vẫn được giữ nguyên.' });
    }
  };

  const handleClearShopsOnly = async () => {
    const ok = await showConfirm({
      title: 'Xoá Danh Sách Shop',
      message: 'Bạn có chắc muốn xóa toàn bộ danh sách Shop để nhập lại tệp khách hàng mới? Bảng giá NVC sỉ và cấu hình sẽ được giữ nguyên.',
      confirmText: 'Xoá Shop',
      warning: true,
    });
    if (ok) {
      StorageService.saveShops([]);
      onDataReloaded();
      setStatusMsg({ type: 'success', text: 'Đã xóa toàn bộ danh sách Shop!' });
    }
  };

  const handleClearAll = async () => {
    const ok = await showConfirm({
      title: '⚠️ CẢNH BÁO CAO NHẤT',
      message: 'Thao tác này sẽ xóa sạch toàn bộ danh sách Shop, Bảng giá và Lịch sử đối soát. Bạn có chắc chắn 100% không?',
      confirmText: 'Xoá Sạch Tất Cả',
      danger: true,
    });
    if (ok) {
      onClearAllData();
      setStatusMsg({ type: 'success', text: 'Đã xóa sạch toàn bộ cơ sở dữ liệu!' });
      setTimeout(() => handleClose(), 1200);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-gradient)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                Trung Tâm Quản Trị & Dữ Liệu
                <span className="badge badge-danger" style={{ fontSize: 10, padding: '2px 6px' }}>
                  Admin Only
                </span>
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Khu vực quản lý sao lưu, khôi phục và dọn dẹp cơ sở dữ liệu
              </div>
            </div>
          </div>

          <button onClick={handleClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* ADMIN SECURITY PASSWORD GATE */}
        {!isAuthenticated ? (
          <div style={{ padding: '36px 32px', textAlign: 'center' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Lock size={32} />
            </div>

            <h4 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              Xác Thực Mật Khẩu Quản Trị Viên (Admin)
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 20px' }}>
              Đây là khu vực bảo mật cao ảnh hưởng đến toàn bộ dữ liệu. Vui lòng nhập mật khẩu Admin để tiếp tục.
            </p>

            {authError && (
              <div className="badge badge-danger" style={{ display: 'inline-block', padding: '8px 14px', fontSize: 12, marginBottom: 16 }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleVerifyAdminPassword} style={{ maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <KeyRound size={17} />
                  </div>
                  <input
                    type="password"
                    autoFocus
                    required
                    placeholder="Nhập mật khẩu Admin (ductin@admin)..."
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    className="input-field"
                    style={{ padding: '10px 14px 10px 38px', fontSize: 13 }}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '10px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>Xác Nhận Truy Cập</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED CONTENT WITH HORIZONTAL TABS */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Horizontal Tabs Bar */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              padding: '0 24px',
              gap: 8,
            }}>
              <button
                type="button"
                onClick={() => {
                  setActiveModalTab('backup_restore');
                  setStatusMsg(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 18px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeModalTab === 'backup_restore' ? '3px solid var(--primary)' : '3px solid transparent',
                  color: activeModalTab === 'backup_restore' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: activeModalTab === 'backup_restore' ? 700 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FolderArchive size={16} />
                <span>Tab 1: Sao Lưu & Khôi Phục</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModalTab('cleanup');
                  setStatusMsg(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 18px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeModalTab === 'cleanup' ? '3px solid var(--danger)' : '3px solid transparent',
                  color: activeModalTab === 'cleanup' ? 'var(--danger)' : 'var(--text-muted)',
                  fontWeight: activeModalTab === 'cleanup' ? 700 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Eraser size={16} />
                <span>Tab 2: Dọn Dẹp & Đặt Lại Dữ Liệu</span>
              </button>
            </div>

            {/* Tab Content Body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {statusMsg && (
                <div className={`badge ${statusMsg.type === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '8px 14px', fontSize: 13 }}>
                  {statusMsg.text}
                </div>
              )}

              {/* TAB 1: BACKUP & RESTORE */}
              {activeModalTab === 'backup_restore' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* 1. Export section */}
                  <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>
                        1. Xuất Bản Sao Lưu (.json)
                      </h4>
                      <span className="badge badge-success" style={{ fontSize: 11 }}>Dự phòng an toàn</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Lưu toàn bộ danh sách Shop, biểu giá riêng, bảng giá NVC và lịch sử đối soát về máy tính của bạn.
                    </p>
                    <button onClick={handleExport} className="btn btn-primary btn-sm">
                      <Download size={14} />
                      <span>Tải Về File Sao Lưu JSON</span>
                    </button>
                  </div>

                  {/* 2. Import section */}
                  <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                      2. Khôi Phục Dữ Liệu Từ JSON
                    </h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      Dán nội dung file JSON đã sao lưu trước đó để phục hồi lại nguyên trạng hệ thống:
                    </p>
                    <textarea
                      rows={3}
                      placeholder="Dán nội dung chuỗi JSON sao lưu vào đây..."
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      className="textarea-field"
                      style={{ fontSize: 12, marginBottom: 10 }}
                    />
                    <button onClick={handleImport} className="btn btn-secondary btn-sm">
                      <Upload size={14} />
                      <span>Khôi Phục Dữ Liệu</span>
                    </button>
                  </div>

                </div>
              )}

              {/* TAB 2: DATA CLEANUP & RESET */}
              {activeModalTab === 'cleanup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* Option 1: Clear Sessions only (Recommended for testing) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(79, 70, 229, 0.06)',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>
                        Xóa Kết Quả & Lịch Sử Đối Soát (Khuyên dùng khi Test)
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Xóa các lần đối soát cũ để tải lại file Excel mới. <strong>GIỮ NGUYÊN 100% Danh sách Shop & Bảng giá</strong>.
                      </div>
                    </div>
                    <button onClick={handleClearSessions} className="btn btn-primary btn-sm">
                      <RefreshCcw size={14} />
                      <span>Xóa Kết Quả</span>
                    </button>
                  </div>

                  {/* Option 2: Clear Shops only */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-primary)',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>
                        Xóa Toàn Bộ Danh Sách Shop
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Xóa danh bạ khách hàng cũ để bắt đầu nhập danh sách Shop mới từ đầu.
                      </div>
                    </div>
                    <button onClick={handleClearShopsOnly} className="btn btn-secondary btn-sm" style={{ color: 'var(--warning)' }}>
                      <Trash2 size={14} />
                      <span>Xóa Danh Sách Shop</span>
                    </button>
                  </div>

                  {/* Option 3: Full Database Wipe (Danger zone) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--danger-bg)',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--danger-border)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger)', marginBottom: 2 }}>
                        Xóa Sạch Toàn Bộ Cơ Sở Dữ Liệu (Reset Trắng)
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Xóa sạch tất cả Shop, biểu giá và các kỳ đối soát để bắt đầu lại từ con số 0.
                      </div>
                    </div>
                    <button onClick={handleClearAll} className="btn btn-danger btn-sm">
                      <Trash2 size={14} />
                      <span>Xóa Sạch Tất Cả</span>
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* Bottom info footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--text-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="var(--success)" />
                <span>Đã xác thực quyền Quản trị viên ({currentUser.fullName})</span>
              </div>

              <button type="button" onClick={handleClose} className="btn btn-secondary btn-sm">
                Đóng
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
