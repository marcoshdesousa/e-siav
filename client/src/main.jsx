import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Sem modo offline: tira o service worker antigo (e o que ele guardou) dos aparelhos.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k))).catch(() => {});
}
