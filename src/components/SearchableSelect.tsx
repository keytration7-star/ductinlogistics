import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  badge?: string;
  badgeType?: 'both' | 'nvc' | 'app' | 'default';
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Chọn hoặc gõ tìm kiếm từ khóa cột --',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  // Filter options based on query (supports Vietnamese search)
  const filteredOptions = options.filter(o => {
    if (!searchQuery.trim()) return true;
    const normQuery = removeVietnameseTones(searchQuery.trim());
    const normLabel = removeVietnameseTones(o.label);
    const normValue = removeVietnameseTones(o.value);
    const normBadge = removeVietnameseTones(o.badge || '');
    return normLabel.includes(normQuery) || normValue.includes(normQuery) || normBadge.includes(normQuery);
  });

  const getBadgeStyle = (type?: string) => {
    switch (type) {
      case 'both':
        return { background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.3)' };
      case 'nvc':
        return { background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'app':
        return { background: 'rgba(16, 185, 129, 0.12)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.3)' };
      default:
        return { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' };
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Control Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'var(--bg-primary)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen ? '0 0 0 2px rgba(79, 70, 229, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          minHeight: 34,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
          <Search size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
          {selectedOption ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              {selectedOption.badge && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  ...getBadgeStyle(selectedOption.badgeType),
                }}>
                  {selectedOption.badge}
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedOption.label}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {placeholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchQuery('');
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 2,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Xóa lựa chọn"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>

      {/* Floating Searchable Dropdown Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 6,
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Real-time Search Input Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} color="var(--primary)" style={{ position: 'absolute', left: 8 }} />
            <input
              type="text"
              autoFocus
              placeholder="🔍 Gõ từ khóa để tìm (vd: SĐT, cước, COD, ngày...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="input-field"
              style={{
                paddingLeft: 28,
                paddingRight: searchQuery ? 24 : 8,
                paddingTop: 5,
                paddingBottom: 5,
                fontSize: 12,
                borderRadius: 4,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--text-muted)',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Items List */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>DANH SÁCH CỘT ({filteredOptions.length}/{options.length})</span>
              {searchQuery && <span>Kết quả lọc: "{searchQuery}"</span>}
            </div>

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                🚫 Không tìm thấy cột nào khớp với từ khóa <strong>"{searchQuery}"</strong>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 12,
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      {opt.badge && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          whiteSpace: 'nowrap',
                          ...getBadgeStyle(opt.badgeType),
                        }}>
                          {opt.badge}
                        </span>
                      )}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.label}
                      </span>
                    </div>

                    {isSelected && <Check size={14} color="var(--primary)" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
