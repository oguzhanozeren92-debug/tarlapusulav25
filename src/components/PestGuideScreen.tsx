import { CalendarDays, CloudSun, House, MapPinned, Sparkles } from 'lucide-react';
import KnowledgeLibrary from '../features/knowledge/components/KnowledgeLibrary';
import type { Field, Screen } from '../types';
import '../pages/Home/HomeScreen.css';
import './PestGuideScreen.css';

export interface PestGuideScreenProps {
  fields: Field[];
  selectedFieldId?: string;
  screen?: Screen | string;
  desktopMenuItems?: Array<{
    screen: Screen | string;
    icon?: string;
    label: string;
    badge?: string;
  }>;
  sideMenuOpen?: boolean;
  setScreen?: (screen: Screen) => void;
  setSideMenuOpen?: (open: boolean) => void;
}

/**
 * Bilgi Rehberi temiz başlangıç yüzeyi.
 * Üst navigasyon ve drawer App.tsx içindeki ortak TarlaPusula kabuğundan gelir.
 * Alt navigasyon HomeScreen ile aynı sınıfları, ikonları ve sıralamayı kullanır.
 */
export default function PestGuideScreen({ setScreen }: PestGuideScreenProps) {
  const navigate = (screen: Screen) => setScreen?.(screen);

  return (
    <div className="tp-knowledge-page">
      <main className="tp-knowledge-canvas" aria-label="Bilgi Rehberi">
        <KnowledgeLibrary />
      </main>

      <nav className="tp-bottom" aria-label="Ana menü">
        <button type="button" onClick={() => navigate('home')}>
          <span className="tp-bottom-icon-shell">
            <House className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Ana Sayfa
        </button>

        <button type="button" onClick={() => navigate('weatherHub')} aria-label="Hava Durumu">
          <span className="tp-bottom-icon-shell">
            <CloudSun className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Hava Durumu
        </button>

        <button className="ai" type="button" onClick={() => navigate('aiAnalysis')}>
          <span className="tp-bottom-ai-shell">
            <Sparkles className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Pusula AI
        </button>

        <button type="button" onClick={() => navigate('calendar')}>
          <span className="tp-bottom-icon-shell">
            <CalendarDays className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Takvim
        </button>

        <button type="button" onClick={() => navigate('home')} aria-label="Tarlalarım">
          <span className="tp-bottom-icon-shell">
            <MapPinned className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
          </span>
          Tarlalarım
        </button>
      </nav>
    </div>
  );
}
