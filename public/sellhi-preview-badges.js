/*
 * SellHi — "Preview" markers for tabs that are not yet wired to a live backend.
 * Honest signalling for the pilot: only the Identity Engine (p1) is live today.
 * Adds a small "Preview" pill on each not-yet-live nav item and a slim banner at
 * the top of each not-yet-live phase, so sample data is never mistaken for real.
 * App-layer only — demo.html stays pristine. Update NOT_LIVE as phases go live.
 */
(function () {
  // Phases still showing scripted/sample data. Remove an entry when it goes live.
  var NOT_LIVE = ["p2", "p3", "p4", "p5", "p6", "p7", "p8"];

  function pill() {
    var s = document.createElement("span");
    s.className = "sh-preview-pill";
    s.textContent = "Preview";
    s.setAttribute("aria-label", "Preview — sample data, not yet live");
    s.style.cssText =
      "margin-left:auto;font-size:9px;font-weight:700;letter-spacing:.4px;" +
      "text-transform:uppercase;color:#92400E;background:#FEF3C7;border:1px solid #FDE68A;" +
      "border-radius:999px;padding:1px 6px;line-height:1.5;flex:0 0 auto;";
    return s;
  }

  function banner() {
    var d = document.createElement("div");
    d.className = "sh-preview-banner";
    d.setAttribute("role", "note");
    d.style.cssText =
      "display:flex;align-items:center;gap:8px;margin:0 0 14px 0;padding:8px 12px;" +
      "background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;" +
      "font-size:12px;color:#92400E;font-weight:600;";
    d.innerHTML =
      '<span aria-hidden="true">&#9888;</span>' +
      "<span>Preview &middot; this section shows sample data and isn't connected to your live account yet.</span>";
    return d;
  }

  function badgeNav() {
    var items = document.querySelectorAll('.nav-item[onclick]');
    items.forEach(function (el) {
      var oc = el.getAttribute("onclick") || "";
      var m = oc.match(/showPhase\('(p\d+)'\)/);
      if (m && NOT_LIVE.indexOf(m[1]) > -1 && !el.querySelector(".sh-preview-pill")) {
        el.appendChild(pill());
      }
    });
  }

  function bannerPhases() {
    NOT_LIVE.forEach(function (p) {
      var anchor = document.getElementById(p + "-breadcrumb") || document.getElementById(p + "-wizard");
      if (!anchor) return;
      var section = anchor.closest(".phase-section");
      if (section && !section.querySelector(".sh-preview-banner")) {
        section.insertBefore(banner(), section.firstChild);
      }
    });
  }

  function run() {
    try { badgeNav(); } catch (e) {}
    try { bannerPhases(); } catch (e) {}
  }

  function boot() {
    // run a few times: the demo may re-render nav/phases after load
    var n = 0;
    var t = setInterval(function () { run(); if (++n > 8) clearInterval(t); }, 250);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
