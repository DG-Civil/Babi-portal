/* Babi Portal - the page. All text from the server is put in with textContent (never innerHTML). */
(function () {
  "use strict";
  var L = window.BabiLogic, cfg = window.BABI_PORTAL || {};
  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ["vConfig", "vAuth", "vRecovery", "vRequest", "vPending", "vBlocked", "vDash"];
  var sb = null, recovering = /type=recovery/.test(location.hash), me = null, signUp = false, period = "month", pageSize = 50, loaded = 0, lastRows = [];

  function show(id) {
    VIEWS.forEach(function (v) { $(v).hidden = v !== id; });
    $("who").hidden = id === "vAuth" || id === "vConfig" || id === "vRecovery";
  }
  function say(text, kind) {
    var m = $("msg");
    m.hidden = !text;
    m.textContent = text || "";
    m.className = "msg" + (kind ? " " + kind : "");
  }
  function nice(e) {
    var t = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login/i.test(t)) return "Wrong email or password.";
    if (/not approved/i.test(t)) return "Your account is not approved yet.";
    if (/Email not confirmed/i.test(t)) return "Please open the confirmation email we sent you first.";
    if (/already registered/i.test(t)) return "This email already has an account. Use Sign in.";
    if (/Failed to fetch|NetworkError/i.test(t)) return "No internet connection.";
    return t;
  }
  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function busy(btn, on) { if (btn) btn.disabled = on; }

  // ------------------------------------------------------------ session flow
  async function route() {
    if (recovering) { show("vRecovery"); return; }
    say("");
    var s = await sb.auth.getSession();
    if (!s.data.session) { show("vAuth"); return; }
    var r = await sb.rpc("babi_portal_me");
    if (r.error) { say(nice(r.error), "bad"); show("vAuth"); return; }
    me = r.data;
    var status = me.status;
    $("whoName").textContent = me.name || s.data.session.user.email;
    $("whoRole").textContent = me.role === "creator" ? "Content creator" : me.role === "distributor" ? "Distributor" : "";
    if (status === "none") { show("vRequest"); $("who").hidden = false; return; }
    if (status === "pending") { show("vPending"); $("who").hidden = false; return; }
    if (status === "approved") { show("vDash"); await loadDash(); return; }
    $("blockedTitle").textContent = status === "rejected" ? "Request not accepted" : "Access paused";
    $("blockedText").textContent = status === "rejected"
      ? "The administrator did not accept this request. Please contact him."
      : "Your access was paused by the administrator. Please contact him.";
    show("vBlocked"); $("who").hidden = false;
  }

  // ------------------------------------------------------------ dashboard
  async function loadDash() {
    $("dashTitle").textContent = me.role === "creator" ? "Your titles - sales and your share" : "Your shop - sales and your share";
    $("dashNote").textContent = "Amount = what the customer paid. Your share is the part that belongs to you; the percentages were fixed " +
      "inside each file when it was made. Sales are shown after the administrator has processed them.";
    say("Loading...");
    var res = await Promise.all([sb.rpc("babi_portal_summary", { p_period: "month" }), sb.rpc("babi_portal_summary", { p_period: "year" }),
                                 sb.rpc("babi_portal_summary", { p_period: "quarter" })]);
    for (var i = 0; i < res.length; i++) if (res[i].error) { say(nice(res[i].error), "bad"); return; }
    window._sum = { month: res[0].data || [], year: res[1].data || [], quarter: res[2].data || [] };
    drawCards(); drawSummary(); await drawCountries(); await drawDues();
    loaded = 0; lastRows = []; $("rowsTable").textContent = "";
    await moreRows();
    say("");
  }

  function drawCards() {
    var box = $("cardsBox"); box.textContent = "";
    var c = L.cards(window._sum.month, window._sum.year, new Date()), curs = Object.keys(c).sort();
    if (!curs.length) { box.appendChild(el("p", "No sales yet. When a copy is sold it appears here.", "empty")); return; }
    var creator = true;
    curs.forEach(function (cur) {
      box.appendChild(el("div", cur || "(no currency)", "cur"));
      var grid = el("div", null, "cards");
      [["This month", "thisMonth"], ["Last 3 months", "last3"], ["This year", "thisYear"], ["All time", "allTime"]].forEach(function (p) {
        var d = c[cur][p[1]], s = el("div", null, "stat");
        s.appendChild(el("div", p[0], "k"));
        s.appendChild(el("div", L.money(creator ? d.share : d.gross, cur), "v"));
        s.appendChild(el("div", d.copies + (d.copies === 1 ? " copy" : " copies") + (creator ? " - sales " + L.money(d.gross, cur) : ""), "s"));
        grid.appendChild(s);
      });
      box.appendChild(grid);
    });
  }

  async function drawDues() {
    var card = $("duesCard");
    card.hidden = me.role !== "distributor";
    if (card.hidden) return;
    var res = await sb.rpc("babi_portal_dues");
    if (res.error) { say(nice(res.error), "bad"); return; }
    var rows = res.data || [], box = $("duesBox"); box.textContent = "";
    var c = L.duesCards(rows, new Date()), curs = Object.keys(c).sort();
    curs.forEach(function (cur) {
      box.appendChild(el("div", cur || "(no currency)", "cur"));
      var grid = el("div", null, "cards");
      [["Still to pay (all months)", c[cur].owing, "Owed minus received"], ["Owed this month", c[cur].thisMonth.due, c[cur].thisMonth.copies + " copies"],
       ["Paid this month", c[cur].thisMonth.paid, "Recorded by the administrator"], ["You keep this month", c[cur].thisMonth.kept, "Your own share"]].forEach(function (p) {
        var s = el("div", null, "stat");
        s.appendChild(el("div", p[0], "k")); s.appendChild(el("div", L.money(p[1], cur), "v")); s.appendChild(el("div", p[2], "s"));
        grid.appendChild(s);
      });
      box.appendChild(grid);
    });
    table($("duesTable"), ["Month", "Currency", "Copies", "Taken", "You keep", "Hand over", "Paid", "Still to pay"],
          rows.map(function (r) { return [L.monthName(r.month), r.currency || "-", String(r.copies), L.money(r.gross), L.money(r.kept), L.money(r.due), L.money(r.paid), L.money(r.balance)]; }), 2);
  }

  function table(t, head, rows, numFrom) {
    t.textContent = "";
    if (!rows.length) { var p = el("tr"), d = el("td", "Nothing yet.", "empty"); d.colSpan = head.length; p.appendChild(d); t.appendChild(p); return; }
    var h = el("tr");
    head.forEach(function (x, i) { h.appendChild(el("th", x, i >= numFrom ? "n" : "")); });
    t.appendChild(h);
    rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (x, i) { tr.appendChild(el("td", x, i >= numFrom ? "n" : "")); });
      t.appendChild(tr);
    });
  }

  function drawSummary() {
    var creator = true;
    var rows = (window._sum[period] || []).map(function (r) {
      var name = period === "month" ? L.monthName(r.period) : period === "quarter" ? L.quarterName(r.period) : r.period;
      var line = [name, r.currency || "-", String(r.copies), L.money(r.gross)];
      if (creator) line.push(L.money(r.share));
      return line;
    });
    table($("sumTable"), ["Period", "Currency", "Copies", "Amount"].concat(creator ? ["Your share"] : []), rows, 2);
  }

  function range() {
    var v = $("countryRange").value, n = new Date(), y = n.getUTCFullYear(), m = n.getUTCMonth();
    if (v === "month") return [new Date(Date.UTC(y, m, 1)), null];
    if (v === "last3") return [new Date(Date.UTC(y, m - 2, 1)), null];
    if (v === "year") return [new Date(Date.UTC(y, 0, 1)), null];
    return [null, null];
  }

  async function drawCountries() {
    var r = range(), creator = true;
    var res = await sb.rpc("babi_portal_countries", { p_from: r[0] ? r[0].toISOString() : null, p_to: r[1] ? r[1].toISOString() : null });
    if (res.error) { say(nice(res.error), "bad"); return; }
    var rows = (res.data || []).map(function (x) {
      var line = [x.country || "(unknown)", x.currency || "-", String(x.copies), L.money(x.gross)];
      if (creator) line.push(L.money(x.share));
      return line;
    });
    table($("countryTable"), ["Country", "Currency", "Copies", "Amount"].concat(creator ? ["Your share"] : []), rows, 2);
  }

  async function moreRows() {
    var res = await sb.rpc("babi_portal_rows", { p_from: null, p_to: null }).range(loaded, loaded + pageSize - 1);
    if (res.error) { say(nice(res.error), "bad"); return; }
    var data = res.data || [], creator = true, t = $("rowsTable");
    lastRows = lastRows.concat(data); loaded += data.length;
    if (!t.firstChild && !data.length) { table(t, ["When"], [], 0); $("more").hidden = true; return; }
    if (!t.firstChild) {
      var h = el("tr");
      ["When", "Catalog no.", "Title", "Artist", "Where", "Amount"].concat(creator ? ["Your share"] : []).forEach(function (x, i) {
        h.appendChild(el("th", x, i >= 5 ? "n" : ""));
      });
      t.appendChild(h);
    }
    data.forEach(function (r) {
      var tr = el("tr");
      var when = new Date(r.sold_at);
      [isNaN(when) ? "" : when.toLocaleString(), r.cat_no || "", r.title, r.artist, L.place(r), L.money(r.gross, r.currency)].concat(creator ? [L.money(r.share, r.currency)] : [])
        .forEach(function (x, i) { tr.appendChild(el("td", x, i >= 5 ? "n" : "")); });
      t.appendChild(tr);
    });
    $("more").hidden = data.length < pageSize;
  }

  async function downloadCsv() {
    say("Preparing the file...");
    var all = [], at = 0, step = 500;
    for (;;) {
      var res = await sb.rpc("babi_portal_rows", { p_from: null, p_to: null }).range(at, at + step - 1);
      if (res.error) { say(nice(res.error), "bad"); return; }
      all = all.concat(res.data || []); at += step;
      if (!res.data || res.data.length < step) break;
    }
    var blob = new Blob(["﻿" + L.toCsv(all, true)], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "babi-sales-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    say(all.length + " sales saved to the file.", "ok");
  }

  // ------------------------------------------------------------ events
  function wire() {
    $("toggleMode").onclick = function (e) {
      e.preventDefault(); signUp = !signUp;
      $("authTitle").textContent = signUp ? "Create an account" : "Sign in";
      $("authGo").textContent = signUp ? "Create account" : "Sign in";
      $("toggleMode").textContent = signUp ? "I already have an account" : "Create an account";
      $("password").autocomplete = signUp ? "new-password" : "current-password";
      say("");
    };
    $("authForm").onsubmit = async function (e) {
      e.preventDefault(); say(""); busy($("authGo"), true);
      var email = $("email").value.trim(), pw = $("password").value;
      try {
        if (signUp) {
          var r = await sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: location.href.split("#")[0] } });
          if (r.error) throw r.error;
          if (!r.data.session) { say("Account created. We sent a confirmation email: open it, then come back and sign in.", "ok"); }
          else await route();
        } else {
          var s = await sb.auth.signInWithPassword({ email: email, password: pw });
          if (s.error) throw s.error;
          await route();
        }
      } catch (err) { say(nice(err), "bad"); }
      busy($("authGo"), false);
    };
    $("forgot").onclick = async function (e) {
      e.preventDefault();
      var email = $("email").value.trim();
      if (!email) { say("Type your email above first.", "bad"); return; }
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
      say(r.error ? nice(r.error) : "If this email has an account, a message to choose a new password is on its way.", r.error ? "bad" : "ok");
    };
    $("recForm").onsubmit = async function (e) {
      e.preventDefault();
      var r = await sb.auth.updateUser({ password: $("newPassword").value });
      if (r.error) say(nice(r.error), "bad"); else { recovering = false; history.replaceState(null, "", location.pathname); await route(); say("Password saved.", "ok"); }
    };
    $("reqForm").onsubmit = async function (e) {
      e.preventDefault(); say("");
      var r = await sb.rpc("babi_portal_request", { p_role: $("reqRole").value, p_name: $("reqName").value, p_note: $("reqNote").value });
      if (r.error) { say(nice(r.error), "bad"); return; }
      await route();
      say("Request sent. Waiting for the administrator.", "ok");
    };
    $("recheck").onclick = route;
    $("signOut").onclick = async function () { await sb.auth.signOut(); me = null; say(""); show("vAuth"); };
    $("refresh").onclick = loadDash;
    $("csv").onclick = downloadCsv;
    $("more").onclick = moreRows;
    $("countryRange").onchange = drawCountries;
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.onclick = function () {
        period = b.getAttribute("data-p");
        Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (x) { x.classList.toggle("on", x === b); });
        drawSummary();
      };
    });
  }

  function start() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_KEY || !window.supabase) { show("vConfig"); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    wire();
    sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") { recovering = true; show("vRecovery"); } });
    route();
  }
  start();
})();
