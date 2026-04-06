const axios = require('axios');
const cheerio = require('cheerio');

async function debugScraper() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        const regex = /AUCTION RESULTS?\s*\|\s*[^|]*?,?\s*([a-zA-Z]{3,}\s*\d{1,2}.*?\d{4})/i;
        
        let countAll = 0;
        let countMatched = 0;
        
        $('.elementor-accordion-item').each((i, item) => {
            const titleText = $(item).find('.elementor-accordion-title').text().trim();
            if (titleText.toUpperCase().includes('AUCTION RESULT')) {
                countAll++;
                const match = titleText.match(regex);
                if (match) {
                    countMatched++;
                    console.log(`[MATCH] "${titleText}" -> Date: "${match[1]}"`);
                } else {
                    console.log(`[FAIL ] "${titleText}"`);
                }
            }
        });
        console.log(`\nDirect check: Found ${countAll} items, ${countMatched} matched.`);
    } catch (e) {
        console.error(e);
    }
}

debugScraper();
