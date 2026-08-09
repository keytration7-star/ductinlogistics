import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import nodemailer from 'nodemailer';

function emailApiPlugin(): Plugin {
  return {
    name: 'email-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/send-email', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
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
            } = data;

            if (!senderEmail || !emailPassword || !to) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Thiếu email gửi, mật khẩu ứng dụng hoặc email người nhận.',
                })
              );
              return;
            }

            // Remove whitespace from Google App Password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
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

            // Prepare mail options
            const mailOptions: nodemailer.SendMailOptions = {
              from: senderName ? `"${senderName.trim()}" <${senderEmail.trim()}>` : senderEmail.trim(),
              to: to.trim(),
              subject: subject || 'Bảng Kê Đối Soát Gom Đơn',
              text: text || '',
              html: html || (text ? text.replace(/\n/g, '<br/>') : ''),
            };

            if (attachments && Array.isArray(attachments) && attachments.length > 0) {
              mailOptions.attachments = attachments.map((att: any) => ({
                filename: att.filename,
                content: Buffer.from(att.content, 'base64'),
                contentType: att.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              }));
            }

            const info = await transporter.sendMail(mailOptions);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                messageId: info.messageId,
                message: `Đã gửi email thành công tới ${to}!`,
              })
            );
          } catch (err: any) {
            console.error('[SMTP Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            let errorMsg = err?.message || 'Không thể gửi email.';
            if (
              errorMsg.includes('Invalid login') ||
              errorMsg.includes('BadCredentials') ||
              errorMsg.includes('535')
            ) {
              errorMsg =
                'Tài khoản hoặc Mật khẩu ứng dụng Gmail (App Password) không đúng. Vui lòng tạo Mật khẩu ứng dụng 16 ký tự tại myaccount.google.com/apppasswords.';
            }
            res.end(JSON.stringify({ success: false, error: errorMsg }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emailApiPlugin()],
});
