/*
 * SellHi PERSONA SEAM — runs on top of the exact live demo (demo.html untouched).
 *
 * The whole app is one engine — "define who you are -> find who needs you ->
 * catch the buying signal -> reach out first." That engine doesn't care whether
 * the person in the seat is a fractional exec, a fractional developer, or a
 * company choosing one. This module makes the app PERSONA-AWARE so we can point
 * it at new personas later WITHOUT re-architecting — it does NOT light up any
 * future persona yet. Cheap insurance, huge optionality.
 *
 * What it does today, all additive + defensive (no-ops if the DOM isn't there):
 *   1) Renames the live workspace "Fractional CXO" -> "Fractional Pro"
 *      (shorter, status-forward, role-agnostic).
 *   2) Reserves a "SellHi Exchange" slot (Pre-launch) in the workspace menu so
 *      Layer 3 (the client-choice marketplace) has its home already.
 *   3) Records the current persona (default "pro") on window + localStorage and,
 *      best-effort, on the user's dossier — the seam a signup "workspace type"
 *      choice will later write to.
 *
 * The existing "AxIncha Sales-as-a-Service" early-access teaser is left exactly
 * as the demo ships it (it is a live lead hook).
 */
(function () {
  "use strict";

  // ---- Persona registry: the single source of truth for workspace types. ----
  // state: "live" = usable today; "prelaunch" = reserved seat, teased not built.
  var PERSONAS = {
    pro: {
      key: "pro",
      name: "Fractional Pro",
      mark: "FP",
      meta: "Sell yourself in, first",
      state: "live"
    },
    exchange: {
      key: "exchange",
      name: "SellHi Exchange",
      mark: "EX",
      meta: "Choose from proactively-marketed talent",
      state: "prelaunch",
      // A tasteful "grab an early-access slot" hook, same destination as the
      // AxIncha teaser so every lead lands in one place.
      early: "https://meetings.hubspot.com/raamkumar/axincha-sales-as-a-service-early-access-20-min"
    }
  };

  // ---- Persona pack, derived from IDENTITY (function × level) ----------------
  // The whole train follows the engine: once the person's identity is set, the
  // ENTIRE downstream pipeline (who to target -> which signals -> how to reach)
  // is derived from their specific function and level. A Fractional CRO hunts
  // companies with no sales leader; a Fractional CTO hunts tech-leadership gaps;
  // a fractional QA lead hunts teams staffing up delivery. Same eight phases —
  // only the ICP, signals and message tone change, and they change per identity.
  //
  // "Hi" = High -> Higher -> Highest: every pack aims the seller at the
  // highest-value buyer they can credibly reach and the highest-value
  // engagement they can win. Never a "hello".

  // FUNCTION registry. Each entry describes the domain + the signals that mean
  // "this company needs this function right now", split by level.
  var FUNCTIONS = {
    revenue: {
      label: "Revenue & Sales", leader: "sales / revenue leader",
      domain: "pipeline, GTM and revenue growth", plural: "sales / revenue talent",
      match: /\b(cro|revenue|sales|gtm|go[\s-]?to[\s-]?market|business\s+development|bd(?:r)?|account\s+exec|ae|sdr|commercial)\b/i,
      execSignals: ["Sales-leadership seat open or newly vacated", "Revenue miss or growth stall showing up in the news", "New funding earmarked to scale GTM", "Expanding into a new market or segment", "Hiring a VP Sales / Head of Revenue"],
      deliverySignals: ["Hiring SDRs/AEs or building an outbound motion", "New sales tooling or CRM roll-out", "Ramping pipeline ahead of a raise", "New territory or product to sell into"]
    },
    technology: {
      label: "Technology & Engineering", leader: "technology leader",
      domain: "architecture, engineering and delivery", plural: "engineering talent",
      match: /\b(cto|vp\s+eng|engineering|technolog|software|developer|programmer|architect|full[\s-]?stack|front[\s-]?end|back[\s-]?end|sde|sdet|devops|sre|platform|infra)\b/i,
      execSignals: ["CTO / VP Engineering seat open", "Scaling the engineering team fast", "Re-platform, migration or modernization underway", "Funding raised to build product", "Security, scaling or reliability pressure in the news"],
      deliverySignals: ["Live req for your exact stack", "New language / framework / cloud entering their stack", "Funding earmarked to expand engineering", "Product launch or major release on the horizon", "Migration / modernization project spinning up"]
    },
    quality: {
      label: "Quality, Test & UAT", leader: "quality / QA leader",
      domain: "test strategy, automation and release quality", plural: "QA / test talent",
      match: /\b(qa|quality|tester|test\s+lead|automation|sdet|uat|acceptance|prod(?:uction)?\s*support|reliability)\b/i,
      execSignals: ["Head of Quality / QA leadership gap", "Quality incidents or a shaky release cadence", "Scaling QA ahead of a big launch"],
      deliverySignals: ["Open QA / SDET / automation req", "New test-automation or CI/CD initiative", "Major launch or release needing hardening", "UAT / acceptance ramp before go-live", "Production-support load rising"]
    },
    product: {
      label: "Product", leader: "product leader",
      domain: "product strategy and roadmap", plural: "product talent",
      match: /\b(cpo|product\s+(?:manager|owner|lead)|pm\b|product\b)\b/i,
      execSignals: ["Product-leadership seat open", "New product line or pivot", "Funding raised to build product", "Roadmap stalling / shipping slowed"],
      deliverySignals: ["Open PM / product-owner req", "New product line spinning up", "Discovery or 0-to-1 build underway"]
    },
    marketing: {
      label: "Marketing & Growth", leader: "marketing leader",
      domain: "brand, demand and growth", plural: "marketing talent",
      match: /\b(cmo|marketing|demand\s+gen|growth|brand|content|seo|performance\s+marketing)\b/i,
      execSignals: ["Marketing-leadership seat open", "Rebrand or repositioning", "Entering a new market", "Funding raised to grow demand"],
      deliverySignals: ["Open marketing / demand-gen req", "New campaign or channel build-out", "Growth push ahead of a raise"]
    },
    finance: {
      label: "Finance", leader: "finance leader",
      domain: "finance, FP&A and fundraising", plural: "finance talent",
      match: /\b(cfo|finance|fp&a|controller|accounting|treasur)\b/i,
      execSignals: ["CFO / finance-leadership gap", "Preparing to fundraise or post-raise cleanup", "Audit, M&A or scaling finance ops"],
      deliverySignals: ["Open FP&A / controller req", "Fundraise or board-reporting build-out", "Systems / ERP implementation"]
    },
    operations: {
      label: "Operations", leader: "operations leader",
      domain: "operations, process and scale", plural: "operations talent",
      match: /\b(coo|operations|ops\b|supply\s+chain|program\s+management|pmo)\b/i,
      execSignals: ["COO / ops-leadership gap", "Rapid scale straining process", "New facilities, geographies or lines"],
      deliverySignals: ["Open ops / program-management req", "Process or systems overhaul underway", "Scaling that needs hands-on ops"]
    },
    people: {
      label: "People & Talent", leader: "people leader",
      domain: "people, talent and culture", plural: "people / HR talent",
      match: /\b(chro|people|talent|hr\b|human\s+resources|recruit|l&d)\b/i,
      execSignals: ["Head of People / HR-leadership gap", "Rapid hiring straining the org", "Culture, retention or restructuring pressure"],
      deliverySignals: ["Open recruiter / people-ops req", "Hiring surge needing recruiting muscle", "HR systems or L&D build-out"]
    },
    data: {
      label: "Data & Analytics", leader: "data leader",
      domain: "data platform, analytics and ML", plural: "data talent",
      match: /\b(chief\s+data|data\s+(?:engineer|analyst|scien|lead)|head\s+of\s+data|\bdata\b|analytics|machine\s+learning|ml\b|ai\s+engineer)\b/i,
      execSignals: ["Head of Data / analytics-leadership gap", "Analytics or ML build-out", "Data platform or governance overhaul"],
      deliverySignals: ["Open data-engineer / analyst req", "New data-platform or ML initiative", "Analytics ramp ahead of a raise"]
    }
  };

  // A generic fallback so an unrecognised title still gets a coherent pack.
  var GENERIC_FN = {
    label: "Your function", leader: "leader in your function",
    domain: "your area of expertise", plural: "talent in your field",
    match: null,
    execSignals: ["Leadership gap in your function", "Funding raised and scaling fast", "Expansion into a new market or product"],
    deliverySignals: ["Open req for your exact skill", "Team scaling in your area", "New initiative that needs your expertise"]
  };

  var EXEC_RE = /\b(c[a-z]{1,3}o|chief|founder|co[\s-]?founder|vp|vice\s*president|svp|evp|head\s+of|director|partner|principal|advisor|fractional\s+(?:cxo|ceo|cfo|cro|cmo|cto|coo|chro)|gm|general\s+manager)\b/i;

  function detectFunction(title) {
    var t = title || "";
    for (var k in FUNCTIONS) {
      if (FUNCTIONS.hasOwnProperty(k) && FUNCTIONS[k].match && FUNCTIONS[k].match.test(t)) return FUNCTIONS[k];
    }
    return GENERIC_FN;
  }

  function detectLevel(title) {
    return EXEC_RE.test(title || "") ? "exec" : "delivery";
  }

  function knownTitle() {
    try {
      if (window.__SELLHI_USER__ && window.__SELLHI_USER__.title) return window.__SELLHI_USER__.title;
    } catch (e) {}
    var f = document.getElementById("p1-title");
    if (f && f.value) return f.value;
    var role = document.getElementById("sidebar-user-role");
    if (role && role.textContent && !/fractional\s*pro/i.test(role.textContent)) return role.textContent;
    return "";
  }

  // Derive the full pack (ICP + signals + message tone) from identity. This is
  // the object the Market Intel and Campaign modules read so the whole pipeline
  // follows the person's identity.
  function detectPack(title) {
    var t = title != null ? title : knownTitle();
    var fn = detectFunction(t);
    var level = detectLevel(t);
    var isExec = level === "exec";
    var icp = isExec
      ? [
          "Companies with no full-time " + fn.leader + " — the founder is still carrying " + fn.domain,
          "Recently funded firms scaling " + fn.domain + " faster than their bench",
          "Mid-market teams at a turning point in " + fn.domain
        ]
      : [
          "Companies actively hiring " + fn.plural + " — they need it now",
          "Teams ramping " + fn.domain + " (a build, launch or migration)",
          "Recently funded / scaling firms staffing up " + fn.plural
        ];
    var messages = isExec
      ? [
          "Peer-to-peer, outcome-first: “I’ve led " + fn.domain + " through this exact moment — here’s the first thing I’d look at.”",
          "Diagnostic hook tied to the signal, not a pitch",
          "One credible proof point per note — never a résumé dump"
        ]
      : [
          "Availability-forward, signal-referenced: “Saw you’re building out " + fn.domain + " — I can start fractionally this week.”",
          "Hands-on proof: “Shipped X in Y weeks on the same kind of work.”",
          "Low-friction ask — a 15-min fit call, not a contract"
        ];
    return {
      functionKey: fn === GENERIC_FN ? "generic" : (function () { for (var k in FUNCTIONS) if (FUNCTIONS[k] === fn) return k; return "generic"; })(),
      functionLabel: fn.label,
      level: level,
      label: "Fractional " + (isExec ? "" : "") + fn.label + (isExec ? " leader" : " pro"),
      blurb: isExec
        ? "Sell your " + fn.label.toLowerCase() + " leadership into companies at a turning point."
        : "Walk in first on " + fn.domain + " — at the right moment, with a reason.",
      icp: icp,
      signals: isExec ? fn.execSignals : fn.deliverySignals,
      messages: messages
    };
  }

  var STORE_KEY = "sh_persona";

  function currentKey() {
    try {
      var v = window.localStorage.getItem(STORE_KEY);
      if (v && PERSONAS[v] && PERSONAS[v].state === "live") return v;
    } catch (e) {}
    return "pro"; // only "pro" is live today, so it's the safe default
  }

  function setPersona(key, opts) {
    if (!PERSONAS[key]) return;
    window.__SELLHI_PERSONA__ = key;
    try { window.localStorage.setItem(STORE_KEY, key); } catch (e) {}
    // Best-effort persist to the dossier so the choice follows the account,
    // not the device. Never blocks the UI; silently no-ops without a session.
    if (!opts || opts.persist !== false) {
      try {
        fetch("/api/dossier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ persona: key })
        }).catch(function () {});
      } catch (e) {}
    }
  }

  // Expose a tiny API the signup flow / identity settings / engine modules call.
  window.SellHiPersona = {
    list: PERSONAS,
    current: function () { return PERSONAS[currentKey()]; },
    set: setPersona,
    functions: FUNCTIONS,
    // pack(title?) -> the identity-derived pack {functionKey, level, icp,
    // signals, messages}. Auto-detects from the signed-in user / onboarding
    // title when no argument is passed. The downstream engine reads this.
    pack: function (title) { return detectPack(title); }
  };

  // Seed the global immediately (default persona) without persisting.
  window.__SELLHI_PERSONA__ = currentKey();

  // ------------------------------------------------------------------------
  // UI: rename the live workspace + reserve the SellHi Exchange seat.
  // ------------------------------------------------------------------------
  function toast(kind, html) {
    if (typeof window.toast === "function") { window.toast(kind, html); return; }
  }

  function exchangeTeaser(e) {
    if (e) e.stopPropagation();
    var url = PERSONAS.exchange.early;
    var msg = "SellHi Exchange — where companies choose from proactively-marketed " +
      "fractional talent — is on the way. " +
      '<a href="' + url + '" target="_blank" rel="noopener" ' +
      'style="color:var(--primary);font-weight:700;text-decoration:none;">Get early access &rarr;</a>';
    if (typeof window.toast === "function") { toast("info", msg); return; }
    // Fallback card if the demo's toast isn't loaded.
    var el = document.createElement("div");
    el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "max-width:360px;background:#fff;border:1px solid #e5e7eb;border-left:4px solid #008080;" +
      "border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:14px 16px;" +
      "font-family:Raleway,sans-serif;font-size:13px;color:#1f2937;z-index:1000;";
    el.innerHTML =
      '<div style="font-weight:800;margin-bottom:4px;">SellHi Exchange</div>' +
      '<div style="color:#4b5563;line-height:1.5;">The client-choice marketplace is pre-launch. ' +
      'Grab a 20-min early-access call.</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;">' +
      '<a href="' + url + '" target="_blank" rel="noopener" ' +
      'style="background:#008080;color:#fff;text-decoration:none;font-weight:700;padding:6px 12px;border-radius:8px;">Get early access &rarr;</a>' +
      '<button style="background:#fff;border:1px solid #e5e7eb;color:#4b5563;padding:6px 12px;border-radius:8px;cursor:pointer;font-family:inherit;" ' +
      "onclick=\"this.closest('[role=status]').remove()\">Dismiss</button></div>";
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentElement) el.remove(); }, 9000);
  }
  window.shExchangeTeaser = exchangeTeaser;

  function renameLiveWorkspace() {
    var pro = PERSONAS.pro;

    // (a) Active option in the open menu.
    var active = document.querySelector(".ws-switcher .ws-opt.active-ws");
    if (active) {
      var aMark = active.querySelector(".ws-mark");
      var aName = active.querySelector(".ws-opt-name");
      var aMeta = active.querySelector(".ws-opt-meta");
      if (aMark) aMark.textContent = pro.mark;
      if (aName) aName.textContent = pro.name;
      if (aMeta) aMeta.textContent = pro.meta;
    }

    // (b) Current button (collapsed state).
    var btn = document.getElementById("wsCurrentBtn");
    if (btn) {
      var bMark = btn.querySelector(".ws-mark");
      var bName = btn.querySelector(".ws-name");
      var bType = btn.querySelector(".ws-type");
      if (bMark) bMark.textContent = pro.mark;
      if (bName) bName.textContent = pro.name;
      if (bType) bType.textContent = "Seller workspace";
    }

    // (c) User-bar role, if it still shows the old default (identity.js also
    // sets this from the real user; this is a belt-and-braces fallback).
    var role = document.getElementById("sidebar-user-role");
    if (role && /fractional\s*cxo/i.test(role.textContent || "")) {
      role.textContent = pro.name;
    }
  }

  function reserveExchangeSeat() {
    var menu = document.querySelector(".ws-switcher .ws-menu");
    if (!menu) return;
    if (menu.querySelector("[data-persona='exchange']")) return; // idempotent

    var ex = PERSONAS.exchange;
    var opt = document.createElement("div");
    opt.className = "ws-opt teaser";
    opt.setAttribute("role", "option");
    opt.setAttribute("aria-selected", "false");
    opt.setAttribute("tabindex", "0");
    opt.setAttribute("data-persona", "exchange");
    opt.addEventListener("click", exchangeTeaser);
    opt.addEventListener("keypress", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") exchangeTeaser(ev);
    });
    opt.innerHTML =
      '<div class="ws-mark" style="background:var(--g300);">' + ex.mark + "</div>" +
      '<div><div class="ws-opt-name">' + ex.name + "</div>" +
      '<div class="ws-opt-meta">' + ex.meta + "</div></div>" +
      '<span class="ws-soon">Pre-launch</span>';
    menu.appendChild(opt); // sits after the AxIncha teaser, seat reserved
  }

  // Soften the existing AxIncha teaser badge wording to match our house style
  // ("Pre-launch" everywhere), without touching its link/behaviour.
  function alignBadges() {
    var badges = document.querySelectorAll(".ws-switcher .ws-soon");
    for (var i = 0; i < badges.length; i++) {
      if (/coming\s*soon/i.test(badges[i].textContent || "")) {
        badges[i].textContent = "Pre-launch";
      }
    }
  }

  function paint() {
    try {
      renameLiveWorkspace();
      reserveExchangeSeat();
      alignBadges();
    } catch (e) {}
  }

  function run() {
    // Apply after the demo's own init, with a couple of safety re-applies in
    // case the sidebar renders late.
    setTimeout(paint, 350);
    setTimeout(paint, 1200);
    setTimeout(paint, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
