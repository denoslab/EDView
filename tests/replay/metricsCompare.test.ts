import { describe, expect, test } from 'vitest';
import { changeBand, compareRows, headlineMetrics, pairingWarnings, runLabel } from '@/replay/metricsCompare';
import { METRICS, OLD_METRICS } from './metricsFixture';

describe('changeBand', () => {
  test('applies the 3% legend in the desired direction', () => {
    expect(changeBand(97, 100, 'down').kind).toBe('improvement');
    expect(changeBand(98, 100, 'down').kind).toBe('stable');
    expect(changeBand(103, 100, 'down').kind).toBe('deterioration');
    expect(changeBand(103, 100, 'up').kind).toBe('improvement');
    expect(changeBand(0.5, 0.52, 'up').kind).toBe('deterioration');
  });

  test('is none without both sides and handles a zero baseline', () => {
    expect(changeBand(undefined, 100, 'down').kind).toBe('none');
    expect(changeBand(5, undefined, 'down').kind).toBe('none');
    expect(changeBand(0, 0, 'down')).toEqual({ kind: 'stable', delta: 0 });
    expect(changeBand(2, 0, 'down').kind).toBe('deterioration');
    expect(changeBand(2, 0, 'up').kind).toBe('improvement');
  });
});

describe('headline metrics and comparison', () => {
  test('the headline list carries the AHS measures, shares and cost with their direction', () => {
    const list = Object.fromEntries(headlineMetrics(METRICS).map((m) => [m.key, m]));
    expect(list.ahsWaitMedian).toMatchObject({ value: 42.5, n: 4, unit: 'min', direction: 'down' });
    expect(list.seenWithinTarget).toMatchObject({ value: 0.25, n: 4, direction: 'up' });
    expect(list.lwbsRate).toMatchObject({ value: 0.25, n: 4 });
    expect(list.peakCensus.value).toBe(3);
    expect(list.bedStarved.value).toBe(94);
    expect(list.costUsd.value).toBe(0.0114);
  });

  test('an older replay leaves the derivable rows undefined rather than failing', () => {
    const list = Object.fromEntries(headlineMetrics(OLD_METRICS).map((m) => [m.key, m]));
    expect(list.ahsWaitMedian.value).toBeUndefined();
    expect(list.nurseStarved.value).toBeUndefined();
    expect(list.peakCensus.value).toBe(3);
  });

  test('compareRows pairs each metric with the baseline and bands it', () => {
    const rows = compareRows(METRICS, METRICS);
    expect(rows.every((r) => r.band.kind === 'stable' || r.band.kind === 'none')).toBe(true);
    const faster = { ...METRICS, ahs: { ...METRICS.ahs!, waitToSeeDoctor: { n: 4, median: 30, p90: 50, mean: 32 } } };
    const row = compareRows(faster, METRICS).find((r) => r.key === 'ahsWaitMedian')!;
    expect(row.baseline).toBe(42.5);
    expect(row.band.kind).toBe('improvement');
    expect(row.band.relative).toBeCloseTo(-0.294, 3);
  });

  test('pairing warnings name a different seed or ablation', () => {
    expect(pairingWarnings(METRICS, METRICS)).toEqual([]);
    const other = { ...METRICS, runHealth: { ...METRICS.runHealth!, seed: 7502, channelFlags: { dialogue: false, selection: true, test_ordering: true } } };
    const warnings = pairingWarnings(METRICS, other);
    expect(warnings.some((w) => /seed/.test(w))).toBe(true);
    expect(warnings.some((w) => /ablation/.test(w))).toBe(true);
    expect(pairingWarnings(METRICS, OLD_METRICS)[0]).toMatch(/run-health/);
    expect(runLabel(METRICS, 'x')).toBe('fam_dev_small · small_ed_n5 · seed 7501');
    expect(runLabel(OLD_METRICS, 'x')).toBe('x');
  });
});
