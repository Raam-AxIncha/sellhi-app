/*
 * SellHi — "Sample" markers for tabs not yet wired to a live backend.
 * Honest signalling for the pilot: only the Identity Engine (p1) is live today.
 * Each not-yet-live nav item gets a small corner "Sample" tag (absolutely
 * positioned so it never clips the label in the narrow pane) and each not-live
 * phase gets a slim banner. App-layer only — demo.html stays pristine.
 * Update NOT_LIVE / the Time & Invoicing check as modules go live.
 */
(function () {
  // Scripted/sample phases. Remove an entry when that phase goes live.
  var NOT_LIVE = ["p4", "p6", "p7", "p8"];  // p3 Smart Matching + p5 Content Factory now live

  function tag() {
    var s = document.createElement("span");
    s.className = "sh-sample-tag";
    s.textContent = "WIP";
    s.setAttribute("aria-label", "Work in progress — not yet live");
    s.style.cssText =
      "position:absolute;top:3px;right:6px;font-size:8px;font-weight:700;" +
      "letter-spacing:.3px;text-transform:uppercase;color:#92400E;background:#FEF3C7;" +
      "border:1px solid #FDE68A;border-radius:999px;padding:0 5px;line-height:1.6;" +
      "pointer-events:none;z-index:2;";
    return s;
  }

  function banner() {
    var d = document.createElement("div");
    d.className = "sh-sample-banner";
    d.setAttribute("role", "note");
    d.style.cssText =
      "display:flex;align-items:center;gap:8px;margin:0 0 14px 0;padding:8px 12px;" +
      "background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;" +
      "font-size:12px;color:#92400E;font-weight:600;";
    d.innerHTML =
      '<span aria-hidden="true">&#9888;</span>' +
      "<span>Work in progress &middot; this section shows example data and isn't connected to your live account yet.</span>";
    return d;
  }

  function markItem(el) {
    if (!el || el.querySelector(".sh-sample-tag")) return;
    // anchor the absolute tag to the capsule
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(tag());
  }

  function badgeNav() {
    var items = document.querySelectorAll(".nav-item");
    items.forEach(function (el) {
      var oc = el.getAttribute("onclick") || "";
      var m = oc.match(/showPhase\('(p\d+)'\)/);
      var isPhase = m && NOT_LIVE.indexOf(m[1]) > -1;
      var isTimeInv = /Time\s*&\s*Invoicing/i.test(el.textContent || "");
      if (isPhase || isTimeInv) markItem(el);
    });
  }

  function bannerPhases() {
    NOT_LIVE.forEach(function (p) {
      var anchor = document.getElementById(p + "-breadcrumb") || document.getElementById(p + "-wizard");
      if (!anchor) return;
      var section = anchor.closest(".phase-section");
      if (section && !section.querySelector(".sh-sample-banner")) {
        section.insertBefore(banner(), section.firstChild);
      }
    });
  }

  function run() {
    try { badgeNav(); } catch (e) {}
    try { bannerPhases(); } catch (e) {}
  }

  function boot() {
    var n = 0;
    var t = setInterval(function () { run(); if (++n > 8) clearInterval(t); }, 250);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
