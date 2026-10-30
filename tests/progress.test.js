import test from "node:test";
import assert from "node:assert/strict";

import { LEVELS } from "../src/game/levels.js";
import {
  PROGRESS_VERSION,
  STORAGE_KEY,
  bestFor,
  defaultProgress,
  isUnlocked,
  loadProgress,
  nextUnsolved,
  normalizeProgress,
  rankFor,
  ratingFor,
  recordSolve,
  saveProgress,
  solvedCount,
  starCount,
} from "../src/ui/progress.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}

test("the default progress is versioned, empty and sound-on", () => {
  const progress = defaultProgress();
  assert.equal(progress.version, PROGRESS_VERSION);
  assert.deepEqual(progress.solved, {});
  assert.deepEqual(progress.settings, { sound: true });
  assert.equal(progress.lastLevel, null);
});

test("a saved record round-trips through storage", () => {
  const storage = memoryStorage();
  let progress = recordSolve(defaultProgress(), "first-light", {
    moves: 1,
    stars: 3,
    hints: 0,
  });
  assert.equal(saveProgress(progress, storage), true);
  const loaded = loadProgress(storage);
  assert.equal(loaded.solved["first-light"].stars, 3);
  assert.equal(loaded.solved["first-light"].bestMoves, 1);
});

test("the storage key is namespaced for the website", () => {
  assert.equal(STORAGE_KEY, "iris.progress.v1");
  assert.match(STORAGE_KEY, /^iris\./);
});

test("a missing record loads the default", () => {
  assert.deepEqual(loadProgress(memoryStorage()), defaultProgress());
});

test("a corrupt record resets instead of throwing", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{not json" });
  assert.deepEqual(loadProgress(storage), defaultProgress());
});

test("a future-versioned record resets safely", () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({ version: 99, solved: { x: { bestMoves: 1 } } }),
  });
  assert.deepEqual(loadProgress(storage), defaultProgress());
});

test("normalizeProgress drops invalid entries and keeps valid ones", () => {
  const normalized = normalizeProgress({
    version: PROGRESS_VERSION,
    solved: {
      good: { bestMoves: 4, stars: 2, hints: 1, at: "2026-01-01" },
      noMoves: { stars: 3 },
      badStars: { bestMoves: 2, stars: 9 },
    },
    settings: { sound: false },
    lastLevel: "good",
  });
  assert.deepEqual(Object.keys(normalized.solved), ["good", "badStars"]);
  assert.equal(normalized.solved.good.stars, 2);
  assert.equal(normalized.solved.badStars.stars, 1);
  assert.equal(normalized.settings.sound, false);
  assert.equal(normalized.lastLevel, "good");
});

test("a non-object record normalizes to the default", () => {
  assert.deepEqual(normalizeProgress(null), defaultProgress());
  assert.deepEqual(normalizeProgress("nope"), defaultProgress());
  assert.deepEqual(normalizeProgress([]), defaultProgress());
});

test("a better run replaces the best and a worse run does not", () => {
  let progress = recordSolve(defaultProgress(), "first-light", { moves: 5, stars: 1 });
  progress = recordSolve(progress, "first-light", { moves: 3, stars: 2 });
  assert.equal(progress.solved["first-light"].stars, 2);
  assert.equal(progress.solved["first-light"].bestMoves, 3);
  progress = recordSolve(progress, "first-light", { moves: 9, stars: 1 });
  assert.equal(progress.solved["first-light"].stars, 2);
  assert.equal(progress.solved["first-light"].bestMoves, 3);
});

test("a clearer run wins a star tie", () => {
  let progress = recordSolve(defaultProgress(), "first-light", { moves: 4, stars: 2 });
  progress = recordSolve(progress, "first-light", { moves: 2, stars: 2 });
  assert.equal(progress.solved["first-light"].bestMoves, 2);
});

test("recordSolve ignores an empty level id", () => {
  const progress = recordSolve(defaultProgress(), "", { moves: 1, stars: 3 });
  assert.equal(solvedCount(progress), 0);
});

