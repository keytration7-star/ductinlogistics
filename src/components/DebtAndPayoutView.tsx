import React, { useState, useEffect } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { 
  CreditCard, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Search, 
  Trash2, 
  History, 
  Building2, 
  X, 
  CheckCircle,
  Layers,
  FileSpreadsheet,
  Zap,
  Eye,
} from 'lucide-react';
import type { ReconciliationSession, Shop, UserAccount, PaymentRecord, PayoutStatus, ShopSettlementStatement } from '../types';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';
import { cleanSessionName } from '../utils/periodUtils';

interface DebtAndPayoutViewProps {
  sessions: ReconciliationSession[];
  shops: Shop[];
  currentUser: UserAccount;
  onRefreshSessions?: () => void;
}

export const DebtAndPayoutView: React.FC<DebtAndPayoutViewProps> = ({
  sessions,
  shops,
  currentUser,
  onRefreshSessions,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const [activeSubTab, setActiveSubTab] = useState<'sessions' | 'shops' | 'history'>('sessions');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'HOLD'>('ALL');

  // Active Session Detail Modal State
  const [activeDetailSession, setActiveDetailSession] = useState<ReconciliationSession | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Modal State for Payout Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetSession, setTargetSession] = useState<ReconciliationSession | null>(null);
  const [targetStatement, setTargetStatement] = useState<ShopSettlementStatement | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payRef, setPayRef] = useState<string>('');
  const [payBank, setPayBank] = useState<string>('');
  const [payNote, setPayNote] = useState<string>('');

  // Load Payments from Storage
  const reloadPayments = () => {
    const list = StorageService.getPaymentRecords();
    setPayments(list);
  };

  useEffect(() => {
    reloadPayments();
  }, []);

  // Helper to format currency
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  // Compute Payout Stats for a specific Shop in a Session
  const getStatementPayoutInfo = (sessionId: string, shopId: string, totalNetPayout: number) => {
    const statementPayments = payments.filter(p => p.sessionId === sessionId && p.shopId === shopId);
    const paidAmount = statementPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingDebt = Math.max(0, totalNetPayout - paidAmount);

    let status: PayoutStatus = 'UNPAID';
    if (paidAmount >= totalNetPayout && totalNetPayout > 0) {
      status = 'PAID';
    } else if (paidAmount > 0) {
      status = 'PARTIAL';
    }

    return { paidAmount, remainingDebt, status, statementPayments };
  };

  // Compute Overall Stats Across All Sessions
  let grandTotalNetPayout = 0;
  let grandTotalPaid = 0;

  sessions.forEach(session => {
    session.statements.forEach(stmt => {
      grandTotalNetPayout += stmt.totalNetPayout;
      const { paidAmount } = getStatementPayoutInfo(session.id, stmt.shopId, stmt.totalNetPayout);
      grandTotalPaid += paidAmount;
    });
  });

  const grandRemainingDebt = Math.max(0, grandTotalNetPayout - grandTotalPaid);

  // Open Payout Modal
  const handleOpenPayModal = (session: ReconciliationSession, statement: ShopSettlementStatement) => {
    const { remainingDebt } = getStatementPayoutInfo(session.id, statement.shopId, statement.totalNetPayout);
    setTargetSession(session);
    setTargetStatement(statement);
    setPayAmount(remainingDebt.toString());
    setPayRef('');
    setPayBank(statement.bankInfo?.bankName || 'Vietcombank');
    setPayNote(`Thanh toán đối soát kỳ ${session.sessionName}`);
    setIsModalOpen(true);
  };

  // Submit Payout
  const handleSubmitPayout = () => {
    if (!targetSession || !targetStatement) return;
    const amountNum = parseFloat(payAmount.replace(/[^0-9.]/g, ''));
    if (!amountNum || amountNum <= 0) {
      showToast('Vui lòng nhập số tiền chuyển khoản hợp lệ.', 'warning');
      return;
    }

    StorageService.savePaymentRecord({
      sessionId: targetSession.id,
      sessionName: targetSession.sessionName,
      shopId: targetStatement.shopId,
      shopCode: targetStatement.shopCode,
      shopName: targetStatement.shopName,
      amount: amountNum,
      paidByUsername: currentUser.username,
      paidByFullName: currentUser.fullName,
      bankName: payBank,
      transactionRef: payRef,
      note: payNote,
    });

    showToast(`Đã lưu nhật ký đi tiền ${formatVND(amountNum)} cho Shop ${targetStatement.shopName}!`, 'success');
    setIsModalOpen(false);
    reloadPayments();
    if (onRefreshSessions) onRefreshSessions();
  };

  // Delete Payment Record (Admin Only)
  const handleDeletePayment = async (payId: string) => {
    const ok = await showConfirm({
      title: 'Xóa nhật ký chuyển khoản',
      message: 'Bạn có chắc chắn muốn xóa bản ghi chuyển khoản này không? Thao tác này sẽ cập nhật lại dư nợ của Shop.',
      danger: true,
    });
    if (ok) {
      StorageService.deletePaymentRecord(payId);
      showToast('Đã xóa lịch sử chuyển khoản.', 'info');
      reloadPayments();
    }
  };
  // Export Session Payout Excel
  const handleExportSessionPayoutExcel = async (session: ReconciliationSession) => {
    const exportItems = session.statements.map(stmt => {
      const { remainingDebt, status } = getStatementPayoutInfo(session.id, stmt.shopId, stmt.totalNetPayout);
      let statusText = 'Đã đi tiền đủ';
      if (status === 'UNPAID') statusText = 'Chưa đi tiền';
      if (status === 'PARTIAL') statusText = 'Đã đi 1 phần';

      return {
        shopCode: stmt.shopCode,
        shopName: stmt.shopName,
        bankName: stmt.bankInfo?.bankName || '',
        accountNumber: stmt.bankInfo?.accountNumber || '',
        accountHolder: stmt.bankInfo?.accountHolder || stmt.shopName,
        amount: remainingDebt > 0 ? remainingDebt : stmt.totalNetPayout,
        sessionName: session.sessionName,
        statusText,
      };
    });

    await ExcelService.exportBankPayoutExcel(exportItems, session.sessionName);
    showToast(`Đã xuất file Excel chuyển khoản ngân hàng kỳ ${session.sessionName}!`, 'success');
  };

  // Batch Mark Session Paid
  const handleBatchMarkPaid = async (session: ReconciliationSession) => {
    const unpaidStmts = session.statements.filter(stmt => {
      const { remainingDebt } = getStatementPayoutInfo(session.id, stmt.shopId, stmt.totalNetPayout);
      return remainingDebt > 0;
    });

    if (unpaidStmts.length === 0) {
      showToast('Tất cả Shop trong kỳ này đã được đi tiền đủ!', 'info');
      return;
    }

    const totalUnpaidDebt = unpaidStmts.reduce((sum, stmt) => {
      const { remainingDebt } = getStatementPayoutInfo(session.id, stmt.shopId, stmt.totalNetPayout);
      return sum + remainingDebt;
    }, 0);

    const ok = await showConfirm({
      title: `Đi Tiền Hàng Loạt (${unpaidStmts.length} Shop)`,
      message: `Bạn có chắc muốn đánh dấu ĐÃ ĐI TIỀN HÀNG LOẠT cho ${unpaidStmts.length} Shop với tổng số tiền ${formatVND(totalUnpaidDebt)}?`,
      confirmText: 'Xác Nhận Đã Chuyển',
    });

    if (ok) {
      unpaidStmts.forEach(stmt => {
        const { remainingDebt } = getStatementPayoutInfo(session.id, stmt.shopId, stmt.totalNetPayout);
        if (remainingDebt > 0) {
          StorageService.savePaymentRecord({
            sessionId: session.id,
            sessionName: session.sessionName,
            shopId: stmt.shopId,
            shopCode: stmt.shopCode,
            shopName: stmt.shopName,
            amount: remainingDebt,
            paidByUsername: currentUser.username,
            paidByFullName: currentUser.fullName,
            bankName: stmt.bankInfo?.bankName || 'Chuyển khoản hàng loạt',
            transactionRef: `BATCH_${Date.now()}`,
            note: `Thanh toán hàng loạt kỳ đối soát ${session.sessionName}`,
          });
        }
      });

      showToast(`Đã ghi nhận đi tiền hàng loạt ${formatVND(totalUnpaidDebt)} cho ${unpaidStmts.length} Shop!`, 'success');
      reloadPayments();
      if (onRefreshSessions) onRefreshSessions();
    }
  };

  // Quick Bank Selection Tags
  const QUICK_BANKS = ['Vietcombank', 'MB Bank', 'Techcombank', 'VPBank', 'TPBank', 'ACB', 'BIDV', 'VietinBank'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={26} color="var(--primary)" />
            Quản Lý Công Nợ & Đi Tiền Ngân Hàng Cho Khách (Shop)
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Theo dõi tiến độ chuyển khoản, nhật ký giao dịch ngân hàng và quản lý dư nợ công nợ tồn đọng của từng Shop.
          </p>
        </div>

        {/* Sub-Tab Navigation */}
        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, gap: 4 }}>
          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`btn btn-sm ${activeSubTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            <Layers size={14} />
            <span>Đi Tiền Theo Kỳ ({sessions.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('shops')}
            className={`btn btn-sm ${activeSubTab === 'shops' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            <Building2 size={14} />
            <span>Sổ Nợ Khách Hàng ({shops.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`btn btn-sm ${activeSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            <History size={14} />
            <span>Nhật Ký Chuyển Khoản ({payments.length})</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
      }}>
        {/* Stat 1: Total Payout Needed */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Wallet size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Tổng Cần Chuyển Tất Cả Kỳ
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginTop: 2 }}>
              {formatVND(grandTotalNetPayout)}
            </div>
          </div>
        </div>

        {/* Stat 2: Total Paid Amount */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Đã Đi Tiền Ngân Hàng
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
              {formatVND(grandTotalPaid)}
            </div>
          </div>
        </div>

        {/* Stat 3: Remaining Unpaid Debt */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: grandRemainingDebt > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: grandRemainingDebt > 0 ? 'var(--danger)' : 'var(--success)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Dư Nợ Còn Phải Đi Tiền
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: grandRemainingDebt > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 2 }}>
              {formatVND(grandRemainingDebt)}
            </div>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: SESSION PAYOUT TRACKER */}
      {activeSubTab === 'sessions' && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="var(--primary)" />
              Danh Sách Kỳ Đối Soát & Đi Tiền Khách Hàng
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder="Tìm kỳ hoặc shop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ padding: '6px 10px 6px 30px', fontSize: 13 }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="select-field"
                style={{ padding: '6px 10px', fontSize: 13 }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="UNPAID">🔴 Chưa đi tiền</option>
                <option value="PARTIAL">🔵 Chuyển 1 phần</option>
                <option value="PAID">🟢 Đã đi tiền đủ</option>
              </select>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              Chưa có kỳ đối soát nào được lưu trong hệ thống.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {sessions
                .filter(session => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    session.sessionName.toLowerCase().includes(q) ||
                    session.statements.some(s => s.shopName.toLowerCase().includes(q) || s.shopCode.toLowerCase().includes(q))
                  );
                })
                .map((session) => {
                  // Session summary stats
                  let sessionNetPayout = 0;
                  let sessionPaid = 0;

                  session.statements.forEach(stmt => {
                    sessionNetPayout += stmt.totalNetPayout;
                    const { paidAmount } = getStatementPayoutInfo(session.id, stmt.shopId, stmt.totalNetPayout);
                    sessionPaid += paidAmount;
                  });

                  const sessionDebt = Math.max(0, sessionNetPayout - sessionPaid);
                  let sessionStatus: PayoutStatus = 'UNPAID';
                  if (sessionPaid >= sessionNetPayout && sessionNetPayout > 0) {
                    sessionStatus = 'PAID';
                  } else if (sessionPaid > 0) {
                    sessionStatus = 'PARTIAL';
                  }

                  return (
                    <div key={session.id} className="glass-panel" style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      padding: '16px 20px',
                      background: 'var(--bg-card)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16,
                      transition: 'all 0.2s ease',
                    }}>
                      {/* Session Info & Badges */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>
                            {cleanSessionName(session.sessionName, session.createdAt, session.carrierName)}
                          </strong>
                          <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 7px' }}>{session.carrierName}</span>
                          {session.isSupplementary && (
                            <span className="badge badge-warning" style={{ fontSize: 10, padding: '2px 8px', background: '#8b5cf6', color: '#ffffff', fontWeight: 700 }}>
                              🏷️ KỲ BÙ DỮ LIỆU SÓT
                            </span>
                          )}
                          <div>
                            {sessionStatus === 'PAID' && <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 8px' }}>🟢 Đã đi đủ</span>}
                            {sessionStatus === 'PARTIAL' && <span className="badge badge-info" style={{ fontSize: 10, padding: '2px 8px' }}>🔵 Chuyển 1 phần</span>}
                            {sessionStatus === 'UNPAID' && <span className="badge badge-danger" style={{ fontSize: 10, padding: '2px 8px' }}>🔴 Chưa đi tiền</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                          Quy mô đối soát: <strong style={{ color: 'var(--text-main)' }}>{session.statements.length} Shop</strong> • <strong style={{ color: 'var(--text-main)' }}>{session.totalOrders} đơn hàng</strong>
                        </div>
                      </div>

                      {/* Stat Metrics Summary Pills */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        background: 'var(--bg-tertiary)',
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cần Chuyển</div>
                          <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{formatVND(sessionNetPayout)}</div>
                        </div>

                        <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Đã Đi Tiền</div>
                          <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>{formatVND(sessionPaid)}</div>
                        </div>

                        <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dư Nợ Còn Lại</div>
                          <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: sessionDebt > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 2 }}>{formatVND(sessionDebt)}</div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleExportSessionPayoutExcel(session)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 12, padding: '7px 12px' }}
                          title="Xuất file Excel chứa danh sách STK Ngân Hàng và Số Tiền để nộp/tải lên iBanking"
                        >
                          <FileSpreadsheet size={14} color="var(--success)" />
                          <span>Xuất iBanking</span>
                        </button>

                        {sessionDebt > 0 && (
                          <button
                            type="button"
                            onClick={() => handleBatchMarkPaid(session)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 12, padding: '7px 12px' }}
                            title="Đánh dấu tất cả Shop trong kỳ này đã chuyển khoản xong"
                          >
                            <Zap size={14} color="var(--warning)" />
                            <span>Đi Tiền Hàng Loạt</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setActiveDetailSession(session);
                            setModalSearchQuery('');
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                        >
                          <Eye size={15} />
                          <span>Xem Chi Tiết Bảng Đi Tiền</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CUSTOMER DEBT LEDGER */}
      {activeSubTab === 'shops' && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color="var(--primary)" />
              Sổ Công Nợ Tích Lũy Chi Tiết Theo Khách Hàng (Shop)
            </h3>
          </div>

          <div style={{
            maxHeight: 480,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            position: 'relative',
          }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th>STT</th>
                  <th>Mã Shop</th>
                  <th>Tên Khách Hàng / Shop</th>
                  <th>Thông Tin Ngân Hàng</th>
                  <th style={{ textAlign: 'right' }}>Tổng Tiền COD</th>
                  <th style={{ textAlign: 'right' }}>Tổng Cước Shop</th>
                  <th style={{ textAlign: 'right' }}>Tổng Thực Trả</th>
                  <th style={{ textAlign: 'right' }}>Đã Chuyển Khoản</th>
                  <th style={{ textAlign: 'right' }}>Dư Nợ Hiện Tại</th>
                  <th style={{ textAlign: 'center' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop, idx) => {
                  let shopTotalCod = 0;
                  let shopTotalFee = 0;
                  let shopTotalNetPayout = 0;

                  sessions.forEach(sess => {
                    const stmt = sess.statements.find(s => s.shopId === shop.id || s.shopCode === shop.code);
                    if (stmt) {
                      shopTotalCod += stmt.totalCod;
                      shopTotalFee += (stmt.totalShopFee + stmt.totalShopOtherFee);
                      shopTotalNetPayout += stmt.totalNetPayout;
                    }
                  });

                  const shopPayments = payments.filter(p => p.shopId === shop.id || p.shopCode === shop.code);
                  const shopPaidTotal = shopPayments.reduce((sum, p) => sum + p.amount, 0);
                  const shopDebt = Math.max(0, shopTotalNetPayout - shopPaidTotal);
                  const isShopOwingGomdon = shopTotalNetPayout < 0;

                  return (
                    <tr key={shop.id}>
                      <td>{idx + 1}</td>
                      <td><strong className="mono" style={{ color: 'var(--primary)' }}>{shop.code}</strong></td>
                      <td>
                        <strong>{shop.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>SĐT: {shop.phone || 'N/A'}</div>
                      </td>
                      <td>
                        {shop.bankAccount?.bankName ? (
                          <div style={{ fontSize: 12 }}>
                            <div><strong>{shop.bankAccount.bankName}</strong> • <span className="mono">{shop.bankAccount.accountNumber}</span></div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shop.bankAccount.accountHolder}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Chưa cập nhật</span>
                        )}
                      </td>
                      <td className="mono" style={{ color: 'var(--info)', textAlign: 'right' }}>{formatVND(shopTotalCod)}</td>
                      <td className="mono" style={{ color: '#92400e', textAlign: 'right' }}>-{formatVND(shopTotalFee)}</td>
                      <td className="mono" style={{ fontWeight: 700, color: isShopOwingGomdon ? 'var(--danger)' : 'var(--primary)', textAlign: 'right' }}>{formatVND(shopTotalNetPayout)}</td>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>{formatVND(shopPaidTotal)}</td>
                      <td className="mono" style={{ fontWeight: 800, color: isShopOwingGomdon ? 'var(--danger)' : shopDebt > 0 ? 'var(--danger)' : 'var(--success)', textAlign: 'right' }}>
                        {isShopOwingGomdon ? `-${formatVND(Math.abs(shopTotalNetPayout))}` : formatVND(shopDebt)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isShopOwingGomdon ? (
                          <span className="badge badge-warning" style={{ fontSize: 10 }} title="Shop đang nợ tiền cước nhà gom, số tiền này sẽ tự động trừ vào kỳ đối soát có COD tiếp theo">
                            🔴 Nợ Nhà Gom {formatVND(Math.abs(shopTotalNetPayout))}
                          </span>
                        ) : shopDebt > 0 ? (
                          <span className="badge badge-danger" style={{ fontSize: 10 }}>Cần trả {formatVND(shopDebt)}</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: 10 }}>🟢 Đã hết nợ</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: BANK PAYOUT AUDIT TRAIL */}
      {activeSubTab === 'history' && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} color="var(--primary)" />
              Nhật Ký Chi Tiết Tất Cả Các Đợt Đi Tiền Ngân Hàng ({payments.length})
            </h3>
          </div>

          <div style={{
            maxHeight: 480,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            position: 'relative',
          }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th>Thời Gian Đi Tiền</th>
                  <th>Kỳ Đối Soát</th>
                  <th>Shop Nhận Tiền</th>
                  <th style={{ textAlign: 'right' }}>Số Tiền Chuyển</th>
                  <th>Ngân Hàng</th>
                  <th>Mã Giao Dịch (Ref)</th>
                  <th>Ghi Chú</th>
                  <th>Kế Toán Thực Hiện</th>
                  {currentUser.role === 'ADMIN' && <th style={{ textAlign: 'right' }}>Thao Tác</th>}
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      Chưa có lịch sử chuyển khoản ngân hàng nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  payments.map(pay => (
                    <tr key={pay.id}>
                      <td style={{ fontSize: 12 }}>
                        {new Date(pay.paidAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td><strong style={{ fontSize: 12, color: 'var(--primary)' }}>{pay.sessionName || pay.sessionId}</strong></td>
                      <td>
                        <strong>{pay.shopName}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{pay.shopCode}</div>
                      </td>
                      <td className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', textAlign: 'right' }}>
                        {formatVND(pay.amount)}
                      </td>
                      <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{pay.bankName || 'N/A'}</span></td>
                      <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{pay.transactionRef || '---'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pay.note || 'Không có ghi chú'}</td>
                      <td style={{ fontSize: 12 }}>
                        <strong>{pay.paidByFullName}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{pay.paidByUsername}</div>
                      </td>
                      {currentUser.role === 'ADMIN' && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(pay.id)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Xóa bản ghi thanh toán này"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🚀 SLEEK ENTERPRISE SESSION DETAIL POPUP MODAL */}
      {activeDetailSession && (
        <div 
          className="modal-overlay" 
          style={{ 
            backdropFilter: 'blur(8px)', 
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }} 
          onClick={() => setActiveDetailSession(null)}
        >
          <div 
            className="modal-content glass-panel" 
            style={{ 
              maxWidth: 1150, 
              width: '96vw', 
              maxHeight: '88vh',
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 16,
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                    {cleanSessionName(activeDetailSession.sessionName, activeDetailSession.createdAt, activeDetailSession.carrierName)}
                  </h3>
                  <span className="badge badge-primary">{activeDetailSession.carrierName}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                  Bảng kê đi tiền chi tiết cho {activeDetailSession.statements.length} Shop • Tổng {activeDetailSession.totalOrders} đơn hàng đối soát
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Search Bar inside Modal */}
                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    placeholder="Tìm shop trong kỳ..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="input-field"
                    style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
                  />
                </div>

                <button 
                  type="button"
                  onClick={() => setActiveDetailSession(null)} 
                  className="btn btn-secondary btn-sm" 
                  style={{ padding: '6px 8px' }}
                  title="Đóng cửa sổ"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <tr>
                    <th>Mã Shop</th>
                    <th>Tên Shop</th>
                    <th>Thông Tin Ngân Hàng</th>
                    <th style={{ textAlign: 'right' }}>Tiền COD</th>
                    <th style={{ textAlign: 'right' }}>Cước Shop</th>
                    <th style={{ textAlign: 'right' }}>Thực Chuyển</th>
                    <th style={{ textAlign: 'right' }}>Đã Chuyển</th>
                    <th style={{ textAlign: 'right' }}>Còn Nợ</th>
                    <th style={{ textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDetailSession.statements
                    .filter(stmt => {
                      if (!modalSearchQuery) return true;
                      const q = modalSearchQuery.toLowerCase();
                      return stmt.shopName.toLowerCase().includes(q) || stmt.shopCode.toLowerCase().includes(q);
                    })
                    .map(stmt => {
                      const { paidAmount, remainingDebt, status } = getStatementPayoutInfo(activeDetailSession.id, stmt.shopId, stmt.totalNetPayout);

                      return (
                        <tr key={stmt.shopId}>
                          <td><strong className="mono" style={{ color: 'var(--primary)', fontSize: 12 }}>{stmt.shopCode}</strong></td>
                          <td>
                            <strong style={{ fontSize: 13 }}>{stmt.shopName}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>SĐT: {stmt.shopPhone || 'N/A'}</div>
                          </td>
                          <td>
                            {stmt.bankInfo?.bankName ? (
                              <div style={{ fontSize: 12 }}>
                                <div><strong>{stmt.bankInfo.bankName}</strong> • <span className="mono">{stmt.bankInfo.accountNumber}</span></div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stmt.bankInfo.accountHolder}</div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>⚠️ Chưa có STK</span>
                            )}
                          </td>
                          <td className="mono" style={{ color: 'var(--info)', textAlign: 'right' }}>{formatVND(stmt.totalCod)}</td>
                          <td className="mono" style={{ color: '#92400e', textAlign: 'right' }}>-{formatVND(stmt.totalShopFee + stmt.totalShopOtherFee)}</td>
                          <td className="mono" style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>{formatVND(stmt.totalNetPayout)}</td>
                          <td className="mono" style={{ fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>{formatVND(paidAmount)}</td>
                          <td className="mono" style={{ fontWeight: 800, color: remainingDebt > 0 ? 'var(--danger)' : 'var(--success)', textAlign: 'right' }}>
                            {formatVND(remainingDebt)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {stmt.totalNetPayout < 0 ? (
                              <span className="badge badge-warning" style={{ fontSize: 10 }}>
                                🔴 Shop nợ {formatVND(Math.abs(stmt.totalNetPayout))}
                              </span>
                            ) : (
                              <>
                                {status === 'PAID' && <span className="badge badge-success" style={{ fontSize: 10 }}>🟢 Đã đủ</span>}
                                {status === 'PARTIAL' && <span className="badge badge-info" style={{ fontSize: 10 }}>🔵 1 phần</span>}
                                {status === 'UNPAID' && <span className="badge badge-danger" style={{ fontSize: 10 }}>🔴 Chưa đi</span>}
                              </>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(activeDetailSession, stmt)}
                              className={`btn btn-sm ${remainingDebt > 0 ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '4px 12px', fontSize: 11 }}
                            >
                              <DollarSign size={13} />
                              <span>{remainingDebt > 0 ? 'Đi Tiền' : 'Chi Tiết'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
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
                Hiển thị <strong>{activeDetailSession.statements.length} Shop</strong> trong kỳ đối soát
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleExportSessionPayoutExcel(activeDetailSession)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  <FileSpreadsheet size={14} color="var(--success)" />
                  <span>Xuất File Excel iBanking</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailSession(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, padding: '6px 16px' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYOUT FORM MODAL */}
      {isModalOpen && targetSession && targetStatement && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <DollarSign size={22} color="var(--success)" />
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800 }}>Xác Nhận Đi Tiền Ngân Hàng</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Shop: <strong style={{ color: 'var(--primary)' }}>{targetStatement.shopName} ({targetStatement.shopCode})</strong>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px 6px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Bank Account Info Box */}
              {targetStatement.bankInfo?.bankName && (
                <div style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(79, 70, 229, 0.08) 100%)',
                  border: '1.5px solid var(--success)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 4 }}>
                    💳 Tài Khoản Ngân Hàng Nhận Tiền Của Shop
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                    {targetStatement.bankInfo.bankName} • <span className="mono">{targetStatement.bankInfo.accountNumber}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Chủ tài khoản: <strong>{targetStatement.bankInfo.accountHolder}</strong>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="input-group">
                <label className="input-label">Số tiền chuyển khoản (VND) *</label>
                <input
                  type="text"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Nhập số tiền..."
                  className="input-field mono"
                  style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}
                />
              </div>

              {/* Bank Name Selector */}
              <div>
                <label className="input-label" style={{ marginBottom: 6, display: 'block' }}>Ngân hàng thực hiện chuyển khoản:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {QUICK_BANKS.map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setPayBank(bank)}
                      className={`btn btn-sm ${payBank === bank ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={payBank}
                  onChange={(e) => setPayBank(e.target.value)}
                  placeholder="Hoặc gõ tên ngân hàng..."
                  className="input-field"
                  style={{ fontSize: 13 }}
                />
              </div>

              {/* Transaction Ref ID */}
              <div className="input-group">
                <label className="input-label">Mã giao dịch ngân hàng / Mã tra cứu (FT...)</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Ví dụ: FT240809123456"
                  className="input-field mono"
                  style={{ fontSize: 13 }}
                />
              </div>

              {/* Note */}
              <div className="input-group">
                <label className="input-label">Ghi chú thanh toán</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Ghi chú thêm..."
                  className="input-field"
                  style={{ fontSize: 13 }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Hủy Bỏ
                </button>
                <button type="button" onClick={handleSubmitPayout} className="btn btn-primary">
                  <CheckCircle size={16} />
                  <span>Xác Nhận Đã Đi Tiền</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
