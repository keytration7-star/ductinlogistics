/*
 * Read-only verification of carrier source files against the app's own parser.
 * Usage: node scripts/verify-real-reconciliation-files.cjs <jnt-nvc> <jnt-app> <ghn-workbook>
 * It never writes workbook, app, browser, or server data.
 */
const fs = require('fs');
const ts = require('typescript');

const memory = new Map();
global.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const XLSX = require('xlsx');
const { parseGhnSettlementWorkbook } = require('../src/services/excelService.ts');
const { parseNumber } = require('../src/services/smartColumnDetector.ts');
const { calculateStatementSettlement } = require('../src/services/settlementService.ts');

const [jntNvcPath, jntAppPath, ghnPath] = process.argv.slice(2);
if (!jntNvcPath || !jntAppPath || !ghnPath) {
  throw new Error('Thiếu 3 đường dẫn file đầu vào.');
}

const rowsFrom = filePath => {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

const validWaybill = value => {
  const text = String(value || '').trim();
  return text.length >= 4 && !['tổng', 'total'].includes(text.toLowerCase());
};

const jntNvc = rowsFrom(jntNvcPath).filter(row => validWaybill(row['Mã vận đơn']));
const jntApp = rowsFrom(jntAppPath).filter(row => validWaybill(row['Mã vận đơn']));
const nvcIds = new Set(jntNvc.map(row => String(row['Mã vận đơn']).trim().toUpperCase()));
const appIds = new Set(jntApp.map(row => String(row['Mã vận đơn']).trim().toUpperCase()));
const intersection = [...nvcIds].filter(id => appIds.has(id)).length;
const missingIdentity = jntApp.filter(row => !String(row['Tên người gửi'] || '').trim() || !String(row['Số điện thoại di động của người gửi hàng'] || '').trim()).length;

const sum = (rows, key) => rows.reduce((total, row) => total + parseNumber(row[key]), 0);
const jntCod = sum(jntNvc, 'Tiền COD đã ký nhận');
const jntFee = sum(jntNvc, 'Tiền cước PP_PM');
const jntOther = sum(jntNvc, 'Phí thu hộ COD') + sum(jntNvc, 'Phí chuyển hoàn') + sum(jntNvc, 'Phí giao một phần');
const jntAdjustment = sum(jntNvc, 'Điều chỉnh');
const jntSettlement = sum(jntNvc, 'Số tiền phải trả sau cấn trừ');

const ghnWorkbook = XLSX.readFile(ghnPath, { cellDates: true });
const ghn = parseGhnSettlementWorkbook(ghnWorkbook);
if (!ghn) throw new Error('Không nhận diện được workbook GHN.');

const sheetTotals = new Map();
for (const row of ghn.rows) {
  const sheet = row['Sheet đối soát GHN'];
  const total = sheetTotals.get(sheet) || { cod: 0, fee: 0, waybills: new Set() };
  total.cod += parseNumber(row['Tiền COD']);
  total.fee += parseNumber(row['Cước phí']);
  total.waybills.add(String(row['Mã đơn GHN']).trim().toUpperCase());
  sheetTotals.set(sheet, total);
}

const output = {
  jnt: {
    nvcOrders: jntNvc.length,
    appOrders: jntApp.length,
    exactWaybillMatches: intersection,
    nvcOnly: nvcIds.size - intersection,
    appOnly: appIds.size - intersection,
    missingSenderIdentity: missingIdentity,
    cod: jntCod,
    fee: jntFee,
    otherFee: jntOther,
    adjustment: jntAdjustment,
    calculatedSettlement: jntCod - jntFee - jntOther + jntAdjustment,
    statedSettlement: jntSettlement,
  },
  ghn: Object.fromEntries([...sheetTotals.entries()].map(([sheet, total]) => [sheet, {
    cod: total.cod,
    fee: total.fee,
    net: total.cod - total.fee,
    uniqueWaybills: total.waybills.size,
  }])),
  debtCarryScenario: calculateStatementSettlement({
    previousDebt: -2000000,
    totalNetPayout: 11397500,
  }),
};

console.log(JSON.stringify(output, null, 2));
