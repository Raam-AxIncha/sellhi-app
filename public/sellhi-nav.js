/*
 * SellHi — inject a "Meeting Prep" entry into the workspace sidebar that links to
 * the standalone /meetings surface. App-layer only; demo.html stays pristine.
 */
(function () {
  function addItem() {
    if (document.getElementById("sh-nav-meetings")) return true;
    var nav = document.querySelector(".sidebar-nav");
    if (!nav || !nav.firstElementChild) return false; // not ready yet -> retry
    var a = document.createElement("a");
    a.id = "sh-nav-meetings";
    a.className = "nav-item";
    a.href = "/meetings";
    a.setAttribute("role", "menuitem");
    a.style.textDecoration = "none";
    a.style.marginBottom = "8px";
    a.innerHTML =
      '<span class="nav-icon" aria-hidden="true">&#128197;</span>' +
      '<span class="nav-text"> Meeting Prep</span>';
    // Insert at the very top of the sidebar nav. Use firstElementChild (a real
    // direct child) so insertBefore can't throw the way targeting a nested
    // .nav-label did.
    try { nav.insertBefore(a, nav.firstElementChild); return true; }
    catch (e) { return false; }
  }
  // Sidebar footer: a discreet "Shortcuts (?)" button that opens the demo's
  // keyboard-shortcuts modal and visibly teaches the "?" key. Placed right after
  // the dark-mode toggle so it's always visible (not in the scrollable phase list).
  function addShortcuts() {
    if (document.getElementById("sh-nav-shortcuts")) return true;
    var dt = document.getElementById("darkToggle");
    var container = dt && dt.parentNode;
    if (!container || !container.parentNode) return false;
    var wrap = document.createElement("div");
    wrap.id = "sh-nav-shortcuts-wrap";
    wrap.style.cssText = "padding:0 16px 8px;";
    var b = document.createElement("button");
    b.id = "sh-nav-shortcuts";
    b.type = "button";
    b.style.cssText = "background:none;border:none;cursor:pointer;font:inherit;font-size:11px;opacity:.6;display:inline-flex;align-items:center;gap:5px;padding:2px;transition:opacity .12s ease;";
    b.setAttribute("title", "Open keyboard shortcuts (or press ?)");
    b.innerHTML = '<span aria-hidden="true">&#9000;</span> Shortcuts ' +
      '<kbd style="padding:0 5px;border:1px solid currentColor;border-radius:4px;font-size:10px;line-height:1.5;">?</kbd>';
    b.addEventListener("mouseenter", function () { b.style.opacity = "1"; });
    b.addEventListener("mouseleave", function () { b.style.opacity = ".6"; });
    b.addEventListener("click", function () { try { if (typeof toggleShortcutsModal === "function") toggleShortcutsModal(); } catch (e) {} });
    wrap.appendChild(b);
    try { container.parentNode.insertBefore(wrap, container.nextSibling); return true; }
    catch (e) { return false; }
  }
  function boot() {
    var n = 0;
    var t = setInterval(function () {
      var done = addItem() && addShortcuts();
      if (done || ++n > 25) clearInterval(t);
    }, 200);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();

/* --- Back-button / browser-history support for the single-page phase flow ---
 * The app navigates in-page (showPhase / pXStep / pXTab) without touching the URL,
 * so Back/refresh dumped you at Identity Engine. We mirror navigation into
 * history.pushState by wrapping showPhase: Back/Forward move between MODULES
 * (Identity, Market Intel, …) — one press per module, not per wizard step (use the
 * in-page Back/Continue buttons to move between steps). A refresh reopens the module.
 * Loading screens are never recorded.
 *
 * Result landmarks: history stays phase-level, but we remember the step where each
 * generated output lives (dossier, positioning, market results). When Back returns
 * the user to a module, restore() drops them on that latest result with their work
 * intact — covering "the steps we need on Back" without step-by-step Back and without
 * dead presses (no extra history entries, so every Back changes the screen).
 * demo.html stays pristine; wrappers chain safely with the other override scripts. */
(function () {
  var PHASES = ["p1","p2","p3","p4","p5","p6","p7","p8"];
  var STEP_PHASES = { p1:1, p2:1, p3:1 };   // numbered wizard steps
  var TAB_PHASES  = { p5:1, p6:1, p8:1 };   // string tab ids
  var restoring = false;
  var cur = { ph: null, sub: undefined };   // last COMMITTED (landable) position
  var pending = null;                        // latest requested position awaiting settle
  var pollTimer = null;
  var waited = 0;
  var wrapped = {};

  // "Result landmarks": when the user GENERATES something in a wizard (dossier,
  // positioning, market results), we remember the step that output lives on. History
  // stays phase-level (one Back press per module), but when Back RETURNS the user to a
  // module, we drop them on its latest generated result — not step 1 — with their work
  // intact. This covers "the steps we need to cover on Back" without step-by-step Back.
  var RESULT_STEP = {};   // e.g. { p1: 3, p2: 2 }
  // Which generate-globals map to which (phase, result-step). Higher step wins.
  var RESULT_FNS = [
    { fn: "simulateP1Dossier",     ph: "p1", step: 1 },  // dossier built
    { fn: "simulateP1Positioning", ph: "p1", step: 3 },  // positioning generated
    { fn: "simulateP2Research",    ph: "p2", step: 2 },  // market results returned
  ];
  function markResultFns() {
    RESULT_FNS.forEach(function (m) {
      var f = window[m.fn];
      if (typeof f !== "function" || f.__shR) return; // re-wrap if a later script replaced it (e.g. market override)
      var wrapped2 = function () {
        try { var c = RESULT_STEP[m.ph]; if (c == null || m.step > c) RESULT_STEP[m.ph] = m.step; } catch (e) {}
        return f.apply(this, arguments);
      };
      wrapped2.__shR = true;
      window[m.fn] = wrapped2;
    });
  }

  function samePos(a, b) { return a && b && a.ph === b.ph && String(a.sub) === String(b.sub); }
  function encode(p) { var h = "#" + p.ph; if (p.sub !== undefined && p.sub !== null && p.sub !== "") h += "-" + p.sub; return h; }
  function decode(hash) {
    hash = (hash || "").replace(/^#/, "");
    if (!hash) return null;
    var parts = hash.split("-"), ph = parts[0];
    if (PHASES.indexOf(ph) < 0) return null;
    var sub = parts.length > 1 ? parts.slice(1).join("-") : undefined;
    if (sub !== undefined && STEP_PHASES[ph]) sub = parseInt(sub, 10);
    return { ph: ph, sub: sub };
  }

  // A view is TRANSIENT while any loading overlay is on screen (the demo toggles
  // `.loading-overlay.active` for every research/generate spinner). We never want a
  // history entry that lands on a spinner — Back or refresh into it would show a
  // stale, empty loading screen. So we only record a view once the app has settled.
  function isLoading() {
    try { return !!document.querySelector(".loading-overlay.active"); } catch (e) { return false; }
  }

  function commit(pos) {
    if (!pos) return;
    if (samePos(cur, pos)) { pending = null; return; }
    cur = { ph: pos.ph, sub: pos.sub };
    pending = null;
    try { history.pushState({ sh: cur }, "", encode(cur)); } catch (e) {}
  }

  // Debounced, loading-aware recorder. This is the "selective" part: rapid or
  // programmatic step advances (e.g. Market Intel jumping to the research step while
  // fetching, or the P1 auto-dossier build) collapse to a SINGLE history entry — the
  // final landable view — instead of one entry per transient screen.
  function schedule(pos) {
    if (restoring) return;                 // popstate restores must never create new entries
    pending = pos;
    waited = 0;
    if (pollTimer) return;                 // a poll is already running; it will pick up `pending`
    pollTimer = setInterval(function () {
      waited += 1;
      if (restoring || !pending) { clearInterval(pollTimer); pollTimer = null; pending = null; return; }
      // Still mid-transition? keep waiting — capped (~15s) so a stuck overlay can't strand history.
      if (isLoading() && waited < 100) return;
      commit(pending);
      clearInterval(pollTimer); pollTimer = null;
    }, 150);
  }
  function cancelPending() {
    pending = null;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function wrap(name) {
    if (wrapped[name]) return;
    var orig = window[name];
    if (typeof orig !== "function") return;
    wrapped[name] = true;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      try {
        if (name === "showPhase") schedule({ ph: arguments[0], sub: undefined });
        else schedule({ ph: name.slice(0, 2), sub: arguments[0] }); // pXStep / pXTab
      } catch (e) {}
      return r;
    };
  }
  function setTabActive(ph, id) {
    var bar = document.getElementById(ph + "-tabs");
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll(".tab"), function (t) {
      var oc = t.getAttribute("onclick") || "";
      if (oc.indexOf("'" + id + "'") > -1) t.classList.add("active"); else t.classList.remove("active");
    });
  }
  function restore(pos) {
    if (!pos) return;
    restoring = true;
    cancelPending();
    try {
      if (typeof window.showPhase === "function") window.showPhase(pos.ph);
      if (pos.sub !== undefined && pos.sub !== null && pos.sub !== "") {
        // Explicit sub (legacy/deep-link) -> honor it exactly.
        if (STEP_PHASES[pos.ph] && typeof window[pos.ph + "Step"] === "function") window[pos.ph + "Step"](pos.sub);
        else if (TAB_PHASES[pos.ph] && typeof window[pos.ph + "Tab"] === "function") { window[pos.ph + "Tab"](pos.sub); setTabActive(pos.ph, pos.sub); }
      } else {
        // Phase-level entry -> land on this module's generated result, if any, so
        // Back returns the user to their work rather than the empty first step.
        var best = RESULT_STEP[pos.ph];
        if (best != null && STEP_PHASES[pos.ph] && typeof window[pos.ph + "Step"] === "function") window[pos.ph + "Step"](best);
      }
    } catch (e) {}
    restoring = false;
    cur = { ph: pos.ph, sub: pos.sub };
  }
  window.addEventListener("popstate", function (e) {
    var pos = (e.state && e.state.sh) || decode(location.hash) || { ph: "p1", sub: undefined };
    restore(pos);
  });
  function boot2() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      // Phase-level history only: wrap showPhase, NOT the per-step/tab globals, so
      // Back moves one module at a time instead of retracing every wizard step.
      ["showPhase"].forEach(wrap);
      // Keep result landmarks current (re-wraps generate-globals if another script
      // replaced them, e.g. the real Market Intel override).
      markResultFns();
      if (wrapped.showPhase || tries > 60) clearInterval(t);
    }, 120);
    var init = decode(location.hash);
    if (init) {
      setTimeout(function () { restore(init); try { history.replaceState({ sh: init }, "", encode(init)); } catch (e) {} }, 450);
    } else {
      cur = { ph: "p1", sub: undefined };
      try { history.replaceState({ sh: cur }, "", "#p1"); } catch (e) {}
    }
  }
  if (document.readyState === "complete") boot2();
  else window.addEventListener("load", boot2);
})();

