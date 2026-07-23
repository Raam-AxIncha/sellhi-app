/*
 * SellHi — animated brand logo (app-layer; demo.html stays pristine).
 * Renders the SellHi lockup as inline SVG so parts animate independently:
 *   • teal arrow  — static (keeps its upward-growth meaning)
 *   • orange nav-wheel (reticle) — rotates CLOCKWISE continuously
 *   • wordmark "Sell" + "Hi" — "Hi" twinkles like a shining star (CSS)
 * SHLogo.mark() is reused by the wait-state loader so brand + spinner match.
 * Styling + keyframes live in sellhi-overrides.css.
 */
(function () {
  var TEAL = "#178a8a", ORANGE = "#F26A21";

  // Icon only: arrow (static) + nav-wheel group (class sh-wheel -> CSS spins it).
  function mark() {
    return '<svg class="sh-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<g class="sh-arrow" fill="none" stroke="' + TEAL + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M17,86 L49,54"/>' +
        '<path d="M49,54 L33,54 M49,54 L49,70"/>' +
      '</g>' +
      '<g class="sh-wheel" fill="none" stroke="' + ORANGE + '" stroke-width="6" stroke-linecap="round">' +
        '<circle cx="65" cy="35" r="12.5"/>' +
        '<circle cx="65" cy="35" r="4.5" fill="' + ORANGE + '" stroke="none"/>' +
        '<path d="M65,16.5 L65,7.5 M81,25.8 L88.8,21.3 M81,44.3 L88.8,48.8 M65,53.5 L65,62.5 M49,44.3 L41.2,48.8 M49,25.8 L41.2,21.3" stroke-width="5"/>' +
      '</g>' +
    '</svg>';
  }
  window.SHLogo = { mark: mark };

  function injectSidebar() {
    var host = document.querySelector(".sidebar-logo");
    if (!host) return false;                                  // not ready -> retry
    if (host.getAttribute("data-sh-logo") === "1") return true;
    host.setAttribute("data-sh-logo", "1");
    host.innerHTML =
      '<span class="sh-brandlogo">' + mark() +
      '<span class="sh-brandword">Sell<sup class="sh-brandhi">Hi</sup></span></span>';
    return true;
  }

  // Swap the demo's "Guided concept demo" welcome card logo (old favicon PNG) for
  // the new animated mark, so the post-login welcome matches the brand. demo.html
  // stays pristine.
  function injectWelcome() {
    var card = document.getElementById("sh-welcome-card");
    if (!card) return false;
    if (card.getAttribute("data-sh-logo") === "1") return true;
    var img = card.querySelector("img");
    if (!img) { card.setAttribute("data-sh-logo", "1"); return true; }
    card.setAttribute("data-sh-logo", "1");
    var wrap = document.createElement("div");
    wrap.style.cssText = "width:56px;height:56px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;";
    wrap.innerHTML = mark();
    var svg = wrap.querySelector(".sh-mark");
    if (svg) { svg.style.width = "56px"; svg.style.height = "56px"; }
    img.parentNode.replaceChild(wrap, img);
    return true;
  }

  function boot() {
    var n = 0;
    var t = setInterval(function () { var a = injectSidebar(), b = injectWelcome(); if ((a && b) || ++n > 60) clearInterval(t); }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
