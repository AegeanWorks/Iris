import test from "node:test";
import assert from "node:assert/strict";

import { applySolution, createGame, traceGame, validateLevel } from "../src/game/engine.js";
import { LEVELS } from "../src/game/levels.js";
import { solutionMoves, solveLevel, solutionIsOptimal } from "../src/game/solver.js";

test("solveLevel finds the minimum for a one-mirror chamber", () => {
  const level = validateLevel({
    id: "one",
    name: "One",
    episode: 1,
    width: 4,
    height: 4,
    par: 1,
    rows: ["....", "..\\.", "....", "...."],
    emitters: [{ x: 0, y: 1, color: "r", dir: "e" }],
    receivers: [{ x: 2, y: 0, target: "r" }],
    solution: { "2,1": "/" },
  });
  const solved = solveLevel(level);
  assert.equal(solved.par, 1);
  assert.equal(solved.mirrors, 1);
  assert.equal(solved.searched, 2);
  assert.deepEqual(solved.states, { "2,1": "/" });
});

test("solveLevel keeps the cheapest of several solving orientations", () => {
  const level = validateLevel({
    id: "two-solves",
    name: "Two Solves",
    episode: 1,
    width: 5,
    height: 5,
    par: 0,
    rows: [".....", ".....", ".....", ".....", "/...."],
    emitters: [{ x: 0, y: 0, color: "r", dir: "e" }],
    receivers: [{ x: 4, y: 0, target: "r" }],
    solution: { "0,4": "/" },
  });
  const solved = solveLevel(level);
  assert.equal(solved.par, 0);
  assert.deepEqual(solved.states, { "0,4": "/" });
});

test("solveLevel reports null when no orientation works", () => {
  const level = validateLevel({
    id: "sealed",
    name: "Sealed",
    episode: 1,
    width: 4,
    height: 4,
    par: 1,
    rows: ["....", "../.", "....", "...."],
    emitters: [{ x: 0, y: 1, color: "r", dir: "e" }],
    receivers: [{ x: 0, y: 0, target: "r" }],
    solution: { "2,1": "/" },
  });
  const solved = solveLevel(level);
  assert.equal(solved.par, null);
  assert.equal(solved.states, null);
});

test("solveLevel respects a search limit", () => {
  const level = validateLevel({
    id: "limit",
    name: "Limit",
    episode: 1,
    width: 5,
    height: 5,
    par: 1,
    rows: [".....", "../..", ".....", "..\\..", "....."],
    emitters: [{ x: 0, y: 1, color: "r", dir: "e" }],
    receivers: [{ x: 2, y: 0, target: "r" }],
    solution: { "2,1": "/", "2,3": "/" },
  });
  const solved = solveLevel(level, { limit: 1 });
  assert.equal(solved.searched, 1);
});

test("solutionMoves counts only mirrors that leave their initial state", () => {
  for (const level of LEVELS) {
    let expected = 0;
    for (const [key, orientation] of Object.entries(level.solution)) {
      const initial = level.rows[Number(key.split(",")[1])][Number(key.split(",")[0])];
      if (initial !== orientation) {
        expected += 1;
      }
    }
    assert.equal(solutionMoves(level), expected);
  }
});

test("every campaign chamber is optimal and solved by its stored route", () => {
  for (const level of LEVELS) {
    assert.equal(solutionIsOptimal(level), true, `${level.id}`);
    assert.equal(traceGame(applySolution(level)).solved, true);
  }
});

test("createGame does not mutate the frozen level", () => {
  const before = JSON.stringify(LEVELS[0].solution);
  createGame(LEVELS[0]);
  assert.equal(JSON.stringify(LEVELS[0].solution), before);
});
