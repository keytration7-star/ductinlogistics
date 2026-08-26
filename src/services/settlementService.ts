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

/** 
 * Tính công nợ lũy kế tuần tự (Running Balance) cho Shop:
 * - Quy tắc cốt lõi: Công nợ của Shop đối với Gom Đơn luôn <= 0 (Âm = Shop nợ cước, 0 = Hết nợ).
 * - Tuyệt đối không bao giờ có công nợ dương (> 0). Tiền dương là tiền COD thực chuyển của kỳ đó.
 */
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

  // Bắt đầu từ số nợ ban đầu (nếu có, luôn <= 0)
  let runningDebt = Math.min(0, shop.previousDebt ?? 0);

  // 1. Duyệt tuần tự qua các kỳ đối soát theo dòng thời gian
  for (const { statement } of statements) {
    const periodNet = (statement.totalCod || 0) - ((statement.totalShopFee || 0) + (statement.totalShopOtherFee || 0));
    const combined = runningDebt + periodNet;
    if (combined >= 0) {
      // Tiền COD của kỳ đủ bù toàn bộ nợ cũ -> Nợ cũ được cấn trừ dứt điểm, nợ mang sang kỳ sau = 0!
      runningDebt = 0;
    } else {
      // Tiền COD không đủ bù cước -> Shop vẫn nợ số âm còn lại
      runningDebt = combined;
    }
  }

  // 2. Cấn trừ các khoản Thu tiền mặt / Xóa nợ (COLLECTION) và Thêm nợ (DEBT_ADD)
  const collections = payments
    .filter(p => !p.voidedAt && isShopMatching(shop, p) && p.type === 'COLLECTION')
    .reduce((sum, p) => sum + p.amount, 0);

  const debtAdds = payments
    .filter(p => !p.voidedAt && isShopMatching(shop, p) && p.type === 'DEBT_ADD')
    .reduce((sum, p) => sum + p.amount, 0);

  // Áp dụng cấn trừ: Thu tiền giúp giảm nợ âm, tối đa về 0 (không bao giờ vượt 0 thành dương)
  runningDebt = runningDebt - debtAdds;
  runningDebt = Math.min(0, runningDebt + collections);

  return runningDebt;
}

/**
 * Tính công nợ đầu kỳ động cho một Statement cụ thể trong một kỳ
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

  let runningDebt = Math.min(0, shop?.previousDebt ?? 0);

  for (const { statement: st } of priorItems) {
    const periodNet = (st.totalCod || 0) - ((st.totalShopFee || 0) + (st.totalShopOtherFee || 0));
    const combined = runningDebt + periodNet;
    if (combined >= 0) {
      runningDebt = 0;
    } else {
      runningDebt = combined;
    }
  }

  const priorCollections = payments
    .filter(p => !p.voidedAt
      && isShopMatching(shopMatcher, p)
      && p.type === 'COLLECTION'
      && new Date(p.paidAt || 0).getTime() <= new Date(currentSession.createdAt).getTime())
    .reduce((sum, p) => sum + p.amount, 0);

  const priorDebtAdds = payments
    .filter(p => !p.voidedAt
      && isShopMatching(shopMatcher, p)
      && p.type === 'DEBT_ADD'
      && new Date(p.paidAt || 0).getTime() <= new Date(currentSession.createdAt).getTime())
    .reduce((sum, p) => sum + p.amount, 0);

  runningDebt = runningDebt - priorDebtAdds;
  runningDebt = Math.min(0, runningDebt + priorCollections);

  return runningDebt;
}
