import test from "node:test";
import assert from "node:assert/strict";

import {
  BLUE,
  COLORS,
  GREEN,
  RED,
  advance,
  applySolution,
  buildTiles,
  colorKey,
  colorMask,
  colorName,
  createGame,
  mirrorTiles,
  orientationAt,
  reflect,
  resetGame,
  rotateMirror,
  rotateOrientation,
  targetMask,
  traceGame,
  validateLevel,
} from "../src/game/engine.js";

function level(overrides = {}) {
  return {
    id: "basic",
    name: "Basic",
    episode: 1,
    width: 5,
    height: 5,
    par: 1,
    rows: [
      ".....",
      "..\\..",
      ".....",
      ".....",
      ".....",
    ],
    emitters: [{ x: 0, y: 1, color: "r", dir: "e" }],
    receivers: [{ x: 2, y: 0, target: "r" }],
    solution: { "2,1": "/" },
    ...overrides,
  };
}

test("the three primaries are distinct single bits", () => {
  assert.equal(RED, 1);
  assert.equal(GREEN, 2);
  assert.equal(BLUE, 4);
  assert.equal(RED | GREEN, 3);
  assert.equal(GREEN | BLUE, 6);
  assert.equal(RED | BLUE, 5);
  assert.equal(RED | GREEN | BLUE, 7);
});

test("colors map between masks, keys and names", () => {
  assert.equal(colorMask("r"), RED);
  assert.equal(colorMask("g"), GREEN);
  assert.equal(colorMask("b"), BLUE);
  assert.equal(targetMask("y"), RED | GREEN);
  assert.equal(targetMask("c"), GREEN | BLUE);
  assert.equal(targetMask("m"), RED | BLUE);
  assert.equal(targetMask("w"), 7);
  assert.equal(colorName(3), "yellow");
  assert.equal(colorKey(6), "c");
  assert.equal(colorName(99), "none");
  assert.throws(() => colorMask("q"), /Unknown color key/);
  assert.throws(() => targetMask("q"), /Unknown target key/);
});

test("mirrors reflect every direction on both diagonals", () => {
  assert.equal(reflect("e", "/"), "n");
  assert.equal(reflect("n", "/"), "e");
  assert.equal(reflect("w", "/"), "s");
  assert.equal(reflect("s", "/"), "w");
  assert.equal(reflect("e", "\\"), "s");
  assert.equal(reflect("s", "\\"), "e");
  assert.equal(reflect("w", "\\"), "n");
  assert.equal(reflect("n", "\\"), "w");
  assert.equal(rotateOrientation("/"), "\\");
  assert.equal(rotateOrientation("\\"), "/");
  assert.throws(() => reflect("e", "-"), /Unknown mirror orientation/);
  assert.deepEqual(advance([2, 2], "n"), [2, 1]);
  assert.deepEqual(advance([2, 2], "s"), [2, 3]);
  assert.deepEqual(advance([2, 2], "e"), [3, 2]);
  assert.deepEqual(advance([2, 2], "w"), [1, 2]);
});

test("validateLevel returns a frozen, prepared level", () => {
  const prepared = validateLevel(level());
  assert.ok(Object.isFrozen(prepared));
  assert.equal(prepared.tiles.length, 5);
  assert.equal(prepared.tiles[1][2].type, "mirror");
  assert.equal(prepared.tiles[1][0].type, "emitter");
  assert.equal(prepared.tiles[0][2].type, "receiver");
  assert.equal(mirrorTiles(prepared).length, 1);
});

