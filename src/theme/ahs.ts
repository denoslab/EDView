/**
 * Alberta Health Services (AHS) brand tokens, mirrored from `ahs-tokens.css` for code
 * that cannot read CSS custom properties (chart.js datasets, canvas drawing).
 *
 * Every primitive's camelCase key is its CSS name without the `--ahs-` prefix:
 * `darkBlue` is `--ahs-dark-blue`. `tests/unit/ahsTokens.test.ts` asserts the two files
 * agree, so change a value in both places or the suite fails.
 *
 * Values: AHS Brand Toolkit, May 2024, p.37 (main colours) and p.38 (secondary palette).
 * The web neutrals are what albertahealthservices.ca uses, not part of the printed
 * palette. Sources and contrast figures: docs/ahs-brand-standards.md.
 */
export const ahs = {
  // Main corporate colours
  blue: '#005cb9',
  green: '#009d4e',
  black: '#000000',
  white: '#ffffff',
  // Secondary palette: blues
  cyan: '#00adbb',
  teal: '#008995',
  darkBlue: '#005d85',
  dustyTeal: '#9abaae',
  smokyTeal: '#4c7e70',
  // Secondary palette: greens
  lightGreen: '#a2d45e',
  limeGreen: '#b8be14',
  darkGreen: '#789c4a',
  khaki: '#c6c89c',
  darkKhaki: '#888e64',
  // Secondary palette: yellows
  yellow: '#ffc743',
  darkYellow: '#eba900',
  orange: '#e18534',
  // Secondary palette: greys
  dustyGray: '#a2a9ad',
  darkGray: '#5b6671',
  // Secondary palette: mauves
  dustyMauve: '#c1a4b7',
  darkMauve: '#6b3a5d',
  // Secondary palette: reds and pinks (AHS Red is an action colour, used sparingly)
  red: '#c23b33',
  lightPink: '#eebec9',
  darkPink: '#e56385',
  // Web neutrals observed on albertahealthservices.ca
  text: '#333333',
  textMuted: '#575757',
  band: '#f1f1f1',
  line: '#cccccc',
} as const;

export type AhsColorName = keyof typeof ahs;

/** The same mapping as the semantic custom properties in `ahs-tokens.css`. */
export const ahsSemantic = {
  surface: ahs.white,
  surfaceAlt: ahs.band,
  border: ahs.line,
  borderStrong: ahs.darkGray,
  heading: ahs.darkBlue,
  link: ahs.darkBlue,
  accent: ahs.orange,
  accentText: ahs.black,
  focus: ahs.blue,
  primary: ahs.blue,
  positive: ahs.green,
  urgent: ahs.red,
  text: ahs.text,
  textMuted: ahs.textMuted,
} as const;

export const ahsFont = {
  family: "'Public Sans', Arial, Helvetica, sans-serif",
} as const;

/**
 * Ordered categorical palette for charts: the two main corporate colours first, then
 * the three secondary values with the most contrast against them and each other
 * (Dark Blue 7.2:1 on white, Orange as the one accent, Dark Gray 5.9:1). Five is the
 * most a legend can carry before neighbours blur; a chart with more series groups them
 * (stacked areas) or pairs a colour with its 45% tint (`withAlpha`). Every entry is a
 * brand colour; see docs/ahs-brand-standards.md section 7.3.
 */
export const ahsSeries: readonly string[] = [
  ahs.blue,
  ahs.green,
  ahs.darkBlue,
  ahs.orange,
  ahs.darkGray,
];

/** A total or reference drawn over coloured series. */
export const ahsTotal = ahs.black;

export type CtasLevel = '1' | '2' | '3' | '4' | '5';

/**
 * The CTAS colour code (1 blue, 2 red, 3 yellow, 4 green, 5 white) on brand values; Dusty
 * Gray stands in for white so level 5 shows on a white card. Fixed per level, never
 * positional.
 */
export const ctasColors: Record<CtasLevel, string> = {
  '1': ahs.blue,
  '2': ahs.red,
  '3': ahs.darkYellow,
  '4': ahs.green,
  '5': ahs.dustyGray,
};

/** `#rrggbb` to `rgba(r, g, b, alpha)`; anything else is returned unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
