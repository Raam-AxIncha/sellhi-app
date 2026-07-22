/*
 * SellHi — SECTIONS: one-section-at-a-time, tab-style panels
 * ------------------------------------------------------------------
 * App-layer module (demo.html stays byte-for-byte pristine). It takes a long,
 * vertically-scrolling wizard sub-step and re-flows its content into a
 * horizontal stepper: the reader sees ONE section at a time and moves between
 * them with clickable chips + Prev/Next — no long scroll.
 *
 * Switching is plain show/hide (display:none / block) — NOT a sliding transform
 * track. A translate carousel proved fragile (clicks landing on the wrong chip,
 * fractional-DPR hit-test drift, mid-render repositioning). Show/hide has none
 * of that: exactly one panel is in the DOM flow at a time.
 *
 * Reusable  — driven by the PLANS map, keyed by sub-step id (add a page = add an entry).
 * Reversible — only MOVES existing nodes into wrappers; window.__shSections.disable() restores.
 * Resilient  — sections matched by class/text signals (not index); missing ones are skipped.
 *
 * Prototype scope (#8): Identity Engine steps 2/3/4 -> #p1-s1, #p1-s2, #p1-s3.
 */
(function () {
  if (window.__SH_SECTIONS__) return;
  window.__SH_SECTIONS__ = true;

  /* ---------- helpers ---------- */
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

  /* ---------- declarative segmentation plans ---------- */
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
        !n.classList.contains("loading-overlay") &&
        !n.classList.contains("sh-sec-head") &&
        !n.classList.contains("sh-sec-body") &&
        !n.classList.contains("sh-sec-controls");
    });
  }

  function segment(card, plan) {
    var kids = directChildren(card);
    var footer = null;
    for (var i = kids.length - 1; i >= 0; i--) {
      if (kids[i].querySelector && kids[i].querySelector(".btn")) { footer = kids[i]; break; }
    }
    var body = kids.filter(function (n) { return n !== footer; });
    var intro = [], sections = [], current = null, ptr = 0;
    body.forEach(function (node) {
      var matchedIdx = -1;
      for (var k = ptr; k < plan.sections.length; k++) {
        if (plan.sections[k].start(node)) { matchedIdx = k; break; }
      }
      if (matchedIdx > -1) { current = { def: plan.sections[matchedIdx], nodes: [] }; sections.push(current); ptr = matchedIdx + 1; }
      if (current) current.nodes.push(node);
      else intro.push(node);
    });
    return { intro: intro, sections: sections, footer: footer };
  }

  /* ---------- registry (reversible teardown) ---------- */
  var registry = [];

  function transform(sub) {
    var plan = PLANS[sub.id];
    if (!plan) return null;
    var card = sub.querySelector(".card");
    if (!card || card.getAttribute("data-sh-sections") === "on") return null;

    var seg = segment(card, plan);
    if (seg.sections.length < 2) return null;

    var orig = Array.prototype.slice.call(card.children);

    /* header: intro + horizontal chip stepper */
    var head = el("div", "sh-sec-head");
    var intro = el("div", "sh-sec-intro");
    seg.intro.forEach(function (n) { intro.appendChild(n); });
    var steps = el("div", "sh-sec-steps"); steps.setAttribute("role", "tablist"); steps.setAttribute("aria-label", plan.label + " sections");
    head.appendChild(intro);
    head.appendChild(steps);

    /* body: all panels stacked; only the active one is displayed */
    var body = el("div", "sh-sec-body");
    var panels = [], chips = [];
    seg.sections.forEach(function (s, idx) {
      var panel = el("div", "sh-sec-panel");
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-label", s.def.label);
      s.nodes.forEach(function (n) { panel.appendChild(n); });
      body.appendChild(panel);
      panels.push(panel);

      var chip = el("button", "sh-sec-chip");
      chip.type = "button";
      chip.setAttribute("role", "tab");
      chip.innerHTML = '<span class="sh-sec-chip-n">' + (idx + 1) + '</span><span class="sh-sec-chip-l"></span>';
      chip.querySelector(".sh-sec-chip-l").textContent = s.def.label;
      chip.addEventListener("click", function (e) { e.preventDefault(); go(idx); });
      steps.appendChild(chip);
      chips.push(chip);
    });

    /* controls */
    var controls = el("div", "sh-sec-controls");
    var prev = el("button", "sh-sec-btn sh-sec-prev"); prev.type = "button"; prev.innerHTML = "&#8592; Previous";
    var count = el("span", "sh-sec-count");
    var next = el("button", "sh-sec-btn sh-sec-primary sh-sec-next"); next.type = "button"; next.innerHTML = "Next &#8594;";
    controls.appendChild(prev); controls.appendChild(count); controls.appendChild(next);

    var hint = el("div", "sh-sec-gate-hint"); hint.setAttribute("role", "status"); hint.setAttribute("aria-live", "polite");

    /* assemble: [overlay stays] head -> body -> controls -> hint -> footer(last) */
    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(controls);
    card.appendChild(hint);
    if (seg.footer) card.appendChild(seg.footer);
    card.setAttribute("data-sh-sections", "on");

    /* wizard's own forward button (gated) */
    var fwd = null;
    if (seg.footer) {
      fwd = seg.footer.querySelector(".btn-primary");
      if (!fwd) { var bs = seg.footer.querySelectorAll(".btn"); fwd = bs[bs.length - 1] || null; }
    }
    var gate = plan.gate !== false && seg.sections.length > 1 && !!fwd;

    var state = { i: 0, n: seg.sections.length };
    var viewed = {};

    function seenCount() { var c = 0; for (var k = 0; k < state.n; k++) if (viewed[k]) c++; return c; }
    function firstUnseen() { for (var k = 0; k < state.n; k++) if (!viewed[k]) return k; return -1; }

    function updateGate() {
      if (!gate) return;
      var left = state.n - seenCount();
      if (left > 0) {
        fwd.classList.add("sh-sec-locked"); fwd.setAttribute("aria-disabled", "true");
        hint.className = "sh-sec-gate-hint show";
        hint.textContent = "Review all " + state.n + " sections to continue — " + left + " left";
      } else {
        fwd.classList.remove("sh-sec-locked"); fwd.removeAttribute("aria-disabled");
        hint.className = "sh-sec-gate-hint show done";
        hint.textContent = "All " + state.n + " sections reviewed ✓ — you can continue";
      }
    }

    function paint() {
      viewed[state.i] = true;
      // show ONLY the active panel
      for (var k = 0; k < panels.length; k++) { panels[k].classList.toggle("sh-sec-on", k === state.i); }
      chips.forEach(function (c, k) {
        c.classList.toggle("active", k === state.i);
        c.classList.toggle("seen", !!viewed[k] && k !== state.i);
        c.setAttribute("aria-selected", k === state.i ? "true" : "false");
      });
      prev.disabled = state.i === 0;
      next.disabled = state.i === state.n - 1;
      count.textContent = (state.i + 1) + " of " + state.n;
      updateGate();
    }
    function go(i) { state.i = Math.max(0, Math.min(state.n - 1, i)); paint(); }

    prev.addEventListener("click", function (e) { e.preventDefault(); go(state.i - 1); });
    next.addEventListener("click", function (e) { e.preventDefault(); go(state.i + 1); });

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

    paint(); // show section 1

    var entry = { sub: sub, card: card, orig: orig, layout: paint, reset: function () { state.i = 0; paint(); } };
    registry.push(entry);
    return entry;
  }

  /* ---------- reversible teardown ---------- */
  function restore(entry) {
    var card = entry.card;
    entry.orig.forEach(function (n) { card.appendChild(n); });
    ["sh-sec-head", "sh-sec-body", "sh-sec-controls", "sh-sec-gate-hint"].forEach(function (cls) {
      var all = card.getElementsByClassName(cls);
      while (all.length) { var w = all[0]; if (w.parentNode === card) card.removeChild(w); else break; }
    });
    card.removeAttribute("data-sh-sections");
  }
  window.__shSections = {
    disable: function () { registry.slice().forEach(restore); registry.length = 0; },
    relayout: function () { registry.forEach(function (e) { e.layout(); }); }
  };

  /* ---------- activation plumbing ---------- */
  function isVisible(node) { return !!(node && node.offsetParent !== null); }
  function findEntry(sub) { for (var i = 0; i < registry.length; i++) if (registry[i].sub === sub) return registry[i]; return null; }
  function ensure(sub) { var e = findEntry(sub); if (!e) e = transform(sub); return e; }
  function activate(sub) {
    // Only ensures the transform exists + repaints the CURRENT section. Never
    // repositions — the demo re-asserting `.active` (autosave, step dots, etc.)
    // must not move the user's place.
    var e = ensure(sub); if (e) e.layout();
  }

  function boot() {
    var ids = Object.keys(PLANS);
    var subs = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!subs.length) return false;
    subs.forEach(function (sub) { ensure(sub); });
    var obs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var t = m.target;
        if (t.classList && t.classList.contains("sub-step") && t.classList.contains("active") && PLANS[t.id]) activate(t);
      });
    });
    subs.forEach(function (sub) { obs.observe(sub, { attributes: true, attributeFilter: ["class"] }); });
    return true;
  }

  function start() {
    var tries = 0;
    var t = setInterval(function () {
      if (document.getElementById("main-content") || document.querySelector(".main")) { if (boot()) clearInterval(t); }
      if (++tries > 50) clearInterval(t);
    }, 200);
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();
