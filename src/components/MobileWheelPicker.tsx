import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './MobileWheelPicker.css';

export type MobilePickerOption = {
  value: string;
  label: string;
  subtitle?: string;
};

type MobileWheelPickerProps = {
  value: string;
  options: MobilePickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  title?: string;
  className?: string;
  /** Change this after dependent options load to open the next picker. */
  autoOpenToken?: number;
};

export default function MobileWheelPicker({
  value, options, onChange, placeholder = 'Seç', disabled = false,
  searchable = false, searchPlaceholder = 'Ara…', title = 'Seçim yap',
  className = '', autoOpenToken = 0,
}: MobileWheelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const lastOpenToken = useRef(autoOpenToken);
  const selectedOption = options.find((item) => item.value === value);
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const visibleOptions = query
    ? options.filter((item) => `${item.label} ${item.subtitle ?? ''}`.toLocaleLowerCase('tr-TR').includes(query))
    : options;

  useEffect(() => {
    if (autoOpenToken === lastOpenToken.current) return;
    lastOpenToken.current = autoOpenToken;
    if (!disabled && options.length) setOpen(true);
  }, [autoOpenToken, disabled, options.length]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus({ preventScroll: true });
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onEscape);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const choose = (nextValue: string) => {
    setOpen(false);
    setSearch('');
    onChange(nextValue);
  };

  return <>
    <button type="button" ref={triggerRef} className={`tp-mobile-picker-trigger ${className}`.trim()}
      disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setSearch(''); setOpen(true); }}>
      <span className={selectedOption ? '' : 'placeholder'}>{selectedOption?.label ?? placeholder}</span>
      <span className="tp-mobile-picker-chevron" aria-hidden="true">⌄</span>
    </button>

    {open && createPortal(
      <div className="tp-picker-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
        <section ref={sheetRef} tabIndex={-1} className="tp-picker-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId}
          onMouseDown={(event) => event.stopPropagation()}>
          <div className="tp-picker-handle" aria-hidden="true" />
          <div className="tp-picker-header">
            <strong id={headingId}>{title}</strong>
            <button type="button" aria-label="Seçimi kapat" onClick={() => setOpen(false)}>×</button>
          </div>
          {searchable && <div className="tp-picker-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
          </div>}
          <div className="tp-picker-options" role="listbox" aria-label={title}>
            {visibleOptions.length ? visibleOptions.map((item) =>
              <button type="button" key={`${item.value}-${item.label}`} role="option"
                aria-selected={item.value === value} className={item.value === value ? 'selected' : ''}
                onClick={() => choose(item.value)}>
                <span><strong>{item.label}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span>
                {item.value === value && <span className="tp-picker-check" aria-hidden="true">✓</span>}
              </button>) : <p className="tp-picker-empty">Sonuç bulunamadı</p>}
          </div>
        </section>
      </div>, document.body,
    )}
  </>;
}
