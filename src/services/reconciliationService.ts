import type {
  Shop,
  ShopPricingPlan,
  CarrierWholesaleTier,
  ReconciledOrder,
  ShopSettlementStatement,
  ReconciliationSession,
  ColumnMappingConfig,
  OrderStatus,
  CtvProfile
} from '../types';
import { parseNumber, parseWeightToKg, isSummaryOrInvalidWaybill, normalizeHeader } from './smartColumnDetector';
import { StorageService } from './storage';
import { calculateOpeningDebtForNewStatement } from './settlementService';

export interface DuplicateCheckResult {
  hasConflict: boolean;
  totalNewRows: number;
  duplicateRowsCount: number;
  uniqueNewRowsCount: number;
  conflictingSessionName?: string;
  conflictingSessionId?: string;
  conflictingSessionDate?: string;
  duplicateWaybills: Set<string>;
}

export type ShopMatchResult =
  | { matched: true; shop: Shop; method: 'phone' | 'code' | 'name' | 'name_alias' }
  | { matched: false; reason: string };

export function normalizePhone(phone: string | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) return `0${digits.slice(2)}`;
  return digits;
}

export function getShopPhones(shop: Shop): string[] {
  return [shop.phone, ...(shop.phoneList || [])]
    .flatMap(value => (value || '').split(/[,/;\s]+/))
    .map(normalizePhone)
    .filter(phone => phone.length >= 9);
}

/**
 * Matches only an unambiguous registered shop.  A reconciliation must never
 * assign money based on a partial name match: ambiguous/missing data stays in
 * the unmatched queue for an admin to review.
 */
export function findRegisteredShop(
  registeredShops: Shop[],
  identity: { phone?: string; code?: string; name?: string }
): ShopMatchResult {
  const activeShops = registeredShops.filter(shop => shop.active);
  const phone = normalizePhone(identity.phone);
  const code = normalizeHeader(identity.code || '');
  const name = normalizeHeader(identity.name || '');

  // 1. Exact Match: Name + Phone pair
  if (phone && name) {
    const paired = activeShops.filter(shop => {
      const hasPhone = getShopPhones(shop).includes(phone);
      const sName = normalizeHeader(shop.name);
      const hasName = sName === name || (shop.nameAliases || []).some(alias => normalizeHeader(alias) === name);
      return hasPhone && hasName;
    });
    if (paired.length === 1) return { matched: true, shop: paired[0], method: 'phone' };
  }

  // 2. Exact Match by Code
  if (code) {
    const codeMatched = activeShops.filter(shop => normalizeHeader(shop.code) === code);
    if (codeMatched.length === 1) return { matched: true, shop: codeMatched[0], method: 'code' };
  }

  // 3. Exact Match by Name or Alias
  if (name) {
    const nameMatched = activeShops.filter(shop => {
      const sName = normalizeHeader(shop.name);
      return sName === name || (shop.nameAliases || []).some(alias => normalizeHeader(alias) === name);
    });
    if (nameMatched.length === 1) return { matched: true, shop: nameMatched[0], method: 'name' };
  }

  // 4. Phone Match resolution among candidate shops
  if (phone) {
    const phoneCandidates = activeShops.filter(shop => getShopPhones(shop).includes(phone));
    if (phoneCandidates.length === 1) {
      return { matched: true, shop: phoneCandidates[0], method: 'phone' };
    }

    if (phoneCandidates.length > 1) {
      // Multiple shops share the same phone number. Use `name` to disambiguate!
      if (name) {
        // Substring / Fuzzy match among phone candidates
        const fuzzyMatches = phoneCandidates.filter(shop => {
          const sName = normalizeHeader(shop.name);
          const aliases = (shop.nameAliases || []).map(normalizeHeader);
          const allNames = [sName, ...aliases].filter(Boolean);
          return allNames.some(n => name.includes(n) || n.includes(name));
        });
        if (fuzzyMatches.length === 1) {
          return { matched: true, shop: fuzzyMatches[0], method: 'name' };
        }
      }
      return { matched: false, reason: `Trùng SĐT với ${phoneCandidates.length} shop (${phoneCandidates.map(s => s.name).join(', ')}). Vui lòng kiểm tra Tên shop.` };
    }
  }

  // 5. Broad Fuzzy Name Match if name is provided
  if (name) {
    const broadFuzzy = activeShops.filter(shop => {
      const sName = normalizeHeader(shop.name);
      return sName && (name.includes(sName) || sName.includes(name));
    });
    if (broadFuzzy.length === 1) {
      return { matched: true, shop: broadFuzzy[0], method: 'name' };
    }
  }

  return { matched: false, reason: 'Không có SĐT, mã shop/kho hoặc tên shop khớp chính xác với danh mục' };
}

