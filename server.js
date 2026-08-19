import express from 'express';
import path from 'path';
import fs from 'fs';
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
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

function writeJsonFile(filename, data) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[DB Write Error] ${filename}:`, err);
    return false;
  }
}

// ──────────────────────────────────────────
// 🌐 DB API ENDPOINTS
// ──────────────────────────────────────────

// GET all data from server storage
app.get('/api/db/all', (req, res) => {
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
        users,
        payments,
        ctvs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET payments
app.get('/api/db/payments', (req, res) => {
  const payments = readJsonFile('payments.json', []);
  res.json({ success: true, payments });
});

// POST save payments
app.post('/api/db/payments', (req, res) => {
  const success = writeJsonFile('payments.json', req.body.payments || []);
  res.json({ success });
});

// POST save ctvs
app.post('/api/db/ctvs', (req, res) => {
  const success = writeJsonFile('ctvs.json', req.body.ctvs || []);
  res.json({ success });
});

// POST save users
app.post('/api/db/users', (req, res) => {
  const success = writeJsonFile('users.json', req.body.users || []);
  res.json({ success });
});

// POST save shops
app.post('/api/db/shops', (req, res) => {
  const success = writeJsonFile('shops.json', req.body.shops || []);
  res.json({ success });
});

// POST save carriers
app.post('/api/db/carriers', (req, res) => {
  const success = writeJsonFile('carriers.json', req.body.carriers || []);
  res.json({ success });
});

// POST save sessions
app.post('/api/db/sessions', (req, res) => {
  const success = writeJsonFile('sessions.json', req.body.sessions || []);
  res.json({ success });
});

// POST save company info
app.post('/api/db/company-info', (req, res) => {
  const success = writeJsonFile('company_info.json', req.body.companyInfo || {});
  res.json({ success });
});

// POST save email settings
app.post('/api/db/email-settings', (req, res) => {
  const success = writeJsonFile('email_settings.json', req.body.emailSettings || {});
  res.json({ success });
});

// POST save export columns
app.post('/api/db/export-columns', (req, res) => {
  const success = writeJsonFile('export_columns.json', req.body.exportColumns || {});
  res.json({ success });
});

// POST save audit logs
app.post('/api/db/audit-logs', (req, res) => {
  const success = writeJsonFile('audit_logs.json', req.body.logs || []);
  res.json({ success });
});

// POST save carrier data (mappings, export settings, headers per carrier)
app.post('/api/db/carrier-data', (req, res) => {
  const current = readJsonFile('carrier_data.json', {});
  const updated = { ...current, ...req.body.carrierData };
  const success = writeJsonFile('carrier_data.json', updated);
  res.json({ success });
});

// POST import full backup to server
app.post('/api/db/backup/import', (req, res) => {
  try {
    const backup = req.body;
    if (backup.shops) writeJsonFile('shops.json', backup.shops);
    if (backup.carriers) writeJsonFile('carriers.json', backup.carriers);
    if (backup.sessions) writeJsonFile('sessions.json', backup.sessions);
    if (backup.companyInfo) writeJsonFile('company_info.json', backup.companyInfo);
    if (backup.emailSettings) writeJsonFile('email_settings.json', backup.emailSettings);
    if (backup.exportColumns) writeJsonFile('export_columns.json', backup.exportColumns);
    if (backup.carrierData) writeJsonFile('carrier_data.json', backup.carrierData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────
// 📲 TELEGRAM BOT API
// ──────────────────────────────────────────
app.post('/api/send-telegram', async (req, res) => {
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

// Serve frontend static build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA Routing (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GomDon Pro Enterprise server is running at http://0.0.0.0:${PORT}`);
});
