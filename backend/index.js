const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { scrapeNBE } = require('./scraper');

const app = express();
app.use(cors());

const DATA_FILE = process.env.VERCEL 
    ? path.join('/tmp', 'data.json') 
    : path.join(__dirname, 'data.json');

// Initialize /tmp/data.json from bundle if on Vercel
if (process.env.VERCEL && !fs.existsSync(DATA_FILE)) {
    try {
        const bundleData = path.join(__dirname, 'data.json');
        if (fs.existsSync(bundleData)) {
            fs.copyFileSync(bundleData, DATA_FILE);
        }
    } catch (e) {
        console.error('Failed to initialize /tmp/data.json:', e);
    }
}

// Helper for Holt's Linear Exponential Smoothing
function holtLinearUpdate(series, alpha = 0.5, beta = 0.3) {
    if (series.length < 2) return series[0] || null;
    
    let L = series[0];
    let T = series[1] - series[0];
    
    for (let i = 1; i < series.length; i++) {
        let Y = series[i];
        let lastL = L;
        L = alpha * Y + (1 - alpha) * (lastL + T);
        T = beta * (L - lastL) + (1 - beta) * T;
    }
    
    return L + T;
}

// Advanced Prediction Engine: Two-Stage Market Simulation
function predictNextYield(data, period) {
    // 1. Minimum data check
    const validPoints = data.filter(d => 
        d.cutOffYields && d.cutOffYields[period] !== null &&
        d.weightedAverageYields && d.weightedAverageYields[period] !== null &&
        d.amountOffered && d.amountOffered[period] !== null &&
        d.bidsReceived && d.bidsReceived[period] !== null
    );

    if (validPoints.length < 3) return null;

    // 2. Predict Future Supply (Amount Offered)
    const supplySeries = validPoints.map(d => d.amountOffered[period]).slice(-18);
    const predictedSupply = holtLinearUpdate(supplySeries, 0.4, 0.2);

    // 3. Predict Future Demand (Bids Received)
    const demandSeries = validPoints.map(d => d.bidsReceived[period]).slice(-18);
    const predictedDemand = holtLinearUpdate(demandSeries, 0.4, 0.2);

    // 4. Calculate Predicted Bid-to-Cover (BTC) Ratio
    const predictedBTC = (predictedSupply > 0) ? (predictedDemand / predictedSupply) : 1.0;

    // 5. Predict Yield Trends (Base Forecasts)
    const yieldSeries = validPoints.map(d => d.cutOffYields[period]).slice(-18);
    const weightedSeries = validPoints.map(d => d.weightedAverageYields[period]).slice(-18);
    
    // Use higher alpha for yields to respond to recent market shifts
    const baseYieldForecast = holtLinearUpdate(yieldSeries, 0.7, 0.3);
    const baseWeightedForecast = holtLinearUpdate(weightedSeries, 0.7, 0.3);

    // 6. Apply Demand-Supply Sensitivity Adjustment
    const demandSensitivity = -0.45; // Yield % change per unit of BTC deviation from 1.2
    const btcDeviation = predictedBTC - 1.20;
    
    const finalYield = baseYieldForecast + (btcDeviation * demandSensitivity);
    const finalWeightedYield = baseWeightedForecast + (btcDeviation * demandSensitivity);

    return {
        yield: finalYield,
        weightedYield: finalWeightedYield,
        btc: predictedBTC,
        supply: predictedSupply,
        demand: predictedDemand
    };
}

app.get('/api/data', async (req, res) => {
    try {
        // Trigger a background scrape on load
        await scrapeNBE(); 
        
        let data = [];
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
        
        // Compute predictions using all historical results
        let predictions = {};
        ['28_days', '91_days', '182_days', '364_days'].forEach(period => {
             predictions[period] = predictNextYield(data, period);
         });
        
        res.json({ data, predictions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
    });
}

module.exports = app;
