const fs = require('fs');
const path = require('path');

const possiblePaths = [
  path.join(__dirname, 'data', 'sessions.json'),
  '/var/www/truongphuc/data/sessions.json',
  '/var/www/ductinlogistics/data/sessions.json',
  '/var/www/autopro/data/sessions.json',
];

possiblePaths.forEach(dbPath => {
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const sessions = JSON.parse(raw);
      let count = 0;
      sessions.forEach(s => {
        (s.statements || []).forEach(st => {
          if (st.previousDebt && st.previousDebt > 0) {
            console.log(`[CLEAN ${dbPath}] Fixing shop: ${st.shopName} | prevDebt: ${st.previousDebt} -> 0`);
            st.previousDebt = 0;
            count++;
          }
        });
      });
      fs.writeFileSync(dbPath, JSON.stringify(sessions, null, 2), 'utf8');
      console.log(`[CLEAN SUCCESS] ${dbPath}: Fixed ${count} statements`);
    } catch (err) {
      console.error(`[CLEAN ERROR ${dbPath}]:`, err);
    }
  }
});
