import { describe, expect, test } from 'vitest';
import { HOSPITAL_TAB_IDS, METRICS_TABS, REVIEW_TAB_IDS, isMetricsTabId, tabLabel, tabNumber } from '@/replay/metricsTabs';

describe('dashboard tabs', () => {
  test('the numbered tabs follow the recommendations document, 1.1 to 1.8, after the Overview', () => {
    expect(METRICS_TABS[0]).toEqual({ id: 'overview', label: 'Overview' });
    const numbers = METRICS_TABS.slice(1).map((t) => tabNumber(t.id));
    expect(numbers).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8']);
  });

  test('the two dashboard groups split the list without overlap or gaps', () => {
    expect([...HOSPITAL_TAB_IDS, ...REVIEW_TAB_IDS]).toEqual(METRICS_TABS.map((t) => t.id));
    expect(REVIEW_TAB_IDS).toEqual(['compare', 'health', 'method']);
  });

  test('labels and numbers come from the one list', () => {
    expect(tabLabel('bottlenecks')).toBe('1.4 Bottlenecks');
    expect(tabNumber('bottlenecks')).toBe('1.4');
    expect(tabNumber('overview')).toBe('Overview');
    expect(tabLabel('method')).toBe('1.8 Information');
  });

  test('only the ids in the list are tab ids', () => {
    expect(isMetricsTabId('waits')).toBe(true);
    expect(isMetricsTabId('load')).toBe(false);
    expect(isMetricsTabId(null)).toBe(false);
    expect(isMetricsTabId(undefined)).toBe(false);
  });
});
