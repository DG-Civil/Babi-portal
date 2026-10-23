/* Babi Portal - the calculations, kept apart from the page so they can be tested without a browser.
   Works in the browser (window.BabiLogic) and in node (require). */
(function (root) {
  "use strict";

  /** "2026-03" for a Date (UTC, like the server's monthly buckets). */
  function monthKey(d) {
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }

  /** The keys of the current month and the two before it: "this month + the 2 months before" = last 3 months. */
  function last3Keys(now) {
    var keys = [];
    for (var i = 0; i < 3; i++) keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
    return keys;
  }

  function add(acc, row) {
    acc.copies += Number(row.copies || 0);
    acc.gross += Number(row.gross || 0);
    acc.share += Number(row.share || 0);
  }

  /**
   * monthRows / yearRows = answers of babi_portal_summary('month') / ('year'): {period, currency, copies, gross, share}.
   * Returns { currency: { thisMonth, last3, thisYear, allTime } } - every currency separate, never added together.
   */
  function cards(monthRows, yearRows, now) {
    var out = {}, m = monthKey(now), y = String(now.getUTCFullYear()), l3 = last3Keys(now);
    function slot(cur) {
      if (!out[cur]) {
        out[cur] = {};
        ["thisMonth", "last3", "thisYear", "allTime"].forEach(function (k) { out[cur][k] = { copies: 0, gross: 0, share: 0 }; });
      }
      return out[cur];
    }
    (monthRows || []).forEach(function (r) {
      var s = slot(r.currency || "");
      if (r.period === m) add(s.thisMonth, r);
      if (l3.indexOf(r.period) >= 0) add(s.last3, r);
    });
    (yearRows || []).forEach(function (r) {
      var s = slot(r.currency || "");
      if (r.period === y) add(s.thisYear, r);
      add(s.allTime, r);
    });
    return out;
  }

  function money(v, cur) {
    var n = Number(v || 0);
    var s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return cur ? s + " " + cur : s;
  }

  /** Quarter label "2026-Q1" -> "Jan - Mar 2026". */
  function quarterName(p) {
    var m = /^(\d{4})-Q([1-4])$/.exec(p);
    if (!m) return p;
    var names = ["Jan - Mar", "Apr - Jun", "Jul - Sep", "Oct - Dec"];
    return names[Number(m[2]) - 1] + " " + m[1];
  }

  function monthName(p) {
    var m = /^(\d{4})-(\d{2})$/.exec(p);
    if (!m) return p;
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[Number(m[2]) - 1] + " " + m[1];
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    // a spreadsheet would run a cell that starts with = + - @ as a formula: neutralise it
    if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** rows = answers of babi_portal_rows. isCreator adds the "your share" column. */
  function toCsv(rows, isCreator) {
    var head = ["Date (UTC)", "Catalog no.", "Title", "Artist", "Country", "Sold by", "Currency", "Amount"].concat(isCreator ? ["Your share"] : []);
    var lines = [head.map(csvCell).join(",")];
    rows.forEach(function (r) {
      var line = [String(r.sold_at || "").replace("T", " ").slice(0, 19), r.cat_no || "", r.title, r.artist, r.country, r.seller, r.currency, Number(r.gross || 0).toFixed(2)];
      if (isCreator) line.push(Number(r.share || 0).toFixed(2));
      lines.push(line.map(csvCell).join(","));
    });
    return lines.join("\r\n") + "\r\n";
  }

  /** Where the sale happened, for the list. */
  function place(r) {
    return [r.country, r.seller].filter(Boolean).join(" - ");
  }

  var api = { monthKey: monthKey, last3Keys: last3Keys, cards: cards, money: money, quarterName: quarterName, monthName: monthName, toCsv: toCsv, csvCell: csvCell, place: place };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BabiLogic = api;
})(typeof window !== "undefined" ? window : this);