export function checkDuplicateWaybills(
  nvcRows: Record<string, any>[],
  waybillCol: string,
  existingSessions: ReconciliationSession[],
  codCol?: string
): DuplicateCheckResult {
  if (!waybillCol || nvcRows.length === 0) {
    return {
      hasConflict: false,
      totalNewRows: 0,
      duplicateRowsCount: 0,
      uniqueNewRowsCount: 0,
      duplicateWaybills: new Set(),
    };
  }

  const existingWaybillMap = new Map<string, { sessionId: string; sessionName: string; createdAt: string; codAmount: number }>();
  for (const session of existingSessions) {
    for (const stmt of session.statements) {
      for (const order of stmt.orders) {
        if (order.waybill) {
          existingWaybillMap.set(order.waybill.trim().toUpperCase(), {
            sessionId: session.id,
            sessionName: session.sessionName,
            createdAt: session.createdAt,
            codAmount: order.codAmount || 0,
          });
        }
      }
    }
    for (const order of session.unmatchedOrders) {
      if (order.waybill) {
        existingWaybillMap.set(order.waybill.trim().toUpperCase(), {
          sessionId: session.id,
          sessionName: session.sessionName,
          createdAt: session.createdAt,
          codAmount: order.codAmount || 0,
        });
      }
    }
  }

  const duplicateWaybills = new Set<string>();
  let conflictingSessionName = '';
  let conflictingSessionId = '';
  let conflictingSessionDate = '';
  let validRowsCount = 0;

  for (const row of nvcRows) {
    const rawWaybill = row[waybillCol];
    if (isSummaryOrInvalidWaybill(rawWaybill)) continue;

    validRowsCount++;
    const key = rawWaybill.toString().trim().toUpperCase();
    if (existingWaybillMap.has(key)) {
      const matchedInfo = existingWaybillMap.get(key)!;
      const newCod = codCol ? parseNumber(row[codCol]) : 0;
      
      // If previous session recorded 0 COD (only fee) and new row brings positive COD:
      // This is a legitimate multi-stage settlement (COD payment in Period 2), NOT a duplicate conflict!
      const isLegitimateMultiStageCod = matchedInfo.codAmount === 0 && newCod > 0;

      if (!isLegitimateMultiStageCod) {
        duplicateWaybills.add(key);
        if (!conflictingSessionName) {
          conflictingSessionName = matchedInfo.sessionName;
          conflictingSessionId = matchedInfo.sessionId;
          conflictingSessionDate = matchedInfo.createdAt;
        }
      }
    }
  }

  const duplicateRowsCount = duplicateWaybills.size;
  const hasConflict = duplicateRowsCount > 0;
  const uniqueNewRowsCount = validRowsCount - duplicateRowsCount;

  return {
    hasConflict,
    totalNewRows: validRowsCount,
    duplicateRowsCount,
    uniqueNewRowsCount,
    conflictingSessionName,
    conflictingSessionId,
    conflictingSessionDate,
    duplicateWaybills,
  };
}

export function calculateWeightFee(weight: number, plan: ShopPricingPlan): number {
  if (!plan || !plan.weightRules || plan.weightRules.length === 0) {
    return 25000;
  }

  const sortedRules = [...plan.weightRules].sort((a, b) => a.maxWeight - b.maxWeight);

  // Step 1: Find exact matching rule using BOTH minWeight and maxWeight
  const exactMatch = sortedRules.find(rule => weight >= rule.minWeight && weight <= rule.maxWeight);
  if (exactMatch) {
    return exactMatch.price;
  }

  // Step 2: If no exact match (e.g. weight falls in a gap between ranges),
  // find the first rule whose maxWeight >= weight (nearest ceiling)
  const nearestCeiling = sortedRules.find(rule => weight <= rule.maxWeight);
  if (nearestCeiling) {
    return nearestCeiling.price;
  }

  // Step 3: Weight exceeds all rules -> apply extra step pricing from highest rule
  const highestRule = sortedRules[sortedRules.length - 1];
  const excessWeight = weight - highestRule.maxWeight;
  const stepWeight = plan.extraStepWeight > 0 ? plan.extraStepWeight : 1;
  const stepPrice = plan.extraStepPrice > 0 ? plan.extraStepPrice : 5000;

  const steps = Math.ceil(excessWeight / stepWeight);
  return highestRule.price + (steps * stepPrice);
}

