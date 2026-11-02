/**
 * The Overview's year-against-run grid: the year figures as yearReference.json carries
 * them, this run's value for each headline measure, and how far apart the two are.
 */
import { describe, expect, test } from 'vitest';
import {
  HEADLINE_KEYS,
  HEADLINE_KINDS,
  YEAR_REFERENCE,
  eipChart,
  eipSummary,
  headlineLabel,
  headlineValues,
  yearDeltaLabel,
} from '@/replay/metricsDerived';
import { METRICS, OLD_METRICS } from './metricsFixture';

describe('year reference', () => {
  test('names every headline measure, and every figure says where it came from', () => {
    expect(Object.keys(YEAR_REFERENCE).sort()).toEqual([...HEADLINE_KEYS].sort());
    for (const key of HEADLINE_KEYS) {
      const year = YEAR_REFERENCE[key];
      if (!year) continue;
      for (const field of ['stat', 'scope', 'cite', 'source'] as const) expect(year[field], `${key}.${field}`).not.toBe('');
      if (HEADLINE_KINDS[key] === 'share') expect(year.value, key).toBeGreaterThanOrEqual(0);
      if (HEADLINE_KINDS[key] === 'share') expect(year.value, key).toBeLessThanOrEqual(1);
      if (HEADLINE_KINDS[key] === 'minutes') expect(year.value, key).toBeGreaterThan(0);
    }
  });
});

describe('this run', () => {
  test('each headline measure in the unit its year figure uses', () => {
    const run = headlineValues(METRICS);
    expect(run.waitToSeeDoctor.value).toBe(42.5);
    expect(run.admittedTotalTime.value).toBe(375);
    // CTAS 2 (n 2, share 0) and 3 (n 2, share 0.5) pool to 1 of 4.
    expect(run.withinTarget).toMatchObject({ value: 0.25, qualifier: 'of 4 who reached a physician' });
    expect(run.lwbs).toMatchObject({ value: 0.25, qualifier: '1 of 4 who departed' });
    expect(run.admitted.value).toBeCloseTo(1 / 3);
    expect(run.dischargedWithin4h.value).toBe(1);
    expect(run.admittedWithin8h.value).toBe(1);
    expect(run.eip).toMatchObject({ value: 0.4, max: 2, note: 'max 2 at once, 1:50 after the start' });
  });

  test('a replay without the EIP series says so rather than showing zero', () => {
    expect(eipSummary(OLD_METRICS)).toEqual({});
    expect(headlineValues(OLD_METRICS).eip.value).toBeUndefined();
    expect(headlineValues(OLD_METRICS).eip.note).toMatch(/built before the EIP series/);
    expect(eipChart(OLD_METRICS).datasets).toEqual([]);
    expect(eipChart(METRICS).datasets[0].data).toBe(METRICS.series.eip);
  });

  test('no patient leaves the time measures empty, not zero', () => {
    const empty = { ...METRICS, ahs: { waitToSeeDoctor: { n: 0 }, admittedTotalTime: { n: 0 } } };
    expect(headlineValues(empty).waitToSeeDoctor.value).toBeUndefined();
    expect(headlineLabel('minutes', headlineValues(empty).waitToSeeDoctor.value)).toBe('--');
  });
});

describe('labels', () => {
  const year = (value: number) => ({ value, stat: 'median', scope: 'Calgary Zone', cite: 'AHS 2024-25', source: 'test' });

  test('values print in hours, percent or a one-decimal count', () => {
    expect(headlineLabel('minutes', 156)).toBe('2.6 h');
    expect(headlineLabel('share', 0.04)).toBe('4%');
    expect(headlineLabel('count', 11.63)).toBe('11.6');
    expect(headlineLabel('count', undefined)).toBe('--');
  });

  test('the distance from the year is in the measure’s own unit, signed', () => {
    expect(yearDeltaLabel('minutes', 42.5, year(156))).toBe('−1.9 h vs year');
    expect(yearDeltaLabel('minutes', 180, year(156))).toBe('+0.4 h vs year');
    expect(yearDeltaLabel('share', 0.07, year(0.04))).toBe('+3 pts vs year');
    expect(yearDeltaLabel('count', 9, year(11.5))).toBe('−2.5 vs year');
  });

  test('a gap that rounds away reads as the same, and a missing side gives no label', () => {
    expect(yearDeltaLabel('share', 0.043, year(0.04))).toBe('same as year');
    expect(yearDeltaLabel('minutes', 158, year(156))).toBe('same as year');
    expect(yearDeltaLabel('share', undefined, year(0.04))).toBeUndefined();
    expect(yearDeltaLabel('share', 0.07, null)).toBeUndefined();
  });
});
