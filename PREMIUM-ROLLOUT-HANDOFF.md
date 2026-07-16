# Premium theme rollout + logo — review packet

Everything below is **staged, not pushed**. One clean push puts it all live; then we do a single QA pass together.

## The one push
From `app-sellhi/`:
```
del ".git\index.lock"
git add -A
git commit -m "Premium hybrid theme across all phases (light+dark) + Meeting Prep polish + logo concepts"
git push origin main
```

## What's in it
- **`public/sellhi-premium.css`** — now **app-wide** (every `.phase-section`, not just Market Intel), light + dark. Soft grouped cards (radius + whisper of shadow, calm border), flattened metric tiles with teal only on hero numbers, soft pill badges (with dark-mode legibility for every tier), teal-focus inputs, teal primary buttons with white labels, teal wizard dots + sliders, aligned help-tips. Market Intel keeps its clean company-list rows. Sidebar/topbar chrome untouched. Dark tokens reuse the demo's own neutrals so content blends with the dark chrome.
- **`public/meetings.html`** — cards get the same soft shadow + radius for consistency (kept all-regular weight as requested).
- **`public/logos/`** — four logo concepts as SVGs: `sellhi-a-ascent.svg`, `sellhi-b-reach.svg`, `sellhi-c-sglobe.svg`, `sellhi-d-network.svg` (drafts — geometry gets refined once you pick one).

Reversible: remove the `sellhi-premium.css` `<link>` in `src/app/route.ts` to revert the theme entirely.

## QA checklist (when you return — check each in BOTH light + dark)
Toggle the app theme switch and walk the phases:
- [ ] Identity Engine — cards soft, dossier readable, dark contrast fine
- [ ] Market Intel — Steps 1-5 (Continue label, tier badges dark, Step 4 "?" aligned)
- [ ] Smart Matching — match cards + score rings look right
- [ ] Connected Stack / Content Factory / Campaign Engine / Command Center / Learn & Optimize — cards, metrics, badges legible in dark
- [ ] Meeting Prep — cards match, still crisp
- [ ] Sidebar + topbar unchanged (intentional)

I built the rollout without live per-page QA (that needs your browser), so expect I may need to tune 1-2 phase-specific spots after you eyeball it — note anything off and I'll fix in a batch.

## Logo — your decision
Pick a direction (A / B / C / D). Recommendation: **A — Global ascent** (growth rising off the globe = "sales, up, everywhere", most instantly legible and professional). B (reach) is the strongest runner-up and ties to the "Hi". Once you pick, I'll refine that mark to final, produce the full set (light/dark, favicon, wordmark lockup), and wire it into the app.
