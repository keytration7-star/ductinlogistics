import type { AuditLogEntry, AuditLogCategory } from '../types';
import { getAuthHeaders } from './authService';

export const AuditService = {
  getLogsSync(): AuditLogEntry[] {
    const raw = localStorage.getItem('gomdon_audit_logs_cache');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async getLogs(params?: { category?: AuditLogCategory | 'ALL'; search?: string; limit?: number }): Promise<AuditLogEntry[]> {
    try {
      const query = new URLSearchParams();
      if (params?.category && params.category !== 'ALL') query.set('category', params.category);
      if (params?.search) query.set('search', params.search);
      if (params?.limit) query.set('limit', String(params.limit));

      const res = await fetch(`/api/audit-logs?${query.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const logs = data.success && Array.isArray(data.logs) ? data.logs : [];
        localStorage.setItem('gomdon_audit_logs_cache', JSON.stringify(logs));
        return logs;
      }
    } catch (err) {
      console.warn('[AuditService.getLogs Error]:', err);
    }
    return this.getLogsSync();
  },

  async logAction(
    entryOrActor: string | { action: string; category: AuditLogCategory; description: string; metadata?: Record<string, any> },
    roleOrCategory?: string,
    actionName?: string,
    details?: string
  ): Promise<boolean> {
    try {
      let bodyData: any = {};
      if (typeof entryOrActor === 'object' && entryOrActor !== null) {
        bodyData = entryOrActor;
      } else {
        bodyData = {
          action: actionName || 'UNKNOWN_ACTION',
          category: (roleOrCategory as any) || 'OPERATIONS',
          description: details || '',
        };
      }

      const res = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(bodyData),
      });
      return res.ok;
    } catch (err) {
      console.warn('[AuditService.logAction Error]:', err);
      return false;
    }
  },
};
