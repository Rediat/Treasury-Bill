const axios = require('axios');
const cheerio = require('cheerio');

async function debugTitles() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        console.log('--- ALL AUCTION TITLES ---');
        $('.elementor-accordion-item .elementor-accordion-title').each((i, e) => {
            const t = $(e).text().trim();
            if (t.toUpperCase().includes('AUCTION RESULT')) {
                console.log(`[${i}] Title: "${t}"`);
            }
        });
    } catch (err) {
        console.error(err);
    }
}
debugTitles();
