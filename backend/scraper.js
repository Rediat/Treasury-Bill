const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.VERCEL 
    ? path.join('/tmp', 'data.json') 
    : path.join(__dirname, 'data.json');

function normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    // Clean string: remove "st", "nd", "rd", "th", commas, and extra spaces
    // e.g., "October 1st,  2025" -> "October 1 2025"
    let clean = dateStr.replace(/(\d+)(st|nd|rd|th),?/g, '$1')
                       .replace(/,/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
    
    const dateObj = new Date(clean);
    if (isNaN(dateObj.getTime())) return dateStr; // Fallback to original if parsing fails

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[dateObj.getMonth()];
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${month} ${day}, ${year}`;
}

async function scrapeNBE() {
  try {
    const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
    const $ = cheerio.load(data);
    let newEntries = [];

    // NBE uses Elementor accordions for auction results
    $('.elementor-accordion-item').each((i, item) => {
        const titleText = $(item).find('.elementor-accordion-title').text().trim();
        
        // Support both "AUCTION RESULT" and "AUCTION RESULTS" - Case insensitive
        if (titleText.toUpperCase().includes('AUCTION RESULT')) {
            
            // Extract date from title: e.g., "AUCTION RESULTS | Wednesday, October 1st, 2025"
            // Handles various typos like missing spaces or commas
            const dateMatch = titleText.match(/AUCTION RESULTS?\s*\|\s*.*?([a-zA-Z]{3,}\s*\d{1,2}[^\d]*\d{4})/i);
            
            if (!dateMatch) {
                return;
            }

            let rawDate = dateMatch[1].trim();
            let currentAuctionDate = normalizeDate(rawDate);
            let currentAuctionNo = null;

            const rows = $(item).find('tr');
            if (rows.length === 0) {
                return;
            }

            // Extraction of Auction No from the accordion content
            const contextText = $(item).text();
            const noMatch = contextText.match(/Auction No:\s*([\d\w/thstndrd]+)/i);
            if (noMatch) {
                currentAuctionNo = noMatch[1].trim();
            }

            let cutOffYields = {};
            let weightedAverageYields = {};
            let amountOffered = {};
            let bidsReceived = {};
            let amountAccepted = {};
            
            rows.each((j, tr) => {
                const tds = [];
                $(tr).find('td, th').each((k, td) => {
                    // Remove commas and non-breaking spaces
                    tds.push($(td).text().trim().replace(/,/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' '));
                });

                if (tds.length > 0) {
                    const rowLabel = tds[0].toLowerCase();
                    const values = {
                        "28_days": parseFloat(tds[1]) || null,
                        "91_days": parseFloat(tds[2]) || null,
                        "182_days": parseFloat(tds[3]) || null,
                        "364_days": parseFloat(tds[4]) || null
                    };

                    if (rowLabel.includes('cut off yield')) {
                        cutOffYields = values;
                    } else if (rowLabel.includes('weighted average yield')) {
                        weightedAverageYields = values;
                    } else if (rowLabel.includes('amount offered')) {
                        amountOffered = values;
                    } else if (rowLabel.includes('bids received')) {
                        bidsReceived = values;
                    } else if (rowLabel.includes('amount accepted')) {
                        amountAccepted = values;
                    }
                }
            });
            
            if (currentAuctionDate && (Object.keys(cutOffYields).length > 0 || Object.keys(amountOffered).length > 0)) {
                newEntries.push({
                    auctionNo: currentAuctionNo,
                    date: currentAuctionDate,
                    cutOffYields,
                    weightedAverageYields,
                    amountOffered,
                    bidsReceived,
                    amountAccepted,
                    timestamp: new Date(currentAuctionDate).getTime() || Date.now()
                });
            }
        }
    });

    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch(e) {}
    }

    // Merge maintaining old data, update if exists
    let appendedCount = 0;
    for (let entry of newEntries) {
        // Use normalized date for comparison
        let existingIndex = existingData.findIndex(d => d.date === entry.date || (d.auctionNo && d.auctionNo === entry.auctionNo));
        if (existingIndex === -1) {
            existingData.push(entry);
            appendedCount++;
        } else {
            // Update existing with new fields/standardized date
            existingData[existingIndex] = { ...existingData[existingIndex], ...entry };
        }
    }

    // Sort by timestamp
    existingData.sort((a, b) => a.timestamp - b.timestamp);

    fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2));
    console.log(`Scrape finished. Found ${newEntries.length} auctions. Added/Updated ${appendedCount} entries.`);
    return { success: true, count: newEntries.length };

  } catch (error) {
    console.error('Error scraping:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { scrapeNBE };

if (require.main === module) {
    scrapeNBE();
}
