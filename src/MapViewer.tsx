/**
 * `MapViewer` — top-level page that lets a user pick a map from the
 * catalogue and inspect its parsed floor plan in an interactive 3D view.
 *
 * The viewer is intentionally minimal — Phase 1 ships a sidebar of
 * available maps, display toggles, parsed-count stats, and a full 3D
 * Three.js scene. Future phases will add agent timelines, replays, and
 * metrics on top of the same {@link ThreeFloorPlan}.
 *
 * @packageDocumentation
 */

import { useEffect, useMemo, useState } from 'react';
import { ThreeFloorPlan } from '@/components/ThreeFloorPlan';
import { expandFrames } from '@/replay/expandFrames';
import { loadReplayFromUrl } from '@/replay/loadReplay';
import { usePersonaPositions } from '@/replay/usePersonaPositions';
import { usePlayback } from '@/replay/usePlayback';
import type { ReplayFile } from '@/replay/types';
import { PlaybackBar } from '@/components/PlaybackBar';
import { ReplayDropZone } from '@/components/ReplayDropZone';
import { loadMapLayout } from '@/parser/loadMapLayout';
import type { MapLayout } from '@/parser/types';
import { MAP_CATALOGUE, getCatalogueEntry, type MapCatalogueEntry } from '@/data/maps';

type LoadingState =
  | { kind: 'idle' }
  | { kind: 'loading'; mapId: string }
  | { kind: 'ready'; layout: MapLayout }
  | { kind: 'error'; mapId: string; error: string };

/**
 * The full map viewer page.
 */
