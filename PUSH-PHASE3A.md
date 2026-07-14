# Phase 3a — Real researched dossier (ready to push)

**What it does (analogy):** Phase 2 was a notebook that remembers your handwriting. Phase 3a hires a research assistant: when the user clicks **"Build my dossier"**, Claude actually searches the web, reads the company site, and fills the dossier with real findings — company, industry, headcount, positioning, a notable achievement — all in the exact same on-screen layout, and all editable.

Everything is built and **compiles cleanly**. No database change needed — Phase 2 already created the JSON slot that holds the research.

There are 3 setup steps (all done by you, so your API key stays private), then the push.

---

## Step 1 — Load credits + create an API key (Anthropic Console)

1. Go to **console.anthropic.com** → **Billing** → add **$25** (set a **$50 monthly cap**, turn auto-reload off — a hard ceiling).
2. Go to **API Keys** → **Create Key** → name it `sellhi-app` → **copy it** (starts `sk-ant-...`). Keep it somewhere safe for the next step. I never see this key.
3. Go to **Models** (or the docs) and **copy the exact model ID** of the Sonnet you want to use (e.g. the current Sonnet). You'll paste it in Step 2.

## Step 2 — Add 2 (or 3) settings in Vercel

In Vercel → your **sellhi-app** project → **Settings** → **Environment Variables**. Add:

| Name | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-...` key | the secret from Step 1 |
| `ANTHROPIC_MODEL` | the model ID from Step 1 | e.g. `claude-sonnet-4-5` — paste the exact one from your console |
| `RESEARCH_DAILY_CAP` | `5` | optional; per-user daily limit (defaults to 5 if omitted) |

Set each for **Production** (and Preview if asked). Save.

## Step 3 — Push the code

From `app-sellhi/`:

```
git add .
git commit -m "Phase 3a: real researched dossier via Claude + web search"
git push
```

Vercel auto-deploys in ~1–2 min. (Adding env vars sometimes needs one redeploy to take effect — the push covers that.)

---

## The live test (we do this together)

1. Hard-refresh app.sellhi.ai (Ctrl+Shift+R), go to Identity Engine Step 1.
2. Put in a **real** company + URL + your name (try AxIncha so we can judge accuracy).
3. Click **"Build my dossier →"**. The loading overlay stays up ~20–40s while Claude researches (longer than the old fake 5s — that's real work happening).
4. The dossier fills with **real** findings. Every field is still editable, and it saves to your account.

---

## Honest heads-up / what to watch

- **Timing:** real research takes 20–40s. I set the function limit to 60s. If it ever times out, we bump a Vercel setting (or plan) — quick fix.
- **Accuracy:** AI research is a strong *first draft*. For thin-web-presence companies it will hedge or say "Unknown" rather than invent — by design. The user confirms/edits before it's final.
- **Cost:** ~$0.20–$0.50 per run; the 5/day per-user cap + your $50 console ceiling keep it safe.
- **LinkedIn:** compliant — we use the LinkedIn URL as a hint and research the open web; we do not scrape LinkedIn.

## Files in this push
- `src/app/api/research/route.ts` — the research endpoint (Claude + web search, daily cap, saves result).
- `public/sellhi-research.js` — overrides the demo's fake loader to run real research and fill the dossier (demo.html untouched).
- `src/app/route.ts` — injects the new script.
