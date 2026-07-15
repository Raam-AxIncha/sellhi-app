/*
 * SellHi — Meeting Prep workspace (/meetings).
 * Standalone surface. Works fully today with NO external credentials:
 *   • TCP dossier context (reuses /api/dossier)
 *   • Prep notes  -> /api/prep-notes (autosave)
 *   • Scribble pad -> /api/prep-notes canvas (autosave)
 * Calendar sync, common-connections (Common Room) and transcript (Fireflies)
 * degrade gracefully to "Connect…" states until their env vars are set.
 */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $all = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function slug(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60); }

  var state = { key: null, company: null, dossier: null, canvasData: null };

  // ---- left column: calendar status + meeting list ------------------------
  function providerBtn(provider, label, connected, email) {
    if (connected) return '<span class="chip"><span class="pill pill-green" style="margin-right:6px;">Connected</span>' + esc(label) + (email ? " · " + esc(email) : "") + "</span>";
    return '<a class="btn btn-sm" href="/api/calendar/' + provider + '/start">Connect ' + esc(label) + "</a>";
  }

  function renderCalStatus(connected) {
    var any = connected && (connected.google || connected.microsoft);
    $("#cal-status").innerHTML = any
      ? '<div class="muted">Calendar connected. Your upcoming meetings appear below.</div>'
      : '<div class="muted">Connect a calendar to pull your real meetings in. You can still prep any company right now without it.</div>';
    $("#connect-row").innerHTML =
      providerBtn("google", "Google", connected && connected.google, "") +
      providerBtn("microsoft", "Microsoft", connected && connected.microsoft, "");
  }

  function localPreps() {
    try { return JSON.parse(localStorage.getItem("sellhi_prep_companies") || "[]"); } catch (e) { return []; }
  }
  function saveLocalPrep(key, company) {
    var list = localPreps().filter(function (p) { return p.key !== key; });
    list.unshift({ key: key, company: company });
    try { localStorage.setItem("sellhi_prep_companies", JSON.stringify(list.slice(0, 30))); } catch (e) {}
  }

  function fmtWhen(iso) {
    if (!iso) return "";
    try { var d = new Date(iso); return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }

  function renderList(meetings) {
    var html = "";
    (meetings || []).forEach(function (m) {
      var key = "meeting:" + (m.external_id || m.id);
      html += '<div class="m-item" data-key="' + esc(key) + '" data-company="' + esc(m.title || "") + '">' +
        '<div class="m-title">' + esc(m.title || "Untitled meeting") + "</div>" +
        '<div class="m-meta">' + esc(fmtWhen(m.start_at)) + (m.join_url ? " · has join link" : "") + "</div></div>";
    });
    var preps = localPreps();
    if (preps.length) {
      html += '<div class="card-title" style="margin-top:14px;">Company preps</div>';
      preps.forEach(function (p) {
        html += '<div class="m-item" data-key="' + esc(p.key) + '" data-company="' + esc(p.company) + '">' +
          '<div class="m-title">' + esc(p.company) + "</div><div class=\"m-meta\">Prep sheet</div></div>";
      });
    }
    if (!html) html = '<div class="empty">No meetings yet. Click <b>+ Prep a company</b> to start.</div>';
    $("#meeting-list").innerHTML = html;
    $all("#meeting-list .m-item").forEach(function (el) {
      el.addEventListener("click", function () {
        $all("#meeting-list .m-item").forEach(function (x) { x.classList.remove("active"); });
        el.classList.add("active");
        openPrep(el.getAttribute("data-key"), el.getAttribute("data-company"));
      });
    });
  }

  var syncedOnce = false;
  function loadMeetings() {
    fetch("/api/meetings", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        renderCalStatus(j.connected);
        renderList(j.meetings);
        // If a calendar is connected, pull fresh events once per load, then refresh.
        var connected = j.connected && (j.connected.google || j.connected.microsoft);
        if (connected && !syncedOnce) {
          syncedOnce = true;
          var status = document.getElementById("cal-status");
          if (status) status.insertAdjacentHTML("beforeend", '<div class="muted" id="sync-hint">Syncing your calendar…</div>');
          fetch("/api/calendar/sync", { method: "POST", credentials: "include" })
            .then(function (r) { return r.json(); })
            .then(function () { return fetch("/api/meetings", { credentials: "include" }).then(function (r) { return r.json(); }); })
            .then(function (j2) { renderList(j2.meetings); var h = document.getElementById("sync-hint"); if (h) h.remove(); })
            .catch(function () { var h = document.getElementById("sync-hint"); if (h) h.remove(); });
        }
      })
      .catch(function () { renderCalStatus({}); renderList([]); });
  }

  // ---- right column: prep panel -------------------------------------------
  function openPrep(key, company) {
    state.key = key; state.company = company || "";
    $("#prep-empty").classList.add("hidden");
    $("#prep-panel").classList.remove("hidden");
    $("#prep-title").textContent = company || "Meeting prep";
    $("#prep-sub").textContent = key.indexOf("company:") === 0 ? "Company prep sheet" : "Meeting prep";
    setTab("dossier");
    renderMeContext();
    loadNote();
    loadCommonConnections();
    loadTranscript();
  }

  function renderMeContext() {
    var d = state.dossier;
    if (!d) { $("#me-context").textContent = "Add your dossier in the Identity Engine to see your positioning here."; return; }
    var p = d.practice || {}, seat = d.seat || {}, exp = d.experience || {};
    var chips = (exp.industries || []).map(function (i) { return '<span class="chip">' + esc(i) + "</span>"; }).join("");
    $("#me-context").innerHTML =
      '<div style="font-weight:700;color:var(--g800);margin-bottom:4px;">' + esc(d.headline || (seat.nameTitle || "")) + "</div>" +
      (p.name ? '<div class="muted" style="margin-bottom:8px;">' + esc(p.name) + " · " + esc(exp.dealSize || "") + "</div>" : "") +
      (chips ? '<div>' + chips + "</div>" : "");
  }

  // ---- prep notes (autosave) ----------------------------------------------
  var saveTimer = null;
  function markSaving(){ $("#prep-save").textContent = "Saving…"; }
  function markSaved(){ $("#prep-save").textContent = "Saved"; }
  function persist(extra) {
    if (!state.key) return;
    var body = Object.assign({ key: state.key, company: state.company }, extra || {});
    markSaving();
    fetch("/api/prep-notes", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(body) })
      .then(function () { markSaved(); }).catch(function () { $("#prep-save").textContent = "Save failed"; });
  }
  function persistDebounced(extra) { clearTimeout(saveTimer); saveTimer = setTimeout(function(){ persist(extra); }, 700); }

  function loadNote() {
    $("#notes").value = "";
    state.canvasData = null;
    clearCanvas(true);
    fetch("/api/prep-notes?key=" + encodeURIComponent(state.key), { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var n = j.note || {};
        $("#notes").value = n.notes || "";
        // Keep the saved drawing in state; paint it now if the scribble pane is
        // already visible, otherwise setupCanvasSize paints it when the tab opens.
        state.canvasData = n.canvas || null;
        var pane = document.getElementById("pane-scribble");
        if (state.canvasData && pane && !pane.classList.contains("hidden")) { setupCanvasSize(); }
        markSaved();
      }).catch(function () {});
  }

  // ---- scribble canvas -----------------------------------------------------
  var canvas, ctx, drawing = false, penColor = "#0F172A", penSize = 3, dpr = 1, canvasSaveTimer = null;
  var COLORS = ["#0F172A", "#2563EB", "#DC2626", "#1D9E75", "#D97706"];

  function setupCanvasSize(retries) {
    if (!canvas) return;
    var pane = document.getElementById("pane-scribble");
    if (!pane || pane.classList.contains("hidden")) return; // not visible yet
    var rect = canvas.getBoundingClientRect();
    // On the first open the pane may not be laid out yet (width 0). Wait for a
    // real layout via rAF instead of a fixed delay, then size + repaint.
    if (!rect.width) {
      if ((retries || 0) < 15) requestAnimationFrame(function () { setupCanvasSize((retries || 0) + 1); });
      return;
    }
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // Repaint whatever drawing we're holding (saved from the DB or this session).
    if (state.canvasData) loadCanvasImage(state.canvasData);
  }
  function pos(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: x, y: y };
  }
  function startDraw(e){ drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
  function moveDraw(e){ if(!drawing) return; var p = pos(e); ctx.strokeStyle = penColor; ctx.lineWidth = penSize; ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
  function endDraw(){ if(!drawing) return; drawing = false; scheduleCanvasSave(); }
  function scheduleCanvasSave(){ clearTimeout(canvasSaveTimer); canvasSaveTimer = setTimeout(function(){ try { var d = canvas.toDataURL("image/png"); state.canvasData = d; persist({ canvas: d }); } catch(e){} }, 900); }
  function clearCanvas(skipSave){ if(!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); if(!skipSave) scheduleCanvasSave(); }
  function loadCanvasImage(dataUrl, noScale){
    var img = new Image();
    img.onload = function(){ var rect = canvas.getBoundingClientRect(); ctx.drawImage(img, 0, 0, rect.width, rect.height); };
    img.src = dataUrl;
  }
  function initScribble() {
    canvas = $("#scribble"); if (!canvas) return;
    $("#swatches").innerHTML = COLORS.map(function (c, i) {
      return '<span class="swatch' + (i===0?" active":"") + '" data-c="' + c + '" style="background:' + c + ';"></span>';
    }).join("");
    $all("#swatches .swatch").forEach(function (sw) {
      sw.addEventListener("click", function () {
        penColor = sw.getAttribute("data-c");
        $all("#swatches .swatch").forEach(function (x){ x.classList.remove("active"); });
        sw.classList.add("active");
      });
    });
    var pen = $("#pen-size"); if (pen) pen.addEventListener("input", function(){ penSize = parseInt(pen.value,10) || 3; });
    $("#scribble-clear").addEventListener("click", function(){ clearCanvas(); });
    canvas.addEventListener("mousedown", startDraw); canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);
    canvas.addEventListener("touchstart", startDraw, {passive:false});
    canvas.addEventListener("touchmove", moveDraw, {passive:false});
    canvas.addEventListener("touchend", endDraw);
  }

  // ---- common connections (Common Room) — graceful until configured -------
  function loadCommonConnections() {
    var host = $("#common-connections");
    host.innerHTML = '<div class="muted">Checking…</div>';
    fetch("/api/common-connections", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ company: state.company }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 503) { host.innerHTML = '<div class="empty">Connect <b>Common Room</b> to surface people you and this account already share. <span class="muted">(Set COMMON_ROOM_API_KEY.)</span></div>'; return; }
        var people = (res.j && res.j.connections) || [];
        if (!people.length) { host.innerHTML = '<div class="muted">No shared connections found for this account yet.</div>'; return; }
        host.innerHTML = people.map(function (p) { return '<span class="chip">' + esc(p.name || p) + (p.role ? " · " + esc(p.role) : "") + "</span>"; }).join("");
      })
      .catch(function () { host.innerHTML = '<div class="muted">Common connections unavailable.</div>'; });
  }

  // ---- transcript (Fireflies) — graceful until configured -----------------
  function loadTranscript() {
    var host = $("#transcript-body");
    host.innerHTML = '<div class="muted">Checking…</div>';
    fetch("/api/transcripts?key=" + encodeURIComponent(state.key) + "&company=" + encodeURIComponent(state.company || ""), { credentials: "include" })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 503) { host.innerHTML = '<div class="empty">Connect <b>Fireflies</b> to auto-capture this meeting\'s transcript &amp; summary. <span class="muted">(Set FIREFLIES_API_KEY.)</span></div>'; return; }
        var t = res.j && res.j.transcript;
        if (!t) { host.innerHTML = '<div class="muted">No transcript yet. Once Fireflies joins this meeting, its summary appears here.</div>'; return; }
        host.innerHTML = '<div style="font-weight:700;margin-bottom:6px;">' + esc(t.title || "Summary") + "</div><div class=\"muted\">" + esc(t.summary || "") + "</div>";
      })
      .catch(function () { host.innerHTML = '<div class="muted">Transcript unavailable.</div>'; });
  }

  // ---- tabs ----------------------------------------------------------------
  function setTab(name) {
    $all(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    $all(".tabpane").forEach(function (p) { p.classList.add("hidden"); });
    var pane = $("#pane-" + name); if (pane) pane.classList.remove("hidden");
    if (name === "scribble") setTimeout(setupCanvasSize, 30);
  }

  // ---- boot ----------------------------------------------------------------
  function boot() {
    try { var u = window.__SELLHI_USER__; if (u) $("#who").textContent = (u.fullName || "") + (u.company ? " · " + u.company : ""); } catch (e) {}
    // dossier context
    fetch("/api/dossier", { credentials: "include" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { state.dossier = j && j.dossier && j.dossier.data ? j.dossier.data.dossier : null; if (state.key) renderMeContext(); })
      .catch(function () {});
    loadMeetings();
    initScribble();
    $all(".tab").forEach(function (t) { t.addEventListener("click", function () { setTab(t.getAttribute("data-tab")); }); });
    $("#notes").addEventListener("input", function () { persistDebounced({ notes: $("#notes").value }); });
    $("#add-manual").addEventListener("click", function () {
      var name = prompt("Company or person to prep for:");
      if (!name || !name.trim()) return;
      var key = "company:" + slug(name);
      saveLocalPrep(key, name.trim());
      loadMeetings();
      openPrep(key, name.trim());
    });
    window.addEventListener("resize", function () { if (!$("#pane-scribble").classList.contains("hidden")) setupCanvasSize(); });
  }
  if (document.readyState === "complete" || document.readyState === "interactive") boot();
  else window.addEventListener("DOMContentLoaded", boot);
})();
