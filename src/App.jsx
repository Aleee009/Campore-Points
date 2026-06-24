import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, IconButton, Chip } from '@mui/material';
import { Settings, Wifi, WifiOff, Archive } from 'lucide-react';
import ConfigView from './components/ConfigView';
import ScoringView from './components/ScoringView';
import { getPendingCount } from './offlineQueue';

function App() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Cargar configuración guardada
  useEffect(() => {
    const savedConfig = localStorage.getItem('campore_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
    setLoading(false);
  }, []);

  // Actualizar el contador de pendientes
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (e) {
      // IndexedDB puede no estar disponible en algunos contextos
    }
  }, []);

  // Escuchar eventos online/offline y actualizar el contador
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Escuchar mensajes del Service Worker (sync completado)
    const handleSWMessage = (event) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        refreshPendingCount();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Polling suave cada 10 segundos para mantener el contador actualizado
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const handleSaveConfig = (newConfig) => {
    localStorage.setItem('campore_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  if (loading) return null;

  return (
    <Router>
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        <AppBar position="static" color="primary" elevation={0} sx={{ zIndex: 1 }}>
          <Toolbar>
            <Box 
              component="img" 
              src="/logo-transformados.jpeg" 
              alt="Logo" 
              sx={{ height: 40, width: 40, mr: 2, borderRadius: 1 }} 
            />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              Camporé Points
            </Typography>

            {/* Indicador de cola pendiente */}
            {pendingCount > 0 && (
              <Chip
                icon={<Archive size={14} />}
                label={`${pendingCount} pend.`}
                size="small"
                sx={{
                  mr: 1,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  '& .MuiChip-icon': { color: '#fff' }
                }}
              />
            )}

            {/* Indicador online/offline */}
            <Chip
              icon={isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              label={isOnline ? 'Online' : 'Sin red'}
              size="small"
              sx={{
                mr: 1,
                backgroundColor: isOnline 
                  ? 'rgba(46, 204, 113, 0.3)' 
                  : 'rgba(231, 76, 60, 0.4)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.7rem',
                border: `1px solid ${isOnline ? 'rgba(46,204,113,0.6)' : 'rgba(231,76,60,0.7)'}`,
                '& .MuiChip-icon': { color: '#fff' }
              }}
            />

            {config && (
              <IconButton color="inherit" href="/config">
                <Settings size={20} />
              </IconButton>
            )}
          </Toolbar>
        </AppBar>
        
        <Box sx={{ flexGrow: 1, overflow: 'auto', backgroundColor: 'transparent', pb: 4, zIndex: 1, position: 'relative' }}>
          <Routes>
            <Route 
              path="/config" 
              element={<ConfigView config={config} onSave={handleSaveConfig} />} 
            />
            <Route 
              path="/" 
              element={
                config ? <ScoringView config={config} onScoreQueued={refreshPendingCount} /> : <Navigate to="/config" replace />
              } 
            />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;

