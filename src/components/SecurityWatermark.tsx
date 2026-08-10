import React from 'react';
import type { UserAccount } from '../types';
import { StorageService } from '../services/storage';

interface SecurityWatermarkProps {
  currentUser: UserAccount | null;
}

export const SecurityWatermark: React.FC<SecurityWatermarkProps> = ({ currentUser }) => {
  if (!currentUser) return null;

  const company = StorageService.getCompanyInfo();
  const brandName = (company?.companyName || 'LOGISTICS SYSTEM').toUpperCase();

  // Generate repeating watermark text dynamically from company config
  const watermarkText = `${brandName} SECURITY • ${currentUser.fullName} (${currentUser.username}) • ${currentUser.role} • ${new Date().toLocaleDateString('vi-VN')}`;

  // Create a grid of 12 repeating watermark lines
  const rows = Array.from({ length: 8 });
  const cols = Array.from({ length: 4 });

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        opacity: currentUser.role === 'ADMIN' ? 0.04 : 0.085, // Subtle for Admin, noticeable deterrent for Staff
      }}
    >
      {rows.map((_, rIdx) => (
        <div
          key={rIdx}
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            transform: 'rotate(-22deg) scale(1.1)',
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '2px',
            color: 'var(--text-main)',
            textShadow: '0 0 1px rgba(0,0,0,0.2)',
          }}
        >
          {cols.map((_, cIdx) => (
            <span key={cIdx} style={{ margin: '0 40px' }}>
              {watermarkText}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
