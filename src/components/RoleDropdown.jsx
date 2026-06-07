import { useState, useRef, useEffect } from 'react';

const ROLES = [
  { value: 'admin',   label: 'Admin',   color: '#a5b4fc' },
  { value: 'general', label: 'General', color: '#67e8f9' },
];

/**
 * Custom role dropdown with styled options panel.
 * Replaces native <select> to allow full CSS control.
 */
export default function RoleDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = ROLES.find((r) => r.value === value) || ROLES[1];

  const handleSelect = (roleValue) => {
    if (roleValue !== value) onChange(roleValue);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      style={{ position: 'relative', minWidth: 120 }}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          width: '100%',
          padding: '0.45rem 0.85rem',
          background: 'var(--color-bg-elevated)',
          border: `1px solid ${open ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          color: current.color,
          fontSize: '0.88rem',
          fontWeight: 600,
          fontFamily: 'var(--font-body)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: open ? '0 0 0 3px var(--color-primary-glow)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{current.label}</span>
        <svg
          width="12" height="8" viewBox="0 0 12 8" fill="none"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '100%',
            background: '#1e1e2e',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 200,
            animation: 'slideUp 0.15s ease',
          }}
        >
          {ROLES.map((role) => {
            const isActive = role.value === value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => handleSelect(role.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  padding: '0.65rem 1rem',
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  color: isActive ? role.color : 'var(--color-text-muted)',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = role.color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                {/* Color dot */}
                <span style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: role.color,
                  flexShrink: 0,
                  boxShadow: isActive ? `0 0 6px ${role.color}` : 'none',
                }} />
                {role.label}
                {isActive && (
                  <svg style={{ marginLeft: 'auto' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3.5 3.5 5.5-6" stroke={role.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
