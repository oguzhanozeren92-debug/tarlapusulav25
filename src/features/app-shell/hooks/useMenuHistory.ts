import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Screen } from '../../../types';

const MENU_HISTORY_SCREENS = new Set<string>([
  'home',
  'weatherHub',
  'fieldControlHub',
  'soilAnalysisHub',
  'inventoryHub',
  'marketHub',
  'supportHub',
  'agendaHub',
  'nutritionHub',
  'pestGuideHub',
  'producerMarketHub',
  'fieldNotebookHub',
  'notificationsHub',
  'settingsHub',
  'adminHub',
]);

type UseMenuHistoryOptions = {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  closeMenu: () => void;
};

export function useMenuHistory({ screen, setScreen, closeMenu }: UseMenuHistoryOptions) {
  const historyRef = useRef<Screen[]>([]);
  const previousScreenRef = useRef<Screen>('welcome');
  const navigatingBackRef = useRef(false);

  useEffect(() => {
    const previous = previousScreenRef.current;
    if (previous === screen) return;

    if (navigatingBackRef.current) {
      navigatingBackRef.current = false;
      previousScreenRef.current = screen;
      return;
    }

    const previousIsMenu = MENU_HISTORY_SCREENS.has(String(previous));
    const currentIsMenu = MENU_HISTORY_SCREENS.has(String(screen));

    if (String(screen) === 'home' && !previousIsMenu) {
      historyRef.current = [];
    }

    if (previousIsMenu && currentIsMenu) {
      const history = historyRef.current;
      if (history[history.length - 1] !== previous) history.push(previous);
      if (history.length > 30) history.shift();
    }

    previousScreenRef.current = screen;
  }, [screen]);

  const goBackInMenu = () => {
    closeMenu();

    let target = historyRef.current.pop();
    while (target && String(target) === String(screen)) {
      target = historyRef.current.pop();
    }

    navigatingBackRef.current = true;
    setScreen((target ?? 'home') as Screen);
  };

  return { goBackInMenu };
}
