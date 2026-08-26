const fs = require('fs');
const sessions = JSON.parse(fs.readFileSync('/var/www/truongphuc/data/sessions.json', 'utf8') || '[]');
const payments = JSON.parse(fs.readFileSync('/var/www/truongphuc/data/payments.json', 'utf8') || '[]');
const shops = JSON.parse(fs.readFileSync('/var/www/truongphuc/data/shops.json', 'utf8') || '[]');

const hyShop = shops.find(s => (s.name && s.name.includes('Hoàng Yến')) || (s.code && s.code.includes('HONGY')));

function isShopMatching(s1, s2) {
  if (!s1 || !s2) return false;
  return s1.code === s2.shopCode || s1.code === s2.code || s1.name === s2.shopName || s1.name === s2.name;
}

console.log('=== SESSIONS CONTAINING HOANG YEN (SORTED BY DATE) ===');
const hyStatements = [];
sessions.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).forEach(sess => {
  (sess.statements || []).forEach(stmt => {
    if (isShopMatching(hyShop, stmt)) {
      hyStatements.push({
        sessionId: sess.id,
        sessionName: sess.sessionName,
        createdAt: sess.createdAt,
        totalOrders: stmt.totalOrders,
        totalCod: stmt.totalCod,
        totalFee: stmt.totalShopFee + stmt.totalShopOtherFee,
        totalNetPayout: stmt.totalNetPayout,
        previousDebt: stmt.previousDebt
      });
    }
  });
});
console.table(hyStatements);

let runningDebt = 0;
hyStatements.forEach((st, idx) => {
  const periodNet = st.totalCod - st.fee;
  const before = runningDebt;
  const combined = runningDebt + periodNet;
  if (combined >= 0) {
    runningDebt = 0;
  } else {
    runningDebt = combined;
  }
  console.log(`Step ${idx + 1} (${st.sessionName}): COD=${st.totalCod}, Fee=${st.totalFee}, PeriodNet=${periodNet} | OpeningDebt=${before} -> ClosingDebt=${runningDebt}`);
});
