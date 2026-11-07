# Decisions

Why this project is built the way it is, oldest first. One entry per decision that changes a
contract, a dependency, a data format or the architecture; IDs are consecutive and never reused.

<!-- Entry format:
### ADR-NNN: <decision in one line>
- **Date**: YYYY-MM-DD
- **Status**: Accepted
- **Context**: <what forced the decision>
- **Decision**: <what was decided>
- **Consequences**: <what follows, including what it costs>
-->

### ADR-001: Build a third Play title around additive color mixing, not another routing variant
- **Date**: 2026-10-29
- **Status**: Accepted
- **Context**: The AegeanWorks Play catalog already carries Prism Relay (mirror routing) and Weft (thread routing). A third game should reuse the static-build pipeline without repeating an existing mechanic.
- **Decision**: Iris is a twelve-chamber puzzle where beams carry additive color, dye cells add a primary, and every receiver demands one exact hue. Mirrors rotate, but the puzzle is about color composition rather than pathfinding alone.
- **Consequences**: The engine needs a color model and mix-aware receivers; level design must teach primary, secondary and white targets in that order. The game stays visually and mechanically distinct from its siblings.

### ADR-002: Represent light as an RGB bit mask and charge receivers on an exact match
- **Date**: 2026-10-29
- **Status**: Accepted
- **Context**: Additive mixing needs a small, deterministic model that the UI, tests and solver can share without floating point or color libraries.
- **Decision**: A color is a bit mask (red 1, green 2, blue 4). Dye cells OR their primary into the beam; a receiver ORs every beam that terminates on it and charges only when the result equals its target mask and at least one beam arrived. Beams stop at walls, emitters and receivers, and loop detection uses `(x, y, direction, color)` states.
- **Consequences**: Exact-target rules make a stray color a real mistake, so receivers are obstacles as well as goals. The finite state space bounds every trace and keeps the solver exhaustive.

