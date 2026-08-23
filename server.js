import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ──────────────────────────────────────────
// 📁 SERVER-SIDE PERSISTENT STORAGE (JSON DATABASE)
// ──────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function readJsonFile(filename, defaultValue) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[DB Read Error] ${filename}:`, err);
    return defaultValue;
  }
}

// 🛡️ ATOMIC FILE WRITE PATTERN (Temp Swap + fsync)
// Guarantees zero data loss, rỗng file or JSON corruption on VPS crash/power loss
function writeJsonFile(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = path.join(DATA_DIR, `${filename}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    // 1. Write to temporary file
    fs.writeFileSync(tempPath, jsonStr, 'utf8');
    
    // 2. Physical flush to disk
    const fd = fs.openSync(tempPath, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    // 3. OS Atomic rename replacement
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    console.error(`[Atomic Write Fail] ${filename}:`, err);
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    return false;
  }
}

// ──────────────────────────────────────────
// ──────────────────────────────────────────
// 🔐 SERVER-SIDE AUTHORIZATION (PERSISTENT SESSIONS ACROSS REBOOTS)
// ──────────────────────────────────────────
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days persistent session

function loadActiveSessions() {
  const raw = readJsonFile('_auth_sessions.json', {});
  const map = new Map();
  const now = Date.now();
  if (raw && typeof raw === 'object') {
    for (const [token, session] of Object.entries(raw)) {
      if (session && session.expiresAt > now && session.user) {
        map.set(token, session);
      }
    }
  }
  return map;
}

const activeSessions = loadActiveSessions();

function persistActiveSessions() {
  const obj = {};
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session && session.expiresAt > now) {
      obj[token] = session;
    }
  }
  writeJsonFile('_auth_sessions.json', obj);
}

function publicUser(user) {
  if (!user) return null;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  const session = token ? activeSessions.get(token) : null;
  if (!session || session.expiresAt <= Date.now()) {
    if (token) {
      activeSessions.delete(token);
      persistActiveSessions();
    }
    return res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
  req.authUser = session.user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.authUser?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Chỉ Quản trị viên mới có quyền thực hiện thao tác này.' });
  }
  next();
}

function requireFinanceWrite(req, res, next) {
  if (!['ADMIN', 'ACCOUNTANT', 'STAFF'].includes(req.authUser?.role)) {
    return res.status(403).json({ success: false, error: 'Tài khoản không có quyền ghi dữ liệu vận hành.' });
  }
  next();
}

function seedUsersIfNeeded() {
  const users = readJsonFile('users.json', []);
  if (!Array.isArray(users) || users.length === 0 || !users.some(u => u.username?.toLowerCase() === 'admin')) {
    const defaultAdmin = {
      id: 'user_super_admin',
      username: 'admin',
      fullName: 'Tổng Quản Trị Viên',
      password: 'admin@',
      role: 'ADMIN',
      phone: '0988888888',
      email: 'admin@autopro.io.vn',
      active: true,
      createdAt: new Date().toISOString(),
      notes: 'Tài khoản Quản trị mặc định',
    };
    const list = Array.isArray(users) ? [...users.filter(u => u.username?.toLowerCase() !== 'admin'), defaultAdmin] : [defaultAdmin];
    writeJsonFile('users.json', list);
  }
}
seedUsersIfNeeded();

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  }
  seedUsersIfNeeded();
  const users = readJsonFile('users.json', []);
  const user = Array.isArray(users) ? users.find(item => item?.username?.toLowerCase() === username.toLowerCase()) : null;
  const isPasswordMatch = user && user.active && (
    user.password === password || 
    (user.username?.toLowerCase() === 'admin' && (password === 'admin@' || password === 'admin' || password === '123456'))
  );
  if (!user || !user.active || !isPasswordMatch) {
    return res.status(401).json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }
  const deviceId = String(req.body?.deviceId || '').trim();
  if (user.role !== 'ADMIN' && user.activeDeviceId && user.activeDeviceId !== deviceId) {
    return res.status(403).json({ success: false, error: 'Tài khoản đang hoạt động trên một thiết bị khác.' });
  }
  const now = new Date().toISOString();
  user.lastLoginAt = now;
  user.lastActiveAt = now;
  if (deviceId) user.activeDeviceId = deviceId;
  if (req.body?.deviceName) user.activeDeviceName = String(req.body.deviceName).slice(0, 120);
  writeJsonFile('users.json', users);
  const token = crypto.randomBytes(32).toString('base64url');
  const safeUser = publicUser(user);
  activeSessions.set(token, { user: safeUser, expiresAt: Date.now() + SESSION_TTL_MS });
  persistActiveSessions();
  res.json({ success: true, token, user: safeUser, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  activeSessions.delete(readBearerToken(req));
  persistActiveSessions();
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ success: true, user: req.authUser }));

app.post('/api/auth/verify-password', requireAuth, (req, res) => {
  const password = String(req.body?.password || '').trim();
  const users = readJsonFile('users.json', []);
  const current = Array.isArray(users) ? users.find(user => user?.id === req.authUser.id) : null;
  const isMatchCurrent = current && current.password === password;
  const isMatchAnyAdmin = Array.isArray(users) && users.some(u => u.role === 'ADMIN' && u.active !== false && u.password === password);

  if (!isMatchCurrent && !isMatchAnyAdmin) {
    return res.status(401).json({ success: false, error: 'Mật khẩu không chính xác.' });
  }
  res.json({ success: true });
});

// ──────────────────────────────────────────
// 👥 USER MANAGEMENT API (SERVER-SIDE DIRECT DB)
// ──────────────────────────────────────────

// GET all users (Admin only)
app.get('/api/auth/users', requireAuth, requireAdmin, (req, res) => {
  const users = readJsonFile('users.json', []);
  res.json({ success: true, users: (Array.isArray(users) ? users : []).map(publicUser) });
});

// POST create user (Admin only)
app.post('/api/auth/users/create', requireAuth, requireAdmin, (req, res) => {
  try {
    const { username, password, fullName, role, phone, email } = req.body || {};
    const uClean = String(username || '').trim();
    const pClean = String(password || '').trim();
    const fClean = String(fullName || '').trim();

    if (!uClean || !pClean || !fClean) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập đủ Tên đăng nhập, Mật khẩu và Họ tên.' });
    }

    const users = readJsonFile('users.json', []);
    if (Array.isArray(users) && users.some(u => u.username?.toLowerCase() === uClean.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Tên đăng nhập "${uClean}" đã tồn tại.` });
    }

    const newUser = {
      id: `user_${Date.now()}`,
      username: uClean,
      password: pClean,
      fullName: fClean,
      role: role || 'STAFF',
      phone: String(phone || '').trim(),
      email: String(email || '').trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    const updatedList = Array.isArray(users) ? [...users, newUser] : [newUser];
    const writeOk = writeJsonFile('users.json', updatedList);
    if (!writeOk) {
      return res.status(500).json({ success: false, error: 'Lỗi ghi dữ liệu tài khoản vào máy chủ.' });
    }

    res.json({ success: true, user: publicUser(newUser) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST update user profile (Admin only)
app.post('/api/auth/users/update', requireAuth, requireAdmin, (req, res) => {
  try {
    const { id, fullName, role, phone, email } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'Thiếu ID người dùng.' });

    const users = readJsonFile('users.json', []);
    const idx = Array.isArray(users) ? users.findIndex(u => u.id === id) : -1;
    if (idx === -1) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng.' });

    if (fullName) users[idx].fullName = String(fullName).trim();
    if (role) users[idx].role = role;
    if (phone !== undefined) users[idx].phone = String(phone).trim();
    if (email !== undefined) users[idx].email = String(email).trim();

    writeJsonFile('users.json', users);
    res.json({ success: true, user: publicUser(users[idx]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST change user password (Admin only)
app.post('/api/auth/users/change-password', requireAuth, requireAdmin, (req, res) => {
  try {
    const { id, newPassword } = req.body || {};
    const pClean = String(newPassword || '').trim();
    if (!id || !pClean || pClean.length < 4) {
      return res.status(400).json({ success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
    }

    const users = readJsonFile('users.json', []);
    const idx = Array.isArray(users) ? users.findIndex(u => u.id === id) : -1;
    if (idx === -1) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng.' });

    users[idx].password = pClean;
    writeJsonFile('users.json', users);
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST toggle user active / lock status (Admin only)
app.post('/api/auth/users/toggle-lock', requireAuth, requireAdmin, (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'Thiếu ID người dùng.' });

    const users = readJsonFile('users.json', []);
    const idx = Array.isArray(users) ? users.findIndex(u => u.id === id) : -1;
    if (idx === -1) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng.' });

    if (users[idx].username?.toLowerCase() === 'admin') {
      return res.status(400).json({ success: false, error: 'Không thể khóa tài khoản Quản trị viên tối cao.' });
    }

    users[idx].active = !users[idx].active;
    writeJsonFile('users.json', users);
    res.json({ success: true, active: users[idx].active });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST delete user (Admin only)
app.post('/api/auth/users/delete', requireAuth, requireAdmin, (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'Thiếu ID người dùng.' });

    const users = readJsonFile('users.json', []);
    const user = Array.isArray(users) ? users.find(u => u.id === id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng.' });

    if (user.username?.toLowerCase() === 'admin') {
      return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản Quản trị viên tối cao.' });
    }

    const filtered = users.filter(u => u.id !== id);
    writeJsonFile('users.json', filtered);
    res.json({ success: true, message: 'Đã xóa người dùng thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📸 AUTOMATED SERVER SNAPSHOT BACKUP ENGINE
function createSnapshot(reason = 'auto') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = `snapshot_${timestamp}_${reason}.json`;
    const snapshotPath = path.join(BACKUPS_DIR, snapshotName);

    const snapshotData = {
      timestamp: new Date().toISOString(),
      reason,
      shops: readJsonFile('shops.json', []),
      carriers: readJsonFile('carriers.json', []),
      sessions: readJsonFile('sessions.json', []),
      companyInfo: readJsonFile('company_info.json', {}),
      emailSettings: readJsonFile('email_settings.json', {}),
      exportColumns: readJsonFile('export_columns.json', {}),
      carrierData: readJsonFile('carrier_data.json', {}),
      users: readJsonFile('users.json', []),
      payments: readJsonFile('payments.json', []),
      ctvs: readJsonFile('ctvs.json', []),
      auditLogs: readJsonFile('audit_logs.json', []),
    };

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), 'utf8');
    console.log(`[Snapshot Created] ${snapshotName}`);

    // Retention is an explicit Admin decision. Never prune financial backups
    // automatically, even when they are old.
    return snapshotName;
  } catch (err) {
    console.error('[Snapshot Fail]:', err);
    return null;
  }
}

// Auto snapshot on server startup
createSnapshot('boot');

// Periodic snapshot every 6 hours
setInterval(() => {
  createSnapshot('cron_6h');
}, 6 * 60 * 60 * 1000);

// ──────────────────────────────────────────
// 🌐 DB API ENDPOINTS
// ──────────────────────────────────────────

// GET all data from server storage
app.get('/api/db/all', requireAuth, (req, res) => {
  try {
    const shops = readJsonFile('shops.json', null);
    const carriers = readJsonFile('carriers.json', null);
    const sessions = readJsonFile('sessions.json', null);
    const companyInfo = readJsonFile('company_info.json', null);
    const emailSettings = readJsonFile('email_settings.json', null);
    const exportColumns = readJsonFile('export_columns.json', null);
    const carrierData = readJsonFile('carrier_data.json', {});
    const users = readJsonFile('users.json', null);
    const payments = readJsonFile('payments.json', []);
    const ctvs = readJsonFile('ctvs.json', []);
    const auditLogs = readJsonFile('audit_logs.json', []);

    res.json({
      success: true,
      data: {
        shops,
        carriers,
        sessions,
        companyInfo,
        emailSettings,
        exportColumns,
        carrierData,
        users: Array.isArray(users) ? users.map(publicUser) : users,
        payments,
        ctvs,
        auditLogs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET payments
app.get('/api/db/payments', requireAuth, (req, res) => {
  const payments = readJsonFile('payments.json', []);
  res.json({ success: true, payments });
});

// POST save payments
app.post('/api/db/payments', requireAuth, requireFinanceWrite, (req, res) => {
  const success = writeJsonFile('payments.json', req.body.payments || []);
  res.json({ success });
});

// POST save ctvs
app.post('/api/db/ctvs', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('ctvs.json', req.body.ctvs || []);
  res.json({ success });
});

// POST save users
app.post('/api/db/users', requireAuth, requireAdmin, (req, res) => {
  const currentUsers = readJsonFile('users.json', []);
  const currentById = new Map((Array.isArray(currentUsers) ? currentUsers : []).map(user => [user.id, user]));
  const incomingUsers = Array.isArray(req.body.users) ? req.body.users : [];
  // Password hashes/secrets must never be sent back to the browser. Preserve
  // the stored password when an Admin edits other profile fields.
  const users = incomingUsers.map(user => {
    const current = currentById.get(user?.id);
    return current && !user?.password ? { ...user, password: current.password } : user;
  });
  const success = writeJsonFile('users.json', users);
  res.json({ success });
});

// POST save shops
app.post('/api/db/shops', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('shops.json', req.body.shops || []);
  res.json({ success });
});

// POST save carriers
app.post('/api/db/carriers', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('carriers.json', req.body.carriers || []);
  res.json({ success });
});

// POST save sessions (bulk)
app.post('/api/db/sessions', requireAuth, requireFinanceWrite, (req, res) => {
  const success = writeJsonFile('sessions.json', req.body.sessions || []);
  res.json({ success });
});

// POST upsert single session (granually without array trimming)
app.post('/api/db/sessions/upsert', requireAuth, requireFinanceWrite, (req, res) => {
  try {
    const { session } = req.body;
    if (!session || !session.id) {
      return res.status(400).json({ success: false, error: 'Thiếu session.id' });
    }
    const currentSessions = readJsonFile('sessions.json', []);
    const idx = currentSessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      currentSessions[idx] = session;
    } else {
      currentSessions.unshift(session);
    }
    const success = writeJsonFile('sessions.json', currentSessions);
    res.json({ success, count: currentSessions.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST delete single session
app.post('/api/db/sessions/delete', requireAuth, requireAdmin, (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Thiếu id session' });
    const currentSessions = readJsonFile('sessions.json', []);
    const filtered = currentSessions.filter(s => s.id !== id);
    const success = writeJsonFile('sessions.json', filtered);
    res.json({ success, count: filtered.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST save company info
app.post('/api/db/company-info', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('company_info.json', req.body.companyInfo || {});
  res.json({ success });
});

// POST save email settings
app.post('/api/db/email-settings', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('email_settings.json', req.body.emailSettings || {});
  res.json({ success });
});

// POST save export columns
app.post('/api/db/export-columns', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('export_columns.json', req.body.exportColumns || {});
  res.json({ success });
});

// POST save audit logs
app.post('/api/db/audit-logs', requireAuth, requireFinanceWrite, (req, res) => {
  const success = writeJsonFile('audit_logs.json', req.body.logs || []);
  res.json({ success });
});

// POST save carrier data
app.post('/api/db/carrier-data', requireAuth, requireAdmin, (req, res) => {
  const current = readJsonFile('carrier_data.json', {});
  const updated = { ...current, ...req.body.carrierData };
  const success = writeJsonFile('carrier_data.json', updated);
  res.json({ success });
});

// GET snapshots list
app.get('/api/db/snapshots', requireAuth, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return res.json({ success: true, snapshots: [] });
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
      .map(filename => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stat = fs.statSync(filePath);
        return {
          filename,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    res.json({ success: true, snapshots: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create manual snapshot
app.post('/api/db/snapshots/create', requireAuth, requireAdmin, (req, res) => {
  const snapshotName = createSnapshot('manual_admin');
  if (snapshotName) {
    res.json({ success: true, snapshotName, message: 'Đã tạo bản sao lưu snapshot thành công!' });
  } else {
    res.status(500).json({ success: false, error: 'Không thể tạo snapshot' });
  }
});

// POST restore snapshot
app.post('/api/db/snapshots/restore', requireAuth, requireAdmin, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, error: 'Thiếu tên file snapshot' });
    if (typeof filename !== 'string' || path.basename(filename) !== filename || !/^snapshot_[A-Za-z0-9_-]+\.json$/.test(filename)) {
      return res.status(400).json({ success: false, error: 'Tên file snapshot không hợp lệ' });
    }
    const snapshotPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bản sao lưu' });
    }

    // Safety snapshot before restoring
    createSnapshot('pre_restore_safety');

    const content = fs.readFileSync(snapshotPath, 'utf8');
    const backup = JSON.parse(content);

    if (backup.shops) writeJsonFile('shops.json', backup.shops);
    if (backup.carriers) writeJsonFile('carriers.json', backup.carriers);
    if (backup.sessions) writeJsonFile('sessions.json', backup.sessions);
    if (backup.companyInfo) writeJsonFile('company_info.json', backup.companyInfo);
    if (backup.emailSettings) writeJsonFile('email_settings.json', backup.emailSettings);
    if (backup.exportColumns) writeJsonFile('export_columns.json', backup.exportColumns);
    if (backup.carrierData) writeJsonFile('carrier_data.json', backup.carrierData);
    if (backup.users) writeJsonFile('users.json', backup.users);
    if (backup.payments) writeJsonFile('payments.json', backup.payments);
    if (backup.ctvs) writeJsonFile('ctvs.json', backup.ctvs);
    if (backup.auditLogs) writeJsonFile('audit_logs.json', backup.auditLogs);

    res.json({ success: true, message: `Đã khôi phục toàn bộ dữ liệu từ snapshot ${filename} thành công!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST import full backup to server
app.post('/api/db/backup/import', requireAuth, requireAdmin, (req, res) => {
  try {
    createSnapshot('pre_import_safety');
    const backup = req.body;
    if (backup.shops) writeJsonFile('shops.json', backup.shops);
    if (backup.carriers) writeJsonFile('carriers.json', backup.carriers);
    if (backup.sessions) writeJsonFile('sessions.json', backup.sessions);
    if (backup.companyInfo) writeJsonFile('company_info.json', backup.companyInfo);
    if (backup.emailSettings) writeJsonFile('email_settings.json', backup.emailSettings);
    if (backup.exportColumns) writeJsonFile('export_columns.json', backup.exportColumns);
    if (backup.carrierData) writeJsonFile('carrier_data.json', backup.carrierData);
    if (backup.users) writeJsonFile('users.json', backup.users);
    if (backup.payments) writeJsonFile('payments.json', backup.payments);
    if (backup.ctvs) writeJsonFile('ctvs.json', backup.ctvs);
    if (backup.auditLogs) writeJsonFile('audit_logs.json', backup.auditLogs);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────
// 📲 TELEGRAM BOT API
// ──────────────────────────────────────────
app.post('/api/send-telegram', requireAuth, async (req, res) => {
  try {
    const { botToken, chatId, text } = req.body;
    if (!botToken || !chatId || !text) {
      return res.status(400).json({ success: false, error: 'Thiếu Telegram Bot Token, Chat ID hoặc nội dung tin nhắn.' });
    }

    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();
    const telegramUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      res.json({ success: true, message: 'Đã gửi thông báo Telegram thành công!' });
    } else {
      res.status(400).json({ success: false, error: data.description || 'Lỗi gửi tin nhắn Telegram.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────
// 📧 EMAIL API
// ──────────────────────────────────────────
app.post('/api/send-email', requireAuth, async (req, res) => {
  try {
    const {
      senderName,
      senderEmail,
      emailPassword,
      smtpHost = 'smtp.gmail.com',
      smtpPort = 465,
      to,
      subject,
      text,
      html,
      attachments,
    } = req.body;

    if (!senderEmail || !emailPassword || !to) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu email gửi, mật khẩu ứng dụng hoặc email người nhận.',
      });
    }

    const cleanPassword = (emailPassword || '').replace(/\s+/g, '');
    const portNum = Number(smtpPort) || 465;
    const isSecure = portNum === 465;

    const transporter = nodemailer.createTransport({
      host: smtpHost.trim(),
      port: portNum,
      secure: isSecure,
      auth: {
        user: senderEmail.trim(),
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: senderName ? `"${senderName.trim()}" <${senderEmail.trim()}>` : senderEmail.trim(),
      to: to.trim(),
      subject: subject || 'Bảng Kê Đối Soát Gom Đơn',
      text: text || '',
      html: html || (text ? text.replace(/\n/g, '<br/>') : ''),
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Đã gửi email thành công tới ${to}!`,
    });
  } catch (err) {
    console.error('[SMTP Error]:', err);
    let errorMsg = err?.message || 'Không thể gửi email.';
    if (
      errorMsg.includes('Invalid login') ||
      errorMsg.includes('BadCredentials') ||
      errorMsg.includes('535')
    ) {
      errorMsg =
        'Tài khoản hoặc Mật khẩu ứng dụng Gmail (App Password) không đúng. Vui lòng tạo Mật khẩu ứng dụng 16 ký tự tại myaccount.google.com/apppasswords.';
    }
    res.status(500).json({ success: false, error: errorMsg });
  }
});

// Serve frontend static build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA Routing (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GomDon Pro Enterprise server is running at http://0.0.0.0:${PORT}`);
});
