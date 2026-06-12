import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign WebSocket/HMR errors to prevent breaking the preview overlay
if (typeof window !== 'undefined') {
  const ignoreWebSocketError = (event: ErrorEvent | PromiseRejectionEvent) => {
    const errorMsg = 'message' in event ? event.message : (event.reason?.message || event.reason || '');
    const stringified = String(errorMsg);
    if (
      /websocket/i.test(stringified) ||
      /socket/i.test(stringified) ||
      stringified.includes('WebSocket') ||
      stringified.includes('socket.io')
    ) {
      // Prevent browser console errors and full-screen error overlay popups from blocking the user experience
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  };

  window.addEventListener('error', (e) => {
    if (ignoreWebSocketError(e)) {
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    if (ignoreWebSocketError(e)) {
      e.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
