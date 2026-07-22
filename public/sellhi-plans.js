/*
 * SellHi — PLANS as an in-app view (app-layer; demo.html stays pristine).
 *
 * The nav "Plans" link (and the Command Center "Plans →" link) used to navigate
 * away to the standalone /connect page — which has no sidebar/taskbar. Instead we
 * open the SAME page INSIDE the app shell: a full-height panel in the main content
 * area hosting /connect?embed=1. The sidebar + bottom taskbar stay put, so Plans
 * feels like every other page. Zero duplication — it reuses the real page, so its
 * pricing logic + autosave keep working untouched.
 */
(function () {
  "use strict";

  function style() {
    if (document.getElementById("sh-plans-style")) return;
    var s = document.createElement("style");
    s.id = "sh-plans-style";
    s.textContent =
      // Fixed overlay anchored (via JS) to the exact box of #main-content, so it
      // reliably covers the content area — sidebar stays left, taskbar stays below.
      // z-index above the sticky progress bar (62) but the taskbar (55) is outside
      // this box, so it stays usable.
      "#sh-plans-view{position:fixed;z-index:63;display:flex;flex-direction:column;overflow:hidden;" +
        "background:var(--sh-surface,#f6f8f9);}" +
      "body.dark #sh-plans-view{background:#0b1220;}" +
      "#sh-plans-head{display:flex;align-items:center;gap:12px;padding:12px 22px;flex:0 0 auto;" +
        "border-bottom:1px solid var(--sh-line,#e6edec);background:rgba(255,255,255,.9);" +
        "-webkit-backdrop-filter:blur(9px) saturate(1.03);backdrop-filter:blur(9px) saturate(1.03);}" +
      "body.dark #sh-plans-head{background:rgba(12,20,34,.85);border-bottom-color:rgba(255,255,255,.08);}" +
      "#sh-plans-head .sh-plans-title{font-size:18px;font-weight:800;color:var(--sh-ink,#12302e);}" +
      "#sh-plans-close{margin-left:auto;background:none;border:none;font-size:22px;line-height:1;cursor:pointer;" +
        "color:var(--sh-ink2,#5b6875);padding:2px 9px;border-radius:8px;transition:background .12s,color .12s;}" +
      "#sh-plans-close:hover{background:var(--sh-teal-soft,#e1f5ee);color:var(--sh-ink,#12302e);}" +
      "#sh-plans-back{background:none;border:1px solid var(--sh-line,#e6edec);border-radius:8px;cursor:pointer;" +
        "font-family:inherit;font-size:13px;font-weight:700;color:var(--sh-ink,#12302e);padding:6px 12px;" +
        "display:inline-flex;align-items:center;gap:5px;transition:border-color .12s,background .12s,color .12s;}" +
      "#sh-plans-back:hover{border-color:var(--sh-teal,#008080);color:var(--sh-teal-ink,#0f6e56);background:var(--sh-teal-soft,#e1f5ee);}" +
      "body.dark #sh-plans-back{color:var(--sh-ink,#e8eef7);border-color:rgba(255,255,255,.14);}" +
      "#sh-plans-frame{flex:1 1 auto;width:100%;border:none;display:block;}";
    document.head.appendChild(s);
  }

  // Anchor the fixed overlay to the current on-screen box of the content area.
  function place() {
    var v = document.getElementById("sh-plans-view");
    var main = document.getElementById("main-content") || document.querySelector(".main");
    if (!v || !main) return;
    var r = main.getBoundingClientRect();
    v.style.left = r.left + "px";
    v.style.top = r.top + "px";
    v.style.width = r.width + "px";
    v.style.height = r.height + "px";
  }

  var histPushed = false;
  function pushHist() {
    if (histPushed) return;
    try { history.pushState({ shPlans: 1 }, ""); histPushed = true; } catch (e) {}
  }

  function openPlans() {
    style();
    var v = document.getElementById("sh-plans-view");
    if (v) { v.style.display = "flex"; place(); markNav(true); pushHist(); return; }
    v = document.createElement("div");
    v.id = "sh-plans-view";
    v.setAttribute("role", "region");
    v.setAttribute("aria-label", "Plans");
    v.innerHTML =
      '<div id="sh-plans-head">' +
        '<button id="sh-plans-back" type="button">&#8592; Back to app</button>' +
        '<div class="sh-plans-title">Plans</div>' +
        '<button id="sh-plans-close" type="button" title="Close Plans" aria-label="Close Plans">&times;</button>' +
      "</div>" +
      '<iframe id="sh-plans-frame" src="/connect?embed=1" title="Plans"></iframe>';
    document.body.appendChild(v); // body-level so it can't be clipped by the scroller
    place();
    var x = document.getElementById("sh-plans-close");
    if (x) x.addEventListener("click", function () { closePlans(); });
    var bk = document.getElementById("sh-plans-back");
    if (bk) bk.addEventListener("click", function () { closePlans(); });
    // Hide the embedded page's own SellHi logo lockup so it doesn't look like a
    // second, duplicate app header inside the panel (same-origin, so this is allowed).
    var frame = document.getElementById("sh-plans-frame");
    if (frame) frame.addEventListener("load", function () {
      try {
        var d = frame.contentDocument;
        if (d && d.head && !d.getElementById("sh-embed-style")) {
          var st = d.createElement("style"); st.id = "sh-embed-style";
          st.textContent = ".sh-logolock{display:none!important}";
          d.head.appendChild(st);
        }
      } catch (e) {}
    });
    markNav(true);
    pushHist();
  }

  function closePlans(fromPop) {
    var v = document.getElementById("sh-plans-view");
    if (v) v.style.display = "none";
    markNav(false);
    // Pop our history entry on a user-initiated close so browser Back stays clean;
    // skip when the close was itself triggered by Back (popstate).
    if (histPushed && fromPop !== true) { histPushed = false; try { history.back(); } catch (e) {} }
    else { histPushed = false; }
  }

  // Browser Back closes the Plans panel (instead of doing nothing / leaving the app).
  window.addEventListener("popstate", function () {
    var v = document.getElementById("sh-plans-view");
    if (v && v.style.display !== "none") { histPushed = false; closePlans(true); }
  });

  function markNav(on) {
    var link = document.getElementById("sh-nav-connect");
    if (link) link.classList.toggle("active", !!on);
  }

  window.shOpenPlans = openPlans;
  window.shClosePlans = closePlans;

  // One delegated listener handles every entry/exit point, and survives the
  // Command Center re-rendering its "Plans →" link.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href]');
    if (a) {
      var href = a.getAttribute("href") || "";
      if (href === "/connect" || href.indexOf("/connect") === 0) {
        e.preventDefault();
        openPlans();
        return;
      }
    }
    // Navigating to any phase closes the Plans view.
    var nav = t.closest(".sidebar-nav .nav-item");
    if (nav && nav.id !== "sh-nav-connect") closePlans();
  }, true);

  // Keep the overlay aligned to the content area as the window/sidebar changes.
  window.addEventListener("resize", function () {
    var v = document.getElementById("sh-plans-view");
    if (v && v.style.display !== "none") place();
  });
})();
