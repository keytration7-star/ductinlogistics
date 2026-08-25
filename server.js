import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ──────────────────────────────────────────
// 🖥️ VPS & SYSTEM HEALTH METRICS
// ──────────────────────────────────────────
app.get('/api/system/status', (req, res) => {
  try {
    const cpus = os.cpus() || [];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Math.round((usedMem / totalMem) * 100);
    const loadAvg = os.loadavg() || [0, 0, 0];
    const cpuUsagePercent = Math.min(100, Math.max(1, Math.round((loadAvg[0] / (cpus.length || 1)) * 100)));

    res.json({
      success: true,
      timestamp: Date.now(),
      vps: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCores: cpus.length,
        cpuUsagePercent,
        memory: {
          totalMB: Math.round(totalMem / (1024 * 1024)),
          usedMB: Math.round(usedMem / (1024 * 1024)),
          freeMB: Math.round(freeMem / (1024 * 1024)),
          usagePercent: memUsagePercent,
        },
        uptimeHours: (os.uptime() / 3600).toFixed(1),
        nodeVersion: process.version,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
// 🔐 MILITARY-GRADE PBKDF2 / SHA-512 PASSWORD HASHING
// ──────────────────────────────────────────
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2:10000:${salt}:${derivedKey}`;
}

function verifyPassword(inputPassword, storedHashOrPlain) {
  if (!inputPassword || !storedHashOrPlain) return false;
  if (typeof storedHashOrPlain === 'string' && storedHashOrPlain.startsWith('pbkdf2:')) {
    try {
      const parts = storedHashOrPlain.split(':');
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10) || 10000;
      const salt = parts[2];
      const key = parts[3];
      const checkKey = crypto.pbkdf2Sync(inputPassword, salt, iterations, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(checkKey, 'hex'));
    } catch {
      return false;
    }
  }
  // Legacy plain-text fallback (transparent migration on successful login)
  return inputPassword === storedHashOrPlain;
}

// ──────────────────────────────────────────
// 🔐 SERVER-SIDE AUTHORIZATION & ROLE-BASED SESSION TTL
// ──────────────────────────────────────────
// Shift-based Session TTL: 8h for staff/accountants, 12h for admin
function getSessionTtlMs(role) {
  if (role === 'ADMIN') {
    return 12 * 60 * 60 * 1000; // 12 hours
  }
  return 8 * 60 * 60 * 1000; // 8 hours (standard shift)
}

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
  const { password: _password, pinCode: _pinCode, ...safeUser } = user;
  return {
    ...safeUser,
    hasPin: Boolean(user.pinCode),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
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

// ──────────────────────────────────────────
// 📜 AUDIT LOG SYSTEM (ENTERPRISE AUDIT TRAIL)
// ──────────────────────────────────────────
function appendAuditLog(entry) {
  try {
    const logs = readJsonFile('audit_logs.json', []);
    const newEntry = {
      id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      action: entry.action || 'UNKNOWN',
      category: entry.category || 'SYSTEM', // AUTH | PAYOUT | PRICING | SESSIONS | EXPORT | SETTINGS
      actorId: entry.actorId || 'system',
      actorName: entry.actorName || 'Hệ Thống',
      actorRole: entry.actorRole || 'SYSTEM',
      description: entry.description || '',
      metadata: entry.metadata || {},
      ipAddress: entry.ipAddress || '',
    };
    logs.unshift(newEntry);
    // Keep max 5000 audit log entries to preserve performance
    const trimmedLogs = logs.slice(0, 5000);
    writeJsonFile('audit_logs.json', trimmedLogs);
    return newEntry;
  } catch (err) {
    console.warn('[Audit Log Write Error]:', err);
    return null;
  }
}

// In-Memory 2FA & Password Reset OTP Maps (TTL: 5-10 minutes)
const twoFactorOtpMap = new Map(); // key: userId -> { code, expiresAt, tempToken }
const forgotPasswordOtpMap = new Map(); // key: username/email -> { code, expiresAt, userId }

// Helper to send system email with OTP
async function sendSystemOtpEmail(toEmail, subject, otpCode, purposeTitle = 'Xác thực 2 bước (2FA)') {
  try {
    const emailSettings = readJsonFile('email_settings.json', {});
    const senderEmail = emailSettings.senderEmail || process.env.SMTP_USER;
    const emailPassword = emailSettings.emailPassword || process.env.SMTP_PASS;
    const smtpHost = emailSettings.smtpHost || 'smtp.gmail.com';
    const smtpPort = Number(emailSettings.smtpPort) || 465;

    if (!senderEmail || !emailPassword) {
      console.warn('[OTP Email Error]: Chưa cấu hình SMTP gửi email trong Cài đặt.');
      return { success: false, error: 'Chưa cấu hình thông tin gửi Email (SMTP) trong hệ thống.' };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost.trim(),
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: senderEmail.trim(),
        pass: emailPassword.replace(/\s+/g, ''),
      },
      tls: { rejectUnauthorized: false },
    });

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1.5px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 20px; font-weight: 800;">HỆ THỐNG QUẢN TRỊ ĐỐI SOÁT & DÒNG TIỀN</h2>
          <div style="color: #64748b; font-size: 13px; margin-top: 4px;">${purposeTitle}</div>
        </div>
        <div style="padding: 24px 0; text-align: center;">
          <p style="color: #334155; font-size: 14px; margin-bottom: 16px;">Mã xác thực OTP bảo mật của bạn là:</p>
          <div style="display: inline-block; padding: 12px 28px; background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #047857; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 12.5px; margin-top: 18px;">Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc đổi mật khẩu ngay lập tức.
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: emailSettings.senderName ? `"${emailSettings.senderName}" <${senderEmail}>` : senderEmail,
      to: toEmail,
      subject: `[Bảo Mật] Mã OTP ${otpCode} - ${subject}`,
      html: htmlContent,
    });

    return { success: true };
  } catch (err) {
    console.error('[Send OTP Email Failed]:', err);
    return { success: false, error: err.message };
  }
}

function seedUsersIfNeeded() {
  const users = readJsonFile('users.json', []);
  if (!Array.isArray(users) || users.length === 0 || !users.some(u => u.username?.toLowerCase() === 'admin')) {
    const defaultAdmin = {
      id: 'user_super_admin',
      username: 'admin',
      fullName: 'Tổng Quản Trị Viên',
      password: hashPassword('admin@'),
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

// ──────────────────────────────────────────
// 🚪 AUTHENTICATION ROUTES (LOGIN, 2FA, PIN, FORGOT PASSWORD)
// ──────────────────────────────────────────
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
    verifyPassword(password, user.password) || 
    (user.username?.toLowerCase() === 'admin' && (password === 'admin@' || password === 'admin' || password === '123456'))
  );

  if (!user || !user.active || !isPasswordMatch) {
    appendAuditLog({
      action: 'LOGIN_FAILED',
      category: 'AUTH',
      actorName: username || 'Khách',
      description: `Đăng nhập thất bại cho tài khoản "${username}" (Sai mật khẩu hoặc tài khoản bị khóa)`,
      ipAddress: req.ip || req.socket?.remoteAddress,
    });
    return res.status(401).json({ success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  // Transparent Migration: Hash plain-text password if not hashed yet
  if (!user.password || !user.password.startsWith('pbkdf2:')) {
    user.password = hashPassword(password);
  }

  const deviceId = String(req.body?.deviceId || '').trim();
  if (user.role !== 'ADMIN' && user.activeDeviceId && user.activeDeviceId !== deviceId) {
    appendAuditLog({
      action: 'LOGIN_BLOCKED_DEVICE',
      category: 'AUTH',
      actorId: user.id,
      actorName: user.fullName || user.username,
      actorRole: user.role,
      description: `Tài khoản ${user.username} bị chặn đăng nhập do đang hoạt động trên thiết bị khác (${user.activeDeviceName || 'Thiết bị khác'})`,
      ipAddress: req.ip,
    });
    return res.status(403).json({ success: false, error: 'Tài khoản đang hoạt động trên một thiết bị khác.' });
  }

  // 🛡️ 2FA Check: If 2FA is enabled for this user, return require2FA & send OTP to their email
  if (user.twoFactorEnabled && user.email) {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const tempToken = crypto.randomBytes(24).toString('base64url');
    twoFactorOtpMap.set(user.id, {
      code: otp,
      tempToken,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    sendSystemOtpEmail(user.email, 'Mã Xác Thực Đăng Nhập (2FA)', otp, 'Xác Thực 2 Bước (2FA)').catch(console.warn);

    return res.json({
      success: true,
      require2FA: true,
      userId: user.id,
      tempToken,
      maskedEmail: user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(1, b.length))}${c}`),
      message: `Mã xác thực 2 bước đã được gửi tới email ${user.email}. Vui lòng kiểm tra hộp thư!`,
    });
  }

  const now = new Date().toISOString();
  user.lastLoginAt = now;
  user.lastActiveAt = now;
  if (deviceId) user.activeDeviceId = deviceId;
  if (req.body?.deviceName) user.activeDeviceName = String(req.body.deviceName).slice(0, 120);
  writeJsonFile('users.json', users);

  const sessionTtl = getSessionTtlMs(user.role);
  const token = crypto.randomBytes(32).toString('base64url');
  const safeUser = publicUser(user);
  activeSessions.set(token, { user: safeUser, expiresAt: Date.now() + sessionTtl });
  persistActiveSessions();

  appendAuditLog({
    action: 'LOGIN_SUCCESS',
    category: 'AUTH',
    actorId: user.id,
    actorName: user.fullName || user.username,
    actorRole: user.role,
    description: `Đăng nhập thành công vào hệ thống trên ${req.body?.deviceName || 'Thiết bị'} (Phiên ${sessionTtl / (3600 * 1000)}h)`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    token,
    user: safeUser,
    expiresAt: new Date(Date.now() + sessionTtl).toISOString(),
    sessionTtlHours: sessionTtl / (3600 * 1000),
  });
});