test("validateLevel rejects malformed boards", () => {
  assert.throws(() => validateLevel(level({ width: 4 })), /not 4 cells wide/);
  assert.throws(() => validateLevel(level({ rows: ["....X", ".....", ".....", ".....", "....."] })), /unknown symbol/);
  assert.throws(() => validateLevel(level({ emitters: [] })), /at least one emitter/);
  assert.throws(() => validateLevel(level({ receivers: [] })), /at least one receiver/);
  assert.throws(() => validateLevel(level({ episode: 4 })), /episode/);
  assert.throws(() => validateLevel(level({ par: 9 })), /par/);
  assert.throws(() => validateLevel(level({ solution: {} })), /solution orientation for every mirror/);
  assert.throws(() => validateLevel(level({ solution: { "2,1": "/", "0,0": "/" } })), /solution orientation for every mirror/);
  assert.throws(() => validateLevel(level({ solution: { "2,1": "-" } })), /invalid solution orientation/);
  assert.throws(
    () => validateLevel(level({ emitters: [{ x: 2, y: 1, color: "r", dir: "e" }] })),
    /puts an emitter/,
  );
  assert.throws(
    () => validateLevel(level({ emitters: [{ x: 0, y: 1, color: "q", dir: "e" }] })),
    /without a primary color/,
  );
  assert.throws(
    () => validateLevel(level({ emitters: [{ x: 0, y: 1, color: "constructor", dir: "e" }] })),
    /without a primary color/,
  );
  assert.throws(
    () => validateLevel(level({ emitters: [{ x: 0, y: 1, color: "r", dir: "toString" }] })),
    /without a direction/,
  );
  assert.throws(
    () => validateLevel(level({ receivers: [{ x: 2, y: 0, target: "constructor" }] })),
    /without a valid target/,
  );
});

test("buildTiles refuses two objects on one cell", () => {
  const base = level();
  assert.throws(
    () => buildTiles({ ...base, emitters: [...base.emitters, { x: 2, y: 0, color: "g", dir: "e" }] }),
    /another tile/,
  );
});

test("createGame starts from the authored mirror orientations", () => {
  const game = createGame(level());
  assert.equal(game.moves, 0);
  assert.equal(orientationAt(game, 2, 1), "\\");
  assert.equal(mirrorTiles(game.level)[0].orientation, "\\");
});

test("rotateMirror turns one mirror and counts one move", () => {
  const game = createGame(level());
  const rotated = rotateMirror(game, 2, 1);
  assert.equal(orientationAt(rotated, 2, 1), "/");
  assert.equal(rotated.moves, 1);
  assert.equal(game.moves, 0);
  assert.equal(orientationAt(game, 2, 1), "\\");
});

test("rotateMirror refuses a cell without a mirror", () => {
  const game = createGame(level());
  assert.throws(() => rotateMirror(game, 0, 0), /no mirror/);
});

test("resetGame restores the authored orientations", () => {
  const rotated = rotateMirror(createGame(level()), 2, 1);
  const reset = resetGame(rotated);
  assert.equal(orientationAt(reset, 2, 1), "\\");
  assert.equal(reset.moves, 0);
});

test("a beam bends on a slash mirror and charges its receiver", () => {
  const game = applySolution(level());
  const trace = traceGame(game);
  assert.equal(trace.solved, true);
  assert.equal(trace.charged, 1);
  assert.equal(trace.receivers[0].charged, true);
  assert.deepEqual(trace.receivers[0].colors, [RED]);
  assert.deepEqual(trace.beams[0].points, [[0, 1], [1, 1], [2, 1], [2, 0]]);
});

test("an unrotated backslash mirror sends the beam away", () => {
  const trace = traceGame(createGame(level()));
  assert.equal(trace.solved, false);
  assert.equal(trace.charged, 0);
  assert.deepEqual(trace.receivers[0].colors, []);
});

test("a dye cell adds its primary to the beam", () => {
  const dyed = level({
    rows: [
      ".....",
      "..1/.",
      ".....",
      ".....",
      ".....",
    ],
    emitters: [{ x: 0, y: 1, color: "g", dir: "e" }],
    receivers: [{ x: 3, y: 0, target: "y" }],
    solution: { "3,1": "/" },
    par: 0,
  });
  const trace = traceGame(applySolution(dyed));
  assert.equal(trace.solved, true);
  assert.deepEqual(trace.receivers[0].colors, [RED | GREEN]);
  assert.equal(trace.beams[0].points.some(([x, y]) => x === 2 && y === 1), true);
});

