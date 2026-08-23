import React, { useState } from 'react';
import { 
  X, 
  Save, 
  MessageSquare, 
  Key, 
  ExternalLink, 
  Sparkles, 
  HelpCircle,
  Building2,
  Phone,
  ShieldCheck,
  Zap
} from 'lucide-react';
import type { ZaloZnsSettings } from '../types';
import { useToast } from './UIFeedback';

interface ZaloZnsConfigModalProps {
  settings: ZaloZnsSettings;
  onSave: (settings: ZaloZnsSettings) => void;
  onClose: () => void;
}

export const ZaloZnsConfigModal: React.FC<ZaloZnsConfigModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<ZaloZnsSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<'config' | 'guide'>('config');

  const handleSave = () => {
    onSave(formData);
    showToast('Đã lưu cấu hình Zalo ZNS Doanh Nghiệp thành công!', 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(0, 104, 255, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: '#0068ff',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0, 104, 255, 0.3)',
            }}>
              <MessageSquare size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Cấu Hình Zalo ZNS (Zalo Notification Service)
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Gửi thông báo đối soát & công nợ tự động có Tích Xanh Doanh Nghiệp
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Sub-tabs: Config vs Guide */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '0 20px',
        }}>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'config' ? '#0068ff' : 'var(--text-muted)',
              borderBottom: activeTab === 'config' ? '2.5px solid #0068ff' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Key size={16} />
            <span>Thông Số API & Mẫu Tin</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            style={{
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'guide' ? '#0068ff' : 'var(--text-muted)',
              borderBottom: activeTab === 'guide' ? '2.5px solid #0068ff' : '2.5px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <HelpCircle size={16} />
            <span>Hướng Dẫn Kết Nối Zalo OA (3 Bước)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px' }}>
          {activeTab === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Test Mode Toggle Banner */}
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: formData.isTestMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${formData.isTestMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {formData.isTestMode ? <Zap size={20} color="#d97706" /> : <ShieldCheck size={20} color="#059669" />}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: formData.isTestMode ? '#b45309' : '#047857' }}>
                      {formData.isTestMode ? 'Chế độ Thử Nghiệm / Demo (Mô Phỏng Gửi)' : 'Chế độ Chạy Thật (Live Production)'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {formData.isTestMode 
                        ? 'Hệ thống giả lập gửi tin thành công để bạn kiểm tra luồng hoạt động trước khi nạp token Zalo.'
                        : 'Tin nhắn ZNS sẽ được gửi trực tiếp đến Zalo của khách hàng và tính phí Zalo.'}
                    </div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={formData.isTestMode}
                    onChange={(e) => setFormData({ ...formData, isTestMode: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Bật Thử Nghiệm</span>
                </label>
              </div>

              {/* Company Display Name */}
              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={14} /> Tên Doanh Nghiệp (Hiển thị trong tin nhắn ZNS):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.companyName || ''}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="VD: ĐỨC TÍN LOGISTICS, TRƯỜNG PHÚC LOGISTICS..."
                />
              </div>

              {/* 2-Column Inputs: App ID & Secret Key */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="input-label">App ID (Zalo for Developers):</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.appId}
                    onChange={(e) => setFormData({ ...formData, appId: e.target.value.trim() })}
                    placeholder="VD: 18273649102837..."
                  />
                </div>
                <div>
                  <label className="input-label">Secret Key của App:</label>
                  <input
                    type="password"
                    className="input-field"
                    value={formData.secretKey}
                    onChange={(e) => setFormData({ ...formData, secretKey: e.target.value.trim() })}
                    placeholder="Nhập secret key..."
                  />
                </div>
              </div>

              {/* 2-Column Inputs: OA ID & Template ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="input-label">Zalo OA ID (Official Account):</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.oaId}
                    onChange={(e) => setFormData({ ...formData, oaId: e.target.value.trim() })}
                    placeholder="VD: 3847291048572..."
                  />
                </div>
                <div>
                  <label className="input-label">Template ID (ID Mẫu Tin ZNS Đối Soát):</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.templateId}
                    onChange={(e) => setFormData({ ...formData, templateId: e.target.value.trim() })}
                    placeholder="VD: 341829..."
                  />
                </div>
              </div>

              {/* Access Token / Refresh Token */}
              <div>
                <label className="input-label">Access Token / Refresh Token (Zalo OpenAPI):</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={formData.accessToken || ''}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value.trim() })}
                  placeholder="Dán Access Token Zalo OpenAPI tại đây (tạo từ Zalo for Developers)..."
                  style={{ fontFamily: 'monospace', fontSize: 11.5 }}
                />
              </div>

              {/* Test Phone Number */}
              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14} /> Số Điện Thoại Nhận Thử Nghiệm (Tùy chọn):
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.testPhoneNumber || ''}
                  onChange={(e) => setFormData({ ...formData, testPhoneNumber: e.target.value.trim() })}
                  placeholder="VD: 0988123456"
                />
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#0068ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} /> Bước 1: Tạo App trên Zalo for Developers
                </h4>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  Truy cập trang <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" style={{ color: '#0068ff', fontWeight: 600 }}>developers.zalo.me <ExternalLink size={12} style={{ display: 'inline' }} /></a>, đăng nhập tài khoản Zalo, bấm <strong>Tạo Ứng Dụng Mới</strong> và liên kết với Zalo Official Account (OA) của doanh nghiệp bạn.
                </p>
              </div>

              <div style={{
                background: 'var(--bg-secondary)',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#0068ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} /> Bước 2: Đăng ký Mẫu Tin Nhắn ZNS
                </h4>
                <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)' }}>
                  Truy cập <a href="https://business.zalo.me" target="_blank" rel="noreferrer" style={{ color: '#0068ff', fontWeight: 600 }}>business.zalo.me <ExternalLink size={12} style={{ display: 'inline' }} /></a> → Chọn <strong>ZNS</strong> → <strong>Tạo Mẫu Tin</strong>:
                </p>
                <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                  <li>Loại mẫu: <strong>Thông báo giao dịch / Đối soát tài chính</strong>.</li>
                  <li>Các trường tham số bao gồm: <code>shop_name</code>, <code>period_name</code>, <code>total_orders</code>, <code>total_cod</code>, <code>total_fee</code>, <code>total_net_payout</code>, <code>statement_link</code>.</li>
                  <li>Sau khi Zalo duyệt mẫu (thường mất vài giờ), copy <strong>Template ID</strong> dán vào phần cấu hình.</li>
                </ul>
              </div>

              <div style={{
                background: 'var(--bg-secondary)',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#0068ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} /> Bước 3: Lấy Access Token & Bắt đầu gửi
                </h4>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  Tạo Access Token với quyền <code>oa.zns</code> từ công cụ API Explorer của Zalo, dán vào ô <strong>Access Token</strong> ở tab bên cạnh và bấm Lưu Cấu Hình.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            🔒 Dữ liệu bảo mật và lưu trữ an toàn trên máy chủ của bạn.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '7px 16px' }}>
              Hủy
            </button>
            <button onClick={handleSave} className="btn btn-primary btn-sm" style={{ padding: '7px 20px', background: '#0068ff', borderColor: '#0068ff' }}>
              <Save size={15} />
              <span>Lưu Cấu Hình</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
