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

export function isShopMatching(
  shop: { id?: string; code?: string; name?: string; nameAliases?: string[]; shopId?: string; shopCode?: string; shopName?: string } | null | undefined,
  target: { id?: string; code?: string; name?: string; nameAliases?: string[]; shopId?: string; shopCode?: string; shopName?: string } | null | undefined
): boolean {
  if (!shop || !target) return false;
  const sId = shop.id || shop.shopId;
  const sCode = shop.code || shop.shopCode;
  const sName = shop.name || shop.shopName;
  const sAliases = shop.nameAliases;

  const tId = target.id || target.shopId;
  const tCode = target.code || target.shopCode;
  const tName = target.name || target.shopName;
  const tAliases = target.nameAliases;

  if (tId && sId && (tId === sId || (sCode && tId === sCode) || (tCode && sId === tCode))) return true;
  if (tCode && sCode && tCode.toLowerCase() === sCode.toLowerCase()) return true;
  
  if (tName && sName) {
    const tn = tName.trim().toLowerCase();
    const sn = sName.trim().toLowerCase();
    if (tn === sn) return true;
    if (sAliases && sAliases.some(alias => alias.trim().toLowerCase() === tn)) return true;
    if (tAliases && tAliases.some(alias => alias.trim().toLowerCase() === sn)) return true;
  }
  return false;
}

export function getStatementPaidAmount(
  statement: ShopSettlementStatement,
  sessionId: string | undefined,
  payments: PaymentRecord[]
): number {
  return payments
    .filter(payment => !payment.voidedAt
      && (!sessionId || payment.sessionId === sessionId)
      && (payment.shopId === statement.shopId || payment.shopCode === statement.shopCode || (payment.shopName && statement.shopName && payment.shopName.trim().toLowerCase() === statement.shopName.trim().toLowerCase()))
      && payment.type !== 'COLLECTION'
      && payment.type !== 'DEBT_ADD')
    .reduce((total, payment) => total + payment.amount, 0);
}

export function getStatementCollectedAmount(
  statement: ShopSettlementStatement,
  sessionId: string | undefined,
  payments: PaymentRecord[]
): number {
  return payments
    .filter(payment => !payment.voidedAt
      && (payment.shopId === statement.shopId || payment.shopCode === statement.shopCode || (payment.shopName && statement.shopName && payment.shopName.trim().toLowerCase() === statement.shopName.trim().toLowerCase()))
      && payment.type === 'COLLECTION'
      && (!sessionId || payment.sessionId === sessionId || payment.sessionId === 'CASH_SETTLEMENT'))
    .reduce((total, payment) => total + payment.amount, 0);
}

export function getStatementDebtAddedAmount(
  statement: ShopSettlementStatement,
  sessionId: string | undefined,
  payments: PaymentRecord[]
): number {
  return payments
    .filter(payment => !payment.voidedAt
      && (payment.shopId === statement.shopId || payment.shopCode === statement.shopCode || (payment.shopName && statement.shopName && payment.shopName.trim().toLowerCase() === statement.shopName.trim().toLowerCase()))
      && payment.type === 'DEBT_ADD'
      && (!sessionId || payment.sessionId === sessionId || payment.sessionId === 'CASH_SETTLEMENT'))
    .reduce((total, payment) => total + payment.amount, 0);
}

export function calculateStatementSettlement(
  statement: ShopSettlementStatement,
  paidAmount = 0,
  collectedAmount = 0,
  debtAddedAmount = 0
): StatementSettlement {
  const openingDebt = statement.previousDebt || 0;
  const currentPeriodNet = statement.totalNetPayout || 0;
  const balanceBeforePayment = openingDebt + currentPeriodNet + collectedAmount - debtAddedAmount;
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
 * period's net settlement and actual bank transfers. */
export function calculateOpeningDebtForNewStatement(
  shop: Shop,
  sessions: ReconciliationSession[],
  payments: PaymentRecord[]
): number {
  const statements = sessions
    .flatMap(session => (session.statements || [])
      .filter(statement => isShopMatching(shop, statement))
      .map(statement => ({ session, statement })))
    .sort((a, b) => new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime());

  // Khoản thu tiền mặt / xóa nợ (+) và khoản thêm nợ (-) đã ghi nhận từ shop
  const collections = payments
    .filter(p => !p.voidedAt && isShopMatching(shop, p) && p.type === 'COLLECTION')
    .reduce((sum, p) => sum + p.amount, 0);

  const debtAdds = payments
    .filter(p => !p.voidedAt && isShopMatching(shop, p) && p.type === 'DEBT_ADD')
    .reduce((sum, p) => sum + p.amount, 0);

  const initialDebt = (shop.previousDebt ?? 0) + collections - debtAdds;
  if (statements.length === 0) return initialDebt;

  return statements.reduce((balance, { session, statement }) => {
    const paid = payments
      .filter(payment => !payment.voidedAt
        && payment.sessionId === session.id
        && isShopMatching(shop, payment)
        && payment.type !== 'COLLECTION'
        && payment.type !== 'DEBT_ADD')
      .reduce((total, payment) => total + payment.amount, 0);
    return balance + statement.totalNetPayout - paid;
  }, initialDebt);
}

/**
 * Dynamically calculates the live unpaid opening debt from all prior sessions
 * up to the current session.
 */
export function calculateLiveOpeningDebtForStatement(
  statement: ShopSettlementStatement,
  currentSession: ReconciliationSession,
  sessions: ReconciliationSession[],
  payments: PaymentRecord[],
  shop?: Shop
): number {
  const shopMatcher = shop || {
    id: statement.shopId,
    code: statement.shopCode,
    name: statement.shopName,
  };

  // Find all statements of this shop in sessions created strictly BEFORE currentSession
  const priorItems = sessions
    .filter(s => s.id !== currentSession.id && new Date(s.createdAt).getTime() < new Date(currentSession.createdAt).getTime())
    .flatMap(session => (session.statements || [])
      .filter(st => isShopMatching(shopMatcher, st))
      .map(st => ({ session, statement: st })))
    .sort((a, b) => new Date(a.session.createdAt).getTime() - new Date(b.session.createdAt).getTime());

  // Khoản thu tiền mặt / xóa nợ (+) và khoản thêm nợ (-) đã ghi nhận
  const priorCollections = payments
    .filter(p => !p.voidedAt
      && isShopMatching(shopMatcher, p)
      && p.type === 'COLLECTION')
    .reduce((sum, p) => sum + p.amount, 0);

  const priorDebtAdds = payments
    .filter(p => !p.voidedAt
      && isShopMatching(shopMatcher, p)
      && p.type === 'DEBT_ADD')
    .reduce((sum, p) => sum + p.amount, 0);

  const initialDebt = (shop?.previousDebt ?? 0) + priorCollections - priorDebtAdds;
  if (priorItems.length === 0) {
    return initialDebt;
  }

  return priorItems.reduce((balance, { session, statement: st }) => {
    const paid = payments
      .filter(payment => !payment.voidedAt
        && payment.sessionId === session.id
        && isShopMatching(shopMatcher, payment)
        && payment.type !== 'COLLECTION'
        && payment.type !== 'DEBT_ADD')
      .reduce((total, payment) => total + payment.amount, 0);
    return balance + st.totalNetPayout - paid;
  }, initialDebt);
}
