# Iris improvement record

Continuous improvement cycles for Iris. One area per cycle. Each entry names the defect evidence, the fix, the screenshot pair and the played run. Screenshot files live outside the repository in `scratch/iris-evidence/cycle-N/` and are not committed; binaries never enter the tree.

Covered areas: UI readability (cycle 1), graphics and effects (cycle 2), audio cues (cycle 3).

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

## Cycle 2 — 2026-11-07 — Graphics and effects: mirror glyph and quarter turn

**Find.** The mirror glyph was drawn on the wrong diagonal. Browser measurement of White Chapel showed both logical slash mirrors at `+45deg`, the shape of a backslash (`cycle-02/before-glyph-1440.png`). In the same state the red beam reached the bottom-left mirror and turned west, which is the correct reflection for a slash but the opposite of what the drawn backslash promised. The core verb also snapped: `renderBoard()` rebuilt the button and swapped the line between `+45deg` and `-45deg` in one frame with no motion.

**Analyze.** Survivors:
1. Invert the static transforms so `data-orientation="/"` is drawn at `-45deg` and `"\"` at `+45deg`; the engine's `reflect` table stays authoritative.
2. Animate the new glyph through a 180ms quarter turn in the direction of the click, keyed by the pre-rotation orientation.
3. Keep the instant swap for `prefers-reduced-motion`.
Dead ends: delaying the beam trace until the animation ends would add input latency; the beam stays synchronous while the glyph is a flourish.

**Implement.** `src/styles.css` swaps the two static transforms and adds `mirror-turn-cw` / `mirror-turn-ccw` keyframes on `data-spin`. `src/ui/app.js` records `state.spin` from the previous orientation, marks the rebuilt mirror `cw` or `ccw`, and clears the flag after one render. `tests/ui.test.js` guards the spin wiring and keyframes; `scripts/dogfood.mjs` now measures every mirror glyph angle in the live DOM, asserts the animation name and 180ms duration, and checks the settled orientation. The dogfood also exits cleanly after a green run instead of leaving a keep-alive socket holding the shell.

**Proof.**
- Glyph pair, same White Chapel state after one top-mirror rotation (moves 1), 1440x900: `cycle-02/pair-glyph-1440.png`; zoom `cycle-02/pair-zoom-glyph.png`. Before, the bottom mirror reads as a backslash while the beam turns west; after, it reads as a slash and the beam still turns west. DOM angles: before `"/" -> +45`; after `"/" -> -45` and `"\" -> +45`.
- Animation pair, same build and same White Chapel state after the same rotation, 1440x900: `cycle-02/pair-anim-1440.png`; zoom `cycle-02/pair-zoom-anim.png`. Before (reduced motion) the line is already at the final `-45deg` with `lineAnimations: 0`; after (no-preference, paused at 90ms) the line is horizontal mid-turn with `mirror-turn-cw`, 180ms. The three-frame strip `cycle-02/strip-zoom-anim-1440.png` shows slash, horizontal, backslash.
- The failing-first browser check reported `[{"x":"2","y":"1","orientation":"/","degrees":45},{"x":"2","y":"4","orientation":"/","degrees":45}]` before the fix and passed after.

**Played run.** The scripted campaign played all 12 chambers from the title after the fix: 12/12 lit, 36/36 stars, every victory saved (`cycle-02/campaign/`). Each entry used the real click path and read the live move, receiver, star and storage state.

**Gates.**
- `node --test` → 87 pass, 0 fail.
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` in 18.1s, exit 0, including glyph angles, animation and narrow help checks.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** The win dialog still focuses its first button on open, which can scroll its heading out of view at 320x568. Arrow-key focus does not use `preventScroll`, so the page can jump on short screens.

## Cycle 3 — 2026-11-07 — Audio cues: hint ping and lost charge

**Find.** The hint reused the dye cue (`audio.play("dye")` in `showHint`), so a hint and a lit dye cell were indistinguishable. The audio table carried an unused `error` cue and no loss cue at all. The move feedback compared only the net charged count, so a move that charged one receiver while uncharging another could stay silent. There were no audio tests.

**Analyze.** Survivors:
1. Give the hint a distinct two-note ping (880Hz and 1174.66Hz) so it cannot be confused with the dye cue (523.25Hz/659.25Hz).
2. Replace the unused error cue with a descending uncharge cue (392Hz to 311.13Hz).
3. Derive feedback from the exact set of charged receiver cells before and after the move, not the net count.
Dead ends: playing the old error cue on every wrong-hue receiver would fire on most rotations and become noise.

**Implement.** Added `src/ui/feedback.js` with `feedbackCues(before, after)`, extended `src/ui/audio.js` with `hint` and `uncharge`, changed `showHint()` to play `hint`, and changed `rotateAt()` to play every cue the helper returns. Added `tests/audio.test.js` for the cue frequencies, mute, unknown cue, unlock and the four feedback transitions. Extended the browser dogfood with an oscillator-frequency recorder, a hint-cue check and a played Crossroads run that charges, uncharges and solves.

**Proof.**
- Failing-first: `node --test tests/audio.test.js` failed with `ERR_MODULE_NOT_FOUND` for the new feedback module and the missing cue assertions before implementation; it now passes 11/11.
- Played browser run with the audio graph recorded (`scratch/iris-evidence/cycle-03`): Crossroads first rotation `[392, 523.25, 783.99]` (rotate + charge); second rotation `[392, 392, 311.13]` (rotate + uncharge, with the 311.13 loss note); third rotation and solve `[392, 523.25, 783.99, 392, 523.25, 783.99, 523.25, 659.25, 783.99, 1046.5]` (two charges plus the win arpeggio), with the victory dialog open on `2/2`.
- Hint run: `[880, 1174.66]` with the status line still naming the backslash mirror.
- The Crossroads victory screenshot `after-audio-crossroads-victory.png` shows the solved board and dialog that accompanied the win cue.

**Gates.**
- `node --test` → 98 pass, 0 fail (was 87).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including hint/charge/uncharge/win audio, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** Turning sound off during a cue does not stop oscillators that were already scheduled. The next audio pass could also give undo/reset a short cue if they stay silent after this cycle.
