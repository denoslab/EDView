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
import {expandFrames, expandLiveFrame } from '@/replay/expandFrames';
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

  useEffect(()=> {
    const fetchSimulationState = () =>{
      isSimulationUp().then((result) => {
      console.log("Simulation Running",result);
      setSimulationRunning(result);})
    }
    fetchSimulationState(); // Initial call
    const interval = setInterval(fetchSimulationState, 5000);
    return () => clearInterval(interval);
  });

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
        .then((replay) => {loadReplay(replay)})


  });

  const loadReplay = (currentReplay: ReplayFile) => {
    
    setReplay(currentReplay)
    if(currentReplay.mapLayout){
      loadReplayLayout(selected.load, currentReplay.mapLayout).then((layout) => {      
        setState({ kind: 'ready', layout, playbackType: "replay" });
      });
    }

  };

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
  const [liveDashboardOpen, setLiveDashboard] = useState(false);
  const queryClientDashBoard = new QueryClient();

  const liveState = useLiveMovement(liveMapActive, step, setStep);
  const liveFrame = useMemo(
    () => (liveState ? expandLiveFrame(liveState, step) : []),
    [liveState,step],
  );

  const currentExpanded = state.kind === "ready" 
  ? (state.playbackType === "replay" ? expanded : liveFrame) 
  : [];

    // Dashboard
    const dashboardRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // 3. Function to check if the click was outside
        function handleClickOutside(event: MouseEvent) {
          // If the ref exists and the clicked element is NOT inside the ref
            if (dashboardRef.current && !dashboardRef.current.contains(event.target as Node)) {
                setLiveDashboard(false); // Close the menu

            }
        }
        // 2. Add the event listener to the document when the component mounts
        if (liveDashboardOpen) {
          document.addEventListener('mousedown', handleClickOutside);
        }
  
        // 4. Clean up the event listener when the component unmounts or closes
        return () => {

          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [liveDashboardOpen]); // Only re-run the effect if isOpen changes
  


  // 1. Memoize the configuration object so it only changes when values actually change
  const personaOptions = useMemo(() => ({
    expanded: currentExpanded,
    personas: replay?.personas ?? [],
    currentStep: playback.currentStep,
    interpAlpha: playback.interpAlpha,
    collisionMask: state.kind === 'ready' ? state.layout.collisionMask : [],
    playbackType: state.kind === 'ready' ? state.playbackType : ""
  }), [currentExpanded, step, replay, state, playback.currentStep]);

  // 2. Pass the memoized object to your hook
  const personas = usePersonaPositions(personaOptions);

  function resetPage() {
    setLiveMapActive(false);
    setReplay(null);
    setLiveDashboard(false);
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

       

        {liveMapActive && (<button
          className='top-bar-button'
          data-testid="load-live-map"
          onClick={(e) =>{
            e.stopPropagation();
            setLiveDashboard(!liveDashboardOpen);
            setIsSidebarOpen(false);
          }
        }
          style={{
            position: "absolute",
            right: 16,
            
          }}
        >
          Toggle Dashboard
        </button>
        )}
        {state.kind === "error" && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5',
          borderRadius: '6px',

        }}>
          <strong>Error:</strong> There is no simulation running
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
                    className={`map-list-item${isActive ? ' active' : ''}`}
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
            <h2></h2>
                  <button
                    style={{color: "black", backgroundColor: replay ? "#2d6cdf" : "#d5deee"}}
                    type="button"
                    className={`map-list-item active`}
                    onClick={() =>{
                        if(!replay){
                        resetPage();
                        loadReplayFromUrl(`${import.meta.env.BASE_URL}replays/small_ed_demo.json`)
                        .then((replay) => { loadReplay(replay)})
                        }
                        else{
                          resetPage();
                        }
                      }
                    }
                  >
                    <span className="map-name">{!replay ? 'Open Replay Demo' : 'Close Replay Demo'}</span>
                    <span className="map-description" 
                    style={{color: `${replay ? 'white' : 'black'}`}}>To load your own demo, drag and drop the replay file</span>
                  </button>

                  <h2></h2>
                  <button
                    style={{color: "black", backgroundColor: liveMapActive ? "#2d6cdf" : "#d5deee"}}
                    type="button"
                    className={`map-list-item active`}
                    onClick={() =>{
                      if(!liveMapActive){
                        setLiveMapActive(!liveMapActive)

                        startLiveMap().then((initial) => {
                          loadReplayLayout(selected.load, initial.mapLayout).then((layout) => {
                            setState({ kind: 'ready', layout, playbackType: "live" });
                            setStep(initial.step - 1);
                          })
                        })
                        .catch((error) => {
                            // Handle the error here
                            console.error("Failed to load live map:", error);
                            setState({ kind: 'error', mapId: "live-map", error: "Simulation Not Running" });
                          })
                      }
                      else{
                        loadMap();
                        setLiveMapActive(!liveMapActive)
                        setLiveDashboard(false);
                        console.log("base")
                      }
                    }
                    }
                  >
                    <span className="map-name">{liveMapActive ? "Close Live Map" : "Open Live Map"}

                    </span>
                    <span className="map-description" 
                    style={{color: `${liveMapActive ? 'white' : 'black'}`}}>
                      {simulationRunning ? "Shows current state of simulator" : "Run EDSim to see a live map of the simulaiton"}</span>
                  </button>
          {state.kind === 'ready' ? (
            <ParserStats layout={state.layout} />
          ) : null}
          {replay && (
          
          <div className = 'legend'>
            {replay && <PersonaColorLegend />}
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
 <div className='liveDashboard' style={{

    }}>
      <QueryClientProvider client={queryClientDashBoard}>
      <LiveDashboard liveDashboardOpen={liveDashboardOpen}
      
      />
    </QueryClientProvider>
    </div>

    {replay !== null && (
      <PlaybackBar
        ctrl={playback}
        simTime={expanded[playback.currentStep]?.simTime}
      />
    )}
    {liveMapActive && (
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
        <dt>Patient</dt>
        <dd> <div style={{"backgroundColor": "#E03B3B"}}></div></dd>
      </dl>
    </section>
  );
}
