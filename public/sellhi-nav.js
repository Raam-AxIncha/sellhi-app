/*
 * SellHi — inject a "Meeting Prep" entry into the workspace sidebar that links to
 * the standalone /meetings surface. App-layer only; demo.html stays pristine.
 */
(function () {
  function addItem() {
    var nav = document.querySelector(".sidebar-nav");
    if (!nav || document.getElementById("sh-nav-meetings")) return true;
    var a = document.createElement("a");
    a.id = "sh-nav-meetings";
    a.className = "nav-item";
    a.href = "/meetings";
    a.setAttribute("role", "menuitem");
    a.style.textDecoration = "none";
    a.innerHTML =
      '<span class="nav-icon" aria-hidden="true">&#128197;</span>' +
      '<span class="nav-text"> Meeting Prep</span>';
    // Place it just under the brand/logo, above the phase sections.
    var firstLabel = nav.querySelector(".nav-label");
    if (firstLabel) nav.insertBefore(a, firstLabel);
    else nav.insertBefore(a, nav.firstChild);
    return true;
  }
  function boot() {
    var n = 0;
    var t = setInterval(function () { if (addItem() || ++n > 20) clearInterval(t); }, 200);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
