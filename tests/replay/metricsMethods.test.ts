/**
 * The method entries are what the info controls and the Information tab show, so they
 * must name only tabs that exist and cover exactly the metrics the tabs draw.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { METHODS, METHOD_IDS, methodsForSection } from '@/replay/metricsMethods';
import { METRICS_TABS, isMetricsTabId } from '@/replay/metricsTabs';
import { outcomeTiles } from '@/replay/metricsSelectors';
import { METRICS } from './metricsFixture';

const COMPONENTS = fileURLToPath(new URL('../../src/components/metrics/', import.meta.url));

function componentSources(): string[] {
  return readdirSync(COMPONENTS)
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => readFileSync(COMPONENTS + name, 'utf8'));
}

/** Every method id a tab component names in a `method` attribute, plus the tiles' ids. */
function attributeMethodIds(): Set<string> {
  const ids = new Set<string>();
  for (const source of componentSources()) {
    for (const m of source.matchAll(/method="([A-Za-z0-9]+)"/g)) ids.add(m[1]);
    for (const m of source.matchAll(/MethodButton id="([A-Za-z0-9]+)"/g)) ids.add(m[1]);
    // Columns defined as data (the Overview's year grid) name theirs as `method: '...'`.
    for (const m of source.matchAll(/method: '([A-Za-z0-9]+)'/g)) ids.add(m[1]);
  }
  for (const tile of outcomeTiles(METRICS)) ids.add(tile.method);
  return ids;
}

describe('method entries', () => {
  test('every entry sits on a tab that exists, and never on the Information tab itself', () => {
    for (const [id, entry] of Object.entries(METHODS)) {
      expect(isMetricsTabId(entry.section), id).toBe(true);
      expect(entry.section, id).not.toBe('method');
    }
  });

  test('every numbered tab explains its own metrics; the Overview only repeats theirs', () => {
    for (const tab of METRICS_TABS) {
      if (tab.id === 'method') continue;
      if (tab.id === 'overview') {
        expect(methodsForSection('overview')).toEqual([]);
        continue;
      }
      expect(methodsForSection(tab.id).length, tab.id).toBeGreaterThan(0);
    }
  });

  test('the tabs open only entries that exist', () => {
    for (const id of attributeMethodIds()) expect(METHOD_IDS, id).toContain(id);
  });

  test('every entry is opened by some tab, so none describes a metric no longer shown', () => {
    // The Run health tab picks its ids in code (`methodFor`), so look for the quoted id
    // anywhere in the tab sources, not only in `method="..."` attributes.
    const sources = componentSources().join('\n');
    const tileIds = new Set(outcomeTiles(METRICS).map((t) => t.method));
    for (const id of METHOD_IDS) {
      const quoted = new RegExp(`['"]${id}['"]`);
      expect(tileIds.has(id) || quoted.test(sources), id).toBe(true);
    }
  });
});