test("recordSolve ignores a result without a move count", () => {
  const progress = recordSolve(defaultProgress(), "first-light", { stars: 3 });
  assert.equal(solvedCount(progress), 0);
  const later = recordSolve(progress, "first-light", { moves: 1, stars: 3 });
  assert.equal(later.solved["first-light"].bestMoves, 1);
});

test("an unknown chamber is never unlocked", () => {
  assert.equal(isUnlocked(defaultProgress(), LEVELS, "not-a-chamber"), false);
});

test("chambers unlock in order", () => {
  let progress = defaultProgress();
  assert.equal(isUnlocked(progress, LEVELS, LEVELS[0].id), true);
  assert.equal(isUnlocked(progress, LEVELS, LEVELS[1].id), false);
  progress = recordSolve(progress, LEVELS[0].id, { moves: 1, stars: 3 });
  assert.equal(isUnlocked(progress, LEVELS, LEVELS[1].id), true);
  assert.equal(isUnlocked(progress, LEVELS, LEVELS[2].id), false);
});

test("a solved chamber stays open without its predecessor", () => {
  const progress = recordSolve(defaultProgress(), LEVELS[2].id, { moves: 2, stars: 3 });
  assert.equal(isUnlocked(progress, LEVELS, LEVELS[2].id), true);
  assert.equal(isUnlocked(progress, LEVELS, LEVELS[1].id), false);
});

test("solvedCount and starCount summarize the record", () => {
  let progress = recordSolve(defaultProgress(), "first-light", { moves: 1, stars: 3 });
  progress = recordSolve(progress, "double-bend", { moves: 3, stars: 2 });
  assert.equal(solvedCount(progress), 2);
  assert.equal(starCount(progress), 5);
  assert.equal(bestFor(progress, "first-light").stars, 3);
  assert.equal(bestFor(progress, "missing"), null);
});

test("nextUnsolved follows the campaign order", () => {
  let progress = recordSolve(defaultProgress(), LEVELS[0].id, { moves: 1, stars: 3 });
  progress = recordSolve(progress, LEVELS[1].id, { moves: 2, stars: 3 });
  assert.equal(nextUnsolved(progress, LEVELS).id, LEVELS[2].id);
  for (const level of LEVELS) {
    progress = recordSolve(progress, level.id, { moves: level.par, stars: 3 });
  }
  assert.equal(nextUnsolved(progress, LEVELS), null);
});

test("ratingFor awards stars on the par window", () => {
  assert.equal(ratingFor(3, 3), 3);
  assert.equal(ratingFor(2, 3), 3);
  assert.equal(ratingFor(4, 3), 2);
  assert.equal(ratingFor(5, 3), 2);
  assert.equal(ratingFor(6, 3), 1);
  assert.equal(ratingFor(Number.NaN, 3), 1);
  assert.equal(ratingFor(1, -1), 1);
});

test("rankFor rises with the star total", () => {
  assert.equal(rankFor(0, 36), "Novice");
  assert.equal(rankFor(8, 36), "Apprentice");
  assert.equal(rankFor(17, 36), "Mixer");
  assert.equal(rankFor(24, 36), "Colorist");
  assert.equal(rankFor(31, 36), "Luminist");
  assert.equal(rankFor(36, 36), "Spectroscopist");
  assert.equal(rankFor(0, 0), "Novice");
  assert.equal(rankFor(Number.NaN, 36), "Novice");
  assert.equal(rankFor(Infinity, Infinity), "Novice");
  assert.equal(rankFor(-1, 36), "Novice");
});

test("a storage failure never throws", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.deepEqual(loadProgress(broken), defaultProgress());
  assert.equal(saveProgress(defaultProgress(), broken), false);
});

test("a throwing localStorage getter does not abort startup", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => {
      throw new Error("storage is blocked");
    },
  });
  try {
    assert.deepEqual(loadProgress(), defaultProgress());
    assert.equal(saveProgress(defaultProgress()), false);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "localStorage", descriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
});
