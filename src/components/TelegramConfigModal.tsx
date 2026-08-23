import React, { useState } from "react";
import { 
  X, 
  Save, 
  Send, 
  Key, 
  ExternalLink, 
  Sparkles, 
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  Zap,
  RotateCcw,
  Bot
} from "lucide-react";
import type { TelegramSettings } from "../types";
import { TelegramService } from "../services/telegramService";
import { useToast } from "./UIFeedback";

interface TelegramConfigModalProps {
  settings: TelegramSettings;
  onSave: (settings: TelegramSettings) => void;
  onClose: () => void;
}

export const TelegramConfigModal: React.FC<TelegramConfigModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<TelegramSettings>({ ...settings });
  const [activeTab, setActiveTab] = useState<"config" | "template" | "guide">("config");
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [botInfo, setBotInfo] = useState<{ botName?: string; username?: string } | null>(null);
  const [isTestingPing, setIsTestingPing] = useState(false);

  const handleCheckBot = async () => {
    if (!formData.botToken?.trim()) {
      showToast("Vui lòng nhập Bot Token trước khi kiểm tra!", "warning");
      return;
    }
    setIsCheckingBot(true);
    const res = await TelegramService.getBotInfo(formData.botToken);
    setIsCheckingBot(false);
    if (res.success) {
      setBotInfo({ botName: res.botName, username: res.username });
      showToast(`✅ Kết nối Bot thành công: ${res.botName} (@${res.username})`, "success");
    } else {
      setBotInfo(null);
      showToast(`❌ Lỗi Bot: ${res.error}`, "error");
    }
  };

  const handleTestPing = async () => {
    if (!formData.botToken?.trim() || !formData.defaultChatId?.trim()) {
      showToast("Vui lòng nhập đầy đủ Bot Token và Chat ID trước khi test!", "warning");
      return;
    }
    setIsTestingPing(true);
    const res = await TelegramService.testConnection(formData.botToken, formData.defaultChatId);
    setIsTestingPing(false);
    if (res.success) {
      showToast("🚀 Đã gửi tin nhắn kiểm tra thành công vào Telegram!", "success");
    } else {
      showToast(`❌ Lỗi gửi tin: ${res.error}`, "error");
    }
  };

  const handleInsertTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      messageTemplate: (prev.messageTemplate || "") + " " + tag,
    }));
    showToast(`Đã chèn thẻ ${tag}`, "info");
  };

  const handleResetTemplate = () => {
    setFormData(prev => ({
      ...prev,
      messageTemplate: `📦 <b>BẢNG KÊ ĐỐI SOÁT COD & CƯỚC PHÍ</b>
━━━━━━━━━━━━━━━━━━━━
🏢 <b>Khách hàng:</b> {TEN_SHOP} ({MA_SHOP})
📅 <b>Kỳ đối soát:</b> {KY_DOI_SOAT}
📊 <b>Tổng đơn:</b> {TONG_DON} đơn (Giao TC: {DON_THANH_CONG} | Hoàn: {DON_HOAN})

💰 <b>Tổng COD thu hộ:</b> +{TONG_COD} đ
🚚 <b>Tổng cước dịch vụ:</b> -{TONG_CUOC} đ
📌 <b>Phí phụ thu / khác:</b> -{PHI_KHAC} đ
🔄 <b>Nợ cũ dồn sang:</b> {CONG_NO_DAU_KY} đ
━━━━━━━━━━━━━━━━━━━━
💵 <b>THỰC CHUYỂN CHO SHOP:</b> <b><u>{THUC_TRA} đ</u></b>
━━━━━━━━━━━━━━━━━━━━
🏦 <b>Thông tin thanh toán:</b>
• Ngân hàng: {NGAN_HANG}
• STK: <code>{SO_TAI_KHOAN}</code>
• Chủ TK: {CHU_TAI_KHOAN}

<i>Cảm ơn Quý khách đã tin tưởng và đồng hành cùng dịch vụ!</i>`,
    }));
    showToast("Đã khôi phục mẫu tin nhắn mặc định!", "info");
  };

  const handleSave = () => {
    onSave(formData);
    showToast("Đã lưu cấu hình Telegram Bot thành công!", "success");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: 740, maxHeight: "90vh", overflowY: "auto", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, rgba(0, 136, 204, 0.12) 0%, rgba(34, 158, 217, 0.08) 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "#0088cc",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0, 136, 204, 0.3)",
            }}>
              <Send size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text-main)" }}>
                Cấu Hình Telegram Bot Đối Soát
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Tự động gửi bảng kê COD, cước phí và file Excel vào nhóm/kênh Telegram
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={onClose}
            style={{ padding: "6px 8px" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-color)",
          background: "var(--bg-tertiary)",
          padding: "0 16px",
        }}>
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            style={{
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "config" ? "2px solid #0088cc" : "2px solid transparent",
              color: activeTab === "config" ? "#0088cc" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Key size={16} />
            <span>1. Cấu Hình Bot & Chat ID</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("template")}
            style={{
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "template" ? "2px solid #0088cc" : "2px solid transparent",
              color: activeTab === "template" ? "#0088cc" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Bot size={16} />
            <span>2. Mẫu Tin Nhắn (Template)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            style={{
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "guide" ? "2px solid #0088cc" : "2px solid transparent",
              color: activeTab === "guide" ? "#0088cc" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <HelpCircle size={16} />
            <span>3. Hướng Dẫn Tạo Bot (3 Bước)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {activeTab === "config" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Test Mode Switcher */}
              <div style={{
                background: formData.isSandbox ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)",
                border: `1px solid ${formData.isSandbox ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {formData.isSandbox ? <ShieldCheck size={24} color="#f59e0b" /> : <Zap size={24} color="#10b981" />}
                  <div>
                    <strong style={{ fontSize: 13.5, color: formData.isSandbox ? "#b45309" : "#047857" }}>
                      {formData.isSandbox ? "Chế độ Demo / Thử Nghiệm (Sandbox)" : "Chế độ Hoạt Động Thật (Production)"}
                    </strong>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {formData.isSandbox 
                        ? "Giả lập gửi tin nhắn thành công để bạn kiểm tra giao diện và tính toán số liệu mà không cần kết nối Bot thật."
                        : "Tin nhắn sẽ được Bot gửi trực tiếp vào nhóm hoặc chat cá nhân của khách hàng qua Telegram API."}
                    </div>
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={!formData.isSandbox}
                    onChange={(e) => setFormData(prev => ({ ...prev, isSandbox: !e.target.checked }))}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Bot Token Input */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                    Telegram Bot Token (HTTP API):
                  </label>
                  <a 
                    href="https://t.me/BotFather" 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ fontSize: 11.5, color: "#0088cc", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", fontWeight: 600 }}
                  >
                    <span>Lấy Token từ @BotFather</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    className="input-field mono"
                    placeholder="Ví dụ: 7123456789:AAFlM09xyzAbcDeFgHiJkLmNoPqRsTuVwX"
                    value={formData.botToken || ""}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, botToken: e.target.value }));
                      setBotInfo(null);
                    }}
                    style={{ flex: 1, fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    onClick={handleCheckBot}
                    disabled={isCheckingBot}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "8px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {isCheckingBot ? <span className="spinner-border spinner-border-sm" /> : <Sparkles size={14} color="#0088cc" />}
                    <span>Kiểm Tra Bot</span>
                  </button>
                </div>

                {botInfo && (
                  <div style={{ marginTop: 8, padding: "6px 12px", background: "#e0f2fe", borderRadius: 6, fontSize: 12, color: "#0369a1", display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={14} color="#0284c7" />
                    <span>Bot đang kết nối: <strong>{botInfo.botName}</strong> (@{botInfo.username})</span>
                  </div>
                )}
              </div>

              {/* Default Chat ID */}
              <div>
                <label className="input-label" style={{ marginBottom: 6, fontWeight: 700 }}>
                  Chat ID Mặc Định (ID Nhóm / Kênh / Cá Nhân):
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="input-field mono"
                    placeholder="Ví dụ: -1001234567890 (ID nhóm) hoặc 123456789 (ID cá nhân)"
                    value={formData.defaultChatId || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultChatId: e.target.value }))}
                    style={{ flex: 1, fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    onClick={handleTestPing}
                    disabled={isTestingPing}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "8px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {isTestingPing ? <span className="spinner-border spinner-border-sm" /> : <Send size={14} color="#0088cc" />}
                    <span>Gửi Thử Tin Nhắn</span>
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                  💡 <i>Nếu Shop có Chat ID riêng trong phần Danh mục Shop thì hệ thống sẽ gửi vào chat riêng của Shop đó; nếu chưa có sẽ gửi vào Chat ID mặc định này.</i>
                </div>
              </div>

              {/* Auto Attach Excel Option */}
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileSpreadsheet size={20} color="#16a34a" />
                  <div>
                    <strong style={{ fontSize: 13 }}>Tự Động Đính Kèm File Excel Đối Soát (.xlsx)</strong>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      Khi gửi tin nhắn Telegram, tự động đính kèm file Excel chi tiết danh sách đơn của Shop đó.
                    </div>
                  </div>
                </div>
                <label className="toggle-switch" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={formData.autoAttachExcel !== false}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoAttachExcel: e.target.checked }))}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          )}

          {activeTab === "template" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-main)" }}>
                  Soạn Thảo Mẫu Tin Nhắn (Định dạng HTML Telegram):
                </span>
                <button
                  type="button"
                  onClick={handleResetTemplate}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "4px 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}
                >
                  <RotateCcw size={12} />
                  <span>Khôi phục mặc định</span>
                </button>
              </div>

              {/* Tag Chips for fast insertion */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  { tag: "{TEN_SHOP}", label: "Tên Shop" },
                  { tag: "{MA_SHOP}", label: "Mã Shop" },
                  { tag: "{KY_DOI_SOAT}", label: "Tên Kỳ" },
                  { tag: "{TONG_DON}", label: "Tổng Đơn" },
                  { tag: "{DON_THANH_CONG}", label: "Đơn Giao TC" },
                  { tag: "{DON_HOAN}", label: "Đơn Hoàn" },
                  { tag: "{TONG_COD}", label: "Tổng COD" },
                  { tag: "{TONG_CUOC}", label: "Cước Dịch Vụ" },
                  { tag: "{PHI_KHAC}", label: "Phí Khác" },
                  { tag: "{CONG_NO_DAU_KY}", label: "Nợ Cũ Dồn Sang" },
                  { tag: "{THUC_TRA}", label: "Thực Chuyển" },
                  { tag: "{NGAN_HANG}", label: "Ngân Hàng" },
                  { tag: "{SO_TAI_KHOAN}", label: "Số Tài Khoản" },
                  { tag: "{CHU_TAI_KHOAN}", label: "Chủ Tài Khoản" },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0f172a",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title={`Chèn mã ${item.tag}`}
                  >
                    <span>+ {item.label}</span>
                    <code style={{ fontSize: 10, color: "#0088cc" }}>{item.tag}</code>
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                className="input-field mono"
                rows={12}
                value={formData.messageTemplate || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, messageTemplate: e.target.value }))}
                style={{ fontSize: 12.5, lineHeight: 1.6, padding: 12 }}
              />

              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                💡 <i>Hỗ trợ các thẻ HTML cơ bản: <code>&lt;b&gt;In đậm&lt;/b&gt;</code>, <code>&lt;i&gt;In nghiêng&lt;/i&gt;</code>, <code>&lt;code&gt;Chữ code&lt;/code&gt;</code>, <code>&lt;u&gt;Gạch chân&lt;/u&gt;</code></i>
              </div>
            </div>
          )}

          {activeTab === "guide" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Step 1 */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#0088cc", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} />
                  Bước 1: Tạo Bot Telegram trên @BotFather
                </h4>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-main)" }}>
                  <li>Mở ứng dụng Telegram, tìm kiếm <strong>@BotFather</strong> (có tích xanh).</li>
                  <li>Gửi lệnh <code>/newbot</code>.</li>
                  <li>Nhập Tên Bot (Ví dụ: <i>Đức Tín Đối Soát Bot</i>) và Username kết thúc bằng <code>bot</code> (Ví dụ: <i>ductin_doisoat_bot</i>).</li>
                  <li>BotFather sẽ trả về <strong>HTTP API Token</strong> (dạng <code>123456789:ABC...</code>). Copy dán vào ô <strong>Bot Token</strong> ở tab 1.</li>
                </ol>
              </div>

              {/* Step 2 */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#0088cc", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} />
                  Bước 2: Thêm Bot vào Nhóm / Kênh thông báo
                </h4>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-main)" }}>
                  <li>Tạo một Nhóm Telegram (hoặc sử dụng Nhóm trao đổi hiện tại với khách hàng).</li>
                  <li>Thêm Bot vừa tạo vào Nhóm và cấp quyền <strong>Admin</strong> (gửi tin nhắn & gửi tài liệu).</li>
                </ol>
              </div>

              {/* Step 3 */}
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#0088cc", display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} />
                  Bước 3: Lấy Chat ID của Nhóm / Cá nhân
                </h4>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-main)" }}>
                  <li>Thêm bot <strong>@userinfobot</strong> hoặc <strong>@getmyid_bot</strong> vào nhóm để xem ID nhóm (thường có dấu trừ ở đầu, ví dụ: <code>-1001234567890</code>).</li>
                  <li>Hoặc nếu gửi cho cá nhân, gửi tin nhắn bất kỳ cho <strong>@userinfobot</strong> để lấy ID cá nhân của bạn.</li>
                  <li>Dán Chat ID vào ô <strong>Chat ID Mặc Định</strong> rồi bấm nút <strong>Gửi Thử Tin Nhắn</strong> để kiểm tra kết nối.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border-color)",
          background: "var(--bg-tertiary)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy Bỏ
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSave}
            style={{ background: "#0088cc", borderColor: "#0088cc", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Save size={16} />
            <span>Lưu Cấu Hình Telegram</span>
          </button>
        </div>
      </div>
    </div>
  );
};
