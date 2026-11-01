// @vitest-environment jsdom
/**
 * The animation clock measures frame time into a ref and must not re-render its host:
 * a forced render per frame re-rendered the whole viewer page while a replay was
 * loaded, which made the map laggy.
 */
import { act, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAnimationClock } from '@/replay/useAnimationClock';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let host: HTMLDivElement;
let root: Root | undefined;
let renders = 0;
let seen: MutableRefObject<number> | undefined;

function Host({ enabled }: { enabled: boolean }) {
  renders += 1;
  const dtRef = useAnimationClock(enabled);
  const keep = useRef(dtRef);
  seen = keep.current;
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  host = document.createElement('div');
  document.body.appendChild(host);
  renders = 0;
  seen = undefined;
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host.remove();
  vi.useRealTimers();
});

describe('useAnimationClock', () => {
  test('measures frame time without re-rendering its host', () => {
    root = createRoot(host);
    act(() => root!.render(<Host enabled />));
    expect(renders).toBe(1);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(renders).toBe(1);
    expect(seen!.current).toBeGreaterThan(0);
  });

  test('does nothing while disabled', () => {
    root = createRoot(host);
    act(() => root!.render(<Host enabled={false} />));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(renders).toBe(1);
    expect(seen!.current).toBe(0);
  });
});
