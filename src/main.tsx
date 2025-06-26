import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
// import 'tailwindcss/tailwind.css';
// import 'tailwindcss/base.css';
// import 'tailwindcss/components.css';
// import 'tailwindcss/utilities.css';

import './index.css';

import { Icon } from 'leaflet';
import marker from 'leaflet/dist/images/marker-icon.png';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (Icon.Default.prototype as any)._getIconUrl;

Icon.Default.mergeOptions({
  iconUrl: marker,
  iconRetinaUrl: marker2x,
  shadowUrl: shadow,
});

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
