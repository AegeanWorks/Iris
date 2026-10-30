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
