/*
 * SellHi Phase 5 — Content Factory (real generation).
 * demo.html stays pristine; we override simulateP5Generate() to call /api/content
 * (Claude) and render two real variants into the demo's output cards, and we feed
 * the generator + signals list from the user's real Market Intel companies.
 * Everything is defensive: any failure falls back to the demo's sample behaviour.
 */
(function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var COMPANIES = [];
  var SELECTED = { company: "", signal: "" };

  // ── settings + context ──────────────────────────────────────────────────────
  function collectSettings() {
    var groups = $all("#p5-generator .chip-radio-group");
    function active(g) { var c = g ? g.querySelector(".chip.active") : null; return c ? (c.textContent || "").trim() : ""; }
    var ctxDiv = $('#p5-generator div[style*="var(--primary-light)"]');
    var ctx = ctxDiv ? (ctxDiv.textContent || "").trim() : "";
    var instr = "";
    var ta = document.getElementById("p5-custom-instructions");
    if (ta) instr = ta.value || "";
    return {
      company: SELECTED.company || (ctx.split("—")[0] || "").trim(),
      signal: SELECTED.signal || ctx,
      tone: active(groups[0]) || "Professional",
      length: active(groups[1]) || "Medium",
      channel: active(groups[2]) || "Email",
      instructions: instr,
    };
  }

  function setContext(c) {
    if (!c) return;
    SELECTED = { company: c.name || "", signal: contextLine(c) };
    var ctxDiv = $('#p5-generator div[style*="var(--primary-light)"]');
    if (ctxDiv) ctxDiv.textContent = contextLine(c);
  }
  function contextLine(c) {
    var bits = [c.name];
    if (c.why) bits.push(c.why);
    else {
      var meta = [c.industry, c.employees ? c.employees + " employees" : "", c.stage].filter(Boolean).join(" · ");
      if (meta) bits.push(meta);
    }
    return bits.filter(Boolean).join(" — ");
  }

  // ── output rendering ────────────────────────────────────────────────────────
  function outputCards() {
    var cols = $all("#p5-generator .grid-2 > div");
    var out = cols[1];
    return out ? $all(".card", out) : [];
  }
  function renderVariant(card, v, channel) {
    if (!card || !v) return;
    var divs = $all("div", card);
    var subjDiv = divs.filter(function (d) { return /Subject:/i.test(d.textContent || "") && d.querySelector("strong"); })[0];
    var bodyDiv = divs.filter(function (d) { return /background:\s*var\(--g50\)/.test(d.getAttribute("style") || ""); }).pop();
    if (subjDiv) {
      if (channel === "Email" && v.subject) { subjDiv.style.display = ""; subjDiv.innerHTML = "<strong>Subject:</strong> " + esc(v.subject); }
      else { subjDiv.style.display = "none"; }
    }
    if (bodyDiv) bodyDiv.innerHTML = esc(v.body || "").replace(/\n/g, "<br>");
    if (v.label) {
      var titleRow = $(".card-title", card);
      if (titleRow) titleRow.textContent = "Variant " + (/insight/i.test(v.label) ? "B" : "A") + " — " + v.label;
    }
  }

  function overrideGenerate() {
    if (window.__sellhiContentWrapped) return true;
    if (typeof window.simulateP5Generate !== "function") return false;
    window.simulateP5Generate = function () {
      var overlay = document.getElementById("p5-gen-loading");
      if (overlay) overlay.classList.add("active");
      var s = collectSettings();
      fetch("/api/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(s),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (overlay) overlay.classList.remove("active");
          if (res.ok && res.j && Array.isArray(res.j.variants) && res.j.variants.length) {
            var cards = outputCards();
            renderVariant(cards[0], res.j.variants[0], s.channel);
            if (res.j.variants[1]) renderVariant(cards[1], res.j.variants[1], s.channel);
            try { toast("success", "Generated 2 personalized " + s.channel + " variants."); } catch (e) {}
          } else {
            try { toast("info", (res.j && res.j.error) || "Content generation unavailable — showing samples."); } catch (e) {}
          }
        })
        .catch(function () {
          if (overlay) overlay.classList.remove("active");
          try { toast("info", "Content generation unavailable — showing samples."); } catch (e) {}
        });
    };
    window.__sellhiContentWrapped = true;
    return true;
  }

  // ── real signals list (replaces the demo's mock signal cards) ───────────────
  function signalCardHTML(c) {
    var why = c.why || [c.industry, c.stage].filter(Boolean).join(" · ");
    return (
      '<div class="signal-card" data-company="' + esc(c.name) + '">' +
      '<div class="signal-dot" style="background:var(--primary);"></div>' +
      '<div class="signal-body"><div class="signal-title">' + esc(c.name) + "</div>" +
      '<div class="signal-sub">' + esc(why) + "</div></div>" +
      '<button class="btn btn-sm btn-primary" data-make="' + esc(c.name) + '">Create message</button></div>'
    );
  }
  function populateSignals() {
    if (!COMPANIES.length) return;
    var panel = document.getElementById("p5-signals");
    if (!panel) return;
    // keep the metric row + filters; replace only the signal cards
    $all(".signal-card", panel).forEach(function (n) { n.remove(); });
    var frag = COMPANIES.map(signalCardHTML).join("");
    panel.insertAdjacentHTML("beforeend", frag);
    if (!panel.__contentWired) {
      panel.__contentWired = 1;
      panel.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("[data-make]") : null;
        if (!b) return;
        var name = b.getAttribute("data-make");
        var c = COMPANIES.filter(function (x) { return x.name === name; })[0];
        if (c) setContext(c);
        try { if (typeof p5Tab === "function") p5Tab("generator"); } catch (x) {}
        try { toast("info", name + " loaded into the generator."); } catch (x) {}
      });
    }
    setContext(COMPANIES[0]);
  }

  function loadCompanies(cb) {
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = j && j.dossier && j.dossier.data;
        var mc = d && d.marketCompanies;
        var arr = (mc && Array.isArray(mc.companies)) ? mc.companies : (Array.isArray(mc) ? mc : (d && d.companies));
        if (Array.isArray(arr) && arr.length) COMPANIES = arr;
        cb && cb();
      })
      .catch(function () { cb && cb(); });
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = overrideGenerate();
      if (ready || tries > 40) clearInterval(t);
    }, 150);
    loadCompanies(function () { try { populateSignals(); } catch (e) {} });
    // repopulate when the user navigates into Content Factory
    if (typeof window.showPhase === "function" && !window.__smContentPhase) {
      var orig = window.showPhase;
      window.showPhase = function (p) {
        var r = orig.apply(this, arguments);
        if (p === "p5") { try { overrideGenerate(); populateSignals(); } catch (e) {} }
        return r;
      };
      window.__smContentPhase = true;
    }
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
