import type { CSSProperties } from 'react';

export type MapSection =
  | 'vegetation'
  | 'radar'
  | 'soil'
  | 'climate'
  | 'observations';

type Props = {
  active: MapSection;
  onNavigate: (section: MapSection) => void;
};

const ITEMS: Array<{ key: MapSection; label: string }> = [
  { key: 'vegetation', label: 'Bitki Sağlığı' },
  { key: 'radar', label: 'Radar' },
  { key: 'soil', label: 'Toprak' },
  { key: 'climate', label: 'İklim' },
  { key: 'observations', label: 'Zararlı & Tür' },
];

const shell: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
};

const inner: CSSProperties = {
  minWidth: 'max-content',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: 5,
  border: '1px solid rgba(205,177,102,.20)',
  borderRadius: 16,
  background: 'rgba(8,19,13,.86)',
};

const buttonBase: CSSProperties = {
  minHeight: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '0 13px',
  border: '1px solid transparent',
  borderRadius: 12,
  background: 'transparent',
  color: '#979b91',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

export default function MapTopNav({ active, onNavigate }: Props) {
  return (
    <nav style={shell} aria-label="Harita türleri">
      <div style={inner}>
        {ITEMS.map((item) => {
          const isActive = item.key === active;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                ...buttonBase,
                ...(isActive
                  ? {
                      borderColor: 'rgba(205,177,102,.32)',
                      background:
                        'linear-gradient(180deg,rgba(27,50,36,.95),rgba(16,33,23,.95))',
                      color: '#f0e8d4',
                    }
                  : {}),
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isActive ? '#77c98c' : '#596159',
                  boxShadow: isActive
                    ? '0 0 0 4px rgba(119,201,140,.09)'
                    : 'none',
                }}
              />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
