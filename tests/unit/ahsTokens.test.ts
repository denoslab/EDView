/**
 * The AHS token layer has two copies of every primitive (CSS custom properties for
 * stylesheets, a TypeScript object for chart.js). These tests keep the two honest and
 * pin the shape the dashboard relies on.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ahs, ahsSemantic, ahsSeries, ctasColors } from '@/theme/ahs';

const HEX = /^#[0-9a-f]{6}$/;
const palette = new Set<string>(Object.values(ahs));

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function camel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

describe('AHS tokens', () => {
  it('every primitive and semantic value is a lowercase 6-digit hex', () => {
    for (const value of Object.values(ahs)) expect(value).toMatch(HEX);
    for (const value of Object.values(ahsSemantic)) expect(value).toMatch(HEX);
  });

  it('semantic tokens resolve to palette values', () => {
    for (const value of Object.values(ahsSemantic)) expect(palette.has(value)).toBe(true);
  });

  it('the series palette is five high-contrast brand colours, unique, led by the main two', () => {
    expect(ahsSeries.length).toBe(5);
    expect(ahsSeries.slice(0, 2)).toEqual([ahs.blue, ahs.green]);
    expect(new Set(ahsSeries).size).toBe(ahsSeries.length);
    for (const value of ahsSeries) expect(palette.has(value)).toBe(true);
  });

  it('CTAS colours cover levels 1-5 with distinct palette values', () => {
    expect(Object.keys(ctasColors).sort()).toEqual(['1', '2', '3', '4', '5']);
    const values = Object.values(ctasColors);
    expect(new Set(values).size).toBe(5);
    for (const value of values) expect(palette.has(value)).toBe(true);
  });

  it('mirrors ahs-tokens.css exactly, in both directions', () => {
    const css = readFileSync(fileURLToPath(new URL('../../src/theme/ahs-tokens.css', import.meta.url)), 'utf8');
    const fromCss = new Map<string, string>();
    for (const m of css.matchAll(/--ahs-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/g)) fromCss.set(m[1], m[2]);
    expect(fromCss.size).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(ahs)) {
      expect(fromCss.get(kebab(key)), `--ahs-${kebab(key)}`).toBe(value);
    }
    for (const name of fromCss.keys()) {
      expect(ahs, `ahs.${camel(name)}`).toHaveProperty(camel(name));
    }
  });
});
