const str1 = "AUCTION RESULTS | Wednesday,October 1st,  2025";
const str2 = "AUCTION RESULTS | Wednesday,October 15th 2025";
const regex = /AUCTION RESULTS?\s*\|\s*[^|]*?,?\s*([a-zA-Z]{3,}\s*\d{1,2}.*?\d{4})/i;

console.log(`Str 1 Match:`, str1.match(regex)?.[1]);
console.log(`Str 2 Match:`, str2.match(regex)?.[1]);
