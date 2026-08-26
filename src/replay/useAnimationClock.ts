import { useEffect, useRef, useState } from "react";

/**
 * Emits an incrementing tick + delta-time (ms) once per animation frame,
 * decoupled from React state changes like currentStep.
 *
 * Pass `enabled = false` to pause the clock (dtRef.current will stop
 * updating and no re-renders will be triggered until re-enabled).
 */
export function useAnimationClock(enabled: boolean = false) {
  const [, forceRender] = useState(0);
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
      forceRender((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return dtRef;
}