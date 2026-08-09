import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Send Email
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