### ADR-003: Author chambers as rows plus objects and prove par with an exhaustive solver
- **Date**: 2026-10-29
- **Status**: Accepted
- **Context**: A hand-written par can be wrong, and a stored solution can stop being minimal after an edit. The website shows par and awards stars from it, so a false par is a visible contract break.
- **Decision**: Each chamber declares rows (`.`, `#`, `/`, `\`, `1`, `2`, `3`), emitter objects, receiver objects, a stored solution and a par. `solver.js` enumerates every mirror orientation (at most 256 routes on the largest chamber). The test suite asserts that the stored solution wins, that par equals the solver minimum, and that the stored solution is itself minimal.
- **Consequences**: Level edits run through the solver in tests; a mismatch fails the suite instead of shipping. Runtime never solves a level, so the browser stays dependency-free and fast.

### ADR-004: Keep the runtime static and version local progress under `iris`
- **Date**: 2026-10-29
- **Status**: Accepted
- **Context**: The website copies the game into `docs/live/iris/<commit>/` and runs it in a same-origin iframe with its own service worker and storage.
- **Decision**: The game ships only `index.html`, `src/` and `assets/`, uses relative URLs, makes no network call, registers no service worker, never navigates the top window, and stores progress under `iris.progress.v1`. The `PLAYABLE.md` contract records these rules and the website's `validate_source` passes against the project.
- **Consequences**: Opening the file from disk does not work (ES modules); `play.cmd`/`play.sh` start a local static server. Any future runtime asset must stay inside the three copied paths or the website allowlist must change in the same step.

### ADR-005: First screenshot keepers are title plus Chamber 01
- **Date**: 2026-11-03
- **Status**: Accepted
- **Context**: No screenshots existed; the game needs its static server (ES modules) and chamber views need a Play click.
- **Decision**: Register `2026-11-03-title.png` (served title, headless Edge) and `2026-11-03-chamber.png` (same build after Playwright clicks Play, Chamber 01 zero-move state), viewport 1440x900, commit `279fa6c`, in `.aikit/media.json` and the README `aegean:screenshots` block.
- **Consequences**: README proves title and real gameplay. Reproduce with the serve command plus headless `--screenshot`, then Playwright click and screenshot.

### ADR-006: Harden validation, storage and server headers from swarm audit
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**: Six-module swarm audit (engine, levels/solver, UI, progress/audio, server/tooling, styles/assets) returned reproduced defects: shallow-frozen levels, createGame tile bypass, solver null/limit handling, negative-star rating, save-without-store true, __proto__ map loss, 403/404 missing safe headers, hint-timer leak across screens, preview leak on dialog cancel, grid fallback mismatch, dead theme tokens, commercial license misnaming.
- **Decision**: Always validate in createGame, deep-freeze prepared levels, validate solver options and solutionMoves, return truncated flag, guard rating/save/proto, send safe headers on errors, clear hint timers on screen leave, clear preview on win cancel, fix grid fallback, drop dead tokens, correct AGL-1.1 naming, with failing-first tests for each.
- **Consequences**: No format or contract change; stricter fail-fast behavior, 84/84 tests green, check-levels and inventory green, aikit 5/5 green.

### ADR-007: Spell out the field-guide mixing key and open it at the heading
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The field guide's decorative row of 13 unlabeled color discs had empty text content, so the help dialog never taught the mixing rules it was meant to. On a 320x568 viewport the modal also focused its bottom button, scrolling the title and first rules out of view and overflowing horizontally.
- **Decision**: Replace the decorative row with a four-line labeled key (red + green = yellow, green + blue = cyan, red + blue = magenta, red + green + blue = white) that uses the existing beam tokens, collapses the key to one column, and focuses the help heading when the dialog opens. Keep all labels in the static HTML; add a UI contract test and a dogfood check for the labels, narrow-screen overflow and opening scroll position.
- **Consequences**: No runtime dependency, save format or level change. The field guide is readable and screen-reader meaningful at 1440, 390 and 320 wide; the help dialog opens at its heading instead of the Begin button. 86/86 tests and the browser dogfood are green.

### ADR-008: Draw the mirror glyph on the reflected side and animate the quarter turn
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: A browser measurement of the live board showed every logical slash mirror rendered at +45deg (a backslash glyph) and every backslash at -45deg. In White Chapel the beam reflected west from a glyph that read as a backslash, which should reflect east; the drawing contradicted the engine. Rotation also rebuilt the board and swapped the glyph in one frame, so the game's core verb read as a teleport.
- **Decision**: Invert the two static mirror transforms so the drawn slash matches the reflect table, drive a transient state.spin from the pre-rotation orientation, and animate the new glyph through a 180ms ease-in-out quarter turn in the direction the player turned it. Keep the instant swap under the existing reduced-motion rule.
- **Consequences**: No engine, level, save or dependency change; the beam still resolves synchronously on the click. Browser dogfood now measures every mirror glyph angle, the turn animation name and duration, and the settled orientation. 87/87 tests and the full 12-chamber campaign are green.

### ADR-009: Separate hint and lost-charge cues, and derive feedback from the receiver set
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The hint reused the dye cue, so the two actions sounded identical, and the unused error cue never played. A rotation that broke an existing route gave no sound at all, and the old check compared only the net charged count, so one receiver charging while another uncharged could produce no cue.
- **Decision**: Give the hint its own two-note ping, replace the unused error cue with a descending uncharge cue, and derive move feedback in `src/ui/feedback.js` from the exact set of charged receiver cells before and after the move. The app plays every cue the helper returns, so a simultaneous gain and loss is heard as both.
- **Consequences**: No audio file, network call, save or level change. `tests/audio.test.js` covers the cue frequencies, mute and unknown-cue paths plus the four feedback transitions, and the browser dogfood records oscillator frequencies for hint, charge, uncharge and win during a real Crossroads run. 98/98 tests and the dogfood are green.

### ADR-010: Count progress only for authored campaign chambers
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: `normalizeProgress` keeps any non-empty level id so old records survive level renames, but `solvedCount` and `starCount` counted every stored key. A forged or stale record with two invented ids made the title say `2 of 12 chambers lit · 6/36 stars` and the chamber index say `2 of 12 lit` while every real card showed Unplayed.
- **Decision**: Require the campaign level list in `solvedCount(progress, levels)` and `starCount(progress, levels)` and count only ids present in that list. The app passes `LEVELS` at both call sites; the stored record is not rewritten, so unknown entries stay inert instead of being destroyed.
- **Consequences**: No storage-format, level or dependency change. A ghost entry is preserved but never counted; a real solve alongside it still saves and advances the campaign. 100/100 tests, the forged-save screenshot pair and the reload-plus-play run are green.

### ADR-011: Frame The Vault with two wall blocks and teach the wall tile
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The engine validates, renders and unit-tests walls, but no authored chamber used a `#` tile. The Vault, the Episode I finale, was an empty 7x7 frame with four floating mirrors and no structure, and the field guide and symbol table never explained walls.
- **Decision**: Add two symmetric 2x2 wall blocks to The Vault at rows 1-2, columns 4-5 and rows 4-5, columns 0-1. Both lie outside the unique red and green solution paths, so the stored four-move route and par 4 stay unchanged. Add a wall row to the README symbol table and `Walls stop a beam` to the field guide.
- **Consequences**: The wall renderer is exercised in a real chamber and the finale reads as an alcoved vault; no save, dependency or solver behavior changes. The solver still reports a unique four-move solution, 102/102 tests are green, and a played run solves the chamber in four moves for three stars.

### ADR-012: Bind Z, R and H to undo, reset and hint
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The board supported arrow keys and Enter/Space, but undo, reset and hint still required a pointer. A keyboard-only player could rotate but could not recover, restart or ask for a hint without leaving the keys, and the field guide never listed the available keys.
- **Decision**: Add a document `keydown` handler for `Z` (undo), `R` (reset) and `H` (hint). Ignore modified chords, text inputs, dialogs, non-game screens and a won board. Add `aria-keyshortcuts` to the three buttons and a `Shortcuts: Z undo, R reset, H hint` rule to the field guide.
- **Consequences**: No pointer, save, audio or level behavior changes. The browser dogfood presses all three keys and checks the resulting moves, hint ghost and orientation, and a help-dialog pair shows the new rule. 103/103 tests are green.

### ADR-013: Mark episode and campaign finales in the victory dialog
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The fourth chamber of each episode and the twelfth chamber ended a chapter, but their victory dialogs said `Chamber 04 complete` and `Chamber 12 complete`, identical to an ordinary chamber. The player got no signal that Episode II was unlocked or that the campaign was over.
- **Decision**: Add `isEpisodeFinal(level)` and `nextEpisodeForLevel(level)` to the level model. The victory kicker becomes `Episode <numeral> complete` for an episode finale and `Campaign complete` for the last chamber; a new `#win-episode` callout says `Episode <next> — <name> awaits.` or `All three episodes complete. The spectrum is yours.` Ordinary chambers keep the old kicker and hide the callout.
- **Consequences**: No save, level, dependency or input change. Preview victories still show the same copy, but no unlock is recorded. 105/105 tests are green; a played run through The Vault shows the Episode I close and Next opens Yellow Room in Episode II.

### ADR-014: Add a board-symbol key to the field guide
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The field guide named emitters, mirrors, dye cells and receivers in prose but never showed the four glyphs the player sees. The README table explained them, but a first-time player had to infer the board symbols while playing.
- **Decision**: Add a `Board symbols` key above the mixing key with four CSS swatches drawn from the same beam tokens: a red emitter with its arrow, a slash mirror, a green dye ring and a white receiver ring with a cyan dot. Each row names the glyph and its rule. The swatches are decorative (`aria-hidden`), while the label text carries the meaning.
- **Consequences**: No runtime, save, level or dependency change. The help dialog is taller and scrolls at 390px, but it still opens at its heading; the 2x2 key collapses to one column on mobile. 106/106 tests and the browser dogfood are green.

### ADR-015: Put the pre-reset board on the undo stack
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: `resetLevel` called `openLevel`, which cleared the undo stack and the move count. Reset sits beside Undo, and one misclick wiped the route with no recovery even though every rotation was undoable.
- **Decision**: Reset now pushes the current game and move count onto the undo stack, recreates the level from its frozen data, clears the hint and its timer, and re-renders without changing the open level or preview mode. A reset after a win (Replay) clears the stack instead, and the existing 80-step cap still applies.
- **Consequences**: Reset is reversible during play; Undo is enabled immediately after a reset and restores the pre-reset board. No save, level or dependency change. 107/107 tests, a reset-state pair showing Undo enabled and a rotate-reset-undo run are green.

### ADR-016: Stop active voices when the sound toggle is muted
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: `setMuted(true)` only blocked future `play()` calls. A win arpeggio or hint ping that was already scheduled kept sounding, so the Sound off button did not silence the game immediately.
- **Decision**: Track each scheduled oscillator/amplifier pair in a per-instance Set, remove it on `ended`, and on mute call `stop()` and `disconnect()` on every remaining voice. Clear the Set as each voice is stopped so a second mute cannot touch it again. Unmuting only affects future cues.
- **Consequences**: Sound off takes effect on the current cue; no audio file, network or save change. The fake-context tests cover immediate stop, double mute and unmute, and a browser stop log shows one scheduled stop plus one immediate stop on the same voice. 110/110 tests are green.

### ADR-017: Explain the receiver ring and dot in the symbol key
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The symbol key said a receiver `wants one exact hue`, but the board draws the target as the ring and the arriving color as the center dot. That convention is the one part of the receiver glyph the key did not explain, and the emitter swatch arrow was hard to see at normal size.
- **Decision**: Change the receiver row to `ring wants one exact hue; dot shows what arrives` and widen the emitter swatch arrow from 4x7 to 5x9 so it reads without zooming. The board glyphs and colors stay unchanged.
- **Consequences**: Static help copy and CSS only; no runtime, save, level or dependency change. The key is still four rows and remains inside the dialog at 1440 and 390. 111/111 tests and the browser dogfood are green.

### ADR-018: Stop active cues when leaving the board or a level
- **Date**: 2026-11-07
- **Status**: Accepted
- **Context**: The victory fanfare is scheduled for about half a second. Clicking Chambers or Next during it left every scheduled voice active while the title, chamber index or next level was already on screen. `setMuted` stopped voices, but screen transitions had no stop path.
- **Decision**: Expose `audio.stop()` and call it from `showTitle`, `showChambers`, `openLevel` and `resetLevel`. The win dialog and the board keep their fanfare; any deliberate screen or level change silences the current cue.
- **Consequences**: Leaving the board stops the cue immediately, including the win arpeggio. No audio file, network, save or level change. A browser run shows seven scheduled stops plus seven immediate stops on the same win transition, and 112/112 tests are green.

### ADR-019: Pin the help actions to the bottom of the scrollport
- **Date**: 2026-11-08
- **Status**: Accepted
- **Context**: The field guide grew to prose, six rules, four symbol rows and four mixing rows. At 390x844 the dialog is 806px tall with 1039px of content, so the Begin button sat at y=972 and was not visible when the guide opened at its heading. Closing required scrolling to the bottom or tapping outside.
- **Decision**: Make `#help-dialog .panel-foot` sticky to the bottom of the dialog scrollport with a top border, matching background and bottom corner radius. The guide still opens at its heading and the content still scrolls; the action is simply always reachable.
- **Consequences**: Static CSS only; no runtime, save or level change. The win dialog is untouched because the rule is scoped to the help dialog. 113/113 tests and the browser narrow-screen check are green.

### ADR-020: Announce that a reset is undoable
- **Date**: 2026-11-08
- **Status**: Accepted
- **Context**: Reset became reversible in ADR-015, but the only in-game signal was an enabled Undo button; the status line continued to describe the receivers. A player who reset by accident had to infer that Undo could restore the route.
- **Decision**: When a reset actually pushes an undoable board (during play, with moves on the clock), replace the status line with `Chamber reset. Undo restores your route.` after the board renders. Resets at zero moves and Replay after a win keep the normal progress text because they have no undoable state.
- **Consequences**: The `role="status"` live region announces the recovery path. No save, level or dependency change. 114/114 tests, the reset-status pair and the browser reset/undo run are green.
