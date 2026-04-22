/**
 * Vite Application Entry Point.
 *
 * Creates the React root and mounts the Router.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './router';
import { registerServiceWorker } from '@/lib/serviceWorkerRegistration';

import '@/app/globals.css';
import '@/app/site.css';
import '@/app/techfix-layout.css';
import '@/app/techfix-tokens.css';
import '@/app/techfix-neon.css';
import '@/app/techfix-neon-effects.css';
import '@/app/techfix-footer.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('[APP-101] Root element #root not found in index.html');
}

void registerServiceWorker();

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>
);
