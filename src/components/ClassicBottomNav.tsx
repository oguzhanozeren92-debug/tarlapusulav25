import { CalendarDays, CloudSun, House, MapPinned, Sparkles } from 'lucide-react';
import type { Screen } from '../types';

type ClassicBottomNavProps = {
  activeScreen?: Screen | string;
  setScreen?: (screen: Screen) => void;
  onOpenAi?: () => void;
  onOpenCalendar?: () => void;
  onOpenFields?: () => void;
};

const CLASSIC_BOTTOM_NAV_CSS = String.raw`
.tp-classic-bottom-spacer{
  height:82px;
  min-height:82px;
}

.tp-classic-bottom-nav{
  position:fixed;
  z-index:2147481500;
  left:50%;
  bottom:0;
  transform:translateX(-50%);
  width:min(100%,760px);
  min-height:68px;
  padding:6px 8px max(6px,env(safe-area-inset-bottom));
  box-sizing:border-box;
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  align-items:end;
  gap:2px;
  border-top:1px solid #dfe4e8;
  background:rgba(255,255,255,.98);
  box-shadow:0 -8px 24px rgba(17,24,39,.06);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
}

.tp-classic-bottom-nav button{
  min-width:0;
  min-height:54px;
  padding:3px 2px 1px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-end;
  gap:3px;
  border:0;
  border-radius:12px;
  background:transparent;
  color:#4b5563;
  font:700 8px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  cursor:pointer;
}

.tp-classic-bottom-icon{
  width:32px;
  height:32px;
  display:grid;
  place-items:center;
  border:1px solid transparent;
  border-radius:10px;
  background:transparent;
  color:#1f2937;
}

.tp-classic-bottom-icon svg{
  width:19px;
  height:19px;
  stroke:currentColor;
}

.tp-classic-bottom-nav button.active{
  color:#111827;
}

.tp-classic-bottom-nav button.active .tp-classic-bottom-icon{
  border-color:#111827;
  background:#111827;
  color:#fff;
  box-shadow:0 4px 12px rgba(17,24,39,.14);
}

.tp-classic-bottom-nav button:active{
  transform:translateY(1px);
}

@media(max-width:560px){
  .tp-classic-bottom-nav{
    min-height:64px;
    padding-left:5px;
    padding-right:5px;
  }
  .tp-classic-bottom-nav button{
    min-height:50px;
    font-size:7.4px;
  }
  .tp-classic-bottom-icon{
    width:30px;
    height:30px;
    border-radius:9px;
  }
  .tp-classic-bottom-icon svg{
    width:18px;
    height:18px;
  }
  .tp-classic-bottom-spacer{
    height:76px;
    min-height:76px;
  }
}
`;

export default function ClassicBottomNav({
  activeScreen,
  setScreen,
  onOpenAi,
  onOpenCalendar,
  onOpenFields,
}: ClassicBottomNavProps) {
  const go = (screen: Screen) => setScreen?.(screen);

  const goFields = () => {
    if (onOpenFields) {
      onOpenFields();
      return;
    }

    go('home');
    window.setTimeout(() => {
      document
        .querySelector('.tp-home-field')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const goAi = () => {
    if (onOpenAi) onOpenAi();
    else go('aiAnalysis');
  };

  const goCalendar = () => {
    if (onOpenCalendar) onOpenCalendar();
    else go('calendar');
  };

  return (
    <>
      <style>{CLASSIC_BOTTOM_NAV_CSS}</style>
      <div className="tp-classic-bottom-spacer" aria-hidden="true" />
      <nav className="tp-classic-bottom-nav" aria-label="Ana menü">
        <button
          type="button"
          className={activeScreen === 'home' ? 'active' : ''}
          onClick={() => go('home')}
        >
          <span className="tp-classic-bottom-icon"><House strokeWidth={1.8} /></span>
          Ana Sayfa
        </button>

        <button
          type="button"
          className={activeScreen === 'weatherHub' ? 'active' : ''}
          onClick={() => go('weatherHub')}
        >
          <span className="tp-classic-bottom-icon"><CloudSun strokeWidth={1.8} /></span>
          Hava Durumu
        </button>

        <button
          type="button"
          className={activeScreen === 'aiAnalysis' ? 'active' : ''}
          onClick={goAi}
        >
          <span className="tp-classic-bottom-icon"><Sparkles strokeWidth={1.8} /></span>
          Pusula AI
        </button>

        <button
          type="button"
          className={activeScreen === 'calendar' ? 'active' : ''}
          onClick={goCalendar}
        >
          <span className="tp-classic-bottom-icon"><CalendarDays strokeWidth={1.8} /></span>
          Takvim
        </button>

        <button type="button" onClick={goFields}>
          <span className="tp-classic-bottom-icon"><MapPinned strokeWidth={1.8} /></span>
          Tarlalarım
        </button>
      </nav>
    </>
  );
}
