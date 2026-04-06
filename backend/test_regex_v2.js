const strings = [
    "AUCTION RESULTS | Wednesday,October 1st,  2025",
    "AUCTION RESULTS | Wednesday,October 15th 2025",
    "AUCTION RESULTS | Wednesday, October 29th, 2025",
    "AUCTION RESULTS | Wednesday, November 12th, 2025"
];
const regex = /AUCTION RESULTS?\s*\|\s*.*?([a-zA-Z]{3,}\s*\d{1,2}[^\d]*\d{4})/i;

strings.forEach(s => {
    const m = s.match(regex);
    console.log(`"${s}" -> ${m ? m[1] : "[FAIL]"}`);
});
