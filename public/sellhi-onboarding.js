/*
 * SellHi Phase 2 — persist onboarding inputs per user.
 * Runs on top of the exact demo. On load it restores the user's saved
 * Identity Engine entries; as they type (and when they continue) it saves
 * them to Supabase via /api/dossier. Fully defensive: if a field or the
 * network isn't there, it quietly no-ops and the demo behaves as before.
 */
(function () {
  // demo field id  ->  api field name
  var MAP = {
    "p1-name": "name",
    "p1-title": "title",
    "p1-company": "company",
    "p1-company-url": "company_url",
    "p1-linkedin-url": "linkedin_url",
    "p1-industries": "industries",
    "p1-deal-size": "deal_size",
  };

  function el(id) { return document.getElementById(id); }

  function collect() {
    var out = {};
    Object.keys(MAP).forEach(function (id) {
      var e = el(id);
      if (e && typeof e.value === "string") out[MAP[id]] = e.value;
    });
    return out;
  }

  var saveTimer = null;
  function save() {
    var payload = collect();
    if (!Object.keys(payload).length) return;
    fetch("/api/dossier", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    }).catch(function () {});
  }
  function saveDebounced() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 700);
  }

  function restore(dossier) {
    if (!dossier) return;
    Object.keys(MAP).forEach(function (id) {
      var e = el(id);
      var v = dossier[MAP[id]];
      if (e && typeof v === "string" && v && !e.value) {
        e.value = v;
        // let the demo's own oninput logic (validation, sidebar sync) run
        try { e.dispatchEvent(new Event("input", { bubbles: true })); } catch (x) {}
      }
    });
    // nudge the demo's helpers if present
    try { if (typeof validateP1Step0 === "function") validateP1Step0(); } catch (x) {}
    try { if (typeof updateSidebarIdentity === "function") updateSidebarIdentity(); } catch (x) {}
  }

  function wire() {
    Object.keys(MAP).forEach(function (id) {
      var e = el(id);
      if (e) {
        e.addEventListener("input", saveDebounced);
        e.addEventListener("change", saveDebounced);
      }
    });
    // also save when they move on from step 0
    var next = el("p1-s0-next");
    if (next) next.addEventListener("click", save);
  }

  function init() {
    wire();
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.dossier) restore(d.dossier); })
      .catch(function () {});
  }

  // run after the demo has initialised its onboarding DOM
  function boot() { setTimeout(init, 500); }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