export function parseOrderStatus(statusStr: string): { status: OrderStatus; text: string } {
  if (!statusStr || !statusStr.toString().trim()) {
    return { status: 'delivered', text: 'Giao hàng thành công (Mặc định)' };
  }
  
  const text = statusStr.toString().trim();
  const lower = text.toLowerCase();

  if (
    lower.includes('thành công') ||
    lower.includes('giao thành công') ||
    lower.includes('đã giao') ||
    lower.includes('hoàn tất') ||
    lower.includes('delivered') ||
    lower.includes('phát thành công') ||
    lower.includes('đã đối soát') ||
    lower.includes('ký nhận') ||
    lower.includes('đã ký nhận') ||
    lower.includes('đã nhận') ||
    lower.includes('đã phát') ||
    lower.includes('giao xong') ||
    lower.includes('ky nhan') ||
    lower.includes('da giao') ||
    lower.includes('da nhan') ||
    lower.includes('thanh cong')
  ) {
    return { status: 'delivered', text };
  }

  if (
    lower.includes('chuyển hoàn') ||
    lower.includes('trả hàng') ||
    lower.includes('hoàn hàng') ||
    lower.includes('đã hoàn') ||
    lower.includes('returned') ||
    lower.includes('trả lại') ||
    lower.includes('chuyen hoan') ||
    lower.includes('tra hang') ||
    lower.includes('hoan hang') ||
    lower.includes('da hoan')
  ) {
    return { status: 'returned', text };
  }

  if (
    lower.includes('đang hoàn') ||
    lower.includes('chờ hoàn') ||
    lower.includes('returning') ||
    lower.includes('dang hoan') ||
    lower.includes('cho hoan')
  ) {
    return { status: 'returning', text };
  }

  if (
    lower.includes('hủy') ||
    lower.includes('cancelled') ||
    lower.includes('không gửi') ||
    lower.includes('huy don') ||
    lower.includes('da huy')
  ) {
    return { status: 'cancelled', text };
  }

  if (
    lower.includes('đang giao') ||
    lower.includes('đang phát') ||
    lower.includes('trung chuyển') ||
    lower.includes('in transit') ||
    lower.includes('giao hàng') ||
    lower.includes('dang giao') ||
    lower.includes('dang phat')
  ) {
    return { status: 'in_transit', text };
  }

  // GHN's right-hand ledger records an amount that was charged in this
  // settlement period; it is not evidence that the order was delivered.
  if (lower.includes('cấn cước') || lower.includes('fee charged')) {
    return { status: 'fee_charged', text };
  }

  // Fallback: Default unrecognized text to delivered if it contains positive signals or numeric values
  return { status: 'delivered', text };
}

