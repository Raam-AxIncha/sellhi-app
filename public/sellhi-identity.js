/*
 * SellHi identity bootstrap — runs on top of the exact live demo.
 * Swaps the hardcoded "Raam / Fractional Pro" corner for the REAL logged-in user
 * and wires the sidebar "Log out" to the real sign-out. Nothing else changes.
 */
(function () {
  function initials(name) {
    return (name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0].toUpperCase()).join("") || "U";
  }

  function apply(u) {
    if (!u || !u.signedIn) return;
    var name = u.fullName || "";
    var title = u.title || "Fractional Pro";
    var nameEl = document.getElementById("sidebar-user-name");
    var roleEl = document.getElementById("sidebar-user-role");
    var avEl = document.getElementById("sidebar-avatar");
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = title;
    if (avEl) avEl.textContent = initials(name);
  }

  // Real sign-out: override the demo's mock shLogout so the button ends the session.
  window.shLogout = function () { window.location.href = "/auth/signout"; };

  function run() {
    var u = window.__SELLHI_USER__;
    var go = u
      ? function () { apply(u); }
      : function () {
          fetch("/api/me", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && apply(d)).catch(() => {});
        };
    // Apply after the demo's own init has run, with one safety re-apply.
    setTimeout(go, 300);
    setTimeout(go, 1500);
  }

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run);
})();
