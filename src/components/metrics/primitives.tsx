/**
 * Building blocks shared by the metrics dashboard's tabs: the two chart wrappers (the
 * only place that knows how a `ChartSeries` maps onto chart.js), the card and tile
 * frames, and the "how is this computed" control that opens a metric's entry from the
 * Information tab, labelled with the dashboard tab the metric sits on.
 *
 * Styling comes from `MetricsDashboard.css` through the AHS tokens; nothing here
 * hard-codes a colour except through `@/theme/ahs`.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bar, Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { ChartSeries } from '@/replay/metricsSelectors';
import { withAlpha } from '@/replay/metricsSelectors';
import { METHODS } from '@/replay/metricsMethods';
import { ahs } from '@/theme/ahs';

/** Grid lines sit back; the x axis line is a touch stronger so the baseline reads. */
const GRID_COLOR = withAlpha(ahs.dustyGray, 0.35);
const AXIS_COLOR = withAlpha(ahs.dustyGray, 0.6);

export const X_TIME_TITLE = 'Time since run start (h:mm)';

/** A shaded horizontal band behind a line chart: the EDWIN "busy" and "overcrowded" regions. */
export interface ChartBand {
  label: string;
  from: number;
  to: number;
  color: string;
}

/** The band colour is already translucent; use it as given so neighbouring bands read as layers. */
function fillAlpha(color: string): string {
  return color.startsWith('rgba') ? color : withAlpha(color, 0.55);
}

function lineData(series: ChartSeries, stacked: boolean, bands: ChartBand[], length: number): ChartData<'line'> {
  const bandSets = bands.flatMap((band, i) => [
    // The lower edge carries no legend entry; the upper edge fills down to it.
    { label: `__band_floor_${i}`, data: Array<number>(length).fill(band.from), borderColor: 'rgba(0,0,0,0)', backgroundColor: 'rgba(0,0,0,0)', borderWidth: 0, pointRadius: 0, fill: false, order: 100 + i * 2 + 1 },
    { label: band.label, data: Array<number>(length).fill(band.to), borderColor: 'rgba(0,0,0,0)', backgroundColor: band.color, borderWidth: 0, pointRadius: 0, pointStyle: 'rect' as const, fill: '-1' as const, order: 100 + i * 2 },
  ]);
  return {
    labels: series.labels,
    datasets: [
      ...series.datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        borderColor: d.color,
        // Solid, so the legend circle is the line's own colour; a stacked area fills translucent.
        backgroundColor: stacked && d.stack ? fillAlpha(d.color) : d.color,
        borderWidth: d.emphasis ? 3 : stacked && d.stack ? 1 : 2,
        borderDash: d.dashed ? [6, 4] : [],
        pointRadius: 0,
        pointStyle: 'circle' as const,
        tension: 0.2,
        // In a stacked chart each series in the stack fills down to the one below it; a
        // series without a stack (a total, a reference) keeps its own group and stays a line.
        fill: stacked && d.stack ? (i === 0 || !series.datasets[i - 1].stack ? 'origin' : '-1') : false,
        stack: stacked ? d.stack ?? `own-${i}` : undefined,
        order: d.dashed || !d.stack ? 0 : 10,
      })),
      ...bandSets,
    ],
  };
}

/** Drop the invisible band floors from the legend. */
const legendFilter = (item: { text: string }) => !item.text.startsWith('__band_floor_');

function barData(series: ChartSeries): ChartData<'bar'> {
  return {
    labels: series.labels,
    datasets: series.datasets.map((d) => ({
      label: d.label,
      data: d.data,
      // A "dashed" series is a reference level, drawn as a hollow bar.
      backgroundColor: d.dashed ? 'rgba(0, 0, 0, 0)' : withAlpha(d.color, 0.85),
      borderColor: d.color,
      borderWidth: d.dashed ? 2 : 1,
      borderDash: d.dashed ? [6, 4] : [],
      // Rounded tops only on free-standing bars; a rounded segment mid-stack looks broken.
      ...(d.stack ? { stack: d.stack } : { borderRadius: 2 }),
    })),
  };
}

/**
 * chart.js sizes the canvas from its parent element, so each chart gets a parent of its
 * own that never scrolls. In the scrolling panel body, a canvas rounded a fraction of a
 * pixel too wide added scrollbars, which shrank the box, which resized the chart, which
 * removed the scrollbars, and so on: the charts flickered while the window was resized.
 */
function ChartBox({ children }: { children: ReactNode }) {
  return <div className="metrics-chart">{children}</div>;
}

const percentTick =(value: string | number) => `${Math.round(Number(value) * 100)}%`;

