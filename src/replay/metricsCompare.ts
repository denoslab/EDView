/**
 * Scenario comparison (recommendations document 1.6): the headline metrics of a run,
 * and the AHS annual-report change legend applied to a pair of them.
 *
 * The legend: a relative change of 3% or more in the desirable direction is an
 * improvement, less than 3% either way is stable, 3% or more the other way is a
 * deterioration. The desired direction is down for every time and rate metric except
 * the shares (seen within target, triaged within 10 min, discharged within 4 h, admitted
 * within 8 h), where it is up.
 */
import type { ReplayMetrics } from './types';
import { ahs } from '../theme/ahs';
import { peakCensus } from './metricsSelectors';
import { pooledMean } from './metricsDerived';
import type { MetricsTabId } from './metricsTabs';

export type Direction = 'down' | 'up';
export type BandKind = 'improvement' | 'stable' | 'deterioration' | 'none';
export type Unit = 'min' | 'share' | 'count' | 'index' | 'usd';

export const CHANGE_THRESHOLD = 0.03;

export interface ChangeBand {
  kind: BandKind;
  /** (current - baseline) / baseline; absent when either side is missing or baseline is 0. */
  relative?: number;
  delta?: number;
}

export function changeBand(current: number | undefined, baseline: number | undefined, direction: Direction): ChangeBand {
  if (current === undefined || baseline === undefined || Number.isNaN(current) || Number.isNaN(baseline)) {
    return { kind: 'none' };
  }
  const delta = current - baseline;
  if (baseline === 0) {
    if (delta === 0) return { kind: 'stable', delta };
    return { kind: (delta < 0) === (direction === 'down') ? 'improvement' : 'deterioration', delta };
  }
  const relative = delta / Math.abs(baseline);
  if (Math.abs(relative) < CHANGE_THRESHOLD) return { kind: 'stable', relative, delta };
  const desirable = direction === 'down' ? relative < 0 : relative > 0;
  return { kind: desirable ? 'improvement' : 'deterioration', relative, delta };
}

export const BAND_COLORS: Record<BandKind, string> = {
  improvement: ahs.green,
  stable: ahs.dustyGray,
  deterioration: ahs.red,
  none: ahs.line,
};

export interface HeadlineMetric {
  key: string;
  label: string;
  value?: number;
  unit: Unit;
  direction: Direction;
  n?: number;
  /** The dashboard tab that shows the number; absent for one the replay carries but no tab draws. */
  section?: MetricsTabId;
}

