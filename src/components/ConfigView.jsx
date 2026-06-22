import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Box,
  MenuItem
} from '@mui/material';
import { UserCheck } from 'lucide-react';

export default function ConfigView({ config, onSave }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombreCompleto: config?.nombreCompleto || '',
    codigoVoluntario: config?.codigoVoluntario || '',
    codigoPrueba: config?.codigoPrueba || '',
    seccion: config?.seccion || '',
    rol: config?.rol || '',
    dia: config?.dia || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Limpiar campos condicionales si cambia la sección
      if (name === 'seccion') {
        updated.rol = '';
        updated.dia = '';
      }
      return updated;
    });
  };

  const isFormValid = () => {
    const { nombreCompleto, codigoVoluntario, codigoPrueba, seccion, rol, dia } = formData;
    if (!nombreCompleto || !codigoVoluntario || !codigoPrueba || !seccion) return false;
    if (seccion === 'Tizones' && (!rol || !dia)) return false;
    if (seccion === 'Cadetes' && !rol) return false;
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid()) {
      onSave(formData);
      navigate('/');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box sx={{ 
              backgroundColor: 'primary.light', 
              p: 2, 
              borderRadius: '50%',
              color: 'primary.main',
              display: 'flex'
            }}>
              <UserCheck size={32} />
            </Box>
          </Box>
        
          <Typography variant="h5" fontWeight="bold" gutterBottom color="secondary.main">
            Identificación de Voluntario
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Por favor, introduce tus datos. Estos se adjuntarán a todas las puntuaciones que envíes.
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              required
              label="Nombre completo"
              name="nombreCompleto"
              value={formData.nombreCompleto}
              onChange={handleChange}
              margin="normal"
              variant="outlined"
            />
            <TextField
              fullWidth
              required
              label="Código de voluntario"
              name="codigoVoluntario"
              value={formData.codigoVoluntario}
              onChange={handleChange}
              margin="normal"
              variant="outlined"
            />
            <TextField
              fullWidth
              required
              label="Código de Prueba"
              name="codigoPrueba"
              value={formData.codigoPrueba}
              onChange={handleChange}
              margin="normal"
              variant="outlined"
              helperText="El código de la prueba en la que estás asignado"
            />
            
            <TextField
              select
              fullWidth
              required
              label="Rol y número (Tizones/Cadetes)"
              name="seccion"
              value={formData.seccion}
              onChange={handleChange}
              margin="normal"
              variant="outlined"
            >
              <MenuItem value="Tizones">Tizones</MenuItem>
              <MenuItem value="Cadetes">Cadetes</MenuItem>
            </TextField>

            {formData.seccion === 'Tizones' && (
              <>
                <TextField
                  select
                  fullWidth
                  required
                  label="Función (Coordinador/Voluntario/Talleres)"
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
                  margin="normal"
                  variant="outlined"
                >
                  <MenuItem value="Coordinador">Coordinador</MenuItem>
                  <MenuItem value="Voluntario">Voluntario</MenuItem>
                  <MenuItem value="Talleres">Talleres</MenuItem>
                </TextField>

                <TextField
                  select
                  fullWidth
                  required
                  label="Día"
                  name="dia"
                  value={formData.dia}
                  onChange={handleChange}
                  margin="normal"
                  variant="outlined"
                >
                  <MenuItem value="Viernes">Viernes</MenuItem>
                  <MenuItem value="Sábado">Sábado</MenuItem>
                </TextField>
              </>
            )}

            {formData.seccion === 'Cadetes' && (
              <TextField
                select
                fullWidth
                required
                label="Función (Voluntario/Talleres)"
                name="rol"
                value={formData.rol}
                onChange={handleChange}
                margin="normal"
                variant="outlined"
              >
                <MenuItem value="Voluntario">Voluntario</MenuItem>
                <MenuItem value="Talleres">Talleres</MenuItem>
              </TextField>
            )}
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={!isFormValid()}
              sx={{ mt: 4, py: 1.5, borderRadius: 2 }}
            >
              Guardar e Iniciar
            </Button>
          </form>
        </Box>
      </Paper>
    </Container>
  );
}
