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

export function checkDuplicateWaybills(
  nvcRows: Record<string, any>[],
  waybillCol: string,
  existingSessions: ReconciliationSession[]
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

  const existingWaybillMap = new Map<string, { sessionId: string; sessionName: string; createdAt: string }>();
  for (const session of existingSessions) {
    for (const stmt of session.statements) {
      for (const order of stmt.orders) {
        if (order.waybill) {
          existingWaybillMap.set(order.waybill.trim().toUpperCase(), {
            sessionId: session.id,
            sessionName: session.sessionName,
            createdAt: session.createdAt,
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
      duplicateWaybills.add(key);
      const matchedInfo = existingWaybillMap.get(key)!;
      if (!conflictingSessionName) {
        conflictingSessionName = matchedInfo.sessionName;
        conflictingSessionId = matchedInfo.sessionId;
        conflictingSessionDate = matchedInfo.createdAt;
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
  if (!statusStr) return { status: 'delivered', text: 'Thành công (Mặc định)' };
  
  const text = statusStr.toString().trim();
  const lower = text.toLowerCase();

  if (
    lower.includes('thành công') ||
    lower.includes('giao thành công') ||
    lower.includes('đã giao') ||
    lower.includes('hoàn tất') ||
    lower.includes('delivered') ||
    lower.includes('phát thành công') ||
    lower.includes('đã đối soát')
  ) {
    return { status: 'delivered', text };
  }

  if (
    lower.includes('chuyển hoàn') ||
    lower.includes('trả hàng') ||
    lower.includes('hoàn hàng') ||
    lower.includes('đã hoàn') ||
    lower.includes('returned') ||
    lower.includes('trả lại')
  ) {
    return { status: 'returned', text };
  }

  if (
    lower.includes('đang hoàn') ||
    lower.includes('chờ hoàn') ||
    lower.includes('returning')
  ) {
    return { status: 'returning', text };
  }

  if (
    lower.includes('hủy') ||
    lower.includes('cancelled') ||
    lower.includes('không gửi')
  ) {
    return { status: 'cancelled', text };
  }

  if (
    lower.includes('đang giao') ||
    lower.includes('đang phát') ||
    lower.includes('trung chuyển') ||
    lower.includes('in transit')
  ) {
    return { status: 'in_transit', text };
  }

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
  const appMap = new Map<string, Record<string, any>>();
  
  if (mode === '2files' && appRows.length > 0) {
    for (const row of appRows) {
      const waybillRaw = row[appMapping.waybillColumn];
      if (isSummaryOrInvalidWaybill(waybillRaw)) {
        continue;
      }
      const waybillKey = waybillRaw.toString().trim().toUpperCase();
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
    const nvcOtherFee = parseNumber(nvcMapping.otherFeeColumn ? nvcRow[nvcMapping.otherFeeColumn] : 0);
    
    const nvcWeightVal = nvcMapping.weightColumn ? nvcRow[nvcMapping.weightColumn] : undefined;
    const appWeightVal = (appRow && appMapping.weightColumn) ? appRow[appMapping.weightColumn] : undefined;
    const weight = parseWeightToKg(nvcWeightVal !== undefined ? nvcWeightVal : appWeightVal || 0.5);

    const statusRaw = nvcMapping.statusColumn ? nvcRow[nvcMapping.statusColumn] : '';
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
      shopName = (appMapping.shopNameColumn ? appRow[appMapping.shopNameColumn] : '') || 'Shop Không Tên';
      shopPhone = (appMapping.shopPhoneColumn ? appRow[appMapping.shopPhoneColumn] : '') || '';
      shopAddress = (appMapping.shopAddressColumn ? appRow[appMapping.shopAddressColumn] : '') || '';
      shopCode = (appMapping.shopCodeColumn ? appRow[appMapping.shopCodeColumn] : '') || '';
    }

    const receiverName = extractRowField(appRow, nvcRow, appMapping.receiverNameColumn || nvcMapping.receiverNameColumn, ['ten_nguoi_nhan', 'nguoi_nhan', 'ten_khach', 'khach_nhan', 'receiver']) || 'Khách Nhận';
    const receiverPhone = extractRowField(appRow, nvcRow, appMapping.receiverPhoneColumn || nvcMapping.receiverPhoneColumn, ['sdt_nguoi_nhan', 'sdt_nhan', 'so_dien_thoai', 'phone', 'mobile', 'sdt']);
    const receiverAddress = extractRowField(appRow, nvcRow, appMapping.receiverAddressColumn || nvcMapping.receiverAddressColumn, ['dia_chi', 'address', 'dc_nhan', 'giao_hang', 'dia_chi_nhan', 'dc']);
    const productName = extractRowField(appRow, nvcRow, appMapping.productNameColumn || nvcMapping.productNameColumn, ['ten_san_pham', 'hang_hoa', 'ten_hang', 'san_pham', 'noi_dung', 'mo_ta', 'product', 'items']);
    const declaredValue = parseNumber(extractRowField(appRow, nvcRow, appMapping.declaredValueColumn || nvcMapping.declaredValueColumn, ['khai_gia', 'gia_tri_khai_gia', 'bao_hiem', 'declared_value']));

    const cleanShopName = normalizeHeader(shopName);
    const cleanShopCode = normalizeHeader(shopCode);
    const cleanShopPhone = shopPhone.replace(/[^0-9]/g, '');

    matchedShop = registeredShops.find(s => {
      const sName = normalizeHeader(s.name);
      const sCode = normalizeHeader(s.code);
      
      const sPhones = [
        s.phone,
        ...(s.phoneList || []),
      ]
        .flatMap(pStr => (pStr || '').split(/[,/;\s]+/))
        .map(p => p.replace(/[^0-9]/g, ''))
        .filter(p => p.length >= 7);

      const isPhoneMatched = !!(cleanShopPhone && sPhones.some(p => p === cleanShopPhone || cleanShopPhone.endsWith(p) || p.endsWith(cleanShopPhone)));

      return (
        isPhoneMatched ||
        (cleanShopCode && sCode && cleanShopCode === sCode) ||
        (cleanShopName && sName && (cleanShopName.includes(sName) || sName.includes(cleanShopName))) ||
        (cleanShopName && sCode && cleanShopName.includes(sCode))
      );
    });

    let pricingPlan: ShopPricingPlan;
    if (matchedShop) {
      pricingPlan = matchedShop.pricingPlan;
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

    // Always calculate shop freight fee based on weight & pricing plan
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

    const isMatched = (mode === '1file') ? !!matchedShop : !!appRow;

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
      shopCalculatedFee,
      shopOtherFee,
      netShopPayout,
      profitMargin,
      status,
      statusText,
      matched: isMatched,
      matchError: !isMatched ? 'Không nhận diện được Shop hoặc chưa có trong danh mục' : undefined,
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
        previousDebt: shopObj?.previousDebt || 0,
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
