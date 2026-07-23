/*
 * SellHi — Connect billing widget (app-layer; demo.html untouched).
 *
 * Adds the real "Subscribe" + "Manage billing" actions to the /connect Plans
 * surface, wired to Stripe Checkout (subscription mode) and the Stripe Billing
 * Portal. Self-contained: it reads the currently selected tier from the existing
 * tier cards (#tiers .tier.on) and does NOT touch connect.html's inline logic.
 *
 * Endpoints:
 *   POST /api/stripe/checkout { plan, interval } -> { url }
 *   POST /api/stripe/portal                       -> { url }
 *
 * Nothing charges until STRIPE_SECRET_KEY + price ids are set (TEST mode first);
 * before then the endpoints return a clear message which this widget surfaces.
 */
(function () {
  "use strict";

  var TEAL = "#008080", TEAL_INK = "#0f6e56", ORANGE = "#FF6600";
  var interval = "monthly"; // "monthly" | "annual"

  // Display name (from the tier card) -> plan key used by the API. Order matters:
  // "Scale · Managed" must match before "Scale".
  function planFromName(nm) {
    var n = (nm || "").toLowerCase();
    if (n.indexOf("managed") >= 0) return "scaleManaged";
    if (n.indexOf("scale") >= 0) return "scale";
    if (n.indexOf("growth") >= 0) return "growth";
    if (n.indexOf("seed") >= 0) return "seed";
    if (n.indexOf("scout") >= 0) return "scout";
    if (n.indexOf("enterprise") >= 0) return "enterprise";
    return null;
  }
  function selectedTierName() {
    var on = document.querySelector("#tiers .tier.on .nm");
    return on ? on.textContent.trim() : "";
  }
  function selectedPlan() {
    return planFromName(selectedTierName());
  }

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function status(msg, color) {
    var s = document.getElementById("sh-bill-status");
    if (!s) return;
    s.textContent = msg || "";
    s.style.color = color || "var(--ink2,#5b6875)";
  }

  function build() {
    if (document.getElementById("sh-billing")) return;
    var anchor = document.querySelector(".costbar");
    if (!anchor || !anchor.parentNode) return;

    var wrap = el(
      "div",
      "font-family:'Raleway',inherit;border:1.5px solid " + TEAL +
        ";border-radius:16px;padding:16px 18px;margin:16px 0 4px;background:rgba(0,128,128,.04)"
    );
    wrap.id = "sh-billing";

    var head = el(
      "div",
      "display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between"
    );
    var title = el(
      "div",
      "font-weight:800;font-size:15px;color:var(--ink,#12302e)",
      "Activate this plan"
    );

    // Monthly / Annual toggle
    var toggle = el("div", "display:inline-flex;border:1px solid " + TEAL +
      ";border-radius:999px;overflow:hidden;font-size:12.5px;font-weight:700");
    var bMonthly = el("button", segCss(true), "Monthly");
    var bAnnual = el("button", segCss(false), "Annual · save ~2 mo");
    bMonthly.type = "button"; bAnnual.type = "button";
    function setInterval(v) {
      interval = v;
      bMonthly.style.cssText = segCss(v === "monthly");
      bAnnual.style.cssText = segCss(v === "annual");
      render();
    }
    bMonthly.onclick = function () { setInterval("monthly"); };
    bAnnual.onclick = function () { setInterval("annual"); };
    toggle.appendChild(bMonthly); toggle.appendChild(bAnnual);

    head.appendChild(title);
    head.appendChild(toggle);

    var actions = el("div", "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:13px");
    var subBtn = el("button", primaryCss(), "Subscribe");
    subBtn.type = "button"; subBtn.id = "sh-subscribe";
    subBtn.onclick = onSubscribe;

    var portal = el("button", linkCss(), "Manage billing");
    portal.type = "button"; portal.id = "sh-portal";
    portal.onclick = onPortal;

    actions.appendChild(subBtn);
    actions.appendChild(portal);

    var statusLine = el("div", "font-size:12.5px;margin-top:10px;min-height:16px", "");
    statusLine.id = "sh-bill-status";

    var legend = el(
      "div",
      "font-size:11.5px;color:var(--ink3,#8a97a3);margin-top:6px",
      "Secure recurring payment via Stripe. Cancel anytime from Manage billing."
    );

    wrap.appendChild(head);
    wrap.appendChild(actions);
    wrap.appendChild(statusLine);
    wrap.appendChild(legend);

    // Insert right after the cost bar.
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);

    // Re-render the CTA whenever the selected tier changes.
    var tiers = document.getElementById("tiers");
    if (tiers) {
      tiers.addEventListener("click", function () { setTimeout(render, 0); });
      try {
        var mo = new MutationObserver(function () { render(); });
        mo.observe(tiers, { attributes: true, subtree: true, attributeFilter: ["class"] });
      } catch (e) {}
    }

    render();
    reflectCheckoutResult();
  }

  function segCss(on) {
    return "border:none;cursor:pointer;font-family:inherit;font-weight:700;font-size:12.5px;padding:7px 13px;" +
      (on ? ("background:" + TEAL + ";color:#fff") : "background:transparent;color:" + TEAL_INK);
  }
  function primaryCss(disabled) {
    return "font-family:inherit;font-weight:700;font-size:13.5px;padding:10px 20px;border-radius:10px;border:none;" +
      (disabled
        ? "background:#c7d2cf;color:#fff;cursor:not-allowed"
        : "background:" + TEAL + ";color:#fff;cursor:pointer");
  }
  function linkCss() {
    return "font-family:inherit;font-weight:700;font-size:13px;padding:9px 14px;border-radius:10px;cursor:pointer;" +
      "background:transparent;border:1px solid " + TEAL + ";color:" + TEAL_INK;
  }

  function render() {
    var btn = document.getElementById("sh-subscribe");
    if (!btn) return;
    var plan = selectedPlan();
    var name = selectedTierName() || "this plan";

    if (plan === "scout") {
      btn.textContent = "Included free";
      btn.disabled = true;
      btn.style.cssText = primaryCss(true);
      status("Scout is a free preview — no payment needed.", TEAL_INK);
      return;
    }
    if (plan === "enterprise") {
      btn.textContent = "Talk to sales";
      btn.disabled = false;
      btn.style.cssText = primaryCss(false);
      status("Enterprise is custom-priced. Subscribe opens an email to our team.", "var(--ink2,#5b6875)");
      return;
    }
    if (!plan) {
      btn.textContent = "Select a plan above";
      btn.disabled = true;
      btn.style.cssText = primaryCss(true);
      status("", "");
      return;
    }
    // Paid, checkout-able tier.
    btn.disabled = false;
    btn.style.cssText = primaryCss(false);
    btn.textContent = "Subscribe · " + (interval === "annual" ? "Annual" : "Monthly");
    status("Selected: " + name + " — billed " + (interval === "annual" ? "yearly" : "monthly") + ".", "var(--ink2,#5b6875)");
  }

  function onSubscribe() {
    var plan = selectedPlan();
    if (plan === "scout") return;
    if (plan === "enterprise") {
      window.location.href =
        "mailto:raam@axincha.com?subject=SellHi%20Enterprise%20enquiry&body=I%27d%20like%20to%20talk%20about%20SellHi%20Enterprise.";
      return;
    }
    if (!plan) { status("Pick a plan above first.", ORANGE); return; }

    var btn = document.getElementById("sh-subscribe");
    if (btn) { btn.disabled = true; btn.textContent = "Starting checkout…"; }
    status("Redirecting to secure Stripe checkout…", "var(--ink2,#5b6875)");

    fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan: plan, interval: interval }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.url) {
          window.location.href = res.j.url;
        } else {
          var m = (res.j && (res.j.detail || res.j.error)) || "Could not start checkout.";
          status(m, ORANGE);
          if (btn) { btn.disabled = false; }
          render();
        }
      })
      .catch(function () {
        status("Network error starting checkout. Try again.", ORANGE);
        if (btn) { btn.disabled = false; }
        render();
      });
  }

  function onPortal() {
    status("Opening billing portal…", "var(--ink2,#5b6875)");
    fetch("/api/stripe/portal", { method: "POST", credentials: "include" })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.url) {
          window.location.href = res.j.url;
        } else {
          var m = (res.j && (res.j.detail || res.j.error)) || "No billing account yet.";
          status(m, ORANGE);
        }
      })
      .catch(function () { status("Network error opening portal. Try again.", ORANGE); });
  }

  // Friendly note after returning from Stripe Checkout.
  function reflectCheckoutResult() {
    try {
      var q = new URLSearchParams(location.search);
      var c = q.get("checkout");
      if (c === "success") {
        status("Payment received — your plan updates within a few seconds.", TEAL_INK);
      } else if (c === "cancel") {
        status("Checkout canceled — no charge was made.", "var(--ink2,#5b6875)");
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
