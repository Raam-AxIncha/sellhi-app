# Meetings & Prep — module spec + build handoff

**Analogy:** SellHi already helps you *find and message* prospects. This module walks into the room *with* you — it knows the meeting's on your calendar, hands you a prep sheet built from your dossier, lets you scribble live notes, and (once wired) captures the transcript.

**Locked decisions (from Raam):** Transcripts → **Fireflies**. Common connections → **Common Room**. UI → **safe consistency pass**. Calendar → **both Google + Microsoft**. Raleway throughout; `demo.html` stays pristine; Meetings is a **separate route** (`/meetings`).

---

## Status at a glance

| Piece | State | Needs you |
|---|---|---|
| Meeting Prep workspace (`/meetings`) | **Built + compiles** | Push |
| Prep notes (autosave) | **Built + compiles** | DB migration + push |
| Scribble / live-notes pad | **Built + compiles** | DB migration + push |
| TCP dossier context (reuses Phase 3a) | **Built** | Push |
| Sidebar "Meeting Prep" link + UI polish | **Built** | Push |
| Database schema | **Written** | Apply migration in Supabase |
| Calendar connect (Google + Microsoft OAuth) | **Code to the seam** | Register OAuth apps + env vars |
| Calendar event **sync** (fill the meetings list) | **Built + compiles** | Same OAuth env vars |
| Transcript (Fireflies) | **Scaffold** | API key + refine mapping |
| Common connections (Common Room) | **Scaffold** | API key + confirm endpoint |

**Everything compiles** (7 API/page routes transpile clean; 2 client scripts pass syntax check). Nothing here touches the live Identity Engine or Market Intel flows — it's all additive.

---

## What works the moment you push (no credentials needed)

The whole **prep** experience runs on your own database only:

- A new **Meeting Prep** item in the sidebar → opens `/meetings`.
- Click **"+ Prep a company"**, name any prospect, and you get a prep sheet.
- **TCP dossier** tab shows *your* positioning (pulled from your saved Phase 3a dossier).
- **Prep notes** tab: a notepad that **autosaves** to your account as you type.
- **Scribble** tab: a canvas to draw/handwrite or type notes with mouse, finger, or stylus — **autosaves** too.
- Calendar / Transcript / Common-connections show honest **"Connect …"** states until their keys are set.

---

## Architecture (files added)

**Client / UI**
- `public/meetings.html` — the workspace shell (Raleway, self-contained styles).
- `public/sellhi-meetings.js` — list, prep notes autosave, scribble canvas, graceful connect states.
- `public/sellhi-nav.js` — injects the "Meeting Prep" sidebar link (demo stays pristine).
- `public/sellhi-overrides.css` — safe consistency pass appended (focus rings, nav motion).

**Server routes**
- `src/app/meetings/route.ts` — serves the page to signed-in users.
- `src/app/api/prep-notes/route.ts` — GET/POST notes + scribble (fully working).
- `src/app/api/meetings/route.ts` — connection status + meetings list (+ manual add).
- `src/app/api/calendar/[provider]/start/route.ts` + `…/callback/route.ts` — Google/Microsoft OAuth.
- `src/app/api/transcripts/route.ts` — Fireflies (env-gated).
- `src/app/api/common-connections/route.ts` — Common Room (env-gated).

**Database**
- `supabase/meetings-module.sql` — `calendar_connections`, `meetings`, `prep_notes`, `transcripts` (all row-level-secured to the owner).

---

## Your punch-list (the human-only steps)

### 1. Apply the database migration (2 min)
Supabase → **SQL Editor** → New query → paste all of `supabase/meetings-module.sql` → **Run**. (Safe to re-run.)

### 2. Push the code
From `app-sellhi/`: `git add . && git commit -m "Meetings & Prep module" && git push`. Vercel auto-deploys. **Prep notes + scribble are now live.**

### 3. Calendar — Google (≈15 min, optional)
Google Cloud Console → create/select a project → **APIs & Services**:
- Enable **Google Calendar API**.
- **OAuth consent screen**: External; add yourself as a **test user** (avoids the verification wait for the pilot).
- **Credentials → Create OAuth client ID → Web application**. Authorized redirect URI: `https://app.sellhi.ai/api/calendar/google/callback`.
- Copy the **Client ID + Secret** → Vercel env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 4. Calendar — Microsoft (≈15 min, optional)
Azure Portal → **App registrations → New registration**:
- Redirect URI (Web): `https://app.sellhi.ai/api/calendar/microsoft/callback`.
- **API permissions** → Microsoft Graph → Delegated → **Calendars.Read** (+ `openid`, `email`, `offline_access`).
- **Certificates & secrets** → new client secret.
- Copy **Application (client) ID + Secret** → Vercel env: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.

### 5. Fireflies (≈5 min, optional)
Fireflies → Settings → **Developer/API** → copy API key → Vercel env: `FIREFLIES_API_KEY`.

### 6. Common Room (≈5 min, optional)
Authorize Common Room / get an API key → Vercel env: `COMMON_ROOM_API_KEY`. (One code tweak needed to map its response — see Limitations.)

Redeploy after adding env vars. **These are safety-gated actions (accounts, secrets, OAuth consent) that only you should do — I can't and won't.**

---

## Known limitations / the next increment

1. **Calendar event sync is built** (`/api/calendar/sync`): refreshes the access token if expired, pulls the next 30 days of events from each connected provider, and upserts them into `meetings`. The client runs it automatically on page load once a calendar is connected. Optional later hardening: a scheduled/webhook refresh so the list updates without opening the page.
2. **Fireflies → meeting mapping** currently returns the latest transcript as a starting point; matching a transcript to the *right* meeting (by date/title) is a refinement.
3. **Common Room** response mapping is stubbed (returns empty rather than inventing people) until the exact endpoint is confirmed against your workspace. **No LinkedIn scraping** — compliant by design.
4. **Recording consent:** before Fireflies auto-joins calls, add a consent notice (some jurisdictions require it). Flagged for the go-live checklist.
5. **Token encryption:** OAuth tokens are RLS-protected (owner-only). Encrypting them at rest is a hardening step for later.

---

## Suggested push order
1. **Now:** migration + push → prep notes + scribble + dossier context live.
2. **When you have 30 min:** Google + Microsoft OAuth env → calendar *connect* works; then build the sync increment.
3. **Then:** Fireflies key → transcripts; Common Room key + mapping → common connections.
