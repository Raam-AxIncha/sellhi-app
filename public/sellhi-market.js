/*
 * SellHi Phase 4 — Market Intel (real, connected Steps 3-5).
 * demo.html stays pristine; we override globals + re-render at runtime.
 *
 * Step 3 (results): overrides simulateP2Research() -> real companies from
 *   /api/market, dynamic industry filter, honest header counts, and a tier legend.
 * Step 4 (weights): the sliders + "Recalculate segments" now genuinely re-tier the
 *   real companies using their per-criterion sub-scores, updating the tier counts
 *   AND Step 3's badges AND Step 5.
 * Step 5 (review): segments are built from the actual company list.
 * Any failure falls back to the demo's original sample screens + an honest toast.
 */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var TIER_BADGE = { 1: "badge-green", 2: "badge-amber", 3: "badge-gray" };
  var WEIGHT_KEYS = ["industry", "size", "growth", "pain", "funding"]; // slider order

  // Shared state: the live company list + current weights.
  var S = {
    companies: [],
    counts: null,
    weights: { industry: 85, size: 70, growth: 90, pain: 75, funding: 60 },
  };

  // ── Scoring ───────────────────────────────────────────────────────────────
  function weightedScore(c) {
    var w = S.weights, sc = c.scores || {};
    var num = 0, den = 0;
    WEIGHT_KEYS.forEach(function (k) {
      var wk = typeof w[k] === "number" ? w[k] : 0;
      var sk = typeof sc[k] === "number" ? sc[k] : 60;
      num += wk * sk;
      den += wk;
    });
    return den ? Math.round(num / den) : 60;
  }
  function tierForScore(score) { return score >= 80 ? 1 : score >= 60 ? 2 : 3; }

  // ── Step 3: company cards ──────────────────────────────────────────────────
  function cardHTML(c) {
    var tier = c._tier || c.tier || 3;
    var badge = TIER_BADGE[tier] || "badge-gray";
    var parts = [];
    if (c.industry) parts.push(esc(c.industry));
    if (c.employees) parts.push(esc(c.employees) + " employees");
    if (c.stage) parts.push(esc(c.stage));
    if (c.arr) parts.push(esc(c.arr));
    var sub = parts.join(" &middot; ");
    var title = c.why ? ' title="' + esc(c.why) + '"' : "";
    return (
      '<div class="signal-card" data-name="' + esc(c.name) + '" data-industry="' + esc(c.industry) +
      '" data-tier="' + tier + '"' + title + ">" +
      '<div class="fb-avatar">' + esc(c.initials || c.name.slice(0, 2).toUpperCase()) + "</div>" +
      '<div class="signal-body"><div class="signal-title">' + esc(c.name) + "</div>" +
      '<div class="signal-sub">' + sub + "</div></div>" +
      '<span class="badge ' + badge + '">Tier ' + tier + "</span></div>"
    );
  }

  function rebuildIndustryFilter() {
    var sel = document.getElementById("p2-filter-industry");
    if (!sel) return;
    var seen = {}, opts = ['<option value="">All industries</option>'];
    S.companies.forEach(function (c) {
      var ind = (c.industry || "").trim();
      if (ind && !seen[ind]) { seen[ind] = 1; opts.push("<option>" + esc(ind) + "</option>"); }
    });
    sel.innerHTML = opts.join("");
    sel.value = "";
  }

  // Small tier legend injected once above the Step 3 list (tiers first appear here).
  function ensureTierLegend() {
    if (document.getElementById("p2-tier-legend")) return;
    var list = document.getElementById("p2-company-list");
    if (!list) return;
    var d = document.createElement("div");
    d.id = "p2-tier-legend";
    d.style.cssText =
      "display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin:0 0 12px 0;padding:8px 12px;" +
      "background:var(--g50);border:1px solid var(--g200);border-radius:8px;font-size:11px;color:var(--g600);";
    d.innerHTML =
      '<span style="font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--g400);">Tiers</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:5px;"></span>Tier 1 &middot; strong fit (score 80+)</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--warning);margin-right:5px;"></span>Tier 2 &middot; partial (60&ndash;79)</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--g400);margin-right:5px;"></span>Tier 3 &middot; exploratory (&lt;60)</span>';
    list.parentNode.insertBefore(d, list);
  }

  function renderStep3List() {
    var list = document.getElementById("p2-company-list");
    if (!list) return;
    list.innerHTML = S.companies.map(cardHTML).join("");
    ensureTierLegend();
    var search = document.getElementById("p2-search");
    if (search) search.value = "";
    var tierSel = document.getElementById("p2-filter-tier");
    if (tierSel) tierSel.value = "";
    if (typeof window.filterP2Companies === "function") {
      try { window.filterP2Companies(); } catch (e) {}
    }
  }

  function updateStep3Counts() {
    var s2 = document.getElementById("p2-s2");
    if (!s2 || !S.counts) return;
    var vals = $all(".metric-value", s2);
    if (vals[0] && typeof S.counts.found === "number") vals[0].textContent = S.counts.found;
    if (vals[1] && typeof S.counts.matchICP === "number") vals[1].textContent = S.counts.matchICP;
    if (vals[2] && typeof S.counts.activeSignals === "number") vals[2].textContent = S.counts.activeSignals;
  }

  // ── Step 4: tier counts (metric row in p2-s3) ──────────────────────────────
  function updateStep4Counts() {
    var s3 = document.getElementById("p2-s3");
    if (!s3) return;
    var t1 = 0, t2 = 0, t3 = 0;
    S.companies.forEach(function (c) {
      var t = c._tier || c.tier || 3;
      if (t === 1) t1++; else if (t === 2) t2++; else t3++;
    });
    var vals = $all(".metric-value", s3);
    if (vals[0]) vals[0].textContent = t1;
    if (vals[1]) vals[1].textContent = t2;
    if (vals[2]) vals[2].textContent = t3;
  }

  // ── Step 5: segments built from the real companies (p2-s4) ─────────────────
  function mode(arr) {
    var m = {}, best = "", bestN = 0;
    arr.forEach(function (v) { if (!v) return; m[v] = (m[v] || 0) + 1; if (m[v] > bestN) { bestN = m[v]; best = v; } });
    return best;
  }
  function buildSegments() {
    var groups = {};
    S.companies.forEach(function (c) {
      var key = c.industry || "Other";
      (groups[key] = groups[key] || []).push(c);
    });
    return Object.keys(groups).map(function (key) {
      var list = groups[key];
      var stage = mode(list.map(function (c) { return c.stage; }));
      var bestTier = Math.min.apply(null, list.map(function (c) { return c._tier || c.tier || 3; }));
      var subBits = ["Industry: " + key];
      if (stage) subBits.push("Common stage: " + stage);
      var signals = list.filter(function (c) { return c.why; }).length;
      if (signals) subBits.push(signals + " with live signals");
      return { label: key + (stage ? " — " + stage : ""), sub: subBits.join(" · "), count: list.length, tier: bestTier };
    }).sort(function (a, b) { return a.tier - b.tier || b.count - a.count; });
  }
  function renderStep5() {
    var card = $("#p2-s4 .card");
    if (!card) return;
    var title = $(".card-title", card);
    if (!title) return;
    $all(".signal-card", card).forEach(function (n) { n.remove(); });
    var segs = buildSegments();
    var html = segs.map(function (s) {
      var badge = TIER_BADGE[s.tier] || "badge-gray";
      return (
        '<div class="signal-card"><div style="flex:1;">' +
        '<div class="signal-title">' + esc(s.label) + "</div>" +
        '<div class="signal-sub">' + esc(s.sub) + "</div></div>" +
        '<span style="font-size:13px;font-weight:500;color:var(--g600);margin-right:8px;">' + s.count +
        " compan" + (s.count === 1 ? "y" : "ies") + "</span>" +
        '<span class="badge ' + badge + '">Tier ' + s.tier + "</span></div>"
      );
    }).join("");
    title.insertAdjacentHTML("afterend", html);
  }

  // ── Recompute everything from current weights ──────────────────────────────
  function applyScoring() {
    if (!S.companies.length) return;
    S.companies.forEach(function (c) {
      c._score = weightedScore(c);
      c._tier = tierForScore(c._score);
    });
    // Rank strong -> weak so the list reads top-down.
    S.companies.sort(function (a, b) { return (b._score || 0) - (a._score || 0); });
    renderStep3List();
    updateStep3Counts();
    updateStep4Counts();
    renderStep5();
  }

  // ── Step 4 slider wiring ───────────────────────────────────────────────────
  function wireWeightSliders() {
    var rows = $all("#weight-sliders > div");
    rows.forEach(function (row, i) {
      var key = WEIGHT_KEYS[i];
      if (!key) return;
      var input = $("input[type=range]", row);
      var labelSpan = $(".field-label", row) ? $(".field-label", row).nextElementSibling : null;
      if (!input) return;
      S.weights[key] = parseInt(input.value, 10) || S.weights[key];
      input.addEventListener("input", function () {
        S.weights[key] = parseInt(input.value, 10) || 0;
        if (labelSpan) labelSpan.textContent = S.weights[key] + "%";
      });
    });
    // "Recalculate segments" -> real recompute (replaces the demo's toast-only handler).
    var recalc = $all("#p2-s3 .btn").filter(function (b) {
      return /recalculate/i.test(b.textContent || "");
    })[0];
    if (recalc) {
      recalc.onclick = function () {
        applyScoring();
        try { toast("success", "Segments recalculated with your weights."); } catch (e) {}
      };
    }
  }

  // ── Criteria collection + research trigger (Step 3) ────────────────────────
  function collectCriteria() {
    var industries = $all("#p2-industries .chip.active").map(function (el) { return (el.textContent || "").trim(); });
    var minEl = document.getElementById("p2-min");
    var maxEl = document.getElementById("p2-max");
    var authEl = document.getElementById("p2-buying-auth");
    return {
      industries: industries,
      minEmp: minEl ? parseInt(minEl.value, 10) || 0 : 0,
      maxEmp: maxEl ? parseInt(maxEl.value, 10) || 0 : 0,
      buyingAuth: authEl ? authEl.value : "",
    };
  }

  var LOADING_STEPS = [
    "Reading your ICP criteria...",
    "Searching the open web...",
    "Screening companies by size & industry...",
    "Checking for live buying signals...",
    "Scoring and tiering matches...",
    "Building your target list...",
  ];

  function overrideResearch() {
    if (typeof window.simulateP2Research !== "function") return false;
    if (window.__sellhiMarketWrapped) return true;

    window.simulateP2Research = function () {
      try { if (typeof p2Step === "function") p2Step(2); } catch (e) {}
      var overlay = document.getElementById("p2-loading");
      var loadingText = overlay ? overlay.querySelector(".loading-text") : null;
      if (overlay) overlay.classList.add("active");

      var i = 0;
      var interval = setInterval(function () {
        i = (i + 1) % LOADING_STEPS.length;
        if (loadingText) loadingText.textContent = LOADING_STEPS[i];
      }, 1600);
      function finish() {
        clearInterval(interval);
        if (loadingText) loadingText.textContent = "AI is researching companies matching your ICP...";
        if (overlay) overlay.classList.remove("active");
      }

      fetch("/api/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(collectCriteria()),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          finish();
          if (res.ok && res.j && Array.isArray(res.j.companies) && res.j.companies.length) {
            S.companies = res.j.companies;
            S.counts = res.j.counts || null;
            rebuildIndustryFilter();
            applyScoring(); // paints Steps 3, 4 counts, and 5 consistently
            try { toast("success", "Market Intel ready — " + S.companies.length + " real matches found."); } catch (e) {}
            return;
          }
          var msg = (res.j && res.j.error) || "Market Intel unavailable — showing sample companies.";
          try { toast("info", msg); } catch (e) {}
        })
        .catch(function () {
          finish();
          try { toast("info", "Market Intel unavailable — showing sample companies."); } catch (e) {}
        });
    };
    window.__sellhiMarketWrapped = true;
    return true;
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = overrideResearch();
      if (tries === 1 || ready) { try { wireWeightSliders(); } catch (e) {} }
      if (ready || tries > 40) clearInterval(t);
    }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
