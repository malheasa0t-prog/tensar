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
import '@/app/techfix-layout.css';
import '@/app/techfix-tokens.css';
import '@/app/techfix-support.css';
import '@/app/techfix-footer.css';
import '@/app/techfix-sidebar-layout.css';

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
