import type { ReconciliationSession } from '../types';

/**
 * Smart Date Range Calculator for Reconciliation Periods
 * Automatically calculates the period range based on previous session end date or uploaded file dates.
 * Example: If last session ended on Friday 08/08/2026, next period automatically starts on 09/08/2026.
 */
export function generateSmartSessionName(
  carrierName: string,
  existingSessions: ReconciliationSession[],
  fileRows?: Record<string, any>[]
): string {
  const carrierClean = (carrierName || 'Hãng Vận Chuyển').trim();
  const now = new Date();
  
  let startDate: Date | null = null;
  let endDate: Date = now;

  // 1. Try extracting min/max dates from uploaded file rows if present
  if (fileRows && fileRows.length > 0) {
    const extractedDates: Date[] = [];
    
    fileRows.forEach(row => {
      const dateVal = row['Ngày gửi'] || row['Ngày'] || row['NGAY_GUI'] || row['date'] || row['Ngày phát sinh'] || row['Ngày tạo'] || row['Ngày chốt'];
      if (dateVal) {
        let parsed: Date | null = null;
        if (dateVal instanceof Date) {
          parsed = dateVal;
        } else if (typeof dateVal === 'string') {
          // Try DD/MM/YYYY or YYYY-MM-DD
          const parts = dateVal.trim().split(/[\sT]+/)[0].split(/[/.-]/);
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (parts[2].length === 4) {
              parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
          }
        } else if (typeof dateVal === 'number') {
          // Excel serial date format
          parsed = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        }

        if (parsed && !isNaN(parsed.getTime())) {
          extractedDates.push(parsed);
        }
      }
    });

    if (extractedDates.length > 0) {
      extractedDates.sort((a, b) => a.getTime() - b.getTime());
      startDate = extractedDates[0];
      endDate = extractedDates[extractedDates.length - 1];
    }
  }

  // 2. If no valid file dates, look at the last session for this carrier in database
  if (!startDate && existingSessions && existingSessions.length > 0) {
    const carrierSessions = existingSessions.filter(
      s => (s.carrierName && s.carrierName.toLowerCase().trim() === carrierClean.toLowerCase()) ||
           (s.carrierId && s.carrierId.toLowerCase().trim() === carrierClean.toLowerCase())
    );

    if (carrierSessions.length > 0) {
      const sorted = [...carrierSessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastSession = sorted[0];
      const lastDate = new Date(lastSession.createdAt);

      if (!isNaN(lastDate.getTime())) {
        // Start date = day immediately following the last session (+1 day)
        const nextDay = new Date(lastDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        // Only use if nextDay <= now
        if (nextDay.getTime() <= now.getTime()) {
          startDate = nextDay;
        }
      }
    }
  }

  // 3. Fallback: Start date = 7 days ago
  if (!startDate) {
    const fallbackStart = new Date(now);
    fallbackStart.setDate(fallbackStart.getDate() - 6);
    startDate = fallbackStart;
  }

  // Format dates: DD/MM and DD/MM/YYYY
  const pad = (n: number) => String(n).padStart(2, '0');

  const startDay = pad(startDate.getDate());
  const startMonth = pad(startDate.getMonth() + 1);
  
  const endDay = pad(endDate.getDate());
  const endMonth = pad(endDate.getMonth() + 1);
  const endYear = endDate.getFullYear();

  if (startDay === endDay && startMonth === endMonth) {
    return `Đối Soát ${carrierClean} (${endDay}/${endMonth}/${endYear})`;
  }

  return `Đối Soát ${carrierClean} (${startDay}/${startMonth} - ${endDay}/${endMonth}/${endYear})`;
}
