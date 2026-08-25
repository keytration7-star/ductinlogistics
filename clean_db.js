const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'sessions.json');
if (fs.existsSync(dbPath)) {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const sessions = JSON.parse(raw);
    let count = 0;
    sessions.forEach(s => {
      (s.statements || []).forEach(st => {
        if (st.previousDebt && st.previousDebt > 0) {
          console.log(`[CLEAN] Fixing shop: ${st.shopName} (${st.shopCode}) | prevDebt: ${st.previousDebt} -> 0`);
          st.previousDebt = 0;
          count++;
        }
      });
    });
    fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2), 'utf8');
    console.log(`[CLEAN SUCCESS] Total fixed statements: ${count}`);
  } catch (err) {
    console.error('[CLEAN ERROR]:', err);
  }
} else {
  console.log('[CLEAN] No sessions.json found');
}
