import { useEffect, useRef } from "react";

/**
 * Measures the time between animation frames (ms) into a ref, without re-rendering
 * the component that calls it. `usePersonaPositions` reads the ref when a playback
 * step changes, to advance the walking interpolation.
 *
 * This hook used to force a re-render on every frame as well. Nothing read that tick
 * (the position memo recomputes only when the step changes), but it re-rendered the
 * whole viewer page, 3D scene included, sixty times a second whenever a replay was
 * loaded, paused or not. On a large layout with many personas that is what made
 * moving the map laggy.
 *
 * Pass `enabled = false` to stop the loop; the ref keeps its last value.
 */
export function useAnimationClock(enabled: boolean = false) {
  const dtRef = useRef(0);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Reset lastRef so dt doesn't spike when resumed after a long pause.
      lastRef.current = null;
      return;
    }

    let raf: number;
    const loop = (t: number) => {
      if (lastRef.current != null) {
        dtRef.current = t - lastRef.current;
      }
      lastRef.current = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return dtRef;
}
