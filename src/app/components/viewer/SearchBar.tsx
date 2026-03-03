import React, { useRef, useEffect, useCallback } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  totalMatches: number;
  currentMatchIdx: number;
  nextMatch: () => void;
  prevMatch: () => void;
  onClose: () => void;
}

export function SearchBar({
  query,
  setQuery,
  totalMatches,
  currentMatchIdx,
  nextMatch,
  prevMatch,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          prevMatch();
        } else {
          nextMatch();
        }
      }
    },
    [onClose, nextMatch, prevMatch]
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px 6px 12px',
        background: '#ffffff',
        borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document..."
        style={{
          width: 180,
          fontSize: '0.8125rem',
          color: '#171717',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
        }}
      />

      {query.length >= 2 && (
        <span
          style={{
            fontSize: '0.6875rem',
            color: '#a3a3a3',
            whiteSpace: 'nowrap',
            fontWeight: 500,
          }}
        >
          {totalMatches === 0
            ? 'No results'
            : `${currentMatchIdx + 1} of ${totalMatches}`}
        </span>
      )}

      <div className="flex items-center">
        <NavButton icon={<ChevronUp size={14} />} onClick={prevMatch} disabled={totalMatches === 0} />
        <NavButton icon={<ChevronDown size={14} />} onClick={nextMatch} disabled={totalMatches === 0} />
      </div>

      <NavButton icon={<X size={14} />} onClick={onClose} />
    </div>
  );
}

function NavButton({
  icon,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer flex items-center justify-center transition-colors duration-100"
      style={{
        width: 24,
        height: 24,
        borderRadius: 5,
        border: 'none',
        background: 'transparent',
        color: disabled ? '#d4d4d4' : '#737373',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}