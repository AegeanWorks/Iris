# Iris improvement record

Continuous improvement cycles for Iris. One area per cycle. Each entry names the defect evidence, the fix, the screenshot pair and the played run. Screenshot files live outside the repository in `scratch/iris-evidence/cycle-N/` and are not committed; binaries never enter the tree.

Covered areas: UI readability (cycle 1), graphics and effects (cycle 2), audio cues (cycle 3), progression and saves (cycles 4 and 7), levels (cycle 5), input feel (cycle 6).

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

## Cycle 4 — 2026-11-07 — Progression and saves: ignore invented chambers

**Find.** A forged or stale save with two invented chamber ids made the title say `2 of 12 chambers lit · 6/36 stars · Novice · next: First Light` and the chamber index say `2 of 12 lit`, while every real card showed Unplayed and `data-solved` was true on zero cards (`cycle-04/pair-ghost-title-1440.png`, `cycle-04/pair-ghost-chambers-1440.png`). `normalizeProgress` intentionally keeps unknown ids so old records survive edits, but `solvedCount` and `starCount` counted every key.

**Analyze.** Survivors:
1. Filter the summary counts to ids present in the authored campaign, leaving the stored record untouched so old ids are not destroyed.
2. Require the campaign list at both summary call sites so a future caller cannot silently reintroduce the overcount.
Dead ends: dropping unknown ids during normalization would rewrite hand-edited or renamed saves and destroy data.

**Implement.** `src/ui/progress.js` now requires `levels` in `solvedCount(progress, levels)` and `starCount(progress, levels)` and counts only known ids; `src/ui/app.js` passes `LEVELS` in `renderTitleProgress()` and `renderChambers()`. New failing-first tests cover a ghost entry, a real entry plus ghosts, and a missing campaign list.

**Proof.**
- Title pair, same forged `iris.progress.v1` record and 1440x900 viewport: `cycle-04/pair-ghost-title-1440.png`. Before: `2 of 12 chambers lit · 6/36 stars · Novice · next: First Light`. After: `12 chambers · no account · no network`.
- Chamber pair, same record: `cycle-04/pair-ghost-chambers-1440.png`. Before: `2 of 12 lit`; after: `0 of 12 lit`; zero lit cards in both.
- Played run: with a ghost entry present, Play opened First Light, one rotation solved it, the saved record kept the ghost entry and added `first-light`, and the title reported `1 of 12 chambers lit · 3/36 stars · Novice · next: Double Bend` with the chamber index at `1 of 12 lit` and one lit card (`cycle-04/play/after-ghost-play-chambers.png`).
- Failing-first: the two new tests reported `3 !== 1` and `Missing expected exception` before the fix.

**Gates.**
- `node --test` → 100 pass, 0 fail (was 98).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including all audio checks, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** The win dialog still opens on its first button, which can scroll its heading out of view at 320x568. Episode and campaign completion still use the same ordinary victory dialog; that is the next progression opportunity.

## Cycle 5 — 2026-11-07 — Levels: frame The Vault with walls

**Find.** The engine validates, renders and tests `#` walls, but no authored chamber used one: `document.querySelectorAll('.tile[data-kind=wall]').length` was 0 on The Vault (`cycle-05/before-vault-1440.png`). The Episode I finale was an empty 7x7 frame with four floating mirrors, and neither the field guide nor the README symbol table explained walls.

**Analyze.** Survivors:
1. Add two symmetric 2x2 wall blocks to The Vault on cells outside the unique red and green solution paths.
2. Keep the stored four-move solution and par 4; verify the solver still reports a unique minimum route.
3. Teach the tile: one wall row in the README table and `Walls stop a beam` in the field guide.
Dead ends: candidate layouts with walls at `5,3` or `5,5` blocked the red route and returned `par=null`; discarded before any code was written.

**Implement.** `src/game/levels.js` now has `##` blocks at rows 1-2 columns 4-5 and rows 4-5 columns 0-1. `README.md` gained the wall symbol row and `index.html` gained the wall rule. Failing-first tests assert that The Vault has at least four wall tiles and that the field guide says `Walls stop a beam`.

