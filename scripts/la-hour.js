const fs = require('fs');
const { losAngelesHour } = require('./lib/quotes');

const event = process.env.GITHUB_EVENT_NAME || 'local';
const hour = losAngelesHour();
const run = event !== 'schedule' || hour === 6;
const line = `run=${run ? 'true' : 'false'}\nhour=${hour}\n`;
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
console.log(`America/Los_Angeles hour ${hour}; event ${event}; continue ${run}`);
process.exit(0);
