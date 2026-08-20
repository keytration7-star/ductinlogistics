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
    .flatMap(session => session.statements
      .filter(statement => statement.shopId === shop.id || statement.shopCode === shop.code)
      .map(statement => ({ session, statement })))
    .sort((a, b) => a.session.createdAt.localeCompare(b.session.createdAt));

  if (statements.length === 0) return shop.previousDebt || 0;

  const initialDebt = statements[0].statement.previousDebt ?? shop.previousDebt ?? 0;
  return statements.reduce((balance, { session, statement }) => {
    const paid = getStatementPaidAmount(statement, session.id, payments);
    return balance + statement.totalNetPayout - paid;
  }, initialDebt);
}
