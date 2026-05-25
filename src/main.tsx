/**
 * React entry point.
 *
 * Mounts the {@link MapViewer} into `#root` and applies the global stylesheet.
 * Kept intentionally tiny so the viewer is the only consumer of the React
 * runtime in Phase 1.
 *
 * @packageDocumentation
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
    <StrictMode>
      <QueryClientProvider client={queryClient}>
      <MapViewer />
      </QueryClientProvider>
    </StrictMode>
  </Suspense>
);
