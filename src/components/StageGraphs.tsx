import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Bar } from 'react-chartjs-2';
import JSZip from 'jszip';
import {CtasHistogramBucket, CtasStageData, YMaxMetrics, AlertConfiguration} from '@/replay/types'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';

// Register Chart.js modules
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- TypeScript Layout Specifications ---



// Global Constant Structures
type SlideStage = keyof CtasStageData;
const SLIDES: SlideStage[] = ['waiting', 'treatment', 'ed'];

const STAGE_TITLES: Record<SlideStage, string> = {
  waiting: 'Distribution of Wait Time (Arrival to PIA Time) Stratified by CTAS',
  treatment: 'Distribution of Time in Treatment (PIA To Disposition) Stratified by CTAS',
  ed: 'Distribution of Total Time in ED (PIA To Leave) Stratified by CTAS',
};

const SLIDE_TITLES: Record<SlideStage, string> = {
  waiting: 'VisitPia',
  treatment: 'DispPia',
  ed: 'PiaLeave',
};

const STAGE_FOLDER_NAMES: Record<SlideStage, string> = {
  waiting: 'Waiting Times',
  treatment: 'Treatment Times',
  ed: 'ED Times',
};

const MAX_ROWS_TO_SHOW = 2000;

export default function CTASGraphs({ctasData, graphOpen} : {ctasData:CtasStageData, graphOpen:boolean}): React.JSX.Element | null {
  // Navigation & Core Data Hooks
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [cachedData, setCachedData] = useState<CtasStageData | null>(null);
  const [yMaxByStage, setYMaxByStage] = useState<YMaxMetrics>({});
  //const [requestedSimCode, setRequestedSimCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Raw Data Modal Hooks
  const [isRawModalOpen, setIsRawModalOpen] = useState<boolean>(false);
  //const [cachedCSVText, setCachedCSVText] = useState<string | null>(null);
  //const [cachedCSVRows, setCachedCSVRows] = useState<string[][] | null>(null);
  const [showingAllRows, setShowingAllRows] = useState<boolean>(false);
  //const [csvLoading, setCsvLoading] = useState<boolean>(false);

  // Modal Dialog UI Hook
  const [alertState, setAlertState] = useState<AlertConfiguration>({ open: false, message: '' });

  // DOM Target References
  const offscreenRef = useRef<HTMLDivElement | null>(null);
  const currentStage: SlideStage = SLIDES[currentSlideIndex];


  const [renderComponent, setRenderComponent] = useState(graphOpen);
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if(graphOpen){
      setRenderComponent(true);
    }
  }, [graphOpen]);

  const handleAnimationEnd = () => {
    if (!graphOpen) {
      setRenderComponent(false); // Completely unmount after slide-out finishes
    }
  };



  // Helper Utilities matching template specifications
  // const formatDisplayName = (rawName: string): string => {
  //   if (!rawName) return '';
  //   let name: string = rawName.replace(/_\d{8}_\d{6}$/, '');
  //   name = name.replace(/[_-]/g, ' ');
  //   return name.replace(/\b\w/g, (char) => char.toUpperCase());
  // };

  const cleanLabels = (bins: string[]): string[] => {
    return bins.map((b) => (typeof b === 'string' ? b.split(/-|–/)[0].trim() : b));
  };

  const sanitizeFilename = (s: string): string => {
    return (s || '').toString().replace(/[^\w\-_. ]+/g, '_').replace(/\s+/g, '_');
  };

  const showAlert = (message: string): void => {
    setAlertState({ open: true, message });
  };

  // Re-implemented formula matching template's getYMaxByStage
