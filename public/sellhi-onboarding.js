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

  // --- App-only polish: flip the red "· required" marker to a green "· ✓"
  // once a required field is validly filled. Pure UI; the demo stays pristine.
  var REQUIRED = ["p1-name", "p1-title", "p1-company-url"];
  function markValid(id) {
    var f = el(id);
    if (!f) return;
    var label = document.querySelector('label[for="' + id + '"]');
    if (!label) return;
    var span = label.querySelector("span");
    if (!span) return;
    if (!span.getAttribute("data-sh-req")) span.setAttribute("data-sh-req", span.innerHTML);
    var v = (f.value || "").trim();
    var ok = id === "p1-company-url" ? (v.length > 2 && v.indexOf(".") > -1) : v.length > 0;
    if (ok) {
      span.innerHTML = "&middot; &#10003;";
      span.style.color = "var(--success)";
    } else {
      span.innerHTML = span.getAttribute("data-sh-req");
      span.style.color = "var(--danger)";
    }
  }
  function markAll() { REQUIRED.forEach(markValid); }

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
    markAll();
  }

  function wire() {
    Object.keys(MAP).forEach(function (id) {
      var e = el(id);
      if (e) {
        e.addEventListener("input", saveDebounced);
        e.addEventListener("change", saveDebounced);
      }
    });
    // live green-check on the required fields as the user types
    REQUIRED.forEach(function (id) {
      var e = el(id);
      if (e) e.addEventListener("input", function () { markValid(id); });
    });
    // also save when they move on from step 0
    var next = el("p1-s0-next");
    if (next) next.addEventListener("click", save);
  }

  function init() {
    wire();
    markAll();
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
