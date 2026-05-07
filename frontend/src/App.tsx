import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, Calendar, AlertCircle, X, ChevronDown, HelpCircle, BookOpen } from 'lucide-react';
import './index.css';

const CustomSelect = ({ value, onChange, options, placeholder, icon, style, title }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`custom-select-container ${isOpen ? 'open' : ''}`} ref={dropdownRef} style={style} title={title}>
      <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span>{value ? options.find((o: any) => o.value === value)?.label : placeholder}</span>
        </span>
        <ChevronDown size={14} color="var(--text-secondary)" />
      </div>
      {isOpen && (
        <div className="custom-select-dropdown">
          <div className={`custom-select-option ${value === '' ? 'selected' : ''}`} onClick={() => { onChange(''); setIsOpen(false); }}>
            {placeholder}
          </div>
          {options.map((opt: any) => (
            <div key={opt.value} className={`custom-select-option ${value === opt.value ? 'selected' : ''}`} onClick={() => { onChange(opt.value); setIsOpen(false); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface YieldData {
  auctionNo: string;
  date: string;
  cutOffYields: Record<string, number | null>;
  weightedAverageYields: Record<string, number | null>;
  amountOffered: Record<string, number | null>;
  bidsReceived: Record<string, number | null>;
  amountAccepted: Record<string, number | null>;
  timestamp: number;
}

interface PredictionData {
  yield: number;
  weightedYield: number;
  btc: number;
  supply: number;
  demand: number;
}

interface ApiResponse {
  data: YieldData[];
  predictions: Record<string, PredictionData | null>;
}

const getBTC = (item: YieldData, p: string): number | null => {
  const bids = item.bidsReceived?.[p];
  const offered = item.amountOffered?.[p];
  if (!bids || !offered) return null;
  return parseFloat((bids / offered).toFixed(3));
};

const ComparisonChart = ({ data, predictions, onRemove, showRemove }: any) => {
  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [chartMode, setChartMode] = useState<'yield' | 'demand' | 'weighted'>('yield');

  const chartPeriods = ['1D', '5D', '1M', '3M', '6M', '1Y', 'ALL', 'CUSTOM'];

  const filterByPeriod = (data: YieldData[]) => {
    if (selectedPeriod === 'ALL') return data;
    if (selectedPeriod === 'CUSTOM') {
      let filtered = data;
      if (customStartDate) {
        const [year, month] = customStartDate.split('-');
        const start = new Date(Number(year), Number(month) - 1, 1);
        filtered = filtered.filter(item => new Date(item.date) >= start);
      }
      if (customEndDate) {
        const [year, month] = customEndDate.split('-');
        const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
        filtered = filtered.filter(item => new Date(item.date) <= end);
      }
      return filtered;
    }
    const now = new Date();
    let filterDate = new Date();
    switch (selectedPeriod) {
      case '1M': filterDate.setMonth(now.getMonth() - 1); break;
      case '3M': filterDate.setMonth(now.getMonth() - 3); break;
      case '6M': filterDate.setMonth(now.getMonth() - 6); break;
      case '1Y': filterDate.setFullYear(now.getFullYear() - 1); break;
      case '1D': return data.slice(-1);
      case '5D': return data.slice(-5);
      default: return data;
    }
    return data.filter(item => new Date(item.date) >= filterDate);
  };

  const filteredData = filterByPeriod(data);

  const yieldChartData = filteredData.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }),
    '28 Days': item.cutOffYields['28_days'],
    '91 Days': item.cutOffYields['91_days'],
    '182 Days': item.cutOffYields['182_days'],
    '364 Days': item.cutOffYields['364_days'],
  }));
  if (data.length > 0) {
    yieldChartData.push({
      date: 'Next (Predicted)',
      '28 Days': predictions?.['28_days']?.yield ?? null,
      '91 Days': predictions?.['91_days']?.yield ?? null,
      '182 Days': predictions?.['182_days']?.yield ?? null,
      '364 Days': predictions?.['364_days']?.yield ?? null,
    });
  }

  const demandChartData = filteredData.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }),
    '28 Days': getBTC(item, '28_days'),
    '91 Days': getBTC(item, '91_days'),
    '182 Days': getBTC(item, '182_days'),
    '364 Days': getBTC(item, '364_days'),
  }));
  if (data.length > 0) {
    demandChartData.push({
      date: 'Next (Predicted)',
      '28 Days': predictions?.['28_days']?.btc ?? null,
      '91 Days': predictions?.['91_days']?.btc ?? null,
      '182 Days': predictions?.['182_days']?.btc ?? null,
      '364 Days': predictions?.['364_days']?.btc ?? null,
    });
  }

  const weightedChartData = filteredData.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }),
    '28 Days': item.weightedAverageYields?.['28_days'],
    '91 Days': item.weightedAverageYields?.['91_days'],
    '182 Days': item.weightedAverageYields?.['182_days'],
    '364 Days': item.weightedAverageYields?.['364_days'],
  }));
  if (data.length > 0) {
    weightedChartData.push({
      date: 'Next (Predicted)',
      '28 Days': predictions?.['28_days']?.weightedYield ?? null,
      '91 Days': predictions?.['91_days']?.weightedYield ?? null,
      '182 Days': predictions?.['182_days']?.weightedYield ?? null,
      '364 Days': predictions?.['364_days']?.weightedYield ?? null,
    });
  }

  const chartData = chartMode === 'yield' ? yieldChartData : (chartMode === 'demand' ? demandChartData : weightedChartData);

  return (
    <section className="glass-panel chart-section">
      <div className="chart-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
            {chartMode === 'yield' ? 'Cut Off Yield Trends' : (chartMode === 'demand' ? 'Demand (BTC) Trends' : 'Weighted Avg Yield Trends')}
          </h2>
          <div className="chart-mode-selector">
            {['yield', 'weighted', 'demand'].map(m => (
              <button key={m} className={`mode-btn ${chartMode === m ? 'active' : ''}`} onClick={() => setChartMode(m as any)}>
                {m === 'yield' ? 'Cut Off' : (m === 'weighted' ? 'Wtd Avg' : 'Demand')}
              </button>
            ))}
          </div>
          {showRemove && (
            <button onClick={onRemove} className="clear-filter-btn" style={{ marginLeft: 'auto', padding: '2px 8px' }}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="period-selector">
          {chartPeriods.map(p => (
            <button key={p} className={`period-btn ${selectedPeriod === p ? 'active' : ''}`} onClick={() => setSelectedPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {selectedPeriod === 'CUSTOM' && (
        <div className="custom-date-filters" style={{ display: 'flex', gap: '0.75rem', marginTop: '-1rem', marginBottom: '-0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>From:</span>
          <input type="month" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="date-input" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>To:</span>
          <input type="month" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="date-input" />
        </div>
      )}
      <div style={{ height: 350, width: '100%', marginTop: '1rem' }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fontSize: 10}} />
            <YAxis stroke="var(--text-secondary)" tick={{fontSize: 10}} domain={['auto', 'auto']} tickFormatter={(v) => chartMode === 'demand' ? `${v}x` : `${v}%`} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} labelStyle={{ color: 'var(--accent)' }} itemSorter={(item: any) => -(item.value || 0)} formatter={(value: any, name: any) => [Number(value).toFixed(3) + (chartMode === 'demand' ? 'x' : '%'), name]} />
            {[{ key: '28 Days', color: '#bef264' }, { key: '91 Days', color: '#4ade80' }, { key: '182 Days', color: '#fbbf24' }, { key: '364 Days', color: '#ffffff' }].map(l => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} name={l.key} />
            ))}
            <ReferenceLine x="Next (Predicted)" stroke="var(--accent)" strokeDasharray="3 3" />
            <Legend iconType="circle" content={(props) => (
              <div className="custom-legend" style={{ fontSize: '0.75rem', gap: '1rem' }}>
                {[...(props.payload || [])].sort((a: any, b: any) => parseInt(a.value as string) - parseInt(b.value as string)).map((entry: any, index: number) => (
                  <div key={`item-${index}`} className="legend-item">
                    <span className="legend-icon" style={{ backgroundColor: entry.color, width: 8, height: 8 }} />
                    <span className="legend-label">{entry.value}</span>
                  </div>
                ))}
              </div>
            )} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default function App() {
  const [data, setData] = useState<YieldData[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionData | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [charts, setCharts] = useState([Date.now()]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<ApiResponse>('/api/data');
        setData(response.data.data);
        setPredictions(response.data.predictions);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading-container"><Activity className="pulse-icon" size={48} /><h2>Loading...</h2></div>;
  if (error) return <div className="loading-container" style={{ color: 'var(--danger)' }}><AlertCircle size={48} /><h2>Error: {error}</h2></div>;

  const latestAuction = data[data.length - 1];
  const prevAuction = data[data.length - 2];
  const periods = [
    { key: '28_days', label: '28 Days', indicator: '1 Month' },
    { key: '91_days', label: '91 Days', indicator: '3 Months' },
    { key: '182_days', label: '182 Days', indicator: '6 Months' },
    { key: '364_days', label: '364 Days', indicator: '1 Year' },
  ];

  const getTrend = (periodKey: string) => {
    if (!latestAuction || !prevAuction) return null;
    const curr = latestAuction.cutOffYields[periodKey];
    const prev = prevAuction.cutOffYields[periodKey];
    if (curr === null || prev === null) return null;
    return { diff: (curr - prev).toFixed(3), isUp: (curr - prev) > 0 };
  };

  const filteredTableData = (filterMonth || filterYear)
    ? data.filter(item => {
        const d = new Date(item.date);
        const y = d.getFullYear().toString();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return (filterMonth ? m === filterMonth : true) && (filterYear ? y === filterYear : true);
      })
    : [...data].reverse().slice(0, showFullHistory ? data.length : 5);

  return (
    <>
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={e => e.stopPropagation()}>
            <div className="help-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <BookOpen size={20} color="var(--accent)" />
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Help Guide</h2>
              </div>
              <button className="help-close-btn" onClick={() => setShowHelp(false)}><X size={18} /></button>
            </div>
            <div className="help-modal-body">
              <p>The <strong>NBE Treasury Bills Yield Predictor</strong> tracks Ethiopian T-Bill interest rates.</p>
            </div>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <Activity color="var(--accent)" size={28} />
        <h1>NBE Treasury Bills Yield Predictor</h1>
        <button className="help-btn" onClick={() => setShowHelp(true)}><HelpCircle size={19} /><span>Help</span></button>
      </header>

      <main className="main-content">
        <div className="metric-grid">
          {periods.map(p => {
            const currentVal = latestAuction?.cutOffYields[p.key];
            const trend = getTrend(p.key);
            const pred = predictions?.[p.key];
            return (
              <div key={p.key} className="glass-panel metric-card">
                <div className="metric-header">
                  <div className="label-group"><Calendar size={14} color="var(--text-secondary)" /><span className="maturity-label">{p.label}</span><span className="period-indicator">{p.indicator}</span></div>
                  <div className="btc-badge">Demand: {latestAuction ? getBTC(latestAuction, p.key)?.toFixed(2) : '-'}x</div>
                </div>
                <div className="main-metric-content">
                  <div className="current-stats">
                    <div className="metric-value">{currentVal !== null ? `${currentVal}%` : 'N/A'}</div>
                    {trend && <div className={`metric-sub ${trend.isUp ? 'trend-up' : 'trend-down'}`}><TrendingUp size={14} style={{ transform: trend.isUp ? 'none' : 'rotate(180deg)' }} />{trend.diff}%</div>}
                  </div>
                  {pred && (
                    <div className="prediction-box">
                      <div className="prediction-content">
                        <div className="prediction-meta"><span className="prediction-label">Next Prediction</span><span className="prediction-demand">Demand: {pred.btc.toFixed(1)}x</span></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <span className="prediction-value">{pred.yield.toFixed(3)}%</span>
                          <span className="prediction-value" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}>{pred.weightedYield.toFixed(3)}% (Wtd)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Comparison Analysis</h2>
          <button className="toggle-button" onClick={() => setCharts([...charts, Date.now()])}><TrendingUp size={16} /> Add Comparison Chart</button>
        </div>

        <div className="charts-grid">
          {charts.map(id => <ComparisonChart key={id} data={data} predictions={predictions} onRemove={() => setCharts(charts.filter(c => c !== id))} showRemove={charts.length > 1} />)}
        </div>

        <section className="glass-panel table-section">
          <div className="chart-header" style={{ paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="header-with-count">
              <h2>{(filterMonth || filterYear) ? `Filtered Results` : (showFullHistory ? "Full History" : "Recent Results")}</h2>
              <span className="results-count">{filteredTableData.length} Results</span>
            </div>
            <div className="filter-controls">
              <CustomSelect value={filterMonth} onChange={setFilterMonth} placeholder="Month" options={[{ value: "01", label: "Jan" }, { value: "02", label: "Feb" }, { value: "03", label: "Mar" }, { value: "04", label: "Apr" }, { value: "05", label: "May" }, { value: "06", label: "Jun" }, { value: "07", label: "Jul" }, { value: "08", label: "Aug" }, { value: "09", label: "Sep" }, { value: "10", label: "Oct" }, { value: "11", label: "Nov" }, { value: "12", label: "Dec" }]} />
              <CustomSelect value={filterYear} onChange={setFilterYear} placeholder="Year" options={Array.from(new Set(data.map(d => new Date(d.date).getFullYear().toString()))).filter(y => y !== "NaN").sort().map(y => ({ value: y, label: y }))} />
              <button className="toggle-button" onClick={() => setShowFullHistory(!showFullHistory)}>{showFullHistory ? "Show Recent" : "Show Full History"}</button>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>Date</th>
                  <th rowSpan={2}>Auction</th>
                  <th colSpan={4} className="group-header yield-section-bg">Yield (Cut-Off / Weighted)</th>
                  <th colSpan={4} className="group-header">Demand Ratio (BTC)</th>
                  <th rowSpan={2}>Total Bids</th>
                </tr>
                <tr>
                  <th className="tenure-header yield-section-bg">28 Days</th>
                  <th className="tenure-header yield-section-bg">91 Days</th>
                  <th className="tenure-header yield-section-bg">182 Days</th>
                  <th className="tenure-header yield-section-bg">364 Days</th>
                  <th className="tenure-header">28 Days</th>
                  <th className="tenure-header">91 Days</th>
                  <th className="tenure-header">182 Days</th>
                  <th className="tenure-header">364 Days</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="date-cell">{item.date}</td>
                    <td className="auction-cell">{item.auctionNo}</td>
                    {['28_days', '91_days', '182_days', '364_days'].map(p => (
                      <td key={`yield-${p}`} className="yield-cell yield-section-bg">
                        <div className="yield-stack">
                          <span className="cut-off">{item.cutOffYields[p] ? `${item.cutOffYields[p]}%` : '-'}</span>
                          <span className="wtd-avg">{item.weightedAverageYields?.[p] ? `${item.weightedAverageYields[p]}%` : '-'}</span>
                        </div>
                      </td>
                    ))}
                    {['28_days', '91_days', '182_days', '364_days'].map(p => (
                      <td key={`btc-${p}`} className="btc-cell">
                        <span className="btc-value">{getBTC(item, p) ? `${getBTC(item, p)}x` : '-'}</span>
                      </td>
                    ))}
                    <td className="bids-cell">{Object.values(item.bidsReceived || {}).reduce((acc: number, val: number | null) => acc + (val || 0), 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
