import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  AlertCircle
} from 'lucide-react';
import type { AuditLogEntry, AuditLogCategory } from '../types';
import { AuditService } from '../services/auditService';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [category, setCategory] = useState<AuditLogCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await AuditService.getLogs({ category, search, limit: 300 });
      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const getCategoryBadge = (cat: AuditLogCategory) => {
    switch (cat) {
      case 'AUTH':
        return <span className="badge badge-info" style={{ fontSize: 10.5 }}>🔐 Đăng Nhập</span>;
      case 'PAYOUT':
        return <span className="badge badge-success" style={{ fontSize: 10.5 }}>💰 Đi Tiền</span>;
      case 'PRICING':
        return <span className="badge badge-warning" style={{ fontSize: 10.5 }}>🏷️ Biểu Phí</span>;
      case 'SESSIONS':
        return <span className="badge badge-primary" style={{ fontSize: 10.5 }}>📁 Đối Soát</span>;
      case 'EXPORT':
        return <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: 10.5 }}>📊 Xuất File</span>;
      case 'SETTINGS':
        return <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>⚙️ Cài Đặt</span>;
      default:
        return <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>⚡ Thao Tác</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Header & Filter Toolbar */}
      <div style={{
        background: 'var(--surface, #ffffff)',
        padding: '14px 20px',
        borderRadius: 16,
        border: '1.5px solid var(--border-color, #e2e8f0)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)',
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
              Nhật Ký Kiểm Toán Thao Tác (Audit Trail)
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Ghi nhận toàn bộ hoạt động đăng nhập, đi tiền, xuất file và thay đổi cấu hình bảo mật trên hệ thống.
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Category Select */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="input-field"
            style={{ fontSize: 12, padding: '6px 12px', height: 36, borderRadius: 8, fontWeight: 700 }}
          >
            <option value="ALL">🔍 Tất Cả Danh Mục</option>
            <option value="AUTH">🔐 Xác Thực & Đăng Nhập</option>
            <option value="PAYOUT">💰 Đi Tiền & Thanh Toán</option>
            <option value="PRICING">🏷️ Bảng Giá & Biểu Phí</option>
            <option value="SESSIONS">📁 Kỳ Đối Soát</option>
            <option value="EXPORT">📊 Xuất File Báo Cáo</option>
            <option value="SETTINGS">⚙️ Cài Đặt Hệ Thống</option>
          </select>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm hành động, người làm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 30, fontSize: 12, height: 36, borderRadius: 8, width: '100%' }}
            />
          </form>

          <button
            type="button"
            onClick={loadLogs}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            style={{ padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}
            title="Tải lại nhật ký"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Logs Table Card */}
      <div style={{
        background: 'var(--surface, #ffffff)',
        borderRadius: 16,
        border: '1.5px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
      }}>
        <div style={{
          padding: '10px 18px',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          borderBottom: '1.5px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#475569',
        }}>
          <span style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            LỊCH SỬ {logs.length} THAO TÁC GẦN NHẤT
          </span>
          <span style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 700 }}>
            Tự động lưu trữ • Chuẩn an toàn bảo mật
          </span>
        </div>

        <div style={{ maxHeight: 'calc(100vh - 270px)', minHeight: 400, overflowY: 'auto' }}>
          <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <tr style={{ borderBottom: '2px solid var(--border-color, #e2e8f0)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.3, color: '#475569' }}>
                <th style={{ width: 45, textAlign: 'center', padding: '10px 12px' }}>STT</th>
                <th style={{ width: 140, padding: '10px 12px' }}>Thời Gian</th>
                <th style={{ width: 130, padding: '10px 12px' }}>Danh Mục</th>
                <th style={{ width: 160, padding: '10px 12px' }}>Người Thực Hiện</th>
                <th style={{ padding: '10px 14px' }}>Nội Dung Hoạt Động</th>
                <th style={{ width: 130, textAlign: 'right', padding: '10px 12px' }}>IP / Thiết Bị</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontWeight: 700 }}>Chưa có bản ghi nhật ký kiểm toán nào phù hợp</div>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr
                    key={log.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      fontSize: 12.5,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, padding: '9px 12px' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11.5, color: '#334155' }}>
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {getCategoryBadge(log.category)}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                        {log.actorName}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        {log.actorRole}
                      </div>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#1e293b' }}>
                      <div style={{ fontWeight: 600 }}>{log.description}</div>
                      {log.action && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>
                          {log.action}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