**Proof.**
- Board pair, same `?level=the-vault` zero-move state and 1440x900 viewport: `cycle-05/pair-vault-1440.png`. Before: 0 walls, empty frame. After: 8 walls in two blocks, same beams, same par 4 and 0/2 receivers.
- Solver: `check-levels` reports `the-vault mirrors=4 par=4 solver=4 stored=4 wins=true`; a 16-state enumeration still finds exactly one solving state, the stored four-move route.
- Played run: four rotations in the live UI solved the chamber in 4 moves with `2/2` receivers and three stars (`cycle-05/play/after-vault-victory.png`), with 8 wall tiles rendered.
- Failing-first: `The Vault has 0 wall tiles` and the missing `Walls stop a beam` assertion both failed before the change.

**Gates.**
- `node --test` → 102 pass, 0 fail (was 100).
- `node scripts/check-levels.mjs` → all 12 chambers OK, The Vault par and solution unchanged.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including audio and help checks, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** The win dialog still opens on its first button, which can scroll its heading out of view at 320x568. Episode and campaign completion still use the same ordinary victory dialog.

## Cycle 6 — 2026-11-07 — Input feel: Z/R/H shortcuts

**Find.** The board supported arrow keys and Enter/Space, but undo, reset and hint required a pointer. A keyboard-only run pressed `Z` after a rotation and the move count stayed at 1, so the dogfood reported `Z did not undo the last rotation`. The field guide listed rotation and movement keys but no recovery keys.

**Analyze.** Survivors:
1. Bind `Z`, `R` and `H` to undo, reset and hint from a document-level keydown handler.
2. Ignore modified chords, text inputs, open dialogs, non-game screens and a won board.
3. Make the bindings discoverable with `aria-keyshortcuts` and a field-guide rule.
Dead ends: binding `Ctrl+Z` would collide with browser undo; plain letters avoid that and the game has no text inputs.

**Implement.** `src/ui/app.js` adds `shortcutsEnabled()` and `handleShortcut()` and registers the document listener in `wireEvents()`. `index.html` adds `aria-keyshortcuts="Z"`, `"R"` and `"H"` to the three buttons and the `Shortcuts: Z undo, R reset, H hint` rule. `scripts/dogfood.mjs` now presses all three keys in the Double Bend flow and checks moves, orientation and the hint ghost.

