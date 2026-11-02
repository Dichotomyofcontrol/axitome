// Shared line breaks for the ledger. public/breaks.js is what the site loads.
// Three tiers, then a small cost search: balance the line lengths, break at
// phrase boundaries, and keep a short last line from sitting alone.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxitomeBreaks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var GLUE = {
    a: 1, an: 1, the: 1, and: 1, or: 1, but: 1, nor: 1, of: 1, to: 1, in: 1, on: 1,
    at: 1, by: 1, for: 1, as: 1, is: 1, are: 1, was: 1, were: 1, be: 1, am: 1,
    if: 1, so: 1, yet: 1, not: 1, no: 1, my: 1, your: 1, his: 1, her: 1, its: 1,
    our: 1, their: 1,
  };
  var PREP = {
    over: 1, under: 1, into: 1, from: 1, with: 1, without: 1, before: 1, after: 1,
    against: 1, through: 1, toward: 1, towards: 1, upon: 1, within: 1, among: 1,
    between: 1, than: 1,
  };

  function norm(word) {
    return String(word || '').toLowerCase().replace(/^['"“”‘’]+|['"“”‘’.,;:!?…—–-]+$/g, '');
  }

  function tierOf(text) {
    var n = String(text || '').trim().length;
    if (n <= 90) return 'short';
    if (n <= 200) return 'medium';
    return 'long';
  }

  function linesOf(text, tier) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return words.slice();
    var kind = tier || tierOf(text);
    var target = kind === 'short' ? 12 : kind === 'medium' ? 24 : 42;
    var slack = kind === 'short' ? 4 : 8;
    var joined = words.join(' ');
    if (joined.length <= target + slack) return [joined];
    var hardMax = kind === 'short' ? 18 : kind === 'medium' ? 26 : 58;
    var n = words.length;
    var INF = 1e12;
    var dp = new Array(n + 1).fill(INF);
    var next = new Array(n + 1).fill(-1);
    dp[n] = 0;

    function width(i, j) {
      var w = 0;
      for (var k = i; k < j; k += 1) w += words[k].length + (k > i ? 1 : 0);
      return w;
    }

    for (var i = n - 1; i >= 0; i -= 1) {
      for (var j = i + 1; j <= n; j += 1) {
        var w = width(i, j);
        if (w > hardMax && j > i + 1) break;
        var isLast = j === n;
        var cost = (w - target) * (w - target);
        if (w > target) cost += (w - target) * 6;
        var end = norm(words[j - 1]);
        var startNext = j < n ? norm(words[j]) : '';
        if (!isLast && GLUE[end]) cost += 90;
        if (/[.!?]["”’']?$/.test(words[j - 1])) cost -= 55;
        else if (/[;:]["”’']?$/.test(words[j - 1])) cost -= 40;
        else if (/[,—–]["”’']?$/.test(words[j - 1])) cost -= 24;
        var k;
        for (k = i; k < j - 1; k += 1) {
          if (/[.!?]["”’']?$/.test(words[k])) cost += kind === 'long' ? 200 : 80;
        }
        if (startNext && PREP[startNext]) cost -= kind === 'long' ? 14 : 22;
        if (j === i + 1 && !(isLast && n <= 3)) cost += w < 8 ? 180 : 70;
        if (isLast && w < target * 0.45 && n > 4) cost += 40;
        var total = dp[j] + cost;
        if (total < dp[i]) {
          dp[i] = total;
          next[i] = j;
        }
      }
    }

    var lines = [];
    var at = 0;
    var guard = 0;
    while (at < n && guard < n + 2) {
      guard += 1;
      var endAt = next[at];
      if (endAt <= at) endAt = Math.min(n, at + 1);
      lines.push(words.slice(at, endAt).join(' '));
      at = endAt;
    }
    if (lines.length >= 2) {
      var last = lines[lines.length - 1];
      var prev = lines[lines.length - 2];
      var merged = prev + ' ' + last;
      if (last.split(/\s+/).length === 1 && merged.length <= Math.round(target * 1.85)) {
        lines.splice(lines.length - 2, 2, merged);
      }
    }
    return lines;
  }

  return { tierOf: tierOf, linesOf: linesOf };
});
