// How a quote's source is spoken on the page. Fields come from quotes.json.
// A verified line is stated plainly. Anything else keeps a quiet qualifier
// in the same small caps, so an unsubstantiated name is not stated as fact.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxitomeCite = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function citationLine(quote) {
    if (!quote) return '';
    if (quote.work) {
      var line = quote.work;
      if (quote.passage) {
        var sep = /^\d+(?:\.\d+)/.test(quote.passage) ? ' ' : ', ';
        line += sep + quote.passage;
      }
      if (quote.translator) line += ' \u00b7 tr. ' + quote.translator;
      return line;
    }
    return quote.s || '';
  }

  function statusWord(quote) {
    var author = String((quote && quote.a) || '').trim();
    var status = String((quote && quote.status) || 'unverified');
    if (/^anonymous\b/i.test(author)) return status === 'verified' ? '' : 'Unverified';
    if (status === 'paraphrase') return 'Paraphrase';
    if (status === 'disputed') return 'Attributed';
    if (status === 'unverified') return 'Unverified';
    return '';
  }

  return { citationLine: citationLine, statusWord: statusWord };
});