export function LineChart({
  series,
  yTitle,
  xTitle = X_TIME_TITLE,
  percent = false,
  max,
  stacked = false,
  bands = [],
  soloLegend = false,
}: {
  series: ChartSeries;
  yTitle: string;
  xTitle?: string;
  percent?: boolean;
  max?: number;
  /** Series with a `stack` id draw as areas stacked on each other; the rest stay lines on top. */
  stacked?: boolean;
  /** Shaded regions behind the lines, lowest first. */
  bands?: ChartBand[];
  /** Clicking a legend entry shows that series alone; clicking it again brings every series back. */
  soloLegend?: boolean;
}) {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: { filter: legendFilter },
        ...(soloLegend
          ? {
              onClick: (_event, item, legend) => {
                const chart = legend.chart;
                const clicked = item.datasetIndex ?? 0;
                const count = chart.data.datasets.length;
                const visible = Array.from({ length: count }, (_, i) => chart.isDatasetVisible(i));
                const alreadyAlone = visible[clicked] && visible.filter(Boolean).length === 1;
                for (let i = 0; i < count; i++) chart.setDatasetVisibility(i, alreadyAlone ? true : i === clicked);
                chart.update();
              },
            }
          : {}),
      },
      tooltip: { filter: (item) => legendFilter({ text: item.dataset.label ?? '' }) && !bands.some((b) => b.label === item.dataset.label) },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: AXIS_COLOR },
        ticks: { autoSkip: true, maxTicksLimit: 12 },
        title: { display: true, text: xTitle, color: ahs.text },
      },
      y: {
        stacked,
        beginAtZero: true,
        ...(max !== undefined ? { max } : {}),
        grid: { color: GRID_COLOR },
        border: { display: false },
        ticks: percent ? { callback: percentTick } : { precision: 0 },
        title: { display: true, text: yTitle, color: ahs.text },
      },
    },
  };
  return (
    <ChartBox>
      <Line data={lineData(series, stacked, bands, series.labels.length)} options={options} />
    </ChartBox>
  );
}

const absTick = (value: string | number) => `${Math.abs(Number(value))}`;

export function BarChart({
  series,
  yTitle,
  stacked = false,
  horizontal = false,
  percent = false,
  diverging = false,
}: {
  series: ChartSeries;
  yTitle: string;
  stacked?: boolean;
  horizontal?: boolean;
  percent?: boolean;
  /** Two series on either side of a shared zero (one passed as negatives); ticks and tooltips show magnitudes. */
  diverging?: boolean;
}) {
  const valueAxis = {
    stacked: stacked || diverging,
    beginAtZero: true,
    ...(percent ? { max: 1 } : {}),
    grid: { color: GRID_COLOR },
    border: { display: false },
    ticks: percent ? { callback: percentTick } : diverging ? { callback: absTick } : {},
    title: { display: true, text: yTitle, color: ahs.text },
  };
  const categoryAxis = { stacked: stacked || diverging, grid: { display: false }, border: { color: AXIS_COLOR } };
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { position: 'bottom', align: 'start' },
      ...(diverging
        ? {
            tooltip: {
              callbacks: {
                label: (item) => `${item.dataset.label}: ${Math.abs(Number(horizontal ? item.parsed.x : item.parsed.y)).toLocaleString()}`,
              },
            },
          }
        : {}),
    },
    scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
  };
  return (
    <ChartBox>
      <Bar data={barData(series)} options={options} />
    </ChartBox>
  );
}

// ─── Info control ──────────────────────────────────────────────────────────────────

/**
 * What an info control opens: the metric's entry, plus the chart's own reading line and
 * any run-specific note the panel wants shown. Nothing about tabs, sections or files is
 * shown here; that provenance lives on the Information tab.
 */
export interface OpenInfo {
  id: string;
  reading?: string;
  note?: ReactNode;
}

const MethodContext = createContext<(info: OpenInfo) => void>(() => undefined);

export function useOpenMethod(): (info: OpenInfo) => void {
  return useContext(MethodContext);
}

/**
 * Hosts the one popover every info control opens into. It renders through a portal on
 * the document body: the dashboard overlay is centred with a CSS transform, and a fixed
 * backdrop inside a transformed ancestor is positioned against that ancestor, so it used
 * to cover only the overlay's box and moved with the overlay's scroll.
 */