test("a receiver demands its exact target, not a subset", () => {
  const subset = level({
    emitters: [{ x: 0, y: 1, color: "r", dir: "e" }],
    receivers: [{ x: 2, y: 0, target: "w" }],
  });
  const trace = traceGame(applySolution(subset));
  assert.equal(trace.solved, false);
  assert.deepEqual(trace.receivers[0].colors, [RED]);
});

test("two beams can charge one receiver together", () => {
  const shared = level({
    width: 4,
    height: 4,
    rows: [
      "....",
      "....",
      "....",
      "/...",
    ],
    emitters: [
      { x: 3, y: 0, color: "r", dir: "s" },
      { x: 0, y: 2, color: "g", dir: "e" },
    ],
    receivers: [{ x: 3, y: 2, target: "y" }],
    solution: { "0,3": "/" },
    par: 0,
  });
  const trace = traceGame(applySolution(shared));
  assert.equal(trace.solved, true);
  assert.deepEqual(trace.receivers[0].colors, [RED, GREEN]);
});

test("a beam stops at a wall", () => {
  const walled = level({
    rows: [
      ".....",
      "..#..",
      ".....",
      ".....",
      "/....",
    ],
    receivers: [{ x: 4, y: 1, target: "r" }],
    solution: { "0,4": "/" },
    par: 0,
  });
  const trace = traceGame(createGame(walled));
  assert.equal(trace.solved, false);
  assert.deepEqual(trace.beams[0].points, [[0, 1], [1, 1], [2, 1]]);
});

test("a beam leaves the board without charging anything", () => {
  const empty = level({
    rows: [
      ".....",
      ".....",
      ".....",
      ".....",
      "/....",
    ],
    emitters: [{ x: 0, y: 1, color: "r", dir: "e" }],
    receivers: [{ x: 0, y: 0, target: "r" }],
    solution: { "0,4": "/" },
    par: 0,
  });
  const trace = traceGame(createGame(empty));
  assert.equal(trace.solved, false);
  assert.deepEqual(trace.beams[0].points, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]);
});

test("traceGame is immutable and reports charged counts", () => {
  const trace = traceGame(applySolution(level()));
  assert.ok(Object.isFrozen(trace));
  assert.ok(Object.isFrozen(trace.beams));
  assert.ok(Object.isFrozen(trace.receivers));
  assert.ok(Object.isFrozen(trace.beams[0].points));
  assert.equal(trace.charged, 1);
});

test("only a level with every receiver charged is solved", () => {
  const two = level({
    width: 6,
    height: 6,
    rows: [
      "......",
      "..\\...",
      "......",
      "......",
      "....\\.",
      "......",
    ],
    emitters: [
      { x: 0, y: 1, color: "r", dir: "e" },
      { x: 0, y: 4, color: "g", dir: "e" },
    ],
    receivers: [
      { x: 2, y: 0, target: "r" },
      { x: 4, y: 3, target: "g" },
    ],
    solution: { "2,1": "/", "4,4": "/" },
    par: 2,
  });
  const start = traceGame(createGame(two));
  assert.equal(start.solved, false);
  assert.equal(start.charged, 0);

  const first = traceGame(rotateMirror(createGame(two), 2, 1));
  assert.equal(first.charged, 1);
  assert.equal(first.solved, false, "the second receiver is still unlit");

  const both = applySolution(two);
  assert.equal(traceGame(both).charged, 2);
  assert.equal(traceGame(both).solved, true);
});

test("COLORS has one entry per primary", () => {
  assert.deepEqual(Object.keys(COLORS).sort(), ["b", "g", "r"]);
});
