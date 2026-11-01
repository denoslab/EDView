/**
 * Applies the AHS brand to chart.js's global defaults, once. Import it for its side
 * effect before any chart mounts:
 *
 *   import '@/theme/chartTheme';
 *
 * Only presentation defaults are set here (font, text colour, grid colour, legend
 * swatches, tooltip). Dataset colours stay with each chart. `Chart.defaults` is
 * process-global, so every chart in the app inherits the font and grid treatment.
 *
 * Legends draw one filled circle per series in the series' own colour. A series whose
 * fill is translucent (a stacked area, a bar at 85%) would otherwise show a washed-out
 * swatch beside a solid line; the label generator below fills every swatch with the
 * series' border colour, and a dashed reference series keeps a dashed line swatch so it
 * reads as a reference rather than a measurement.
 */
import { Chart } from 'chart.js';
import type { LegendItem } from 'chart.js';
import { ahs, ahsFont, withAlpha } from './ahs';

Chart.defaults.font.family = ahsFont.family;
Chart.defaults.font.size = 12;
Chart.defaults.color = ahs.textMuted;
Chart.defaults.borderColor = withAlpha(ahs.dustyGray, 0.35);

const defaultGenerateLabels = Chart.defaults.plugins.legend.labels.generateLabels;

Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.legend.labels.generateLabels = (chart) =>
  defaultGenerateLabels(chart).map((item: LegendItem) => {
    // Datasets of any chart type pass through here, so read the two styling fields loosely.
    const dataset = (item.datasetIndex !== undefined ? chart.data.datasets[item.datasetIndex] : undefined) as
      | { borderColor?: unknown; borderDash?: unknown }
      | undefined;
    const stroke = typeof dataset?.borderColor === 'string' ? dataset.borderColor : undefined;
    const dashed = Array.isArray(dataset?.borderDash) && dataset.borderDash.length > 0;
    if (dashed) {
      return { ...item, pointStyle: 'line', lineDash: [4, 3], lineWidth: 2, strokeStyle: stroke ?? item.strokeStyle };
    }
    return { ...item, fillStyle: stroke ?? item.fillStyle, strokeStyle: stroke ?? item.strokeStyle, lineWidth: 0 };
  });

Chart.defaults.plugins.tooltip.backgroundColor = ahs.darkGray;
Chart.defaults.plugins.tooltip.titleColor = ahs.white;
Chart.defaults.plugins.tooltip.bodyColor = ahs.white;
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.plugins.tooltip.padding = 8;
Chart.defaults.plugins.tooltip.titleFont = { weight: 'bold' };
Chart.defaults.plugins.tooltip.usePointStyle = true;
