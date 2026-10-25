const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadQuotes, catalog, losAngelesParts, shouldPostToday } = require('./lib/quotes');
const { renderLedgerCard } = require('./lib/card');
const { pick, isSunday } = require('./lib/select');

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed\n${result.stderr || result.stdout || ''}`);
  }
  return result.stdout;
}

async function main() {
  if (!shouldPostToday()) {
    console.log('Outside 6-11 AM America/Los_Angeles. Skipping the reel.');
    return;
  }

  const quotes = loadQuotes();
  const items = catalog(quotes);
  const la = losAngelesParts();
  const outDir = path.join(__dirname, '..', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const selectionPath = path.join(outDir, 'selection.json');
  let quote;
  let date = la.date;
  let dark = isSunday(date);
  if (fs.existsSync(selectionPath)) {
    const saved = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
    quote = items.find((item) => item.idx === saved.idx) || null;
    if (saved.date) date = saved.date;
    if (typeof saved.dark === 'boolean') dark = saved.dark;
  }
  if (!quote) quote = pick(items, date, []);

  const png = path.join(outDir, 'quote-story.png');
  const mp4 = path.join(outDir, 'quote-reel.mp4');
  fs.writeFileSync(png, await renderLedgerCard(quote, { date, dark, layout: 'story' }));

  const filter = [
    "zoompan=z='min(zoom+0.00035\\,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=210:s=1080x1920:fps=30",
    'fade=t=in:st=0:d=0.8',
    'fade=t=out:st=6.15:d=0.85',
    'format=yuv420p',
  ].join(',');

  run('ffmpeg', [
    '-y',
    '-loop', '1',
    '-i', png,
    '-vf', filter,
    '-frames:v', '210',
    '-r', '30',
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4,
  ]);

  const probe = JSON.parse(run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=width,height,codec_type',
    '-of', 'json',
    mp4,
  ]));
  const video = (probe.streams || []).find((stream) => stream.codec_type === 'video');
  const audio = (probe.streams || []).find((stream) => stream.codec_type === 'audio');
  const duration = Number(probe.format && probe.format.duration);
  if (!video || video.width !== 1080 || video.height !== 1920) {
    throw new Error(`Unexpected reel size ${video && video.width}x${video && video.height}`);
  }
  if (audio) throw new Error('Reel must be silent');
  if (!(duration >= 6 && duration <= 8)) throw new Error(`Reel duration ${duration}s is outside 6–8s`);

  console.log(`Reel ${date} ${quote.slug}: ${video.width}x${video.height}, ${duration.toFixed(2)}s, no audio`);
  console.log(mp4);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
