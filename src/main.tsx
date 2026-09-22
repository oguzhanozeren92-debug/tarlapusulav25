import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminPortal from './pages/Admin/AdminPortal.tsx'
import PinnedCropSuitabilityNotification from './features/notifications/components/PinnedCropSuitabilityNotification';
import './styles/TarlaPusulaTheme.css';
import './styles/MobileAppShell.css';
import './styles/WhiteAppTheme.css';
import './styles/MonochromeUI.css';
import './styles/MapReadabilityFix.css';

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <AdminPortal />
    ) : (
      <>
        <App />
        <PinnedCropSuitabilityNotification />
      </>
    )}
  </StrictMode>,
)
