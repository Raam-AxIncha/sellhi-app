/*
 * SellHi — Welcome gate (app-layer; demo.html stays pristine).
 *
 * Behavior (per Raam): the demo's "Guided concept demo" welcome (#sh-welcome-overlay)
 * shows on EVERY login, for EVERYONE, so people can always revisit the intro/tour.
 * A "Don't show again" checkbox lets anyone opt out permanently on their device.
 * This replaces the old once-per-device auto-suppress AND removes the duplicate
 * second welcome card that used to stack behind it. The card's logo is swapped to the
 * new 6-spoke mark by sellhi-logo.js.
 */
(function () {
  "use strict";
  var OPTOUT = "sellhi_welcome_optout";
  var shownThisLoad = false, wrapped = false;

  function optedOut() {
    try { return localStorage.getItem(OPTOUT) === "1"; } catch (e) { return false; }
  }

  function injectCheckbox(card) {
    if (!card || document.getElementById("sh-welcome-dsa-row")) return;
    var anchor = card.querySelector(".sh-btns");
    var row = document.createElement("label");
    row.id = "sh-welcome-dsa-row";
    row.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;" +
      "font-family:'Raleway',sans-serif;font-size:12.5px;color:#6b7280;cursor:pointer;user-select:none;";
    row.innerHTML = '<input type="checkbox" id="sh-welcome-dsa" style="width:15px;height:15px;accent-color:#008080;cursor:pointer;"> Don’t show this again';
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(row, anchor.nextSibling);
    else card.appendChild(row);
  }

  // Wrap the demo's shWelcomeClose so closing honours the checkbox (opt-out) while
  // keeping its original behaviour (hide + optionally launch the 2-min tour).
  function wrapClose() {
    if (wrapped) return;
    var orig = window.shWelcomeClose;
    if (typeof orig !== "function") return;
    wrapped = true;
    window.shWelcomeClose = function (tour) {
      try {
        var cb = document.getElementById("sh-welcome-dsa");
        if (cb && cb.checked) localStorage.setItem(OPTOUT, "1");
        else localStorage.removeItem(OPTOUT);
      } catch (e) {}
      try { return orig.apply(this, arguments); }
      catch (e) { var o = document.getElementById("sh-welcome-overlay"); if (o) o.style.display = "none"; }
    };
  }

  function ensure() {
    var ov = document.getElementById("sh-welcome-overlay");
    if (!ov) return false;
    injectCheckbox(document.getElementById("sh-welcome-card"));
    wrapClose();
    if (!shownThisLoad) {
      shownThisLoad = true;
      // Show every load for everyone, unless this device opted out.
      ov.style.display = optedOut() ? "none" : "flex";
    }
    return true;
  }

  function boot() {
    var n = 0;
    var t = setInterval(function () {
      var ok = ensure();
      if ((ok && wrapped) || ++n > 100) clearInterval(t);
    }, 100);
  }
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(boot, 0);
  else window.addEventListener("load", boot);
})();
