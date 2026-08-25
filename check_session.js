import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'sessions.json');
if (fs.existsSync(dbPath)) {
  const sessions = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  sessions.forEach(s => {
    (s.statements || []).forEach(st => {
      if (st.shopCode && st.shopCode.includes('6344994')) {
        console.log(`[SESSION: ${s.sessionName} (${s.id})] Shop: ${st.shopName} | prevDebt: ${st.previousDebt} | totalNetPayout: ${st.totalNetPayout}`);
      }
    });
  });
}
