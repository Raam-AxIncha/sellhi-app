/*
 * SellHi — TOP setup-progress bar (app-layer; demo.html stays pristine).
 *
 * A slim, animated, horizontal progress bar pinned at the very top of the
 * workspace on every phase. It shows real setup progress (from the user's
 * actual state) AND what's left: four milestones as clickable chips — done
 * ones checked, the next one highlighted, the rest muted — with an animated
 * fill line showing overall %. The frozen per-phase topbar is offset down so
 * the two stack cleanly. Hides itself once all four are done, and can be
 * dismissed for the session.
 */
(function () {
  function go(p) { try { if (typeof window.showPhase === "function") window.showPhase(p); } catch (e) {} }

  // Four milestones, in order. `full` shows on hover; `lab` is the chip label.
  var STEPS = [
    { lab: "Identity", full: "Set up your identity", act: function () { go("p1"); } },
    { lab: "Market",   full: "Research your market", act: function () { go("p2"); } },
    { lab: "Calendar", full: "Connect your calendar", href: "/meetings" },
    { lab: "Campaign", full: "Stage your first campaign", act: function () { go("p6"); } }
  ];
  var done = [false, false, false, false];
  var dismissed = false; // session-only; resets on reload

  function compute(cb) {
    var pending = 3;
    function fin() { if (--pending <= 0) cb(); }
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.dossier && j.dossier.data) || {};
        done[0] = !!(d.name || d.company || d.company_url);
        var mc = d.marketCompanies || {};
        var arr = Array.isArray(mc.companies) ? mc.companies : (Array.isArray(mc) ? mc : []);
        done[1] = arr.length > 0;
      }).catch(function () {}).then(fin, fin);
    fetch("/api/meetings", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { done[2] = !!(j && j.connected && (j.connected.google || j.connected.microsoft)); })
      .catch(function () {}).then(fin, fin);
    fetch("/api/campaigns", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { done[3] = !!(j && Array.isArray(j.campaigns) && j.campaigns.length); })
      .catch(function () {}).then(fin, fin);
  }

  function style() {
    if (document.getElementById("sh-progbar-style")) return;
    var s = document.createElement("style");
    s.id = "sh-progbar-style";
    s.textContent =
      // Offset the frozen topbar down by the bar height ONLY while the bar shows.
      'body.sh-hasprog #main-content .topbar{top:36px;}' +
      '#sh-progbar{position:sticky;top:0;z-index:62;display:flex;align-items:center;gap:14px;' +
        'height:36px;padding:0 18px;background:rgba(255,255,255,.9);' +
        '-webkit-backdrop-filter:blur(9px) saturate(1.03);backdrop-filter:blur(9px) saturate(1.03);' +
        'border-bottom:1px solid var(--sh-line,#e6edec);}' +
      'body.dark #sh-progbar{background:rgba(12,20,34,.85);border-bottom-color:rgba(255,255,255,.08);}' +
      '#sh-progbar .sh-pb-steps{display:flex;align-items:center;gap:9px;overflow:hidden;}' +
      '#sh-progbar .sh-pb-step{display:inline-flex;align-items:center;gap:6px;background:none;border:none;' +
        'font-family:inherit;font-size:12px;cursor:pointer;color:var(--sh-ink2,#5b6875);padding:2px;white-space:nowrap;}' +
      '#sh-progbar .sh-pb-ic{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;' +
        'justify-content:center;font-size:10px;font-weight:700;border:1.5px solid var(--sh-line,#e6edec);' +
        'color:var(--sh-ink2,#5b6875);background:transparent;transition:background .2s,border-color .2s,box-shadow .2s;}' +
      '#sh-progbar .sh-pb-step.done{color:var(--sh-teal-ink,#0f6e56);}' +
      '#sh-progbar .sh-pb-step.done .sh-pb-ic{background:var(--sh-teal,#008080);border-color:var(--sh-teal,#008080);color:#fff;}' +
      '#sh-progbar .sh-pb-step.active{color:var(--sh-ink,#111827);font-weight:700;}' +
      '#sh-progbar .sh-pb-step.active .sh-pb-ic{border-color:var(--sh-teal,#008080);color:var(--sh-teal-ink,#0f6e56);box-shadow:0 0 0 3px var(--sh-teal-soft,#e1f5ee);}' +
      '#sh-progbar .sh-pb-step:hover{color:var(--sh-teal-ink,#0f6e56);}' +
      '#sh-progbar .sh-pb-sep{width:14px;height:1.5px;border-radius:2px;background:var(--sh-line,#e6edec);flex:0 0 auto;}' +
      '#sh-progbar .sh-pb-meta{margin-left:auto;font-size:11px;color:var(--sh-ink2,#5b6875);white-space:nowrap;}' +
      '#sh-progbar .sh-pb-meta b{color:var(--sh-teal-ink,#0f6e56);}' +
      '#sh-progbar .sh-pb-x{background:none;border:none;cursor:pointer;color:var(--sh-ink2,#5b6875);font-size:16px;' +
        'line-height:1;padding:2px 2px;opacity:.55;transition:opacity .12s;}' +
      '#sh-progbar .sh-pb-x:hover{opacity:1;}' +
      '#sh-progbar .sh-pb-fill{position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--sh-line,#e6edec);}' +
      '#sh-progbar .sh-pb-fill i{display:block;height:100%;width:0;background:linear-gradient(90deg,#008080,#37c3b4);' +
        'transition:width .6s cubic-bezier(.2,.7,.2,1);}' +
      '@media(max-width:760px){#sh-progbar .sh-pb-lab{display:none;}#sh-progbar .sh-pb-sep{width:8px;}}';
    document.head.appendChild(s);
  }

  function hide() {
    var host = document.getElementById("sh-progbar");
    if (host) host.remove();
    document.body.classList.remove("sh-hasprog");
  }

  function render() {
    if (dismissed) return;
    var count = done.filter(Boolean).length;
    if (count >= STEPS.length) { hide(); return; } // all set -> no clutter
    var nextIdx = done.indexOf(false);

    style();
    var main = document.getElementById("main-content") || document.querySelector(".main");
    if (!main) return;

    var host = document.getElementById("sh-progbar");
    if (!host) {
      host = document.createElement("div");
      host.id = "sh-progbar";
      host.style.position = "relative"; // anchor the fill line
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", "Setup progress");
      main.insertBefore(host, main.firstChild);
    }
    document.body.classList.add("sh-hasprog");

    var chips = "";
    for (var i = 0; i < STEPS.length; i++) {
      var cls = done[i] ? "done" : (i === nextIdx ? "active" : "todo");
      var ic = done[i] ? "&#10003;" : String(i + 1);
      chips +=
        '<button class="sh-pb-step ' + cls + '" type="button" data-i="' + i + '" title="' + STEPS[i].full + '">' +
          '<span class="sh-pb-ic">' + ic + '</span><span class="sh-pb-lab">' + STEPS[i].lab + '</span>' +
        '</button>';
      if (i < STEPS.length - 1) chips += '<span class="sh-pb-sep" aria-hidden="true"></span>';
    }

    host.innerHTML =
      '<div class="sh-pb-steps">' + chips + '</div>' +
      '<div class="sh-pb-meta"><b>' + count + '</b> of ' + STEPS.length + ' set up</div>' +
      '<button class="sh-pb-x" type="button" title="Hide for now" aria-label="Hide setup progress">&times;</button>' +
      '<div class="sh-pb-fill"><i></i></div>';

    // Animate the fill AFTER paint so the width transition runs.
    var fill = host.querySelector(".sh-pb-fill i");
    if (fill) { setTimeout(function () { fill.style.width = Math.round(count / STEPS.length * 100) + "%"; }, 40); }

    // Wire chips -> jump to that step.
    Array.prototype.forEach.call(host.querySelectorAll(".sh-pb-step"), function (b) {
      b.addEventListener("click", function () {
        var st = STEPS[parseInt(b.getAttribute("data-i"), 10)];
        if (!st) return;
        if (st.href) window.location.href = st.href;
        else if (st.act) st.act();
      });
    });
    var x = host.querySelector(".sh-pb-x");
    if (x) x.addEventListener("click", function () { dismissed = true; hide(); });
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      if (document.getElementById("main-content") || document.querySelector(".main")) {
        clearInterval(t); compute(render);
      } else if (++tries > 40) clearInterval(t);
    }, 200);
    setInterval(function () { compute(render); }, 20000); // gentle refresh as steps complete
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
