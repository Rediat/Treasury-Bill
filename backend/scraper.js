const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.VERCEL 
    ? path.join('/tmp', 'data.json') 
    : path.join(__dirname, 'data.json');

async function scrapeNBE() {
  try {
    const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
    const $ = cheerio.load(data);
    let newEntries = [];

    let currentAuctionDate = null;
    let currentAuctionNo = null;

    // Loop through all tables
    $('table').each((i, table) => {
       const text = $(table).text();
       
       if (text.includes('Held on') || text.includes('Results of Treasury Bills Auction')) {
           // Try to find the date from this table
           $(table).find('tr, p, div, span, td').each((j, el) => {
               const elText = $(el).text().trim();
               const match = elText.match(/Auction No:\s*(.*?),\s*Held on\s*(.*)/i);
               if (match) {
                   currentAuctionNo = match[1].trim();
                   currentAuctionDate = match[2].trim();
               }
           });
       }

       if (text.includes('Cut Off Yield') || text.includes('Cut Off Price')) {
           let cutOffYields = {};
           let weightedAverageYields = {};
           
           $(table).find('tr').each((j, tr) => {
               const tds = [];
               $(tr).find('td, th').each((k, td) => {
                   tds.push($(td).text().trim());
               });

               if (tds[0] && tds[0].includes('Cut Off Yield')) {
                   cutOffYields = {
                       "28_days": parseFloat(tds[1]) || null,
                       "91_days": parseFloat(tds[2]) || null,
                       "182_days": parseFloat(tds[3]) || null,
                       "364_days": parseFloat(tds[4]) || null
                   };
               }
               if (tds[0] && tds[0].includes('Weighted Average Yield')) {
                   weightedAverageYields = {
                       "28_days": parseFloat(tds[1]) || null,
                       "91_days": parseFloat(tds[2]) || null,
                       "182_days": parseFloat(tds[3]) || null,
                       "364_days": parseFloat(tds[4]) || null
                   };
               }
           });
           
           if (currentAuctionDate && Object.keys(cutOffYields).length > 0) {
               newEntries.push({
                   auctionNo: currentAuctionNo,
                   date: currentAuctionDate,
                   cutOffYields,
                   weightedAverageYields,
                   timestamp: new Date(currentAuctionDate).getTime() || Date.now()
               });
               // Reset
               currentAuctionDate = null;
               currentAuctionNo = null;
           }
       }
    });

    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch(e) {}
    }

    // Merge maintaining old data
    let appendedCount = 0;
    for (let entry of newEntries) {
        if (!existingData.find(d => d.date === entry.date)) {
            existingData.push(entry);
            appendedCount++;
        }
    }

    // Sort by timestamp
    existingData.sort((a, b) => a.timestamp - b.timestamp);

    fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 2));
    console.log(`Scrape finished. Appended ${appendedCount} new entries.`);
    return { success: true, appendedCount };

  } catch (error) {
    console.error('Error scraping:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { scrapeNBE };

if (require.main === module) {
    scrapeNBE();
}
