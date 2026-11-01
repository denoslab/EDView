/** 1.5 Staffing and resource utilization: where would one more nurse, physician or space help most? */
import { useMemo } from 'react';
import type { ReplayMetrics } from '@/replay/types';
import {
  clerkLoadChart,
  nurseStateBars,
  nurseStateBarsChart,
  nurseUtilization,
  physicianPickupRows,
  physicianPickupsByHourChart,
  triageClerkLoad,
  triageLoadChart,
  zoneNeedShareChart,
  zoneNeeds,
  zoneOccupancyShareChart,
} from '@/replay/metricsDerived';
import { BarChart, Empty, LineChart, Panel, Row, Tile, Tiles, hasAny, hoursLabel, minutesLabel, shareLabel } from './primitives';

export function StaffingTab({ metrics }: { metrics: ReplayMetrics }) {
  const needs = useMemo(() => zoneNeeds(metrics), [metrics]);
  const needShare = useMemo(() => zoneNeedShareChart(metrics), [metrics]);
  const nurses = useMemo(() => nurseUtilization(metrics), [metrics]);
  const nurseBars = useMemo(() => nurseStateBarsChart(metrics), [metrics]);
  const nurseRanges = useMemo(() => nurseStateBars(metrics), [metrics]);
  const pickupsByHour = useMemo(() => physicianPickupsByHourChart(metrics), [metrics]);
  const pickups = useMemo(() => physicianPickupRows(metrics), [metrics]);
  const load = useMemo(() => triageClerkLoad(metrics), [metrics]);
  const triage = useMemo(() => triageLoadChart(metrics), [metrics]);
  const clerk = useMemo(() => clerkLoadChart(metrics), [metrics]);
  const occupancy = useMemo(() => zoneOccupancyShareChart(metrics), [metrics]);

  return (
    <>
      <Tiles>
        <Tile title="Bedside nurse utilization" value={shareLabel(nurses.team)} qualifier={`of ${metrics.staff.bedsideNurses} nurses' minutes tied to a patient`} method="nurseUtilization" />
        <Tile title="Triage nurse utilization" value={shareLabel(load.triage.utilization)} qualifier={`${load.triage.staff} triage nurses`} note={`${minutesLabel(load.triage.minutes)} of triage in the day`} method="triageClerkLoad" />
        <Tile title="Clerk utilization" value={shareLabel(load.clerk.utilization)} qualifier={load.clerk.staff > 0 ? `${load.clerk.staff} clerks` : 'No clerk staffed'} note={load.clerk.staff > 0 ? `${minutesLabel(load.clerk.minutes)} of registration in the day` : undefined} method="triageClerkLoad" />
        <Tile title="Physicians" value={`${metrics.staff.doctors}`} qualifier="on duty all day" note={`limit ${metrics.staff.doctorMaxPatients} patients each`} method="physicianLoad" />
      </Tiles>
      <Row>
        <Panel
          title="What each zone needs, and why"
          method="starvation"
          reading="For every patient sent to a zone, the hours they waited for a space are split by cause: no space was free, or a space was free but no nurse could take them. The larger cause is the need, and the last column says why that answer follows and what would not help. Hours per patient compares zones of different size."
        >
          {needs.length ? (
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Patients</th>
                  <th>Waited for a space</th>
                  <th>Per patient</th>
                  <th>Needs</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {needs.map((r) => (
                  <tr key={r.zone}>
                    <td>{r.label}</td>
                    <td>{r.n}</td>
                    <td>{hoursLabel(r.totalHours * 60)}</td>
                    <td>{minutesLabel(r.hoursPerPatient * 60)}</td>
                    <td>{r.needs}</td>
                    <td>{r.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Not in this replay.</Empty>
          )}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Why each zone waits: share of its waiting with no space free"
          method="starvation"
          reading="Each bar is one zone's waiting for a space split into its two causes. A bar that is mostly orange needs a space; a bar that is mostly green needs a nurse. The Overview shows the same hours as absolute amounts."
        >
          {hasAny(needShare) ? <BarChart series={needShare} yTitle="Share of the zone's waiting" stacked horizontal percent /> : <Empty>No time lost waiting for a space.</Empty>}
        </Panel>
        <Panel
          title="The average bedside nurse's day"
          method="nurseUtilization"
          reading="Mean minutes per state across all bedside nurses, largest first, with each state's share of the day in its label. The note gives the spread between the least and most loaded nurse. The simulation records totals per nurse, not a minute-by-minute trace, so this is the day's split rather than a curve."
          note={
            nurseRanges.length
              ? `Spread across nurses: ${nurseRanges.map((r) => `${r.label} ${Math.round(r.min)} to ${Math.round(r.max)} min`).join(' · ')}. Team utilization ${shareLabel(nurses.team)}.`
              : undefined
          }
        >
          {hasAny(nurseBars) ? <BarChart series={nurseBars} yTitle="Minutes of the day" horizontal /> : <Empty>No bedside-nurse ledger in this replay.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Patients picked up per physician, by hour"
          method="physicianLoad"
          reading="One line per physician, busiest first. Click a physician in the legend to see that line alone; click it again to bring the others back. The Overview shows the load each physician carried."
          note={pickups.length ? `Over the day: ${pickups.map((r) => `${r.name} ${r.count} (${shareLabel(r.share)}, ${r.perHour.toFixed(1)} an hour)`).join(' · ')}` : undefined}
        >
          {pickupsByHour.datasets.length ? (
            <LineChart series={pickupsByHour} yTitle="Patients picked up" xTitle="Simulated hour" soloLegend />
          ) : (
            <Empty>Pickups by hour are not in this replay; rebuild it with reverie/build_edview_replay.py.</Empty>
          )}
        </Panel>
        <Panel
          title="Occupancy by zone (share of usable spaces)"
          method="zoneOccupancy"
          reading="One line per zone; a zone riding the dashed line is full. Zones that are full all day while others have room are where the space constraint sits."
        >
          {occupancy.datasets.length ? <LineChart series={occupancy} yTitle="Share of usable spaces" xTitle="Bed snapshot (time since the start)" percent max={1} /> : <Empty>No bed-occupancy snapshots in this replay.</Empty>}
        </Panel>
      </Row>
      <Row>
        <Panel
          title="Triage nurse load"
          method="triageClerkLoad"
          reading="Queue stacked on service: when the waiting band dwarfs the in-triage band, triage is the constraint."
        >
          <LineChart series={triage} yTitle="Patients" stacked />
        </Panel>
        <Panel title="Clerk load" method="triageClerkLoad" reading="Queue stacked on service, read the same way as triage.">
          {hasAny(clerk) ? <LineChart series={clerk} yTitle="Patients" stacked /> : <Empty>No registration in this run.</Empty>}
        </Panel>
      </Row>
    </>
  );
}
