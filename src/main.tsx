import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import PinnedCropSuitabilityNotification from './features/notifications/components/PinnedCropSuitabilityNotification';
import PublishedAgriNewsBridge from './features/content-public/PublishedAgriNewsBridge';
import AdminUiRuntime from './features/admin-ui/AdminUiRuntime';
import InAppAdminMode from './features/admin-mode/InAppAdminMode';
import AppNotificationBridge from './features/admin-mode/AppNotificationBridge';
import './styles/TarlaPusulaTheme.css';
import './styles/MobileAppShell.css';
import './styles/WhiteAppTheme.css';
import './styles/MonochromeUI.css';
import './styles/MapReadabilityFix.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      <PinnedCropSuitabilityNotification />
      <PublishedAgriNewsBridge />
      <AdminUiRuntime />
      <AppNotificationBridge />
      <InAppAdminMode />
    </>
  </StrictMode>,
);
