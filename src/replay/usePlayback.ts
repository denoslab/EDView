import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackSpeed = 1 | 4 | 16 | 64;

export interface PlaybackController {
  currentStep: number;
  interpAlpha: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  play: () => void;
  pause: () => void;
  setSpeed: (s: PlaybackSpeed) => void;
  seek: (step: number) => void;
}

export function usePlayback(opts: {
  totalSteps: number;
  secPerStep: number;
}): PlaybackController {
  const [currentStep, setCurrentStep] = useState(0);
  const [interpAlpha, setInterpAlpha] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(4);

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  // Track the fractional position independently to avoid calling setState
  // inside another setState updater (which is a React anti-pattern and may
  // cause updates to be silently dropped in React 18 concurrent mode).
  const fractionalStepRef = useRef<number>(0);

  // Keep a ref to opts so tick doesn't need to be recreated on every opts change.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Keep a ref to speed so tick doesn't need to be recreated on every speed change.
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const tick = useCallback((now: number) => {
    if (lastTickRef.current === null) lastTickRef.current = now;
    const dtSec = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;

    const { totalSteps, secPerStep } = optsRef.current;
    const stepsAdvanced = 4 * (dtSec * speedRef.current) / secPerStep;

    const prevFrac = fractionalStepRef.current;
    let nextFrac = prevFrac + stepsAdvanced;
    const max = totalSteps - 1;

    let stopped = false;
    if (nextFrac >= max) {
      nextFrac = max;
      stopped = true;
    }

    fractionalStepRef.current = nextFrac;
    const intStep = Math.floor(nextFrac);
    const alpha = nextFrac - intStep;

    setCurrentStep(intStep);
    setInterpAlpha(alpha);

    if (stopped) {
      setIsPlaying(false);
      return; // don't schedule another frame
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []); // stable callback — reads all mutable values from refs

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  return {
    currentStep,
    interpAlpha,
    totalSteps: opts.totalSteps,
    isPlaying,
    speed,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    setSpeed,
    seek: (step: number) => {
      const clamped = Math.max(0, Math.min(opts.totalSteps - 1, Math.floor(step)));
      fractionalStepRef.current = clamped;
      setCurrentStep(clamped);
      setInterpAlpha(0);
    },
  };
}
