import React, { useState, useEffect, useRef } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {useQuery} from '@tanstack/react-query';

import { LiveSimulationData } from '@/LiveDashboard/types'; // assuming types are saved in types.ts

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS modules globally
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Color palette matching your original setup
const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#6baed6', '#fd8d3c'
];

const STATE_ORDER = [
  'WAITING_FOR_TRIAGE', 'TRIAGE', 'WAITING_FOR_NURSE',
  'WAITING_FOR_FIRST_ASSESSMENT', 'WAITING_FOR_TEST', 'GOING_FOR_TEST',
  'WAITING_FOR_RESULT', 'WAITING_FOR_DOCTOR', 'WAITING_FOR_EXIT',
  'ADMITTED_BOARDING', 'DISCHARGED_WAITING', 'LEAVING'
];

// Helper to format labels
const shortLabel = (s:String) => s.replace(/WAITING_FOR_/g, 'Wait ').replace(/_/g, ' ').replace('GOING FOR ', 'Going ');

export default function LiveDashboard({ liveDashboardOpen }: { liveDashboardOpen:boolean }) {

  const [renderComponent, setRenderComponent] = useState(liveDashboardOpen);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if(liveDashboardOpen){
      setRenderComponent(true);
    }
  }, [liveDashboardOpen]);

  const handleAnimationEnd = () => {
    if (!liveDashboardOpen) {
      setRenderComponent(false); // Completely unmount after slide-out finishes
    }
  };

  const [data, setData] = useState<LiveSimulationData | null>(null); 


  async function fetchData()  {
    const res = await fetch('http://localhost:5000/live_dashboard/')
    if (!res.ok) {
        throw new Error("Failed to fetch info")
        };
      
    return res.json();

  };

  const query = useQuery({
      queryKey: ['liveData'],
      queryFn: () => fetchData(),
      refetchInterval:  1000, 
      enabled: liveDashboardOpen,
  });

  useEffect(() => {
    if(query.isSuccess){
      console.log("Data Updated")
      setData(query.data)
    }
  }, [query]);

  if(renderComponent == false){
    return null;
  }
  
  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', fontSize: '18px', color: '#888', marginTop: '45px' }}>
        Waiting for simulation data...
      </div>
    );
  }


  // --- 1. Map Patient States Data ---
  const stateLabels:String[] = [];
  const stateCounts:Number[] = [];
  const patientStates = data.patient_states || {};

  STATE_ORDER.forEach((s) => {
    if (patientStates[s] > 0) {
      stateLabels.push(shortLabel(s));
      stateCounts.push(patientStates[s]);
    }
  });
  Object.keys(patientStates).forEach((s) => {
    if (!STATE_ORDER.includes(s) && patientStates[s] > 0) {
      stateLabels.push(shortLabel(s));
      stateCounts.push(patientStates[s]);
    }
  });

  const chartStatesData = {
    labels: stateLabels,
    datasets: [{ label: 'Patients', data: stateCounts, backgroundColor: COLORS }]
  };

  // --- 2. Map Zone Occupancy Data ---
  const zoneOccupancy = data.zone_occupancy || {};
  const zoneLabels = Object.keys(zoneOccupancy);
  const zoneCur = zoneLabels.map(z => zoneOccupancy[z].current);
  const zoneCap = zoneLabels.map(z => zoneOccupancy[z].capacity);

  const chartZonesData = {
    labels: zoneLabels,
    datasets: [
      { label: 'Occupied', data: zoneCur, backgroundColor: '#4e79a7' },
      { label: 'Capacity', data: zoneCap, backgroundColor: '#ddd' }
    ]
  };

  // --- 3. Map Queue Sizes Data ---
  const queues = data.queues || {};
  const chartQueuesData = {
    labels: ['Triage', 'Bedside Nurse', 'Pager (CTAS 1)', 'Doctor Global'],
    datasets: [{
      label: 'Waiting',
      data: [queues.triage, queues.bedside_nurse_waiting, queues.pager, queues.doctor_global],
      backgroundColor: ['#f28e2b', '#e15759', '#76b7b2', '#59a14f']
    }]
  };

  // --- 4. Map Nurse Utilization Data ---
  const nurseStatus = data.nurse_status || {};

