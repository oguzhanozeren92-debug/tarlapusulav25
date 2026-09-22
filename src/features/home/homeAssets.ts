import todayBg from '../../assets/home/today-bg.webp';
import iconPusulaSprout from '../../assets/home/pusula-sprout.webp';
import iconWater from '../../assets/home/water.webp';
import iconLeafGold from '../../assets/home/leaf-gold.webp';
import iconBell from '../../assets/home/bell.webp';
import iconLeafGreen from '../../assets/home/leaf-green.webp';
import iconRain from '../../assets/home/rain.webp';
import iconDocument from '../../assets/home/document.webp';

export const PUSULA_BODY_SRC = iconPusulaSprout;

export const HOME_HEADER_SATELLITE_BG =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/ui-icons/backgrounds/global-header-satellite-v2.webp';

export const PUSULA_SANA_BG_SRC =
  'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/backgrounds/pusuladan-sana-bg-4.webp';

export const HOME_REFERENCE_ASSETS = {
  todayBg,
  notificationsBg:
    'https://fkrqvwarxzmdrexsxtzw.supabase.co/storage/v1/object/public/ui-icons/home-reference/notification-center-radar-bg.webp',
  iconPusulaSprout,
  iconWater,
  iconLeafGold,
  iconBell,
  iconLeafGreen,
  iconRain,
  iconDocument,
} as const;
