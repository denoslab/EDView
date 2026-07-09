/**
 * Unit tests for the special-block CSV decoders.
 */

import { describe, expect, it } from 'vitest';
import {
  parseArenaBlocksCSV,
  parseGameObjectBlocksCSV,
  parseSpawningBlocksCSV
} from '@/parser/csv';

describe('parseArenaBlocksCSV', () => {
  it('decodes the canonical seed file', () => {
    const raw =
     'waiting room, triage room, major injuries zone\n';
    const rows = parseArenaBlocksCSV(raw);
    expect(rows).toEqual([
      { zoneLabels: ['waiting room', 'triage room', 'major injuries zone'] }

    ]);
  });

  it('strips trailing whitespace', () => {
    const raw =
      '        waiting room, triage room, major injuries zone      \n';
    const rows = parseArenaBlocksCSV(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ zoneLabels: ['waiting room', 'triage room', 'major injuries zone'] });
  });

  it('throws when a row is too short', () => {
    expect(() => parseArenaBlocksCSV(" ")).toThrow(

    );
  });
});

describe('parseGameObjectBlocksCSV', () => {
  it('decodes the canonical seed file', () => {
    const raw =
      'bed, medical equipment, chair\n';
    const rows = parseGameObjectBlocksCSV(raw);
    expect(rows).toEqual([
      { objectLabels: ['bed', 'medical equipment', 'chair'] }

    ]);
  });
});

describe('parseSpawningBlocksCSV', () => {
  it('decodes the canonical seed file with slot labels', () => {
    const raw =
      '1291, ed map, emergency department, diagnostic room, sp-A\n' +
      '1304, ed map, emergency department, triage room, sp-A\n';
    const rows = parseSpawningBlocksCSV(raw);
    expect(rows).toEqual([
      { tileId: 1291, zoneLabel: 'diagnostic room', slot: 'sp-A' },
      { tileId: 1304, zoneLabel: 'triage room', slot: 'sp-A' }
    ]);
  });

  it('throws when the slot column is missing', () => {
    expect(() =>
      parseSpawningBlocksCSV('1291, ed map, emergency department, diagnostic room')
    ).toThrow(/at least 5 cells/);
  });
});
