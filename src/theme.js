import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#F97316', // Naranja del logo "Transformados"
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#2D3748', // Azul marino / negro
      contrastText: '#ffffff',
    },
    warning: {
      main: '#FBBF24', // Amarillo/Dorado
    },
    background: {
      default: '#F3F4F6',
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 0',
        },
      },
    },
  },
});

export default theme;
