import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from './theme'
import App from './App.jsx'
import { forceSyncViaMessage, getPendingCount } from './offlineQueue'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)

/* ── Registro del Service Worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PWA] Service Worker registrado:', reg.scope);
    } catch (err) {
      console.warn('[PWA] Error registrando Service Worker:', err);
    }
  });
}

/* ── Fallback: cuando el dispositivo vuelve online, forzar sync ── */
window.addEventListener('online', async () => {
  const count = await getPendingCount();
  if (count > 0) {
    console.log(`[PWA] Dispositivo online, ${count} puntuaciones pendientes. Forzando sync...`);
    forceSyncViaMessage();
  }
});

