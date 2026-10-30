import test from "node:test";
import assert from "node:assert/strict";

import { applySolution, mirrorTiles, traceGame, validateLevel } from "../src/game/engine.js";
import {
  EPISODES,
  LEVELS,
  LEVEL_BY_ID,
  TOTAL_CHAMBERS,
  TOTAL_STARS,
  episodeForLevel,
  levelsForEpisode,
} from "../src/game/levels.js";
import { solutionMoves, solveLevel } from "../src/game/solver.js";

test("the campaign publishes twelve uniquely identified chambers", () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(TOTAL_CHAMBERS, 12);
  assert.equal(TOTAL_STARS, 36);
  const ids = new Set(LEVELS.map((level) => level.id));
  const names = new Set(LEVELS.map((level) => level.name));
  assert.equal(ids.size, LEVELS.length);
  assert.equal(names.size, LEVELS.length);
  for (const level of LEVELS) {
    assert.equal(LEVEL_BY_ID[level.id], level);
  }
  assert.equal(Object.getPrototypeOf(LEVEL_BY_ID), null);
  assert.equal(LEVEL_BY_ID.__proto__, undefined);
});

test("the three episodes each own four chambers", () => {
  assert.equal(EPISODES.length, 3);
  for (const episode of EPISODES) {
    assert.equal(levelsForEpisode(episode.number).length, 4);
  }
  assert.equal(episodeForLevel(LEVELS[0]).name, "First Light");
  assert.equal(episodeForLevel(LEVELS[11]).numeral, "III");
});

test("chambers grow from six to ten cells a side", () => {
  let previous = 0;
  for (const level of LEVELS) {
    assert.ok(level.width >= 6 && level.width <= 10);
    assert.ok(level.height >= 6 && level.height <= 10);
    assert.ok(level.width >= previous);
    previous = level.width;
  }
});

test("every chamber validates and has a door for each color", () => {
  for (const level of LEVELS) {
    const prepared = validateLevel(level);
    assert.equal(prepared.id, level.id);
    assert.ok(prepared.tiles.length === level.height);
    assert.ok(level.emitters.length >= 1);
    assert.ok(level.receivers.length >= 1);
    assert.ok(mirrorTiles(level).length >= 1);
    assert.ok(level.par >= 0);
    for (const receiver of level.receivers) {
      assert.ok(["r", "g", "b", "y", "c", "m", "w"].includes(receiver.target));
    }
  }
});

test("every stored solution wins the chamber it belongs to", () => {
  for (const level of LEVELS) {
    const trace = traceGame(applySolution(level));
    assert.equal(trace.solved, true, `${level.id} did not solve`);
    assert.equal(trace.charged, trace.receivers.length);
  }
});

test("every advertised par is the true minimum move count", () => {
  for (const level of LEVELS) {
    const solved = solveLevel(level);
    assert.equal(solved.par, level.par, `${level.id} par is not optimal`);
    assert.equal(solved.states !== null, true);
  }
});

test("every stored solution is itself a minimum route", () => {
  for (const level of LEVELS) {
    assert.equal(solutionMoves(level), level.par, `${level.id} solution is not optimal`);
  }
});

test("chambers carry a name, id and episode in range", () => {
  for (const level of LEVELS) {
    assert.ok(level.name.length > 0);
    assert.ok(level.id.length > 0);
    assert.ok(level.episode >= 1 && level.episode <= 3);
    assert.ok(level.width === level.height);
  }
});
