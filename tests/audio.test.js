import test from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../src/ui/audio.js";
import { feedbackCues } from "../src/ui/feedback.js";

class FakeParam {
  constructor(log, kind) {
    this.log = log;
    this.kind = kind;
  }

  setValueAtTime(value, time) {
    this.log.push({ kind: this.kind, value, time });
    return this;
  }

  exponentialRampToValueAtTime(value, time) {
    this.log.push({ kind: `${this.kind}-ramp`, value, time });
    return this;
  }
}

class FakeOscillator {
  constructor(log) {
    this.log = log;
    this.type = "sine";
    this.frequency = new FakeParam(log, "frequency");
  }

  connect() {}

  start(time) {
    this.log.push({ kind: "start", time });
  }

  stop(time) {
    this.log.push({ kind: "stop", time });
  }
}

class FakeGain {
  constructor(log) {
    this.gain = new FakeParam(log, "gain");
  }

  connect() {}
}

class FakeContext {
  constructor(log, state) {
    this.log = log;
    this.state = state;
    this.currentTime = 1;
    this.destination = {};
  }

  createOscillator() {
    return new FakeOscillator(this.log);
  }

  createGain() {
    return new FakeGain(this.log);
  }

  resume() {
    this.log.push({ kind: "resume" });
    this.state = "running";
    return Promise.resolve();
  }
}

function setup(state = "running") {
  const log = [];
  class Context extends FakeContext {
    constructor() {
      super(log, state);
    }
  }
  const audio = createAudio({ AudioContext: Context });
  return { audio, log };
}

function frequencies(log) {
  return log.filter((entry) => entry.kind === "frequency").map((entry) => entry.value);
}

test("the rotate cue schedules its single tone", () => {
  const { audio, log } = setup();
  assert.equal(audio.play("rotate"), true);
  assert.deepEqual(frequencies(log), [392]);
});

test("the hint cue is distinct from the dye cue", () => {
  const hint = setup();
  assert.equal(hint.audio.play("hint"), true);
  const dye = setup();
  assert.equal(dye.audio.play("dye"), true);
  assert.deepEqual(frequencies(hint.log), [880, 1174.66]);
  assert.deepEqual(frequencies(dye.log), [523.25, 659.25]);
  assert.notDeepEqual(frequencies(hint.log), frequencies(dye.log));
});

test("the uncharge cue is a descending pair", () => {
  const { audio, log } = setup();
  assert.equal(audio.play("uncharge"), true);
  const notes = frequencies(log);
  assert.deepEqual(notes, [392, 311.13]);
  assert.ok(notes[0] > notes[1]);
});

test("the win cue rises through four tones", () => {
  const { audio, log } = setup();
  assert.equal(audio.play("win"), true);
  assert.deepEqual(frequencies(log), [523.25, 659.25, 783.99, 1046.5]);
});

test("a muted audio module schedules nothing", () => {
  const { audio, log } = setup();
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true);
  assert.equal(audio.play("win"), false);
  assert.deepEqual(log, []);
});

test("an unknown cue schedules nothing", () => {
  const { audio, log } = setup();
  assert.equal(audio.play("missing"), false);
  assert.deepEqual(log, []);
});

test("unlock resumes a suspended context", async () => {
  const { audio, log } = setup("suspended");
  assert.equal(audio.unlock(), true);
  await Promise.resolve();
  assert.ok(log.some((entry) => entry.kind === "resume"));
});

const receiver = (x, y, charged) => ({ x, y, charged });

test("feedbackCues reports a new charge", () => {
  assert.deepEqual(
    [...feedbackCues({ receivers: [receiver(0, 0, false)] }, { receivers: [receiver(0, 0, true)] })],
    ["charge"],
  );
});

test("feedbackCues reports a lost charge", () => {
  assert.deepEqual(
    [...feedbackCues({ receivers: [receiver(0, 0, true)] }, { receivers: [receiver(0, 0, false)] })],
    ["uncharge"],
  );
});

test("feedbackCues separates a charge and a loss in the same move", () => {
  assert.deepEqual(
    [...feedbackCues(
      { receivers: [receiver(0, 0, true), receiver(1, 0, false)] },
      { receivers: [receiver(0, 0, false), receiver(1, 0, true)] },
    )],
    ["charge", "uncharge"],
  );
});

test("feedbackCues stays quiet when nothing changes", () => {
  assert.deepEqual(
    [...feedbackCues(
      { receivers: [receiver(0, 0, true), receiver(1, 0, false)] },
      { receivers: [receiver(0, 0, true), receiver(1, 0, false)] },
    )],
    [],
  );
});
