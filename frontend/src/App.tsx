import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, Calendar, AlertCircle, X, ChevronDown, HelpCircle, BookOpen, TrendingDown, BarChart2, Clock } from 'lucide-react';

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
  const [chartMode, setChartMode] = useState<'yield' | 'demand'>('yield');
  const [showHelp, setShowHelp] = useState(false);

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

  // Helper: compute bid-to-cover ratio
  const getBTC = (item: YieldData, p: string): number | null => {
    const bids = item.bidsReceived?.[p];
    const offered = item.amountOffered?.[p];
    if (!bids || !offered) return null;
    return parseFloat((bids / offered).toFixed(3));
  };

  // Yield chart data
  const yieldChartData = filteredData.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }),
    fullDate: item.date,
    '28 Days': item.cutOffYields['28_days'],
    '91 Days': item.cutOffYields['91_days'],
    '182 Days': item.cutOffYields['182_days'],
    '364 Days': item.cutOffYields['364_days'],
    isPredicted: false
  }));
  if (data.length > 0) {
    const f = predictions;
    yieldChartData.push({
      date: 'Next (Predicted)',
      fullDate: 'Prediction',
      '28 Days': f?.['28_days']?.yield ?? null,
      '91 Days': f?.['91_days']?.yield ?? null,
      '182 Days': f?.['182_days']?.yield ?? null,
      '364 Days': f?.['364_days']?.yield ?? null,
      isPredicted: true
    });
  }

  // Demand (BTC) chart data
  const demandChartData = filteredData.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }),
    fullDate: item.date,
    '28 Days': getBTC(item, '28_days'),
    '91 Days': getBTC(item, '91_days'),
    '182 Days': getBTC(item, '182_days'),
    '364 Days': getBTC(item, '364_days'),
    isPredicted: false
  }));
  if (data.length > 0) {
    const f = predictions;
    demandChartData.push({
      date: 'Next (Predicted)',
      fullDate: 'Prediction',
      '28 Days': f?.['28_days']?.btc ?? null,
      '91 Days': f?.['91_days']?.btc ?? null,
      '182 Days': f?.['182_days']?.btc ?? null,
      '364 Days': f?.['364_days']?.btc ?? null,
      isPredicted: true
    });
  }

  const chartData = chartMode === 'yield' ? yieldChartData : demandChartData;

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



  // ─── Help Modal ────────────────────────────────────────────────────────────
  const HelpModal = () => (
    <div className="help-overlay" onClick={() => setShowHelp(false)}>
      <div className="help-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="help-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookOpen size={20} color="var(--accent)" />
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>User Help Guide</h2>
          </div>
          <button className="help-close-btn" onClick={() => setShowHelp(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="help-modal-body">

          {/* ── What is this app ── */}
          <section className="help-section">
            <h3 className="help-section-title">📊 What Is This App?</h3>
            <p className="help-text">
              The <strong>NBE Treasury Bills Yield Predictor</strong> tracks and predicts the interest rates
              offered on Ethiopian government Treasury Bills (T-Bills) issued by the{' '}
              <strong>National Bank of Ethiopia (NBE)</strong>. It helps you:
            </p>
            <ul className="help-list">
              <li>See the <strong>current yield</strong> (interest rate) you would earn by investing in T-Bills today.</li>
              <li>Understand <strong>how popular each T-Bill type is</strong> — demand vs. available supply.</li>
              <li>View <strong>historical trends</strong> across all past auctions.</li>
              <li>Get an <strong>AI-powered prediction</strong> of what the next auction's yield and demand are likely to be.</li>
            </ul>
          </section>

          {/* ── Glossary ── */}
          <section className="help-section">
            <h3 className="help-section-title">📋 Key Concepts Glossary</h3>

            <div className="help-concept">
              <div className="help-concept-label">Treasury Bill (T-Bill)</div>
              <p className="help-text">
                A short-term government security. You invest money today and receive the full face value
                at maturity — the difference is your profit (interest). T-Bills are considered very low-risk
                because they are backed by the government.
              </p>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Maturity / Tenor</div>
              <p className="help-text">How long until you can redeem your T-Bill. The app tracks four:</p>
              <div className="help-table-wrap">
                <table className="help-table">
                  <thead><tr><th>Label</th><th>Tenor</th><th>Notes</th></tr></thead>
                  <tbody>
                    <tr><td><span className="help-tag lime">28 Days</span></td><td>~1 Month</td><td>Shortest — lowest yield, highest liquidity</td></tr>
                    <tr><td><span className="help-tag green">91 Days</span></td><td>~3 Months</td><td>Short-term</td></tr>
                    <tr><td><span className="help-tag amber">182 Days</span></td><td>~6 Months</td><td>Medium-term</td></tr>
                    <tr><td><span className="help-tag white">364 Days</span></td><td>~1 Year</td><td>Longest — typically highest yield</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="help-text help-tip">💡 Longer maturities usually offer higher yields because you lock up your money for longer.</p>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Cut-Off Yield</div>
              <p className="help-text">
                The minimum interest rate the NBE accepted bids at in a given auction — effectively the
                "market clearing price" for that T-Bill. A rising cut-off yield means the government had
                to offer higher rates to attract buyers.
              </p>
              <p className="help-text help-example">Example: A 28-Day cut-off yield of 11.799% means investors earned 11.799% per year on a 28-day investment.</p>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Demand Ratio (Bid-to-Cover, BTC)</div>
              <p className="help-text">
                <strong>Total bids received ÷ Amount offered.</strong> Shows how competitive the auction was.
              </p>
              <div className="help-table-wrap">
                <table className="help-table">
                  <thead><tr><th>Ratio</th><th>Interpretation</th></tr></thead>
                  <tbody>
                    <tr><td>&lt; 1.0×</td><td>Under-subscribed — low demand (rare)</td></tr>
                    <tr><td>~1.0×</td><td>Demand matches supply exactly</td></tr>
                    <tr><td>1.5× – 2.0×</td><td>Healthy demand</td></tr>
                    <tr><td>&gt; 2.5×</td><td>Very high demand — strong investor appetite</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Prediction</div>
              <p className="help-text">
                An AI model estimates the <strong>next auction's yield and demand ratio</strong> based on
                historical patterns. Shown on the metric cards and as the final chart point behind a dashed
                green line. Treat predictions as a directional guide, not as financial advice.
              </p>
            </div>
          </section>

          {/* ── Metric Cards ── */}
          <section className="help-section">
            <h3 className="help-section-title">🃏 Section 1 — Metric Cards</h3>
            <p className="help-text">Four cards sit at the top — one per maturity. Each card contains:</p>
            <div className="help-feature-grid">
              <div className="help-feature-item">
                <span className="help-feature-icon"><TrendingUp size={16} /></span>
                <div><strong>Large % value</strong> — cut-off yield from the most recent auction</div>
              </div>
              <div className="help-feature-item">
                <span className="help-feature-icon">↑↓</span>
                <div><strong>Trend arrow</strong> — change vs. the previous auction (green = up, red = down)</div>
              </div>
              <div className="help-feature-item">
                <span className="help-feature-icon"><BarChart2 size={16} /></span>
                <div><strong>Demand badge</strong> — bid-to-cover ratio for the latest auction</div>
              </div>
              <div className="help-feature-item">
                <span className="help-feature-icon">🔮</span>
                <div><strong>Next Prediction box</strong> — AI estimate of next auction's yield &amp; demand</div>
              </div>
            </div>
          </section>

          {/* ── Chart ── */}
          <section className="help-section">
            <h3 className="help-section-title">📈 Section 2 — Yield &amp; Demand Chart</h3>

            <p className="help-text"><strong>Chart Mode Toggle</strong> (top-left of chart):</p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead><tr><th>Mode</th><th>What is plotted</th><th>Y-axis unit</th></tr></thead>
                <tbody>
                  <tr><td>Cut Off Yield</td><td>Interest rate per maturity over time</td><td>% per year</td></tr>
                  <tr><td>Demand</td><td>Bid-to-cover ratio per maturity over time</td><td>× (times)</td></tr>
                </tbody>
              </table>
            </div>

            <p className="help-text" style={{ marginTop: '0.75rem' }}><strong>Time Period Selector</strong> (top-right of chart):</p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead><tr><th>Button</th><th>Shows data from…</th></tr></thead>
                <tbody>
                  <tr><td>1D</td><td>Most recent auction only</td></tr>
                  <tr><td>5D</td><td>Last 5 auctions</td></tr>
                  <tr><td>1M / 3M / 6M / 1Y</td><td>Last 1 / 3 / 6 months or 1 year</td></tr>
                  <tr><td>ALL</td><td>Entire recorded history</td></tr>
                </tbody>
              </table>
            </div>

            <p className="help-text" style={{ marginTop: '0.75rem' }}><strong>Reading the chart:</strong></p>
            <ul className="help-list">
              <li><span style={{ color: '#bef264' }}>●</span> Light green line = 28 Days</li>
              <li><span style={{ color: '#4ade80' }}>●</span> Green line = 91 Days</li>
              <li><span style={{ color: '#fbbf24' }}>●</span> Amber line = 182 Days</li>
              <li><span style={{ color: '#ffffff' }}>●</span> White line = 364 Days</li>
              <li>Hover over any point to see exact values in a tooltip.</li>
              <li>The <strong>dashed green vertical line</strong> separates historical data from the AI prediction.</li>
            </ul>
          </section>

          {/* ── Table ── */}
          <section className="help-section">
            <h3 className="help-section-title">📋 Section 3 — Auction History Table</h3>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead><tr><th>Column</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td>Date</td><td>Auction date</td></tr>
                  <tr><td>Auction</td><td>Serial auction number</td></tr>
                  <tr><td>Yield (28/91/182/364)</td><td>Cut-off yield for each maturity</td></tr>
                  <tr><td>Demand Ratio (BTC)</td><td>Bid-to-cover ratio per maturity</td></tr>
                  <tr><td>Total Bids (ETB M)</td><td>Total money bid, in millions of Birr</td></tr>
                </tbody>
              </table>
            </div>
            <p className="help-text" style={{ marginTop: '0.75rem' }}>
              Use the <strong>Month</strong> and <strong>Year</strong> dropdowns to filter to a specific period.
              Click <strong>✕ Clear</strong> to remove filters. Click <strong>Show Full History</strong> to
              expand beyond the 5 most recent auctions.
            </p>
          </section>

          {/* ── FAQ ── */}
          <section className="help-section">
            <h3 className="help-section-title">❓ Common Questions</h3>
            <div className="help-faq">
              <div className="help-faq-item">
                <div className="help-faq-q">What currency are bid amounts in?</div>
                <div className="help-faq-a">Ethiopian Birr (ETB), shown in millions. "1,500" means ETB 1.5 billion.</div>
              </div>
              <div className="help-faq-item">
                <div className="help-faq-q">Why does a maturity show "N/A" or "–"?</div>
                <div className="help-faq-a">The NBE doesn't always offer all four maturities at every auction. A "–" means that maturity wasn't offered that time.</div>
              </div>
              <div className="help-faq-item">
                <div className="help-faq-q">How accurate are predictions?</div>
                <div className="help-faq-a">Predictions are statistical estimates based on historical patterns — treat them as a directional guide, not a guarantee. This app does not provide financial advice.</div>
              </div>
              <div className="help-faq-item">
                <div className="help-faq-q">How often is data updated?</div>
                <div className="help-faq-a">Data is sourced from the NBE website and updated after each auction, which typically occurs weekly.</div>
              </div>
              <div className="help-faq-item">
                <div className="help-faq-q">What does a high demand ratio mean for future yields?</div>
                <div className="help-faq-a">High demand (BTC &gt; 2×) often signals the government can afford to offer lower yields next time, so yields may edge down. Low demand pushes yields up.</div>
              </div>
            </div>
          </section>

          {/* ── Data Refresh ── */}
          <section className="help-section">
            <h3 className="help-section-title">🔄 Data Refresh</h3>
            <p className="help-text">
              Every time you load or refresh the page, the app <strong>automatically fetches the latest
              auction results</strong> directly from the NBE website in the background — no manual refresh
              button is needed.
            </p>

            <div className="help-concept">
              <div className="help-concept-label">How it works</div>
              <ul className="help-list">
                <li>When you open the app, the backend sends a live request to <strong>nbe.gov.et/treasury-bills/</strong>.</li>
                <li>It reads every auction accordion on the page, extracting yields, bids, and amounts offered for all four maturities.</li>
                <li>New auctions are <strong>appended</strong> to the historical dataset. Existing records are updated if the NBE corrects a past entry.</li>
                <li>All records are then <strong>sorted chronologically</strong> by auction date before being served to the dashboard.</li>
              </ul>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Deduplication</div>
              <p className="help-text">
                To avoid duplicate rows, every scraped auction is matched against stored records by
                <strong> date</strong> and <strong>auction number</strong>. If a match is found
                the existing record is updated in place; if not, it is added as a new entry.
                This means you always see the most accurate available data without duplicates.
              </p>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Data source &amp; latency</div>
              <p className="help-text">
                Data is sourced exclusively from the <strong>National Bank of Ethiopia (NBE)</strong>
                official website. Results typically appear on the NBE site within 1–2 days of each
                auction. Once published there, they will be visible in this dashboard on your next
                page load.
              </p>
              <p className="help-text help-tip">
                💡 If you suspect data is stale, simply <strong>refresh the page</strong> — that triggers
                a new live scrape automatically.
              </p>
            </div>
          </section>

          {/* ── Prediction Model ── */}
          <section className="help-section">
            <h3 className="help-section-title">🤖 Prediction Model</h3>
            <p className="help-text">
              Predictions are generated by a <strong>Two-Stage Market Simulation</strong> engine that
              runs entirely on the server each time you load the page. It uses real auction history
              — no external AI APIs — and produces separate forecasts for each of the four maturities.
            </p>

            <div className="help-concept">
              <div className="help-concept-label">Stage 1 — Holt's Linear Exponential Smoothing</div>
              <p className="help-text">
                The core algorithm is <strong>Holt's Linear Exponential Smoothing (Double Exponential
                Smoothing)</strong> — a time-series forecasting method that tracks both the
                <em> level</em> (current value) and the <em>trend</em> (direction of change) of a series.
                It is well-suited to financial data that drifts gradually over time.
              </p>
              <div className="help-table-wrap">
                <table className="help-table">
                  <thead><tr><th>Parameter</th><th>What it controls</th><th>Value used</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>α (alpha) — yields</td>
                      <td>How quickly the model reacts to the latest yield observation</td>
                      <td>0.7 (high — emphasises recent data)</td>
                    </tr>
                    <tr>
                      <td>α (alpha) — supply &amp; demand</td>
                      <td>Sensitivity to the latest supply / bids-received figures</td>
                      <td>0.4 (moderate)</td>
                    </tr>
                    <tr>
                      <td>β (beta)</td>
                      <td>How quickly the trend component adapts</td>
                      <td>0.2–0.3 (slow — prevents over-reacting to short spikes)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="help-text" style={{ marginTop: '0.5rem' }}>
                The model uses the most recent <strong>18 auction records</strong> for each maturity,
                giving more influence to recent market conditions while still capturing medium-term patterns.
              </p>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Stage 2 — Demand-Supply Sensitivity Adjustment</div>
              <p className="help-text">
                The raw yield forecast is then adjusted based on <strong>predicted market demand</strong>.
                The model independently forecasts next-auction supply (amount offered) and demand
                (bids received), derives the predicted bid-to-cover ratio (BTC), and applies a
                market-dynamics correction:
              </p>
              <div className="help-table-wrap">
                <table className="help-table">
                  <thead><tr><th>Concept</th><th>Detail</th></tr></thead>
                  <tbody>
                    <tr><td>Baseline BTC</td><td>1.20× — the "neutral" demand level where no adjustment is made</td></tr>
                    <tr><td>Sensitivity factor</td><td>−0.45% yield change per 1× BTC deviation from the baseline</td></tr>
                    <tr><td>High demand (BTC &gt; 1.2×)</td><td>Predicted yield is nudged <strong>down</strong> (government can offer less)</td></tr>
                    <tr><td>Low demand (BTC &lt; 1.2×)</td><td>Predicted yield is nudged <strong>up</strong> (government must offer more)</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="help-text help-example">
                Example: If the model forecasts BTC = 1.8× (0.6 above baseline), the yield is adjusted
                by 0.6 × −0.45 = −0.27% from the base forecast.
              </p>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Prediction outputs</div>
              <p className="help-text">For each maturity the model produces four values:</p>
              <div className="help-table-wrap">
                <table className="help-table">
                  <thead><tr><th>Output</th><th>Where you see it</th></tr></thead>
                  <tbody>
                    <tr><td>Predicted Yield (%)</td><td>Metric card prediction box + last chart point (Yield mode)</td></tr>
                    <tr><td>Predicted BTC (×)</td><td>Metric card prediction box + last chart point (Demand mode)</td></tr>
                    <tr><td>Predicted Supply</td><td>Used internally for BTC calculation</td></tr>
                    <tr><td>Predicted Demand</td><td>Used internally for BTC calculation</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="help-concept">
              <div className="help-concept-label">Limitations</div>
              <ul className="help-list">
                <li><strong>3-record minimum:</strong> The app’s math needs to see at least <strong>three past auctions</strong> to understand the "rhythm" of the market. If a specific T-Bill hasn't been sold at least three times recently, the app won't make a guess because it doesn't have enough history to be useful.</li>
                <li><strong>Can't predict policy shocks:</strong> The app only knows what happened in the <strong>past</strong>. It has no way of knowing if the National Bank suddenly changes the law, if there is a major news event, or a sudden change in economic policy tomorrow.</li>
                <li><strong>Shorter maturities more reliable:</strong> It is much easier to predict what will happen in a few weeks (28 days) than what will happen a year from now. Shorter-term rates are usually steadier, while longer-term rates can jump around more, making them harder to guess.</li>
                <li><strong>Recalculated fresh every load:</strong> The app doesn't store "old" predictions. Every single time you open or refresh the page, the computer re-runs all its math using the very latest information available.</li>
              </ul>
            </div>
          </section>

        </div>{/* end body */}
      </div>
    </div>
  );

  return (
    <>
      {showHelp && <HelpModal />}
      <header className="dashboard-header">
        <Activity color="var(--accent)" size={28} />
        <h1>NBE Treasury Bills Yield Predictor</h1>
        <button
          className="help-btn"
          onClick={() => setShowHelp(true)}
          title="Open Help Guide"
          aria-label="Open Help Guide"
        >
          <HelpCircle size={19} />
          <span>Help</span>
        </button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>
                {chartMode === 'yield' ? 'Cut Off Yield Trends & Prediction' : 'Demand (BTC) Trends & Prediction'}
              </h2>
              <div className="chart-mode-selector">
                <button
                  className={`mode-btn ${chartMode === 'yield' ? 'active' : ''}`}
                  onClick={() => setChartMode('yield')}
                >
                  Cut Off Yield
                </button>
                <button
                  className={`mode-btn ${chartMode === 'demand' ? 'active' : ''}`}
                  onClick={() => setChartMode('demand')}
                >
                  Demand
                </button>
              </div>
            </div>
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
                <YAxis
                  stroke="var(--text-secondary)"
                  tick={{fontSize: 12}}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => chartMode === 'yield' ? `${v}%` : `${v}x`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--accent)' }}
                  separator=": "
                  itemSorter={(item: any) => -(item.value || 0)}
                  formatter={(value: any, name: any) => {
                    const formattedValue = Number(value).toFixed(3);
                    if (chartMode === 'demand') {
                      return [`${formattedValue}x`, `${name} BTC`];
                    }
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