/* --- Brand loading indicator: the sidebar logo stays STILL (trending-up arrow keeps
 * its meaning + upright); a teal ring ORBITS the mark instead. We inject one ring
 * element next to the logo and size/position it over the mark (via measured rects,
 * so it adapts to any logo size), toggling it on during the initial page load and
 * whenever any research/generate overlay is active. Ring styling in
 * sellhi-overrides.css (.sh-logo-ring). --- */
(function () {
  var ringOn = false, ready = false;
  function markEl() { return document.querySelector(".sidebar-logo-mark"); }
  function loading() { try { return !!document.querySelector(".loading-overlay.active"); } catch (e) { return false; } }
  function getRing(m) {
    var parent = m && m.parentNode; if (!parent) return null;
    var ring = parent.querySelector(".sh-logo-ring");
    if (!ring) {
      try { if (getComputedStyle(parent).position === "static") parent.style.position = "relative"; } catch (e) {}
      ring = document.createElement("span");
      ring.className = "sh-logo-ring";
      ring.setAttribute("aria-hidden", "true");
      parent.appendChild(ring);
    }
    return ring;
  }
  function positionRing(ring, m) {
    try {
      var parent = m.parentNode;
      var pr = parent.getBoundingClientRect(), mr = m.getBoundingClientRect(), pad = 7;
      ring.style.left = (mr.left - pr.left - pad) + "px";
      ring.style.top = (mr.top - pr.top - pad) + "px";
      ring.style.width = (mr.width + pad * 2) + "px";
      ring.style.height = (mr.height + pad * 2) + "px";
    } catch (e) {}
  }
  function setSpin(on) {
    var m = markEl(); if (!m) return;               // logo not in DOM yet -> retry next tick
    var ring = getRing(m); if (!ring) return;
    if (on) { positionRing(ring, m); if (!ringOn) { ring.classList.add("on"); ringOn = true; } }
    else if (ringOn) { ring.classList.remove("on"); ringOn = false; }
  }
  // Show from first paint until shortly after load; thereafter follow overlay state.
  window.addEventListener("load", function () { setTimeout(function () { ready = true; }, 500); });
  setInterval(function () { setSpin(!ready || loading()); }, 180);
})();
