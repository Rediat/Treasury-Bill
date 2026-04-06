const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function debug() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        const results = [];
        [3, 33, 34, 60].forEach(idx => {
            const item = $('.elementor-accordion-item').eq(idx);
            const title = $(item).find('.elementor-accordion-title').text().trim();
            const rows = [];
            $(item).find('tr').each((i, tr) => {
                const cells = [];
                $(tr).find('td, th').each((j, td) => cells.push($(td).text().trim()));
                rows.push(cells.join(' | '));
            });
            results.push({ idx, title, rows });
        });
        fs.writeFileSync('missing_debug.json', JSON.stringify(results, null, 2));
    } catch(err) { console.error(err); }
}
debug();
