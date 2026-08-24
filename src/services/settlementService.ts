import type { PaymentRecord, ReconciliationSession, Shop, ShopSettlementStatement } from '../types';

/**
 * Signed shop balance convention used everywhere in the system:
 *   positive = company must pay the shop
 *   negative = shop owes the company
 */
export interface StatementSettlement {
  openingDebt: number;
  currentPeriodNet: number;
  balanceBeforePayment: number;
  paidAmount: number;
  closingBalance: number;
  amountPayable: number;
  amountShopOwes: number;
}

export function getStatementPaidAmount(
  statement: ShopSettlementStatement,
  sessionId: string | undefined,
  payments: PaymentRecord[]
): number {
  return payments
    .filter(payment => !payment.voidedAt
      && (!sessionId || payment.sessionId === sessionId)
      && (payment.shopId === statement.shopId || payment.shopCode === statement.shopCode))
    .reduce((total, payment) => total + payment.amount, 0);
}

export function calculateStatementSettlement(
  statement: ShopSettlementStatement,
  paidAmount = 0
): StatementSettlement {
  const openingDebt = statement.previousDebt || 0;
  const currentPeriodNet = statement.totalNetPayout || 0;
  const balanceBeforePayment = openingDebt + currentPeriodNet;
  const closingBalance = balanceBeforePayment - paidAmount;
  return {
    openingDebt,
    currentPeriodNet,
    balanceBeforePayment,
    paidAmount,
    closingBalance,
    amountPayable: Math.max(0, closingBalance),
    amountShopOwes: Math.max(0, -closingBalance),
  };
}

/** Opening debt for a new statement is the seed balance plus every prior
 * period's net settlement and actual bank transfers.  The opening balance is
 * then snapshotted onto the new statement, never recalculated from a later
 * edit of the shop profile. */
export function calculateOpeningDebtForNewStatement(
  shop: Shop,
  sessions: ReconciliationSession[],
  payments: PaymentRecord[]
): number {
  const statements = sessions
    .flatMap(session => (session.statements || [])
      .filter(statement => statement.shopId === shop.id || statement.shopCode === shop.code)
      .map(statement => ({ session, statement })))
    .sort((a, b) => new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime());

  // Khoản thu tiền mặt / xóa nợ đã ghi nhận từ shop
  const collections = payments
    .filter(p => !p.voidedAt && (p.shopId === shop.id || p.shopCode === shop.code) && p.type === 'COLLECTION')
    .reduce((sum, p) => sum + p.amount, 0);

  const initialDebt = (shop.previousDebt ?? 0) + collections;
  if (statements.length === 0) return initialDebt;

  return statements.reduce((balance, { session, statement }) => {
    const paid = payments
      .filter(payment => !payment.voidedAt
        && payment.sessionId === session.id
        && (payment.shopId === statement.shopId || payment.shopCode === statement.shopCode)
        && payment.type !== 'COLLECTION')
      .reduce((total, payment) => total + payment.amount, 0);
    return balance + statement.totalNetPayout - paid;
  }, initialDebt);
}

/**
 * Dynamically calculates the live unpaid opening debt from all prior sessions
 * up to the current session. When a prior session is paid, subsequent sessions
 * automatically reflect the reduced opening balance in real time.
 */
export function calculateLiveOpeningDebtForStatement(
  statement: ShopSettlementStatement,
  currentSession: ReconciliationSession,
  sessions: ReconciliationSession[],
  payments: PaymentRecord[],
  shop?: Shop
): number {
  const shopId = statement.shopId;
  const shopCode = statement.shopCode;

  // Find all statements of this shop in sessions created strictly BEFORE currentSession
  const priorItems = sessions
    .filter(s => s.id !== currentSession.id && new Date(s.createdAt).getTime() < new Date(currentSession.createdAt).getTime())
    .flatMap(session => (session.statements || [])
      .filter(st => st.shopId === shopId || st.shopCode === shopCode)
      .map(st => ({ session, statement: st })))
    .sort((a, b) => new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime());

  // Khoản thu tiền mặt / xóa nợ đã ghi nhận trước hoặc tại thời điểm session này
  const priorCollections = payments
    .filter(p => !p.voidedAt
      && (p.shopId === shopId || p.shopCode === shopCode)
      && p.type === 'COLLECTION'
      && new Date(p.paidAt).getTime() <= new Date(currentSession.createdAt).getTime())
    .reduce((sum, p) => sum + p.amount, 0);

  const initialDebt = (shop?.previousDebt ?? 0) + priorCollections;
  if (priorItems.length === 0) {
    return initialDebt;
  }

  return priorItems.reduce((balance, { session, statement: st }) => {
    const paid = payments
      .filter(payment => !payment.voidedAt
        && payment.sessionId === session.id
        && (payment.shopId === shopId || payment.shopCode === shopCode)
        && payment.type !== 'COLLECTION')
      .reduce((total, payment) => total + payment.amount, 0);
    return balance + st.totalNetPayout - paid;
  }, initialDebt);
}
