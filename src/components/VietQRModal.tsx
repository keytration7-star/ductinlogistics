import React, { useState } from 'react';
import { X, Check, Copy, QrCode } from 'lucide-react';
import type { ShopSettlementStatement, ReconciliationSession } from '../types';

interface VietQRModalProps {
  statement: ShopSettlementStatement | null;
  onClose: () => void;
  amountOverride?: number;
  session?: ReconciliationSession;
}

import { BANK_CODES, toVietQrMemo } from '../constants/banks';
import { calculateStatementSettlement, calculateLiveOpeningDebtForStatement } from '../services/settlementService';
import { StorageService } from '../services/storage';

export const VietQRModal: React.FC<VietQRModalProps> = ({ statement, onClose, amountOverride, session }) => {
  const [copied, setCopied] = useState(false);

  if (!statement) return null;

  const allSessions = StorageService.getSessions();
  const allPayments = StorageService.getPaymentRecords();
  const liveShop = StorageService.getShops().find(s => 
    s.id === statement.shopId || 
    s.code === statement.shopCode || 
    (s.name && statement.shopName && s.name.trim().toLowerCase() === statement.shopName.trim().toLowerCase())
  );
  const liveBank = (liveShop?.bankAccount?.accountNumber?.trim() ? liveShop.bankAccount : statement.bankInfo) || { bankName: '', accountNumber: '', accountHolder: '' };

  const bankName = liveBank.bankName || 'MB Bank';
  const bankCode = BANK_CODES[bankName] || 'MB';
  const accountNumber = (liveBank.accountNumber || '').replace(/[^0-9]/g, '') || '091234567899';
  const accountHolder = encodeURIComponent(liveBank.accountHolder || statement.shopName);

  const currentSession = session || allSessions.find(s => (s.statements || []).some((st: ShopSettlementStatement) => st.shopId === statement.shopId && st.periodName === statement.periodName));
  const liveOpeningDebt = currentSession
    ? calculateLiveOpeningDebtForStatement(statement, currentSession, allSessions, allPayments, liveShop)
    : (statement.previousDebt || 0);

  const settlement = calculateStatementSettlement({ ...statement, previousDebt: liveOpeningDebt });
  const amount = amountOverride !== undefined ? amountOverride : settlement.amountPayable;
  const rawMemo = `DOI SOAT ${statement.shopCode} ${statement.periodName}`;
  const memo = encodeURIComponent(toVietQrMemo(rawMemo));

  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${memo}&accountName=${accountHolder}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 500, padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <QrCode size={20} color="var(--primary)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Mã VietQR Chuyển Tiền COD</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
            Thanh toán đối soát cho: <strong>{statement.shopName}</strong>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: amount > 0 ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
            {new Intl.NumberFormat('vi-VN').format(amount)} đ
          </div>

          {settlement.amountShopOwes > 0 ? (
            <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
              Shop còn nợ công ty {new Intl.NumberFormat('vi-VN').format(settlement.amountShopOwes)} đ. Không tạo mã QR chuyển tiền; số nợ sẽ chuyển sang kỳ sau.
            </div>
          ) : <div style={{
            background: '#ffffff',
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            display: 'inline-block',
            boxShadow: 'var(--shadow-md)',
            marginBottom: 16,
          }}>
            <img 
              src={qrUrl} 
              alt="VietQR Code" 
              style={{ width: 280, height: 'auto', display: 'block', borderRadius: 8 }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>}

          <div style={{
            background: 'var(--bg-primary)',
            padding: 14,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            textAlign: 'left',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ngân hàng:</span>
              <strong>{statement.bankInfo.bankName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Số tài khoản:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong className="mono" style={{ color: 'var(--primary)' }}>{statement.bankInfo.accountNumber}</strong>
                <button
                  onClick={() => copyToClipboard(statement.bankInfo.accountNumber)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                >
                  {copied ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Chủ tài khoản:</span>
              <strong>{statement.bankInfo.accountHolder}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nội dung CK:</span>
              <span className="mono" style={{ fontSize: 12 }}>DOI SOAT {statement.shopCode}</span>
            </div>
          </div>
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--bg-tertiary)',
        }}>
          <button onClick={onClose} className="btn btn-primary btn-sm">
            Đã Chuyển Tiền Xong
          </button>
        </div>
      </div>
    </div>
  );
};
