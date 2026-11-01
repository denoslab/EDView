import { describe, expect, test } from 'vitest';
import { callsByChannelChart, chunkCostChart, fallbackRate, fallbackRows, formatSeconds, formatUsd, runCardRows, runHealthTiles } from '@/replay/metricsHealth';
import { METRICS, OLD_METRICS } from './metricsFixture';

describe('1.7 run health', () => {
  test('formatting', () => {
    expect(formatUsd(0.0057)).toBe('$0.0057');
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatSeconds(8.2)).toBe('8.2 s');
    expect(formatSeconds(125)).toBe('2 min 5 s');
    expect(formatSeconds(7260)).toBe('2 h 1 min');
    expect(formatSeconds(null)).toBe('--');
  });

  test('fallback rate is fallbacks over calls', () => {
    expect(fallbackRate(METRICS.runHealth!)).toEqual({ fallbacks: 1, calls: 8, rate: 0.125 });
    const rows = fallbackRows(METRICS);
    expect(rows).toEqual([{ key: 'test_ordering:schema', channel: 'Test ordering', category: 'schema', count: 1, rate: 0.5 }]);
  });

  test('tiles lead with validity and carry cost per patient and per hour', () => {
    const tiles = runHealthTiles(METRICS);
    expect(tiles[0]).toMatchObject({ title: 'Run validity', value: 'Valid', tone: 'ok' });
    const cost = tiles.find((t) => t.title === 'LLM cost')!;
    expect(cost.value).toBe('$0.0114');
    expect(cost.note).toContain('$0.0019 per enrolled patient');
    expect(cost.note).toContain('$0.0057 per simulated hour');
    expect(tiles.find((t) => t.title === 'Fallback rate')).toMatchObject({ value: '12.5%', tone: 'bad' });
    expect(tiles.find((t) => t.title === 'Wall clock')!.note).toContain('60× real time');
  });

  test('a run without a summary is flagged, and one without the block has no tiles', () => {
    const noSummary = { ...METRICS, runHealth: { ...METRICS.runHealth!, runValid: undefined } };
    expect(runHealthTiles(noSummary)[0]).toMatchObject({ value: 'No summary', tone: 'warn' });
    expect(runHealthTiles(OLD_METRICS)).toEqual([]);
  });

  test('charts and the run card', () => {
    expect(callsByChannelChart(METRICS).labels).toEqual(['Test ordering', 'Next-patient selection (triage)']);
    const chunks = chunkCostChart(METRICS);
    expect(chunks.labels).toEqual(['Chunk 0', 'Chunk 1']);
    expect(chunks.datasets[1].data).toEqual([0.005, 0.0114]);
    const card = Object.fromEntries(runCardRows(METRICS).map((r) => [r.label, r.value]));
    expect(card['Seed']).toBe('7501');
    expect(card['LLM channels']).toBe('dialogue: on · selection: on · test ordering: on');
    expect(card['Physicians']).toBe('2 (limit 4 patients each)');
    expect(runCardRows(OLD_METRICS).map((r) => r.label)).toEqual(['Physicians', 'Bedside nurses', 'Triage nurses', 'Clerks', 'Axis']);
  });
});
