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
        '<path d="M65,16.5 L65,8 M65,53.5 L65,62 M84.5,35 L93,35 M45.5,35 L37,35" stroke-width="5"/>' +
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

  function boot() {
    var n = 0;
    var t = setInterval(function () { if (injectSidebar() || ++n > 40) clearInterval(t); }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
