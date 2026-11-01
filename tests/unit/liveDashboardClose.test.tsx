// @vitest-environment jsdom
/**
 * The dashboard picker only opens the live dashboard, so the overlay must be able to
 * close itself: from its own button and from the Escape key, in the waiting state too.
 * Rendered with React's own `act` rather than a testing library, which this package
 * does not carry.
 */
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import LiveDashboard from '@/components/LiveDashboard';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let host: HTMLDivElement;
let root: Root | undefined;

function mount(ui: ReactElement) {
  root = createRoot(host);
  act(() => root!.render(ui));
}

function withClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // No simulator answers in the test, so the component stays in its waiting state.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no simulator'))));
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host.remove();
  vi.unstubAllGlobals();
});

describe('LiveDashboard close control', () => {
  test('the close button calls onClose while the dashboard is still waiting for data', () => {
    const onClose = vi.fn();
    mount(withClient(<LiveDashboard liveDashboardOpen onClose={onClose} />));
    expect(host.textContent).toContain('Waiting for simulation data');
    const button = host.querySelector<HTMLButtonElement>('[data-testid="live-dashboard-close"]');
    expect(button).not.toBeNull();
    act(() => button!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape closes it too', () => {
    const onClose = vi.fn();
    mount(withClient(<LiveDashboard liveDashboardOpen onClose={onClose} />));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('a closed dashboard ignores Escape, and without onClose there is no button', () => {
    const onClose = vi.fn();
    mount(withClient(<LiveDashboard liveDashboardOpen={false} onClose={onClose} />));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => root!.unmount());
    root = undefined;

    mount(withClient(<LiveDashboard liveDashboardOpen />));
    expect(host.querySelector('[data-testid="live-dashboard-close"]')).toBeNull();
  });
});