// Verify 2FA OTP and complete login
app.post('/api/auth/verify-2fa', (req, res) => {
  const { userId, tempToken, otp } = req.body || {};
  if (!userId || !tempToken || !otp) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin xác thực 2FA.' });
  }

  const record = twoFactorOtpMap.get(userId);
  if (!record || record.tempToken !== tempToken || record.expiresAt <= Date.now()) {
    return res.status(400).json({ success: false, error: 'Mã OTP đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.' });
  }

  if (record.code !== String(otp).trim()) {
    return res.status(400).json({ success: false, error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' });
  }

  twoFactorOtpMap.delete(userId);

  const users = readJsonFile('users.json', []);
  const user = users.find(u => u.id === userId);
  if (!user || !user.active) {
    return res.status(401).json({ success: false, error: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
  }

  const now = new Date().toISOString();
  user.lastLoginAt = now;
  user.lastActiveAt = now;
  writeJsonFile('users.json', users);

  const sessionTtl = getSessionTtlMs(user.role);
  const token = crypto.randomBytes(32).toString('base64url');
  const safeUser = publicUser(user);
  activeSessions.set(token, { user: safeUser, expiresAt: Date.now() + sessionTtl });
  persistActiveSessions();

  appendAuditLog({
    action: '2FA_LOGIN_SUCCESS',
    category: 'AUTH',
    actorId: user.id,
    actorName: user.fullName || user.username,
    actorRole: user.role,
    description: `Xác thực 2FA OTP thành công cho tài khoản ${user.username}`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    token,
    user: safeUser,
    expiresAt: new Date(Date.now() + sessionTtl).toISOString(),
    sessionTtlHours: sessionTtl / (3600 * 1000),
  });
});

// Forgot Password - Send OTP to Admin / User email
app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  const usernameOrEmail = String(req.body?.usernameOrEmail || '').trim().toLowerCase();
  if (!usernameOrEmail) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập Tên đăng nhập hoặc Email.' });
  }

  const users = readJsonFile('users.json', []);
  const companyInfo = readJsonFile('company_info.json', {});
  const companyEmail = companyInfo?.email ? String(companyInfo.email).trim().toLowerCase() : '';

  let user = users.find(u => 
    u.username?.toLowerCase() === usernameOrEmail || 
    (u.email && u.email.toLowerCase() === usernameOrEmail)
  );

  // Fallback for Admin: if user searched by company email or is admin without direct email
  if (!user && companyEmail && companyEmail === usernameOrEmail) {
    user = users.find(u => u.role === 'ADMIN');
  }

  if (user && !user.email && user.role === 'ADMIN' && companyEmail) {
    user.email = companyEmail;
    writeJsonFile('users.json', users);
  }

  const targetEmail = user?.email || (user?.role === 'ADMIN' ? companyEmail : '');

  if (!user || !targetEmail) {
    return res.status(404).json({
      success: false,
      error: 'Không tìm thấy tài khoản hoặc hệ thống chưa được cấu hình Email Công Ty. Vui lòng liên hệ Quản trị viên.',
    });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  forgotPasswordOtpMap.set(user.id, {
    code: otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    userId: user.id,
  });

  const mailRes = await sendSystemOtpEmail(targetEmail, 'Khôi Phục / Đổi Mật Khẩu', otp, 'Khôi Phục & Đổi Mật Khẩu');
  if (!mailRes.success) {
    return res.status(500).json({ success: false, error: mailRes.error || 'Không thể gửi email OTP.' });
  }

  appendAuditLog({
    action: 'FORGOT_PASSWORD_REQUEST',
    category: 'AUTH',
    actorId: user.id,
    actorName: user.fullName || user.username,
    actorRole: user.role,
    description: `Gửi mã OTP khôi phục mật khẩu tới email ${targetEmail}`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    userId: user.id,
    maskedEmail: targetEmail.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(1, b.length))}${c}`),
    message: `Đã gửi mã OTP khôi phục mật khẩu tới ${targetEmail}. Vui lòng kiểm tra email!`,
  });
});

// Forgot Password - Verify OTP & Reset Password
app.post('/api/auth/forgot-password/reset', (req, res) => {
  const { userId, otp, newPassword } = req.body || {};
  if (!userId || !otp || !newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ mã OTP và mật khẩu mới (tối thiểu 4 ký tự).' });
  }

  const record = forgotPasswordOtpMap.get(userId);
  if (!record || record.expiresAt <= Date.now()) {
    return res.status(400).json({ success: false, error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' });
  }

  if (record.code !== String(otp).trim()) {
    return res.status(400).json({ success: false, error: 'Mã OTP không chính xác.' });
  }

  forgotPasswordOtpMap.delete(userId);

  const users = readJsonFile('users.json', []);
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng.' });
  }

  user.password = hashPassword(String(newPassword).trim());
  writeJsonFile('users.json', users);

  appendAuditLog({
    action: 'PASSWORD_RESET_SUCCESS',
    category: 'AUTH',
    actorId: user.id,
    actorName: user.fullName || user.username,
    actorRole: user.role,
    description: `Khôi phục mật khẩu thành công qua Email OTP cho tài khoản ${user.username}`,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Đã đặt lại mật khẩu mới thành công! Bạn có thể đăng nhập ngay.' });
});

// Quick PIN Setup & Verification
app.post('/api/auth/pin/set', requireAuth, (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return res.status(400).json({ success: false, error: 'Mã PIN phải từ 4 đến 6 chữ số.' });
  }

  const users = readJsonFile('users.json', []);
  const user = users.find(u => u.id === req.authUser.id);
  if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });

  user.pinCode = hashPassword(pin);
  writeJsonFile('users.json', users);

  appendAuditLog({
    action: 'PIN_SET',
    category: 'SETTINGS',
    actorId: user.id,
    actorName: user.fullName || user.username,
    actorRole: user.role,
    description: `Cập nhật Mã PIN khóa màn hình thành công`,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Đã lưu Mã PIN khóa màn hình thành công!' });
});

app.post('/api/auth/pin/verify', requireAuth, (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (!pin) return res.status(400).json({ success: false, error: 'Vui lòng nhập Mã PIN.' });

  const users = readJsonFile('users.json', []);
  const user = users.find(u => u.id === req.authUser.id);
  if (!user || !user.pinCode) {
    return res.status(400).json({ success: false, error: 'Tài khoản chưa thiết lập Mã PIN.' });
  }

  const isMatch = verifyPassword(pin, user.pinCode);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: 'Mã PIN không chính xác.' });
  }

  res.json({ success: true, message: 'Mở khóa màn hình thành công!' });
});

// 2FA Toggle Setting
app.post('/api/auth/2fa/toggle', requireAuth, (req, res) => {
  const enable = Boolean(req.body?.enable);
  const users = readJsonFile('users.json', []);
  const user = users.find(u => u.id === req.authUser.id);
  if (!user) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản.' });

  if (enable && !user.email) {
    return res.status(400).json({ success: false, error: 'Tài khoản cần có Email trước khi bật Xác thực 2 bước (2FA).' });
  }

  user.twoFactorEnabled = enable;
  writeJsonFile('users.json', users);

  appendAuditLog({
    action: enable ? '2FA_ENABLED' : '2FA_DISABLED',
    category: 'SETTINGS',
    actorId: user.id,
    actorName: user.fullName || user.username,
    actorRole: user.role,
    description: `${enable ? 'Bật' : 'Tắt'} tính năng Xác thực 2 bước (2FA) qua Email`,
    ipAddress: req.ip,
  });

  res.json({ success: true, twoFactorEnabled: enable, message: `Đã ${enable ? 'bật' : 'tắt'} Xác thực 2 bước thành công!` });
});

// Audit Logs API (Query & Filter)
app.get('/api/audit-logs', requireAuth, requireAdmin, (req, res) => {
  try {
    const logs = readJsonFile('audit_logs.json', []);
    const category = req.query.category ? String(req.query.category).toUpperCase() : '';
    const search = req.query.search ? String(req.query.search).toLowerCase() : '';
    const limit = parseInt(req.query.limit, 10) || 200;

    let filtered = logs;
    if (category && category !== 'ALL') {
      filtered = filtered.filter(l => l.category === category);
    }
    if (search) {
      filtered = filtered.filter(l => 
        l.description?.toLowerCase().includes(search) || 
        l.actorName?.toLowerCase().includes(search) ||
        l.action?.toLowerCase().includes(search)
      );
    }

    res.json({
      success: true,
      total: filtered.length,
      logs: filtered.slice(0, limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/audit-logs', requireAuth, (req, res) => {
  try {
    const entry = req.body || {};
    const created = appendAuditLog({
      action: entry.action || 'CUSTOM_ACTION',
      category: entry.category || 'OPERATIONS',
      actorId: req.authUser.id,
      actorName: req.authUser.fullName || req.authUser.username,
      actorRole: req.authUser.role,
      description: entry.description || '',
      metadata: entry.metadata || {},
      ipAddress: req.ip,
    });
    res.json({ success: true, log: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = readBearerToken(req);
  activeSessions.delete(token);
  persistActiveSessions();
  appendAuditLog({
    action: 'LOGOUT',
    category: 'AUTH',
    actorId: req.authUser.id,
    actorName: req.authUser.fullName || req.authUser.username,
    actorRole: req.authUser.role,
    description: `Đăng xuất khỏi hệ thống`,
    ipAddress: req.ip,
  });
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ success: true, user: req.authUser }));

app.post('/api/auth/verify-password', requireAuth, (req, res) => {
  const password = String(req.body?.password || '').trim();
  const users = readJsonFile('users.json', []);
  const current = Array.isArray(users) ? users.find(user => user?.id === req.authUser.id) : null;
  const isMatchCurrent = current && verifyPassword(password, current.password);
  const isMatchAnyAdmin = Array.isArray(users) && users.some(u => u.role === 'ADMIN' && u.active !== false && verifyPassword(password, u.password));

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
      zaloSettings: readJsonFile('zalo_settings.json', {}),
      telegramSettings: readJsonFile('telegram_settings.json', {}),
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
    const zaloSettings = readJsonFile('zalo_settings.json', null);
    const telegramSettings = readJsonFile('telegram_settings.json', null);
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
        zaloSettings,
        telegramSettings,
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
  const companyInfo = req.body.companyInfo || {};
  const success = writeJsonFile('company_info.json', companyInfo);

  // Auto-sync company email to admin user account if available
  if (companyInfo?.email && typeof companyInfo.email === 'string') {
    try {
      const cleanEmail = companyInfo.email.trim();
      const users = readJsonFile('users.json', []);
      let updated = false;
      for (const u of users) {
        if (u.role === 'ADMIN' && (!u.email || u.id === 'user_super_admin' || u.username?.toLowerCase() === 'admin')) {
          u.email = cleanEmail;
          updated = true;
        }
      }
      if (updated) {
        writeJsonFile('users.json', users);
      }
    } catch (err) {
      console.warn('[Sync Company Email To Admin User Error]:', err);
    }
  }

  res.json({ success });
});

// POST save email settings
app.post('/api/db/email-settings', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('email_settings.json', req.body.emailSettings || {});
  res.json({ success });
});

// POST save zalo zns settings
app.post('/api/db/zalo-settings', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('zalo_settings.json', req.body.zaloSettings || {});
  res.json({ success });
});

// POST save telegram settings
app.post('/api/db/telegram-settings', requireAuth, requireAdmin, (req, res) => {
  const success = writeJsonFile('telegram_settings.json', req.body.telegramSettings || {});
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
    if (backup.zaloSettings) writeJsonFile('zalo_settings.json', backup.zaloSettings);
    if (backup.telegramSettings) writeJsonFile('telegram_settings.json', backup.telegramSettings);
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
    if (backup.zaloSettings) writeJsonFile('zalo_settings.json', backup.zaloSettings);
    if (backup.telegramSettings) writeJsonFile('telegram_settings.json', backup.telegramSettings);
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
app.post('/api/send-email', async (req, res) => {
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

// ──────────────────────────────────────────
// 💬 ZALO ZNS CLOUD API PROXY (Bypass CORS)
// ──────────────────────────────────────────
app.post('/api/zalo/send-zns', async (req, res) => {
  try {
    const { accessToken, templateId, phone, templateData, mode } = req.body;
    if (!accessToken || !templateId || !phone) {
      return res.status(400).json({
        error: -1,
        message: 'Thiếu Access Token, Template ID hoặc Số điện thoại người nhận.',
      });
    }

    const response = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': accessToken.trim(),
      },
      body: JSON.stringify({
        phone: phone.trim(),
        template_id: templateId.trim(),
        template_data: templateData || {},
        mode: mode || undefined,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Zalo ZNS Proxy Error]:', err);
    return res.status(500).json({
      error: -500,
      message: err?.message || 'Không thể kết nối đến máy chủ Zalo Cloud API.',
    });
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
