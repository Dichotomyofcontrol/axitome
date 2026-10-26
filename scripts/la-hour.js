const fs = require('fs');
const path = require('path');
const { losAngelesParts } = require('./lib/quotes');

// Scheduled runs may post from 6:00 through 9:59 AM Pacific, once per Pacific
// day. state/last-posted.txt (committed by the workflow after a real post)
// holds the YYYY-MM-DD of the last successful post. A manual dispatch ignores
// the clock, so a missed morning can still go out, and still will not post
// again once that date is recorded.
const WINDOW_START = 6;
const WINDOW_END = 9;
const STATE = path.join(__dirname, '..', 'state', 'last-posted.txt');

const event = process.env.GITHUB_EVENT_NAME || 'local';
const { hour, date } = losAngelesParts();
let last = '';
try { last = fs.readFileSync(STATE, 'utf8').trim(); } catch (_) { /* first run */ }
const inWindow = hour >= WINDOW_START && hour <= WINDOW_END;
const already = last === date;
const bypassWindow = event !== 'schedule';
const run = !already && (bypassWindow || inWindow);
const line = `run=${run ? 'true' : 'false'}\nhour=${hour}\ndate=${date}\nalready=${already}\n`;
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
console.log(`America/Los_Angeles ${date} hour ${hour}; event ${event}; last posted ${last || '(none)'}; continue ${run}`);
process.exit(0);
