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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {useEffect, useMemo, useState, useRef } from 'react';
import { ThreeFloorPlan } from '@/components/ThreeFloorPlan';
import {expandFrames } from '@/replay/expandFrames';
import { loadReplayFromUrl } from '@/replay/loadReplay';
import { usePersonaPositions } from '@/replay/usePersonaPositions';
import { usePlayback } from '@/replay/usePlayback';
import type { ReplayFile} from '@/replay/types';
import { PlaybackBar } from '@/components/PlaybackBar';
import { ReplayDropZone } from '@/components/ReplayDropZone';
import { LiveInfoBar } from '@/components/LiveInfoBar';
import LiveDashboard from '@/components/LiveDashboard';

import { loadMapLayout, loadReplayLayout } from '@/parser/loadMapLayout';
import type { MapLayout } from '@/parser/types';
import { MAP_CATALOGUE, getCatalogueEntry, type MapCatalogueEntry } from '@/data/maps';
import {isSimulationUp, startLiveMap} from '@/liveMap/loadInitialState';
import {useLiveMovement} from '@/liveMap/pollingSteps';
import {expandLiveFrame} from '@/liveMap/expandLiveFrame';
import MetricsDashboard, { isMetricsTabId, REVIEW_TAB_IDS } from '@/components/MetricsDashboard';
import type { MetricsTabId } from '@/components/MetricsDashboard';

type DashboardMode = 'general' | 'performance';

