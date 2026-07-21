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
      "#main-content{position:relative;}" +
      "#sh-plans-view{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;" +
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
      "#sh-plans-frame{flex:1 1 auto;width:100%;border:none;display:block;}";
    document.head.appendChild(s);
  }

  function openPlans() {
    var main = document.getElementById("main-content") || document.querySelector(".main");
    if (!main) return;
    style();
    var v = document.getElementById("sh-plans-view");
    if (v) { v.style.display = "flex"; markNav(true); return; }
    v = document.createElement("div");
    v.id = "sh-plans-view";
    v.setAttribute("role", "region");
    v.setAttribute("aria-label", "Plans");
    v.innerHTML =
      '<div id="sh-plans-head">' +
        '<div class="sh-plans-title">Plans</div>' +
        '<button id="sh-plans-close" type="button" title="Close Plans" aria-label="Close Plans">&times;</button>' +
      "</div>" +
      '<iframe id="sh-plans-frame" src="/connect?embed=1" title="Plans"></iframe>';
    main.appendChild(v);
    var x = document.getElementById("sh-plans-close");
    if (x) x.addEventListener("click", closePlans);
    markNav(true);
  }

  function closePlans() {
    var v = document.getElementById("sh-plans-view");
    if (v) v.style.display = "none";
    markNav(false);
  }

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
})();
