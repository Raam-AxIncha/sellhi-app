/* sellhi-fixes.js — small app-layer fixes injected before the other scripts.
   Loaded first so its fetch patch is active when onboarding.js / research.js run.

   Fix 1: De-duplicate concurrent GET /api/dossier calls. On the workspace load,
   both sellhi-onboarding.js and sellhi-research.js independently GET /api/dossier,
   causing two identical requests. This collapses only *in-flight* identical GETs
   (each consumer gets its own response clone) and clears once settled — so there is
   NO time-based caching and never any stale data after a save. */
(function () {
  if (window.__SELLHI_FIXES__) return;
  window.__SELLHI_FIXES__ = true;

  var origFetch = window.fetch.bind(window);
  var inflight = Object.create(null);

  window.fetch = function (input, init) {
    try {
      var url = (typeof input === "string") ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var isDossierGet =
        method === "GET" &&
        url.indexOf("/api/dossier") !== -1 &&
        url.indexOf("dossier-edit") === -1;

      if (isDossierGet) {
        var key = url;
        if (inflight[key]) {
          return inflight[key].then(function (r) { return r.clone(); });
        }
        var p = origFetch(input, init);
        inflight[key] = p;
        var clear = function () { delete inflight[key]; };
        p.then(clear, clear);
        return p.then(function (r) { return r.clone(); });
      }
    } catch (e) { /* fall through to normal fetch on any issue */ }
    return origFetch(input, init);
  };
})();
