# Iris improvement record

Continuous improvement cycles for Iris. One area per cycle. Each entry names the defect evidence, the fix, the screenshot pair and the played run. Screenshot files live outside the repository in `scratch/iris-evidence/cycle-N/` and are not committed; binaries never enter the tree.

Covered areas: UI readability (cycle 1).

## Cycle 1 — 2026-11-07 — UI readability: field-guide mixing key

**Find.** The field guide ended with a decorative row of 13 color discs. It carried no text, no labels and no plus or equals signs, and it was `aria-hidden`, so the help dialog never taught the mixing rules it was meant to teach. Measured at 1440x900 with the dialog open: `.mix-row` had `textContent: ""` and 13 child discs (`before-help-1440.png`). On a 320x568 viewport the modal also opened scrolled to its bottom button (`scrollTop: 275`, heading at `-204px`) and the row overflowed horizontally.

**Analyze.** Survivors:
1. Replace the unlabeled row with four labeled equations that reuse the existing beam tokens and are meaningful to screen readers.
2. Keep the equations inside the dialog at 320px wide.
3. Open the guide at its heading so the title and first rules are visible on short screens.
Dead ends: none; the row was reproduced in the served page and the measurements above are from that build.

**Implement.** `index.html` now renders a `Mixing light` key with four `mix-line` equations; `src/styles.css` lays them out in one column, adds a 380px breakpoint, and removes the programmatic heading outline; `src/ui/app.js` focuses `#help-heading` and resets the dialog scroll when the guide opens. Failing-first tests were added in `tests/ui.test.js` and `scripts/dogfood.mjs` before the markup change.

**Proof.**
- 1440x900 before/after, same served build, cleared storage, reduced motion, `?screen=title&preview=howto`: `pair-help-1440.png` (before: 13 unlabeled discs; after: four labeled equations).
- 390x844 before/after, same setup: `pair-help-390.png`.
- 320x568 before/after, same setup: `pair-help-320.png` (before: clipped white equation, horizontal scrollbar and scrolled-past heading; after: equations fit and the guide opens at the heading).
- DOM measurements after: `mixText = "Mixing light red+green=yellow green+blue=cyan red+blue=magenta red+green+blue=white"`, 4 lines, no horizontal overflow at 320, 390 or 1440.

**Played run.** `cycle1-play.json` started fresh at the title, opened the field guide, read the four equations, closed it, played First Light (1 click, 1/1 receiver, 3 stars), advanced to Double Bend, rotated one mirror, reopened the guide mid-run (`Back to the board`, four equations), closed it and finished Double Bend (2 clicks, 2/2, 3 stars). A second scripted run played the full campaign from the title: all 12 chambers solved through the DOM, 36/36 stars, 12/12 lit, every victory saved to `iris.progress.v1` (`cycle-01/campaign/`). Both runs reported frame health through successful DOM and screenshot captures at every step.

**Gates.**
- `node --test` → 86 pass, 0 fail (was 84 before the cycle).
- `node scripts/check-levels.mjs` → all 12 chambers OK, stored = solver = par.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK] ... labeled mixing key ... responsive board`.
- `python aikit.py check iris` → 5/5 gates passed (the pre-existing `UI contract not delivery-ready` warning remains; the UI surface has no finished task digest).

**Next findings.** The win dialog probably opens scrolled to its bottom action on a 320x568 screen for the same focus reason; verify when the UI area rotates again. Keyboard focus after arrow navigation still uses plain `.focus()` and can scroll a small viewport.
