const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');
const {
  loadQuotes,
  catalog,
  dayIndex,
  losAngelesParts,
  buildTweetText,
  isDryRun,
  shouldPostToday,
} = require('./lib/quotes');
const { renderQuoteCard } = require('./lib/card');

async function main() {
  if (!shouldPostToday()) {
    console.log('Not 6:00 America/Los_Angeles. Leaving the post unsent.');
    return;
  }

  const quotes = loadQuotes();
  const items = catalog(quotes);
  const now = new Date();
  const la = losAngelesParts(now);
  const idx = dayIndex(quotes, now);
  const quote = items[idx];
  const text = buildTweetText(quote);
  const dryRun = isDryRun();

  if (/axitome\.com|https?:\/\//i.test(text)) {
    throw new Error('Tweet text must not include a URL');
  }
  if (text.length > 280) throw new Error(`Tweet is ${text.length} characters`);

  const outDir = path.join(__dirname, '..', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const imagePath = path.join(outDir, 'quote-card.png');
  fs.writeFileSync(imagePath, renderQuoteCard(quote, 'square'));

  console.log(`Pacific date ${la.date} hour ${la.hour}; index ${idx}; slug ${quote.slug}`);
  console.log(`Author: ${quote.a}${quote.s ? ` (${quote.s})` : ''}`);
  console.log(`Card bytes: ${fs.statSync(imagePath).size}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('Tweet text:');
  console.log(text);

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
    console.log(`Posted ${tweetId}`);
  } else {
    console.log('DRY_RUN set. Card rendered. Nothing posted.');
  }

  const entry = {
    date: la.date,
    idx,
    slug: quote.slug,
    author: quote.a,
    source: quote.s || null,
    tweetId,
    dryRun,
    text,
  };
  const logPath = path.join(outDir, 'tweet-log.jsonl');
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
  console.log(`Logged ${logPath}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '### Daily quote',
      '',
      `- Date: ${la.date}`,
      `- Index: ${idx}`,
      `- Slug: ${quote.slug}`,
      `- Dry run: ${dryRun}`,
      `- Tweet id: ${tweetId || '(not posted)'}`,
      '',
      '```',
      text,
      '```',
      '',
    ].join('\n'));
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
