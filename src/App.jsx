import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, IconButton } from '@mui/material';
import { Settings } from 'lucide-react';
import ConfigView from './components/ConfigView';
import ScoringView from './components/ScoringView';

function App() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedConfig = localStorage.getItem('campore_config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
    setLoading(false);
  }, []);

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
                config ? <ScoringView config={config} /> : <Navigate to="/config" replace />
              } 
            />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;
