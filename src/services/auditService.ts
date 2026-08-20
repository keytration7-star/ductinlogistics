import { getAuthHeaders } from './authService';

export interface SystemAuditRecord {
  id: string;
  timestamp: string;
  username: string;
  userRole: string;
  action: string;
  details: string;
  ip?: string;
}

export const AuditService = {
  getLogs(): SystemAuditRecord[] {
    const data = localStorage.getItem('gomdon_audit_logs_v1');
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  logAction(username: string, userRole: string, action: string, details: string): void {
    const record: SystemAuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      username: username || 'Admin',
      userRole: userRole || 'ADMIN',
      action,
      details,
    };

    const currentLogs = this.getLogs();
    currentLogs.unshift(record);
    const trimmedLogs = currentLogs.slice(0, 500);
    localStorage.setItem('gomdon_audit_logs_v1', JSON.stringify(trimmedLogs));

    try {
      fetch('/api/db/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ logs: trimmedLogs }),
      }).catch(() => {});
    } catch {}
  }
};
