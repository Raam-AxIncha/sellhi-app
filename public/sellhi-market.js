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
      "background:var(--g50);border:1px solid var(--g200);border-radius:8px;font-size:11px;color:var(--sh-ink);";
    d.innerHTML =
      '<span style="font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--sh-ink2);">Tiers</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:5px;"></span>Tier 1 &middot; strong fit (score 80+)</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--warning);margin-right:5px;"></span>Tier 2 &middot; partial (60&ndash;79)</span>' +
      '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--g400);margin-right:5px;"></span>Tier 3 &middot; exploratory (&lt;60)</span>';
    list.parentNode.insertBefore(d, list);
  }

  // The identity "lens": a one-line reminder of who this search is hunting for,
  // so the person SEES their identity driving the pipeline.
  function ensureLens() {
    var list = document.getElementById("p2-company-list");
    if (!list) return;
    var p = personaPack();
    if (!p) return;
    var role = p.level === "exec" ? "leader" : "pro";
    var txt = '<b>Targeting as a Fractional ' + esc(p.functionLabel) + ' ' + role +
      '</b> &mdash; ' + esc(p.icp && p.icp[0] ? p.icp[0] : "your ideal accounts") + ".";
    var lens = document.getElementById("p2-persona-lens");
    if (lens) { lens.innerHTML = txt; return; }
    lens = document.createElement("div");
    lens.id = "p2-persona-lens";
    lens.style.cssText =
      "margin:0 0 10px;padding:9px 13px;border-radius:8px;font-size:12px;line-height:1.5;" +
      "color:var(--sh-ink,#12302e);background:var(--sh-teal-soft,#eef6f5);" +
      "border:1px solid var(--sh-line,#e2ebea);border-left:3px solid var(--sh-teal,#008080);";
    lens.innerHTML = txt;
    list.parentNode.insertBefore(lens, list);
  }

  function renderStep3List() {
    var list = document.getElementById("p2-company-list");
    if (!list) return;
    list.innerHTML = S.companies.map(cardHTML).join("");
    ensureLens();
    ensureTierLegend();
    ensureFindMore();
    var search = document.getElementById("p2-search");
    if (search) search.value = "";
    var tierSel = document.getElementById("p2-filter-tier");
    if (tierSel) tierSel.value = "";
    if (typeof window.filterP2Companies === "function") {
      try { window.filterP2Companies(); } catch (e) {}
    }
  }

  // "Find more accounts": append a fresh batch (server excludes the ones you already
  // have) so the list grows past a single pass — raising the ceiling toward the plan
  // caps without one giant, timeout-prone request.
  function findMoreStyle() {
    if (document.getElementById("sh-find-more-style")) return;
    var s = document.createElement("style");
    s.id = "sh-find-more-style";
    s.textContent =
      ".sh-mini-spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(0,128,128,.25);" +
      "border-top-color:var(--sh-teal,#008080);border-radius:50%;animation:sh-mini-spin .7s linear infinite;" +
      "vertical-align:-2px;margin-right:7px;}" +
      "@keyframes sh-mini-spin{to{transform:rotate(360deg);}}" +
      "@media (prefers-reduced-motion: reduce){.sh-mini-spin{animation-duration:1.6s;}}";
    document.head.appendChild(s);
  }
  function ensureFindMore() {
    var list = document.getElementById("p2-company-list");
    if (!list || document.getElementById("sh-find-more-wrap")) return;
    findMoreStyle();
    var wrap = document.createElement("div");
    wrap.id = "sh-find-more-wrap";
    wrap.style.cssText = "text-align:center;margin:14px 0 4px;";
    var b = document.createElement("button");
    b.id = "sh-find-more";
    b.className = "btn btn-outline btn-sm";
    b.innerHTML = "&#43; Find more accounts";
    b.onclick = function () { findMore(b); };
    wrap.appendChild(b);
    list.parentNode.insertBefore(wrap, list.nextSibling);
  }
  function findMore(btn) {
    if (!S.companies.length) return;
    var orig = btn.innerHTML;
    // Visible wait state: spinner + a minimum on-screen time so the animation
    // registers even when the server answers instantly (e.g. "no more companies").
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    btn.disabled = true;
    btn.innerHTML = '<span class="sh-mini-spin" aria-hidden="true"></span>Finding more…';
    function done(fn) {
      var elapsed = ((window.performance && performance.now) ? performance.now() : 0) - t0;
      setTimeout(function () { btn.disabled = false; btn.innerHTML = orig; try { fn(); } catch (e) {} }, Math.max(0, 700 - elapsed));
    }
    var crit = collectCriteria(); crit.append = true;
    fetch("/api/market", {
      method: "POST", headers: { "content-type": "application/json" },
      credentials: "include", body: JSON.stringify(crit),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        done(function () {
        if (res.ok && res.j && Array.isArray(res.j.companies)) {
          S.companies = res.j.companies;
          S.counts = res.j.counts || S.counts;
          rebuildIndustryFilter();
          applyScoring();
          var added = typeof res.j.added === "number" ? res.j.added : 0;
          try {
            toast(added > 0 ? "success" : "info",
              added > 0 ? ("Found " + added + " more — " + S.companies.length + " accounts total.")
                        : "No new companies this pass — try widening your ICP.");
          } catch (e) {}
        } else {
          try { toast("info", (res.j && res.j.error) || "Couldn’t fetch more right now."); } catch (e) {}
        }
        });
      })
      .catch(function () { done(function () { try { toast("info", "Couldn’t fetch more right now."); } catch (e) {} }); });
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
        '<span style="font-size:13px;font-weight:500;color:var(--sh-ink);margin-right:8px;">' + s.count +
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
    try { renderSmartMatching(); } catch (e) {}
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
  function personaPack() {
    try {
      if (window.SellHiPersona && typeof window.SellHiPersona.pack === "function") {
        return window.SellHiPersona.pack();
      }
    } catch (e) {}
    return null;
  }

  function collectCriteria() {
    var industries = $all("#p2-industries .chip.active").map(function (el) { return (el.textContent || "").trim(); });
    var minEl = document.getElementById("p2-min");
    var maxEl = document.getElementById("p2-max");
    var authEl = document.getElementById("p2-buying-auth");
    var crit = {
      industries: industries,
      minEmp: minEl ? parseInt(minEl.value, 10) || 0 : 0,
      maxEmp: maxEl ? parseInt(maxEl.value, 10) || 0 : 0,
      buyingAuth: authEl ? authEl.value : "",
    };
    // The identity pack drives the whole pipeline: pass the person's function,
    // level, ICP and signals so the backend hunts for THEIR kind of buyer.
    var p = personaPack();
    if (p) {
      crit.persona = {
        functionKey: p.functionKey,
        functionLabel: p.functionLabel,
        level: p.level,
        icp: p.icp,
        signals: p.signals,
      };
    }
    return crit;
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


  // ── Phase 3: Smart Matching (reuses the real Market Intel companies) ────────
  function scoreRingClass(sc){ return sc>=80?'score-high':sc>=60?'score-med':'score-low'; }
  function matchCardHTML(c){
    var score=(typeof c._score==='number')?c._score:weightedScore(c);
    var tier=c._tier||tierForScore(score);
    var bits=[];
    if(c.industry)bits.push(esc(c.industry));
    if(c.employees)bits.push(esc(c.employees)+' employees');
    if(c.stage)bits.push(esc(c.stage));
    if(c.arr)bits.push(esc(c.arr));
    var sub=bits.join(' &middot; ');
    var why=c.why?esc(c.why):'Matched to your ICP on industry, size, and growth-stage fit.';
    var signal=c.why?'<span>&#9889; live signal</span>':'';
    var nm=esc(c.name||'');
    return '<div class="card p3-match" data-name="'+nm+'" data-score="'+score+'" data-industry="'+esc(c.industry||'')+'" data-tier="'+tier+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
      +'<div style="display:flex;gap:12px;align-items:flex-start;"><div class="fb-avatar">'+esc(c.initials||(c.name||'').slice(0,2).toUpperCase())+'</div>'
      +'<div><div style="font-size:15px;font-weight:600;">'+nm+'</div><div style="font-size:12px;color:var(--sh-ink2);">'+sub+'</div></div></div>'
      +'<div class="score-ring '+scoreRingClass(score)+'">'+score+'</div></div>'
      +'<div style="display:flex;gap:16px;margin-top:8px;font-size:12px;color:var(--sh-ink2);"><span>&#9673; Tier '+tier+' fit</span>'+signal+'</div>'
      +'<div style="background:var(--g50);border-radius:6px;padding:10px 14px;margin-top:10px;">'
      +'<div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--sh-ink2);margin-bottom:4px;">Why this match</div>'
      +'<div style="font-size:12px;color:var(--sh-ink);line-height:1.5;">'+why+'</div></div>'
      +'<div style="display:flex;gap:8px;margin-top:10px;">'
      +'<button class="btn btn-sm" style="border:1px solid var(--success);color:var(--success);" data-accept="'+nm+'">Accept</button>'
      +'<button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger);" data-skip="'+nm+'">Skip</button></div>'
      +'</div>';
  }
  function renderSmartMatching(){
    var list=document.getElementById('p3-match-list');
    if(!list) return;
    if(!S.companies.length){
      // No real Market Intel data yet -> honest empty state instead of sample cards.
      list.innerHTML='<div class="empty-state" style="text-align:center;padding:34px 20px;">'
        +'<div style="font-size:15px;font-weight:600;color:var(--sh-ink);margin-bottom:6px;">No matches yet</div>'
        +'<div style="font-size:13px;color:var(--sh-ink2);line-height:1.6;margin-bottom:16px;max-width:420px;margin-left:auto;margin-right:auto;">'
        +'Run Market Intel to research ICP-fit companies. Your best matches appear here automatically.</div>'
        +'<button class="btn btn-primary btn-sm" onclick="try{showPhase(\'p2\')}catch(e){}">Go to Market Intel &#8594;</button>'
        +'</div>';
      var rc=document.getElementById('p3-result-count'); if(rc)rc.textContent='0 matches';
      var empty=document.getElementById('p3-empty'); if(empty)empty.style.display='none';
      return;
    }
    list.innerHTML=S.companies.map(matchCardHTML).join('');
    applySmartFilters();
    renderPositionFit();
  }

  // Step 2: Position Fit — derive CRO/CSO/CMO fit for each real company from the
  // same researched per-criterion sub-scores (transparent weighting model).
  var ROLE_W = {
    CRO: { growth:35, pain:25, funding:25, size:10, industry:5 },
    CSO: { pain:35, size:30, growth:20, funding:10, industry:5 },
    CMO: { industry:35, growth:30, size:15, funding:10, pain:10 }
  };
  function roleFit(c, w){ var sc=c.scores||{}, num=0, den=0; for(var k in w){ var s=typeof sc[k]==='number'?sc[k]:60; num+=w[k]*s; den+=w[k]; } return den?Math.round(num/den):60; }
  function posCell(v, best){ var col=best?(v>=80?'var(--success)':v>=60?'var(--warning)':'var(--danger)'):'var(--g600)'; return '<td style="text-align:center;padding:10px;'+(best?'font-weight:700;':'')+'color:'+col+';">'+v+'%</td>'; }
  function positionRowHTML(c){
    var cro=roleFit(c,ROLE_W.CRO), cso=roleFit(c,ROLE_W.CSO), cmo=roleFit(c,ROLE_W.CMO);
    var best=(cro>=cso&&cro>=cmo)?'CRO':((cso>=cmo)?'CSO':'CMO');
    var tier=c._tier||tierForScore(c._score||Math.max(cro,cso,cmo));
    var badge=TIER_BADGE[tier]||'badge-gray';
    return '<tr style="border-bottom:1px solid var(--g100);"><td style="padding:10px 8px;font-weight:500;">'+esc(c.name)+'</td>'
      +posCell(cro,best==='CRO')+posCell(cso,best==='CSO')+posCell(cmo,best==='CMO')
      +'<td style="text-align:center;padding:10px;"><strong>'+best+'</strong><br><span class="badge '+badge+'">Tier '+tier+'</span></td></tr>';
  }
  function renderPositionFit(){
    var tb=$('#p3-s1 table tbody');
    if(!tb||!S.companies.length) return;
    tb.innerHTML=S.companies.map(positionRowHTML).join('');
  }
  function applySmartFilters(){
    var list=document.getElementById('p3-match-list');
    if(!list) return;
    var cards=$all('.p3-match', list);
    var q=((document.getElementById('p3-search')||{}).value||'').toLowerCase();
    var tf=((document.getElementById('p3-filter-tier')||{}).value||'');
    var sf=((document.getElementById('p3-filter-sort')||{}).value||'');
    if(sf){
      cards.sort(function(a,b){
        if(/name|alpha/i.test(sf)) return (a.dataset.name||'').localeCompare(b.dataset.name||'');
        return (parseInt(b.dataset.score,10)||0)-(parseInt(a.dataset.score,10)||0);
      });
      cards.forEach(function(c){ list.appendChild(c); });
    }
    var tdig=(tf.match(/[0-9]/)||[''])[0];
    var shown=0;
    cards.forEach(function(c){
      var okQ=!q||(c.dataset.name||'').toLowerCase().indexOf(q)!==-1||(c.dataset.industry||'').toLowerCase().indexOf(q)!==-1;
      var okT=!tdig||/all/i.test(tf)||String(c.dataset.tier)===tdig;
      var vis=okQ&&okT; c.style.display=vis?'':'none'; if(vis)shown++;
    });
    var rc=document.getElementById('p3-result-count'); if(rc)rc.textContent=shown+(shown===1?' match':' matches');
    var empty=document.getElementById('p3-empty'); if(empty)empty.style.display=shown?'none':'';
  }
  function wireSmartFilters(){
    ['p3-search','p3-filter-tier','p3-filter-sort'].forEach(function(id){
      var el=document.getElementById(id);
      if(el&&!el.__smWired){ el.__smWired=1; el.addEventListener('input',applySmartFilters); el.addEventListener('change',applySmartFilters); }
    });
    var list=document.getElementById('p3-match-list');
    if(list&&!list.__smWired){ list.__smWired=1; list.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('[data-accept]'):null;
      var sk=e.target.closest?e.target.closest('[data-skip]'):null;
      if(a){ var card=a.closest('.p3-match'); if(card)card.style.display='none'; applySmartFilters(); try{toast('success',a.getAttribute('data-accept')+' added to your shortlist.');}catch(x){} }
      else if(sk){ var card2=sk.closest('.p3-match'); if(card2)card2.style.display='none'; applySmartFilters(); try{toast('info',sk.getAttribute('data-skip')+' skipped.');}catch(x){} }
    }); }
  }
  // Saved shape is { companies:[...], counts, criteria }. Be tolerant of an array too.
  function savedCompanies(d){
    var mc=d&&d.marketCompanies;
    if(mc&&Array.isArray(mc.companies)) return { arr:mc.companies, counts:mc.counts };
    if(Array.isArray(mc)) return { arr:mc, counts:null };
    if(d&&Array.isArray(d.companies)) return { arr:d.companies, counts:null };
    return { arr:null, counts:null };
  }
  function ensureSmartData(cb){
    if(S.companies.length){ cb&&cb(); return; }
    fetch('/api/dossier',{credentials:'include'}).then(function(r){return r.json();}).then(function(j){
      var d=j&&j.dossier&&j.dossier.data;
      var sv=savedCompanies(d);
      if(Array.isArray(sv.arr)&&sv.arr.length){ S.companies=sv.arr; if(sv.counts)S.counts=sv.counts; try{rebuildIndustryFilter();}catch(e){} applyScoring(); }
      cb&&cb();
    }).catch(function(){ cb&&cb(); });
  }
  function wrapShowPhase(){
    if(window.__smShowPhaseWrapped) return true;
    if(typeof window.showPhase!=='function') return false;
    var orig=window.showPhase;
    window.showPhase=function(p){
      var r=orig.apply(this,arguments);
      if(p==='p3'){ try{ wireSmartFilters(); ensureSmartData(renderSmartMatching); }catch(e){} }
      else if(p==='p2'){ try{ ensureSmartData(function(){}); }catch(e){} }
      return r;
    };
    window.__smShowPhaseWrapped=true; return true;
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = overrideResearch();
      if (tries === 1 || ready) { try { wireWeightSliders(); } catch (e) {} }
      try { wireSmartFilters(); wrapShowPhase(); } catch (e) {}
      if (ready || tries > 40) clearInterval(t);
    }, 150);
    // Load any saved Market Intel companies on startup so Market Intel, Smart
    // Matching and Position Fit all show REAL data on open (not just after a run).
    try { ensureSmartData(function () {}); } catch (e) {}
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
