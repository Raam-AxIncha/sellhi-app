# Phase 2 — Ready to push (remember your details)

**What this does (analogy):** Right now the Identity Engine is like a hotel whiteboard — you write on it, but the cleaner wipes it each night. Phase 2 gives each user their own locker: what they type is saved to their account and is waiting for them next time they log in.

Everything is built and the app **compiles cleanly**. Two steps, in this order.

---

## Step 1 — Create the storage locker in Supabase (one time)

1. Open Supabase → your project → **SQL Editor** → **New query**.
2. Open the file `app-sellhi/supabase/phase2-dossier.sql`, copy all of it, paste, **Run**.
3. You should see "Success." (Safe to run twice — it won't duplicate anything.)

This makes a private `dossiers` table where each row is locked to one user (row-level security), so nobody can read anyone else's.

## Step 2 — Push the code

From `app-sellhi/`:

```
git add .
git commit -m "Phase 2: persist Identity Engine inputs per user"
git push
```

Vercel auto-deploys in ~1–2 minutes. No new environment variables needed.

---

## What changed (files)

- `supabase/phase2-dossier.sql` — the new per-user table + security rules.
- `src/app/api/dossier/route.ts` — save/load endpoint (GET loads your saved fields, POST saves them).
- `public/sellhi-onboarding.js` — quietly fills your Identity Engine step-1 fields on load, and saves as you type. If anything's missing it does nothing — the demo behaves exactly as before.
- `src/app/route.ts` — injects that script; also tells the demo you're already signed in (skips its old login pop-up).

## After it's live — the 60-second test (we do this together)

1. Log in, go to Identity Engine step 1, type your Name / Title / Company / URLs, click continue.
2. **Refresh the page.** Your entries should reappear — proof they're saved to your account.

If they come back, Phase 2 is done.

---

## Important: what Phase 2 is NOT

You asked earlier why the dossier didn't show your *real* researched details and whether we'd "connected LinkedIn and Claude." That's **Phase 3**, a separate build: it needs your **Anthropic (Claude) API key** and a live research loop to go fetch and enrich real data. Phase 2 only *remembers what you type* — that's the honest scope. Say the word and I'll spec Phase 3 next.
