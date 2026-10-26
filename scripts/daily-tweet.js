const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');
const {
  loadQuotes,
  catalog,
  losAngelesParts,
  buildTweetText,
  buildReplyText,
  isDryRun,
  shouldPostToday,
} = require('./lib/quotes');
const { renderLedgerCard } = require('./lib/card');
const { pick, isSunday } = require('./lib/select');

const root = path.join(__dirname, '..');
const stateDir = path.join(root, 'state');
const historyPath = path.join(stateDir, 'history.json');
const lastPostedPath = path.join(stateDir, 'last-posted.txt');

function readHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.posts)) return data.posts;
  } catch (_) { /* first run */ }
  return [];
}

function writeState(date, entry) {
  const posts = readHistory().filter((post) => post.date !== date);
  posts.push(entry);
  posts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const body = `${JSON.stringify({ posts }, null, 2)}\n`;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(historyPath, body);
  fs.writeFileSync(lastPostedPath, `${date}\n`);
  // The homepage reads this copy so the site and the post stay on the same quote.
  fs.writeFileSync(path.join(root, 'public', 'history.json'), body);
}

function resolveNow() {
  const override = String(process.env.POST_DATE || '').trim();
  if (isDryRun() && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return new Date(`${override}T12:00:00Z`);
  }
  return new Date();
}

async function main() {
  if (!shouldPostToday()) {
    console.log('Outside 6-9 AM America/Los_Angeles. Leaving the post unsent.');
    return;
  }

  const quotes = loadQuotes();
  const items = catalog(quotes);
  const now = resolveNow();
  const la = losAngelesParts(now);
  const history = readHistory();
  const quote = pick(items, la.date, history);
  const text = buildTweetText(quote);
  const replyText = buildReplyText();
  const dryRun = isDryRun();
  const dark = isSunday(la.date);

  if (/axitome\.com|https?:\/\//i.test(text)) {
    throw new Error('Tweet text must not include a URL');
  }
  if (text.length > 280) throw new Error(`Tweet is ${text.length} characters`);
  if (!/axitome\.com/i.test(replyText)) throw new Error('Reply must include axitome.com');

  const outDir = path.join(root, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const imagePath = path.join(outDir, 'quote-card.png');
  fs.writeFileSync(imagePath, await renderLedgerCard(quote, { date: la.date, dark }));
  fs.writeFileSync(path.join(outDir, 'selection.json'), `${JSON.stringify({
    date: la.date,
    idx: quote.idx,
    slug: quote.slug,
    theme: quote.theme,
    dark,
  })}\n`);

  const real = losAngelesParts();
  const override = la.date !== real.date ? ` (POST_DATE override; real ${real.date} hour ${real.hour})` : '';
  console.log(`Pacific date ${la.date} hour ${la.hour}${override}; index ${quote.idx}; theme ${quote.theme}; slug ${quote.slug}`);
  console.log(`Author: ${quote.a}${quote.s ? ` (${quote.s})` : ''}`);
  console.log(`Dark card: ${dark}`);
  console.log(`Card bytes: ${fs.statSync(imagePath).size}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('Tweet text:');
  console.log(text);
  console.log('Reply text:');
  console.log(replyText);

  let tweetId = null;
  if (!dryRun) {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    const mediaId = await client.v1.uploadMedia(imagePath);
    const result = await client.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });
    tweetId = result && result.data && result.data.id ? result.data.id : null;
    if (!tweetId) throw new Error('Tweet was sent but no id came back');
    // Record the Pacific date before the reply so a later failure cannot
    // leave the day unmarked and post a second time.
    writeState(la.date, {
      date: la.date,
      idx: quote.idx,
      theme: quote.theme,
      author: quote.a,
      slug: quote.slug,
      tweetId,
    });
    console.log(`Posted ${tweetId}`);
    const reply = await client.v2.reply(replyText, tweetId);
    const replyId = reply && reply.data && reply.data.id ? reply.data.id : null;
    console.log(`Replied ${replyId}`);
  } else {
    console.log('DRY_RUN set. Card rendered. Nothing posted.');
  }

  const entry = {
    date: la.date,
    idx: quote.idx,
    slug: quote.slug,
    theme: quote.theme,
    author: quote.a,
    source: quote.s || null,
    angle: quote.angle || null,
    tweetId,
    dryRun,
    dark,
    text,
    replyText,
  };
  const logPath = path.join(outDir, 'tweet-log.jsonl');
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  console.log(`Logged ${logPath}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '### Daily quote',
      '',
      `- Date: ${la.date}`,
      `- Theme: ${quote.theme}`,
      `- Index: ${quote.idx}`,
      `- Slug: ${quote.slug}`,
      `- Dry run: ${dryRun}`,
      `- Tweet id: ${tweetId || '(not posted)'}`,
      '',
      '```',
      text,
      '```',
      '',
      'Reply:',
      '',
      '```',
      replyText,
      '```',
      '',
    ].join('\n'));
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
