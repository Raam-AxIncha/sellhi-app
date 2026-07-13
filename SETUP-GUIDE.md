# SellHi — app.sellhi.ai · Phase 1 Setup Guide

**What Phase 1 gives you:** a real front door. Invited testers sign in (email + password,
Google, or Microsoft), and their own **Name / Fractional CXO** shows in the sidebar corner —
saved forever, surviving refreshes and return visits. The demo itself stays a byte-for-byte
copy of sellhi.ai; we only add the login gate and the real identity.

Everything below is free-tier. You only touch a few web dashboards — no coding.

---

## ✅ STATUS — already done together (2026-07-13)
- **Supabase project `sellhi`** created (org AxIncha Inc., region US East). URL + publishable key are in `.env.local`.
- **Database**: `profiles` table + row-level security + auto-profile trigger — applied.
- **Sign-in methods live**: Email/password, **Google**, and **Microsoft** — all enabled.
- **Redirect URLs** set: `http://localhost:3000/**` and `https://app.sellhi.ai/**`.
- Google OAuth app + Microsoft app registration created (Microsoft lives in its own dedicated `sellhiapp.onmicrosoft.com` directory, isolated from company IT). Microsoft secret valid until **July 2028**.

**Still to do:** (1) run the app (`npm run dev`) or deploy to Vercel; (2) before inviting testers, **publish the Google consent screen to production** (Google Cloud → Audience → Publish app) so any tester — not just you — can use Google sign-in; (3) point the `app.sellhi.ai` DNS at Vercel when deploying.

---

---

## The 5 things you set up (≈ 30–40 min, one time)

### 1. Create the free Supabase project (login + database)
1. Go to **supabase.com** → sign in → **New project**.
2. Name it `sellhi`, pick a region near your testers, set a database password (save it).
3. When it finishes, open **Project Settings → API**. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string)
4. Keep these two handy — you'll paste them in Step 5.

### 2. Create the database table (copy-paste, one click)
1. In Supabase, open **SQL Editor → New query**.
2. Open the file **`supabase/schema.sql`** (in this folder), copy everything, paste it in.
3. Click **Run**. You should see "Success." This creates the `profiles` table, locks it so
   each tester only ever sees their own row (row-level security), and auto-creates a profile
   whenever someone signs up.

### 3. Turn on Google sign-in
1. In Supabase: **Authentication → Providers → Google → Enable**.
2. It shows a **Redirect URL** — copy it.
3. In **Google Cloud Console** (console.cloud.google.com) → **APIs & Services → Credentials →
   Create OAuth client ID → Web application**. Under *Authorized redirect URIs*, paste the URL
   from step 2. Copy the **Client ID** and **Client Secret** it gives you.
4. Paste those back into Supabase's Google provider box → **Save**.

### 4. Turn on Microsoft sign-in
1. In Supabase: **Authentication → Providers → Azure → Enable**. Copy its **Redirect URL**.
2. In **Microsoft Entra / Azure Portal** → **App registrations → New registration**. Add the
   redirect URL as a **Web** platform redirect. Create a **client secret**.
3. Copy the **Application (client) ID** and the **secret value** into Supabase's Azure box → **Save**.

> Google + Microsoft each take ~10 min the first time. If you'd rather, I can walk you through
> these two screens live and click along with you — just ask.

### 5. Add your keys and the sign-in web addresses
1. In this folder, copy **`.env.local.example`** to a new file named **`.env.local`**.
2. Paste your two Supabase values from Step 1:
   ```
   NEXT_PUBLIC_SUPABASE_URL=... (your Project URL)
   NEXT_PUBLIC_SUPABASE_ANON_KEY=... (your anon public key)
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
3. In Supabase **Authentication → URL Configuration**, add these **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (for testing on your machine)
   - `https://app.sellhi.ai/auth/callback` (for the live site)

That's it for accounts. The keys stay **server-side / in env files** — never shipped to the
browser. This is the secure, standard way; we never hand-roll passwords.

---

## Run it on your computer (optional test before going live)
```
cd app-sellhi
npm install
npm run dev
```
Open **http://localhost:3000** → you'll hit the login page → create an account → you land in the
workspace with your name in the corner.

---

## Go live at app.sellhi.ai (when ready)
1. Push this `app-sellhi` folder to a **new GitHub repo** (separate from `sellhi-module1`).
2. In **Vercel → New Project**, import that repo. Add the same three env vars
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL=https://app.sellhi.ai`).
3. In Vercel, add domain **app.sellhi.ai**; at **GoDaddy**, add the CNAME Vercel shows you.
4. Deploy. Testers go to **app.sellhi.ai**, sign in, and use it for real.

---

## The exact demo file — DONE ✅
`public/demo.html` is now the **real, byte-for-byte** live file (343,170 bytes, MD5-verified
against the tip of `main` in `sellhi-module1`). It's served at the web root behind login, so
every asset path resolves exactly as on sellhi.ai. The identity injection is pinned to the real
corner (`#sidebar-user-name`, `#sidebar-user-role`, `#sidebar-avatar`) and the sidebar "Log out"
now performs a real sign-out.

Assets copied in: `time-invoicing.js`, `sellhi-voice-clips.js` (both match live).

**Still pending (optional, cosmetic/bonus):** the 4 music tracks (`public/music/track1–4.mp3`,
for the "Music Maniacs" tab) and favicons / `og-image.png`. When you want those, ask the Deploy
Control chat to hand them over and I'll drop them in. Login, identity, and the core app work
without them.

---

## What's built and working
- Login / signup: **email + password, Google, Microsoft** (Supabase Auth).
- Session handling + a login wall (middleware) so only signed-in testers get in.
- `profiles` table with **row-level security** (each tester sees only their own data).
- Auto-profile on signup; the corner shows the **real** logged-in Name / Title.
- Sign-out wired up.
- Clean production build verified.
