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
  function boot() {
    var n = 0;
    var t = setInterval(function () { if (addItem() || ++n > 20) clearInterval(t); }, 200);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();

/* --- Back-button / browser-history support for the single-page phase flow ---
 * The app navigates in-page (showPhase / pXStep / pXTab) without touching the URL,
 * so Back/refresh dumped you at Identity Engine. We mirror the actual navigation
 * path into history.pushState by wrapping those globals: Back/Forward now retrace
 * the exact phases + steps visited, and a refresh restores the current view.
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
        if (STEP_PHASES[pos.ph] && typeof window[pos.ph + "Step"] === "function") window[pos.ph + "Step"](pos.sub);
        else if (TAB_PHASES[pos.ph] && typeof window[pos.ph + "Tab"] === "function") { window[pos.ph + "Tab"](pos.sub); setTabActive(pos.ph, pos.sub); }
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
      ["showPhase","p1Step","p2Step","p3Step","p5Tab","p6Tab","p8Tab"].forEach(wrap);
      if ((wrapped.showPhase && wrapped.p3Step) || tries > 60) clearInterval(t);
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