export function extractRowField(
  appRow: Record<string, any> | undefined, 
  nvcRow: Record<string, any> | undefined, 
  mappingCol: string | undefined, 
  keywords: string[]
): string {
  if (appRow && mappingCol && appRow[mappingCol]) {
    const val = String(appRow[mappingCol]).trim();
    if (val) return val;
  }
  if (nvcRow && mappingCol && nvcRow[mappingCol]) {
    const val = String(nvcRow[mappingCol]).trim();
    if (val) return val;
  }

  // Scan appRow keys
  if (appRow) {
    for (const key of Object.keys(appRow)) {
      const normKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_');
      if (keywords.some(kw => normKey.includes(kw))) {
        const val = appRow[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }

  // Scan nvcRow keys
  if (nvcRow) {
    for (const key of Object.keys(nvcRow)) {
      const normKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_');
      if (keywords.some(kw => normKey.includes(kw))) {
        const val = nvcRow[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }

  return '';
}

export function performReconciliation(
  nvcRows: Record<string, any>[],
  nvcMapping: ColumnMappingConfig,
  appRows: Record<string, any>[],
  appMapping: ColumnMappingConfig,
  registeredShops: Shop[],
  carrierTier: CarrierWholesaleTier,
  sessionName: string,
  nvcFileName: string,
  appFileName?: string,
  mode: '1file' | '2files' = '2files'
): ReconciliationSession {
  const ctvs = StorageService.getCtvs();
  const existingSessions = StorageService.getSessions();
  const paymentRecords = StorageService.getPaymentRecords();
  const isJntCarrier = /(^|[^a-z])j\s*&?\s*t([^a-z]|$)|\bjnt\b/i.test(`${carrierTier.carrierId || ''} ${carrierTier.carrierName || ''}`);
  const appMap = new Map<string, Record<string, any>>();
  const duplicateAppWaybills = new Set<string>();
  const nvcWaybillCounts = new Map<string, number>();

  for (const row of nvcRows) {
    const rawWaybill = row[nvcMapping.waybillColumn];
    if (isSummaryOrInvalidWaybill(rawWaybill)) continue;
    const waybillKey = rawWaybill.toString().trim().toUpperCase();
    nvcWaybillCounts.set(waybillKey, (nvcWaybillCounts.get(waybillKey) || 0) + 1);
  }
  
  if (mode === '2files' && appRows.length > 0) {
    for (const row of appRows) {
      const waybillRaw = row[appMapping.waybillColumn];
      if (isSummaryOrInvalidWaybill(waybillRaw)) {
        continue;
      }
      const waybillKey = waybillRaw.toString().trim().toUpperCase();
      if (appMap.has(waybillKey)) duplicateAppWaybills.add(waybillKey);
      appMap.set(waybillKey, row);
    }
  }

  const reconciledOrders: ReconciledOrder[] = [];
  const unmatchedOrders: ReconciledOrder[] = [];

  nvcRows.forEach((nvcRow, index) => {
    const waybillRaw = nvcRow[nvcMapping.waybillColumn];
    if (isSummaryOrInvalidWaybill(waybillRaw)) {
      return; // Skip summary/total/empty rows automatically
    }

    const waybill = waybillRaw.toString().trim().toUpperCase();
    const appRow = mode === '1file' ? nvcRow : appMap.get(waybill);

    const nvcCod = parseNumber(nvcMapping.codColumn ? nvcRow[nvcMapping.codColumn] : 0);
    const nvcFee = parseNumber(nvcMapping.feeColumn ? nvcRow[nvcMapping.feeColumn] : 0);
    const otherFeeColumns = Array.from(new Set([
      nvcMapping.otherFeeColumn,
      ...(nvcMapping.additionalFeeColumns || []),
    ].filter(Boolean))) as string[];
    const nvcOtherFee = otherFeeColumns.reduce((total, column) => total + parseNumber(nvcRow[column]), 0);
    const nvcAdjustment = parseNumber(nvcMapping.adjustmentColumn ? nvcRow[nvcMapping.adjustmentColumn] : 0);
    const nvcSettlementAmount = nvcMapping.settlementAmountColumn
      ? parseNumber(nvcRow[nvcMapping.settlementAmountColumn])
      : undefined;
    const nvcSettlementVerified = nvcSettlementAmount === undefined
      ? undefined
      : nvcCod - nvcFee - nvcOtherFee + nvcAdjustment === nvcSettlementAmount;
    
    const nvcWeightVal = nvcMapping.weightColumn ? nvcRow[nvcMapping.weightColumn] : undefined;
    const appWeightVal = (appRow && appMapping.weightColumn) ? appRow[appMapping.weightColumn] : undefined;
    const weight = parseWeightToKg(nvcWeightVal !== undefined ? nvcWeightVal : appWeightVal || 0.5);

    const statusRaw = nvcMapping.statusColumn
      ? nvcRow[nvcMapping.statusColumn]
      : (appRow && appMapping.statusColumn ? appRow[appMapping.statusColumn] : '');
    const { status, text: statusText } = parseOrderStatus(statusRaw);

    // Detect GH1P (Giao Hàng 1 Phần)
    const lowerStatusText = (statusText || '').toLowerCase();
    const isPartialDelivery = lowerStatusText.includes('giao 1 phần') || lowerStatusText.includes('giao 1 phan') || lowerStatusText.includes('gh1p') || lowerStatusText.includes('giao mot phan');

    let shopName = '';
    let shopPhone = '';
    let shopAddress = '';
    let shopCode = '';
    let matchedShop: Shop | undefined = undefined;

    if (mode === '1file') {
      shopName = extractRowField(undefined, nvcRow, nvcMapping.shopNameColumn, ['ten_shop', 'ten_cua_hang', 'ten_kho', 'shop', 'store_name', 'cua_hang']) || 'Shop GHN';
      shopPhone = extractRowField(undefined, nvcRow, nvcMapping.shopPhoneColumn, ['sdt_shop', 'phone_shop', 'sdt_gui', 'so_dien_thoai_gui']);
      shopAddress = extractRowField(undefined, nvcRow, nvcMapping.shopAddressColumn, ['dia_chi_gui', 'dc_gui', 'kho_gui']);
      shopCode = extractRowField(undefined, nvcRow, nvcMapping.shopCodeColumn, ['ma_shop', 'ma_cua_hang', 'store_id']);
    } else if (appRow) {
      // J&T has no sender identity in the NVC settlement source. Never fill a
      // missing identity with a placeholder, otherwise a row can be assigned
      // to a shop on a name or phone alone.
      shopName = String(appMapping.shopNameColumn ? appRow[appMapping.shopNameColumn] || '' : '').trim();
      shopPhone = String(appMapping.shopPhoneColumn ? appRow[appMapping.shopPhoneColumn] || '' : '').trim();
      shopAddress = String(appMapping.shopAddressColumn ? appRow[appMapping.shopAddressColumn] || '' : '').trim();
      shopCode = String(appMapping.shopCodeColumn ? appRow[appMapping.shopCodeColumn] || '' : '').trim();
    }
    const receiverName = extractRowField(appRow, nvcRow, appMapping.receiverNameColumn || nvcMapping.receiverNameColumn, ['ten_nguoi_nhan', 'nguoi_nhan', 'ten_khach', 'khach_nhan', 'receiver']) || 'Khách Nhận';
    const receiverPhone = extractRowField(appRow, nvcRow, appMapping.receiverPhoneColumn || nvcMapping.receiverPhoneColumn, ['sdt_nguoi_nhan', 'sdt_nhan', 'so_dien_thoai', 'phone', 'mobile', 'sdt']);
    const receiverAddress = extractRowField(appRow, nvcRow, appMapping.receiverAddressColumn || nvcMapping.receiverAddressColumn, ['dia_chi', 'address', 'dc_nhan', 'giao_hang', 'dia_chi_nhan', 'dc']);
    const productName = extractRowField(appRow, nvcRow, appMapping.productNameColumn || nvcMapping.productNameColumn, ['ten_san_pham', 'hang_hoa', 'ten_hang', 'san_pham', 'noi_dung', 'mo_ta', 'product', 'items']);
    const declaredValue = parseNumber(extractRowField(appRow, nvcRow, appMapping.declaredValueColumn || nvcMapping.declaredValueColumn, ['khai_gia', 'gia_tri_khai_gia', 'bao_hiem', 'declared_value']));

    const hasBlockingDataIssue = (mode === '2files' && !appRow)
      || (isJntCarrier && (!shopName && !shopPhone && !shopCode))
      || status === 'unknown';
      
    const shopMatch = (mode === '2files' && !appRow)
      ? { matched: false as const, reason: 'Mã vận đơn có trong File NVC nhưng không tìm thấy trong File App xuất ra' }
      : (isJntCarrier && (!shopName && !shopPhone && !shopCode))
      ? { matched: false as const, reason: 'Thiếu Tên người gửi, SĐT người gửi và Mã kho/Shop trong File App' }
      : status === 'unknown'
      ? { matched: false as const, reason: `Không nhận diện được trạng thái “${statusText}”; cần xác nhận cấu hình hoặc file NVC` }
      : findRegisteredShop(registeredShops, { phone: shopPhone, code: shopCode, name: shopName });
      
    matchedShop = shopMatch.matched ? shopMatch.shop : undefined;

    let pricingPlan: ShopPricingPlan;
    if (matchedShop) {
      pricingPlan = matchedShop.pricingPlan;
    } else if (shopName || shopPhone) {
      // Auto-fallback dynamic shop identity for new/unregistered shops so they don't get blocked
      pricingPlan = {
        id: `auto_plan_${(shopPhone || shopName).toLowerCase().replace(/\s+/g, '_')}`,
        name: `Biểu giá Tiêu chuẩn (${shopName || shopPhone})`,
        weightRules: [
          { minWeight: 0, maxWeight: 1, price: 22000 },
          { minWeight: 1, maxWeight: 3, price: 28000 },
          { minWeight: 3, maxWeight: 5, price: 35000 },
        ],
        extraStepWeight: 1,
        extraStepPrice: 5000,
        returnFeePercent: 50,
        insuranceFeePercent: 0,
        fixedSurcharge: 0,
      };
      matchedShop = {
        id: `shop_auto_${(shopPhone || shopName).toLowerCase().replace(/\s+/g, '_')}`,
        code: (shopCode || shopName.slice(0, 6).toUpperCase() || 'SHOP').replace(/\s+/g, ''),
        name: shopName || `Shop ${shopPhone}`,
        phone: shopPhone,
        email: '',
        address: shopAddress,
        bankAccount: { bankName: '', accountNumber: '', accountHolder: shopName || '' },
        active: true,
        pricingPlan,
        createdAt: new Date().toISOString(),
      };
    } else {
      pricingPlan = {
        id: 'plan_fallback',
        name: 'Bảng giá Tiêu chuẩn',
        weightRules: [
          { minWeight: 0, maxWeight: 1, price: 25000 },
          { minWeight: 1, maxWeight: 3, price: 30000 },
          { minWeight: 3, maxWeight: 5, price: 35000 },
        ],
        extraStepWeight: 1,
        extraStepPrice: 6000,
        returnFeePercent: 50,
        insuranceFeePercent: 0,
        fixedSurcharge: 0,
      };
    }

    let shopCalculatedFee = 0;
    let shopOtherFee = 0;
    let declaredFee = 0;

    // 🔑 RULE: Only charge Shop shipping fee if the NVC Carrier original file actually charged a fee for this order (nvcFee > 0 or nvcOtherFee > 0)
    const feeColumnMapped = !!nvcMapping.feeColumn;
    const nvcHasFee = !feeColumnMapped || (nvcFee > 0 || nvcOtherFee > 0);

    if (nvcHasFee) {
      shopCalculatedFee = calculateWeightFee(weight, pricingPlan);
      shopOtherFee = pricingPlan.fixedSurcharge || 0;

      if (status === 'returned' || status === 'returning') {
        const returnRatio = (pricingPlan.returnFeePercent !== undefined ? pricingPlan.returnFeePercent : 50) / 100;
        shopCalculatedFee = Math.round(shopCalculatedFee * returnRatio);
      }

      if (isPartialDelivery && pricingPlan.partialDeliveryFee) {
        shopOtherFee += pricingPlan.partialDeliveryFee;
      }

      if (pricingPlan.insuranceFeePercent && pricingPlan.insuranceFeePercent > 0 && nvcCod > 0) {
        shopOtherFee += Math.round((nvcCod * pricingPlan.insuranceFeePercent) / 100);
      }

      if (declaredValue > 0 && pricingPlan.declaredFeePercent && pricingPlan.declaredFeePercent > 0) {
        declaredFee = Math.round((declaredValue * pricingPlan.declaredFeePercent) / 100);
        shopOtherFee += declaredFee;
      }
    } else {
      // If NVC charged 0 fee for this order, Shop fee is 0đ (No fee deducted)
      shopCalculatedFee = 0;
      shopOtherFee = 0;
    }

    // CTV Commission calculation
    let ctvCommission = 0;
    let ctvId = matchedShop?.ctvId;
    let ctvName = matchedShop?.ctvName;

    if (ctvId) {
      const ctvObj = ctvs.find((c: CtvProfile) => c.id === ctvId);
      if (ctvObj) {
        ctvCommission = StorageService.calculateCtvCommission(ctvObj, weight, carrierTier.carrierId);
      }
    }

    const effectiveNvcFee = nvcFee;
    const effectiveCod = (status === 'returned' || status === 'cancelled') ? 0 : nvcCod;
    const netShopPayout = effectiveCod - shopCalculatedFee - shopOtherFee;
    const profitMargin = (shopCalculatedFee + shopOtherFee) - (effectiveNvcFee + nvcOtherFee);

    const isMatched = !!matchedShop;
    const matchError = mode === '2files' && !appRow
      ? 'Không tìm thấy mã vận đơn tương ứng trong File App'
      : !shopMatch.matched
        ? shopMatch.reason
        : undefined;

    const order: ReconciledOrder = {
      id: `order_${index}_${waybill}`,
      waybill,
      carrierId: carrierTier.carrierId,
      shopId: matchedShop?.id,
      shopName: matchedShop?.name || shopName || 'Khách Vãng Lai / Chưa Xác Định',
      shopPhone: matchedShop?.phone || shopPhone,
      shopAddress: matchedShop?.address || shopAddress,
      receiverName,
      receiverPhone,
      receiverAddress,
      productName,
      weight,
      codAmount: effectiveCod,
      nvcBaseFee: effectiveNvcFee,
      nvcOtherFee,
      nvcSettlementAmount,
      nvcSettlementVerified,
      shopCalculatedFee,
      shopOtherFee,
      netShopPayout,
      profitMargin,
      status,
      statusText,
      matched: isMatched,
      shopMatchMethod: shopMatch.matched ? shopMatch.method : undefined,
      matchError,
      canManualAssignShop: !matchedShop && !hasBlockingDataIssue,
      isPartialDelivery,
      declaredValue,
      declaredFee,
      ctvId,
      ctvName,
      ctvCommission,
      rawNvcData: nvcRow,
      rawAppData: appRow,
    };

    if (isMatched) {
      reconciledOrders.push(order);
    } else {
      unmatchedOrders.push(order);
    }
  });

  const statementsMap = new Map<string, ShopSettlementStatement>();

  for (const order of reconciledOrders) {
    const key = order.shopId || order.shopName;
    
    if (!statementsMap.has(key)) {
      const normName = normalizeHeader(order.shopName || '');
      const shopObj = registeredShops.find(s => 
        s.id === order.shopId || 
        s.code === order.shopId ||
        normalizeHeader(s.name) === normName ||
        (s.name && s.name.trim().toLowerCase() === (order.shopName || '').trim().toLowerCase())
      );
      
      statementsMap.set(key, {
        shopId: shopObj?.id || key,
        shopCode: shopObj?.code || 'SHOP_LE',
        shopName: order.shopName,
        shopPhone: order.shopPhone,
        shopEmail: shopObj?.email || '',
        shopAddress: order.shopAddress,
        bankInfo: shopObj?.bankAccount || {
          bankName: 'Chưa cập nhật',
          accountNumber: 'Chưa cập nhật',
          accountHolder: order.shopName,
        },
        periodName: sessionName,
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        inTransitOrders: 0,
        partialOrders: 0,
        totalCod: 0,
        totalShopFee: 0,
        totalShopOtherFee: 0,
        totalNetPayout: 0,
        // Snapshot the signed opening balance now. Future edits to the shop
        // profile must never alter a previously issued settlement statement.
        previousDebt: shopObj ? calculateOpeningDebtForNewStatement(shopObj, existingSessions, paymentRecords) : 0,
        totalNvcCost: 0,
        totalProfit: 0,
        totalDeliveredCod: 0,
        totalDeliveredFee: 0,
        totalReturnedFee: 0,
        totalPartialCod: 0,
        totalPartialFee: 0,
        orders: [],
        emailStatus: 'idle',
      });
    }

    const stmt = statementsMap.get(key)!;
    stmt.orders.push(order);
    stmt.totalOrders += 1;
    if (order.status === 'delivered') {
      stmt.deliveredOrders += 1;
      stmt.totalDeliveredCod = (stmt.totalDeliveredCod || 0) + order.codAmount;
      stmt.totalDeliveredFee = (stmt.totalDeliveredFee || 0) + order.shopCalculatedFee + order.shopOtherFee;
    } else if (order.status === 'returned' || order.status === 'returning') {
      stmt.returnedOrders += 1;
      stmt.totalReturnedFee = (stmt.totalReturnedFee || 0) + order.shopCalculatedFee + order.shopOtherFee;
    } else {
      stmt.inTransitOrders += 1;
    }

    if (order.isPartialDelivery) {
      stmt.partialOrders = (stmt.partialOrders || 0) + 1;
      stmt.totalPartialCod = (stmt.totalPartialCod || 0) + order.codAmount;
      stmt.totalPartialFee = (stmt.totalPartialFee || 0) + order.shopCalculatedFee + order.shopOtherFee;
    }

    stmt.totalCod += order.codAmount;
    stmt.totalShopFee += order.shopCalculatedFee;
    stmt.totalShopOtherFee += order.shopOtherFee;
    stmt.totalNetPayout += order.netShopPayout;
    stmt.totalNvcCost += (order.nvcBaseFee + order.nvcOtherFee);
    stmt.totalProfit += order.profitMargin;
  }

  const statements = Array.from(statementsMap.values()).sort((a, b) => b.totalOrders - a.totalOrders);

  const totalOrders = reconciledOrders.length + unmatchedOrders.length;
  const totalCod = reconciledOrders.reduce((sum, o) => sum + o.codAmount, 0);
  const totalNvcCost = reconciledOrders.reduce((sum, o) => sum + o.nvcBaseFee + o.nvcOtherFee, 0);
  const totalShopRevenue = reconciledOrders.reduce((sum, o) => sum + o.shopCalculatedFee + o.shopOtherFee, 0);
  const totalNetPayout = reconciledOrders.reduce((sum, o) => sum + o.netShopPayout, 0);
  const totalProfit = totalShopRevenue - totalNvcCost;
  const totalCtvCommission = reconciledOrders.reduce((sum, o) => sum + (o.ctvCommission || 0), 0);

  return {
    id: `session_${Date.now()}`,
    sessionName,
    createdAt: new Date().toISOString(),
    carrierId: carrierTier.carrierId,
    carrierName: carrierTier.carrierName,
    mode,
    nvcFileName,
    appFileName,
    mappingSnapshot: {
      nvc: { ...nvcMapping },
      ...(mode === '2files' ? { app: { ...appMapping } } : {}),
    },
    totalOrders,
    matchedOrdersCount: reconciledOrders.length,
    unmatchedOrdersCount: unmatchedOrders.length,
    totalCod,
    totalNvcCost,
    totalShopRevenue,
    totalNetPayout,
    totalProfit,
    totalCtvCommission,
    statements,
    unmatchedOrders,
  };
}

export interface DetectedNewShop {
  code: string;
  name: string;
  phone: string;
  phoneList: string[];
  address: string;
  email?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  orderCount: number;
  totalCod: number;
}

export function detectUnregisteredShopsFromOrders(
  orders: { shopName?: string; shopCode?: string; shopPhone?: string; shopAddress?: string; nvcCod?: number; codAmount?: number }[],
  registeredShops: Shop[]
): DetectedNewShop[] {
  const newShopMap = new Map<string, DetectedNewShop>();

  orders.forEach(o => {
    const rawName = (o.shopName || '').trim();
    const rawCode = (o.shopCode || '').trim();
    const rawPhone = (o.shopPhone || '').trim();
    const rawAddress = (o.shopAddress || '').trim();

    if (!rawName && !rawCode && !rawPhone) return;

    const normName = normalizeHeader(rawName);
    const normCode = normalizeHeader(rawCode);
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

    // Check if matches any existing shop
    const isMatched = registeredShops.some(s => {
      const sName = normalizeHeader(s.name);
      const sCode = normalizeHeader(s.code);
      const sPhones = [s.phone, ...(s.phoneList || [])].flatMap(p => (p || '').split(/[,/;\s]+/)).map(p => p.replace(/[^0-9]/g, ''));

      return (
        (cleanPhone && sPhones.some(p => p === cleanPhone || cleanPhone.endsWith(p) || p.endsWith(cleanPhone))) ||
        (normCode && sCode && normCode === sCode) ||
        (normName && sName && (normName === sName || normName.includes(sName) || sName.includes(normName)))
      );
    });

    if (!isMatched) {
      const key = normCode || normName || cleanPhone;
      const codVal = o.nvcCod || o.codAmount || 0;

      if (!newShopMap.has(key)) {
        const generatedCode = rawCode ? rawCode.toUpperCase() : `SHOP_${rawName.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || Date.now().toString().slice(-4)}`;
        const initialPhones = rawPhone ? [rawPhone] : [];

        newShopMap.set(key, {
          code: generatedCode,
          name: rawName || rawCode || 'Shop Mới Chưa Đặt Tên',
          phone: rawPhone,
          phoneList: initialPhones,
          address: rawAddress,
          orderCount: 1,
          totalCod: codVal,
        });
      } else {
        const item = newShopMap.get(key)!;
        item.orderCount += 1;
        item.totalCod += codVal;

        if (rawPhone) {
          if (!item.phoneList.includes(rawPhone)) {
            item.phoneList.push(rawPhone);
          }
          item.phone = item.phoneList.join(', ');
        }
        if (!item.address && rawAddress) item.address = rawAddress;
      }
    }
  });

  return Array.from(newShopMap.values());
}
