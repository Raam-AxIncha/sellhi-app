/*
 * SellHi — Phase 4 (Connected Stack) + Phase 6 (Campaign Engine), built to the
 * credential boundary. demo.html stays pristine; we PREPEND real, data-driven
 * panels into each phase (keeping the demo's marketing/pricing + sequence-builder
 * UI below) on entry.
 *
 * p4 Connected Stack: a live connection-status panel — real calendar status
 *   (/api/meetings), a Fireflies probe (/api/transcripts 503?), plus the not-yet
 *   connected pieces (email sender, CRM) with exactly what each unlocks.
 * p6 Campaign Engine: pick a real audience from your Market Intel targets, snapshot
 *   the sequence you built, and STAGE a campaign (saved locally). Actual sending is
 *   HARD-GATED off until an email sender is connected — nothing leaves SellHi. We
 *   flag precisely what unlocks live send.
 *
 * Fully defensive: any failure leaves the phase's demo content untouched.
 */
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var TIER_BADGE = { 1: "badge-green", 2: "badge-amber", 3: "badge-gray" };

  var DATA = { companies: [], connected: { google: false, microsoft: false }, fireflies: null, campaigns: [], loaded: false };

  function companyTier(c) { return c._tier || c.tier || 3; }

  function load(cb) {
    var pending = 4;
    function done() { if (--pending <= 0) { DATA.loaded = true; cb && cb(); } }
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var d = (j && j.dossier && j.dossier.data) || {};
        var mc = d.marketCompanies || {};
        DATA.companies = Array.isArray(mc.companies) ? mc.companies : (Array.isArray(mc) ? mc : []);
      }).catch(function () {}).then(done, done);
    fetch("/api/meetings", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.connected) DATA.connected = j.connected; }).catch(function () {}).then(done, done);
    // Fireflies probe: 503 => not configured; 200 => configured.
    fetch("/api/transcripts", { credentials: "include" })
      .then(function (r) { DATA.fireflies = r.status !== 503; }).catch(function () { DATA.fireflies = null; }).then(done, done);
    // Staged campaigns — persisted server-side so they survive across devices.
    fetch("/api/campaigns", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && Array.isArray(j.campaigns)) DATA.campaigns = j.campaigns; }).catch(function () {}).then(done, done);
  }

  // ── shared: connection row ───────────────────────────────────────────────────
  function connRow(opts) {
    // opts: { name, state:'connected'|'action'|'planned', detail, actionLabel, actionHref, unlocks }
    var pill = opts.state === "connected"
      ? '<span class="badge badge-green">Connected</span>'
      : opts.state === "planned"
        ? '<span class="badge badge-gray">Planned</span>'
        : '<span class="badge badge-amber">Not connected</span>';
    var action = opts.actionHref
      ? '<a class="btn btn-sm ' + (opts.state === "connected" ? "btn-outline" : "btn-primary") + '" href="' + esc(opts.actionHref) + '">' + esc(opts.actionLabel || "Connect") + "</a>"
      : "";
    return '<div class="action-item" style="align-items:center;">' +
      '<div class="action-content"><div class="action-title">' + esc(opts.name) + " " + pill + "</div>" +
      '<div class="action-sub">' + esc(opts.detail || "") + (opts.unlocks ? ' <span style="color:var(--g400);">· Unlocks: ' + esc(opts.unlocks) + "</span>" : "") + "</div></div>" +
      action + "</div>";
  }

  // ── PHASE 4: Connected Stack — live status panel ─────────────────────────────
  function buildP4() {
    var content = document.querySelector("#phase-p4 .content");
    if (!content || document.getElementById("sh-p4-connections")) return;
    var c = DATA.connected;
    var ff = DATA.fireflies;
    var wrap = document.createElement("div");
    wrap.id = "sh-p4-connections";
    wrap.className = "card";
    wrap.style.marginBottom = "18px";
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div class="card-title" style="margin:0;">Your live connections</div>' +
      '<span class="badge badge-teal">' + ([c.google, c.microsoft, ff].filter(Boolean).length) + " active</span></div>" +
      '<div style="font-size:12px;color:var(--g500);margin-bottom:12px;">The real state of your stack right now. Everything below runs on credentials you control.</div>' +
      connRow({ name: "Google Calendar", state: c.google ? "connected" : "action", detail: c.google ? "Reading & (with edit scope) writing your events." : "Pull your meetings into Meeting Prep.", actionLabel: c.google ? "Manage" : "Connect", actionHref: "/meetings", unlocks: c.google ? "" : "Meeting sync + prep" }) +
      connRow({ name: "Microsoft Calendar", state: c.microsoft ? "connected" : "action", detail: c.microsoft ? "Reading & (with edit scope) writing your events." : "Pull your Outlook meetings in.", actionLabel: c.microsoft ? "Manage" : "Connect", actionHref: "/meetings", unlocks: c.microsoft ? "" : "Meeting sync + prep" }) +
      connRow({ name: "Fireflies (transcripts)", state: ff === true ? "connected" : "action", detail: ff === true ? "Call summaries & action items flow into Meeting Prep." : "Auto-capture call transcripts & summaries.", actionLabel: ff === true ? "Manage" : "Set key", actionHref: ff === true ? "/meetings" : "", unlocks: ff === true ? "" : "Transcripts in prep" }) +
      connRow({ name: "Email sender", state: "action", detail: "No sender connected — campaign sending is disabled.", unlocks: "Live campaign send" }) +
      connRow({ name: "CRM (HubSpot)", state: "planned", detail: "Sync accounts, contacts & pipeline. On the roadmap.", unlocks: "Pipeline write-back" }) +
      '<div style="font-size:11px;color:var(--g400);margin-top:10px;">Manage calendars & Fireflies in Meeting Prep. Email sender + CRM connect here once wired.</div>';
    content.insertBefore(wrap, content.firstChild);
  }

  // ── PHASE 6: Campaign Engine — audience + staged-send (gated) ────────────────
  function tierCounts() { var t = { 1: 0, 2: 0, 3: 0 }; DATA.companies.forEach(function (c) { t[companyTier(c)]++; }); return t; }
  var p6sel = { tier: 0 }; // 0 = all
  function selectedCompanies() {
    return DATA.companies.filter(function (c) { return !p6sel.tier || companyTier(c) === p6sel.tier; });
  }
  function sequenceSnapshot() {
    var steps = Array.prototype.slice.call(document.querySelectorAll("#seq-builder-steps .seq-step"));
    return steps.map(function (s) {
      var t = s.querySelector(".seq-title"); var meta = s.querySelector(".seq-meta");
      return { title: t ? (t.textContent || "").trim() : "Step", meta: meta ? (meta.textContent || "").replace(/\s+/g, " ").trim() : "" };
    });
  }

  function buildP6() {
    var dash = document.getElementById("p6-dashboard");
    if (!dash || document.getElementById("sh-p6-builder")) { renderP6Dynamic(); return; }
    var wrap = document.createElement("div");
    wrap.id = "sh-p6-builder";
    wrap.innerHTML =
      // Gated send banner
      '<div class="card" style="margin-bottom:16px;border-left:4px solid var(--warning);">' +
      '<div style="display:flex;gap:10px;align-items:flex-start;"><span aria-hidden="true" style="font-size:18px;">&#128274;</span><div>' +
      '<div style="font-weight:700;color:var(--g800);margin-bottom:2px;">Live sending is off</div>' +
      '<div style="font-size:12px;color:var(--g600);line-height:1.6;">You can build a real audience and stage campaigns now. Nothing is delivered until you connect an <b>email sender</b> (e.g. Smartlead / SMTP / Gmail API) with a verified from-address and domain warmup. Until then, staged campaigns sit safely here — no messages leave SellHi.</div>' +
      "</div></div></div>" +
      // Audience builder
      '<div class="card" style="margin-bottom:16px;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
      '<div class="card-title" style="margin:0;">Campaign audience</div>' +
      '<div id="sh-p6-tierfilter" style="display:flex;gap:6px;"></div></div>' +
      '<div id="sh-p6-audience"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap;">' +
      '<div id="sh-p6-audience-count" style="font-size:12px;color:var(--g500);"></div>' +
      '<button class="btn btn-sm btn-primary" id="sh-p6-stage">Stage campaign &#8594;</button></div></div>' +
      // Staged list
      '<div class="card" style="margin-bottom:16px;"><div class="card-title">Staged campaigns</div><div id="sh-p6-staged"></div></div>';
    dash.insertBefore(wrap, dash.firstChild);
    hideP6Fakes(dash);

    document.getElementById("sh-p6-stage").addEventListener("click", stageCampaign);
    renderP6Dynamic();
  }

  // The demo's Dashboard tab ships fabricated performance below our panels (Total
  // Sent 841, reply rate, "Active Campaigns" table, channel-mix donut) — which
  // contradicts the honest "sending is off / nothing sent" state. Hide those fake
  // blocks; keep the genuinely useful Sequence Builder (a real .card) intact.
  function hideP6Fakes(dash) {
    Array.prototype.forEach.call(dash.children, function (el) {
      if (!el || el.id === "sh-p6-builder") return;
      if (el.classList && (el.classList.contains("metric-row") || el.classList.contains("grid-2"))) {
        el.style.display = "none";
      }
    });
  }

  function renderP6Dynamic() {
    var tc = tierCounts();
    var filt = document.getElementById("sh-p6-tierfilter");
    if (filt) {
      var opts = [{ t: 0, l: "All (" + DATA.companies.length + ")" }, { t: 1, l: "Tier 1 (" + tc[1] + ")" }, { t: 2, l: "Tier 2 (" + tc[2] + ")" }, { t: 3, l: "Tier 3 (" + tc[3] + ")" }];
      filt.innerHTML = opts.map(function (o) {
        return '<button class="btn btn-sm ' + (p6sel.tier === o.t ? "btn-primary" : "btn-outline") + '" data-tier="' + o.t + '">' + esc(o.l) + "</button>";
      }).join("");
      Array.prototype.forEach.call(filt.querySelectorAll("button"), function (b) {
        b.addEventListener("click", function () { p6sel.tier = parseInt(b.getAttribute("data-tier"), 10) || 0; renderP6Dynamic(); });
      });
    }
    var aud = document.getElementById("sh-p6-audience");
    var sel = selectedCompanies();
    if (aud) {
      if (!DATA.companies.length) {
        aud.innerHTML = '<div style="font-size:13px;color:var(--g500);line-height:1.6;padding:8px 0;">No target companies yet. <button class="btn btn-sm btn-primary" onclick="try{showPhase(\'p2\')}catch(e){}">Run Market Intel</button> to build your audience.</div>';
      } else {
        aud.innerHTML = sel.slice(0, 10).map(function (c) {
          var t = companyTier(c);
          return '<div class="action-item" style="align-items:center;"><div class="action-content"><div class="action-title">' + esc(c.name) +
            '</div><div class="action-sub">' + esc([c.industry, c.employees ? c.employees + " employees" : "", c.stage].filter(Boolean).join(" · ")) + "</div></div>" +
            '<span class="badge ' + (TIER_BADGE[t] || "badge-gray") + '">Tier ' + t + "</span></div>";
        }).join("") + (sel.length > 10 ? '<div style="font-size:11px;color:var(--g400);margin-top:6px;">+ ' + (sel.length - 10) + " more in this segment</div>" : "");
      }
    }
    var cnt = document.getElementById("sh-p6-audience-count");
    if (cnt) cnt.textContent = sel.length + " recipient" + (sel.length === 1 ? "" : "s") + " selected · " + sequenceSnapshot().length + " sequence steps";
    var stageBtn = document.getElementById("sh-p6-stage");
    if (stageBtn) stageBtn.disabled = !sel.length;
    renderStaged();
  }

  function renderStaged() {
    var host = document.getElementById("sh-p6-staged");
    if (!host) return;
    var list = DATA.campaigns || [];
    if (!list.length) { host.innerHTML = '<div style="font-size:13px;color:var(--g500);">No staged campaigns yet. Pick an audience above and stage one — it\'ll wait here (saved to your account, across devices), ready to send the moment an email sender is connected.</div>'; return; }
    host.innerHTML = list.map(function (c) {
      return '<div class="action-item" style="align-items:center;"><div class="action-content">' +
        '<div class="action-title">' + esc(c.name) + '</div>' +
        '<div class="action-sub">' + (c.recipients || 0) + " recipients · " + (c.steps || 0) + " steps · " + esc(c.tierLabel || "") + " <span class=\"badge badge-amber\">Staged · not sent</span></div></div>" +
        '<button class="btn btn-sm btn-outline" data-del="' + esc(c.id) + '" style="color:var(--danger);border-color:var(--danger);">Remove</button></div>';
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll("[data-del]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-del");
        b.disabled = true;
        fetch("/api/campaigns", { method: "DELETE", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ id: id }) })
          .then(function () { DATA.campaigns = (DATA.campaigns || []).filter(function (c) { return c.id !== id; }); renderStaged(); try { toast("info", "Campaign removed."); } catch (e) {} })
          .catch(function () { b.disabled = false; try { toast("info", "Couldn't remove — try again."); } catch (e) {} });
      });
    });
  }

  function stageCampaign() {
    var sel = selectedCompanies();
    if (!sel.length) return;
    var seq = sequenceSnapshot();
    var tierLabel = p6sel.tier ? "Tier " + p6sel.tier : "All tiers";
    var name = (sel[0] ? sel[0].industry || "Target" : "Target") + " · " + tierLabel + " (" + sel.length + ")";
    var btn = document.getElementById("sh-p6-stage");
    if (btn) btn.disabled = true;
    fetch("/api/campaigns", {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
      body: JSON.stringify({ name: name, recipients: sel.length, steps: seq.length, tierLabel: tierLabel, companies: sel.map(function (c) { return c.name; }), sequence: seq }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (btn) btn.disabled = false;
        if (j && j.campaign) { DATA.campaigns.unshift(j.campaign); renderStaged(); try { toast("success", "Campaign staged — saved to your account, ready to send once an email sender is connected."); } catch (e) {} }
        else { try { toast("info", "Couldn't stage the campaign — try again."); } catch (e) {} }
      })
      .catch(function () { if (btn) btn.disabled = false; try { toast("info", "Couldn't stage the campaign — try again."); } catch (e) {} });
  }

  // ── wire into navigation ─────────────────────────────────────────────────────
  function render(phase) {
    var build = phase === "p4" ? buildP4 : phase === "p6" ? buildP6 : null;
    if (!build) return;
    if (DATA.loaded) { try { build(); } catch (e) {} }
    else load(function () { try { build(); } catch (e) {} });
  }
  function wrapShowPhase() {
    if (window.__shCampWrapped) return true;
    if (typeof window.showPhase !== "function") return false;
    var orig = window.showPhase;
    window.showPhase = function (p) {
      var r = orig.apply(this, arguments);
      if (p === "p4" || p === "p6") { try { render(p); } catch (e) {} }
      return r;
    };
    window.__shCampWrapped = true;
    return true;
  }
  function boot() {
    var tries = 0;
    var t = setInterval(function () { tries++; if (wrapShowPhase() || tries > 60) clearInterval(t); }, 150);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