export function MethodProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<OpenInfo | null>(null);
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfo(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [info]);
  const entry = info ? METHODS[info.id] : undefined;
  return (
    <MethodContext.Provider value={setInfo}>
      {children}
      {entry &&
        info &&
        createPortal(
          <div className="metrics-method-backdrop" onClick={() => setInfo(null)} data-testid="method-popover">
            <div className="metrics-method" role="dialog" aria-modal="true" aria-label={entry.title} onClick={(e) => e.stopPropagation()}>
              <div className="metrics-method-head">
                <h3 className="metrics-panel-title">{entry.title}</h3>
                <button type="button" className="metrics-close" onClick={() => setInfo(null)} aria-label="Close">
                  ×
                </button>
              </div>
              <dl className="metrics-method-body">
                <dt>What it shows</dt>
                <dd>{entry.computation}</dd>
                <dt>Who is counted</dt>
                <dd>{entry.population}</dd>
                {info.reading && (
                  <>
                    <dt>How to read it</dt>
                    <dd>{info.reading}</dd>
                  </>
                )}
                {info.note && (
                  <>
                    <dt>In this run</dt>
                    <dd>{info.note}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>,
          document.body,
        )}
    </MethodContext.Provider>
  );
}

export function StatusBadge({ status }: { status: 'built' | 'derived' | 'approximate' }) {
  const label = status === 'built' ? 'Built in the engine' : status === 'derived' ? 'Derived in the viewer' : 'Approximation';
  return <span className={`metrics-badge metrics-badge-${status}`}>{label}</span>;
}

export function MethodButton({ id, reading, note }: { id: string; reading?: string; note?: ReactNode }) {
  const open = useOpenMethod();
  if (!METHODS[id]) return null;
  return (
    <button
      type="button"
      className="metrics-info"
      onClick={() => open({ id, reading, note })}
      aria-label={`About ${METHODS[id].title}`}
      title="About this chart"
      data-testid={`method-${id}`}
    >
      i
    </button>
  );
}

// ─── Frames ────────────────────────────────────────────────────────────────────────

export type Tone = 'ok' | 'warn' | 'bad';

/**
 * A headline number. `title` is a short noun phrase (two lines at most in the tile's width),
 * `qualifier` says what the value is of ("median, AHS clock", "21 of 296 who departed"), and
 * `note` carries the context: the tail, the count, the published reference.
 */
export function Tile({
  title,
  value,
  qualifier,
  note,
  method,
  tone,
}: {
  title: string;
  value: string;
  qualifier?: ReactNode;
  note?: ReactNode;
  method?: string;
  tone?: Tone;
}) {
  return (
    <div className={`metrics-tile${tone ? ` metrics-tile-${tone}` : ''}`}>
      <div className="metrics-tile-head">
        <h4 className="metrics-tile-title">{title}</h4>
        {method && <MethodButton id={method} />}
      </div>
      <div className="metrics-tile-value">{value}</div>
      {qualifier && <div className="metrics-tile-qualifier">{qualifier}</div>}
      {note && <div className="metrics-tile-note">{note}</div>}
    </div>
  );
}

/**
 * A chart card. The chart itself carries no text beyond its title: the one-line reading
 * hint (`reading`) and any run-specific note (`note`) open from the title's info control.
 * A panel without an info control shows its note under the body instead, so a status
 * line is never lost.
 */
export function Panel({
  title,
  method,
  header,
  reading,
  note,
  children,
  tall = false,
}: {
  title: string;
  method?: string;
  header?: ReactNode;
  /** How to read the chart, one sentence, shown in the info popover. */
  reading?: string;
  /** Run-specific detail (counts, medians) shown in the info popover. */
  note?: ReactNode;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <section className="metrics-panel">
      <div className="metrics-panel-head">
        <h3 className="metrics-panel-title">
          {title}
          {method && <MethodButton id={method} reading={reading} note={note} />}
        </h3>
        {header}
      </div>
      <div className={`metrics-panel-body${tall ? ' metrics-panel-body-tall' : ''}`}>{children}</div>
      {!method && note && <div className="metrics-panel-foot">{note}</div>}
    </section>
  );
}

/** What a chart shows when its block is missing or empty, in the chart's own box. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="metrics-empty">{children}</div>;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="metrics-row">{children}</div>;
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className="metrics-tiles">{children}</div>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="metrics-caption">{children}</p>;
}

// ─── Formatting ────────────────────────────────────────────────────────────────────

export function hoursLabel(minutes: number | undefined): string {
  if (minutes === undefined || Number.isNaN(minutes)) return '--';
  return `${(minutes / 60).toFixed(1)} h`;
}

export function minutesLabel(minutes: number | undefined, digits = 0): string {
  if (minutes === undefined || Number.isNaN(minutes)) return '--';
  return `${minutes.toFixed(digits)} min`;
}

export function shareLabel(share: number | undefined, digits = 0): string {
  if (share === undefined || Number.isNaN(share)) return '--';
  return `${(share * 100).toFixed(digits)}%`;
}

export function hasAny(series: ChartSeries): boolean {
  return series.datasets.some((d) => d.data.some((v) => Number.isFinite(v) && v !== 0));
}
