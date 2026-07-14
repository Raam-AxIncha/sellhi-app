/*
 * SellHi Phase 4 — Market Intel (real target-company long-list).
 * The demo's simulateP2Research() plays a fake 3.5s spinner and reveals hard-coded
 * sample companies. We override that global at runtime (demo.html stays pristine):
 * keep the loading overlay up while Claude researches real ICP-matching companies
 * via /api/market, then rebuild the company list, the industry filter (dynamically,
 * from the actual results) and the header counts. On any failure we fall back to the
 * demo's original sample cards + an honest toast.
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

  // Build one .signal-card matching the demo markup exactly, so filterP2Companies()
  // and the dropdowns keep working. The "why" rides along as a hover tooltip.
  function cardHTML(c) {
    var tier = c.tier === 1 || c.tier === 2 || c.tier === 3 ? c.tier : 3;
    var badge = TIER_BADGE[tier] || "badge-gray";
    var subParts = [];
    if (c.industry) subParts.push(esc(c.industry));
    if (c.employees) subParts.push(esc(c.employees) + " employees");
    if (c.stage) subParts.push(esc(c.stage));
    if (c.arr) subParts.push(esc(c.arr));
    var sub = subParts.join(" &middot; ");
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

  // Rebuild the industry <select> from the industries actually present in results,
  // preserving the leading "All industries" option. This is the "dynamic filter".
  function rebuildIndustryFilter(companies) {
    var sel = document.getElementById("p2-filter-industry");
    if (!sel) return;
    var seen = {};
    var opts = ['<option value="">All industries</option>'];
    companies.forEach(function (c) {
      var ind = (c.industry || "").trim();
      if (ind && !seen[ind]) {
        seen[ind] = 1;
        opts.push("<option>" + esc(ind) + "</option>");
      }
    });
    sel.innerHTML = opts.join("");
    sel.value = "";
  }

  function updateCounts(counts) {
    var s2 = document.getElementById("p2-s2");
    if (!s2 || !counts) return;
    var vals = $all(".metric-value", s2);
    if (vals[0] && typeof counts.found === "number") vals[0].textContent = counts.found;
    if (vals[1] && typeof counts.matchICP === "number") vals[1].textContent = counts.matchICP;
    if (vals[2] && typeof counts.activeSignals === "number") vals[2].textContent = counts.activeSignals;
  }

  function render(companies, counts) {
    var list = document.getElementById("p2-company-list");
    if (!list || !Array.isArray(companies) || !companies.length) return false;
    list.innerHTML = companies.map(cardHTML).join("");
    rebuildIndustryFilter(companies);
    updateCounts(counts);
    // Reset search + let the demo's own filter recompute the result count / empty state.
    var search = document.getElementById("p2-search");
    if (search) search.value = "";
    var tierSel = document.getElementById("p2-filter-tier");
    if (tierSel) tierSel.value = "";
    if (typeof window.filterP2Companies === "function") {
      try { window.filterP2Companies(); } catch (e) {}
    } else {
      var rc = document.getElementById("p2-result-count");
      if (rc) rc.textContent = companies.length + " result" + (companies.length !== 1 ? "s" : "");
    }
    return true;
  }

  function collectCriteria() {
    var industries = $all("#p2-industries .chip.active").map(function (el) {
      return (el.textContent || "").trim();
    });
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
      // Advance to the results sub-step + show the overlay, exactly as the demo does.
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
            var painted = render(res.j.companies, res.j.counts);
            if (painted) {
              try { toast("success", "Market Intel ready — " + res.j.companies.length + " real matches found."); } catch (e) {}
              return;
            }
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
      if (overrideResearch() || tries > 40) clearInterval(t);
    }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
