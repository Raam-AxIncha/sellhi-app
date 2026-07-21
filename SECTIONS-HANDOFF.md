# SellHi — "Side-by-side, one-section-at-a-time" (#8 prototype + #9 rollout plan)

**Status:** #8 prototype **built, tested, and ready for your review.** #9 is **not applied yet** — it waits for your approval of the pattern (as you asked).

---

## 1. What I built (the analogy first)

Think of each long wizard page as a **filing cabinet**. Today the whole drawer is dumped on the desk at once, so you scroll past everything to find one folder. The new module keeps the drawer shut and hands you **one folder at a time**, sliding left-to-right. A row of numbered tabs across the top lets you jump to any folder; "Previous / Next" flips between them. The page's own "Back / Continue" buttons stay exactly where they were.

Concretely, on **Identity Engine steps 2, 3, 4** the content is now split into labelled sections shown one at a time:

- **Step 2 (Your Dossier):** The Practice · Your Seat · Experience · Achievement · Positioning · Confidence
- **Step 3 (Confirm & Deepen):** Industries · Deal Size · Engagement · Stages · Statements · Strategic Q
- **Step 4 (Your Positioning):** Positioning · Capability · Scores · Next Steps

Scrolling on these pages drops from a full wall to just what one section needs.

## 2. What to look at (after you push — see §5)

1. Go to **Identity Engine**, click **Build my dossier** to reach Step 2.
2. You should see the **intro at top**, then a **horizontal numbered stepper**, then **one section** in a card that resizes to fit it, then **Previous · "N of 6" · Next**, and finally your **original Back / "Looks right — let me deepen"** buttons unchanged.
3. Click **Next** / the numbered tabs — sections slide side-to-side; done ones get a teal check, the current one a teal ring.
4. Repeat on **Step 3** and **Step 4**.
5. Toggle **dark mode** — text stays legible (uses the `--sh-*` tokens).
6. Two screenshots of the working prototype are attached in the chat.

## 3. How it's built (and why it's safe)

- **New files only** + one small injection line: `public/sellhi-sections.js`, `public/sellhi-sections.css`, and a 2-line add to `src/app/route.ts`. **`demo.html` is untouched** (byte-for-byte in sync with sellhi.ai).
- **Reversible.** The module only *moves* existing page elements into wrappers; it can put them all back in original order. Turn it off live in the browser console with `__shSections.disable()` — the page returns to the classic long-scroll. Nothing is copied out of or written into `demo.html`.
- **Resilient to the OneDrive revert issue.** Sections are found by their **text/CSS signals** (e.g. "The Practice", the strategic-question block), **not by line/position**. So even a slightly older `demo.html` still splits correctly, and any section it can't find is simply skipped — it never errors or blanks the page.
- **Declarative.** All the per-page logic lives in one `PLANS` map at the top of the JS. Adding a page = adding one entry. No engine changes.

## 4. Verification already done

- `node --check sellhi-sections.js` → clean.
- CSS brace-balance → 36 / 36 balanced.
- **Segmentation test (jsdom)** against the real demo markup → all 3 steps split into the exact expected sections; wizard buttons preserved; **reverse/restore returns the DOM identically** (5 dossier sections → 5).
- **Browser render test (Chromium)** → Next advances the track horizontally (`translateX -100% / -200%`), the card height adapts per section (240→152→178px), the "N of 6" counter updates, **zero page errors**.

## 5. Safe-push routine (you run all git — copy/paste)

Two brand-new files and one edited file. Order:

1. **Pause OneDrive** (system tray → OneDrive → Pause syncing → 2 hours).
2. I write the 3 files to disk via `device_commit_files` (force). *(Done when you see my "committed" note.)*
3. **Verify** the files landed — paste each line in a terminal at the repo root
   (`...\SellHi\2-Targeted-Build\app-sellhi`):

   ```
   findstr /C:"one-section-at-a-time" public\sellhi-sections.js
   findstr /C:"sh-sec-track" public\sellhi-sections.css
   findstr /C:"sellhi-sections.js" src\app\route.ts
   findstr /C:"sellhi-sections.css" src\app\route.ts
   ```

   Each should print a matching line. If any prints nothing, tell me — OneDrive likely reverted it and I'll rewrite before you commit.
4. **Commit & push:**

   ```
   git add -A
   git commit -m "feat(#8): side-by-side one-section-at-a-time layout for Identity Engine steps 2-4 (reversible app-layer module)"
   git push
   ```
5. **Resume OneDrive.** Vercel redeploys on push; hard-refresh `app.sellhi.ai` (Ctrl+F5).

---

## 6. #9 rollout plan (apply AFTER you approve #8)

Same module, same pattern — each page below is **one new `PLANS` entry** keyed by its sub-step id, plus (only where noted) a tiny tweak. No new engine, no `demo.html` edits. I'll do these in phase order.

| # | Phase | Target | How it segments | Notes / special handling |
|---|-------|--------|-----------------|--------------------------|
| 1 | **p2 Market Intel** | step 3 | one section per intel block | straightforward — mirror p1-s1 |
| 2 | **p3 Smart Matching** | step 1 | one section per match group | straightforward |
| 3 | **p5 Content Factory** | signal sections: **signals, funding, hiring, leadership, product** | one section per signal type | **funding/hiring/leadership/product have no data yet** — I'll render those as clearly-labelled "no signal yet" panels so the stepper is complete but honest |
| 4 | **p6 Campaign Engine** | dashboard + A/B testing | dashboard tiles as sections; A/B as its own section set | verify drag-and-drop (`initDragAndDrop`) still binds after re-flow — I'll re-test |
| 5 | **p7 Command Center** | make the **funnel narrower** and align the rest beside it | funnel + side panels | this one is **side-by-side layout**, not just a stepper — narrow the funnel, place metrics/next-actions in the adjacent column |
| 6 | **p8 Learn & Optimize** | the tabbed content | one section per optimize block | uses `p8Tab()` tabs — I'll make the module cooperate with existing tabs, not fight them |
| 7 | **Operations** | operations page | one section per ops group | confirm exact sub-step id on the live build |
| 8 | **Timesheet & Invoices** | `time-invoicing.js` view | one section per block | this view is built by `time-invoicing.js`, not static demo markup — I'll confirm the DOM hooks first |

**Rollout order I recommend:** the "clean" stepper pages first (p2 s3, p3 s1, p5 signals, p8) to build momentum, then the two that need bespoke handling (**p7 Command Center** side-by-side funnel, **p6** drag-and-drop, **Timesheet**). Each ships as its own `PLANS` entry with its own findstr + push, so any single page can be reverted independently.

**Open items I'll confirm on the live build before touching #9:** exact sub-step ids for Operations and Timesheet, whether Command Center's funnel is inline SVG vs. a canvas (affects the "narrower" approach), and re-testing p6 drag-and-drop after re-flow.

**Want more detail on any page's approach?** Say the word and I'll spec it before building.
