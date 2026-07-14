/*
 * SellHi Phase 3a — real researched dossier.
 * The demo's simulateP1Dossier() plays a 5s fake loading animation and reveals
 * hard-coded sample text. We override that global at runtime (demo.html stays
 * pristine): keep the loading overlay up while Claude researches for real via
 * /api/research, then write the findings into the exact same dossier layout.
 * If anything fails, we fall back to the demo's original behaviour.
 */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(node, val) { if (node && typeof val === "string" && val.trim()) node.textContent = val; }

  function chipHTML(label) {
    var d = document.createElement("div");
    d.className = "dossier-chip";
    d.textContent = label;
    return d.outerHTML;
  }

  function populate(d) {
    if (!d) return;
    var root = document.getElementById("p1-s1");
    if (!root) return;

    // Headline (big AI summary at the top)
    try {
      var headline = $('div[style*="font-size:20px"][style*="font-weight:800"]', root);
      setText(headline, d.headline);
    } catch (e) {}

    var sections = $all(".dossier-section", root);

    // Section 0 — The Practice
    try {
      var s = sections[0];
      if (s && d.practice) {
        setText($(".dossier-name", s), d.practice.name);
        setText($("p", s), d.practice.summary);
        var vals = $all('div[style*="font-size:12px"][style*="font-weight:600"]', s);
        // order in markup: Industry, Headcount, Funding, HQ, Founded
        setText(vals[0], d.practice.industry);
        setText(vals[1], d.practice.headcount);
        setText(vals[2], d.practice.funding);
        setText(vals[3], d.practice.hq);
        setText(vals[4], d.practice.founded);
      }
    } catch (e) {}

    // Section 1 — Your Seat
    try {
      var s1 = sections[1];
      if (s1 && d.seat) {
        setText($(".dossier-avatar", s1), d.seat.initials);
        setText($(".dossier-name", s1), d.seat.nameTitle);
        setText($("p", s1), d.seat.bio);
      }
    } catch (e) {}

    // Section 2 — Experience Map (chips + deal size)
    try {
      var s2 = sections[2];
      if (s2 && d.experience) {
        var chipGroups = $all(".dossier-chips", s2);
        if (chipGroups[0] && Array.isArray(d.experience.industries)) {
          chipGroups[0].innerHTML = d.experience.industries.map(chipHTML).join("");
        }
        if (chipGroups[1] && Array.isArray(d.experience.stages)) {
          chipGroups[1].innerHTML = d.experience.stages.map(chipHTML).join("");
        }
        setText($('div[style*="font-size:14px"][style*="font-weight:700"]', s2), d.experience.dealSize);
      }
    } catch (e) {}

    // Section 3 — Top Achievement
    try {
      var s3 = sections[3];
      if (s3) setText($("p", s3), d.achievement);
    } catch (e) {}

    // Section 4 — Market Positioning (rebuild cards from array)
    try {
      var s4 = sections[4];
      if (s4 && Array.isArray(d.positioning)) {
        var cards = $all('div[style*="background:#fff"]', s4);
        d.positioning.slice(0, cards.length).forEach(function (p, i) {
          var card = cards[i];
          if (!card) return;
          setText($('span[style*="color:var(--primary)"]', card), p.label);
          setText($("p", card), p.text);
        });
      }
    } catch (e) {}

    // Confidence bar
    try {
      if (typeof d.confidence === "number") {
        var fill = $(".confidence-fill", root);
        var label = $(".confidence-label", root);
        var c = Math.max(0, Math.min(100, d.confidence));
        if (fill) fill.style.width = c + "%";
        if (label) label.textContent = c + "% dossier confidence";
      }
    } catch (e) {}

    // Re-apply editability: populate() rewrote some nodes (chips, positioning).
    try { makeEditable(); } catch (e) {}
  }

  var LOADING_STEPS = [
    "Reading your website...",
    "Searching the open web...",
    "Cross-checking company signals...",
    "Mapping industry & experience...",
    "Drafting your positioning...",
    "Building your dossier...",
  ];

  function overrideDossier() {
    if (typeof window.simulateP1Dossier !== "function") return false;
    var original = window.simulateP1Dossier;

    window.simulateP1Dossier = function () {
      var overlay = document.getElementById("p1-loading");
      var loadingText = document.getElementById("p1-loading-text");

      // Advance to the dossier step + show the loading overlay (as the demo does).
      try { if (typeof p1Step === "function") p1Step(1); } catch (e) {}
      if (overlay) overlay.classList.add("active");

      // Rotate the loading messages until research resolves.
      var i = 0;
      var interval = setInterval(function () {
        i = (i + 1) % LOADING_STEPS.length;
        if (loadingText) loadingText.textContent = LOADING_STEPS[i];
      }, 1500);

      function finish() {
        clearInterval(interval);
        if (overlay) overlay.classList.remove("active");
      }

      // Save the latest field values first, then run the real research.
      var save = fetch("/api/dossier", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(collectInputs()),
      }).catch(function () {});

      save
        .then(function () {
          return fetch("/api/research", { method: "POST", credentials: "include" });
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          finish();
          if (res.ok && res.j && res.j.dossier) {
            populate(res.j.dossier);
            try { toast("success", "Your researched dossier is ready!"); } catch (e) {}
          } else {
            var msg = (res.j && res.j.error) || "Research unavailable — showing a sample.";
            try { toast("info", msg); } catch (e) {}
          }
        })
        .catch(function () {
          finish();
          try { toast("info", "Research unavailable — showing a sample."); } catch (e) {}
        });
    };
    return true;
  }

  function collectInputs() {
    var map = {
      "p1-name": "name", "p1-title": "title", "p1-company": "company",
      "p1-company-url": "company_url", "p1-linkedin-url": "linkedin_url",
      "p1-industries": "industries", "p1-deal-size": "deal_size",
    };
    var out = {};
    Object.keys(map).forEach(function (id) {
      var e = document.getElementById(id);
      if (e && typeof e.value === "string") out[map[id]] = e.value;
    });
    return out;
  }

  // ── Editable dossier (the "Everything below is editable" promise) ──────────
  function txt(node) { return node ? (node.textContent || "").trim() : ""; }
  function chipText(group) {
    return $all(".dossier-chip", group).map(function (c) { return (c.textContent || "").trim(); }).filter(Boolean);
  }

  function injectEditableStyle() {
    if (document.getElementById("sh-editable-style")) return;
    var st = document.createElement("style");
    st.id = "sh-editable-style";
    st.textContent =
      ".sh-editable{cursor:text;border-radius:4px;transition:background .1s,box-shadow .1s;}" +
      ".sh-editable:hover{background:rgba(37,99,235,.05);box-shadow:inset 0 0 0 1px var(--g200);}" +
      ".sh-editable:focus{outline:2px solid var(--primary);outline-offset:1px;background:#fff;}";
    document.head.appendChild(st);
  }

  function editable(node) {
    if (node && node.getAttribute && node.getAttribute("contenteditable") !== "true") {
      node.setAttribute("contenteditable", "true");
      node.setAttribute("spellcheck", "false");
      node.classList.add("sh-editable");
    }
  }

  function makeEditable() {
    var root = document.getElementById("p1-s1");
    if (!root) return;
    injectEditableStyle();
    try { editable($('div[style*="font-size:20px"][style*="font-weight:800"]', root)); } catch (e) {}
    var sections = $all(".dossier-section", root);
    sections.forEach(function (s) {
      $all(".dossier-name", s).forEach(editable);
      $all("p", s).forEach(editable);
    });
    try { if (sections[0]) $all('div[style*="font-size:12px"][style*="font-weight:600"]', sections[0]).forEach(editable); } catch (e) {}
    try {
      if (sections[2]) {
        $all(".dossier-chip", sections[2]).forEach(editable);
        editable($('div[style*="font-size:14px"][style*="font-weight:700"]', sections[2]));
      }
    } catch (e) {}
    try { if (sections[4]) $all('span[style*="color:var(--primary)"]', sections[4]).forEach(editable); } catch (e) {}
  }

  function collectDossier() {
    var root = document.getElementById("p1-s1");
    if (!root) return null;
    var d = { practice: {}, seat: {}, experience: {}, positioning: [] };
    try { var h = $('div[style*="font-size:20px"][style*="font-weight:800"]', root); if (h) d.headline = txt(h); } catch (e) {}
    var sections = $all(".dossier-section", root);
    try {
      var s0 = sections[0];
      if (s0) {
        d.practice.name = txt($(".dossier-name", s0));
        d.practice.summary = txt($("p", s0));
        var vals = $all('div[style*="font-size:12px"][style*="font-weight:600"]', s0);
        d.practice.industry = txt(vals[0]);
        d.practice.headcount = txt(vals[1]);
        d.practice.funding = txt(vals[2]);
        d.practice.hq = txt(vals[3]);
        d.practice.founded = txt(vals[4]);
      }
    } catch (e) {}
    try {
      var s1 = sections[1];
      if (s1) {
        d.seat.initials = txt($(".dossier-avatar", s1));
        d.seat.nameTitle = txt($(".dossier-name", s1));
        d.seat.bio = txt($("p", s1));
      }
    } catch (e) {}
    try {
      var s2 = sections[2];
      if (s2) {
        var cg = $all(".dossier-chips", s2);
        if (cg[0]) d.experience.industries = chipText(cg[0]);
        if (cg[1]) d.experience.stages = chipText(cg[1]);
        d.experience.dealSize = txt($('div[style*="font-size:14px"][style*="font-weight:700"]', s2));
      }
    } catch (e) {}
    try { var s3 = sections[3]; if (s3) d.achievement = txt($("p", s3)); } catch (e) {}
    try {
      var s4 = sections[4];
      if (s4) {
        $all('div[style*="background:#fff"]', s4).forEach(function (card) {
          d.positioning.push({ label: txt($('span[style*="color:var(--primary)"]', card)), text: txt($("p", card)) });
        });
      }
    } catch (e) {}
    return d;
  }

  // Save edits when the user advances from the dossier ("let me deepen").
  function overrideDeepen() {
    if (window.__sellhiDeepenWrapped) return true;
    if (typeof window.simulateP1Deepen !== "function") return false;
    var orig = window.simulateP1Deepen;
    window.simulateP1Deepen = function () {
      try {
        var d = collectDossier();
        if (d) {
          fetch("/api/dossier-edit", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ dossier: d }),
          }).catch(function () {});
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    window.__sellhiDeepenWrapped = true;
    return true;
  }

  function boot() {
    // The demo defines simulateP1Dossier / simulateP1Deepen on load; retry briefly
    // until they exist, and make the dossier editable as soon as it's in the DOM.
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var a = overrideDossier();
      var b = overrideDeepen();
      try { makeEditable(); } catch (e) {}
      if ((a && b) || tries > 40) clearInterval(t);
    }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
