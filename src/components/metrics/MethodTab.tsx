/** 1.6 Information: how each number on the dashboard is computed, grouped by the tab it sits on. */
import { METRICS_TABS } from '@/replay/metricsTabs';
import { methodsForSection } from '@/replay/metricsMethods';
import type { MethodSection } from '@/replay/metricsMethods';
import { Caption, Panel, Row, StatusBadge } from './primitives';

/** The tabs a metric can sit on, in strip order: every tab but this one. */
const SECTIONS = METRICS_TABS.filter((t) => t.id !== 'method') as { id: MethodSection; label: string }[];

const NOT_YET = [
  'Per-test-type turnaround (the engine must persist which tests were ordered)',
  'Nurse zone per tick (exact idle-while-waiting and nurse-to-patient ratio by zone)',
  'Space release and claim events (space turnaround time)',
  'LLM cost by agent role (the gateway must record the calling role)',
  'Wall-clock by engine phase (profiling hooks)',
  'Shift schedules (demand against staffing by hour of day)',
  'The conversation log in the replay (sample conversations per persona)',
];

export function MethodTab() {
  return (
    <>
      <Caption>
        Every tile and chart on the other tabs carries an <span className="metrics-info metrics-info-inline">i</span>{' '}
        control that opens its entry below: the clock start and end, the population, the formula and the file the
        value came from. The entries are grouped by the tab the metric sits on, and the numbers are this dashboard's
        tabs rather than the recommendations document's sections. The same table is the specification for
        reverie/edview_replay/metrics.py, so the dashboard and the engine cannot drift apart.
      </Caption>
      {SECTIONS.map(({ id, label }) => {
        const entries = methodsForSection(id);
        if (!entries.length) return null;
        return (
          <Row key={id}>
            <Panel title={label}>
              <table className="metrics-table metrics-table-method">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Computation</th>
                    <th>Population</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([methodId, m]) => (
                    <tr key={methodId} id={`method-${methodId}`}>
                      <td>{m.title}</td>
                      <td>{m.computation}</td>
                      <td>{m.population}</td>
                      <td>{m.source}</td>
                      <td>
                        <StatusBadge status={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </Row>
        );
      })}
      <Row>
        <Panel
          title="Not measurable yet"
          note="The path from engine file to chart for every metric is written out in docs/metrics-traceability.md, and tools_rebuild/verify_metrics.py recomputes the headline numbers from the raw run files. The replay still carries the boarding and Little's law blocks, which the dashboard no longer draws."
        >
          <ul className="metrics-list">
            {NOT_YET.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      </Row>
    </>
  );
}