type LoadingState =
  | { kind: 'idle' }
  | { kind: 'loading'; mapId: string }
  | { kind: 'ready'; layout: MapLayout; playbackType: string }
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

  // Check if the simulation is running to show the live map button
  const [simulationRunning, setSimulationRunning] = useState(false);


  function loadMap(){
    let cancelled = false;
    setState({ kind: 'loading', mapId: selected.id });
    loadMapLayout(selected.load)
      .then((layout) => {
        if (cancelled) return;
        setState({ kind: 'ready', layout, playbackType: "view" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', mapId: selected.id, error: message });
      });
    return () => {
      cancelled = true;
    };
  }

  // Load the selected map.
  useEffect(loadMap, [selected]);

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

  // Poll the simulator so the live-map controls reflect whether a run is up.
  // The dependency list is load-bearing: without it the cleanup ran on every
  // render, so the 5 s interval was cleared long before it could fire and the
  // "Initial call" below became a probe per render instead of one per 5 s.
  // This effect lives here, below the `replay` declaration, because a
  // dependency array is evaluated during render and `replay` would otherwise
  // be read in its temporal dead zone.
  useEffect(()=> {

    if(replay){
      return;
    }

    const fetchSimulationState = () =>{
      isSimulationUp().then((result) => {
      console.log("Simulation Running",result);
      setSimulationRunning(result);})
    }
    fetchSimulationState(); // Initial call
    const interval = setInterval(fetchSimulationState, 5000);
    return () => clearInterval(interval);
  }, [replay]);

  // Auto-load from ?replay=<url> query param on mount.
  //
  // `loadReplay` calls `setReplay` and `setState`, so with no dependency list
  // this effect refetched the whole replay JSON on every render. The ref
  // records that the query param has been honoured: a later `selected` change
  // re-runs the effect (keeping the closure fresh) but must not refetch.
  // The guard is set on success, not before the fetch, so React 18's
  // StrictMode double-invoke — cleanup, then a second run — still loads the
  // replay in dev. `loadReplay` cannot appear in the dependency list: it is
  // declared below this effect and would be read in its temporal dead zone;
  // `selected` is the value it actually closes over (`selected.load`).
  const replayParamLoaded = useRef(false);
  useEffect(() => {
    if (replayParamLoaded.current) return;
    const params = new URLSearchParams(window.location.search);
    const url = params.get('replay');
    if (!url) return;
    let cancelled = false;
    loadReplayFromUrl(url)
      .then((replay) => {
        if (cancelled) return;
        replayParamLoaded.current = true;
        loadReplay(replay);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReplayError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const loadReplay = (currentReplay: ReplayFile) => {

    setReplay(currentReplay)
    if(currentReplay.mapLayout){
      loadReplayLayout(selected.load, currentReplay.mapLayout).then((layout) => {
        setState({ kind: 'ready', layout, playbackType: "replay" });
      });
    }
    // A link that asked for the dashboard opens it with the replay it was built for.
    if (metricsRequest.open && currentReplay.Metrics) {
      setMetricsOpen(true);
      setOverlay(false);
    }

  };

  const startReplay = () => {
    setLiveMapActive(false)
    setIsSidebarOpen(false);
    if(!replay){
    resetPage();
    loadReplayFromUrl(`${import.meta.env.BASE_URL}replays/small_ed_demo3.json`)
    .then((replay) => { loadReplay(replay)})
    }
    else{
      resetPage();
    }
  }

  // const findMap = (id: String): MapCatalogueEntry => {
  //   const findMap = MAP_CATALOGUE.find(map => map.id === id);
  //   return findMap ? findMap : selected;
  // }

  const expanded = useMemo(
    () => (replay ? expandFrames(replay.frames) : []),
    [replay],
  );
  const playback = usePlayback({
    totalSteps: replay?.metadata.totalSteps ?? 1,
    secPerStep: replay?.metadata.secPerStep ?? 30,
  });




  // Warn if the loaded replay targets a different map than the one displayed.
  const mapMismatch =
    replay !== null &&
    state.kind === 'ready' &&
    state.layout.mapId !== undefined &&
    state.layout.mapId !== replay.mapId;

  // ── Live Map ──────────────────────────────────────────────────────────

  const [step, setStep] = useState(0);
  const [liveMapActive, setLiveMapActive] = useState(false);
  const [overlay, setOverlay] = useState(false);
  // The replay metrics overlay has its own flag so it and the CTAS graphs never stack.
  // `?view=metrics` opens it as soon as a replay loads, and `?tab=<id>` (or `#<id>`)
  // picks the section, so a build script can hand out a link straight to a dashboard.
  const [metricsRequest] = useState<{ open: boolean; tab: MetricsTabId }>(() => {
    if (typeof window === 'undefined') return { open: false, tab: 'overview' };
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#/, '');
    const requested = params.get('tab') ?? hash;
    const tab: MetricsTabId = isMetricsTabId(requested) ? requested : 'overview';
    return { open: params.get('view') === 'metrics' || isMetricsTabId(hash), tab };
  });
  const initialDashboardMode: DashboardMode = REVIEW_TAB_IDS.includes(metricsRequest.tab) ? 'performance' : 'general';
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(initialDashboardMode);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  // `LiveDashboard` needs a client of its own: it reuses the ['liveData']
  // query key that `useLiveMovement` already owns on the root client from
  // main.tsx. Constructing it during render handed QueryClientProvider a new
  // client identity every render, which unmounted the old client, remounted
  // the new one and refetched every dashboard query — at animation-frame
  // cadence during playback. The lazy useState initialiser makes it
  // per-instance and stable.
  const [queryClientDashBoard] = useState(() => new QueryClient());

  const liveState = useLiveMovement(liveMapActive, step, setStep);
  const liveFrame = useMemo(
    () => (liveState ? expandLiveFrame(liveState, step) : []),
    [liveState,step],
  );

  const currentExpanded = state.kind === "ready" 
  ? (state.playbackType === "replay" ? expanded : liveFrame) 
  : [];

  // Dashboard menu and live dashboard state.
  const dashboardMenuRef = useRef<HTMLDivElement>(null);
  
 const liveMapButton = () => {
    resetPage()
    if(!liveMapActive){
      setIsSidebarOpen(false);
      setLiveMapActive(!liveMapActive)

      startLiveMap().then((initial) => {
        loadReplayLayout(selected.load, initial.mapLayout).then((layout) => {
          setState({ kind: 'ready', layout, playbackType: "live" });
          setStep(initial.step);
        })
      })
      .catch((error) => {
          // Handle the error here
          console.error("Failed to load live map:", error);
          setState({ kind: 'error', mapId: "live-map", error: "Simulation Not Running" });
        })
    }
    else{
      console.log("base")
    }
  }

  // Close the dashboard picker on outside click or Escape.
  useEffect(() => {
    if (!dashboardMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dashboardMenuRef.current && !dashboardMenuRef.current.contains(event.target as Node)) {
        setDashboardMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setDashboardMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dashboardMenuOpen]);



  // 1. Memoize the configuration object so it only changes when values actually change
  const personaOptions = useMemo(() => ({
    expanded: currentExpanded,
    personas: replay?.personas ?? [],
    currentStep: playback.currentStep,
    interpAlpha: playback.interpAlpha,
    collisionMask: state.kind === 'ready' ? state.layout.collisionMask : [],
    playbackType: state.kind === 'ready' ? state.playbackType : ""
  }), [currentExpanded, step, replay, state, playback.currentStep, playback.interpAlpha]);

  // 2. Pass the memoized object to your hook
  const personas = usePersonaPositions(personaOptions);

  function resetPage() {
    setLiveMapActive(false);
    setReplay(null);
    setOverlay(false);
    setMetricsOpen(false);
    setDashboardMenuOpen(false);
    loadMap();
  }

  return (
    
    <>
    <ReplayDropZone
      onLoaded={loadReplay}
      onError={(e) => setReplayError(String(e))}
    />

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

       

        {(liveMapActive || replay?.Metrics) && (
          <div className="dashboard-menu" ref={dashboardMenuRef}>
            <button
              type="button"
              className={liveMapActive && !simulationRunning ? 'inactive-button dashboard-menu-trigger' : 'top-bar-button dashboard-menu-trigger'}
              disabled={liveMapActive && !simulationRunning}
              aria-label="Open dashboard menu"
              aria-expanded={dashboardMenuOpen}
              aria-haspopup="menu"
              data-testid="dashboard-menu-button"
              onClick={() => setDashboardMenuOpen((open) => !open)}
            >
              <span className="dashboard-menu-bar" />
              <span className="dashboard-menu-bar" />
              <span className="dashboard-menu-bar" />
            </button>
            {dashboardMenuOpen && (
              <div className="dashboard-menu-panel" role="menu">
                {liveMapActive ? (
                  <>
                    <div className="dashboard-menu-heading">Live view</div>
                    <button
                      type="button"
                      role="menuitem"
                      className="dashboard-menu-option"
                      onClick={() => {
                        setOverlay(!overlay);
                        setMetricsOpen(false);
                        setDashboardMenuOpen(false);
                        setIsSidebarOpen(false);
                      }}
                    >
                      <span className="dashboard-menu-item-title">
                        {overlay ? 'Close live dashboard' : 'Live dashboard'}
                      </span>
                      <span className="dashboard-menu-item-description">
                        {overlay ? 'Back to the live map.' : 'View the current simulation status and activity.'}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="dashboard-menu-heading">Choose a dashboard</div>
                    <button
                      type="button"
                      role="menuitem"
                      className="dashboard-menu-option"
                      onClick={() => {
                        setDashboardMode('general');
                        setOverlay(false);
                        setMetricsOpen(true);
                        setDashboardMenuOpen(false);
                      }}
                    >
                      <span className="dashboard-menu-item-title">Department overview</span>
                      <span className="dashboard-menu-item-description">
                        Flow, waits, and occupancy and load.
                      </span>
                      <span className="dashboard-menu-item-sections">
                        Overview · Sections 1.1–1.3
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="dashboard-menu-option"
                      onClick={() => {
                        setDashboardMode('performance');
                        setOverlay(false);
                        setMetricsOpen(true);
                        setDashboardMenuOpen(false);
                      }}
                    >
                      <span className="dashboard-menu-item-title">Run review</span>
                      <span className="dashboard-menu-item-description">
                        Compare scenarios, check run health, and see how metrics are calculated.
                      </span>
                      <span className="dashboard-menu-item-sections">Sections 1.4–1.6</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {(liveMapActive && !simulationRunning) && (
        <div 
        className='inactive-button'
        style={{
          padding: '12px',
          

        }}>
          <strong>Error:</strong> Simulation has stopped running
        </div>
      )}
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
                    style={{color: "black", backgroundColor: isActive ? "#2d6cdf" : "#d5deee"}}
                    type="button"
                    className={`sidebar-list-item${isActive ? ' active' : ''}`}
                    onClick={() => {
                      setSelected(entry);
                      closeSidebarOnMobile();
                      resetPage();
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
            <h2>Viewing Options</h2>
                  <button
                    style={{color: "black", backgroundColor: replay ? "#2d6cdf" : "#d5deee"}}
                    type="button"
                    className={`sidebar-list-item active`}
                    onClick={startReplay
                    }
                  >
                    <span className="map-name">{!replay ? 'Open Replay Demo' : 'Close Replay Demo'}</span>
                    <span className="map-description" 
                    style={{color: `${replay ? 'white' : 'black'}`}}>To load your own replay, drag and drop the replay file.</span>
                  </button>

                  <button
                    style={{color: "black", backgroundColor: simulationRunning ? (liveMapActive ? "#2d6cdf" : "#d5deee") : "#eed5d5",
                           marginTop: '10px',
                    }}
                    type="button"
                    className={simulationRunning ? `sidebar-list-item active` : "inactive-button"}
                    disabled={!simulationRunning}
                    onClick={liveMapButton}
                  >
                    <span className="map-name">{simulationRunning ? (liveMapActive ? "Close Live Map" : "Open Live Map") : "Simulation not running"}

                    </span>
                    <span className="map-description" 
                    style={{color: `${liveMapActive ? 'white' : 'black'}`}}>
                      {simulationRunning ? "Shows current state of simulator" : "Run EDSim and view the map here."}</span>
                  </button>
          
          {state.kind === 'ready' ? (
            <ParserStats layout={state.layout} />
          ) : null}
          {replay && (
          
          <div className = 'legend'>
            {(replay || liveMapActive) && <PersonaColorLegend />}
          </div>
          )}
          <div className='disclaimer'>
            <h2>Disclaimer</h2>

            <p>This Small ED layout is for illustrative purposes only and doesn't reflect any real-world Emergency Departments. 
              May be subject to change.</p>
          </div>
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
              <button
              style={{padding: '12px',
              backgroundColor: '#c40d0d',
              color: '#ffffff',
              border: '1px solid #530000',
              borderRadius: '6px'
              }}
              onClick={() => {
                resetPage();
              }}>
            Reload Page</button>
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
    {liveMapActive && <div className='overlay-block '>
      <QueryClientProvider client={queryClientDashBoard}>
      
      <LiveDashboard liveDashboardOpen={overlay} onClose={() => setOverlay(false)} />
      </QueryClientProvider>

    </div>}

    {replay && <div className='overlay-block'>

      {replay.Metrics && (
        <MetricsDashboard
          metrics={replay.Metrics}
          open={metricsOpen}
          onClose={() => setMetricsOpen(false)}
          initialTab={metricsRequest.tab}
          facility={replay.metadata?.simulationId}
          mode={dashboardMode}
          currentSimTime={expanded[playback.currentStep]?.simTime}
        />
      )}

    </div>}

    {replay !== null && (
      <PlaybackBar
        ctrl={playback}
        simTime={expanded[playback.currentStep]?.simTime}
      />
    )}
    {liveMapActive && liveState?.meta && (
      <LiveInfoBar
        meta={liveState?.meta}
        step={step}
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

function PersonaColorLegend() {
  return (
    <section data-testid="parser-stats" className="parser-stats">
      <h2>Persona Legend</h2>
      <dl>
        <dt>Doctor</dt>
        <dd> <div style={{"backgroundColor": "#2D6CDF"}}></div></dd>
        <dt>Bedside Nurse</dt>
        <dd> <div style={{"backgroundColor": "#2EA86E"}}></div></dd>
        <dt>Triage Nurse</dt>
        <dd> <div style={{"backgroundColor": "#F2A92F"}}></div></dd>
        <dt>Admission Clerk</dt>
        <dd> <div style={{"backgroundColor": "#8E5BD9"}}></div></dd>
        <dt>Patient</dt>
        <dd> <div style={{"backgroundColor": "#E03B3B"}}></div></dd>
      </dl>
    </section>
  );
}
