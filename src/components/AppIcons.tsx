type IconProps = { className?: string };

export const SatelliteIcon = ({ className = '' }: IconProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="22"
    height="22"
    style={{ width: 22, height: 22, maxWidth: 22, maxHeight: 22, flex: '0 0 22px' }}
    fill="none"
    aria-hidden="true"
  >
    <path d="M9.5 14.5 5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m14.5 9.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1.6" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M4.8 6.8 8 10 5.8 12.2 2.6 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="m16 14 3.2 3.2 2.2-2.2-3.2-3.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M5.2 16.9c1.1 1.1 1.1 2.9 0 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M2.8 15.6c1.8 1.8 1.8 4.7 0 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

export const WeatherIcon = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="7.2" cy="7" r="2.5" stroke="#F59E0B" strokeWidth="1.8"/>
    <path d="M7.2 1.8v1.3M7.2 10.9v1.3M2 7h1.3M11.1 7h1.3M3.5 3.3l.9.9M10 9.8l.9.9M10.9 3.3l-.9.9" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M7.6 18.5h9.2a4.2 4.2 0 0 0 .5-8.4 5.4 5.4 0 0 0-10.2 1.5 3.5 3.5 0 0 0 .5 6.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CameraCheckIcon = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 8.4h2.2l1.3-2h5.1l1.3 2h2.2A2.4 2.4 0 0 1 19 10.8v4.8A2.4 2.4 0 0 1 16.6 18H7.4A2.4 2.4 0 0 1 5 15.6v-4.8a2.4 2.4 0 0 1 2.4-2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    <circle cx="11.3" cy="13.1" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="18.3" cy="18.2" r="3.1" fill="#fff" stroke="#22A447" strokeWidth="1.6"/>
    <path d="m16.9 18.2.9.9 1.8-2" stroke="#22A447" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ClipboardIcon = ({ className = '' }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="4.8" width="14" height="16" rx="2.3" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M9 4.8v-1h6v1M8.6 9h6.8M8.6 12.5h6.8M8.6 16h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
