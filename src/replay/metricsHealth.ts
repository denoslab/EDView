/**
 * Simulation health (recommendations document 1.7): whether the run can be trusted and
 * what it cost, from the replay's `runHealth` block.
 */
import type { MetricsRunHealth, ReplayMetrics } from './types';
import { ahs, ahsSeries } from '../theme/ahs';
import type { ChartSeries } from './metricsSelectors';

/** The engine's LLM channels in the words the recommendations document uses. */
export const CHANNEL_LABELS: Record<string, string> = {
  triage_work_plan: 'Next-patient selection (triage)',
  clinical_work_plan: 'Next-patient selection (clinical)',
  test_ordering: 'Test ordering',
  personality: 'Dialogue and persona',
  dialogue: 'Dialogue',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel.replace(/_/g, ' ');
}

export interface HealthTile {
  title: string;
  value: string;
  note?: string;
  /** Set when the tile carries a judgement: ok, warn or bad. */
  tone?: 'ok' | 'warn' | 'bad';
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '--';
  // A fake-gateway or short run costs fractions of a cent; keep four decimals under a dollar.
  return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--';
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${s} s`;
}

/** Fallbacks across every channel and category divided by every call. */
export function fallbackRate(health: MetricsRunHealth): { fallbacks: number; calls: number; rate?: number } {
  const fallbacks = Object.values(health.fallbacks).reduce((a, b) => a + b, 0);
  const calls = Object.values(health.callsByChannel).reduce((a, b) => a + b, 0);
  return { fallbacks, calls, rate: calls > 0 ? fallbacks / calls : undefined };
}

export function runHealthTiles(metrics: ReplayMetrics): HealthTile[] {
  const health = metrics.runHealth;
  if (!health) return [];
  const { fallbacks, calls, rate } = fallbackRate(health);
  const perPatient = metrics.cohort.enrolled > 0 ? health.costUsd / metrics.cohort.enrolled : undefined;
  const perHour = health.simulatedHours > 0 ? health.costUsd / health.simulatedHours : undefined;
  const tiles: HealthTile[] = [
    { title: 'LLM cost', value: formatUsd(health.costUsd), note: `${formatUsd(perPatient)} per enrolled patient · ${formatUsd(perHour)} per simulated hour` },
    { title: 'Tokens', value: `${(health.tokens.prompt + health.tokens.completion).toLocaleString()}`, note: `${health.tokens.prompt.toLocaleString()} prompt · ${health.tokens.completion.toLocaleString()} completion` },
    { title: 'LLM calls', value: `${calls}`, note: `${health.latency.meanSeconds.toFixed(2)} s mean · ${health.latency.maxSeconds.toFixed(2)} s max` },
    {
      title: 'Fallback rate',
      value: rate === undefined ? '--' : `${(rate * 100).toFixed(1)}%`,
      note: `${fallbacks} fallbacks · ${health.transportRetries} transport retries`,
      tone: rate === undefined ? undefined : rate === 0 ? 'ok' : rate < 0.05 ? 'warn' : 'bad',
    },
    {
      title: 'Wall clock',
      value: formatSeconds(health.wallClockSeconds),
      note: [
        health.speedFactor !== undefined ? `${health.speedFactor.toFixed(0)}× real time over ${health.simulatedHours} simulated h` : `${health.simulatedHours} simulated h`,
        // A run left open before its save shows the gap here rather than in the headline.
        health.elapsedSeconds !== undefined && health.elapsedSeconds > health.wallClockSeconds * 1.5
          ? `${formatSeconds(health.elapsedSeconds)} from boot to save`
          : undefined,
      ].filter(Boolean).join(' · '),
    },
    {
      title: 'Quiet fraction',
      value: health.quietFraction === null ? '--' : `${(health.quietFraction * 100).toFixed(0)}%`,
      note: 'Steps in which nobody needed any work',
    },
  ];
  if (health.runValid !== undefined) {
    tiles.unshift({
      title: 'Run validity',
      value: health.runValid ? 'Valid' : 'Not valid',
      note: health.runValid ? `Ended: ${health.terminationReason ?? 'unknown'}` : (health.invalidReasons ?? []).join('; ') || health.terminationReason || 'see run_summary.json',
      tone: health.runValid ? 'ok' : 'bad',
    });
  } else {
    tiles.unshift({
      title: 'Run validity',
      value: 'No summary',
      note: 'The run has no run_summary.json: it did not reach a termination marker (a step-limited run).',
      tone: 'warn',
    });
  }
  return tiles;
}

export function callsByChannelChart(metrics: ReplayMetrics): ChartSeries {
  const calls = metrics.runHealth?.callsByChannel ?? {};
  const channels = Object.keys(calls).sort();
  return {
    labels: channels.map(channelLabel),
    datasets: [{ label: 'Calls', data: channels.map((c) => calls[c]), color: ahs.blue }],
  };
}

/** Cost per chunk and the cumulative total. */
export function chunkCostChart(metrics: ReplayMetrics): ChartSeries {
  const chunks = metrics.runHealth?.chunks ?? [];
  let running = 0;
  const cumulative = chunks.map((c) => (running += c.costUsd));
  return {
    labels: chunks.map((c, i) => `Chunk ${c.index === null || c.index < 0 ? i + 1 : c.index}`),
    datasets: [
      { label: 'Cost in chunk (USD)', data: chunks.map((c) => c.costUsd), color: ahs.blue },
      { label: 'Cumulative (USD)', data: cumulative, color: ahs.orange, dashed: true },
    ],
  };
}

export interface FallbackRow {
  key: string;
  channel: string;
  category: string;
  count: number;
  rate?: number;
}

/** Fallbacks per channel and category with the rate over that channel's calls. */
export function fallbackRows(metrics: ReplayMetrics): FallbackRow[] {
  const health = metrics.runHealth;
  if (!health) return [];
  return Object.entries(health.fallbacks)
    .map(([key, count]) => {
      const [channel, category = ''] = key.split(':');
      const calls = health.callsByChannel[channel] ?? 0;
      return { key, channel: channelLabel(channel), category, count, rate: calls > 0 ? count / calls : undefined };
    })
    .sort((a, b) => b.count - a.count);
}

export interface RunCardRow {
  label: string;
  value: string;
}

/** The run card: scenario, template, map, seed, staffing, limits and the ablation flags. */
export function runCardRows(metrics: ReplayMetrics): RunCardRow[] {
  const health = metrics.runHealth;
  const staff = metrics.staff;
  const rows: RunCardRow[] = [];
  if (health) {
    rows.push({ label: 'Scenario family', value: health.scenarioFamily ?? '--' });
    rows.push({ label: 'Template', value: health.template ?? '--' });
    rows.push({ label: 'Map', value: health.map ?? '--' });
    rows.push({ label: 'Seed', value: health.seed === null || health.seed === undefined ? '--' : String(health.seed) });
    rows.push({ label: 'Chat model', value: health.chatModel ?? '--' });
    const observed = Object.entries(health.observedModels);
    if (observed.length) rows.push({ label: 'Observed response models', value: observed.map(([m, n]) => `${m} (${n})`).join(', ') });
    rows.push({ label: 'LLM', value: health.useLlm ? 'on' : 'off' });
    if (health.channelFlags) {
      rows.push({
        label: 'LLM channels',
        value: Object.entries(health.channelFlags).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v ? 'on' : 'off'}`).join(' · '),
      });
    }
    if (health.dialogueMode) rows.push({ label: 'Dialogue mode', value: health.dialogueMode });
    if (health.runPurpose) rows.push({ label: 'Run purpose', value: `${health.runPurpose}${health.analysisEligible === false ? ' (not analysis-eligible)' : ''}` });
  }
  rows.push({ label: 'Physicians', value: `${staff.doctors} (limit ${staff.doctorMaxPatients} patients each)` });
  rows.push({ label: 'Bedside nurses', value: `${staff.bedsideNurses}` });
  rows.push({ label: 'Triage nurses', value: `${staff.triageNurses}` });
  rows.push({ label: 'Clerks', value: `${staff.clerks}` });
  rows.push({ label: 'Axis', value: `${metrics.axis.t0} to ${metrics.axis.tEnd} (${metrics.axis.hours} h)` });
  return rows;
}

/** Colour per channel, stable across charts. */
export function channelColor(index: number): string {
  return ahsSeries[index % ahsSeries.length];
}
