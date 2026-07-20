/*
 * SellHi — first-run welcome (app-layer; demo.html stays pristine).
 * On a user's FIRST visit to the app root, show one focused screen:
 *   • the positioning tagline as hero,
 *   • the 5-chapter racing spine (so the 8 modules read as one story), and
 *   • ONE primary CTA -> start the path to their first 5 opportunities.
 * Shows once per device (localStorage flag). Never blocks: "Skip the intro"
 * and Esc both dismiss. Reuses the animated logo mark (SHLogo) for continuity.
 */
(function () {
  var KEY = "sellhi_welcomed_v1";
  try { if (localStorage.getItem(KEY) === "1") return; } catch (e) { /* storage blocked -> still show once this load */ }

  var SPINE = [
    { n: "1", t: "Your Engine", s: "who you are + your ICP" },
    { n: "2", t: "Your Track", s: "the market that fits" },
    { n: "3", t: "Full Throttle", s: "reach out at scale" },
    { n: "4", t: "Victory Lap", s: "learn & optimise" },
    { n: "5", t: "Get Paid", s: "close and invoice" }
  ];

  function style() {
    if (document.getElementById("sh-welcome-style")) return;
    var s = document.createElement("style");
    s.id = "sh-welcome-style";
    s.textContent =
      '#sh-welcome{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:24px;' +
        'background:radial-gradient(120% 120% at 50% 0%,#0b3b38 0%,#08283a 55%,#061a2b 100%);' +
        'opacity:0;transition:opacity .35s ease;font-family:\'Raleway\',system-ui,sans-serif;}' +
      '#sh-welcome.on{opacity:1;}' +
      '.shw-card{max-width:660px;width:100%;text-align:center;color:#eaf5f2;}' +
      '.shw-brand{display:inline-flex;align-items:center;gap:9px;margin-bottom:22px;}' +
      '.shw-brand .sh-mark{width:44px;height:44px;overflow:visible;}' +
      '.shw-brand .w{font-size:26px;font-weight:700;letter-spacing:-.4px;color:#fff;position:relative;}' +
      '.shw-brand .w sup{font-size:.5em;color:#F26A21;vertical-align:super;margin-left:1px;}' +
      '.shw-tag{font-size:31px;line-height:1.12;font-weight:700;letter-spacing:-.6px;margin:0 0 12px;color:#fff;}' +
      '.shw-tag em{font-style:normal;color:#4fe0cf;}' +
      '.shw-sub{font-size:15px;color:#bfe0da;margin:0 auto 26px;max-width:520px;}' +
      '.shw-spine{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:0 0 30px;}' +
      '.shw-step{flex:1;min-width:110px;max-width:130px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:12px 10px;}' +
      '.shw-step .b{width:24px;height:24px;border-radius:50%;background:#F26A21;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;}' +
      '.shw-step .t{font-size:13px;font-weight:700;color:#fff;}' +
      '.shw-step .s{font-size:11px;color:#a9cfc8;margin-top:3px;line-height:1.35;}' +
      '.shw-cta{background:#00a99a;color:#fff;border:none;font-family:inherit;font-weight:700;font-size:16px;padding:14px 26px;border-radius:12px;cursor:pointer;box-shadow:0 8px 24px rgba(0,169,154,.35);transition:transform .1s ease,background .15s ease;}' +
      '.shw-cta:hover{background:#00bfae;transform:translateY(-1px);}' +
      '.shw-skip{display:block;margin:16px auto 0;background:none;border:none;color:#8fb9b2;font-family:inherit;font-size:13px;cursor:pointer;text-decoration:underline;}' +
      '@media(max-width:560px){.shw-tag{font-size:24px;}.shw-step{min-width:44%;}}' +
      '@media(prefers-reduced-motion:reduce){#sh-welcome{transition:none;}}';
    document.head.appendChild(s);
  }

  function dismiss(go) {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    var el = document.getElementById("sh-welcome");
    if (el) { el.classList.remove("on"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }
    document.removeEventListener("keydown", onKey);
    if (go) { try { if (typeof window.showPhase === "function") window.showPhase("p1"); } catch (e) {} }
  }
  function onKey(e) { if (e.key === "Escape") dismiss(false); }

  function show() {
    if (document.getElementById("sh-welcome")) return;
    style();
    var markSvg = (window.SHLogo && window.SHLogo.mark) ? window.SHLogo.mark() : "";
    var steps = SPINE.map(function (x) {
      return '<div class="shw-step"><div class="b">' + x.n + '</div><div class="t">' + x.t + '</div><div class="s">' + x.s + '</div></div>';
    }).join("");
    var el = document.createElement("div");
    el.id = "sh-welcome";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Welcome to SellHi");
    el.innerHTML =
      '<div class="shw-card">' +
        '<div class="shw-brand">' + markSvg + '<span class="w">Sell<sup>Hi</sup></span></div>' +
        '<h1 class="shw-tag">You’re paying for <em>opportunities surfaced</em>,<br>not software rented.</h1>' +
        '<p class="shw-sub">SellHi runs your outbound as one loop — from who you are to who to sell, reach-out, and results. Here’s the whole track:</p>' +
        '<div class="shw-spine">' + steps + '</div>' +
        '<button class="shw-cta" id="shw-go">Find my first 5 opportunities &#8594;</button>' +
        '<button class="shw-skip" id="shw-skip">Skip the intro</button>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("on"); });
    document.getElementById("shw-go").onclick = function () { dismiss(true); };
    document.getElementById("shw-skip").onclick = function () { dismiss(false); };
    document.addEventListener("keydown", onKey);
  }

  function boot() {
    // Let the app paint behind us first, then present the welcome once.
    setTimeout(show, 600);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
