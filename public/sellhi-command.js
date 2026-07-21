/*
 * SellHi — Phase 7 (Command Center) + Phase 8 (Learn & Optimize): REAL dashboards.
 * demo.html stays pristine. On entering p7/p8 we replace ONLY the `.content` of that
 * phase with widgets built from the user's OWN data:
 *   - saved Market Intel target companies (dossier.data.marketCompanies: tiers,
 *     per-criterion scores, live signals, ICP criteria + counts)
 *   - upcoming meetings (/api/meetings, once a calendar is connected)
 * Nothing is invented. Metrics that depend on outreach that hasn't run yet
 * (open/reply rates, revenue, A/B winners) are shown as an honest "unlocks when
 * campaigns go live" note rather than fake numbers. Fully defensive: any failure
 * leaves the phase untouched. Runs each time the phase is opened so it reflects the
 * latest Market Intel run.
 */
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var TIER_BADGE = { 1: "badge-green", 2: "badge-amber", 3: "badge-gray" };

  // ── data ────────────────────────────────────────────────────────────────────
  var DATA = { companies: [], counts: null, criteria: null, meetings: [], connected: { google: false, microsoft: false }, loaded: false };

  // Command Center date-range filter (drives the meetings + funnel-meetings stage).
  var p7Range = { mode: "30", from: "", to: "" };
  function p7Meetings() {
    var now = Date.now();
    return (DATA.meetings || []).filter(function (mt) {
      var t = mt.start_at ? Date.parse(mt.start_at) : NaN;
      if (isNaN(t)) return true;                       // undated -> always include
      if (p7Range.mode === "all") return t >= now - 3600000;
      if (p7Range.mode === "custom") {
        var f = p7Range.from ? Date.parse(p7Range.from) : -Infinity;
        var to = p7Range.to ? (Date.parse(p7Range.to) + 86400000) : Infinity;   // inclusive end-day
        return t >= f && t < to;
      }
      var days = parseInt(p7Range.mode, 10) || 30;
      return t >= now - 3600000 && t <= now + days * 86400000;
    }).sort(function (a, b) { return (Date.parse(a.start_at) || 0) - (Date.parse(b.start_at) || 0); });
  }

  function companyScore(c) {
    if (typeof c._score === "number") return c._score;
    var sc = c.scores || {};
    var ks = ["industry", "size", "growth", "pain", "funding"], n = 0, sum = 0;
    ks.forEach(function (k) { if (typeof sc[k] === "number") { sum += sc[k]; n++; } });
    return n ? Math.round(sum / n) : (c.tier === 1 ? 85 : c.tier === 2 ? 68 : 48);
  }
  function companyTier(c) { return c._tier || c.tier || 3; }

  function loadData(cb) {
    var pending = 2;
    function done() { if (--pending <= 0) { DATA.loaded = true; cb && cb(); } }
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.dossier && j.dossier.data) || {};
        var mc = d.marketCompanies || {};
        var arr = Array.isArray(mc.companies) ? mc.companies : (Array.isArray(mc) ? mc : (Array.isArray(d.companies) ? d.companies : []));
        // Never let a transient/empty response wipe a good pipeline — that's what
        // made the funnel "appear then vanish" on re-entry. Only replace when we
        // actually got companies, or when we had none to begin with.
        if ((arr && arr.length) || !DATA.companies.length) {
          DATA.companies = arr || [];
          DATA.counts = mc.counts || null;
          DATA.criteria = mc.criteria || null;
        }
      })
      .catch(function () {})
      .then(done, done);
    fetch("/api/meetings", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && Array.isArray(j.meetings)) DATA.meetings = j.meetings;
        if (j && j.connected) DATA.connected = j.connected;
      })
      .catch(function () {})
      .then(done, done);
  }

  // ── derived metrics ──────────────────────────────────────────────────────────
  function derive() {
    var cs = DATA.companies || [];
    var tiers = { 1: 0, 2: 0, 3: 0 };
    var industries = {};
    var signals = [];
    var scoreSum = 0;
    cs.forEach(function (c) {
      var t = companyTier(c); tiers[t] = (tiers[t] || 0) + 1;
      var ind = (c.industry || "Other").trim(); industries[ind] = (industries[ind] || 0) + 1;
      scoreSum += companyScore(c);
      if (c.why) signals.push(c);
    });
    var indArr = Object.keys(industries).map(function (k) { return { name: k, n: industries[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var now = Date.now();
    var upcoming = (DATA.meetings || []).filter(function (m) {
      var t = m.start_at ? Date.parse(m.start_at) : NaN;
      return isNaN(t) ? true : t >= now - 3600000; // keep in-progress/near-past too
    });
    return {
      total: cs.length,
      tiers: tiers,
      industries: indArr,
      signals: signals,
      avgScore: cs.length ? Math.round(scoreSum / cs.length) : 0,
      upcoming: upcoming,
      anyCal: !!(DATA.connected.google || DATA.connected.microsoft),
    };
  }

  function fmtWhen(iso) {
    if (!iso) return "";
    var t = Date.parse(iso); if (isNaN(t)) return "";
    try {
      return new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  // ── shared widget builders ───────────────────────────────────────────────────
  function metric(label, value, sub, color) {
    // Integer KPIs roll up from 0 -> value (see countUp); non-numeric render as-is.
    var num = (typeof value === "number" && isFinite(value));
    return '<div class="metric"><div class="metric-label">' + esc(label) + "</div>" +
      '<div class="metric-value"' + (color ? ' style="color:' + color + ';"' : "") +
      (num ? ' data-count="' + value + '">0' : ">" + esc(value)) + "</div>" +
      (sub ? '<div class="metric-change">' + esc(sub) + "</div>" : "") + "</div>";
  }

  // Roll each KPI tile from 0 up to its value — a small, honest "counting" flourish.
  function countUp(scope) {
    var els = scope.querySelectorAll(".metric-row .metric-value[data-count]");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    Array.prototype.forEach.call(els, function (el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      if (reduce || target <= 0) { el.textContent = String(target); return; }
      var dur = 1500, t0 = null;
      function step(ts) {
        if (t0 == null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);            // ease-out cubic
        el.textContent = String(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(step); else el.textContent = String(target);
      }
      requestAnimationFrame(step);
    });
  }

  // ── Opportunity-usage meter (measure + warn; fed by /api/usage) ──────────────
  var USAGE = null, usageFetched = false;
  function usageBar(u) {
    if (!u || !u.ok) return "";
    var unlimited = u.cap === null || u.cap === undefined;
    var used = u.used || 0, pct = u.pct || 0;
    var col = pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--warning)" : "var(--primary)";
    var count = unlimited ? (used + " signal accounts this month · unlimited")
      : (used + " / " + u.cap + " signal accounts this month");
    var warn = (!unlimited && pct >= 80)
      ? '<span style="color:' + col + ';font-weight:600;font-size:12px;">' + (pct >= 100 ? "At your plan limit" : "Nearing your limit") + "</span>" : "";
    return '<div class="card" style="margin-bottom:20px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<div class="card-title" style="margin:0;">Opportunity usage</div>' + warn +
        '<a class="btn btn-sm btn-outline" style="margin-left:auto;" href="/connect">Manage plan</a></div>' +
      '<div style="font-size:12px;color:var(--sh-ink2);margin-bottom:8px;">' + esc(count) +
        (u.resetsOn ? " &middot; resets " + esc(u.resetsOn) : "") + "</div>" +
      '<div style="height:8px;border-radius:999px;background:var(--sh-line);overflow:hidden;">' +
        '<div style="height:100%;width:' + (unlimited ? 100 : pct) + '%;background:' + col + ';border-radius:999px;transition:width .5s cubic-bezier(.2,.7,.2,1);"></div></div></div>';
  }
  function renderUsage() {
    var host = document.getElementById("sh-usage");
    if (!host) return;
    if (USAGE) { host.innerHTML = usageBar(USAGE); return; }
    if (usageFetched) return;
    usageFetched = true;
    fetch("/api/usage", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { USAGE = j; var h = document.getElementById("sh-usage"); if (h && j) h.innerHTML = usageBar(j); })
      .catch(function () {});
  }

  function tierBar(tier, count, max) {
    var pct = max ? Math.max(4, Math.round(count / max * 100)) : 0;
    var col = tier === 1 ? "var(--success)" : tier === 2 ? "var(--warning)" : "var(--g400)";
    var lbl = tier === 1 ? "Tier 1 · strong fit" : tier === 2 ? "Tier 2 · partial" : "Tier 3 · exploratory";
    return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">' +
      '<div style="width:150px;font-size:12px;color:var(--sh-ink);">' + lbl + "</div>" +
      '<div style="flex:1;height:22px;background:var(--g100);border-radius:6px;overflow:hidden;">' +
      '<div style="height:100%;width:' + pct + '%;background:' + col + ';border-radius:6px;transition:width .5s cubic-bezier(.2,.7,.2,1);"></div></div>' +
      '<div style="width:36px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">' + count + "</div></div>";
  }

  // ── PHASE 7: Command Center ──────────────────────────────────────────────────
  function buildP7() {
    var content = document.querySelector("#phase-p7 .content");
    if (!content) return;
    var m = derive();
    var meets = p7Meetings();
    // Skip the rebuild when nothing that's on screen has changed. This is what stops
    // the background refresh (render paints from cache, then re-fetches) from wiping
    // and re-drawing the funnel — the "appears then vanishes" flicker.
    var sig = "p7|" + [m.total, m.tiers[1], m.tiers[2], m.tiers[3], m.signals.length,
      m.avgScore, m.industries.length, meets.length, m.anyCal,
      p7Range.mode, p7Range.from, p7Range.to].join("|");
    if (content.getAttribute("data-sh-sig") === sig) return;
    content.setAttribute("data-sh-sig", sig);

    var maxTier = Math.max(m.tiers[1], m.tiers[2], m.tiers[3], 1);
    var html = "";

    // Account/settings affordance: reach the plan + channel setup from here too.
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">' +
      '<a href="/connect" class="btn btn-sm btn-outline">&#9881; Plan &amp; Connections &#8594;</a></div>';

    if (!m.total) {
      html += emptyPortfolioCard("p7");
    } else {
      // Scoreboard: KPIs that COMPLEMENT the funnel (the funnel already owns
      // Researched + Strong fit, so those don't repeat here). Numbers roll 0 -> n.
      html += '<div class="metric-row metric-row-4">' +
        metric("Live buying signals", m.signals.length, m.signals.length ? "ready to action" : "none flagged yet", "var(--warning)") +
        metric("Avg fit score", m.avgScore, m.avgScore >= 70 ? "healthy pipeline" : "broaden or refine ICP", "var(--primary)") +
        metric("Meetings", meets.length, p7RangeLabel(), "var(--success)") +
        metric("Verticals covered", m.industries.length, "distinct segments in your list", "var(--primary)") +
        "</div>";

      // Opportunity-usage meter (filled async from /api/usage).
      html += '<div id="sh-usage"></div>';

      // Pipeline funnel (real: research -> prioritise -> signals -> meetings)
      html += funnelCard(m, meets.length);

      // Portfolio by tier + top industries
      html += '<div class="grid-2">';
      html += '<div class="card"><div class="card-title">Target portfolio by fit tier</div>' +
        tierBar(1, m.tiers[1], maxTier) + tierBar(2, m.tiers[2], maxTier) + tierBar(3, m.tiers[3], maxTier) +
        '<div style="font-size:11px;color:var(--sh-ink2);margin-top:6px;">Tiers come from your Market Intel research and current segment weights.</div></div>';

      html += '<div class="card"><div class="card-title">Top verticals in your list</div>';
      if (m.industries.length) {
        m.industries.slice(0, 6).forEach(function (it) {
          var pct = Math.max(6, Math.round(it.n / m.total * 100));
          html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px;">' +
            '<div style="width:120px;font-size:12px;color:var(--sh-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(it.name) + "</div>" +
            '<div style="flex:1;height:8px;background:var(--g100);border-radius:999px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:999px;"></div></div>' +
            '<div style="width:28px;text-align:right;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;">' + it.n + "</div></div>";
        });
      } else {
        html += '<div style="font-size:13px;color:var(--sh-ink2);">No verticals yet — run Market Intel.</div>';
      }
      html += "</div></div>";

      // Hot list (companies with a live signal) + upcoming meetings
      html += '<div class="grid-2">';
      html += '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><div class="card-title" style="margin:0;">Accounts to action now</div><span class="badge badge-teal">' + m.signals.length + "</span><span class=\"badge badge-amber\" style=\"margin-left:auto;\">Live signals</span></div>";
      if (m.signals.length) {
        m.signals.slice(0, 6).forEach(function (c) {
          var t = companyTier(c);
          html += '<div class="action-item"><div class="action-content"><div class="action-title">' + esc(c.name) + "</div>" +
            '<div class="action-sub">' + esc(c.why || "") + "</div></div>" +
            '<span class="badge ' + (TIER_BADGE[t] || "badge-gray") + '">Tier ' + t + "</span></div>";
        });
        html += '<div style="margin-top:12px;"><button class="btn btn-sm btn-primary" onclick="try{showPhase(\'p5\')}catch(e){}">Draft outreach in Content Factory &#8594;</button></div>';
      } else {
        html += '<div style="font-size:13px;color:var(--sh-ink2);line-height:1.6;">No live signals yet. Re-run Market Intel to surface recent funding, hiring, or leadership changes.</div>';
      }
      html += "</div>";

      html += upcomingMeetingsCard(meets, m.anyCal);
      html += "</div>";

      // ── Free-to-watch: researched accounts with NO live signal yet. This is the
      // visual proof of the pricing promise — signal accounts are your billable
      // opportunities; everything else is watched for free until a signal appears.
      var noSig = (DATA.companies || []).filter(function (c) { return !c.why; });
      if (noSig.length) {
        html += '<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
          '<div class="card-title" style="margin:0;">Watching &mdash; no live signal yet</div>' +
          '<span class="badge badge-gray">' + noSig.length + '</span>' +
          '<span class="badge badge-teal" style="margin-left:auto;">Free to watch</span></div>' +
          '<div style="font-size:12px;color:var(--sh-ink2);margin-bottom:10px;">Researched and on watch. You’re only billed when one of these surfaces a live buying signal &mdash; it then moves up to <strong>Accounts to action now</strong>.</div>';
        noSig.slice(0, 8).forEach(function (c) {
          var t = companyTier(c);
          html += '<div class="action-item"><div class="action-content"><div class="action-title">' + esc(c.name) + '</div>' +
            '<div class="action-sub">' + esc(c.industry || "Researched") + ' &middot; watching for funding, hiring or leadership moves</div></div>' +
            '<span class="badge ' + (TIER_BADGE[t] || "badge-gray") + '">Tier ' + t + '</span></div>';
        });
        if (noSig.length > 8) html += '<div style="font-size:11px;color:var(--sh-ink2);margin-top:8px;">+ ' + (noSig.length - 8) + ' more on watch</div>';
        html += "</div>";
      }
    }

    // Honest note about what unlocks with outreach
    html += honestNote("Contacted → Replied → Meetings → Won activate once the Campaign Engine starts sending. For now, this reflects your researched pipeline and calendar.");

    content.innerHTML = html;
    neutralizeP7Chrome(m);
    countUp(content);
    renderUsage();
  }

  function upcomingMeetingsCard(list, anyCal) {
    list = list || [];
    var h = '<div class="card"><div class="card-title">Meetings · ' + esc(p7RangeLabel()) + "</div>";
    if (list.length) {
      list.slice(0, 8).forEach(function (mt) {
        h += '<div class="action-item"><div class="action-content"><div class="action-title">' + esc(mt.title || "Meeting") + "</div>" +
          '<div class="action-sub">' + esc(fmtWhen(mt.start_at) || "Time TBD") + (mt.location ? " · " + esc(mt.location) : "") + "</div></div>" +
          '<button class="btn btn-sm btn-outline" onclick="location.href=\'/meetings\'">Prep</button></div>';
      });
      h += '<div style="margin-top:12px;"><a class="btn btn-sm btn-outline" href="/meetings">Open Meeting Prep &#8594;</a></div>';
    } else if (anyCal) {
      h += '<div style="font-size:13px;color:var(--sh-ink2);line-height:1.6;">No meetings in this date range. Widen the range (top-right) or check back as events sync.</div>';
    } else {
      h += '<div style="font-size:13px;color:var(--sh-ink2);line-height:1.6;margin-bottom:12px;">Connect your calendar to see meetings here and get a prep sheet for each one.</div>' +
        '<a class="btn btn-sm btn-primary" href="/meetings">Connect calendar &#8594;</a>';
    }
    return h + "</div>";
  }

  function p7RangeLabel() {
    if (p7Range.mode === "all") return "all upcoming";
    if (p7Range.mode === "custom") {
      if (p7Range.from || p7Range.to) return (p7Range.from || "…") + " to " + (p7Range.to || "…");
      return "custom range";
    }
    return "next " + p7Range.mode + " days";
  }

  // Real pipeline funnel: Researched -> Strong-fit -> Live signals -> Meetings.
  // Downstream (Contacted/Replied/Won) needs outreach, so we stop honestly at
  // meetings and flag what unlocks. `mc` = meetings count in the selected range.
  function funnelCard(m, mc) {
    // A TRUE funnel: each stage is a subset of the one above it, so the bars taper.
    // The live stages are Researched -> Strong fit (Tier-1 is a subset of researched).
    // Downstream stages are the outreach journey — they don't exist until the Campaign
    // Engine sends, so we show them LOCKED (never faked). Live signals + calendar
    // meetings deliberately live in their own cards below: they aren't subsets of the
    // target list, so putting them here is what broke the funnel shape and duplicated
    // the stat row up top.
    var live = [
      { label: "Researched", n: m.total, sub: "companies in your ICP list", col: "#008080" },
      { label: "Strong fit", n: m.tiers[1], sub: "Tier-1 (score 80+)", col: "#0a9a8c" },
    ];
    var locked = [
      { label: "Contacted", sub: "unlocks with Campaign Engine", w: 46 },
      { label: "Replied", sub: "unlocks with Campaign Engine", w: 37 },
      { label: "Meetings", sub: "booked from outreach", w: 29 },
      { label: "Won", sub: "closed-won", w: 22 },
    ];
    var max = Math.max(m.total, 1);
    var rows = live.map(function (s) {
      var pct = Math.min(100, Math.max(16, Math.round((s.n / max) * 100)));
      return '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">' +
        '<div style="width:96px;text-align:right;font-size:13px;color:var(--sh-ink);font-weight:500;">' + esc(s.label) + "</div>" +
        '<div style="flex:1;min-width:0;"><div style="margin:0 auto;width:' + pct + '%;min-width:70px;max-width:100%;background:' + s.col + ';height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;font-variant-numeric:tabular-nums;box-shadow:0 2px 8px rgba(16,24,40,.12);">' + s.n + "</div>" +
        '<div style="text-align:center;font-size:11px;color:var(--sh-ink2);margin-top:4px;">' + esc(s.sub) + "</div></div>" +
        '<div style="width:40px;flex:0 0 auto;"></div></div>';
    }).join("");
    rows += locked.map(function (s) {
      return '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;opacity:.7;">' +
        '<div style="width:96px;text-align:right;font-size:13px;color:var(--sh-ink2);font-weight:500;">' + esc(s.label) + "</div>" +
        '<div style="flex:1;min-width:0;"><div style="margin:0 auto;width:' + s.w + '%;min-width:70px;height:36px;border-radius:9px;border:1.5px dashed var(--sh-line);background:transparent;display:flex;align-items:center;justify-content:center;color:var(--sh-ink2);font-size:13px;">&#128274;</div>' +
        '<div style="text-align:center;font-size:11px;color:var(--sh-ink2);margin-top:4px;">' + esc(s.sub) + "</div></div>" +
        '<div style="width:40px;flex:0 0 auto;"></div></div>';
    }).join("");
    return '<div class="card" style="margin-bottom:16px;"><div class="card-title">Pipeline funnel</div>' + rows +
      '<div style="font-size:11px;color:var(--sh-ink2);margin-top:6px;">Live: Researched &#8594; Strong fit. The rest unlock when the Campaign Engine starts sending — real numbers, no estimates.</div></div>';
  }

  function emptyPortfolioCard(phase) {
    return '<div class="card"><div class="card-title">Your pipeline</div>' +
      '<div style="text-align:center;padding:30px 20px;">' +
      '<div style="font-size:15px;font-weight:600;color:var(--sh-ink);margin-bottom:6px;">No target companies yet</div>' +
      '<div style="font-size:13px;color:var(--sh-ink2);line-height:1.6;max-width:460px;margin:0 auto 16px;">Run Market Intel to research companies that fit your ICP. Once you do, this ' +
      (phase === "p7" ? "Command Center" : "dashboard") + ' fills with your real pipeline — tiers, signals, and verticals.</div>' +
      '<button class="btn btn-primary btn-sm" onclick="try{showPhase(\'p2\')}catch(e){}">Go to Market Intel &#8594;</button></div></div>';
  }

  function honestNote(text) {
    // Use the teal-tint token (dark in dark mode, mint in light) so it ALWAYS
    // contrasts with --sh-ink text. The old var(--g50) resolved light in dark mode,
    // which made this text invisible (light-on-light).
    return '<div class="card" style="margin-top:16px;background:var(--sh-teal-soft);border:1px solid var(--sh-line);"><div style="display:flex;gap:10px;align-items:flex-start;">' +
      '<span aria-hidden="true" style="font-size:16px;">&#128274;</span>' +
      '<div style="font-size:12px;color:var(--sh-ink);line-height:1.6;">' + esc(text) + "</div></div></div>";
  }

  // p7's demo topbar carries sample notifications + a fake "All Clients (8)" filter.
  // Make the chrome honest without removing the topbar: reflect real counts.
  function neutralizeP7Chrome(m) {
    try {
      var badge = document.getElementById("notif-count");
      var panel = document.getElementById("notif-panel");
      var n = m.signals.length + m.upcoming.length;
      if (badge) { if (n > 0) { badge.textContent = n; badge.style.display = ""; } else { badge.style.display = "none"; } }
      var btn = panel ? panel.parentElement.querySelector(".notif-btn") : null;
      if (btn) btn.setAttribute("aria-label", "Notifications — " + n + " item" + (n === 1 ? "" : "s"));
      if (panel) {
        var items = "";
        m.signals.slice(0, 5).forEach(function (c) {
          items += '<div class="notif-item unread"><div class="notif-dot"></div><div class="notif-icon" style="background:var(--purple-light);">&#9889;</div>' +
            '<div class="notif-content"><div class="notif-text">Signal: <strong>' + esc(c.name) + "</strong> — " + esc(c.why || "live signal") + "</div><div class=\"notif-time\">from Market Intel</div></div></div>";
        });
        m.upcoming.slice(0, 3).forEach(function (mt) {
          items += '<div class="notif-item"><div style="width:6px;"></div><div class="notif-icon" style="background:var(--success-light);">&#128197;</div>' +
            '<div class="notif-content"><div class="notif-text">Meeting: <strong>' + esc(mt.title || "Meeting") + "</strong></div><div class=\"notif-time\">" + esc(fmtWhen(mt.start_at) || "upcoming") + "</div></div></div>";
        });
        if (!items) items = '<div class="notif-item"><div style="width:6px;"></div><div class="notif-content"><div class="notif-text">You\'re all caught up.</div><div class="notif-time">No signals or meetings right now</div></div></div>';
        var header = panel.querySelector(".notif-header");
        panel.innerHTML = (header ? header.outerHTML : "") + items;
      }
      // The demo's "Your pipeline" filter select has nothing real to filter yet, so
      // it was a dead one-option control. Hide it rather than show a fake dropdown.
      var sel = document.querySelector("#phase-p7 .topbar select");
      if (sel) sel.style.display = "none";

      // Date-range picker: replace the static "Last 30 days" chip with a real,
      // subscriber-controlled range (presets + custom dates) that filters the
      // meetings + funnel-meetings stage.
      var topbar = document.querySelector("#phase-p7 .topbar");
      if (topbar) {
        var host = document.getElementById("sh-p7-rangewrap");
        if (!host) {
          var chip = null;
          Array.prototype.forEach.call(topbar.querySelectorAll(".chip"), function (c) {
            if (/last\s*30|days/i.test(c.textContent || "")) chip = c;
          });
          host = document.createElement("span");
          host.id = "sh-p7-rangewrap";
          host.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
          if (chip && chip.parentNode) chip.parentNode.replaceChild(host, chip);
          else { var right = topbar.querySelector("div"); if (right) right.insertBefore(host, right.firstChild); }
        }
        function opt(v, l) { return '<option value="' + v + '"' + (p7Range.mode === v ? " selected" : "") + ">" + l + "</option>"; }
        host.innerHTML =
          '<select id="sh-p7-range" class="field-input" style="width:auto;font-size:12px;padding:6px 10px;">' +
          opt("7", "Next 7 days") + opt("30", "Next 30 days") + opt("90", "Next 90 days") + opt("all", "All upcoming") + opt("custom", "Custom range…") +
          "</select>" +
          '<span id="sh-p7-custom" style="display:' + (p7Range.mode === "custom" ? "inline-flex" : "none") + ';align-items:center;gap:6px;">' +
          '<input id="sh-p7-from" type="date" class="field-input" style="width:auto;font-size:12px;padding:5px 8px;" value="' + esc(p7Range.from) + '">' +
          '<span style="font-size:12px;color:var(--sh-ink2);">to</span>' +
          '<input id="sh-p7-to" type="date" class="field-input" style="width:auto;font-size:12px;padding:5px 8px;" value="' + esc(p7Range.to) + '"></span>';
        var rsel = host.querySelector("#sh-p7-range");
        if (rsel) rsel.addEventListener("change", function () {
          p7Range.mode = rsel.value;
          if (p7Range.mode === "custom") { var cu = document.getElementById("sh-p7-custom"); if (cu) cu.style.display = "inline-flex"; }
          else buildP7();
        });
        var wireDate = function (id, key) {
          var elx = host.querySelector(id);
          if (elx) elx.addEventListener("change", function () { p7Range[key] = elx.value; if (p7Range.mode === "custom") buildP7(); });
        };
        wireDate("#sh-p7-from", "from");
        wireDate("#sh-p7-to", "to");
      }
    } catch (e) {}
  }

  // ── PHASE 8: Learn & Optimize ────────────────────────────────────────────────
  function buildP8() {
    var content = document.querySelector("#phase-p8 .content");
    if (!content) return;
    var m = derive();
    var html = "";

    if (!m.total) {
      html += emptyPortfolioCard("p8");
      html += honestNote("Once you research targets and run campaigns, Learn & Optimize turns results into recommendations — which verticals convert, which messages win, and how to re-weight your ICP.");
      content.innerHTML = html;
      return;
    }

    // ICP snapshot (real, from saved criteria)
    var cr = DATA.criteria || {};
    var inds = Array.isArray(cr.industries) && cr.industries.length ? cr.industries.join(", ") : "—";
    var sizeBand = (cr.minEmp || cr.maxEmp) ? ((cr.minEmp || 0) + "–" + (cr.maxEmp || "∞") + " employees") : "—";
    html += '<div class="card"><div class="card-title">Your ICP definition</div>' +
      '<div class="grid-2" style="gap:14px;">' +
      kv("Target industries", inds) + kv("Company size", sizeBand) +
      kv("Buying authority", cr.buyingAuth || "—") + kv("Companies evaluated", (DATA.counts && DATA.counts.found) || m.total) +
      "</div></div>";

    // Portfolio insight metrics (real)
    var topInd = m.industries[0];
    html += '<div class="metric-row metric-row-4">' +
      metric("Companies matched", m.total, "in your list", "var(--primary)") +
      metric("Tier-1 share", (m.total ? Math.round(m.tiers[1] / m.total * 100) : 0) + "%", m.tiers[1] + " strong-fit", "var(--success)") +
      metric("With live signals", m.signals.length, m.total ? Math.round(m.signals.length / m.total * 100) + "% of list" : "", "var(--warning)") +
      metric("Avg fit score", m.avgScore, m.avgScore >= 70 ? "healthy" : "refine ICP") +
      "</div>";

    // Data-driven recommendations (computed, honest)
    var recs = buildRecs(m, topInd);
    html += '<div class="card"><div class="card-title">What your data suggests</div>';
    recs.forEach(function (r) {
      html += '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--g100);">' +
        '<span aria-hidden="true" style="font-size:15px;line-height:1.3;">' + r.icon + "</span>" +
        '<div style="font-size:13px;color:var(--sh-ink);line-height:1.55;">' + r.text + "</div></div>";
    });
    html += '<div style="font-size:11px;color:var(--sh-ink2);margin-top:10px;">Recommendations are computed from your researched list — no invented benchmarks.</div></div>';

    html += honestNote("Message-level optimization (open/reply rates, best send times, A/B winners) appears once the Campaign Engine is running.");

    content.innerHTML = html;
    countUp(content);
  }

  function kv(k, v) {
    return '<div><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--sh-ink2);">' + esc(k) + "</div>" +
      '<div style="font-size:14px;font-weight:600;color:var(--sh-ink);margin-top:3px;">' + esc(v) + "</div></div>";
  }

  function buildRecs(m, topInd) {
    var recs = [];
    if (m.tiers[1] > 0 && m.signals.length > 0) {
      var hot = m.signals.filter(function (c) { return companyTier(c) === 1; }).length;
      recs.push({ icon: "⚡", text: "<strong>" + (hot || m.signals.length) + "</strong> " + (hot ? "Tier-1 " : "") + "target" + ((hot || m.signals.length) === 1 ? "" : "s") + " show live buying signals — prioritise these for outreach first." });
    }
    if (topInd) {
      recs.push({ icon: "🎯", text: "Your strongest vertical is <strong>" + esc(topInd.name) + "</strong> (" + topInd.n + " compan" + (topInd.n === 1 ? "y" : "ies") + "). Lead with case studies and language tuned to it." });
    }
    recs.push({ icon: m.avgScore >= 70 ? "✅" : "🔧",
      text: m.avgScore >= 70
        ? "Average fit score is <strong>" + m.avgScore + "</strong> — a focused, high-quality list. Depth of outreach beats adding more names."
        : "Average fit score is <strong>" + m.avgScore + "</strong>, below the 70 sweet-spot. Tighten your ICP (industry or size) or re-weight segments in Market Intel." });
    if (m.tiers[3] > m.tiers[1]) {
      recs.push({ icon: "📉", text: "Tier-3 (exploratory) outnumbers Tier-1. Re-weight segment criteria to promote the fits that matter, or trim the long tail." });
    }
    if (m.upcoming.length) {
      recs.push({ icon: "📅", text: "<strong>" + m.upcoming.length + "</strong> upcoming meeting" + (m.upcoming.length === 1 ? "" : "s") + " — open Meeting Prep to walk in with a dossier-backed prep sheet." });
    } else if (!m.anyCal) {
      recs.push({ icon: "🔌", text: "Connect your calendar to fold meetings into the loop and auto-generate prep sheets from this dossier." });
    }
    return recs;
  }

  // ── wire into navigation ─────────────────────────────────────────────────────
  function render(phase) {
    var build = phase === "p7" ? buildP7 : phase === "p8" ? buildP8 : null;
    if (!build) return;
    // Force a fresh paint on entry (the demo may have repopulated the phase content),
    // so our dashboard always wins. The sig-guard inside buildP7 then suppresses ONLY
    // the redundant background-refresh rebuild — that's what kills the funnel flicker
    // without ever leaving demo content on screen.
    var c = document.querySelector("#phase-" + phase + " .content");
    if (c) c.removeAttribute("data-sh-sig");
    // Paint instantly from cache so the funnel lands and STAYS (no blank flash),
    // then refresh in the background so a fresh Market Intel run is reflected. The
    // guarded loadData above won't clobber a good pipeline, so the rebuild is safe.
    if (DATA.loaded) { try { build(); } catch (e) {} }
    loadData(function () { try { build(); } catch (e) {} });
  }
  function wrapShowPhase() {
    if (window.__shCmdWrapped) return true;
    if (typeof window.showPhase !== "function") return false;
    var orig = window.showPhase;
    window.showPhase = function (p) {
      var r = orig.apply(this, arguments);
      if (p === "p7" || p === "p8") { try { render(p); } catch (e) {} }
      return r;
    };
    window.__shCmdWrapped = true;
    return true;
  }
  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (wrapShowPhase() || tries > 60) clearInterval(t);
    }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