**Proof.**
- Failing-first browser run: `Z did not undo the last rotation: {"moves":"1","orientation":"\\"}` before the handler existed; the same run now passes with `moves 0` and `/`.
- Keyboard run after the fix: rotate once (`1` move, `\`), press `Z` → `0` moves and `/`; press `H` → hint ghost present; press `R` → `0` moves, `/`, hint gone.
- Help pair, same `?screen=title&preview=howto` state and 1440x900 viewport: `cycle-06/pair-help-1440.png`; zoom `cycle-06/pair-zoom-help.png` shows the new `Shortcuts: Z undo, R reset, H hint.` line.
- `aria-keyshortcuts` measured as `Z`, `R`, `H` after the change and `null` before.

**Gates.**
- `node --test` → 103 pass, 0 fail (was 102).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including the Z/R/H shortcut checks, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** The win dialog still opens on its first button, which can scroll its heading out of view at 320x568. Episode and campaign completion still use the same ordinary victory dialog.

## Cycle 7 — 2026-11-07 — Progression, pass 2: episode and campaign finales

**Find.** The fourth chamber of each episode and the twelfth chamber ended a chapter, but `?level=the-vault&preview=victory` still said `Chamber 04 complete` and `?level=white-crown&preview=victory` said `Chamber 12 complete`, identical to an ordinary chamber (`cycle-07/before-vault-victory-1440.png`, `cycle-07/before-crown-victory-1440.png`). Nothing told the player that Episode II was next or that the campaign was over.

Dead end checked first: the deferred win-dialog focus issue did not reproduce. At 320x568 the victory dialog is short enough that the heading stays visible (`scrollTop 0`); at 568x320 the dialog scrolls 24px but the kicker, heading, stars, summary and buttons all remain visible. Killed; no fix made.

**Analyze.** Survivors:
1. Mark the last chamber of each episode with `Episode <numeral> complete` and add a callout naming the next episode.
2. Mark the twelfth chamber with `Campaign complete` and a spectrum-complete callout.
3. Derive both from the authored level order so a future level edit cannot desync the copy.
Dead ends: focusing the win heading to fix a scroll that does not occur; dropped.

**Implement.** `src/game/levels.js` adds `isEpisodeFinal(level)` and `nextEpisodeForLevel(level)`. `src/ui/app.js` uses them in `finishLevel()` and fills a new `#win-episode` callout with `Episode II — Mixing awaits.` or `All three episodes complete. The spectrum is yours.`. `src/styles.css` styles the callout as a bordered accent line. The dogfood checks both preview finales, and a real played run confirms the Episode I close and the Next transition.

**Proof.**
- The Vault pair, same victory preview state and 1440x900 viewport: `cycle-07/pair-vault-victory-1440.png`. Before: `CHAMBER 04 COMPLETE`; after: `EPISODE I COMPLETE` plus `Episode II — Mixing awaits.`
- White Crown pair, same state: `cycle-07/pair-crown-victory-1440.png`. Before: `CHAMBER 12 COMPLETE`; after: `CAMPAIGN COMPLETE` plus `All three episodes complete. The spectrum is yours.`
- Played run: with the first three chambers saved, Play opened The Vault; four rotations won at par with three stars, the dialog read `Episode I complete`, the Next button was visible, and Next opened `Chamber 05 · Episode II · Mixing / Yellow Room` at zero moves (`cycle-07/play/`).
- Failing-first: the new level helper import failed before the helpers existed; the dogfood finale checks were added with the implementation and pass.

**Gates.**
- `node --test` → 105 pass, 0 fail (was 103).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including both finale checks, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** The field guide still has no symbol key for emitters, mirrors, dyes and receivers; the legend covers mixing but not the board glyphs. Turning sound off still does not stop already-scheduled tones.

## Cycle 8 — 2026-11-07 — UI readability, pass 3: board symbol key

**Find.** The field guide named emitters, mirrors, dye cells and receivers in prose but never showed the four glyphs the player sees. At `?screen=title&preview=howto` the guide had a mixing key but no symbol key; a first-time player had to infer circle-arrow, slanted line, ringed circle and double ring from the board. The README table explained them; the in-game guide did not.

**Analyze.** Survivors:
1. Add a four-row `Board symbols` key with CSS swatches drawn from the same beam tokens as the board.
2. Label each row with its name and rule, keeping the swatches `aria-hidden` so the text carries the meaning.
3. Collapse the key to one column on mobile and check both 1440 and 390 for horizontal overflow.
Dead ends: none; the four glyphs are exactly the board's four special tiles.

**Implement.** `index.html` adds `#help-dialog .symbol-key` with emitter, mirror, dye and receiver rows. `src/styles.css` draws the swatches with the existing `--beam-r`, `--iris`, `--beam-g`, `--beam-w` and `--beam-c` tokens and lays them out in a two-column grid that collapses to one. The dogfood now counts four symbol rows, checks all four labels and includes them in both the desktop and 320px overflow checks. Failing-first: the new UI test reported `0 !== 4` before the markup.

**Proof.**
- 1440x900 pair, same `?screen=title&preview=howto` state: `cycle-08/pair-help-1440.png`. Before: prose and mixing key only; after: the 2x2 `BOARD SYMBOLS` key above the mixing key, with all four glyphs.
- 390x844 pair, same state: `cycle-08/pair-help-390.png`. Before: no symbol key, dialog 787px tall with no internal scroll; after: four symbol rows in one column, dialog capped at 806px and scrolls, opening at the heading as before.
- Browser measurements after: four `.symbol-line` rows, labels Emitter/Mirror/Dye/Receiver present, no horizontal overflow at 1440 or 320 (the 320 check now includes `.symbol-line`).
- The dogfood still opens the guide at its heading, closes it and returns to the board in the same run.

**Gates.**
- `node --test` → 106 pass, 0 fail (was 105).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including board-symbol and mixing keys, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** Turning sound off still does not stop already-scheduled oscillators. The emitter swatch's arrow is small at normal size; a future polish pass could thicken it if play notes show it is missed.

## Cycle 9 — 2026-11-07 — Input feel, pass 2: undoable reset

**Find.** `resetLevel` called `openLevel`, which cleared the undo stack and the move count. Reset sits next to Undo, so one misclick lost the whole route even though every rotation was undoable. The first browser run after a rotate-then-reset reported `{"moves":"0","orientation":"/","undoDisabled":true}`: the reset worked, but there was no way back.

**Analyze.** Survivors:
1. Push the current game and move count onto the undo stack before resetting during play.
2. Recreate the level from its frozen data, clear the hint and timer, and re-render without changing the open level or preview mode.
3. Keep Replay after a win clean by clearing the stack instead of making the winning board undoable.
Dead ends: none; the existing 80-step stack and hint cleanup already cover the edge cases.

**Implement.** `src/ui/app.js` now resets in place: during play it pushes `{ game, moves }`, then `createGame(state.level)`, zero moves, clears the hint, spin and timer, and calls `renderGame()`. A reset after a win clears the stack. `tests/ui.test.js` guards the push and the in-place recreation; `scripts/dogfood.mjs` rotates, resets, undoes the reset, and undoes again to the clean board.

**Proof.**
- Reset-state pair, same `?level=double-bend` state after one rotation and a reset, 1440x900: `cycle-09/pair-reset-1440.png`; zoom `cycle-09/pair-zoom-reset.png`. Before: Undo dim and disabled; after: Undo bright and enabled, with moves 0 and the initial mirror.
- Undo-after-reset pair, same state: `cycle-09/pair-reset-undo-1440.png`. Before: undo does nothing, board stays at 0 moves; after: the pre-reset board returns at 1 move with the beam bent down.
- Played run: rotate → reset (`0` moves, `/`, Undo enabled) → Undo (`1` move, `\`) → Undo again (`0` moves, `/`, Undo disabled). The dogfood performs exactly this sequence.
- Failing-first browser run: `Reset did not leave an undoable baseline: {"moves":"0","orientation":"/","undoDisabled":true}` before the change.

**Gates.**
- `node --test` → 107 pass, 0 fail (was 106).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including the reset/undo sequence, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** Turning sound off still does not stop already-scheduled oscillators. The field guide's emitter swatch arrow is small at normal size.

## Cycle 10 — 2026-11-07 — Audio, pass 2: mute silences the current cue

**Find.** `setMuted(true)` only blocked future `play()` calls. A win arpeggio or hint ping that was already scheduled kept sounding, so the Sound off button did not silence the game immediately. The new fake-context tests failed with `stopCalls 1 !== 2` before the change.

**Analyze.** Survivors:
1. Track each scheduled oscillator/amplifier pair in the audio instance.
2. On mute, stop and disconnect every remaining voice and clear it from the set.
3. Remove each voice on `ended` so normal cues do not accumulate, and keep unmute limited to future cues.
Dead ends: none; the cue table and generated-audio promise stay unchanged.

**Implement.** `src/ui/audio.js` now holds a `voices` Set, stores `{ oscillator, amplifier }` per tone, removes it on `ended`, and `setMuted(true)` calls a guarded `stopVoice()` for every remaining entry. `tests/audio.test.js` adds immediate-stop, double-mute and unmute tests with the fake context. The evidence recorder logs `stop()` calls with their `when` argument.

**Proof.**
- Unit: playing `win` creates four voices with one scheduled stop each; muting adds a second stop and one disconnect per voice; a second mute adds nothing; unmuting allows the next cue.
- Browser stop log (`scratch/iris-evidence/cycle-10`): a synchronous rotate click followed by the sound toggle recorded `[{"type":"sine","when":0.07},{"type":"sine","when":null}]` — the scheduled stop and the immediate mute stop on the same voice — with `aria-pressed="false"` and `sound:false` stored.
- Failing-first: the two new tests failed with `stopCalls 1 !== 2` and the missing disconnect before the Set existed.

**Gates.**
- `node --test` → 110 pass, 0 fail (was 107).
- `node scripts/check-levels.mjs` → all 12 chambers OK.
- `node scripts/ui-inventory.mjs` → 19 entries, unchanged.
- `node scripts/dogfood.mjs` → `[OK]` including the sound preference check, exit 0.
- `python aikit.py check iris` → 5/5 gates passed (same pre-existing UI delivery warning).

**Next findings.** The field guide's emitter swatch arrow is small at normal size. The sound toggle only exists on the title and game screens, which is sufficient; no further audio gap was reproduced.