export function MapViewer() {
  const [selected, setSelected] = useState<MapCatalogueEntry>(() => {
    if (typeof window === 'undefined') return MAP_CATALOGUE[0]!;
    const params = new URLSearchParams(window.location.search);
    return getCatalogueEntry(params.get('map'));
  });
  const [state, setState] = useState<LoadingState>({ kind: 'idle' });
  const [showZoneLabels, setShowZoneLabels] = useState(true);
  // On narrow viewports the sidebar is hidden by default and toggled
  // open via a hamburger button in the header. On wide viewports the
  // sidebar is always visible and this flag is a no-op.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load the selected map.
  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading', mapId: selected.id });
    loadMapLayout(selected.load)
      .then((layout) => {
        if (cancelled) return;
        setState({ kind: 'ready', layout });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', mapId: selected.id, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [selected.id]);

  // Reflect the current selection in the URL so it survives reloads and
  // makes the viewer trivially shareable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('map', selected.id);
    window.history.replaceState(null, '', url.toString());
  }, [selected.id]);

  const closeSidebarOnMobile = () => setIsSidebarOpen(false);

  // ── Replay state ──────────────────────────────────────────────────────────
  const [replay, setReplay] = useState<ReplayFile | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  //const [personas, setPersonas] = useState<Record<string, PersonaState>>({});
  // Auto-load from ?replay=<url> query param on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('replay');
    if (!url) return;
    loadReplayFromUrl(url)
      .then(setReplay)
      .catch((e) => setReplayError(String(e)));
  }, []);

  const expanded = useMemo(
    () => (replay ? expandFrames(replay.frames) : []),
    [replay],
  );
  const playback = usePlayback({
    totalSteps: replay?.metadata.totalSteps ?? 1,
    secPerStep: replay?.metadata.secPerStep ?? 30,
  });
  const personas = usePersonaPositions({
    expanded,
    personas: replay?.personas ?? [],
    currentStep: playback.currentStep,
    interpAlpha: playback.interpAlpha,
    collisionMask: state.kind === 'ready' ? state.layout.collisionMask : [],
  });

  // Warn if the loaded replay targets a different map than the one displayed.
  const mapMismatch =
    replay !== null &&
    state.kind === 'ready' &&
    state.layout.mapId !== undefined &&
    state.layout.mapId !== replay.mapId;

  return (
    <>
    <ReplayDropZone
      onLoaded={setReplay}
      onError={(e) => setReplayError(String(e))}
    />
    <button
      data-testid="load-demo-replay"
      onClick={() =>
        loadReplayFromUrl(`${import.meta.env.BASE_URL}replays/small_ed_demo.json`)
          .then(setReplay)
          .catch((e) => setReplayError(String(e)))
      }
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        padding: "8px 12px",
        background: "#2d6cdf",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 13,
        zIndex: 20,
      }}
    >
      Replay
    </button>
    <div
      className={`map-viewer-root${isSidebarOpen ? ' sidebar-open' : ''}`}
      data-testid="map-viewer"
    >
      <header className="map-viewer-header">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen((open) => !open)}
          data-testid="sidebar-toggle"
        >
          <span className="sidebar-toggle-bar" />
          <span className="sidebar-toggle-bar" />
          <span className="sidebar-toggle-bar" />
        </button>
        <div>
          <h1>EDSim Floor Plan Viewer</h1>
        </div>
      </header>
      <div className="map-viewer-body">
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          tabIndex={isSidebarOpen ? 0 : -1}
          onClick={closeSidebarOnMobile}
          data-testid="sidebar-backdrop"
        />
        <aside className="map-viewer-sidebar" data-testid="map-sidebar">
          <h2>Maps</h2>
          <ul className="map-list">
            {MAP_CATALOGUE.map((entry) => {
              const isActive = entry.id === selected.id;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`map-list-item${isActive ? ' active' : ''}`}
                    onClick={() => {
                      setSelected(entry);
                      closeSidebarOnMobile();
                    }}
                    data-testid={`map-button-${entry.id}`}
                  >
                    <span className="map-name">{entry.displayName}</span>
                    <span className="map-description">{entry.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <h2>Display</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showZoneLabels}
              onChange={(e) => setShowZoneLabels(e.target.checked)}
              data-testid="toggle-zone-labels"
            />
            Show zone labels
          </label>


          {state.kind === 'ready' ? (
            <ParserStats layout={state.layout} />
          ) : null}
        </aside>

        <main className="map-viewer-canvas" data-testid="map-viewer-canvas-host">
          {state.kind === 'loading' ? (
            <div className="status" data-testid="loading-state">
              Loading <strong>{state.mapId}</strong>...
            </div>
          ) : null}
          {state.kind === 'error' ? (
            <div className="status error" data-testid="error-state">
              <strong>Failed to load {state.mapId}</strong>
              <pre>{state.error}</pre>
            </div>
          ) : null}
          {state.kind === 'ready' ? (
            <ThreeFloorPlan
              key={state.layout.mapId}
              layout={state.layout}
              showZoneLabels={showZoneLabels}
              personas={personas}
            />
          ) : null}
        </main>
      </div>
    </div>
    {replay && (
      <PlaybackBar
        ctrl={playback}
        simTime={expanded[playback.currentStep]?.simTime}
      />
    )}
    {replayError && (
      <div
        style={{
          position: 'fixed',
          top: 64,
          right: 16,
          color: 'salmon',
          background: 'rgba(0,0,0,0.75)',
          padding: '8px 12px',
          borderRadius: 4,
          zIndex: 9999,
          maxWidth: 320,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
        data-testid="replay-error-banner"
      >
        Replay error: {replayError}
      </div>
    )}
    {mapMismatch && (
      <div
        style={{
          position: 'fixed',
          top: replayError ? 112 : 64,
          right: 16,
          color: 'orange',
          background: 'rgba(0,0,0,0.75)',
          padding: '8px 12px',
          borderRadius: 4,
          zIndex: 9999,
          maxWidth: 320,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
        data-testid="replay-mismatch-banner"
      >
        Replay was built for {replay!.mapId}; current map is{' '}
        {state.kind === 'ready' ? state.layout.mapId : 'unknown'}. Switch maps
        to view it.
      </div>
    )}
    </>
  );
}

interface ParserStatsProps {
  layout: MapLayout;
}

/**
 * Compact summary of parser output, rendered in the sidebar so the
 * viewer doubles as a lightweight QA tool.
 */
function ParserStats({ layout }: ParserStatsProps) {
  return (
    <section data-testid="parser-stats" className="parser-stats">
      <h2>Parsed counts</h2>
      <dl>
        <dt>Zones</dt>
        <dd data-testid="stat-zones">{layout.zones.length}</dd>
        <dt>Equipment</dt>
        <dd data-testid="stat-equipment">{layout.equipment.length}</dd>
        <dt>Spawning slots</dt>
        <dd data-testid="stat-spawning">{layout.spawningLocations.length}</dd>
        <dt>Wall segments</dt>
        <dd data-testid="stat-walls">{layout.walls.length}</dd>
        <dt>Map size</dt>
        <dd data-testid="stat-size">
          {layout.widthInTiles} × {layout.heightInTiles}
        </dd>
      </dl>
    </section>
  );
}
