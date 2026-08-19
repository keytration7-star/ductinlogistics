import React, { useState } from 'react';
import { useToast, useConfirm } from './UIFeedback';
import { 
  ShieldCheck, 
  UploadCloud, 
  FileSpreadsheet, 
  Search, 
  Zap, 
  AlertTriangle, 
  Layers, 
  Building2, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import type { ReconciliationSession, Shop, UserAccount } from '../types';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excelService';

interface DataAuditViewProps {
  sessions: ReconciliationSession[];
  shops: Shop[];
  currentUser: UserAccount;
  onRefreshSessions?: () => void;
  onNavigateToPayout?: () => void;
}

export interface AuditOrderItem {
  id: string;
  trackingCode: string;
  carrierName: string;
  fileName: string;
  periodName: string;
  shopCode: string;
  shopName: string;
  cod: number;
  nvcFee: number;
  shopFee: number;
  netPayout: number;
  statusBucket: 'VALID' | 'MISSING' | 'DUPLICATE' | 'NEW_SHOP';
  statusReason: string;
  existingSessionName?: string;
}

export const DataAuditView: React.FC<DataAuditViewProps> = ({
  sessions,
  shops,
  currentUser: _currentUser,
  onRefreshSessions,
  onNavigateToPayout,
}) => {
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();

  const [isProcessing, setIsProcessing] = useState(false);
  const [auditFiles, setAuditFiles] = useState<{ name: string; size: number; orderCount: number }[]>([]);
  const [auditOrders, setAuditOrders] = useState<AuditOrderItem[]>([]);
  const [activeBucketFilter, setActiveBucketFilter] = useState<'ALL' | 'MISSING' | 'DUPLICATE' | 'NEW_SHOP' | 'VALID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper format currency
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

  // Process Batch File Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    showToast(`Đang phân tích & rà soát dữ liệu từ ${files.length} file Excel...`, 'info');

    try {
      const fileList: { name: string; size: number; orderCount: number }[] = [];
      const extractedOrders: AuditOrderItem[] = [];
      const seenTrackingCodes = new Set<string>();

      // Build lookup maps from saved sessions
      const savedOrdersMap = new Map<string, string>(); // trackingCode -> sessionName
      sessions.forEach(sess => {
        sess.statements.forEach(stmt => {
          if (stmt.orders) {
            stmt.orders.forEach(ord => {
              if (ord.waybill) {
                savedOrdersMap.set(ord.waybill.trim().toUpperCase(), sess.sessionName);
              }
            });
          }
        });
      });

      const shopCodeMap = new Map<string, Shop>();
      shops.forEach(s => {
        if (s.code) shopCodeMap.set(s.code.trim().toUpperCase(), s);
        if (s.name) shopCodeMap.set(s.name.trim().toLowerCase(), s);
      });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { rows } = await ExcelService.parseExcelFile(file);

        let fileOrderCount = 0;

        rows.forEach((row: Record<string, any>, idx: number) => {
          // Try extracting tracking code
          const trackingCode = String(
            row['Mã vận đơn'] || row['MÃ VẬN ĐƠN'] || row['Ma_Van_Don'] || row['tracking_code'] || row['MaBD'] || row['Mã Đơn'] || ''
          ).trim().toUpperCase();

          if (!trackingCode || trackingCode.length < 5) return;

          fileOrderCount++;

          const shopCodeRaw = String(row['Mã Shop'] || row['Mã shop'] || row['MA_SHOP'] || row['Shop'] || '').trim();
          const shopNameRaw = String(row['Tên Shop'] || row['Tên shop'] || row['TEN_SHOP'] || row['Shop Name'] || 'Shop ' + shopCodeRaw).trim();
          const codRaw = parseFloat(String(row['Tiền COD'] || row['COD'] || row['Thu hộ'] || 0).replace(/[^0-9.]/g, '')) || 0;
          const feeRaw = parseFloat(String(row['Cước'] || row['Tổng Cước'] || row['Cước Shop'] || 0).replace(/[^0-9.]/g, '')) || 0;
          const netPayout = codRaw - feeRaw;

          const matchedShop = shopCodeMap.get(shopCodeRaw.toUpperCase()) || shopCodeMap.get(shopNameRaw.toLowerCase());
          const existingSession = savedOrdersMap.get(trackingCode);

          let bucket: 'VALID' | 'MISSING' | 'DUPLICATE' | 'NEW_SHOP' = 'MISSING';
          let reason = 'Đơn hàng mới chưa được đối soát & chưa đi tiền';

          if (seenTrackingCodes.has(trackingCode)) {
            bucket = 'DUPLICATE';
            reason = `Đơn trùng lặp xuất hiện nhiều lần trong các file vừa tải`;
          } else if (existingSession) {
            bucket = 'VALID';
            reason = `Đã đối soát hợp lệ ở kỳ "${existingSession}"`;
          } else if (!matchedShop) {
            bucket = 'NEW_SHOP';
            reason = `Shop "${shopNameRaw}" chưa có trong danh sách Quản lý Shop`;
          }

          seenTrackingCodes.add(trackingCode);

          extractedOrders.push({
            id: `audit_${i}_${idx}_${Date.now()}`,
            trackingCode,
            carrierName: file.name.toUpperCase().includes('GHN') ? 'GHN' : file.name.toUpperCase().includes('J&T') ? 'J&T Express' : 'NVC',
            fileName: file.name,
            periodName: file.name.replace(/\.[^/.]+$/, ''),
            shopCode: matchedShop ? matchedShop.code : (shopCodeRaw || 'SHOP_NEW'),
            shopName: matchedShop ? matchedShop.name : shopNameRaw,
            cod: codRaw,
            nvcFee: feeRaw,
            shopFee: feeRaw,
            netPayout,
            statusBucket: bucket,
            statusReason: reason,
            existingSessionName: existingSession,
          });
        });

        fileList.push({
          name: file.name,
          size: file.size,
          orderCount: fileOrderCount,
        });
      }

      setAuditFiles(fileList);
      setAuditOrders(extractedOrders);
      showToast(`Đã hoàn tất rà soát ${extractedOrders.length} đơn từ ${fileList.length} file Excel!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi khi phân tích file Excel: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute Bucket Statistics
  const missingOrders = auditOrders.filter(o => o.statusBucket === 'MISSING');
  const duplicateOrders = auditOrders.filter(o => o.statusBucket === 'DUPLICATE');
  const newShopOrders = auditOrders.filter(o => o.statusBucket === 'NEW_SHOP');
  const validOrders = auditOrders.filter(o => o.statusBucket === 'VALID');

  const totalMissingNetPayout = missingOrders.reduce((sum, o) => sum + o.netPayout, 0);

  // Auto Create Supplementary Session for Missing Orders
  const handleCreateSupplementarySession = async () => {
    if (missingOrders.length === 0) {
      showToast('Không có đơn hàng bị sót nào để lập Kỳ Đối Soát Bù.', 'info');
      return;
    }

    const sessionNameDefault = `Kỳ Đối Soát Bù (${new Date().toLocaleDateString('vi-VN')}) - ${missingOrders.length} đơn sót`;

    const ok = await showConfirm({
      title: `Tạo Kỳ Đối Soát Bù (${missingOrders.length} Đơn Sót)`,
      message: `Hệ thống sẽ gom ${missingOrders.length} đơn bị sót thành 1 Kỳ Đối Soát Bù mới với tổng tiền thực trả ${formatVND(totalMissingNetPayout)}. Bạn có muốn tiếp tục?`,
      confirmText: 'Tạo Kỳ Đối Soát Bù',
    });

    if (!ok) return;

    // Group missing orders by shop
    const shopStatementsMap = new Map<string, any>();

    missingOrders.forEach(ord => {
      const existing = shopStatementsMap.get(ord.shopCode) || {
        shopId: ord.shopCode,
        shopCode: ord.shopCode,
        shopName: ord.shopName,
        totalCod: 0,
        totalShopFee: 0,
        totalShopOtherFee: 0,
        totalNetPayout: 0,
        ordersCount: 0,
        orders: [],
      };

      existing.totalCod += ord.cod;
      existing.totalShopFee += ord.shopFee;
      existing.totalNetPayout += ord.netPayout;
      existing.ordersCount += 1;

      shopStatementsMap.get(ord.shopCode)
        ? null
        : shopStatementsMap.set(ord.shopCode, existing);
    });

    const statements = Array.from(shopStatementsMap.values());

    const newSession: ReconciliationSession = {
      id: `sess_bu_${Date.now()}`,
      sessionName: sessionNameDefault,
      carrierId: 'ALL',
      carrierName: missingOrders[0]?.carrierName || 'Tất Cả Hãng',
      createdAt: new Date().toISOString(),
      nvcFileName: 'Multi-Period Audit',
      totalOrders: missingOrders.length,
      matchedOrdersCount: missingOrders.length,
      unmatchedOrdersCount: 0,
      totalCod: missingOrders.reduce((sum, o) => sum + o.cod, 0),
      totalNvcCost: missingOrders.reduce((sum, o) => sum + o.nvcFee, 0),
      totalShopRevenue: missingOrders.reduce((sum, o) => sum + o.shopFee, 0),
      totalNetPayout: totalMissingNetPayout,
      totalProfit: 0,
      statements,
      unmatchedOrders: [],
      payoutStatus: 'UNPAID',
    };

    StorageService.saveSession(newSession);
    showToast(`Đã tạo thành công ${sessionNameDefault}!`, 'success');

    if (onRefreshSessions) onRefreshSessions();
    if (onNavigateToPayout) onNavigateToPayout();
  };

  // Filter orders by active bucket & search query
  const filteredOrders = auditOrders.filter(ord => {
    if (activeBucketFilter !== 'ALL' && ord.statusBucket !== activeBucketFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ord.trackingCode.toLowerCase().includes(q) ||
      ord.shopName.toLowerCase().includes(q) ||
      ord.shopCode.toLowerCase().includes(q) ||
      ord.fileName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header Title */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={26} color="var(--primary)" />
            Rà Soát Dữ Liệu & Kiểm Thử Đối Soát Đa Kỳ
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Kéo thả hàng loạt file Excel đối soát của nhiều kỳ để tự động phát hiện đơn sót, đơn trùng lặp và khớp nối thông tin khách hàng.
          </p>
        </div>

        {auditOrders.length > 0 && (
          <button
            onClick={handleCreateSupplementarySession}
            className="btn btn-primary"
            style={{ fontSize: 13, fontWeight: 800, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Zap size={16} />
            <span>Tạo Kỳ Đối Soát Bù ({missingOrders.length} Đơn Sót)</span>
          </button>
        )}
      </div>

      {/* Batch File Drag & Drop Upload Dropzone */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '32px 24px', 
          textAlign: 'center', 
          border: '2px dashed var(--primary)', 
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.03) 0%, rgba(79, 70, 229, 0.08) 100%)',
          cursor: 'pointer',
        }}
      >
        <input 
          type="file" 
          multiple 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
          id="batch-file-input" 
        />
        <label htmlFor="batch-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)',
          }}>
            <UploadCloud size={28} />
          </div>

          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>
              Kéo & Thả Hàng Loạt File Excel Của Các Kỳ Vào Đây
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Hỗ trợ chọn cùng lúc nhiều file Excel (.xlsx, .csv) từ nhà vận chuyển GHN, J&T, ViettelPost, SPX,...
            </div>
          </div>

          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 700, fontSize: 13, marginTop: 8 }}>
              <RefreshCw className="spin" size={16} />
              <span>Đang giải mã và rà soát đối chiếu dữ liệu...</span>
            </div>
          )}
        </label>
      </div>

      {/* Uploaded Files Summary Pills */}
      {auditFiles.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {auditFiles.map((f, i) => (
            <div key={i} className="glass-panel" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 'var(--radius-md)' }}>
              <FileSpreadsheet size={14} color="var(--success)" />
              <strong>{f.name}</strong>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>{f.orderCount} đơn</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Overview Metric Bar */}
      {auditOrders.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {/* Stat 1: Total Orders */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng Đơn Rà Soát</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{auditOrders.length} đơn</div>
            </div>
          </div>

          {/* Stat 2: Missing Orders */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '4px solid var(--danger)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>Đơn Bị Sót / Khuyết</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)' }}>{missingOrders.length} đơn</div>
              <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>Thiếu: {formatVND(totalMissingNetPayout)}</div>
            </div>
          </div>

          {/* Stat 3: Duplicate Orders */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>Đơn Trùng Lập</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--warning)' }}>{duplicateOrders.length} đơn</div>
            </div>
          </div>

          {/* Stat 4: Unregistered Shops */}
          <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(14, 165, 233, 0.12)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--info)', textTransform: 'uppercase' }}>Shop Chưa Đăng Ký</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--info)' }}>{newShopOrders.length} đơn</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Filter Tabs & Audit Results Table */}
      {auditOrders.length > 0 && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveBucketFilter('ALL')}
                className={`btn btn-sm ${activeBucketFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                Tất Cả ({auditOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('MISSING')}
                className={`btn btn-sm ${activeBucketFilter === 'MISSING' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🔴 Đơn Bị Sót ({missingOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('DUPLICATE')}
                className={`btn btn-sm ${activeBucketFilter === 'DUPLICATE' ? 'btn-warning' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🟡 Đơn Trùng ({duplicateOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('NEW_SHOP')}
                className={`btn btn-sm ${activeBucketFilter === 'NEW_SHOP' ? 'btn-info' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🟠 Shop Mới ({newShopOrders.length})
              </button>

              <button
                onClick={() => setActiveBucketFilter('VALID')}
                className={`btn btn-sm ${activeBucketFilter === 'VALID' ? 'btn-success' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                🟢 Hợp Lệ ({validOrders.length})
              </button>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: 240 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Tìm mã vận đơn, shop, file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px 6px 30px', fontSize: 12 }}
              />
            </div>
          </div>

          {/* Bounded Scrollable Table */}
          <div style={{
            maxHeight: 520,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            position: 'relative',
          }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th>Mã Vận Đơn</th>
                  <th>Hãng / File Nguồn</th>
                  <th>Tên Shop</th>
                  <th style={{ textAlign: 'right' }}>Tiền COD</th>
                  <th style={{ textAlign: 'right' }}>Cước Shop</th>
                  <th style={{ textAlign: 'right' }}>Thực Chuyển</th>
                  <th style={{ textAlign: 'center' }}>Kết Quả Rà Soát</th>
                  <th>Đánh Giá & Cảnh Báo Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(ord => (
                    <tr key={ord.id}>
                      <td><strong className="mono" style={{ color: 'var(--primary)', fontSize: 13 }}>{ord.trackingCode}</strong></td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: 9 }}>{ord.carrierName}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{ord.fileName}</div>
                      </td>
                      <td>
                        <strong>{ord.shopName}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{ord.shopCode}</div>
                      </td>
                      <td className="mono" style={{ color: 'var(--info)', textAlign: 'right' }}>{formatVND(ord.cod)}</td>
                      <td className="mono" style={{ color: '#92400e', textAlign: 'right' }}>-{formatVND(ord.shopFee)}</td>
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--primary)', textAlign: 'right' }}>{formatVND(ord.netPayout)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {ord.statusBucket === 'VALID' && <span className="badge badge-success" style={{ fontSize: 10 }}>🟢 Hợp Lệ</span>}
                        {ord.statusBucket === 'MISSING' && <span className="badge badge-danger" style={{ fontSize: 10 }}>🔴 Sót / Khuyết</span>}
                        {ord.statusBucket === 'DUPLICATE' && <span className="badge badge-warning" style={{ fontSize: 10 }}>🟡 Trùng Lập</span>}
                        {ord.statusBucket === 'NEW_SHOP' && <span className="badge badge-info" style={{ fontSize: 10 }}>🟠 Shop Mới</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ color: ord.statusBucket === 'MISSING' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: ord.statusBucket === 'MISSING' ? 700 : 400 }}>
                          {ord.statusReason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
