import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Box, IconButton, Typography, keyframes, CircularProgress } from '@mui/material';
import { CameraOff, SwitchCamera } from 'lucide-react';

const scanLineMove = keyframes`
  0% { top: 8%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 92%; opacity: 0; }
`;

const pulseOverlay = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.8; }
`;

const QRScanner = ({ onScan, paused = false, onRequestPause }) => {
  const scannerRef = useRef(null);
  const scanLockRef = useRef(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  // Enumerar cámaras disponibles y recuperar la preferida del almacenamiento local
  useEffect(() => {
    let mounted = true;

    const findBestCamera = (devices, savedId) => {
      if (savedId) {
        const saved = devices.find(d => d.id === savedId);
        if (saved) return saved.id;
      }
      const back = devices.find(d => {
        const label = d.label.toLowerCase();
        return label.includes('back') || label.includes('environment') || label.includes('trasera');
      });
      return back ? back.id : devices[0]?.id || null;
    };

    Html5Qrcode.getCameras()
      .then(devices => {
        if (!mounted) return;
        setCameras(devices);
        const savedId = localStorage.getItem('qr_camera_id');
        const bestId = findBestCamera(devices, savedId);
        setSelectedCamera(bestId);
      })
      .catch(err => {
        if (!mounted) return;
        console.error('[QRScanner] Error al obtener cámaras:', err);
        setError('No se pudo acceder a las cámaras. Asegúrate de haber concedido permiso.');
      })
      .finally(() => {
        if (!mounted) return;
        setCameraLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  // Crear la instancia del scanner y liberarla al desmontar
  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    return () => {
        if (scannerRef.current) {
        const state = scannerRef.current.getState?.();
        if (state !== Html5QrcodeScannerState.NOT_STARTED) {
          Promise.resolve(scannerRef.current.stop()).catch(() => {});
        }
        scannerRef.current = null;
      }
    };
  }, []);

  const handleScan = useCallback((decodedText) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    // Pausar el scanner inmediatamente para ahorrar batería y evitar callbacks extra
    if (scannerRef.current) {
      try {
        scannerRef.current.pause();
      } catch (e) {
        console.warn('[QRScanner] Error pausando scanner:', e);
      }
    }
    setScanning(false);
    onScan(decodedText);
  }, [onScan]);

  // Controlar inicio/pausa/reanudación según la prop `paused`
  useEffect(() => {
    if (!scannerRef.current || !selectedCamera) return;

    const scanner = scannerRef.current;

    const startOrResume = async () => {
      try {
        const state = scanner.getState?.();

        if (state === Html5QrcodeScannerState.SCANNING) {
          setScanning(true);
          return;
        }

        if (state === Html5QrcodeScannerState.PAUSED) {
          scanLockRef.current = false;
          await scanner.resume();
          setScanning(true);
          return;
        }

        scanLockRef.current = false;
        await scanner.start(
          { deviceId: { exact: selectedCamera } },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
          handleScan,
          () => {} // Ignorar errores de frames individuales
        );
        setScanning(true);
        setError(null);
      } catch (err) {
        console.error('[QRScanner] Error iniciando cámara:', err);
        setError('No se pudo iniciar la cámara seleccionada.');
        setScanning(false);
      }
    };

    if (!paused) {
      startOrResume();
    } else {
      const state = scanner.getState?.();
      if (state === Html5QrcodeScannerState.SCANNING) {
        Promise.resolve(scanner.pause()).catch(() => {});
      }
      // Diferir la actualización de estado para evitar setState síncrono en el effect
      Promise.resolve().then(() => setScanning(false));
    }
  }, [paused, selectedCamera, handleScan]);

  const handleSwitchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return;

    const currentIndex = cameras.findIndex(c => c.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    try {
      const state = scannerRef.current.getState?.();
      if (state !== Html5QrcodeScannerState.NOT_STARTED) {
        await scannerRef.current.stop();
      }
    } catch (e) {
      console.warn('[QRScanner] Error deteniendo cámara actual:', e);
    }

    scanLockRef.current = false;
    setScanning(false);
    setSelectedCamera(nextCamera.id);
    localStorage.setItem('qr_camera_id', nextCamera.id);
  };

  if (error) {
    return (
      <Box
        sx={{
          width: '100%',
          maxWidth: 360,
          mx: 'auto',
          p: 3,
          borderRadius: 3,
          backgroundColor: 'error.light',
          color: 'error.contrastText',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" fontWeight={600}>
          Error de cámara
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.9 }}>
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 360, mx: 'auto' }}>
      {/* Contenedor del video — siempre en el DOM para que Html5Qrcode lo encuentre */}
      <Box
        id="qr-reader"
        sx={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#000',
          '& video': {
            width: '100% !important',
            height: '100% !important',
            display: 'block',
            objectFit: 'cover',
          },
          '& img': {
            display: 'none !important',
          },
        }}
      />

      {/* Overlay de carga */}
      {cameraLoading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            backgroundColor: 'action.hover',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <CircularProgress size={32} color="primary" />
          <Typography variant="body2" color="text.secondary">
            Iniciando cámara…
          </Typography>
        </Box>
      )}

      {/* Overlay de pausa */}
      {!cameraLoading && paused && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            color: 'common.white',
            textAlign: 'center',
            px: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              border: '3px solid',
              borderColor: 'primary.main',
              borderRadius: 3,
              opacity: 0.4,
              animation: `${pulseOverlay} 2s ease-in-out infinite`,
            }}
          />
          <CameraOff size={48} strokeWidth={1.5} />
          <Typography variant="body2" sx={{ position: 'relative', zIndex: 1 }}>
            Scanner en pausa. Pulsa el botón QR para escanear.
          </Typography>
        </Box>
      )}

      {/* Overlays activos durante el escaneo */}
      {!cameraLoading && !paused && (
        <>
          {/* Marco animado */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{
                width: { xs: '70%', sm: 250 },
                aspectRatio: '1 / 1',
                border: '3px solid',
                borderColor: scanning ? 'primary.main' : 'grey.500',
                borderRadius: 3,
                position: 'relative',
                boxShadow: scanning
                  ? '0 0 0 9999px rgba(0,0,0,0.45), 0 0 20px rgba(249,115,22,0.5)'
                  : '0 0 0 9999px rgba(0,0,0,0.55)',
                transition: 'all 0.3s ease',
                '&::before, &::after': {
                  content: '""',
                  position: 'absolute',
                  width: 24,
                  height: 24,
                  borderColor: scanning ? 'primary.main' : 'grey.500',
                  borderStyle: 'solid',
                  transition: 'border-color 0.3s ease',
                },
                '&::before': {
                  top: -3,
                  left: -3,
                  borderWidth: '4px 0 0 4px',
                  borderRadius: '12px 0 0 0',
                },
                '&::after': {
                  bottom: -3,
                  right: -3,
                  borderWidth: '0 4px 4px 0',
                  borderRadius: '0 0 12px 0',
                },
              }}
            >
              {scanning && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: '10%',
                    right: '10%',
                    height: '3px',
                    backgroundColor: 'primary.main',
                    borderRadius: 2,
                    boxShadow: '0 0 8px rgba(249,115,22,0.9)',
                    animation: `${scanLineMove} 1.8s ease-in-out infinite`,
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Selector de cámara */}
          {cameras.length > 1 && (
            <IconButton
              onClick={handleSwitchCamera}
              disabled={!scanning}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'common.white',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.7)',
                },
              }}
              size="small"
            >
              <SwitchCamera size={22} />
            </IconButton>
          )}

          {/* Botón para detener el escaneo */}
          {onRequestPause && (
            <IconButton
              onClick={onRequestPause}
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'common.white',
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.7)',
                },
              }}
              size="small"
            >
              <CameraOff size={22} />
            </IconButton>
          )}

          {/* Indicador de estado */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              px: 2,
              py: 0.5,
              borderRadius: 4,
              backgroundColor: scanning ? 'rgba(46,204,113,0.85)' : 'rgba(0,0,0,0.5)',
              color: 'common.white',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              typography: 'caption',
              fontWeight: 700,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: scanning ? '#fff' : 'grey.400',
                animation: scanning ? `${pulseOverlay} 1.2s ease-in-out infinite` : 'none',
              }}
            />
            {scanning ? 'Escaneando…' : 'Iniciando…'}
          </Box>
        </>
      )}
    </Box>
  );
};

export default QRScanner;
