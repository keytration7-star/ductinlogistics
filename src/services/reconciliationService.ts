import type {
  Shop,
  ShopPricingPlan,
  CarrierWholesaleTier,
  ReconciledOrder,
  ShopSettlementStatement,
  ReconciliationSession,
  ColumnMappingConfig,
  OrderStatus
} from '../types';
import { parseNumber, parseWeightToKg, isSummaryOrInvalidWaybill } from './smartColumnDetector';

export function calculateWeightFee(weight: number, plan: ShopPricingPlan): number {
  if (!plan || !plan.weightRules || plan.weightRules.length === 0) {
    return 25000;
  }

  const sortedRules = [...plan.weightRules].sort((a, b) => a.maxWeight - b.maxWeight);

  for (const rule of sortedRules) {
    if (weight <= rule.maxWeight) {
      return rule.price;
    }
  }

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

export function performReconciliation(
  nvcRows: Record<string, any>[],
  nvcMapping: ColumnMappingConfig,
  appRows: Record<string, any>[],
  appMapping: ColumnMappingConfig,
  registeredShops: Shop[],
  carrierTier: CarrierWholesaleTier,
  sessionName: string,
  nvcFileName: string,
  appFileName: string
): ReconciliationSession {
  const appMap = new Map<string, Record<string, any>>();
  
  for (const row of appRows) {
    const waybillRaw = row[appMapping.waybillColumn];
    if (isSummaryOrInvalidWaybill(waybillRaw)) {
      continue;
    }
    const waybillKey = waybillRaw.toString().trim().toUpperCase();
    appMap.set(waybillKey, row);
  }

  const reconciledOrders: ReconciledOrder[] = [];
  const unmatchedOrders: ReconciledOrder[] = [];

  nvcRows.forEach((nvcRow, index) => {
    const waybillRaw = nvcRow[nvcMapping.waybillColumn];
    if (isSummaryOrInvalidWaybill(waybillRaw)) {
      return; // Skip summary/total/empty rows automatically
    }

    const waybill = waybillRaw.toString().trim().toUpperCase();
    const appRow = appMap.get(waybill);

    const nvcCod = parseNumber(nvcMapping.codColumn ? nvcRow[nvcMapping.codColumn] : 0);
    const nvcFee = parseNumber(nvcMapping.feeColumn ? nvcRow[nvcMapping.feeColumn] : 0);
    const nvcOtherFee = parseNumber(nvcMapping.otherFeeColumn ? nvcRow[nvcMapping.otherFeeColumn] : 0);
    
    const nvcWeightVal = nvcMapping.weightColumn ? nvcRow[nvcMapping.weightColumn] : undefined;
    const appWeightVal = (appRow && appMapping.weightColumn) ? appRow[appMapping.weightColumn] : undefined;
    const weight = parseWeightToKg(nvcWeightVal !== undefined ? nvcWeightVal : appWeightVal || 0.5);

    const statusRaw = nvcMapping.statusColumn ? nvcRow[nvcMapping.statusColumn] : '';
    const { status, text: statusText } = parseOrderStatus(statusRaw);

    let shopName = '';
    let shopPhone = '';
    let shopAddress = '';
    let receiverName = '';
    let receiverPhone = '';
    let receiverAddress = '';
    let matchedShop: Shop | undefined = undefined;

    if (appRow) {
      shopName = (appMapping.shopNameColumn ? appRow[appMapping.shopNameColumn] : '') || 'Shop Không Tên';
      shopPhone = (appMapping.shopPhoneColumn ? appRow[appMapping.shopPhoneColumn] : '') || '';
      shopAddress = (appMapping.shopAddressColumn ? appRow[appMapping.shopAddressColumn] : '') || '';
      receiverName = (appMapping.receiverNameColumn ? appRow[appMapping.receiverNameColumn] : '') || 'Khách Nhận';
      receiverPhone = (appMapping.receiverPhoneColumn ? appRow[appMapping.receiverPhoneColumn] : '') || '';
      receiverAddress = (appMapping.receiverAddressColumn ? appRow[appMapping.receiverAddressColumn] : '') || '';

      const cleanShopName = shopName.toLowerCase().trim();
      const cleanShopPhone = shopPhone.replace(/[^0-9]/g, '');

      matchedShop = registeredShops.find(s => {
        const sName = s.name.toLowerCase().trim();
        const sCode = s.code.toLowerCase().trim();
        const sPhone = s.phone.replace(/[^0-9]/g, '');
        
        return (
          (cleanShopPhone && sPhone && cleanShopPhone === sPhone) ||
          (cleanShopName && sName && (cleanShopName.includes(sName) || sName.includes(cleanShopName))) ||
          (cleanShopName && sCode && cleanShopName.includes(sCode))
        );
      });
    }

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

    // Kiểm tra xem đơn hàng này trong File đối soát NVC có phát sinh cước hay không
    // Nếu trong file NVC đơn này cước > 0 -> mới tính cước Shop theo cân nặng
    // Nếu trong file NVC đơn này cước = 0 (chưa trừ cước kỳ này / miễn cước) -> Cước Shop = 0
    let shopCalculatedFee = 0;
    let shopOtherFee = 0;

    if (nvcFee > 0) {
      shopCalculatedFee = calculateWeightFee(weight, pricingPlan);
      shopOtherFee = pricingPlan.fixedSurcharge || 0;

      if (status === 'returned' || status === 'returning') {
        const returnRatio = (pricingPlan.returnFeePercent !== undefined ? pricingPlan.returnFeePercent : 50) / 100;
        shopCalculatedFee = Math.round(shopCalculatedFee * returnRatio);
      }

      if (pricingPlan.insuranceFeePercent && pricingPlan.insuranceFeePercent > 0 && nvcCod > 0) {
        shopOtherFee += Math.round((nvcCod * pricingPlan.insuranceFeePercent) / 100);
      }
    }

    const effectiveNvcFee = nvcFee;
    const effectiveCod = (status === 'returned' || status === 'cancelled') ? 0 : nvcCod;
    const netShopPayout = effectiveCod - shopCalculatedFee - shopOtherFee;
    const profitMargin = (shopCalculatedFee + shopOtherFee) - (effectiveNvcFee + nvcOtherFee);

    const isMatched = !!appRow;

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
      matchError: !isMatched ? 'Không tìm thấy mã vận đơn trong file danh sách đơn xuất từ App' : undefined,
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
      const shopObj = registeredShops.find(s => s.id === order.shopId || s.name === order.shopName);
      
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
        totalCod: 0,
        totalShopFee: 0,
        totalShopOtherFee: 0,
        totalNetPayout: 0,
        totalNvcCost: 0,
        totalProfit: 0,
        orders: [],
        emailStatus: 'idle',
      });
    }

    const stmt = statementsMap.get(key)!;
    stmt.orders.push(order);
    stmt.totalOrders += 1;
    if (order.status === 'delivered') stmt.deliveredOrders += 1;
    else if (order.status === 'returned' || order.status === 'returning') stmt.returnedOrders += 1;
    else stmt.inTransitOrders += 1;

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

  return {
    id: `session_${Date.now()}`,
    sessionName,
    createdAt: new Date().toISOString(),
    carrierId: carrierTier.carrierId,
    carrierName: carrierTier.carrierName,
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
    statements,
    unmatchedOrders,
  };
}
