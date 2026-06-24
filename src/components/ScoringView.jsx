import { useState, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Rating,
  CircularProgress,
  Alert,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { QrCode, Send, CheckCircle2, Star, ChevronDown, Trash2, Plus, Archive } from 'lucide-react';
import QRScanner from './QRScanner';
import { enqueuePayloads } from '../offlineQueue';
import { TEAM_CODES } from '../data/codes';

// Reemplaza esta URL con la que obtengas al implementar el Google Apps Script
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzLdE_jYuyUizGFIEyPDEWNwpLDGFXEx8pB_SYu5BDz8RYPD_m1lN0MWSbwwInqMuYn/exec";

export default function ScoringView({ config, onScoreQueued }) {
  const [teamInput, setTeamInput] = useState('');
  const [selectedTeams, setSelectedTeams] = useState([]); // Array de { code, club, iglesia, puntuacion, puntuacionBiblia, puntuacionEjecucion }
  const [scannerPaused, setScannerPaused] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(''); // Mensaje de progreso
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'queued' | 'error' | null

  // Determinar la etiqueta de la puntuación y el máximo de estrellas según la configuración del voluntario
  let ratingLabel = "Puntuación";
  let maxStars = 5;

  const isCadetesVoluntario = config.seccion === 'Cadetes' && config.rol === 'Voluntario';

  if (config.seccion === 'Tizones') {
    if (config.rol === 'Voluntario') {
      if (config.dia === 'Viernes') {
        ratingLabel = "ejecución/grados";
      } else if (config.dia === 'Sábado') {
        ratingLabel = "ejecución grados";
      }
    } else if (config.rol === 'Talleres') {
      ratingLabel = "Talleres";
    } else if (config.rol === 'Coordinador') {
      ratingLabel = "preguntas biblicas";
      if (config.dia === 'Sábado') {
        maxStars = 30;
      }
    }
  } else if (config.seccion === 'Cadetes') {
    if (config.rol === 'Talleres') {
      ratingLabel = "Talleres";
    }
  }

  const addTeamCode = useCallback((code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    setSelectedTeams(prev => {
      if (prev.some(t => t.code === cleanCode)) {
        alert('Este equipo ya ha sido añadido.');
        return prev;
      }
      if (prev.length >= 4) {
        alert('Solo puedes puntuar hasta 4 equipos a la vez.');
        return prev;
      }

      const teamData = TEAM_CODES[cleanCode];
      const club = teamData?.club || 'Equipo no registrado';
      const iglesia = teamData?.iglesia || '';
      return [
        ...prev,
        {
          code: cleanCode,
          club,
          iglesia,
          puntuacion: 0,
          puntuacionBiblia: 0,
          puntuacionEjecucion: 0
        }
      ];
    });
    setTeamInput('');
  }, []);

  const removeTeam = (code, e) => {
    e.stopPropagation(); // Evitar expandir/colapsar el acordeón al pulsar borrar
    setSelectedTeams(prev => prev.filter(t => t.code !== code));
  };

  const handleRatingChange = (code, value) => {
    setSelectedTeams(prev => prev.map(t => t.code === code ? { ...t, puntuacion: value } : t));
  };

  const handleSubRatingChange = (code, field, value) => {
    setSelectedTeams(prev => prev.map(t => t.code === code ? { ...t, [field]: value } : t));
  };

  const onNewScanResult = useCallback((decodedText) => {
    addTeamCode(decodedText);
    setScannerPaused(true);
  }, [addTeamCode]);

  const isSubmitDisabled = () => {
    if (selectedTeams.length === 0 || isSubmitting) return true;
    
    // Verificar que todos los equipos añadidos tengan puntuación válida
    return selectedTeams.some(t => {
      if (isCadetesVoluntario) {
        return t.puntuacionBiblia === 0 || t.puntuacionEjecucion === 0;
      }
      return t.puntuacion === 0;
    });
  };

  /* ── Construir todos los payloads de una vez ── */
  const buildPayloads = () => {
    const basePayload = {
      nombre: config.nombreCompleto,
      codigoPrueba: config.codigoPrueba,
      categoriaPrueba: config.seccion || ''
    };

    const payloads = [];

    for (const team of selectedTeams) {
      const teamPayload = { ...basePayload, equipo: team.code };

      if (isCadetesVoluntario) {
        payloads.push({ ...teamPayload, modalidad: 'biblia', puntuacion: team.puntuacionBiblia });
        payloads.push({ ...teamPayload, modalidad: 'ejecucion', puntuacion: team.puntuacionEjecucion });
      } else {
        let modalidadCalculada = "";
        if (config.seccion === 'Tizones') {
          if (config.rol === 'Voluntario') modalidadCalculada = "ejecucion-grados";
          else if (config.rol === 'Talleres') modalidadCalculada = "talleres";
          else if (config.rol === 'Coordinador') modalidadCalculada = "biblia";
        } else if (config.seccion === 'Cadetes') {
          modalidadCalculada = config.rol === 'Talleres' ? "talleres" : "general";
        } else {
          modalidadCalculada = "general";
        }
        payloads.push({ ...teamPayload, modalidad: modalidadCalculada, puntuacion: team.puntuacion });
      }
    }

    return payloads;
  };

  /* ── Enviar un payload individual ── */
  const sendPayload = async (payload) => {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  };

  /* ── Submit principal con soporte offline ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitDisabled()) return;

    setIsSubmitting(true);
    setSubmitStatus(null);

    const payloads = buildPayloads();

    // Si estamos offline, encolar directamente
    if (!navigator.onLine) {
      try {
        setSubmitProgress('Sin conexión — guardando localmente…');
        await enqueuePayloads(payloads);
        setSubmitStatus('queued');
        setSelectedTeams([]);
        onScoreQueued?.();
      } catch (err) {
        console.error('[Offline] Error guardando en cola:', err);
        setSubmitStatus('error');
      } finally {
        setIsSubmitting(false);
        setSubmitProgress('');
      }
      return;
    }

    // Estamos online: intentar enviar uno a uno con pausa entre ellos
    const remaining = [...payloads];
    try {
      while (remaining.length > 0) {
        const payload = remaining.shift();
        const sent = payloads.length - remaining.length;
        setSubmitProgress(`Enviando ${sent} de ${payloads.length}…`);
        await sendPayload(payload);

        // Pequeña pausa entre requests para evitar rate limiting de Google
        if (remaining.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }

      setSubmitStatus('success');
      setSelectedTeams([]);
    } catch (error) {
      // El fetch falló (red caída a mitad de envío, rate limit, etc.) → encolar los restantes
      console.warn('[Online] Fetch falló, encolando payloads restantes:', error);
      try {
        if (remaining.length > 0) {
          await enqueuePayloads(remaining);
        }
        setSubmitStatus('queued');
        setSelectedTeams([]);
        onScoreQueued?.();
      } catch (queueErr) {
        console.error('[Offline] Error guardando en cola tras fallo:', queueErr);
        setSubmitStatus('error');
      }
    } finally {
      setIsSubmitting(false);
      setSubmitProgress('');
    }
  };

  const renderStarsForTeam = (team) => {
    if (isCadetesVoluntario) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
              biblia
            </Typography>
            <Rating
              value={team.puntuacionBiblia}
              onChange={(e, val) => handleSubRatingChange(team.code, 'puntuacionBiblia', val || 0)}
              size="large"
              sx={{ fontSize: "2.5rem", "& .MuiRating-iconFilled": { color: "warning.main" } }}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
              ejecucion
            </Typography>
            <Rating
              value={team.puntuacionEjecucion}
              onChange={(e, val) => handleSubRatingChange(team.code, 'puntuacionEjecucion', val || 0)}
              size="large"
              sx={{ fontSize: "2.5rem", "& .MuiRating-iconFilled": { color: "warning.main" } }}
            />
          </Box>
        </Box>
      );
    }

    if (maxStars === 30) {
      const rows = [];
      for (let r = 0; r < 6; r++) {
        const rowStars = [];
        for (let c = 0; c < 5; c++) {
          const starVal = r * 5 + c + 1;
          rowStars.push(
            <IconButton
              key={starVal}
              onClick={() => handleRatingChange(team.code, starVal)}
              sx={{
                color: team.puntuacion >= starVal ? 'warning.main' : 'text.disabled',
                p: 0.5,
                transition: 'transform 0.1s',
                '&:hover': { transform: 'scale(1.2)' }
              }}
            >
              <Star 
                size={28} 
                fill={team.puntuacion >= starVal ? 'currentColor' : 'none'} 
              />
            </IconButton>
          );
        }
        rows.push(
          <Box key={r} sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
            {rowStars}
          </Box>
        );
      }
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
          {rows}
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold', color: 'primary.main' }}>
            {team.puntuacion} / 30
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Rating
          value={team.puntuacion}
          onChange={(e, val) => handleRatingChange(team.code, val || 0)}
          size="large"
          sx={{ fontSize: "3rem", "& .MuiRating-iconFilled": { color: "warning.main" } }}
        />
      </Box>
    );
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 3 }}>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Voluntario: <strong>{config.nombreCompleto}</strong> {config.codigoVoluntario && `(${config.codigoVoluntario})`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Prueba: <strong>{config.codigoPrueba}</strong>
        </Typography>
        {config.seccion && (
          <Typography variant="body2" color="text.secondary">
            Sección: <strong>{config.seccion}</strong>
            {config.rol && ` · Rol: ${config.rol}`}
            {config.dia && ` · Día: ${config.dia}`}
          </Typography>
        )}
      </Box>

      {submitStatus === 'success' && (
        <Alert icon={<CheckCircle2 size={24} />} severity="success" sx={{ mb: 2 }}>
          Todas las puntuaciones se han enviado correctamente.
        </Alert>
      )}

      {submitStatus === 'queued' && (
        <Alert icon={<Archive size={24} />} severity="info" sx={{ mb: 2 }}>
          Puntuaciones guardadas localmente. Se enviarán automáticamente cuando haya conexión a internet.
        </Alert>
      )}

      {submitStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error al enviar algunas puntuaciones. Por favor, inténtalo de nuevo.
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, left: 0, right: 0, bottom: 0, 
            backgroundImage: 'url(/logo-transformados.jpeg)', 
            backgroundPosition: 'center', 
            backgroundRepeat: 'no-repeat', 
            backgroundSize: '150%', 
            opacity: 0.1, 
            zIndex: 0,
            pointerEvents: 'none'
          }} 
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom color="secondary.main">
            Registrar Puntuaciones (Multiescaneo)
          </Typography>

          <form onSubmit={handleSubmit}>

            {/* Agregar Código */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Código de Equipo"
                value={teamInput}
                onChange={(e) => setTeamInput(e.target.value)}
                variant="outlined"
                placeholder="Ej. T01 o CC1M3"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTeamCode(teamInput);
                  }
                }}
              />
              <Box sx={{ pt: 0.5, display: 'flex', gap: 1 }}>
                <IconButton
                  color="primary"
                  onClick={() => addTeamCode(teamInput)}
                  sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 2, p: 1.5 }}
                >
                  <Plus size={24} />
                </IconButton>
                <IconButton
                  color={scannerPaused ? "default" : "primary"}
                  onClick={() => setScannerPaused(!scannerPaused)}
                  sx={{
                    border: '1px solid',
                    borderColor: scannerPaused ? 'divider' : 'primary.main',
                    borderRadius: 2,
                    p: 1.5,
                    backgroundColor: scannerPaused ? 'transparent' : 'rgba(249, 115, 22, 0.1)'
                  }}
                >
                  <QrCode size={24} />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ mt: 2, mb: 3 }}>
              <QRScanner
                onScan={onNewScanResult}
                paused={scannerPaused}
                onRequestPause={() => setScannerPaused(true)}
              />
            </Box>

            {/* Lista de Equipos con Acordeones */}
            {selectedTeams.length > 0 ? (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
                  Equipos añadidos ({selectedTeams.length} de 4):
                </Typography>
                {selectedTeams.map((team) => (
                  <Accordion key={team.code} sx={{ mb: 1, boxShadow: 1, '&:before': { display: 'none' } }} defaultExpanded>
                    <AccordionSummary
                      expandIcon={<ChevronDown size={20} />}
                      sx={{
                        backgroundColor: 'grey.50',
                        borderRadius: 1,
                        '&.Mui-expanded': { borderBottom: '1px solid', borderColor: 'divider' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', pr: 1 }}>
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {team.club}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {team.iglesia}
                          </Typography>
                        </Box>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={(e) => removeTeam(team.code, e)}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ py: 3, textAlign: 'center', backgroundColor: '#fafafa' }}>
                      {!isCadetesVoluntario && (
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                          {ratingLabel}
                        </Typography>
                      )}
                      {renderStarsForTeam(team)}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            ) : (
              <Box sx={{ my: 4, py: 4, textAlign: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="body2" color="text.muted">
                  Escanea códigos QR o escribe y añade códigos de equipos para empezar a puntuarlos. (Máx. 4)
                </Typography>
              </Box>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={isSubmitDisabled()}
              startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send size={20} />}
              sx={{ mt: 2, py: 1.5, borderRadius: 2 }}
            >
              {isSubmitting ? (submitProgress || 'Enviando...') : `Confirmar y Enviar ${selectedTeams.length} Puntuación(es)`}
            </Button>

          </form>
        </Box>
      </Paper>
    </Container>
  );
}
