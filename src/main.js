/* Punto de entrada de Vite. Importa los estilos y los módulos en orden de
 * dependencia. Cada archivo se cuelga del namespace global WC (efecto de
 * importarlo), igual que antes, pero ahora empaquetado por Vite. */
import './styles.css';

import './store.js';
import './util.js';
import './colors.js';
import './api.js';
import './auth.js';
import './ui.js';
import './views/tour.js';
import './views/agenda.js';
import './views/timeline.js';
import './views/dashboard.js';
import './views/matriz.js';
import './app.js';