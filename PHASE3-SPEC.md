# Phase 3 — Real, researched dossier (spec)

**One-line goal:** Instead of only *remembering what you type* (Phase 2), the Identity Engine goes out, researches the person/company, and fills the dossier with real facts you can edit and save.

**Analogy:** Phase 2 is a notebook that remembers your handwriting. Phase 3 is hiring a research assistant who reads the notebook, goes digging, and comes back with a briefed one-pager.

---

## What the user experiences

1. User enters the basics in step 1 (name, company, company URL, LinkedIn URL, industries, deal size) — same fields as today.
2. They click a new **"Research my dossier"** button.
3. A short loading state ("Researching… ~30–60 sec").
4. The dossier populates with real findings, grouped the way AxIncha already works (per your standing rules): **revenue, headcount, recent news, tech stack, competitors, pain points.**
5. Every field is **editable** — the user corrects/approves, then it saves to their account (reusing Phase 2's locker).

Nothing about the exact demo look changes; this is new capability layered behind the same screen.

---

## What powers it (under the hood)

- **A new server endpoint** (`/api/research`) that takes the user's inputs and calls **Claude (Anthropic API)** with web search to gather and structure the findings.
- Results are saved into the `data` (JSON) column we already created in Phase 2's `dossiers` table — so **no new database migration** is needed. That column was built ahead for exactly this.
- The Claude API key lives **server-side only** (an environment variable in Vercel), never in the browser. You paste it once into Vercel; I never see it.

## The honest constraints (read these before we commit)

1. **LinkedIn has no clean, allowed API for pulling a person's profile.** Scraping it violates their terms and gets blocked. Realistic options:
   - **(a)** User pastes their LinkedIn text/URL and Claude works from the public company site + open web (free, good-enough, compliant). ← recommended start
   - **(b)** Add a paid enrichment vendor (e.g. a firmographics/contact API) later if you want deeper, structured company data. Costs per lookup.
2. **Cost:** each research run is a Claude API call (a few cents each). We'll add a simple guard (one run per user per day, or a button they trigger) so it can't run away.
3. **Accuracy:** AI research is a strong *first draft*, not gospel. That's why every field stays editable before saving — the human confirms.

## Suggested build order (each is a separate push)

- **3a — Web-research enrichment (recommended MVP):** the "Research my dossier" button, `/api/research` calling Claude + web, editable results saved to the existing table. Needs only your **Anthropic API key** in Vercel.
- **3b — Deeper firmographics (optional):** plug in a paid enrichment vendor for verified revenue/headcount/tech-stack. Decide later based on whether 3a's quality is enough.

## What I need from you to start 3a

1. Your **Anthropic API key** (you paste it into Vercel — I'll walk you through where).
2. A yes on the **compliant LinkedIn approach (option a)** to start.

---

**Rough effort:** 3a is a ~half-day build + a short live test loop with you (since it's behind login). Want me to go ahead and build 3a now so it's staged next to Phase 2, or hold until you've pushed Phase 2 and seen it working? Tell me and I'll line it up. Happy to expand any section into more detail.
