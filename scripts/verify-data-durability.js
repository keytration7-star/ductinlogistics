import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

console.log('Starting read-only GOMDON PRO ENTERPRISE data durability audit...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// This verifier is intentionally read-only: it must never create, modify,
// restore, or remove a financial data file while performing a check.
// Test 1: Check data directories exist
assert(fs.existsSync(DATA_DIR), 'Directory ./data exists on server');
assert(fs.existsSync(BACKUPS_DIR), 'Directory ./data/backups exists for snapshots');

// Test 2: Check JSON database files validity
const dbFiles = [
  'shops.json',
  'carriers.json',
  'sessions.json',
  'users.json',
  'company_info.json',
  'email_settings.json',
  'zalo_settings.json',
  'telegram_settings.json',
  'export_columns.json',
  'carrier_data.json',
  'payments.json',
  'ctvs.json',
  'audit_logs.json',
];

dbFiles.forEach(file => {
  const filePath = path.join(DATA_DIR, file);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);
      const stat = fs.statSync(filePath);
      assert(true, `Database file "${file}" is valid JSON (${stat.size} bytes)`);
    } catch (err) {
      assert(false, `Database file "${file}" contains invalid JSON: ${err.message}`);
    }
  } else {
    console.log(`  ℹ️ INFO: "${file}" does not exist yet (will be auto-created on save)`);
  }
});

// Test 3: Audit existing snapshots only
console.log('\nAuditing existing backup snapshots (read-only)...');
if (fs.existsSync(BACKUPS_DIR)) {
  let snapshots = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('snapshot_') && f.endsWith('.json'));
  assert(snapshots.length > 0, `Found ${snapshots.length} automated snapshot backups in ./data/backups/`);
  
  if (snapshots.length > 0) {
    const latest = snapshots[snapshots.length - 1];
    try {
      const snapContent = JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, latest), 'utf8'));
      assert(snapContent.timestamp && (Array.isArray(snapContent.shops) || snapContent.shops !== undefined), `Latest snapshot "${latest}" is complete and valid`);
    } catch (err) {
      assert(false, `Snapshot file "${latest}" corrupted: ${err.message}`);
    }
  }
}

console.log('\n----------------------------------------');
console.log(`📊 Audit Summary: ${passCount} PASSED, ${failCount} FAILED.`);
if (failCount === 0) {
  console.log('RESULT: Existing JSON files and snapshots passed this read-only structural audit.\n');
} else {
  console.error('⚠️ RESULT: Found vulnerabilities to address.\n');
  process.exit(1);
}
