import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, Calendar, AlertCircle, X, ChevronDown } from 'lucide-react';

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
    <div 
      className={`custom-select-container ${isOpen ? 'open' : ''}`} 
      ref={dropdownRef} 
      style={style}
      title={title}
    >
      <div 
        className="custom-select-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span>{value ? options.find((o: any) => o.value === value)?.label : placeholder}</span>
        </span>
        <ChevronDown size={14} color="var(--text-secondary)" />
      </div>
      {isOpen && (
        <div className="custom-select-dropdown">
          <div 
            className={`custom-select-option ${value === '' ? 'selected' : ''}`}
            onClick={() => { onChange(''); setIsOpen(false); }}
          >
            {placeholder}
          </div>
          {options.map((opt: any) => (
            <div 
              key={opt.value} 
              className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
import './index.css';

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
  btc: number;
  supply: number;
  demand: number;
}

interface ApiResponse {
  data: YieldData[];
  predictions: Record<string, PredictionData | null>;
}

export default function App() {
  const [data, setData] = useState<YieldData[]>([]);
  const [predictions, setPredictions] = useState<Record<string, PredictionData | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');

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

  const filterByPeriod = (data: YieldData[]) => {
    if (selectedPeriod === 'ALL') return data;
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

  if (loading) {
    return (
      <div className="loading-container">
        <Activity className="pulse-icon" size={48} />
        <h2>Loading Auction Data...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container" style={{ color: 'var(--danger)' }}>
        <AlertCircle size={48} />
        <h2>Error: {error}</h2>
      </div>
    );
  }

  const latestAuction = data[data.length - 1];
  const prevAuction = data[data.length - 2];

  // Helper to format chart data
  const chartData = filteredData.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }),
    fullDate: item.date,
    '28 Days': item.cutOffYields['28_days'],
    '91 Days': item.cutOffYields['91_days'],
    '182 Days': item.cutOffYields['182_days'],
    '364 Days': item.cutOffYields['364_days'],
    isPredicted: false
  }));

  // Append prediction node
  if (data.length > 0) {
    const f = predictions;
    chartData.push({
      date: 'Next (Predicted)',
      fullDate: 'Prediction',
      '28 Days': f?.['28_days']?.yield || null,
      '91 Days': f?.['91_days']?.yield || null,
      '182 Days': f?.['182_days']?.yield || null,
      '364 Days': f?.['364_days']?.yield || null,
      isPredicted: true
    });
  }

  const periods = [
    { key: '28_days', label: '28 Days', indicator: '1 Month' },
    { key: '91_days', label: '91 Days', indicator: '3 Months' },
    { key: '182_days', label: '182 Days', indicator: '6 Months' },
    { key: '364_days', label: '364 Days', indicator: '1 Year' },
  ];

  const chartPeriods = ['1D', '5D', '1M', '3M', '6M', '1Y', 'ALL'];

  const getTrend = (periodKey: string) => {
    if (!latestAuction || !prevAuction) return null;
    const curr = latestAuction.cutOffYields[periodKey];
    const prev = prevAuction.cutOffYields[periodKey];
    if (curr === null || prev === null) return null;
    const diff = curr - prev;
    return {
      diff: diff.toFixed(3),
      isUp: diff > 0
    };
  };





  return (
    <>
      <header className="dashboard-header">
        <Activity color="var(--accent)" size={28} />
        <h1>NBE Treasury Bills Yield Predictor</h1>
      </header>

      <main className="main-content">
        <div className="metric-grid">
          {periods.map(period => {
            const currentVal = latestAuction?.cutOffYields[period.key];
            const trend = getTrend(period.key);
            const pred = predictions?.[period.key];

            return (
              <div key={period.key} className="glass-panel metric-card">
                <div className="metric-header">
                  <div className="label-group">
                    <Calendar size={14} color="var(--text-secondary)" />
                    <span className="maturity-label">Maturity: {period.label}</span>
                    <span className="period-indicator">{period.indicator}</span>
                  </div>
                  <div className="btc-badge">Demand: {latestAuction ? (latestAuction.bidsReceived?.[period.key] && latestAuction.amountOffered?.[period.key] ? (latestAuction.bidsReceived[period.key]! / latestAuction.amountOffered[period.key]!).toFixed(2) : '1.00') : '-'}x</div>
                </div>
                <div className="metric-value">
                  {currentVal !== null && currentVal !== undefined ? `${currentVal}%` : 'N/A'}
                </div>
                
                <div className="metric-row">
                  {trend && (
                    <div className={`metric-sub ${trend.isUp ? 'trend-up' : 'trend-down'}`}>
                      <TrendingUp size={14} style={{ transform: trend.isUp ? 'none' : 'rotate(180deg)' }} />
                      {trend.diff}%
                    </div>
                  )}
                  
                  {latestAuction?.bidsReceived?.[period.key] && latestAuction?.amountOffered?.[period.key] && (
                    <div className="metric-sub demand-badge" title="Bid-to-Cover Ratio">
                      Demand: {(latestAuction.bidsReceived[period.key]! / latestAuction.amountOffered[period.key]!).toFixed(2)}x
                    </div>
                  )}
                </div>

                {pred && (
                  <div className="prediction-box">
                    <div className="prediction-content">
                      <div className="prediction-meta">
                        <span className="prediction-label">Next Prediction</span>
                        <span className="prediction-demand" title="Predicted Demand Ratio">
                           Demand: {predictions[period.key]!.btc.toFixed(2)}x
                        </span>
                      </div>
                      <span className="prediction-value">
                        {predictions[period.key]!.yield.toFixed(3)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className="glass-panel chart-section">
          <div className="chart-header">
            <h2>Cut Off Yield Trends & Prediction</h2>
            <div className="period-selector">
              {chartPeriods.map(p => (
                <button 
                  key={p} 
                  className={`period-btn ${selectedPeriod === p ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 400, width: '100%', marginTop: '1rem' }}>
            <ResponsiveContainer>
              <LineChart 
                data={chartData} 
                margin={{ top: 30, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--accent)' }}
                  separator=": "
                  itemSorter={(item: any) => -(item.value || 0)}
                  formatter={(value: any, name: any) => {
                    const formattedValue = Number(value).toFixed(3);
                    return [`${formattedValue}%`, `${name} Yield`];
                  }}
                />
                {[
                  { key: '28 Days', color: '#bef264' },
                  { key: '91 Days', color: '#4ade80' },
                  { key: '182 Days', color: '#fbbf24' },
                  { key: '364 Days', color: '#ffffff' },
                ].map(l => (
                  <Line 
                    key={l.key} 
                    type="monotone" 
                    dataKey={l.key} 
                    stroke={l.color} 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 7, cursor: 'pointer' }} 
                    name={l.key} 
                  />
                ))}
                <ReferenceLine x="Next (Predicted)" stroke="var(--accent)" strokeDasharray="3 3" label={{ position: 'top', value: 'Prediction', fill: 'var(--accent)', fontSize: 12, textAnchor: 'end' }} />
                <Legend 
                  iconType="circle"
                  content={(props) => {
                    const { payload } = props;
                    if (!payload) return null;
                    // Sort numerically by parsing the number of days from the value
                    const sortedPayload = [...payload].sort((a, b) => {
                      const numA = parseInt((a.value || '').split(' ')[0]) || 0;
                      const numB = parseInt((b.value || '').split(' ')[0]) || 0;
                      return numA - numB;
                    });
                    
                    return (
                      <div className="custom-legend">
                        {sortedPayload.map((entry, index) => (
                          <div key={`item-${index}`} className="legend-item">
                            <span className="legend-icon" style={{ backgroundColor: entry.color }} />
                            <span className="legend-label">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-panel table-section">
          <div className="chart-header" style={{ paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="header-with-count">
              <h2>{(filterMonth || filterYear) ? `Filtered Results` : (showFullHistory ? "Full Auction History" : "Recent Auction Results")}</h2>
              <span className="results-count">
                {(filterMonth || filterYear) 
                  ? `${data.filter(item => {
                      const d = new Date(item.date);
                      if (isNaN(d.getTime())) return false;
                      const y = d.getFullYear().toString();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const matchMonth = filterMonth ? m === filterMonth : true;
                      const matchYear = filterYear ? y === filterYear : true;
                      return matchMonth && matchYear;
                    }).length} Matches` 
                  : `${data.length} Results`}
              </span>
            </div>
            
            <div className="filter-controls">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CustomSelect 
                  value={filterMonth}
                  onChange={setFilterMonth}
                  placeholder="Month"
                  title="Filter by month"
                  icon={<Calendar size={14} color="var(--text-secondary)" />}
                  options={[
                    { value: "01", label: "Jan" },
                    { value: "02", label: "Feb" },
                    { value: "03", label: "Mar" },
                    { value: "04", label: "Apr" },
                    { value: "05", label: "May" },
                    { value: "06", label: "Jun" },
                    { value: "07", label: "Jul" },
                    { value: "08", label: "Aug" },
                    { value: "09", label: "Sep" },
                    { value: "10", label: "Oct" },
                    { value: "11", label: "Nov" },
                    { value: "12", label: "Dec" }
                  ]}
                />
                
                <CustomSelect 
                  value={filterYear}
                  onChange={setFilterYear}
                  placeholder="Year"
                  title="Filter by year"
                  options={
                    Array.from(new Set(data.map(d => {
                      const dt = new Date(d.date);
                      return isNaN(dt.getTime()) ? null : dt.getFullYear().toString();
                    }))).filter((y): y is string => y !== null).sort().map(y => ({ value: y, label: y }))
                  }
                />
              </div>
              
              {(filterMonth || filterYear) && (
                <button 
                  className="clear-filter-btn"
                  onClick={() => { setFilterMonth(''); setFilterYear(''); }}
                >
                  <X size={14} /> Clear
                </button>
              )}

              <button 
                 className="toggle-button"
                 onClick={() => {
                   setShowFullHistory(!showFullHistory);
                   setFilterMonth('');
                   setFilterYear('');
                 }}
              >
                {showFullHistory ? "Show Recent View" : "Show Full History"}
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Auction</th>
                  <th>Yield (28 / 91 / 182 / 364)</th>
                  <th>Demand Ratio (BTC)</th>
                  <th>Total Bids (ETB M)</th>
                </tr>
              </thead>
              <tbody>
                {((filterMonth || filterYear)
                  ? data.filter(item => {
                      const d = new Date(item.date);
                      if (isNaN(d.getTime())) return false;
                      const y = d.getFullYear().toString();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const matchMonth = filterMonth ? m === filterMonth : true;
                      const matchYear = filterYear ? y === filterYear : true;
                      return matchMonth && matchYear;
                    })
                  : [...data].reverse().slice(0, showFullHistory ? data.length : 5)
                ).map((item, idx) => {
                  const getBTC = (p: string) => {
                    if (!item.bidsReceived?.[p] || !item.amountOffered?.[p]) return null;
                    return (item.bidsReceived[p]! / item.amountOffered[p]!).toFixed(2);
                  };

                  const totalBids = Object.values(item.bidsReceived || {}).reduce((a, b) => (a || 0) + (b || 0), 0);

                  return (
                    <tr key={idx}>
                      <td>{item.date}</td>
                      <td>{item.auctionNo}</td>
                      <td>
                        <div className="yield-row">
                          <span className="yield-tag">{item.cutOffYields['28_days'] || '-'}%</span>
                          <span className="yield-tag">{item.cutOffYields['91_days'] || '-'}%</span>
                          <span className="yield-tag">{item.cutOffYields['182_days'] || '-'}%</span>
                          <span className="yield-tag">{item.cutOffYields['364_days'] || '-'}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="yield-row">
                          <span className="btc-tag">{getBTC('28_days') ? `${getBTC('28_days')}x` : '-'}</span>
                          <span className="btc-tag">{getBTC('91_days') ? `${getBTC('91_days')}x` : '-'}</span>
                          <span className="btc-tag">{getBTC('182_days') ? `${getBTC('182_days')}x` : '-'}</span>
                          <span className="btc-tag">{getBTC('364_days') ? `${getBTC('364_days')}x` : '-'}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{totalBids ? totalBids.toLocaleString() : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
