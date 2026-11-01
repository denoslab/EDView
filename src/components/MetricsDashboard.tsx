/**
 * `MetricsDashboard` — the replay-mode metrics overlay: the ED Flow Dashboard.
 *
 * Two dashboards share this overlay. Department overview holds Overview, 1.1 Patient
 * flow, 1.2 Waits and 1.3 Occupancy and load; Run review holds 1.4 Compare runs, 1.5 Run
 * health and 1.6 Information. The numbering is the dashboard's own (`@/replay/metricsTabs`):
 * the recommendations document's 1.3 outcomes, 1.4 bottlenecks and 1.5 staffing were cut
 * down to the one 1.3 tab, so everything after it moved up. Each tab renders the replay's
 * `Metrics` object (reverie/edview_replay/metrics.py) through the pure selectors under
 * `@/replay/metrics*`; the chart.js mapping lives in `./metrics/primitives.tsx`.
 *
 * Styling follows the AHS brand tokens (`@/theme/ahs-tokens.css`; sources in
 * docs/ahs-brand-standards.md): Public Sans, AHS Dark Blue headings, white cards with a
 * round-cornered 1px rule on the AHS light band, view tabs as outlined buttons filled
 * Dark Blue when active. The chart.js presentation defaults come from
 * `@/theme/chartTheme`, imported first so they apply before any chart mounts.
 *
 * Open/close follows `LiveDashboard`: the component stays mounted through the pop
 * animation and unmounts when it ends.
 */
import '@/theme/chartTheme';
import './MetricsDashboard.css';
import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ReplayMetrics } from '@/replay/types';
import { MethodProvider } from './metrics/primitives';
import { OverviewTab } from './metrics/OverviewTab';
import { FlowTab } from './metrics/FlowTab';
import { WaitsTab } from './metrics/WaitsTab';
import { OutcomesTab } from './metrics/OutcomesTab';
import { BottlenecksTab } from './metrics/BottlenecksTab';
import { StaffingTab } from './metrics/StaffingTab';
import { CompareTab } from './metrics/CompareTab';
import { HealthTab } from './metrics/HealthTab';
import { MethodTab } from './metrics/MethodTab';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
);

import { HOSPITAL_TAB_IDS, METRICS_TABS, REVIEW_TAB_IDS } from '@/replay/metricsTabs';
import type { MetricsTabId } from '@/replay/metricsTabs';

// The tab list lives in `@/replay/metricsTabs` so the method entries and the link
// parameter share it; re-exported here for the viewer, which imports them from this file.
export { METRICS_TABS, isMetricsTabId, REVIEW_TAB_IDS } from '@/replay/metricsTabs';
export type { MetricsTabId } from '@/replay/metricsTabs';

const GENERAL_TAB_IDS = new Set<MetricsTabId>(HOSPITAL_TAB_IDS);
const PERFORMANCE_TAB_IDS = new Set<MetricsTabId>(REVIEW_TAB_IDS);

export default function MetricsDashboard({
  metrics,
  open,
  onClose,
  initialTab = 'overview',
  facility,
  mode = 'general',
  currentSimTime,
}: {
  metrics: ReplayMetrics;
  open: boolean;
  onClose?: () => void;
  initialTab?: MetricsTabId;
  /** The playback clock, in the engine's "%B %d, %Y, %H:%M:%S" format; the 1.4 queue board follows it. */
  currentSimTime?: string;
  /** The facility name is data, not branding: shown beside the title when known. */
  facility?: string;
  /** Which dashboard group is visible. */
  mode?: 'general' | 'performance';
}) {
  const [renderComponent, setRenderComponent] = useState(open);
  const [tab, setTab] = useState<MetricsTabId>(initialTab);

  const visibleTabs = METRICS_TABS.filter((item) =>
    mode === 'general'
      ? GENERAL_TAB_IDS.has(item.id)
      : PERFORMANCE_TAB_IDS.has(item.id),
  );

  const defaultTab: MetricsTabId = mode === 'general' ? 'overview' : 'compare';
  const initialTabIsVisible =
    mode === 'general'
      ? GENERAL_TAB_IDS.has(initialTab)
      : PERFORMANCE_TAB_IDS.has(initialTab);
  const activeTab =
    mode === 'general'
      ? (GENERAL_TAB_IDS.has(tab) ? tab : defaultTab)
      : (PERFORMANCE_TAB_IDS.has(tab) ? tab : defaultTab);

  useEffect(() => {
    if (open) {
      setRenderComponent(true);
    }
  }, [open]);

  useEffect(() => {
    setTab(initialTabIsVisible ? initialTab : defaultTab);
  }, [initialTab, initialTabIsVisible, defaultTab]);

  const handleAnimationEnd = () => {
    if (!open) {
      setRenderComponent(false);
    }
  };

  if (!renderComponent) {
    return null;
  }

  return (
    <div
      className={`overlay-div metrics-overlay ${open ? 'is-entering' : 'is-leaving'}`}
      onAnimationEnd={handleAnimationEnd}
      data-testid="metrics-dashboard"
    >
      <MethodProvider>
        <header className="metrics-header">
          <div className="metrics-title-block">
            <h2 className="metrics-title">
              {mode === 'general' ? 'Department Overview' : 'Run Review'}
            </h2>
            {facility && <span className="metrics-subtitle">{facility}</span>}
          </div>
          <nav className="metrics-tabs" aria-label="Dashboard sections" data-testid="metrics-tabs">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`metrics-tab${activeTab === t.id ? ' is-active' : ''}`}
                aria-pressed={activeTab === t.id}
                onClick={() => setTab(t.id)}
                data-testid={`metrics-tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {/* Reserved for the AHS logo, which AHS supplies on request; nothing is embedded. */}
          <div className="metrics-logo-slot" aria-hidden="true" data-testid="metrics-logo-slot" />
          {onClose && (
            <button type="button" className="metrics-close" onClick={onClose} aria-label="Close the dashboard" data-testid="metrics-close">
              ×
            </button>
          )}
        </header>

        <div className="metrics-body" data-testid={`metrics-tab-panel-${activeTab}`}>
          {activeTab === 'overview' && <OverviewTab metrics={metrics} />}
          {activeTab === 'flow' && <FlowTab metrics={metrics} />}
          {activeTab === 'waits' && <WaitsTab metrics={metrics} />}
          {activeTab === 'outcomes' && <OutcomesTab metrics={metrics} />}
          {activeTab === 'bottlenecks' && <BottlenecksTab metrics={metrics} currentSimTime={currentSimTime} />}
          {activeTab === 'staffing' && <StaffingTab metrics={metrics} />}
          {activeTab === 'compare' && <CompareTab metrics={metrics} />}
          {activeTab === 'health' && <HealthTab metrics={metrics} />}
          {activeTab === 'method' && <MethodTab />}
        </div>
      </MethodProvider>
    </div>
  );
}
