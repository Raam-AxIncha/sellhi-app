/*
 * SellHi — Landing "workspace at a glance" strip (app-layer; demo.html stays pristine).
 *
 * The landing view (#phase-p1, the CXO Identity Engine) is where subscribers arrive
 * on load. Today it opens straight into a setup wizard with no snapshot. This module
 * injects a slim, on-brand snapshot strip at the top of that column so logging in
 * feels like opening a cockpit — without touching demo.html or the wizard below it.
 *
 * Honest data policy (matches the rest of the app):
 *   - Owner / admin logins  -> the strip mirrors the SAME KPI numbers already shown on
 *     Command Center (read live from the DOM — nothing new is fabricated). Tiles are
 *     clickable and jump into Command Center for the full dashboard.
 *   - Everyone else          -> no numbers. A single honest line: the snapshot fills in
 *     once campaigns are live. Demo testers never see fabricated figures.
 *
 * Fully reversible: window.__shGlance.disable() removes the strip and stops observing.
 */
(function () {
  "use strict";

  var U = (window.__SELLHI_USER__ || {});
  var ADMIN = !!U.admin;

  // Which Command Center KPIs to surface on the landing, in order, with a matching icon.
  var WANT = [
    { label: "Meetings This Week", icon: "📅", accent: "teal" },
    { label: "Active Campaigns",   icon: "🚀", accent: "teal" },
    { label: "Response Rate",      icon: "✉️", accent: "orange" },
    { label: "Avg Match Score",    icon: "🎯", accent: "teal" }
  ];

  var mo = null, retryIv = null, disabled = false;

  function cleanLabel(labelEl) {
    // Strip the trailing "?" help-tip so we read just the metric name.
    var c = labelEl.cloneNode(true);
    var tip = c.querySelector(".help-tip");
    if (tip) tip.parentNode.removeChild(tip);
    return (c.textContent || "").trim();
  }

  // Read the real KPI cards Command Center already renders (present in the DOM even
  // while that phase is hidden). Returns [] if they aren't in the DOM yet.
  function readKpis() {
    var out = {};
    var metrics = document.querySelectorAll("#phase-p7 .metric-row-5 .metric");
    if (!metrics.length) return out;
    for (var i = 0; i < metrics.length; i++) {
      var m = metrics[i];
      var l = m.querySelector(".metric-label");
      var v = m.querySelector(".metric-value");
      var ch = m.querySelector(".metric-change");
      if (!l || !v) continue;
      var name = cleanLabel(l);
      out[name] = {
        value: (v.textContent || "").trim(),
        change: ch ? (ch.textContent || "").trim() : "",
        up: ch ? ch.classList.contains("up") : false,
        down: ch ? ch.classList.contains("down") : false
      };
    }
    return out;
  }

  function goCommand() {
    try {
      if (typeof window.shCmdGo === "function") { window.shCmdGo("p7"); return; }
      if (typeof window.showPhase === "function") { window.showPhase("p7"); return; }
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function buildOwner() {
    var kpis = readKpis();
    var have = 0;
    var tiles = "";
    for (var i = 0; i < WANT.length; i++) {
      var w = WANT[i];
      var d = kpis[w.label];
      if (!d) continue;
      have++;
      var deltaCls = d.up ? "up" : (d.down ? "down" : "");
      var delta = d.change ? '<div class="sh-gl-delta ' + deltaCls + '">' + esc(d.change) + "</div>" : "";
      tiles +=
        '<button type="button" class="sh-gl-tile ' + w.accent + '" data-phase="p7" ' +
          'aria-label="' + esc(w.label) + ' — open Command Center">' +
          '<div class="sh-gl-lbl"><span class="sh-gl-ico">' + w.icon + "</span>" + esc(w.label) + "</div>" +
          '<div class="sh-gl-num">' + esc(d.value) + "</div>" +
          delta +
        "</button>";
    }
    if (!have) return null; // KPIs not in DOM yet — caller will retry.
    return (
      '<div class="sh-gl-head">' +
        '<span class="sh-gl-title">Your workspace at a glance</span>' +
        '<button type="button" class="sh-gl-more" data-phase="p7">Full dashboard →</button>' +
      "</div>" +
      '<div class="sh-gl-tiles">' + tiles + "</div>"
    );
  }

  function buildGuest() {
    return (
      '<div class="sh-gl-guest">' +
        '<span class="sh-gl-ico">📊</span>' +
        "<span>Your workspace snapshot — meetings, replies and pipeline — fills in here once your campaigns go live.</span>" +
      "</div>"
    );
  }

  function render() {
    if (disabled) return true;
    var phase = document.getElementById("phase-p1");
    if (!phase) return false;
    var content = phase.querySelector(".content");
    if (!content) return false;

    var inner = ADMIN ? buildOwner() : buildGuest();
    if (inner === null) return false; // owner path but KPIs not ready yet

    var strip = document.getElementById("sh-glance");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "sh-glance";
      strip.className = ADMIN ? "sh-owner" : "sh-guest";
      strip.setAttribute("role", "region");
      strip.setAttribute("aria-label", "Workspace snapshot");
      // First child of the centered content column, above the breadcrumb/wizard.
      content.insertBefore(strip, content.firstChild);
      strip.addEventListener("click", function (e) {
        var t = e.target && e.target.closest ? e.target.closest("[data-phase]") : null;
        if (t) { e.preventDefault(); goCommand(); }
      });
    }
    strip.innerHTML = inner;
    return true;
  }

  function start() {
    if (render()) {
      if (retryIv) { clearInterval(retryIv); retryIv = null; }
    }
    // Re-assert if the wizard/app re-renders the landing column.
    try {
      var phase = document.getElementById("phase-p1");
      if (phase && !mo) {
        mo = new MutationObserver(function () {
          if (disabled) return;
          if (!document.getElementById("sh-glance")) render();
        });
        mo.observe(phase, { childList: true, subtree: true });
      }
    } catch (e) {}
  }

  window.__shGlance = {
    render: render,
    disable: function () {
      disabled = true;
      try { if (mo) mo.disconnect(); } catch (e) {}
      if (retryIv) { clearInterval(retryIv); retryIv = null; }
      var s = document.getElementById("sh-glance");
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
  };

  // Poll briefly until the landing column (and, for owners, the KPI source) exist.
  var tries = 0;
  retryIv = setInterval(function () {
    tries++;
    if (disabled || render() || tries > 80) {
      clearInterval(retryIv); retryIv = null;
      if (!disabled) start();
    }
  }, 120);

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(start, 0);
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
