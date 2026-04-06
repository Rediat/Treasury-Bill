const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function debugAll() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        const list = [];
        $('.elementor-accordion-item').each((i, e) => {
            const title = $(e).find('.elementor-accordion-title').text().trim();
            const content = $(e).find('.elementor-accordion-content').text().trim();
            list.push({ i, title, contentLen: content.length, contentPreview: content.substring(0, 100) });
        });
        fs.writeFileSync('all_accordions.json', JSON.stringify(list, null, 2));
    } catch(err) { console.error(err); }
}
debugAll();
