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

  var state = { key: null, company: null, dossier: null, canvasData: null, meetings: {}, currentMeeting: null, connected: {} };

  // ---- left column: calendar status + meeting list ------------------------
  function providerBtn(provider, label, connected) {
    if (connected) {
      return '<span class="chip"><span class="pill pill-green" style="margin-right:6px;">Connected</span>' + esc(label) + "</span>" +
        '<a class="btn btn-sm" href="/api/calendar/' + provider + '/start">Switch account</a>' +
        '<a class="btn btn-sm sh-disconnect" data-provider="' + provider + '" style="cursor:pointer;color:var(--danger);border-color:var(--danger);">Disconnect</a>';
    }
    return '<a class="btn btn-sm" href="/api/calendar/' + provider + '/start">Connect ' + esc(label) + "</a>";
  }

  function renderCalStatus(connected) {
    var any = connected && (connected.google || connected.microsoft);
    $("#cal-status").innerHTML = any
      ? '<div class="muted">Calendar connected. Your upcoming meetings appear below. Wrong account? Use "Switch account".</div>'
      : '<div class="muted">Connect a calendar to pull your real meetings in. You can still prep any company right now without it.</div>';
    $("#connect-row").innerHTML =
      providerBtn("google", "Google", connected && connected.google) +
      providerBtn("microsoft", "Microsoft", connected && connected.microsoft);
    $all("#connect-row .sh-disconnect").forEach(function (el) {
      el.addEventListener("click", function () {
        var p = el.getAttribute("data-provider");
        el.textContent = "Disconnecting…";
        fetch("/api/calendar/" + p + "/disconnect", { method: "POST", credentials: "include" })
          .then(function () { syncedOnce = false; loadMeetings(); })
          .catch(function () { loadMeetings(); });
      });
    });
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
    state.meetings = {};
    (meetings || []).forEach(function (m) {
      var key = "meeting:" + (m.external_id || m.id);
      state.meetings[key] = m;
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
        state.connected = j.connected || {};
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
    state.currentMeeting = state.meetings[key] || null;
    $("#prep-empty").classList.add("hidden");
    $("#prep-panel").classList.remove("hidden");
    $("#prep-title").textContent = company || "Meeting prep";
    $("#prep-sub").textContent = key.indexOf("company:") === 0 ? "Company prep sheet" : "Meeting prep";
    renderEditControls();
    setTab("dossier");
    renderMeContext();
    loadNote();
    loadCommonConnections();
    loadTranscript();
  }

  // ---- edit meeting details (write-back to Google / Microsoft) -------------
  function isoToLocalInput(iso) {
    if (!iso) return "";
    var d = new Date(iso); if (isNaN(d.getTime())) return "";
    // datetime-local wants local wall-clock 'YYYY-MM-DDTHH:mm'
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function localInputToIso(v) {
    if (!v) return "";
    var d = new Date(v); // interpreted as local time
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }
  function renderEditControls() {
    var m = state.currentMeeting;
    var toggle = $("#edit-toggle"), panel = $("#edit-panel");
    if (panel) panel.classList.add("hidden");
    // Only real calendar/manual meetings (a DB row with an id) can be edited.
    if (m && m.id) { if (toggle) toggle.classList.remove("hidden"); }
    else { if (toggle) toggle.classList.add("hidden"); }
  }
  function openEditForm() {
    var m = state.currentMeeting; if (!m) return;
    $("#edit-title").value = m.title || "";
    $("#edit-location").value = m.location || "";
    $("#edit-start").value = isoToLocalInput(m.start_at);
    $("#edit-end").value = isoToLocalInput(m.end_at);
    $("#edit-status").textContent = (m.provider === "google" || m.provider === "microsoft")
      ? "Changes save back to your " + (m.provider === "google" ? "Google" : "Microsoft") + " calendar."
      : "";
    $("#edit-panel").classList.remove("hidden");
  }
  function saveEditForm() {
    var m = state.currentMeeting; if (!m || !m.id) return;
    var payload = { id: m.id, title: $("#edit-title").value.trim(), location: $("#edit-location").value.trim() };
    var s = localInputToIso($("#edit-start").value); if (s) payload.start_at = s;
    var e = localInputToIso($("#edit-end").value); if (e) payload.end_at = e;
    var status = $("#edit-status"), btn = $("#edit-save");
    status.textContent = "Saving…"; btn.disabled = true;
    fetch("/api/meetings", { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (res.ok) {
          // reflect locally
          m.title = payload.title; m.location = payload.location;
          if (payload.start_at) m.start_at = payload.start_at;
          if (payload.end_at) m.end_at = payload.end_at;
          state.company = payload.title || state.company;
          $("#prep-title").textContent = payload.title || $("#prep-title").textContent;
          $("#edit-panel").classList.add("hidden");
          loadMeetings();
          return;
        }
        if (res.j && res.j.needsReconnect) {
          status.innerHTML = 'Your calendar is connected read-only. <a href="/api/calendar/' + esc(m.provider) + '/start">Reconnect to grant edit access</a>, then try again.';
        } else {
          status.textContent = (res.j && res.j.error) || "Couldn't save changes.";
        }
      })
      .catch(function () { btn.disabled = false; status.textContent = "Couldn't save changes."; });
  }
  function deleteMeeting() {
    var m = state.currentMeeting; if (!m || !m.id) return;
    var remote = (m.provider === "google" || m.provider === "microsoft");
    if (!window.confirm("Delete this meeting?" + (remote ? " It will also be removed from your calendar." : ""))) return;
    var status = $("#edit-status"), btn = $("#edit-delete");
    status.textContent = "Deleting…"; if (btn) btn.disabled = true;
    fetch("/api/meetings", { method: "DELETE", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ id: m.id }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (btn) btn.disabled = false;
        if (res.ok) {
          $("#prep-panel").classList.add("hidden");
          $("#prep-empty").classList.remove("hidden");
          state.key = null; state.currentMeeting = null;
          loadMeetings();
          try { toast("info", "Meeting deleted."); } catch (e) {}
          return;
        }
        if (res.j && res.j.detail) { try { console.error("[SellHi] delete-event failed:", res.j.error, "—", res.j.detail); } catch (e) {} }
        if (res.j && res.j.needsReconnect) status.innerHTML = 'Reconnect your calendar to grant edit access, then try again.';
        else status.textContent = (res.j && res.j.error) || "Couldn't delete.";
      })
      .catch(function () { if (btn) btn.disabled = false; status.textContent = "Couldn't delete."; });
  }

  // ---- create a new meeting (real calendar event or local) ----------------
  function providerOptions() {
    var opts = [];
    if (state.connected && state.connected.google) opts.push('<option value="google">Google Calendar</option>');
    if (state.connected && state.connected.microsoft) opts.push('<option value="microsoft">Microsoft Calendar</option>');
    opts.push('<option value="manual">Just track it here (no calendar)</option>');
    return opts.join("");
  }
  function openCreateForm() {
    $("#new-title").value = ""; $("#new-location").value = "";
    $("#new-start").value = ""; $("#new-end").value = "";
    $("#new-provider").innerHTML = providerOptions();
    $("#new-status").textContent = "";
    $("#create-panel").classList.remove("hidden");
    $("#new-title").focus();
  }
  function createMeeting() {
    var title = $("#new-title").value.trim();
    var status = $("#new-status"), btn = $("#new-create");
    if (!title) { status.textContent = "Give the meeting a title."; return; }
    var provider = $("#new-provider").value || "manual";
    var payload = { title: title, provider: provider };
    var loc = $("#new-location").value.trim(); if (loc) payload.location = loc;
    var s = localInputToIso($("#new-start").value); if (s) payload.start_at = s;
    var e = localInputToIso($("#new-end").value); if (e) payload.end_at = e;
    // Calendar events need a start time (end defaults to +1h server-side).
    if ((provider === "google" || provider === "microsoft") && !payload.start_at) {
      status.textContent = "Pick a start time to add this to your calendar.";
      return;
    }
    status.textContent = "Creating…"; btn.disabled = true;
    fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (res.ok) {
          $("#create-panel").classList.add("hidden");
          loadMeetings();
          try { toast("success", payload.provider === "manual" ? "Meeting added." : "Meeting created on your calendar."); } catch (x) {}
          return;
        }
        if (res.j && res.j.detail) { try { console.error("[SellHi] create-event failed:", res.j.error, "—", res.j.detail); } catch (x) {} }
        if (res.j && res.j.needsReconnect) status.innerHTML = 'Reconnect that calendar to grant edit access, then try again.';
        else status.textContent = (res.j && res.j.error) || "Couldn't create the meeting.";
      })
      .catch(function () { btn.disabled = false; status.textContent = "Couldn't create the meeting."; });
  }

  function renderMeContext() {
    var d = state.dossier;
    if (!d) { $("#me-context").textContent = "Add your dossier in the Identity Engine to see your positioning here."; return; }
    var p = d.practice || {}, seat = d.seat || {}, exp = d.experience || {};
    var chips = (exp.industries || []).map(function (i) { return '<span class="chip">' + esc(i) + "</span>"; }).join("");
    $("#me-context").innerHTML =
      '<div style="font-weight:700;color:var(--sh-ink);margin-bottom:4px;">' + esc(d.headline || (seat.nameTitle || "")) + "</div>" +
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

  // ---- common connections -------------------------------------------------
  // Two compliant paths (no scraping):
  //  A) People you ALREADY know at this account — built from your own calendar
  //     attendees + Fireflies participants (server: /api/common-connections).
  //  B) Deep-links into regular LinkedIn (mutual connections show natively on a
  //     profile) and LinkedIn Sales Navigator (TeamLink) for SN subscribers.
  function liPeople(q) { return "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(q || ""); }
  function liSalesNav(q) { return "https://www.linkedin.com/sales/search/people?query=(spellCorrectionEnabled:true,keywords:" + encodeURIComponent(q || "") + ")"; }
  function sourceLabel(s) {
    if (!s) return "";
    if (s.indexOf("calendar") > -1 && s.indexOf("fireflies") > -1) return "via calendar + Fireflies";
    if (s.indexOf("fireflies") > -1) return "via Fireflies";
    return "via calendar";
  }
  function deepLinksBlock(company) {
    var co = company || "this account";
    return '<div class="muted" style="margin-bottom:8px;">Open <b>' + esc(co) + '</b> on LinkedIn — regular LinkedIn shows your mutual connections natively on each profile; Sales Navigator adds TeamLink paths.</div>' +
      '<div class="connect-row" style="margin-bottom:14px;">' +
      '<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" href="' + liPeople(company) + '">People on LinkedIn &#8599;</a>' +
      '<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" href="' + liSalesNav(company) + '">Sales Navigator &#8599;</a></div>';
  }
  function loadCommonConnections() {
    var host = $("#common-connections");
    var company = state.company || "";
    host.innerHTML = deepLinksBlock(company) +
      '<div class="card-title" style="margin-bottom:8px;">People you already know here</div><div id="cc-people" class="muted">Checking your calendar &amp; calls…</div>';
    fetch("/api/common-connections", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify({ company: company }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        var box = $("#cc-people"); if (!box) return;
        var people = (res.j && res.j.connections) || [];
        if (!people.length) {
          box.innerHTML = '<div class="muted">No shared contacts at this account in your calendar or calls yet. As you meet more people here, they\'ll appear automatically. Connect a calendar (and Fireflies) to grow this list.</div>';
          return;
        }
        box.innerHTML = people.map(function (p) {
          var nm = p.name || (p.email || "").split("@")[0];
          var meta = [p.email, sourceLabel(p.source)].filter(Boolean).join(" · ");
          return '<div class="m-item" style="cursor:default;flex-direction:row;align-items:center;justify-content:space-between;">' +
            '<div style="min-width:0;"><div class="m-title" title="' + esc(p.context || "") + '">' + esc(nm) + "</div>" +
            '<div class="m-meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(meta) + "</div></div>" +
            '<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" href="' + liPeople(nm + " " + company) + '">LinkedIn &#8599;</a></div>';
        }).join("");
      })
      .catch(function () { var box = $("#cc-people"); if (box) box.innerHTML = '<div class="muted">Couldn\'t load shared contacts right now.</div>'; });
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
        if (!t) { host.innerHTML = '<div class="muted">No transcript yet. Once Fireflies records a call for this account, its summary and action items appear here.</div>'; return; }
        host.innerHTML = renderTranscript(t);
      })
      .catch(function () { host.innerHTML = '<div class="muted">Transcript unavailable.</div>'; });
  }
  function fmtList(v) {
    // Fireflies action_items is markdown-ish text or an array; render as lines.
    var items = Array.isArray(v) ? v : String(v || "").split(/\n+/);
    items = items.map(function (s) { return String(s).replace(/^[-*•\d.\s]+/, "").trim(); }).filter(Boolean);
    if (!items.length) return "";
    return "<ul style=\"margin:6px 0 0;padding-left:18px;\">" + items.map(function (s) { return "<li style=\"margin-bottom:4px;\">" + esc(s) + "</li>"; }).join("") + "</ul>";
  }
  function renderTranscript(t) {
    var h = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">' +
      '<div><div style="font-weight:700;">' + esc(t.title || "Summary") + "</div>" +
      (t.date ? '<div class="savehint">' + esc(t.date) + "</div>" : "") + "</div>" +
      (t.url ? '<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" href="' + esc(t.url) + '">Open in Fireflies &#8599;</a>' : "") + "</div>";
    if (t.summary) h += '<div class="muted" style="margin-bottom:10px;line-height:1.6;">' + esc(t.summary) + "</div>";
    var ai = fmtList(t.actionItems);
    if (ai) h += '<div class="card-title" style="margin-top:6px;">Action items</div>' + ai;
    if (Array.isArray(t.keywords) && t.keywords.length) {
      h += '<div class="card-title" style="margin-top:12px;">Keywords</div><div style="margin-top:4px;">' +
        t.keywords.slice(0, 12).map(function (k) { return '<span class="chip">' + esc(k) + "</span>"; }).join("") + "</div>";
    }
    if (Array.isArray(t.attendees) && t.attendees.length) {
      h += '<div class="card-title" style="margin-top:12px;">Participants</div><div class="muted" style="margin-top:4px;">' +
        t.attendees.map(function (a) { return esc(a.name || (a.email || "").split("@")[0]); }).join(", ") + "</div>";
    }
    return h;
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
    // Logo stays static on Meeting Prep (consistent with the main app — the arrow
    // mark no longer spins; motion lives in the loader ring, not the brand mark).
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
    var et = $("#edit-toggle"); if (et) et.addEventListener("click", openEditForm);
    var ec = $("#edit-cancel"); if (ec) ec.addEventListener("click", function () { $("#edit-panel").classList.add("hidden"); });
    var es = $("#edit-save"); if (es) es.addEventListener("click", saveEditForm);
    var ed = $("#edit-delete"); if (ed) ed.addEventListener("click", deleteMeeting);
    var am = $("#add-meeting"); if (am) am.addEventListener("click", openCreateForm);
    var nc = $("#new-cancel"); if (nc) nc.addEventListener("click", function () { $("#create-panel").classList.add("hidden"); });
    var ncr = $("#new-create"); if (ncr) ncr.addEventListener("click", createMeeting);
    window.addEventListener("resize", function () { if (!$("#pane-scribble").classList.contains("hidden")) setupCanvasSize(); });
  }
  if (document.readyState === "complete" || document.readyState === "interactive") boot();
  else window.addEventListener("DOMContentLoaded", boot);
})();
