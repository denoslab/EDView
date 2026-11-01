/**
 * React entry point.
 *
 * Mounts the {@link MapViewer} into `#root` and applies the global stylesheet.
 * Kept intentionally tiny so the viewer is the only consumer of the React
 * runtime in Phase 1.
 *
 * @packageDocumentation
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Public Sans is the AHS brand font; self-hosted so the viewer needs no third-party fetch.
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import './theme/ahs-tokens.css';
import './styles.css';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find #root element to mount the viewer into');
}
const MapViewer = lazy(() => 
  import('./MapViewer').then(module => ({ default: module.MapViewer }))
);
const queryClient = new QueryClient();
createRoot(rootElement).render(
  <Suspense fallback={<div>Loading 3D Scene...</div>}>  

  {/* The Pages build serves under /EDView/, so the router must strip that prefix. */}
  <BrowserRouter basename={import.meta.env.BASE_URL}>
      <StrictMode>
        <QueryClientProvider client={queryClient}>


          {/* Page Switcher */}
          <Routes>
            <Route path="/" element={<MapViewer />} />
          </Routes>
        </QueryClientProvider>
      </StrictMode>

    </BrowserRouter>
  </Suspense>
);
