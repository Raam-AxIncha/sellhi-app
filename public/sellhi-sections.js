/*
 * SellHi — SECTIONS: one-section-at-a-time, side-to-side panels
 * ------------------------------------------------------------------
 * App-layer module (demo.html stays byte-for-byte pristine). It takes a
 * long, vertically-scrolling wizard sub-step and re-flows its content into
 * a horizontal stepper: the reader sees ONE section at a time and advances
 * left-to-right (Prev / Next + clickable chips) instead of scrolling a wall.
 *
 * Design goals
 *   • Reusable  — driven by a declarative PLANS map, keyed by sub-step id.
 *                 Adding a page in #9 = adding one entry, no engine changes.
 *   • Reversible — it only MOVES existing DOM nodes into wrappers and can put
 *                 them all back in original order (window.__shSections.disable()).
 *                 No node is created inside, cloned from, or written to demo.html.
 *   • Resilient — sections are matched by class/text signals (not child index),
 *                 so a stale/older demo.html still segments correctly, and any
 *                 section it can't find is simply skipped (never throws).
 *
 * Prototype scope (#8): Identity Engine steps 2/3/4 -> #p1-s1, #p1-s2, #p1-s3.
 */
(function () {
  if (window.__SH_SECTIONS__) return;
  window.__SH_SECTIONS__ = true;

  /* ---------- small helpers ---------- */
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function txt(n) { return (n && n.textContent ? n.textContent : "").replace(/\s+/g, " ").trim(); }
  function hasField(node, sub) {
    if (!node.querySelectorAll) return false;
    var labs = node.querySelectorAll(".field-label");
    for (var i = 0; i < labs.length; i++) { if (txt(labs[i]).toLowerCase().indexOf(sub.toLowerCase()) > -1) return true; }
    return false;
  }
  function isDossier(node, sub) {
    return node.classList && node.classList.contains("dossier-section") && txt(node).toLowerCase().indexOf(sub.toLowerCase()) > -1;
  }
  function contains(node, sub) { return txt(node).toLowerCase().indexOf(sub.toLowerCase()) > -1; }
  function hasClass(node, cls) { return node.classList && node.classList.contains(cls); }
  function cardTitleHas(node, sub) { return hasClass(node, "card-title") && contains(node, sub); }

  /* ---------- declarative segmentation plans ----------
   * Each section's `start(node)` tests whether a DIRECT child of the card
   * BEGINS that section. Nodes are scanned in order with a forward-only
   * pointer: everything before the first matched start is the intro; the
   * trailing nav row (the child that holds the wizard .btn buttons) is the
   * pinned footer; everything else is grouped under the section it follows.
   */
  var PLANS = {
    "p1-s1": {
      label: "Your Dossier",
      sections: [
        { label: "The Practice",  start: function (n) { return isDossier(n, "The Practice"); } },
        { label: "Your Seat",     start: function (n) { return isDossier(n, "Your Seat"); } },
        { label: "Experience",    start: function (n) { return isDossier(n, "Experience Map"); } },
        { label: "Achievement",   start: function (n) { return isDossier(n, "Top Achievement"); } },
        { label: "Positioning",   start: function (n) { return isDossier(n, "Market Positioning"); } },
        { label: "Confidence",    start: function (n) { return !!(n.querySelector && n.querySelector(".confidence-bar")); } }
      ]
    },
    "p1-s2": {
      label: "Confirm & Deepen",
      sections: [
        { label: "Industries",   start: function (n) { return hasField(n, "Industry expertise"); } },
        { label: "Deal Size",    start: function (n) { return hasField(n, "deal size"); } },
        { label: "Engagement",   start: function (n) { return hasField(n, "Engagement model"); } },
        { label: "Stages",       start: function (n) { return hasField(n, "Company stages"); } },
        { label: "Statements",   start: function (n) { return hasField(n, "Positioning statements"); } },
        { label: "Strategic Q",  start: function (n) { return hasClass(n, "strategic-q"); } }
      ]
    },
    "p1-s3": {
      label: "Your Positioning",
      sections: [
        { label: "Positioning",  start: function (n) { return contains(n, "Your Enterprise Positioning"); } },
        { label: "Capability",   start: function (n) { return cardTitleHas(n, "Capability Score"); } },
        { label: "Scores",       start: function (n) { return hasClass(n, "metric-row"); } },
        { label: "Next Steps",   start: function (n) { return contains(n, "push your score"); } }
      ]
    }
  };

  /* ---------- segmentation ---------- */
  function directChildren(card) {
    return Array.prototype.filter.call(card.children, function (n) {
      return n.nodeType === 1 &&
        !n.classList.contains("loading-overlay") &&   // keep the absolute overlay in place
        !n.classList.contains("sh-sec-head") &&
        !n.classList.contains("sh-sec-viewport") &&
        !n.classList.contains("sh-sec-controls");
    });
  }

  function segment(card, plan) {
    var kids = directChildren(card);

    // Footer = last child that holds a wizard button (Back / Continue row).
    var footer = null;
    for (var i = kids.length - 1; i >= 0; i--) {
      if (kids[i].querySelector && kids[i].querySelector(".btn")) { footer = kids[i]; break; }
    }
    var body = kids.filter(function (n) { return n !== footer; });

    var intro = [], sections = [], current = null, ptr = 0;
    body.forEach(function (node) {
      // Forward scan from the current pointer so sections stay in order and a
      // missing one is skipped rather than mis-matched by a later node.
      var matchedIdx = -1;
      for (var k = ptr; k < plan.sections.length; k++) {
        if (plan.sections[k].start(node)) { matchedIdx = k; break; }
      }
      if (matchedIdx > -1) {
        current = { def: plan.sections[matchedIdx], nodes: [] };
        sections.push(current);
        ptr = matchedIdx + 1;
      }
      if (current) current.nodes.push(node);
      else intro.push(node);
    });

    return { intro: intro, sections: sections, footer: footer };
  }

  /* ---------- registry (for reversible teardown) ---------- */
  var registry = [];

  function transform(sub) {
    var plan = PLANS[sub.id];
    if (!plan) return null;
    var card = sub.querySelector(".card");
    if (!card || card.getAttribute("data-sh-sections") === "on") return null;

    var seg = segment(card, plan);
    if (seg.sections.length < 2) return null; // not worth panelizing

    // Snapshot original child order for a clean, exact restore.
    var orig = Array.prototype.slice.call(card.children);

    /* build header (intro + horizontal stepper) */
    var head = el("div", "sh-sec-head");
    var intro = el("div", "sh-sec-intro");
    seg.intro.forEach(function (n) { intro.appendChild(n); });
    var steps = el("div", "sh-sec-steps"); steps.setAttribute("role", "tablist"); steps.setAttribute("aria-label", plan.label + " sections");
    head.appendChild(intro);
    head.appendChild(steps);

    /* build viewport + horizontal track of panels */
    var viewport = el("div", "sh-sec-viewport");
    var track = el("div", "sh-sec-track");
    viewport.appendChild(track);

    var chips = [];
    seg.sections.forEach(function (s, idx) {
      var panel = el("div", "sh-sec-panel");
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-label", s.def.label);
      s.nodes.forEach(function (n) { panel.appendChild(n); });
      track.appendChild(panel);

      var chip = el("button", "sh-sec-chip");
      chip.type = "button";
      chip.setAttribute("role", "tab");
      chip.innerHTML = '<span class="sh-sec-chip-n">' + (idx + 1) + '</span>' +
                       '<span class="sh-sec-chip-l"></span>';
      chip.querySelector(".sh-sec-chip-l").textContent = s.def.label; // safe text
      chip.addEventListener("click", function () { go(idx); });
      steps.appendChild(chip);
      chips.push(chip);
      if (idx < seg.sections.length - 1) {
        var sep = el("span", "sh-sec-sep"); sep.setAttribute("aria-hidden", "true"); steps.appendChild(sep);
      }
    });

    /* controls */
    var controls = el("div", "sh-sec-controls");
    var prev = el("button", "sh-sec-btn sh-sec-prev"); prev.type = "button"; prev.innerHTML = "&#8592; Previous";
    var count = el("span", "sh-sec-count");
    var next = el("button", "sh-sec-btn sh-sec-primary sh-sec-next"); next.type = "button"; next.innerHTML = "Next &#8594;";
    controls.appendChild(prev); controls.appendChild(count); controls.appendChild(next);

    /* review-gate hint line (sits between the controls and the wizard footer) */
    var hint = el("div", "sh-sec-gate-hint"); hint.setAttribute("role", "status"); hint.setAttribute("aria-live", "polite");

    /* assemble: [overlay stays] head -> viewport -> controls -> hint -> footer(last) */
    card.appendChild(head);
    card.appendChild(viewport);
    card.appendChild(controls);
    card.appendChild(hint);
    if (seg.footer) card.appendChild(seg.footer);
    card.setAttribute("data-sh-sections", "on");

    /* The wizard's own forward button (the primary one, NOT "Back"): it stays
       exactly where it is and keeps its original onclick, but we GATE it until
       every section has been viewed. Set `gate:false` on a plan to opt out. */
    var fwd = null;
    if (seg.footer) {
      fwd = seg.footer.querySelector(".btn-primary");
      if (!fwd) { var bs = seg.footer.querySelectorAll(".btn"); fwd = bs[bs.length - 1] || null; }
    }
    var gate = plan.gate !== false && seg.sections.length > 1 && !!fwd;

    /* ---- state + behaviour ---- */
    var state = { i: 0, n: seg.sections.length };
    var viewed = {}; // section index -> true once shown (persists across resets)

    function measure() {
      var panel = track.children[state.i];
      if (!panel) return;
      // Only meaningful when visible; guarded by caller.
      var h = panel.scrollHeight;
      if (h > 0) viewport.style.height = h + "px";
    }
    function seenCount() { var c = 0; for (var k = 0; k < state.n; k++) if (viewed[k]) c++; return c; }
    function firstUnseen() { for (var k = 0; k < state.n; k++) if (!viewed[k]) return k; return -1; }

    function updateGate() {
      if (!gate) return;
      var left = state.n - seenCount();
      if (left > 0) {
        fwd.classList.add("sh-sec-locked");
        fwd.setAttribute("aria-disabled", "true");
        hint.className = "sh-sec-gate-hint show";
        hint.textContent = "Review all " + state.n + " sections to continue — " + left + " left";
      } else {
        fwd.classList.remove("sh-sec-locked");
        fwd.removeAttribute("aria-disabled");
        hint.className = "sh-sec-gate-hint show done";
        hint.textContent = "All " + state.n + " sections reviewed ✓ — you can continue";
      }
    }

    function paint() {
      viewed[state.i] = true;
      track.style.transform = "translateX(" + (-state.i * 100) + "%)";
      chips.forEach(function (c, k) {
        c.classList.toggle("active", k === state.i);
        c.classList.toggle("seen", !!viewed[k] && k !== state.i);
        c.setAttribute("aria-selected", k === state.i ? "true" : "false");
      });
      prev.disabled = state.i === 0;
      next.disabled = state.i === state.n - 1;
      count.textContent = (state.i + 1) + " of " + state.n;
      updateGate();
      measure();
    }
    function go(i) {
      state.i = Math.max(0, Math.min(state.n - 1, i));
      paint();
    }
    function layout() { paint(); setTimeout(measure, 60); } // re-measure after fonts/reflow

    prev.addEventListener("click", function () { go(state.i - 1); });
    next.addEventListener("click", function () { go(state.i + 1); });

    // Gate: intercept the wizard's forward button until all sections are viewed.
    // Capture phase runs BEFORE the button's inline onclick, so we can block it.
    if (gate) {
      fwd.addEventListener("click", function (e) {
        if (seenCount() < state.n) {
          e.preventDefault(); e.stopImmediatePropagation();
          var u = firstUnseen(); if (u > -1) go(u);
          hint.classList.remove("nudge"); void hint.offsetWidth; hint.classList.add("nudge");
          if (typeof window.toast === "function") { try { window.toast("info", "Please review all " + state.n + " sections before continuing."); } catch (er) {} }
        }
      }, true);
    }

    // Arrow-key navigation while focus is inside this card's stepper/controls.
    head.addEventListener("keydown", onKey);
    controls.addEventListener("keydown", onKey);
    function onKey(e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(state.i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(state.i - 1); }
    }

    // Keep the viewport height fitted when a panel's content changes size after
    // transform — e.g. sellhi-research.js populate() fills the dossier, fields
    // become contentEditable, chips re-render. Prevents clipping/overflow later.
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(function () { if (isVisible(sub)) measure(); });
      Array.prototype.forEach.call(track.children, function (p) { ro.observe(p); });
    }

    var entry = { sub: sub, card: card, orig: orig, layout: layout, reset: function () { state.i = 0; layout(); }, _wasVisible: false };
    registry.push(entry);
    return entry;
  }

  /* ---------- reversible teardown ---------- */
  function restore(entry) {
    var card = entry.card;
    entry.orig.forEach(function (n) { card.appendChild(n); }); // re-append in original order
    ["sh-sec-head", "sh-sec-viewport", "sh-sec-controls"].forEach(function (cls) {
      var w = card.querySelector(":scope > ." + cls);
      // fall back if :scope unsupported
      if (!w) { var all = card.getElementsByClassName(cls); w = all && all[0]; }
      if (w && w.parentNode === card) card.removeChild(w);
    });
    card.removeAttribute("data-sh-sections");
  }
  window.__shSections = {
    disable: function () { registry.slice().forEach(restore); registry.length = 0; },
    relayout: function () { registry.forEach(function (e) { if (isVisible(e.sub)) e.layout(); }); }
  };

  /* ---------- activation plumbing ---------- */
  function isVisible(node) { return !!(node && node.offsetParent !== null); }

  function findEntry(sub) { for (var i = 0; i < registry.length; i++) if (registry[i].sub === sub) return registry[i]; return null; }

  function ensure(sub) {
    var e = findEntry(sub);
    if (!e) e = transform(sub);
    return e;
  }

  function activate(sub) {
    var e = ensure(sub);
    if (!e) return;
    var vis = isVisible(sub);
    // Reset to the first section ONLY on a genuine hidden -> visible entry — never
    // when the step's `.active` class is merely re-asserted (the demo's p1Step()/
    // updateWizard re-adds it, the user taps the current step dot, research.js
    // repopulates, etc.). Otherwise the carousel would snap back to section 0
    // out from under the user (the "revert to Practice" oscillation).
    if (vis && !e._wasVisible) e.reset();
    else e.layout();
    e._wasVisible = vis;
    setTimeout(function () { if (isVisible(sub)) e.layout(); }, 140);
  }

  function boot() {
    var ids = Object.keys(PLANS);
    var subs = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!subs.length) return false;

    // Pre-transform now (content is in the DOM even while hidden); first paint
    // happens when a step becomes visible.
    subs.forEach(function (sub) {
      ensure(sub);
      if (isVisible(sub)) activate(sub);
    });

    // Re-flow the active step whenever a target sub-step gains ".active".
    var obs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var t = m.target;
        if (!(t.classList && t.classList.contains("sub-step") && PLANS[t.id])) return;
        if (t.classList.contains("active")) {
          activate(t);
        } else {
          var e = findEntry(t); if (e) e._wasVisible = false; // left the step; reset on next real entry
        }
      });
    });
    subs.forEach(function (sub) { obs.observe(sub, { attributes: true, attributeFilter: ["class"] }); });

    // Re-measure on resize (width handled by % translate; height can change).
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { window.__shSections.relayout(); }, 150); });
    return true;
  }

  function start() {
    var tries = 0;
    var t = setInterval(function () {
      if (document.getElementById("main-content") || document.querySelector(".main")) {
        if (boot()) clearInterval(t);
      }
      if (++tries > 50) clearInterval(t);
    }, 200);
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
