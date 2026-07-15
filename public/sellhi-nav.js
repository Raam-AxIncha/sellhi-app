/*
 * SellHi — inject a "Meeting Prep" entry into the workspace sidebar that links to
 * the standalone /meetings surface. App-layer only; demo.html stays pristine.
 */
(function () {
  function addItem() {
    if (document.getElementById("sh-nav-meetings")) return true;
    var nav = document.querySelector(".sidebar-nav");
    if (!nav || !nav.firstElementChild) return false; // not ready yet -> retry
    var a = document.createElement("a");
    a.id = "sh-nav-meetings";
    a.className = "nav-item";
    a.href = "/meetings";
    a.setAttribute("role", "menuitem");
    a.style.textDecoration = "none";
    a.style.marginBottom = "8px";
    a.innerHTML =
      '<span class="nav-icon" aria-hidden="true">&#128197;</span>' +
      '<span class="nav-text"> Meeting Prep</span>';
    // Insert at the very top of the sidebar nav. Use firstElementChild (a real
    // direct child) so insertBefore can't throw the way targeting a nested
    // .nav-label did.
    try { nav.insertBefore(a, nav.firstElementChild); return true; }
    catch (e) { return false; }
  }
  function boot() {
    var n = 0;
    var t = setInterval(function () { if (addItem() || ++n > 20) clearInterval(t); }, 200);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
