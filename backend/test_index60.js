const axios = require('axios');
const cheerio = require('cheerio');

async function debugHTML() {
    try {
        const { data } = await axios.get('https://nbe.gov.et/treasury-bills/');
        const $ = cheerio.load(data);
        const item = $('.elementor-accordion-item').eq(60); 
        console.log('--- HTML for Index 60 ---');
        console.log($(item).html());
        
        console.log('--- ALL TR CONTEN ---');
        $(item).find('tr').each((i, tr) => {
            console.log(`Row ${i}: ${$(tr).text().trim()}`);
        });
    } catch (err) {
        console.error(err);
    }
}
debugHTML();
