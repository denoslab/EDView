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
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find #root element to mount the viewer into');
}
const MapViewer = lazy(() => 
  import('./MapViewer').then(module => ({ default: module.MapViewer }))
);

createRoot(rootElement).render(
  <Suspense fallback={<div>Loading 3D Scene...</div>}>  
    <StrictMode>
      <MapViewer />
    </StrictMode>
  </Suspense>
);
