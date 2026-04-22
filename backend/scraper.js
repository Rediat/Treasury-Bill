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

            // Extraction of Auction No from the accordion content
            const contextText = $(item).text();
            const noMatch = contextText.match(/Auction No:\s*([\d\w/thstndrd]+)/i);
            if (noMatch) {
                currentAuctionNo = noMatch[1].trim();
            }

            const rows = $(item).find('tr');
            let cutOffYields = {};
            let weightedAverageYields = {};
            let amountOffered = {};
            let bidsReceived = {};
            let amountAccepted = {};
            
            // Standard Table Row Extraction
            rows.each((j, tr) => {
                const tds = [];
                $(tr).find('td, th').each((k, td) => {
                    tds.push($(td).text().trim().replace(/,/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' '));
                });

                if (tds.length >= 5) {
                    let labelIdx = 0;
                    // Check if the first cell is empty and the second might be the label
                    if (tds[0] === '' && tds[1] !== '') {
                        labelIdx = 1;
                    }

                    const rowLabel = tds[labelIdx].toLowerCase();
                    const values = {
                        "28_days": parseFloat(tds[labelIdx + 1]) || null,
                        "91_days": parseFloat(tds[labelIdx + 2]) || null,
                        "182_days": parseFloat(tds[labelIdx + 3]) || null,
                        "364_days": parseFloat(tds[labelIdx + 4]) || null
                    };

                    if (rowLabel.includes('cut off yield')) cutOffYields = values;
                    else if (rowLabel.includes('weighted average yield')) weightedAverageYields = values;
                    else if (rowLabel.includes('amount offered')) amountOffered = values;
                    else if (rowLabel.includes('bids received')) bidsReceived = values;
                    else if (rowLabel.includes('amount accepted')) amountAccepted = values;
                }
            });

            // Fallback: If still empty (e.g., malformed tables or text-based layouts),
            // try a regex search of the entire accordion content for keyword-rich lines.
            if (Object.keys(cutOffYields).length === 0 && Object.keys(amountOffered).length === 0) {
                const text = $(item).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
                
                // Helper to extract values from text blocks
                const extractFromText = (keyword) => {
                    // Match the keyword, then look for up to 4 numbers on the SAME line/context.
                    // We use [^\\n]*? to ensure we stay within the same text block/row.
                    const regex = new RegExp(`${keyword}[^\\d\\n]*?(\\d+\\.\\d+)?(?:[^\\d\\n]+(\\d+\\.\\d+))?(?:[^\\d\\n]+(\\d+\\.\\d+))?(?:[^\\d\\n]+(\\d+\\.\\d+))?`, "i");
                    const match = text.match(regex);
                    if (match) {
                        return {
                            "28_days": match[1] ? parseFloat(match[1]) : null,
                            "91_days": match[2] ? parseFloat(match[2]) : null,
                            "182_days": match[3] ? parseFloat(match[3]) : null,
                            "364_days": match[4] ? parseFloat(match[4]) : null
                        };
                    }
                    return null;
                };

                cutOffYields = extractFromText('Cut[\\s-]off Yield') || {};
                weightedAverageYields = extractFromText('Weighted Average Yield') || {};
                amountOffered = extractFromText('Amount Offered') || {};
                bidsReceived = extractFromText('Bids Received') || {};
                amountAccepted = extractFromText('Amount Accepted') || {};
            }
            
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
            // Preserve auctionNo if it already exists and the new one is null
            const existing = existingData[existingIndex];
            existingData[existingIndex] = { 
                ...existing, 
                ...entry,
                auctionNo: entry.auctionNo || existing.auctionNo
            };
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
