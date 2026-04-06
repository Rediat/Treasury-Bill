const axios = require('axios');
const cheerio = require('cheerio');

async function debugData() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        $('.elementor-accordion-item').each((i, item) => {
            const titleText = $(item).find('.elementor-accordion-title').text().trim();
            if (titleText.toUpperCase().includes('AUCTION RESULT')) {
                const rows = $(item).find('tr');
                let foundData = false;
                rows.each((j, tr) => {
                    const rowLabel = $(tr).find('td, th').first().text().toLowerCase();
                    if (rowLabel.includes('cut off yield') || rowLabel.includes('amount offered')) {
                        foundData = true;
                    }
                });
                if (!foundData) {
                    console.log(`[NO DATA ROWS] Index ${i}: "${titleText}"`);
                }
            }
        });
    } catch (err) {
        console.error(err);
    }
}
debugData();
