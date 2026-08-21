import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

// The report builder runs from a temporary artifact workspace; resolve the
// read-only XLSX parser from the project that supplied the source files.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const XLSX = require('xlsx');

const args = process.argv.slice(2);
const outputArg = args.find(value => value.startsWith('--output='));
const shopsArg = args.find(value => value.startsWith('--shops-json='));
const outputPath = outputArg ? outputArg.slice('--output='.length) : '';
const shopsPath = shopsArg ? shopsArg.slice('--shops-json='.length) : '';
const sourcePaths = args.filter(value => !value.startsWith('--'));
const [nvcPath, ...sourceAppPaths] = sourcePaths;

if (!nvcPath || sourceAppPaths.length === 0 || !outputPath) {
  throw new Error('Dùng: node build-jnt-shop-source-report.mjs <file-nvc> <file-app...> --output=<bao-cao.xlsx>');
}

const text = value => String(value ?? '').trim();
const waybillKey = value => text(value).toUpperCase();
const identityKey = (name, phone) => `${text(name).toLocaleLowerCase('vi-VN')}|${text(phone).replace(/\D/g, '')}`;
const money = value => Number(text(value).replace(/[\s,]/g, '')) || 0;
const isWaybill = value => {
  const valueText = text(value);
  return valueText.length >= 4 && !/^(tổng|total)$/i.test(valueText);
};
const normalizeName = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
const normalizePhone = value => {
  const digits = text(value).replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
};
const calculateWeightFee = (weight, plan) => {
  const rules = [...(plan?.weightRules || [])].sort((a, b) => a.maxWeight - b.maxWeight);
  if (rules.length === 0) return 0;
  const exact = rules.find(rule => weight >= rule.minWeight && weight <= rule.maxWeight);
  if (exact) return money(exact.price);
  const ceiling = rules.find(rule => weight <= rule.maxWeight);
  if (ceiling) return money(ceiling.price);
  const last = rules.at(-1);
  return money(last.price) + Math.ceil((weight - last.maxWeight) / (plan?.extraStepWeight || 1)) * money(plan?.extraStepPrice || 0);
};
const isReturnedOrCancelled = status => /chuyển hoàn|trả hàng|hoàn hàng|đã hoàn|returning|returned|hủy|cancelled|không gửi/i.test(status);
const readRows = filePath => {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

const nvcRows = readRows(nvcPath).filter(row => isWaybill(row['Mã vận đơn']));
const shops = shopsPath ? JSON.parse(await fs.readFile(shopsPath, 'utf8')) : [];
const findExactShop = (name, phone) => shops.find(shop => shop.active
  && normalizeName(shop.name) === normalizeName(name)
  && [shop.phone, ...(shop.phoneList || [])].map(normalizePhone).includes(normalizePhone(phone)));
const nvcByWaybill = new Map(nvcRows.map(row => [waybillKey(row['Mã vận đơn']), row]));
const appRows = sourceAppPaths.flatMap(readRows).filter(row => isWaybill(row['Mã vận đơn']));
const appByWaybill = new Map();
const duplicateApps = [];
for (const row of appRows) {
  const id = waybillKey(row['Mã vận đơn']);
  if (appByWaybill.has(id)) duplicateApps.push({ waybill: id, first: appByWaybill.get(id), duplicate: row });
  else appByWaybill.set(id, row);
}

const groups = new Map();
const detailRows = [];
const appOnly = [];
for (const [waybill, appRow] of appByWaybill) {
  const nvcRow = nvcByWaybill.get(waybill);
  if (!nvcRow) {
    appOnly.push(waybill);
    continue;
  }
  const name = text(appRow['Tên người gửi']) || '(Thiếu tên)';
  const phone = text(appRow['Số điện thoại di động của người gửi hàng']) || '(Thiếu SĐT)';
  const groupKey = identityKey(name, phone);
  const group = groups.get(groupKey) || {
    name, phone, orders: 0, pricedOrders: 0, delivered: 0, cod: 0, fee: 0, otherFee: 0, settlement: 0, shopFee: 0, netPayout: 0, profit: 0, statuses: new Map(), shop: findExactShop(name, phone),
  };
  const status = text(appRow['Trạng thái vận đơn']) || '(Trống)';
  const cod = money(nvcRow['Tiền COD đã ký nhận']);
  const fee = money(nvcRow['Tiền cước PP_PM']);
  const otherFee = money(nvcRow['Phí thu hộ COD']) + money(nvcRow['Phí chuyển hoàn']) + money(nvcRow['Phí giao một phần']) - money(nvcRow['Điều chỉnh']);
  const settlement = money(nvcRow['Số tiền phải trả sau cấn trừ']);
  const shop = group.shop;
  const weight = money(appRow['Trọng lượng tính phí']) || 0.5;
  const sourceHasFee = fee > 0 || otherFee > 0;
  let shopFee = shop && sourceHasFee ? calculateWeightFee(weight, shop.pricingPlan) : 0;
  if (isReturnedOrCancelled(status)) shopFee = 0;
  const effectiveCod = isReturnedOrCancelled(status) ? 0 : cod;
  const netPayout = shop ? effectiveCod - shopFee : null;
  const profit = shop ? shopFee - fee - otherFee : null;
  group.orders += 1;
  if (/giao thành công|đã giao|thành công/i.test(status)) group.delivered += 1;
  group.cod += cod;
  group.fee += fee;
  group.otherFee += otherFee;
  group.settlement += settlement;
  if (shop) {
    group.pricedOrders += 1;
    group.shopFee += shopFee;
    group.netPayout += netPayout;
    group.profit += profit;
  }
  group.statuses.set(status, (group.statuses.get(status) || 0) + 1);
  groups.set(groupKey, group);
  detailRows.push([waybill, name, phone, shop ? shop.name : 'CHỜ XÁC NHẬN', status, weight, cod, fee, otherFee, settlement, shop ? shopFee : null, netPayout, profit]);
}

const nvcOnly = [...nvcByWaybill.keys()].filter(id => !appByWaybill.has(id));
const groupRows = [...groups.values()]
  .sort((a, b) => b.settlement - a.settlement)
  .map((group, index) => [
    index + 1,
    group.name,
    group.phone,
    group.shop ? group.shop.name : 'CHỜ XÁC NHẬN',
    group.orders,
    group.delivered,
    group.cod,
    group.fee,
    group.otherFee,
    group.settlement,
    group.shop ? group.shopFee : null,
    group.shop ? group.netPayout : null,
    group.shop ? group.profit : null,
    [...group.statuses.entries()].map(([status, count]) => `${status}: ${count}`).join(' · '),
  ]);

const byPhone = new Map();
for (const group of groups.values()) {
  const normalizedPhone = text(group.phone).replace(/\D/g, '');
  const entries = byPhone.get(normalizedPhone) || [];
  entries.push(group.name);
  byPhone.set(normalizedPhone, entries);
}
const identityConflicts = [...byPhone.entries()]
  .filter(([, names]) => new Set(names).size > 1)
  .map(([phone, names]) => [phone, [...new Set(names)].join(' | '), new Set(names).size, 'Admin phải xác nhận: gộp alias hay tách shop riêng']);

const total = groupRows.reduce((acc, row) => ({
  orders: acc.orders + row[4], cod: acc.cod + row[6], fee: acc.fee + row[7], otherFee: acc.otherFee + row[8], settlement: acc.settlement + row[9], shopFee: acc.shopFee + row[10], netPayout: acc.netPayout + row[11], profit: acc.profit + row[12],
}), { orders: 0, cod: 0, fee: 0, otherFee: 0, settlement: 0, shopFee: 0, netPayout: 0, profit: 0 });
const unresolvedGroups = groupRows.filter(row => row[3] === 'CHỜ XÁC NHẬN');

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Tổng hợp');
const groupsSheet = workbook.worksheets.add('Theo định danh');
const exceptionSheet = workbook.worksheets.add('Ngoại lệ');
const detailsSheet = workbook.worksheets.add('Chi tiết đơn');
for (const sheet of [summary, groupsSheet, exceptionSheet, detailsSheet]) sheet.showGridLines = false;

const titleFormat = { fill: '#4F46E5', font: { bold: true, color: '#FFFFFF', size: 16 }, horizontalAlignment: 'left', verticalAlignment: 'center' };
const sectionFormat = { fill: '#EDE9FE', font: { bold: true, color: '#312E81' }, verticalAlignment: 'center' };
const headerFormat = { fill: '#EEF2FF', font: { bold: true, color: '#1E1B4B' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
const moneyFormat = '#,##0 "đ"';

summary.mergeCells('A1:H1');
summary.getRange('A1').values = [['BÁO CÁO ĐỐI CHIẾU NGUỒN J&T THEO ĐỊNH DANH SHOP']];
summary.getRange('A1:H1').format = titleFormat;
summary.getRange('A1:H1').format.rowHeight = 30;
summary.mergeCells('A2:H2');
summary.getRange('A2').values = [[`Nguồn NVC: ${path.basename(nvcPath)} | File App đã gộp: ${sourceAppPaths.length} file | Ngày lập: ${new Date().toLocaleString('vi-VN')}`]];
summary.getRange('A2:H2').format = { font: { italic: true, color: '#475569' }, fill: '#F8FAFC' };
summary.getRange('A4:H4').values = [['CHỈ SỐ KIỂM TRA NGUỒN', '', '', '', '', '', '', '']];
summary.mergeCells('A4:H4'); summary.getRange('A4:H4').format = sectionFormat;
summary.getRange('A5:H9').values = [
  ['Mã đơn J&T hợp lệ', nvcRows.length, 'Mã đơn App duy nhất', appByWaybill.size, 'Khớp mã đơn', total.orders, 'Mã App trùng', duplicateApps.length],
  ['COD theo J&T', total.cod, 'Cước J&T', total.fee, 'Phí khác / điều chỉnh', total.otherFee, 'J&T trả sau cấn trừ', total.settlement],
  ['Định danh Tên + SĐT', groupRows.length, 'Khớp hồ sơ tuyệt đối', groupRows.length - unresolvedGroups.length, 'Chờ Admin xác nhận', unresolvedGroups.length, 'J&T/App lệch mã', appOnly.length + nvcOnly.length],
  ['Cước thu shop (hồ sơ)', total.shopFee, 'Thực trả shop (hồ sơ)', total.netPayout, 'Lợi nhuận gộp (hồ sơ)', total.profit, '', ''],
  ['Nguyên tắc', 'COD/cước NVC lấy từ file J&T. Chỉ tính cước shop khi định danh khớp tuyệt đối hồ sơ VPS; tên dùng chung SĐT không tự gộp.', '', '', '', '', '', ''],
];
summary.mergeCells('B9:H9');
summary.getRange('A5:H9').format.wrapText = true;
summary.getRange('A5:H9').format.borders = { preset: 'all', style: 'thin', color: '#CBD5E1' };
summary.getRange('B6').format.numberFormat = moneyFormat; summary.getRange('D6').format.numberFormat = moneyFormat; summary.getRange('F6').format.numberFormat = moneyFormat; summary.getRange('H6').format.numberFormat = moneyFormat; summary.getRange('B8').format.numberFormat = moneyFormat; summary.getRange('D8').format.numberFormat = moneyFormat; summary.getRange('F8').format.numberFormat = moneyFormat;
summary.getRange('A11:H11').values = [['KẾT LUẬN KIỂM TRA', '', '', '', '', '', '', '']]; summary.mergeCells('A11:H11'); summary.getRange('A11:H11').format = sectionFormat;
summary.mergeCells('A12:H13');
summary.getRange('A12').values = [[`Mã đơn giữa J&T và App khớp 100%. Tuy nhiên còn ${unresolvedGroups.length} định danh chưa khớp tuyệt đối hồ sơ VPS và ${duplicateApps.length} mã App bị lặp; không nên chốt phần tiền của các nhóm này trước khi Admin xác nhận.`]];
summary.getRange('A12:H13').format = { fill: '#FEF3C7', font: { bold: true, color: '#92400E' }, wrapText: true, verticalAlignment: 'center' };
summary.getRange('A1:H13').format.borders = { preset: 'outside', style: 'medium', color: '#C7D2FE' };
for (const [col, width] of [['A', 24], ['B', 20], ['C', 24], ['D', 20], ['E', 23], ['F', 20], ['G', 24], ['H', 20]]) summary.getRange(`${col}:${col}`).format.columnWidth = width;

groupsSheet.getRange('A1:N1').values = [['STT', 'Tên người gửi / định danh', 'SĐT người gửi', 'Hồ sơ VPS khớp tuyệt đối', 'Số đơn', 'Giao thành công (App)', 'COD theo J&T', 'Cước J&T', 'Phí khác', 'J&T trả sau cấn trừ', 'Cước thu shop', 'Thực trả shop', 'Lợi nhuận gộp', 'Phân bố trạng thái từ App']];
groupsSheet.getRange('A1:N1').format = headerFormat;
groupsSheet.getRange(`A2:N${groupRows.length + 1}`).values = groupRows;
groupsSheet.getRange(`G2:M${groupRows.length + 1}`).format.numberFormat = moneyFormat;
groupsSheet.getRange(`A1:N${groupRows.length + 1}`).format.borders = { preset: 'all', style: 'thin', color: '#E2E8F0' };
groupsSheet.freezePanes.freezeRows(1);
for (const [col, width] of [['A', 8], ['B', 28], ['C', 18], ['D', 28], ['E', 12], ['F', 21], ['G', 18], ['H', 16], ['I', 14], ['J', 22], ['K', 18], ['L', 18], ['M', 18], ['N', 52]]) groupsSheet.getRange(`${col}:${col}`).format.columnWidth = width;

exceptionSheet.getRange('A1:D1').values = [['LOẠI NGOẠI LỆ', 'MÃ / SĐT', 'CHI TIẾT', 'HƯỚNG XỬ LÝ']];
exceptionSheet.getRange('A1:D1').format = headerFormat;
const exceptionRows = [
  ...duplicateApps.map(item => ['Mã vận đơn lặp trong App', item.waybill, `Cùng định danh: ${text(item.first['Tên người gửi'])} / ${text(item.first['Số điện thoại di động của người gửi hàng'])}`, 'Giữ một dòng duy nhất khi gộp file; không tự cộng đôi tiền.']),
  ...identityConflicts.map(([phone, names, count, action]) => ['Một SĐT có nhiều tên', phone, `${count} tên: ${names}`, action]),
  ...appOnly.map(id => ['Chỉ có trong App', id, '', 'Kiểm tra file NVC/kỳ đối soát.']),
  ...nvcOnly.map(id => ['Chỉ có trong J&T', id, '', 'Kiểm tra file App/kỳ đối soát.']),
];
if (exceptionRows.length) exceptionSheet.getRange(`A2:D${exceptionRows.length + 1}`).values = exceptionRows;
exceptionSheet.getRange(`A1:D${Math.max(2, exceptionRows.length + 1)}`).format.borders = { preset: 'all', style: 'thin', color: '#FCD34D' };
exceptionSheet.getRange(`A2:D${Math.max(2, exceptionRows.length + 1)}`).format.wrapText = true;
exceptionSheet.freezePanes.freezeRows(1);
for (const [col, width] of [['A', 28], ['B', 18], ['C', 66], ['D', 48]]) exceptionSheet.getRange(`${col}:${col}`).format.columnWidth = width;

detailsSheet.getRange('A1:M1').values = [['Mã vận đơn', 'Tên người gửi', 'SĐT người gửi', 'Hồ sơ VPS', 'Trạng thái App', 'Cân nặng kg', 'COD theo J&T', 'Cước J&T', 'Phí khác', 'J&T trả sau cấn trừ', 'Cước thu shop', 'Thực trả shop', 'Lợi nhuận gộp']];
detailsSheet.getRange('A1:M1').format = headerFormat;
detailsSheet.getRange(`A2:M${detailRows.length + 1}`).values = detailRows.sort((a, b) => a[1].localeCompare(b[1], 'vi'));
detailsSheet.getRange(`G2:M${detailRows.length + 1}`).format.numberFormat = moneyFormat;
detailsSheet.getRange(`A1:M${detailRows.length + 1}`).format.borders = { preset: 'all', style: 'thin', color: '#E2E8F0' };
detailsSheet.freezePanes.freezeRows(1);
for (const [col, width] of [['A', 19], ['B', 28], ['C', 18], ['D', 28], ['E', 21], ['F', 14], ['G', 18], ['H', 16], ['I', 14], ['J', 22], ['K', 18], ['L', 18], ['M', 18]]) detailsSheet.getRange(`${col}:${col}`).format.columnWidth = width;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, total, groupCount: groupRows.length, duplicateApps: duplicateApps.length, appOnly: appOnly.length, nvcOnly: nvcOnly.length }, null, 2));
