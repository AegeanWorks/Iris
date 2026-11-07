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
    this.stopCalls = 0;
    this.disconnectCalls = 0;
    this.onended = null;
  }

  connect() {}

  disconnect() {
    this.disconnectCalls += 1;
  }

  start(time) {
    this.log.push({ kind: "start", time });
  }

  stop(time) {
    this.stopCalls += 1;
    this.log.push({ kind: "stop", time });
  }
}

class FakeGain {
  constructor(log) {
    this.gain = new FakeParam(log, "gain");
    this.disconnectCalls = 0;
  }

  connect() {}

  disconnect() {
    this.disconnectCalls += 1;
  }
}

class FakeContext {
  constructor(log, state, oscillators = []) {
    this.log = log;
    this.state = state;
    this.currentTime = 1;
    this.destination = {};
    this.oscillators = oscillators;
  }

  createOscillator() {
    const oscillator = new FakeOscillator(this.log);
    this.oscillators.push(oscillator);
    return oscillator;
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
  const oscillators = [];
  class Context extends FakeContext {
    constructor() {
      super(log, state, oscillators);
    }
  }
  const audio = createAudio({ AudioContext: Context });
  return { audio, log, oscillators };
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

test("muting stops voices that are already scheduled", () => {
  const { audio, oscillators } = setup();
  assert.equal(audio.play("win"), true);
  assert.equal(oscillators.length, 4);
  assert.equal(oscillators.every((oscillator) => oscillator.stopCalls === 1), true);
  audio.setMuted(true);
  assert.equal(oscillators.every((oscillator) => oscillator.stopCalls === 2), true);
  assert.equal(oscillators.every((oscillator) => oscillator.disconnectCalls === 1), true);
});

test("muting twice does not stop a voice twice", () => {
  const { audio, oscillators } = setup();
  audio.play("rotate");
  audio.setMuted(true);
  audio.setMuted(true);
  assert.equal(oscillators.length, 1);
  assert.equal(oscillators[0].stopCalls, 2);
});

test("unmuting allows the next cue to play", () => {
  const { audio, oscillators } = setup();
  audio.setMuted(true);
  assert.equal(audio.play("rotate"), false);
  assert.equal(oscillators.length, 0);
  audio.setMuted(false);
  assert.equal(audio.play("rotate"), true);
  assert.equal(oscillators.length, 1);
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