// Cast 'k' as keyof typeof nurseStatus when accessing the value
  const nurseLabels = (Object.keys(nurseStatus) as Array<keyof typeof nurseStatus>)
    .filter((k) => nurseStatus[k] && nurseStatus[k]! > 0);

  const nurseData = nurseLabels.map((k) => nurseStatus[k]!);
  const chartNursesData = {
    labels: nurseLabels,
    datasets: [{ data: nurseData, backgroundColor: ['#59a14f', '#4e79a7', '#f28e2b', '#edc948', '#bab0ac'] }]
  };

  // --- 5. Map Doctor Load Data ---
  const doctorAssigned = data.doctor_assigned || {};
  const doctorLabels = Object.keys(doctorAssigned).sort();
  const doctorData = doctorLabels.map(k => doctorAssigned[k]);
  const maxP = data.doctor_max_patients || 5;

  const chartDoctorsData = {
    labels: doctorLabels,
    datasets: [{ label: 'Assigned', data: doctorData, backgroundColor: '#4e79a7' }]
  };

  // --- 6. Table Parsing ---
  const stages = data.completed_stages || [];
  const tableColumns = stages.length > 0 ? Object.keys(stages[0]) : [];

  return (
    <div ref={dashboardRef} className={`overlay-div ${liveDashboardOpen ? 'is-entering' : 'is-leaving'}`} style={{ width: '90%', fontFamily: 'sans-serif' }}
      onAnimationEnd={handleAnimationEnd}>
      
      {/* Top Cards Row */}
      <div className="row" style={{ display: 'flex', gap: '15px', marginBottom: '18px' }}>
        <Card title="Sim Time" value={data.sim_time} />
        <Card title="Step" value={`${data.step}`} />
        <Card title="In ED Now" value={`${data.current_patients}`} />
        <Card title="Completed" value={`${data.completed}`} />
      </div>

      {/* Middle Charts Row */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '18px', width: "100%" }}>
        <Panel title="Patient State Distribution" width="50%">
          <Bar data={chartStatesData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} height={280} />
        </Panel>
        <Panel title="Zone Occupancy" width="50%">
          <Bar data={chartZonesData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }} height={280} />
        </Panel>
      </div>

      {/* Third Row Summary Charts */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '18px', width: "100%", boxSizing: "border-box" }}>
        <Panel title="Queue Sizes" width="33.33%">
          <Bar data={chartQueuesData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} height={280} />
        </Panel>
        <Panel title="Nurse Utilization" width="33.33%">
          <Doughnut data={chartNursesData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} height={280} />
        </Panel>
        <Panel title="Doctor Load" width="33%" >
          <Bar data={chartDoctorsData} options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, max: maxP, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }} height={280} />
        </Panel>
      </div>

      {/* Bottom Data Table Row */}
      <Panel title="Completed Patient Stage Times (minutes)" width="100%">
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {stages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No completed patients yet.</div>
          ) : (
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {tableColumns.map(col => <th key={col} style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {stages.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {tableColumns.map(col => {
                      const val = parseFloat(`${row[col]}`);
                      return (
                        <td key={col} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                          {isNaN(val) ? row[col] : val.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}

// Minimal Presentational Sub-components for Layout
function Card({ title, value }: {title:string, value: string}) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '18px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      <h4 style={{ margin: '0 0 4px', fontSize: '13px', color: '#888', textTransform: 'uppercase' }}>{title}</h4>
      <div style={{ fontSize: '28px', fontWeight: '700', color: '#333' }}>{value !== null && value !== undefined ? value : '--'}</div>
    </div>
  );
}

function Panel({ title, children, width } : {title:string, children: React.ReactNode, width?:string}) {
  return (
    <div style={{ width: width, background: '#fff', border: '1px solid #ddd', borderRadius: '4px', overflow:"hidden"}}>
      <div style={{ padding: '10px 15px', background: '#f5f5f5', borderBottom: '1px solid #ddd', fontWeight: 'bold', fontSize: '14px' }}>{title}</div>
      <div style={{ padding: '10px', minHeight: '280px' }}>{children}</div>
    </div>
  );
}