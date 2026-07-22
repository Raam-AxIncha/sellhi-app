/*
 * SellHi — bottom TASKBAR (app-layer; demo.html stays pristine).
 *
 * #4: a Windows-taskbar-style bar frozen at the bottom on every page. It RELOCATES
 * the sidebar's bottom cluster into a single horizontal strip, in this order:
 *   [ user / Log out ]  [ Workspace switcher ]  [ Music ]  [ DIY ]  [ Shortcuts ]
 *   ......................................................  [ Dark ]  [ Auto-hide pin ]
 * The app shell is shortened by the bar height so nothing is ever covered.
 *
 * #5: an auto-hide toggle (the pin). When on, the sidebar AND the taskbar tuck away
 * and reveal on hover near their edge — for people who want maximum canvas. Off by
 * default (both pinned); the choice persists per device.
 *
 * Desktop only (>=1025px). Elements are MOVED (not cloned), so their existing demo
 * handlers (shOpenMusic, startWatchDemo, shLogout, toggleWorkspaceMenu, …) keep
 * working untouched.
 */
(function () {
  "use strict";
  var BAR_H = 46;
  var isDesktop = function () {
    try { return window.matchMedia("(min-width:1025px)").matches; } catch (e) { return true; }
  };

  function style() {
    if (document.getElementById("sh-taskbar-style")) return;
    var s = document.createElement("style");
    s.id = "sh-taskbar-style";
    s.textContent =
      "@media(min-width:1025px){" +
        // Shell sits ABOVE the fixed taskbar so content is never hidden.
        ".shell{height:calc(100dvh - " + BAR_H + "px)!important;}" +
        // The bar itself.
        "#sh-taskbar{position:fixed;left:0;right:0;bottom:0;height:" + BAR_H + "px;z-index:55;" +
          "display:flex;align-items:center;gap:6px;padding:0 10px;box-sizing:border-box;" +
          "background:rgba(255,255,255,.93);-webkit-backdrop-filter:blur(10px) saturate(1.03);" +
          "backdrop-filter:blur(10px) saturate(1.03);border-top:1px solid var(--sh-line,#e6edec);" +
          "transition:transform .22s ease;}" +
        "body.dark #sh-taskbar{background:rgba(12,20,34,.92);border-top-color:rgba(255,255,255,.08);}" +
        "#sh-taskbar .sh-tb-cell{display:flex;align-items:center;flex:0 0 auto;}" +
        "#sh-taskbar .sh-tb-spacer{flex:1 1 auto;}" +
        "#sh-taskbar .sh-tb-sep{width:1px;height:24px;background:var(--sh-line,#e6edec);margin:0 2px;}" +
        // Compact the relocated demo bits so they sit on one 46px line.
        "#sh-taskbar .user-bar{border:none!important;padding:0 6px!important;gap:8px!important;}" +
        "#sh-taskbar .user-bar .avatar{width:26px;height:26px;font-size:11px;}" +
        "#sh-taskbar .user-bar .user-name{font-size:12px;line-height:1.15;}" +
        "#sh-taskbar .user-bar .user-role{font-size:10px;line-height:1.1;}" +
        "#sh-taskbar .ws-switcher{border:none!important;padding:0 6px!important;}" +
        "#sh-taskbar .ws-switcher .ws-label{display:none!important;}" +
        "#sh-taskbar .ws-current{padding:3px 8px!important;}" +
        "#sh-taskbar .ws-menu{left:auto!important;right:auto!important;width:250px!important;bottom:calc(100% + 8px)!important;}" +
        "#sh-taskbar #music-maniacs-btn{width:auto!important;font-size:12px!important;padding:6px 12px!important;white-space:nowrap;}" +
        "#sh-taskbar .sh-diy-btn{width:auto!important;padding:6px 12px!important;font-size:12px!important;}" +
        "#sh-taskbar #sh-nav-shortcuts{opacity:.8;}" +
        "#sh-taskbar .dark-toggle{margin:0;}" +
        // Auto-hide pin.
        "#sh-tb-pin{background:none;border:none;cursor:pointer;font-size:16px;line-height:1;padding:6px;border-radius:8px;" +
          "color:var(--sh-ink2,#5b6875);opacity:.7;transition:opacity .12s,background .12s;}" +
        "#sh-tb-pin:hover{opacity:1;background:var(--sh-teal-soft,#e1f5ee);}" +
        "#sh-tb-pin{border:1px solid var(--sh-line,#e6edec)!important;opacity:.85;}" +
        // Music -> compact orange (was a wide pink gradient).
        "#sh-taskbar #music-maniacs-btn{background:linear-gradient(90deg,#FF6600,#FF8A3D)!important;" +
          "box-shadow:0 2px 10px rgba(255,102,0,.32)!important;}" +
        // Feedback capsule, relocated into the bar (was a floating FAB).
        "#sh-taskbar #sh-fab{position:static!important;inset:auto!important;margin:0!important;" +
          "box-shadow:none!important;font-size:12px!important;padding:6px 12px!important;height:auto!important;border-radius:9px!important;}" +
        // Live opportunity-usage widget (the 'system tray' chip).
        "#sh-tb-usage{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;white-space:nowrap;" +
          "color:var(--sh-ink,#12302e);background:var(--sh-teal-soft,#e1f5ee);border:1px solid var(--sh-line,#e6edec);" +
          "border-radius:9px;padding:4px 9px;}" +
        "#sh-tb-usage b{color:var(--sh-teal-ink,#0f6e56);font-weight:800;}" +
        // Workspace -> just the mark + name (drop the 'Seller workspace' subline).
        "#sh-taskbar .ws-type{display:none!important;}#sh-taskbar .ws-current br{display:none!important;}" +
        // Lift the demo's save pill ABOVE the bar so it never covers Shortcuts/pin.
        ".save-status{bottom:calc(" + BAR_H + "px + 14px)!important;z-index:53!important;}" +
        // Auto-hide mode: reclaim the bar's space; tuck sidebar + bar; reveal on hover.
        "body.sh-autohide .shell{height:100dvh!important;}" +
        "body.sh-autohide .sidebar{position:fixed;left:0;top:0;bottom:0;z-index:45;" +
          "transform:translateX(-100%);transition:transform .22s ease;box-shadow:2px 0 20px rgba(0,0,0,.12);}" +
        "body.sh-autohide.sh-nav-open .sidebar{transform:translateX(0);}" +
        "body.sh-autohide #sh-taskbar{transform:translateY(100%);}" +
        "body.sh-autohide.sh-tb-open #sh-taskbar{transform:translateY(0);}" +
        "#sh-edge-left{position:fixed;left:0;top:0;bottom:0;width:12px;z-index:44;display:none;}" +
        "#sh-edge-bottom{position:fixed;left:0;right:0;bottom:0;height:8px;z-index:54;display:none;}" +
        "body.sh-autohide #sh-edge-left,body.sh-autohide #sh-edge-bottom{display:block;}" +
      "}" +
      "@media(max-width:1024px){#sh-taskbar,#sh-edge-left,#sh-edge-bottom{display:none;}}";
    document.head.appendChild(s);
  }

  function cell(node) {
    if (!node) return null;
    var c = document.createElement("div");
    c.className = "sh-tb-cell";
    c.appendChild(node);
    return c;
  }

  // Pull the button out of its sidebar wrapper div and drop the empty wrapper.
  function unwrap(node) {
    if (!node) return null;
    var w = node.parentNode;
    if (w && w.parentNode && w.children.length === 1 && w !== document.body) {
      // remove the now-empty wrapper after we take the node
      setTimeout(function () { try { if (!w.children.length) w.remove(); } catch (e) {} }, 0);
    }
    return node;
  }

  var built = false;
  function build() {
    if (built || !isDesktop()) return;
    if (!document.getElementById("wsSwitcher") || !document.getElementById("darkToggle")) return; // wait
    built = true;
    style();

    var bar = document.createElement("div");
    bar.id = "sh-taskbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Workspace taskbar");

    // Left group — the requested order.
    var userBar = document.querySelector(".sidebar .user-bar") || document.querySelector(".user-bar");
    var ws = document.getElementById("wsSwitcher");
    var music = document.getElementById("music-maniacs-btn");
    if (music) music.innerHTML = "&#127925; Demo"; // shorten "Demo for Music Maniacs"
    var diy = document.querySelector('button[onclick*="startWatchDemo"]');
    if (diy) diy.classList.add("sh-diy-btn");
    var shortcuts = document.getElementById("sh-nav-shortcuts");
    var dark = document.getElementById("darkToggle");

    [userBar, ws, unwrap(music), unwrap(diy), unwrap(shortcuts)].forEach(function (el, i) {
      var c = cell(el);
      if (c) { bar.appendChild(c); }
    });

    var spacer = document.createElement("div");
    spacer.className = "sh-tb-spacer";
    bar.appendChild(spacer);

    // Widget: live opportunity-usage chip (fed by /api/usage) — the first of the
    // "system tray" widgets. Silent no-op if usage isn't available.
    var wdg = document.createElement("div");
    wdg.id = "sh-tb-usage";
    wdg.title = "Opportunity usage this month";
    wdg.innerHTML = '<span aria-hidden="true">&#9889;</span><span id="sh-tb-usage-txt">&hellip;</span>';
    bar.appendChild(cell(wdg));
    try {
      fetch("/api/usage", { credentials: "include" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.ok) { wdg.style.display = "none"; return; }
          var cap = (j.cap == null) ? "∞" : j.cap;
          var t = document.getElementById("sh-tb-usage-txt");
          if (t) t.innerHTML = "<b>" + j.used + "</b>/" + cap;
          wdg.title = "Opportunity usage: " + j.used + " of " + cap + " signal accounts this month" +
            (j.state === "bench" ? " · Bench" : "");
        })
        .catch(function () { wdg.style.display = "none"; });
    } catch (e) { wdg.style.display = "none"; }

    // Feedback capsule -> into the bar.
    var fab = document.getElementById("sh-fab");
    if (fab) bar.appendChild(cell(fab));

    var dc = cell(unwrap(dark));
    if (dc) bar.appendChild(dc);

    // Auto-hide pin (#5).
    var pin = document.createElement("button");
    pin.id = "sh-tb-pin";
    pin.type = "button";
    pin.title = "Auto-hide the sidebar & taskbar (reveal on hover)";
    pin.setAttribute("aria-label", "Toggle auto-hide");
    pin.innerHTML = "&#128204;"; // pushpin
    bar.appendChild(pin);

    document.body.appendChild(bar);

    // "Shortcuts" is injected by sellhi-nav.js on its own poll and may not exist
    // when the bar is first built. Keep watching briefly and pull it in (before
    // the spacer) the moment it appears.
    (function () {
      var n = 0;
      var st = setInterval(function () {
        n++;
        var sc = document.getElementById("sh-nav-shortcuts");
        if (sc && !bar.contains(sc)) {
          var c = cell(unwrap(sc));
          if (c) { try { bar.insertBefore(c, spacer); } catch (e) { bar.appendChild(c); } }
        }
        if ((sc && bar.contains(sc)) || n > 50) clearInterval(st);
      }, 80);
    })();

    // Edge hover zones for reveal.
    var eL = document.createElement("div"); eL.id = "sh-edge-left";
    var eB = document.createElement("div"); eB.id = "sh-edge-bottom";
    document.body.appendChild(eL);
    document.body.appendChild(eB);

    // ---- Auto-hide state + reveal wiring ----
    var AH = "sh_autohide";
    function setAutohide(on) {
      document.body.classList.toggle("sh-autohide", !!on);
      pin.style.color = on ? "var(--sh-teal-ink,#0f6e56)" : "";
      pin.innerHTML = on ? "&#128205;" : "&#128204;"; // dropped-pin when active
      try { window.localStorage.setItem(AH, on ? "1" : "0"); } catch (e) {}
    }
    pin.addEventListener("click", function () {
      setAutohide(!document.body.classList.contains("sh-autohide"));
    });
    try { if (window.localStorage.getItem(AH) === "1") setAutohide(true); } catch (e) {}

    // Reveal helpers (with a small close delay so it doesn't flicker).
    var navT, tbT;
    var sidebar = document.querySelector(".sidebar");
    function openNav() { clearTimeout(navT); document.body.classList.add("sh-nav-open"); }
    function closeNav() { clearTimeout(navT); navT = setTimeout(function () { document.body.classList.remove("sh-nav-open"); }, 260); }
    function openTb() { clearTimeout(tbT); document.body.classList.add("sh-tb-open"); }
    function closeTb() { clearTimeout(tbT); tbT = setTimeout(function () { document.body.classList.remove("sh-tb-open"); }, 260); }

    eL.addEventListener("mouseenter", openNav);
    if (sidebar) { sidebar.addEventListener("mouseenter", openNav); sidebar.addEventListener("mouseleave", closeNav); }
    eB.addEventListener("mouseenter", openTb);
    bar.addEventListener("mouseenter", openTb);
    bar.addEventListener("mouseleave", closeTb);

    // The demo's "All changes saved" pill is permanent by default. Show it briefly
    // on each save, then fade it out.
    // BUG FIX: the observer must NOT watch `style` — poke() writes style.opacity,
    // which re-triggered the observer in an endless loop that kept resetting the
    // hide timer, so the pill never disappeared. Watch only class/text (what an
    // actual save changes: 'save-status saving' -> 'save-status saved').
    try {
      var ss = document.getElementById("save-status");
      if (ss && !ss.__shPill) {
        ss.__shPill = true;
        ss.style.transition = "opacity .4s ease";
        var hideT;
        var poke = function () {
          ss.style.opacity = "1"; ss.style.visibility = "visible";
          clearTimeout(hideT);
          hideT = setTimeout(function () { ss.style.opacity = "0"; ss.style.visibility = "hidden"; }, 2200);
        };
        var mo = new MutationObserver(poke);
        mo.observe(ss, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true, characterData: true });
        poke(); // hide the initial persistent one shortly after load
      }
    } catch (e) {}
  }

  function boot() {
    var n = 0;
    var t = setInterval(function () {
      if (isDesktop()) { build(); }
      if (built || ++n > 80) clearInterval(t);
    }, 80);
    // Rebuild opportunity if the user crosses into desktop later.
    window.addEventListener("resize", function () { if (!built && isDesktop()) build(); });
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
