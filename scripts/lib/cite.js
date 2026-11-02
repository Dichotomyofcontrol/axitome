// Turn the source notes already stored on a quote into work / passage /
// translator, and a status of verified, disputed, or unverified.
// Nothing here invents a citation. If `s` does not parse cleanly, the
// whole note stays as the work. Status comes only from the existing
// attribution field and, for a corrected line, from what its note says
// about the stored wording.

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripTranslatorYear(value) {
  return clean(value).replace(/\s*\(\d{4}(?:\s*[–-]\s*\d{2,4})?\)\s*$/, '');
}

// The stored English is not the sentence the note cites.
function wordingIsLoose(quote) {
  const note = quote.attributionNote || '';
  const text = quote.q || '';
  if (/familiar form by/i.test(note)) return true;
  if (/later compression/i.test(note)) return true;
  if (/english is a paraphrase/i.test(note)) return true;
  if (/while we are making other plans/i.test(note) && !/while we are making other plans/i.test(text)) return true;
  if (/better to remain silent at the risk/i.test(note) && !/remain silent/i.test(text)) return true;
  return false;
}

function statusOf(quote) {
  const attr = String(quote.attribution || '').toLowerCase();
  if (attr === 'disputed') return 'disputed';
  if (attr === 'verified') return 'verified';
  if (attr === 'corrected') return wordingIsLoose(quote) ? 'unverified' : 'verified';
  return 'unverified';
}

function parseSource(raw) {
  const original = clean(raw);
  if (!original) return {};
  let text = original;
  let translator = '';
  const trans = text.match(/^(.*)\btrans\.\s+(.+)$/i);
  if (trans) {
    text = clean(trans[1]).replace(/,\s*(?=[”"']$)/, '').replace(/[,\s]+$/g, '');
    translator = stripTranslatorYear(trans[2]);
  }

  // A Latin gloss after a colon is already inside `s`. Keep it out of the line.
  const colon = text.match(/^(.*?):\s+([^:]+)$/);
  if (colon && /[a-z]{3,}/.test(colon[2])) text = clean(colon[1]);

  let paren = '';
  const wrapped = text.match(/^(.*)\(([^)]+)\)\s*$/);
  if (wrapped && !/,\s*in\s+/i.test(text)) {
    paren = clean(wrapped[2]);
    text = clean(wrapped[1]);
  }

  let passage = '';
  let work = text;

  const section = text.match(/^(.*?)\s+(\d+(?:\.\d+)+(?:[a-z])?(?:[–-]\d+(?:\.\d+)*)?)(?:,\s*(.+))?$/);
  if (section && section[1] && !/^\d{4}$/.test(section[2])) {
    work = clean(section[1]);
    passage = clean(section[2] + (section[3] ? ', ' + section[3] : ''));
    passage = passage.replace(/,\s*$/, '');
  } else if (/,\s*preface$/i.test(text)) {
    work = clean(text.replace(/,\s*preface$/i, ''));
    passage = 'preface';
  } else {
    const lastComma = text.lastIndexOf(',');
    if (lastComma > 0) {
      const head = clean(text.slice(0, lastComma));
      const tail = clean(text.slice(lastComma + 1));
      if (/^(?:\d{1,2}\s+)?[A-Z][a-z]+(?:\s+\d{4})$/.test(tail) || /^\d{1,2}\s+[A-Z][a-z]+\s+\d{4}$/.test(tail) || /^\d+\.\d+[a-z]?$/.test(tail)) {
        work = head;
        passage = tail;
      }
    }
  }

  if (paren && /^[\d.a-z–-]+$/i.test(paren) && !/^\d{4}$/.test(paren)) {
    passage = passage ? `${passage} (${paren})` : paren;
  } else if (paren && /^\d{4}$/.test(paren) && !passage) {
    passage = paren;
  }

  // "quoted by…" and poster captions are already a full note. Don't split them.
  if (/^(quoted by|poster caption)/i.test(original)) {
    return { work: original };
  }
  // Essay-in-a-book notes stay whole. Splitting them invents a hierarchy.
  if (/,\s*in\s+/i.test(original)) return { work: original };

  work = clean(work).replace(/[,\s]+$/g, '');
  passage = clean(passage).replace(/,\s*(?=[”"']$)/, '').replace(/,\s*$/, '');
  if (!work) return { work: original };
  const out = { work };
  if (passage) out.passage = passage;
  if (translator) out.translator = translator;
  return out;
}

function enrichQuote(quote) {
  const next = { ...quote };
  const parsed = parseSource(quote.s);
  delete next.work;
  delete next.passage;
  delete next.translator;
  delete next.sourceUrl;
  if (parsed.work) next.work = parsed.work;
  if (parsed.passage) next.passage = parsed.passage;
  if (parsed.translator) next.translator = parsed.translator;
  const url = String(quote.sourceUrl || '').trim();
  if (/^https?:\/\//i.test(url)) next.sourceUrl = url;
  next.status = statusOf(quote);
  return next;
}

const KEYS = ['q', 'a', 't', 'checked', 'attribution', 'attributionNote', 's', 'work', 'passage', 'translator', 'sourceUrl', 'status', 'angle', 'pin'];

function orderQuote(quote) {
  const out = {};
  for (const key of KEYS) {
    if (quote[key] !== undefined && quote[key] !== '') out[key] = quote[key];
  }
  for (const key of Object.keys(quote)) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = quote[key];
  }
  return out;
}

module.exports = {
  statusOf,
  parseSource,
  wordingIsLoose,
  enrichQuote,
  orderQuote,
};
