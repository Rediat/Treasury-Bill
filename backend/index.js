const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { scrapeNBE } = require('./scraper');

const app = express();
app.use(cors());

const DATA_FILE = path.join(__dirname, 'data.json');

// Helper to perform Holt's Linear Exponential Smoothing prediction
function predictNext(dataPoints) {
    const n = dataPoints.length;
    if (n < 2) return null;
    
    // Sort by index just in case
    const sorted = [...dataPoints].sort((a,b) => a[0] - b[0]);
    
    // Smoothing parameters
    const alpha = 0.7; // Responsiveness
    const beta = 0.3;  // Trend tracking
    
    let L = sorted[0][1];
    let T = sorted[1][1] - sorted[0][1];
    
    for (let i = 1; i < n; i++) {
        const Y = sorted[i][1];
        const lastL = L;
        L = alpha * Y + (1 - alpha) * (lastL + T);
        T = beta * (L - lastL) + (1 - beta) * T;
    }
    
    return L + T;
}

app.get('/api/data', async (req, res) => {
    try {
        // Trigger a background scrape on load if you want
        scrapeNBE(); // fire and forget to appended new data
        
        let data = [];
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
        
        // Compute predictions
        let predictions = {};
        
        // We will predict the next cutoff yield for each period
        ['28_days', '91_days', '182_days', '364_days'].forEach(period => {
             // get all valid points
             const points = [];
             data.forEach((d, idx) => {
                 if (d.cutOffYields && d.cutOffYields[period] !== null && !isNaN(d.cutOffYields[period])) {
                     points.push([idx, d.cutOffYields[period]]);
                 }
             });
             predictions[period] = predictNext(points);
        });
        
        res.json({ data, predictions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
