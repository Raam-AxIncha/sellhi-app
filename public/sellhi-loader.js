/*
 * SellHi — viewport-centered branded loader.
 * Renders a single #sh-loader as a direct child of <body> (so `position:fixed` is
 * NEVER trapped by an ancestor's transform — guaranteeing it's centered on the
 * viewport on any monitor form factor). It watches the demo's own step overlays
 * (.loading-overlay.active) and mirrors their live status text into:
 *   • the spinning SellHi mark + pulsing halo,
 *   • a ticking step CHECKLIST (each new status → previous ticks ✓, current is active),
 *   • an INDETERMINATE progress bar (never fakes 100%).
 * While active it hides the demo's in-card overlay (kept in DOM so its status text
 * keeps updating — that's what we read). demo.html stays pristine.
 */
(function () {
  var el = null, textEl = null, listEl = null;
  var active = false;
  var steps = [];     // unique status messages, in first-seen order
  var maxIdx = -1;    // furthest step reached (monotonic — never un-ticks on message loops)
  var lastText = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function build() {
    if (el) return;
    el = document.createElement("div");
    el.id = "sh-loader";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="sh-loader-halo" aria-hidden="true"></div>' +
      '<div class="sh-loader-mark" aria-hidden="true"></div>' +
      '<div class="sh-loader-text" id="sh-loader-text"></div>' +
      '<ul class="sh-loader-list" id="sh-loader-list"></ul>' +
      '<div class="sh-loader-bar" aria-hidden="true"><div class="sh-loader-bar-fill"></div></div>';
    document.body.appendChild(el);
    textEl = el.querySelector("#sh-loader-text");
    listEl = el.querySelector("#sh-loader-list");
  }

  function activeOverlayText() {
    var o = document.querySelector(".loading-overlay.active");
    if (!o) return null;                    // no overlay active -> loader should hide
    var t = o.querySelector(".loading-text");
    return t ? (t.textContent || "").trim() : "";
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = steps.map(function (s, i) {
      var state = i < maxIdx ? "done" : (i === maxIdx ? "active" : "pending");
      var icon = state === "done" ? "&#10003;"
        : state === "active" ? '<span class="sh-dot"></span>'
        : "";
      return '<li class="sh-step ' + state + '"><span class="sh-step-ic" aria-hidden="true">' + icon + "</span>" + esc(s) + "</li>";
    }).join("");
  }

  function onText(txt) {
    if (textEl) textEl.textContent = txt;
    var idx = steps.indexOf(txt);
    if (idx === -1) { steps.push(txt); idx = steps.length - 1; }
    if (idx > maxIdx) maxIdx = idx;         // only ever advance -> smooth, no flicker on loops
    renderList();
  }

  function show() {
    build();
    if (active) return;
    active = true;
    steps = []; maxIdx = -1; lastText = "";
    if (listEl) listEl.innerHTML = "";
    if (textEl) textEl.textContent = "";
    el.classList.add("on");
    document.body.classList.add("sh-loading");
  }
  function hide() {
    if (!active) return;
    active = false;
    if (el) el.classList.remove("on");
    document.body.classList.remove("sh-loading");
  }

  function tick() {
    var txt = activeOverlayText();
    if (txt === null) { hide(); return; }
    show();
    if (txt && txt !== lastText) { lastText = txt; onText(txt); }
  }

  function boot() { setInterval(tick, 150); }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
