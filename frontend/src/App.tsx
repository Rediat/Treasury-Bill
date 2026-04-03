import { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import './index.css';

interface YieldData {
  auctionNo: string;
  date: string;
  cutOffYields: Record<string, number | null>;
  weightedAverageYields: Record<string, number | null>;
  timestamp: number;
}

interface ApiResponse {
  data: YieldData[];
  predictions: Record<string, number | null>;
}

export default function App() {
  const [data, setData] = useState<YieldData[]>([]);
  const [predictions, setPredictions] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('3M');

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
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
    fullDate: item.date,
    '28 Days': item.cutOffYields['28_days'],
    '91 Days': item.cutOffYields['91_days'],
    '182 Days': item.cutOffYields['182_days'],
    '364 Days': item.cutOffYields['364_days'],
    isPredicted: false
  }));

  // Append prediction node
  if (data.length > 0) {
    chartData.push({
      date: 'Next (Predicted)',
      fullDate: 'Prediction',
      '28 Days': predictions['28_days'] ? parseFloat(predictions['28_days']!.toFixed(3)) : null,
      '91 Days': predictions['91_days'] ? parseFloat(predictions['91_days']!.toFixed(3)) : null,
      '182 Days': predictions['182_days'] ? parseFloat(predictions['182_days']!.toFixed(3)) : null,
      '364 Days': predictions['364_days'] ? parseFloat(predictions['364_days']!.toFixed(3)) : null,
      isPredicted: true
    });
  }

  const periods = [
    { key: '28_days', label: '28 Days' },
    { key: '91_days', label: '91 Days' },
    { key: '182_days', label: '182 Days' },
    { key: '364_days', label: '364 Days' },
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
            const predVal = predictions[period.key];
            const trend = getTrend(period.key);

            return (
              <div className="glass-panel metric-card" key={period.key}>
                <div className="metric-title">
                  <Calendar size={16} /> 
                  Maturity: {period.label}
                </div>
                <div className="metric-value">
                  {currentVal !== null && currentVal !== undefined ? `${currentVal}%` : 'N/A'}
                </div>
                {trend && (
                  <div className={`metric-sub ${trend.isUp ? 'trend-up' : 'trend-down'}`}>
                    <TrendingUp size={14} style={{ transform: trend.isUp ? 'none' : 'rotate(180deg)' }} />
                    {trend.diff}% from last auction
                  </div>
                )}
                {predVal && (
                  <div className="metric-sub" style={{ marginTop: '0.5rem', color: 'var(--accent)' }}>
                    Predicted next: <strong>{predVal.toFixed(3)}%</strong>
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
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
                <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} domain={['auto', 'auto']} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--accent)' }}
                  formatter={(value: any) => [`${value}%`, 'Yield']}
                />
                {[
                  { key: '28 Days', color: '#38bdf8' },
                  { key: '91 Days', color: '#a78bfa' },
                  { key: '182 Days', color: '#34d399' },
                  { key: '364 Days', color: '#fbbf24' },
                ].map(l => (
                  <Line 
                    key={l.key} 
                    type="monotone" 
                    dataKey={l.key} 
                    stroke={l.color} 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 6 }} 
                    name={l.key} 
                  />
                ))}
                <ReferenceLine x="Next (Predicted)" stroke="var(--accent)" strokeDasharray="3 3" label={{ position: 'top', value: 'Prediction', fill: 'var(--accent)', fontSize: 12 }} />
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
          <div className="chart-header" style={{ paddingBottom: '1rem' }}>
            <h2>{showFullHistory ? "Full Auction History" : "Recent Auction Results"}</h2>
            <button 
               className="toggle-button"
               onClick={() => setShowFullHistory(!showFullHistory)}
            >
              {showFullHistory ? "Show Recent View" : "Show Full History"}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Auction No</th>
                <th>28 Days</th>
                <th>91 Days</th>
                <th>182 Days</th>
                <th>364 Days</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, showFullHistory ? data.length : 5).map((item, idx) => (
                <tr key={idx}>
                  <td>{item.date}</td>
                  <td>{item.auctionNo}</td>
                  <td>{item.cutOffYields['28_days'] ? `${item.cutOffYields['28_days']}%` : '-'}</td>
                  <td>{item.cutOffYields['91_days'] ? `${item.cutOffYields['91_days']}%` : '-'}</td>
                  <td>{item.cutOffYields['182_days'] ? `${item.cutOffYields['182_days']}%` : '-'}</td>
                  <td>{item.cutOffYields['364_days'] ? `${item.cutOffYields['364_days']}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