const calculateYMaxByStage = (data: CtasStageData): YMaxMetrics => {
  const result: YMaxMetrics = {};
  
  Object.entries(data).forEach(([stage, stageData]) => {
    let max = 0;
    if (stageData) {
      // Cast the value array explicitly to bypass the index signature fallback
      (Object.values(stageData) as (CtasHistogramBucket | undefined)[]).forEach((ctas) => {
        if (ctas && ctas.counts) {
          ctas.counts.forEach((v) => {
            if (v > max) max = v;
          });
        }
      });
    }
    result[stage as SlideStage] = max || 1;
  });
  
  return result;
};

  // Deterministic CSV Parser Loop
  // const parseCSV = (text: string): string[][] => {
  //   const rows: string[][] = [];
  //   let cur: string[] = [];
  //   let field = '';
  //   let inQuotes = false;
  //   let i = 0;

  //   while (i < text.length) {
  //     const ch = text[i];
  //     if (inQuotes) {
  //       if (ch === '"') {
  //         if (i + 1 < text.length && text[i + 1] === '"') {
  //           field += '"';
  //           i += 2;
  //         } else {
  //           inQuotes = false;
  //           i++;
  //         }
  //       } else {
  //         field += ch;
  //         i++;
  //       }
  //     } else {
  //       if (ch === '"') {
  //         inQuotes = true;
  //         i++;
  //       } else if (ch === ',') {
  //         cur.push(field);
  //         field = '';
  //         i++;
  //       } else if (ch === '\r') {
  //         i++;
  //       } else if (ch === '\n') {
  //         cur.push(field);
  //         rows.push(cur);
  //         cur = [];
  //         field = '';
  //         i++;
  //       } else {
  //         field += ch;
  //         i++;
  //       }
  //     }
  //   }
  //   if (field !== '' || inQuotes || cur.length > 0) {
  //     cur.push(field);
  //     rows.push(cur);
  //   }
  //   return rows;
  // };

  // Unified Mount Init Handler matching data_visualization.html's init()
  useEffect(() => {
    // async function initDashboard(): Promise<void> {
    //   const searchParams = new URLSearchParams(window.location.search);
    //   const qp = searchParams.get('sim_code');
    //   const ls = localStorage.getItem('curr_sim_code');
    //   const sim = qp || ls;

    //   if (!sim) {
    //     setErrorMsg('Failed to load data for simulation "null": No simulation selected.');
    //     setLoading(false);
    //     return;
    //   }

    //   setRequestedSimCode(sim);
    //   try {
    //     localStorage.setItem('curr_sim_code', sim);
    //     localStorage.setItem('curr_sim_display_name', sim);
    //   } catch (e) {
    //     console.warn('LocalStorage mutation restricted');
    //   }

    //   try {
    //     const res = await fetch(`/api/state_times/?sim_code=${encodeURIComponent(sim)}`);
    //     if (!res.ok) {
    //       let body: any = null;
    //       try { body = await res.json(); } catch (e) {}
    //       throw new Error(body && body.error ? body.error : `HTTP ${res.status}`);
    //     }
        
    //     const data: CtasStageData = await res.json();
    //     if (!data || Object.keys(data).length === 0) {
    //       setErrorMsg(`No data returned for simulation "${sim}".`);
    //       setLoading(false);
    //       return;
    //     }

    //     setCachedData(data);
    //     setYMaxByStage(calculateYMaxByStage(data));
    //   } catch (err: any) {
    //     setErrorMsg(`Failed to load data for simulation "${sim}": ${err.message}`);
    //   } finally {
    //     setLoading(false);
    //   }
    // }
    //initDashboard();
    if (!ctasData || Object.keys(ctasData).length === 0) {
      setErrorMsg(`No data returned for replay.`);
      setLoading(false);
    }
    setCachedData(ctasData);
    setYMaxByStage(calculateYMaxByStage(ctasData));
            setLoading(false);

  }, []);

  // Keyboard navigation capturing right/left arrow triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => (prev + 1) % SLIDES.length);
      }
      if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

    if(renderComponent == false){
    return null;
  }
  

  // // View raw payload fetcher mapping to openRawModal() logic
  // const openRawModal = async (): Promise<void> => {
  //   if (!requestedSimCode) {
  //     showAlert('No simulation selected.');
  //     return;
  //   }
  //   setIsRawModalOpen(true);

  //   if (!cachedCSVText) {
  //     setCsvLoading(true);
  //     try {
  //       const url = `/api/get_data/?sim_code=${encodeURIComponent(requestedSimCode)}`;
  //       const res = await fetch(url);
  //       if (!res.ok) {
  //         let body: any = null;
  //         try { body = await res.json(); } catch (e) {}
  //         throw new Error(body && body.error ? body.error : `HTTP ${res.status}`);
  //       }
  //       const text = await res.text();
  //       setCachedCSVText(text);
  //       setCachedCSVRows(parseCSV(text));
  //     } catch (err: any) {
  //       console.error(err);
  //       showAlert('Failed to load CSV: ' + err.message);
  //     } finally {
  //       setCsvLoading(false);
  //     }
  //   }
  // };

  // Download raw resource pipeline
  const downloadRawDataCSV = async (): Promise<void> => {
    if (!ctasData || Object.keys(ctasData).length === 0) {
      showAlert('No simulation selected.');
      return;
    }
    try {

      const blob = ctasData ? new Blob([JSON.stringify(ctasData, null, 2)], { type: 'application/json' }) : new Blob([], { type: 'application/json' });
      const filename = `sim_state_times.csv`;
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      console.error('Failed to download raw CSV:', err);
      showAlert('Failed to download raw CSV: ' + err.message);
    }
  };

  // Asynchronous offscreen frame compression rendering zip generator
  const downloadChartsAsZip = async (): Promise<void> => {
    if (!cachedData) {
      showAlert('No histogram data loaded yet.');
      return;
    }
    if (!offscreenRef.current) return;

    const zip = new JSZip();

    for (const stage of SLIDES) {
      const stageObj = cachedData[stage];
      if (!stageObj) continue;

      const folderName = STAGE_FOLDER_NAMES[stage] || stage;
      const stageFolder = zip.folder(folderName);
      if (!stageFolder) continue;

      const ctasKeys = Object.keys(stageObj).sort();

      for (const ctas of ctasKeys) {
        const data = stageObj[ctas];
        if (!data) continue;

        const canvas = document.createElement('canvas');
        canvas.width = 1040;
        canvas.height = 840;
        offscreenRef.current.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        const stageYMax = yMaxByStage && yMaxByStage[stage] ? yMaxByStage[stage] : undefined;

        // Instantiating fresh single-frame un-animated instance configuration matching downloadChartsAsZip schema
        const chartInstance = new ChartJS(ctx, {
          type: 'bar',
          data: {
            labels: cleanLabels(data.bins),
            datasets: [{
              label: ctas,
              data: data.counts,
              backgroundColor: 'rgba(54, 162, 235, 0.75)',
              barPercentage: 1.0,
              categoryPercentage: 1.0,
            }],
          },
          options: {
            animation: false,
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              title: {
                display: true,
                text: `${SLIDE_TITLES[stage]} ${ctas}`,
                font: { size: 18 },
                padding: { bottom: 10 }
              },
            },
            scales: {
              x: { title: { display: true, text: 'Wait Times (Hours)' }, ticks: { autoSkip: true, maxTicksLimit: 8 } },
              y: { beginAtZero: true, suggestedMax: stageYMax, title: { display: true, text: 'Frequency' }, ticks: { precision: 0 } },
            },
          },
        });

        // Frame cycle delay matching standard asynchronous script canvas serialization timing loops
        await new Promise((resolve) => setTimeout(resolve, 60));

        try {
          const dataUrl = chartInstance.toBase64Image();
          const resp = await fetch(dataUrl);
          const blob = await resp.blob();
          const fileName = `${sanitizeFilename('sim')}_${sanitizeFilename(SLIDE_TITLES[stage])}_${sanitizeFilename(ctas)}.png`;
          stageFolder.file(fileName, blob);
        } catch (err) {
          console.error('Failed to create chart image for', stage, ctas, err);
        }
        
        chartInstance.destroy();
        offscreenRef.current.removeChild(canvas);
      }
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipName = `${sanitizeFilename('sim')}_charts.zip`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      console.error('Failed to generate ZIP:', e);
      showAlert('Failed to create ZIP of charts: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="app-shell page-container" style={{ fontFamily: "'Manrope', 'Segoe UI', sans-serif" }}>
        <div className="chart-grid" id="charts">
          <div className="info-msg" style={{ textAlign: 'center', padding: '24px', color: '#2f645c' }}>
            Loading data for simulation...
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="app-shell page-container" style={{ fontFamily: "'Manrope', 'Segoe UI', sans-serif" }}>
        <div className="chart-grid" id="charts">
          <div className="error-msg" style={{ textAlign: 'center', padding: '24px', color: '#c00' }}>
            {errorMsg}
          </div>
        </div>
      </div>
    );
  }

  const currentStageData = cachedData?.[currentStage] || {};
  const ctasKeys = Object.keys(currentStageData).sort();
  //const totalCSVRowsCount = cachedCSVRows ? Math.max(0, cachedCSVRows.length - 1) : 0;
  
  // Row partition handling aligning completely with limitRows parsing conditionals
  // const visibleCSVRows = cachedCSVRows 
  //   ? (showingAllRows ? cachedCSVRows.slice(1) : cachedCSVRows.slice(1, MAX_ROWS_TO_SHOW + 1)) 
  //   : [];

  return (
    
    <div ref={graphRef} className={`overlay-div ${graphOpen ? 'is-entering' : 'is-leaving'}`}
    onAnimationEnd={handleAnimationEnd}>
      
      <div className="nav-container" style={{ textAlign: 'center', marginTop: '20px', marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
        <p className="nav-hint-box" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'rgba(206, 206, 206, 0.37)', padding: '10px 24px', borderRadius: '50px', color: '#80abfc', fontSize: '15px', fontWeight: 500, boxShadow: '0 4px 12px rgba(43, 59, 73, 0.04)' }}>
          Use <kbd className="key-cap" style={{ background: '#ffffff', border: '1px solid rgba(122, 163, 188, 0.4)', borderRadius: '6px', boxShadow: '0 2px 0 rgba(178, 184, 187, 0.3)', color: '#24384b', display: 'inline-block', fontSize: '13px', fontWeight: 700, padding: '5px 10px', fontFamily: 'monospace', lineHeight: 1 }}>←</kbd> 
          and <kbd className="key-cap" style={{ background: '#ffffff', border: '1px solid rgba(122, 163, 188, 0.4)', borderRadius: '6px', boxShadow: '0 2px 0 rgba(189, 189, 189, 0.3)', color: '#24384b', display: 'inline-block', fontSize: '13px', fontWeight: 700, padding: '5px 10px', fontFamily: 'monospace', lineHeight: 1 }}>→</kbd> to navigate, or select a view:
        </p>
      </div>

      <div className="view-selector" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <select 
          id="view-select" 
          className="custom-select" 
          value={currentSlideIndex}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrentSlideIndex(parseInt(e.target.value, 10))}
          style={{ appearance: 'none', WebkitAppearance: 'none', textAlignLast: 'center', textAlign: 'center', padding: '12px 40px 12px 24px', fontSize: '16px', fontWeight: 600, borderRadius: '10px', border: '1px solid rgba(122, 163, 188, 0.3)', backgroundColor: '#f6fbff', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23037c6e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', color: '#24384b', cursor: 'pointer', outline: 'none', minWidth: '320px', boxShadow: '0 4px 10px rgba(74, 96, 116, 0.08)' }}
        >
          <option value="0">Waiting Time (VisitPIA)</option>
          <option value="1">Time in Treatment (DispPia)</option>
          <option value="2">Total Time in ED (PiaLeave)</option>
        </select>
      </div>

      <h2 id="stage-title" className="stage-title" style={{ textAlign: 'center', color: '#24384b', marginTop: '10px' }}>
        <span className="sim-name" style={{ fontSize: '0.875em', color: '#70a2ff' }}>Simulation Data</span>
        <br />
        <span className="sim-code" style={{ display: 'block', fontSize: '0.675em', fontWeight: 'normal', color: '#cbddff', margin: '10px 0 18px' }}>
          {STAGE_TITLES[currentStage]}
        </span>
      </h2>

      {/* Main Grid Render Blocks */}
      <div id="charts" className="chart-grid" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '32px' }}>
        {ctasKeys.length === 0 ? (
          <div className="info-msg" style={{ textAlign: 'center', color: '#2f645c', padding: '24px' }}>
            No data available for stage "{currentStage}".
          </div>
        ) : (
          ctasKeys.map((ctas) => {
            const dataNode = currentStageData[ctas];
            if (!dataNode) return null;

            const chartData: ChartData<'bar'> = {
              labels: cleanLabels(dataNode.bins),
              datasets: [{
                label: ctas,
                data: dataNode.counts,
                backgroundColor: 'rgba(54, 162, 235, 0.75)',
                barPercentage: 1.0,
                categoryPercentage: 1.0,
              }],
            };

            const chartOptions: ChartOptions<'bar'> = {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                title: {
                  display: true,
                  text: `${SLIDE_TITLES[currentStage]} ${ctas}`,
                  font: { size: 16 },
                  padding: { bottom: 10 },
                },
              },
              scales: {
                x: { title: { display: true, text: 'Wait Times (Hours)' }, ticks: { autoSkip: true, maxTicksLimit: 8 } },
                y: { beginAtZero: true, suggestedMax: yMaxByStage[currentStage], title: { display: true, text: 'Frequency' }, ticks: { precision: 0 } },
              },
            };

            return (
              <div className="chart-wrapper" key={ctas} style={{ flex: '0 1 650px', height: '420px', padding: '16px 18px 12px', borderRadius: '12px', background: 'rgba(235, 249, 245, 0.94)', boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)' }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            );
          })
        )}
      </div>

      {/* Primary Control Node Actions */}
      <div className="button-box center" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'nowrap', gap: '12px', margin: '18px auto', width: 'fit-content', textAlign: 'center' }}>
        {/* <button id="btn-view-raw" className="app-warning-btn" onClick={openRawModal} style={{ margin: '18px 12px 12px 12px', padding: '14px 28px', fontSize: '16px', borderRadius: '8px', background: '#FFA500', color: 'white', border: 'none', cursor: 'pointer' }}>
          View Raw Data
        </button>
        <button id="btn-download-raw" className="app-secondary-btn" onClick={downloadRawDataCSV} style={{ margin: '18px 12px 12px 12px', padding: '14px 28px', fontSize: '16px', borderRadius: '8px', background: '#17A2B8', color: 'white', border: 'none', cursor: 'pointer' }}>
          Download Raw Data
        </button> */}
        <button id="btn-download-charts" className="app-warning-btn" onClick={downloadChartsAsZip} style={{ margin: '18px 12px 12px 12px', padding: '14px 28px', fontSize: '16px', borderRadius: '8px', background: '#28A745', color: 'white', border: 'none', cursor: 'pointer' }}>
          Download Charts
        </button>
      </div>

      {/* Raw Data Frame Overlay Modal */}
      {isRawModalOpen && (
        <div id="rawDataModal" aria-hidden="false" onClick={() => setIsRawModalOpen(false)} style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ width: '100%', maxWidth: '1200px', maxHeight: '82vh', overflow: 'hidden', background: 'white', borderRadius: '12px', padding: '12px', marginBottom: '-48px', boxShadow: '0 12px 36px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Raw Simulation Data • <span id="modalSimCode"></span></h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button id="downloadRawFromModal" onClick={downloadRawDataCSV} style={{ padding: '6px 12px', borderRadius: '6px', background: 'linear-gradient(135deg, var(--teal-2, #037c6e), var(--teal-3, #036c5f))', color: 'white', border: 'none', cursor: 'pointer' }}>Download CSV</button>
                { MAX_ROWS_TO_SHOW && (
                  <button 
                    id="btn-toggle-all-rows" 
                    onClick={() => {
                      if (!showingAllRows) {
                        setShowingAllRows(true);
                      } else {
                        setShowingAllRows(false);
                      }
                    }} 
                    style={{ padding: '6px 12px', borderRadius: '6px', background: '#ffc107', color: 'black', border: 'none', cursor: 'pointer' }}
                  >
                    {showingAllRows ? 'Show first rows' : 'Show all rows'}
                  </button>
                )}
                <button id="closeRawModal" onClick={() => setIsRawModalOpen(false)} style={{ padding: '6px 12px', borderRadius: '6px', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            </div>

            {/* <div id="rawDataContent" style={{ overflow: 'auto', padding: '12px 18px 18px', flex: 1, background: '#f7f7f7', borderRadius: '8px', border: '1px solid #e6e6e6' }}>
              <div id="rawDataInner" style={{ minWidth: '700px' }}>
                {loading ? (
                  <div style={{ color: '#666' }}>Loading CSV…</div>
                ) : !cachedCSVRows || ctasData.length === 0 ? (
                  <div style={{ color: '#666' }}>CSV is empty.</div>
                ) : (
                  <table className="csv-table" style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '700px', fontSize: '13px', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        {cachedCSVRows[0]?.map((header: string, idx: number) => (
                          <th key={idx} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', background: '#fafafa', border: '1px solid #eaeaea', whiteSpace: 'nowrap' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCSVRows.map((row: string[], rIdx: number) => (
                        <tr key={rIdx}>
                          {(row || []).map((cell: string, cIdx: number) => (
                            <td key={cIdx} style={{ padding: '6px 8px', border: '1px solid #eaeaea', whiteSpace: 'nowrap' }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div id="rawDataMsg" style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
                {!loading && (
                  totalCSVRowsCount === 0 
                    ? 'CSV contains only header or is empty.'
                    : showingAllRows 
                      ? `Showing all ${totalCSVRowsCount.toLocaleString()} data rows.` 
                      : `Showing first ${Math.min(totalCSVRowsCount, MAX_ROWS_TO_SHOW).toLocaleString()} of ${totalCSVRowsCount.toLocaleString()} data rows. Click "Show all rows" to display everything (may take time).`
                )}
              </div>
            </div> */}
          </div>
        </div>
      )}

      {/* Global Alert Notification Modal */}
      {alertState.open && (
        <div id="alert-modal" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(20,38,52,0.52)', backdropFilter: 'blur(4px)', zIndex: 20000, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.96) 0%,rgba(246,251,255,0.96) 100%)', border: '1px solid rgba(122,163,188,0.3)', borderRadius: '18px', boxShadow: '0 14px 28px rgba(27,52,74,0.18),0 2px 6px rgba(27,52,74,0.08)', width: '90%', maxWidth: '420px', padding: '36px 32px 30px', textAlign: 'center' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(3,124,110,0.12),rgba(3,108,95,0.18))', border: '1px solid rgba(3,124,110,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
              <span style={{ color: '#037c6e', fontSize: '24px', fontWeight: 'bold' }}>i</span>
            </div>
            <p id="alert-message" style={{ margin: '0 0 26px', fontSize: '1.32rem', fontWeight: 500, color: '#24384b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{alertState.message}</p>
            <hr style={{ border: 'none', borderTop: '1px solid rgba(122,163,188,0.22)', margin: '0 0 24px' }} />
            <button id="alert-ok" onClick={() => setAlertState({ open: false, message: '' })} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 36px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#657b8e,#5a6f82)', color: '#f7fbff', fontSize: '1.08rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(74,96,116,0.22)' }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Offscreen target canvas mapping completely to fallback chart area hooks */}
      <div ref={offscreenRef} id="offscreen-chart-area" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />
    </div>
  );
}