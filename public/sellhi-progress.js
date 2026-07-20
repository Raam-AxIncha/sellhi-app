/*
 * SellHi — sidebar setup-progress meter (app-layer; demo.html stays pristine).
 * Reads the user's real state (dossier, calendar, campaigns) and shows a compact
 * "Getting started · N/4" bar at the top of the sidebar nav, with a one-tap
 * "Next: …" action pointing at the first incomplete step. Manufactures momentum
 * and a visible finish line. Hides itself entirely once all 4 are done.
 */
(function () {
  function go(p) { try { if (typeof window.showPhase === "function") window.showPhase(p); } catch (e) {} }

  // steps in order; each: label + how to act on it
  var STEPS = [
    { label: "Set up your identity", act: function () { go("p1"); } },
    { label: "Research your market", act: function () { go("p2"); } },
    { label: "Connect your calendar", href: "/meetings" },
    { label: "Stage your first campaign", act: function () { go("p6"); } }
  ];
  var done = [false, false, false, false];

  function compute(cb) {
    var pending = 3;
    function fin() { if (--pending <= 0) cb(); }
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.dossier && j.dossier.data) || {};
        done[0] = !!(d.name || d.company || d.company_url);
        var mc = d.marketCompanies || {};
        var arr = Array.isArray(mc.companies) ? mc.companies : (Array.isArray(mc) ? mc : []);
        done[1] = arr.length > 0;
      }).catch(function () {}).then(fin, fin);
    fetch("/api/meetings", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { done[2] = !!(j && j.connected && (j.connected.google || j.connected.microsoft)); })
      .catch(function () {}).then(fin, fin);
    fetch("/api/campaigns", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { done[3] = !!(j && Array.isArray(j.campaigns) && j.campaigns.length); })
      .catch(function () {}).then(fin, fin);
  }

  function style() {
    if (document.getElementById("sh-setup-style")) return;
    var s = document.createElement("style");
    s.id = "sh-setup-style";
    s.textContent =
      '#sh-setup{margin:2px 14px 12px;padding:11px 12px;border:1px solid var(--sh-line,#e6edec);border-radius:11px;background:rgba(0,128,128,.05);}' +
      'body.dark #sh-setup{background:rgba(55,195,180,.08);border-color:rgba(255,255,255,.10);}' +
      '#sh-setup .h{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:700;letter-spacing:.3px;color:var(--sh-ink2,#5b6875);text-transform:uppercase;}' +
      '#sh-setup .h b{color:var(--sh-teal-ink,#0f6e56);font-weight:700;}' +
      '#sh-setup .bar{height:6px;border-radius:999px;background:var(--sh-line,#e6edec);overflow:hidden;margin:8px 0;}' +
      '#sh-setup .bar i{display:block;height:100%;background:linear-gradient(90deg,#008080,#37c3b4);border-radius:999px;transition:width .5s cubic-bezier(.2,.7,.2,1);}' +
      '#sh-setup .nx{width:100%;text-align:left;background:none;border:none;font-family:inherit;cursor:pointer;font-size:12px;color:var(--sh-ink,#111827);padding:2px 0 0;display:flex;align-items:center;gap:6px;}' +
      '#sh-setup .nx:hover{color:var(--sh-teal-ink,#0f6e56);}' +
      '#sh-setup .nx .lab{font-weight:600;}';
    document.head.appendChild(s);
  }

  function render() {
    var count = done.filter(Boolean).length;
    var host = document.getElementById("sh-setup");
    if (count >= STEPS.length) { if (host) host.remove(); return; } // finished -> no clutter
    var nextIdx = done.indexOf(false);
    var next = STEPS[nextIdx];

    style();
    if (!host) {
      var nav = document.querySelector(".sidebar-nav");
      if (!nav) return;
      host = document.createElement("div");
      host.id = "sh-setup";
      nav.insertBefore(host, nav.firstChild);
    }
    host.innerHTML =
      '<div class="h"><span>Getting started</span><span><b>' + count + '</b>/' + STEPS.length + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(count / STEPS.length * 100) + '%"></i></div>' +
      (next.href
        ? '<a class="nx" href="' + next.href + '" style="text-decoration:none;">Next: <span class="lab">' + next.label + '</span> &#8594;</a>'
        : '<button class="nx" type="button">Next: <span class="lab">' + next.label + '</span> &#8594;</button>');
    var btn = host.querySelector("button.nx");
    if (btn && next.act) btn.onclick = next.act;
  }

  function boot() {
    // Wait for the sidebar, compute state, render once; re-check periodically so the
    // meter advances as the user completes steps in-session.
    var tries = 0;
    var t = setInterval(function () {
      if (document.querySelector(".sidebar-nav")) { clearInterval(t); compute(render); }
      else if (++tries > 40) clearInterval(t);
    }, 200);
    setInterval(function () { compute(render); }, 20000); // gentle refresh
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