/** The headline metrics of one run, in the order the comparison table shows them. */
export function headlineMetrics(metrics: ReplayMetrics): HeadlineMetric[] {
  const within = Object.values(metrics.compliance.withinCtasTarget).filter((c) => c.share !== undefined);
  const seen = within.reduce((s, c) => s + c.n, 0);
  const seenWithin = within.reduce((s, c) => s + (c.share ?? 0) * c.n, 0);
  const departed = metrics.cohort.completed + metrics.cohort.lwbs;
  const stay = pooledMean(metrics.stageWaits.lengthOfStay);
  const doorToDoctor = pooledMean(metrics.stageWaits.doorToDoctor);
  const edwin = metrics.series.edwin;
  const starvation = Object.values(metrics.starvationByZone ?? {});
  const list: HeadlineMetric[] = [
    { key: 'ahsWaitMedian', label: 'ED wait time to see a doctor, median (AHS clock)', value: metrics.ahs?.waitToSeeDoctor.median, n: metrics.ahs?.waitToSeeDoctor.n, unit: 'min', direction: 'down', section: 'waits' },
    { key: 'ahsWaitP90', label: 'ED wait time to see a doctor, 90th percentile', value: metrics.ahs?.waitToSeeDoctor.p90, n: metrics.ahs?.waitToSeeDoctor.n, unit: 'min', direction: 'down', section: 'waits' },
    { key: 'ahsAdmittedMedian', label: 'Total time in ED, admitted, median (AHS clock)', value: metrics.ahs?.admittedTotalTime.median, n: metrics.ahs?.admittedTotalTime.n, unit: 'min', direction: 'down', section: 'outcomes' },
    { key: 'doorToDoctorMean', label: 'Arrival to physician, mean (all levels)', value: doorToDoctor.mean, n: doorToDoctor.n, unit: 'min', direction: 'down', section: 'waits' },
    { key: 'stayMean', label: 'Total time in ED, mean (completed visits)', value: stay.mean, n: stay.n, unit: 'min', direction: 'down', section: 'outcomes' },
    { key: 'seenWithinTarget', label: 'Seen within CTAS target (CTAS 2-5)', value: seen > 0 ? seenWithin / seen : undefined, n: seen, unit: 'share', direction: 'up', section: 'overview' },
    { key: 'triagedWithin10', label: 'Triaged within 10 minutes', value: metrics.compliance.triagedWithin10?.share, n: metrics.compliance.triagedWithin10?.n, unit: 'share', direction: 'up', section: 'waits' },
    { key: 'dischargedWithin4h', label: 'Discharged within 4 h', value: metrics.compliance.dischargedWithin4h.share, n: metrics.compliance.dischargedWithin4h.n, unit: 'share', direction: 'up', section: 'overview' },
    { key: 'admittedWithin8h', label: 'Admitted within 8 h', value: metrics.compliance.admittedWithin8h.share, n: metrics.compliance.admittedWithin8h.n, unit: 'share', direction: 'up', section: 'outcomes' },
    { key: 'lwbsRate', label: 'Left without being seen', value: departed > 0 ? metrics.cohort.lwbs / departed : undefined, n: departed, unit: 'share', direction: 'down', section: 'flow' },
    { key: 'peakCensus', label: 'Peak census', value: peakCensus(metrics).value, unit: 'count', direction: 'down', section: 'flow' },
    { key: 'edwinMean', label: 'EDWIN, mean over the run', value: edwin && edwin.length ? edwin.reduce((a, b) => a + b, 0) / edwin.length : undefined, unit: 'index', direction: 'down', section: 'bottlenecks' },
    { key: 'nurseStarved', label: 'Nurse-starved minutes, all zones', value: starvation.length ? starvation.reduce((s, z) => s + z.nurseStarvedMinutes, 0) : undefined, unit: 'min', direction: 'down', section: 'staffing' },
    { key: 'bedStarved', label: 'Bed-starved minutes, all zones', value: starvation.length ? starvation.reduce((s, z) => s + z.bedStarvedMinutes, 0) : undefined, unit: 'min', direction: 'down', section: 'staffing' },
    { key: 'costUsd', label: 'LLM cost (USD)', value: metrics.runHealth?.costUsd, unit: 'usd', direction: 'down', section: 'health' },
  ];
  return list;
}

export interface CompareRow extends HeadlineMetric {
  baseline?: number;
  baselineN?: number;
  band: ChangeBand;
}

/** Every headline metric of `current` beside the same metric of `baseline`, with its band. */
export function compareRows(current: ReplayMetrics, baseline: ReplayMetrics): CompareRow[] {
  const base = new Map(headlineMetrics(baseline).map((m) => [m.key, m]));
  return headlineMetrics(current).map((m) => {
    const b = base.get(m.key);
    return { ...m, baseline: b?.value, baselineN: b?.n, band: changeBand(m.value, b?.value, m.direction) };
  });
}

/** A replay's identity line for the comparison header. */
export function runLabel(metrics: ReplayMetrics, fallback: string): string {
  const health = metrics.runHealth;
  if (!health) return fallback;
  const parts = [health.scenarioFamily, health.template, health.seed !== null && health.seed !== undefined ? `seed ${health.seed}` : undefined].filter(Boolean);
  return parts.length ? parts.join(' · ') : fallback;
}

/** Whether two runs can be compared honestly: same family, same seed, same ablation flags. */
export function pairingWarnings(current: ReplayMetrics, baseline: ReplayMetrics): string[] {
  const a = current.runHealth;
  const b = baseline.runHealth;
  const warnings: string[] = [];
  if (!a || !b) {
    warnings.push('One of the runs carries no run-health block, so the pairing cannot be checked.');
    return warnings;
  }
  if (a.scenarioFamily !== b.scenarioFamily) warnings.push('The runs come from different scenario families.');
  if (String(a.seed) !== String(b.seed)) warnings.push('The runs use different seeds, so they did not see the same arrivals.');
  const flags = (h: typeof a) => JSON.stringify(h.channelFlags ?? {});
  if (flags(a) !== flags(b)) warnings.push('The LLM ablation flags differ; metrics from an ablated run must not be compared with a full run.');
  if (a.useLlm !== b.useLlm) warnings.push('One run had the LLM switched off.');
  return warnings;
}
