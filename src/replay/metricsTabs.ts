/**
 * The dashboard's tabs: one list shared by the overlay (which draws the tab strip), the
 * method entries (which say which tab a metric sits on), the Information tab (which
 * groups the entries by tab) and the viewer's `?tab=` link parameter.
 *
 * The numbering follows the recommendations document: 1.1 patient flow, 1.2 waits,
 * 1.3 outcomes, 1.4 bottlenecks, 1.5 staffing, 1.6 scenario comparison, 1.7 simulation
 * health, 1.8 how each number is computed. The viewer's dashboard menu shows the first
 * six as the hospital dashboard and the last three as the run review.
 */
export type MetricsTabId =
  | 'overview'
  | 'flow'
  | 'waits'
  | 'outcomes'
  | 'bottlenecks'
  | 'staffing'
  | 'compare'
  | 'health'
  | 'method';

export const METRICS_TABS: { id: MetricsTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'flow', label: '1.1 Patient flow' },
  { id: 'waits', label: '1.2 Waits' },
  { id: 'outcomes', label: '1.3 Outcomes' },
  { id: 'bottlenecks', label: '1.4 Bottlenecks' },
  { id: 'staffing', label: '1.5 Staffing' },
  { id: 'compare', label: '1.6 Compare runs' },
  { id: 'health', label: '1.7 Run health' },
  { id: 'method', label: '1.8 Information' },
];

/** The hospital dashboard: the department's day. */
export const HOSPITAL_TAB_IDS: readonly MetricsTabId[] = ['overview', 'flow', 'waits', 'outcomes', 'bottlenecks', 'staffing'];
/** The run review: comparing, trusting and understanding a run. */
export const REVIEW_TAB_IDS: readonly MetricsTabId[] = ['compare', 'health', 'method'];

const TAB_IDS = new Set<string>(METRICS_TABS.map((t) => t.id));

export function isMetricsTabId(value: string | null | undefined): value is MetricsTabId {
  return value !== null && value !== undefined && TAB_IDS.has(value);
}

/** The tab's label as the strip shows it ("1.4 Bottlenecks"). */
export function tabLabel(id: MetricsTabId): string {
  return METRICS_TABS.find((t) => t.id === id)?.label ?? id;
}

/** The tab's number alone ("1.4"), or the whole label for the unnumbered Overview. */
export function tabNumber(id: MetricsTabId): string {
  const label = tabLabel(id);
  return /^\d+\.\d+/.exec(label)?.[0] ?? label;
}
