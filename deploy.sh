#!/bin/bash
# Script tự động cập nhật và build trên VPS cho ductinlogistics.shop

echo "🚀 Bắt đầu cập nhật ứng dụng GomDon Pro (ductinlogistics.shop)..."

# Kéo code mới nhất từ GitHub
git pull origin main

# Cài đặt thư viện & build production
npm install
npm run build

# Khởi động lại service bằng PM2
pm2 restart gomdon-pro || pm2 start server.js --name "gomdon-pro"

echo "✅ Hoàn tất cập nhật! Ứng dụng đang chạy tại https://ductinlogistics.shop"
