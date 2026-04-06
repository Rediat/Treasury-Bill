const axios = require('axios');
const cheerio = require('cheerio');

const regex = /AUCTION RESULTS?\s*\|\s*.*?([a-zA-Z]{3,}\s*\d{1,2}[^\d]*\d{4})/i;

async function checkAll() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        let count = 0;
        let matchCount = 0;
        $('.elementor-accordion-item .elementor-accordion-title').each((i, e) => {
            const t = $(e).text().trim();
            if (t.toUpperCase().includes('AUCTION RESULT')) {
                count++;
                const match = t.match(regex);
                if (match) {
                    matchCount++;
                } else {
                    console.log(`[FAILED MATCH] Index ${i}: "${t}"`);
                }
            }
        });
        console.log(`Total "AUCTION RESULT" titles: ${count}`);
        console.log(`Matched by regex: ${matchCount}`);
        console.log(`Missing from regex: ${count - matchCount}`);
    } catch (err) {
        console.error(err);
    }
}
checkAll();
