#!/usr/bin/env node
/**
 * Iris's browser dogfood pass.
 *
 * Starts the real static server, launches an installed Edge/Chrome in headless
 * mode, opens the chamber index, solves the first chamber by rotating its
 * mirror through the page, and checks the victory dialog and the saved record.
 * It skips cleanly when no Chromium browser or WebSocket client is available;
 * the HTTP and engine tests still run in those environments.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LEVELS } from "../src/game/levels.js";
import { startServer } from "./serve.mjs";

const WINDOWS_BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const MAC_BROWSERS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export function findBrowser(platform = process.platform, exists = existsSync) {
  if (platform === "win32") {
    return WINDOWS_BROWSERS.find((path) => exists(path)) ?? null;
  }
  if (platform === "darwin") {
    return MAC_BROWSERS.find((path) => exists(path)) ?? null;
  }
  for (const command of ["google-chrome", "chromium", "chromium-browser", "microsoft-edge"]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }
  return null;
}

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createNetServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(connection, expression, label, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await connection.evaluate(expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function waitForTarget(port, url, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(
        (target) => target.type === "page" && target.url.startsWith(url),
      );
      if (page?.webSocketDebuggerUrl) {
        return page;
      }
    } catch {
      // The debugging endpoint is not listening yet.
    }
    await wait(200);
  }
  throw new Error("The browser did not expose an Iris page over CDP.");
}

async function connect(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 0;
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`The browser did not answer ${method} within 15 seconds.`));
        }, 15000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression) {
      const result = await this.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text);
      }
      return result.result.value;
    },
  };
}

async function clickSelector(connection, selector) {
  const center = await connection.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return null;
    node.scrollIntoView({ block: "center", inline: "center" });
    const rect = node.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  if (!center) {
    throw new Error(`The page has no element matching ${selector}.`);
  }
  for (const type of ["mousePressed", "mouseReleased"]) {
    await connection.send("Input.dispatchMouseEvent", {
      type,
      x: center.x,
      y: center.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    });
  }
  await wait(160);
}

async function pressKey(connection, key, code, windowsVirtualKeyCode, text = "") {
  await connection.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key,
    code,
    windowsVirtualKeyCode,
    ...(text ? { text, unmodifiedText: text } : {}),
  });
  if (text) {
    await connection.send("Input.dispatchKeyEvent", {
      type: "char",
      key,
      code,
      windowsVirtualKeyCode,
      text,
      unmodifiedText: text,
    });
  }
  await connection.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode,
  });
  await wait(140);
}

async function clickMirror(connection, x, y, waitMs = 140) {
  const center = await connection.evaluate(`(() => {
    const node = document.querySelector('.tile-tile[data-x="${x}"][data-y="${y}"]');
    if (!node) return null;
    node.scrollIntoView({ block: "center", inline: "center" });
    const rect = node.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  if (!center) {
    throw new Error(`The board has no mirror at ${x},${y}.`);
  }
  for (const type of ["mousePressed", "mouseReleased"]) {
    await connection.send("Input.dispatchMouseEvent", {
      type,
      x: center.x,
      y: center.y,
      button: "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: 1,
    });
  }
  await wait(waitMs);
}

async function main() {
  if (typeof WebSocket !== "function") {
    console.log("[SKIP] Iris dogfood needs a Node.js with the global WebSocket client (22+).");
    return 0;
  }
  const browser = findBrowser();
  if (!browser) {
    console.log("[SKIP] No Edge/Chrome found; install one to run the browser dogfood pass.");
    return 0;
  }

  const { server, url } = await startServer({ port: 0 });
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "iris-dogfood-"));
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      url,
    ],
    { stdio: "ignore", windowsHide: true },
  );

  let connection = null;
  try {
    const target = await waitForTarget(port, url);
    connection = await connect(target.webSocketDebuggerUrl);
    await connection.send("Page.enable");
    await connection.send("Runtime.enable");
    await connection.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const Original = window.AudioContext || window.webkitAudioContext;
        if (!Original) return;
        window.__irisAudio = [];
        function wrapped(context) {
          const createOscillator = context.createOscillator.bind(context);
          context.createOscillator = () => {
            const oscillator = createOscillator();
            const setValueAtTime = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
            oscillator.frequency.setValueAtTime = (value, time) => {
              window.__irisAudio.push({ type: oscillator.type, frequency: value });
              return setValueAtTime(value, time);
            };
            return oscillator;
          };
          return context;
        }
        function WrappedAudioContext(...args) {
          return wrapped(new Original(...args));
        }
        WrappedAudioContext.prototype = Original.prototype;
        window.AudioContext = WrappedAudioContext;
        window.webkitAudioContext = WrappedAudioContext;
      })();`,
    });
    await connection.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 860,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await connection.send("Page.navigate", { url: `${url}?screen=chambers` });
    await wait(900);

    const chamberCount = await connection.evaluate(
      "document.querySelectorAll('.chamber-card').length",
    );
    if (chamberCount !== 12) {
      throw new Error(`The chamber index rendered ${chamberCount} cards, not 12.`);
    }

    await connection.send("Page.navigate", { url: `${url}?screen=title` });
    await wait(500);
    await waitFor(connection, "Boolean(document.getElementById('btn-play'))", "the Play button");
    await clickSelector(connection, "#btn-play");
    const started = await connection.evaluate(`(() => ({
      name: document.getElementById('level-name').textContent,
      hidden: document.querySelector('section[data-screen=game]').hidden
    }))()`);
    if (started.hidden || started.name !== "First Light") {
      throw new Error(`Play did not open the first chamber: ${JSON.stringify(started)}.`);
    }

    const level = LEVELS[0];
    for (const mirror of Object.entries(level.solution)) {
      const [x, y] = mirror[0].split(",").map(Number);
      const current = level.rows[y][x];
      if (current !== mirror[1]) {
        await clickMirror(connection, x, y);
      }
    }

    const result = await connection.evaluate(`(() => ({
      win: document.getElementById('win-dialog').open,
      moves: document.getElementById('move-count').textContent,
      charged: document.getElementById('receiver-count').textContent,
      saved: Boolean(localStorage.getItem('iris.progress.v1'))
    }))()`);
    if (!result.win || result.moves !== String(LEVELS[0].par) || result.charged !== "1/1") {
      throw new Error(
        `The first chamber did not light: win=${result.win}, moves=${result.moves}, receivers=${result.charged}.`,
      );
    }
    if (!result.saved) {
      throw new Error("The victory was not written to localStorage.");
    }
    await connection.evaluate("document.getElementById('win-dialog').close()");

    await connection.send("Page.navigate", { url: `${url}?level=double-bend` });
    await wait(500);
    await waitFor(
      connection,
      "Boolean(document.querySelector('.tile-tile[data-x=\"2\"][data-y=\"1\"]'))",
      "the double-bend board",
    );
    const tabs = await connection.evaluate(
      "[...document.querySelectorAll('.tile-tile')].map((button) => button.tabIndex)",
    );
    if (!tabs.every((value) => value === 0)) {
      throw new Error(`Some mirrors are not keyboard reachable: ${JSON.stringify(tabs)}.`);
    }
    const mirrorAngles = await connection.evaluate(`(() => {
      return [...document.querySelectorAll('.tile-tile')].map((button) => {
        const line = button.querySelector('.mirror-line');
        const matrix = new DOMMatrix(getComputedStyle(line).transform);
        return {
          x: button.dataset.x,
          y: button.dataset.y,
          orientation: button.dataset.orientation,
          degrees: Math.round(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI)
        };
      });
    })()`);
    const wrongAngles = mirrorAngles.filter((mirror) =>
      mirror.orientation === "/" ? mirror.degrees !== -45 : mirror.degrees !== 45);
    if (wrongAngles.length) {
      throw new Error(`A mirror glyph does not match its orientation: ${JSON.stringify(wrongAngles)}.`);
    }
    await clickMirror(connection, 2, 1);
    await pressKey(connection, "z", "KeyZ", 90);
    const undoShortcut = await connection.evaluate(`(() => ({
      moves: document.getElementById('move-count').textContent,
      orientation: document.querySelector('.tile-tile[data-x="2"][data-y="1"]').dataset.orientation
    }))()`);
    if (undoShortcut.moves !== "0" || undoShortcut.orientation !== "/") {
      throw new Error(`Z did not undo the last rotation: ${JSON.stringify(undoShortcut)}.`);
    }
    await pressKey(connection, "h", "KeyH", 72);
    const hintShortcut = await connection.evaluate(
      "Boolean(document.querySelector('.hint-ghost'))",
    );
    if (!hintShortcut) {
      throw new Error("H did not open a hint.");
    }
    await pressKey(connection, "r", "KeyR", 82);
    const resetShortcut = await connection.evaluate(`(() => ({
      moves: document.getElementById('move-count').textContent,
      hint: Boolean(document.querySelector('.hint-ghost')),
      orientation: document.querySelector('.tile-tile[data-x="2"][data-y="1"]').dataset.orientation
    }))()`);
    if (resetShortcut.moves !== "0" || resetShortcut.hint || resetShortcut.orientation !== "/") {
      throw new Error(`R did not reset the chamber and clear the hint: ${JSON.stringify(resetShortcut)}.`);
    }

    await connection.evaluate(`(() => {
      window.__irisTurns = [];
      document.addEventListener('animationstart', (event) => {
        const line = event.target;
        if (!line || !line.classList || !line.classList.contains('mirror-line')) {
          return;
        }
        const button = line.closest('.tile-tile');
        const animation = line.getAnimations().find(
          (candidate) => candidate.animationName === event.animationName
        );
        window.__irisTurns.push({
          name: event.animationName,
          x: button ? button.dataset.x : null,
          y: button ? button.dataset.y : null,
          duration: animation && animation.effect ? animation.effect.getTiming().duration : null
        });
      }, true);
      return true;
    })()`);
    await clickMirror(connection, 2, 1, 0);
    const focus = await connection.evaluate(`(() => ({
      x: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.x : null,
      y: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.y : null,
      moves: document.getElementById('move-count').textContent
    }))()`);
    if (focus.x !== "2" || focus.y !== "1" || focus.moves !== "1") {
      throw new Error(`Focus was lost after a rotation: ${JSON.stringify(focus)}.`);
    }
    await waitFor(
      connection,
      "window.__irisTurns.length > 0",
      "the mirror turn to start",
      2000,
    );
    const turns = await connection.evaluate("window.__irisTurns");
    const turn = turns.find((entry) => entry.x === "2" && entry.y === "1");
    if (!turn || !String(turn.name).startsWith("mirror-turn") || turn.duration !== 180) {
      throw new Error(`The mirror did not animate its quarter turn: ${JSON.stringify(turns)}.`);
    }
    await waitFor(
      connection,
      "document.querySelector('.tile-tile[data-x=\"2\"][data-y=\"1\"] .mirror-line').getAnimations().length === 0",
      "the mirror turn to settle",
    );
    const settled = await connection.evaluate(`(() => {
      const line = document.querySelector('.tile-tile[data-x="2"][data-y="1"] .mirror-line');
      const matrix = line ? new DOMMatrix(getComputedStyle(line).transform) : null;
      return {
        count: line ? line.getAnimations().length : -1,
        orientation: document.querySelector('.tile-tile[data-x="2"][data-y="1"]').dataset.orientation,
        degrees: matrix ? Math.round(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI) : null
      };
    })()`);
    if (settled.count !== 0 || settled.orientation !== "\\" || settled.degrees !== 45) {
      throw new Error(`The mirror animation did not settle on the new orientation: ${JSON.stringify(settled)}.`);
    }
    await pressKey(connection, "ArrowDown", "ArrowDown", 40);
    const moved = await connection.evaluate(`(() => ({
      x: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.x : null,
      y: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.y : null
    }))()`);
    if (moved.x !== "2" || moved.y !== "4") {
      throw new Error(`Arrow keys did not move to the next mirror: ${JSON.stringify(moved)}.`);
    }
    await connection.evaluate("window.__irisAudio = []");
    await clickSelector(connection, "#btn-hint");
    const hint = await connection.evaluate(`(() => {
      const ghost = document.querySelector('.hint-ghost');
      return {
        ghost: Boolean(ghost),
        orientation: ghost && ghost.parentElement ? ghost.parentElement.dataset.hint : null
      };
    })()`);
    if (!hint.ghost || hint.orientation !== "\\") {
      throw new Error(`The hint did not show a target orientation: ${JSON.stringify(hint)}.`);
    }
    const hintStyle = await connection.evaluate(`(() => {
      const ghost = document.querySelector('.hint-ghost');
      return {
        transform: ghost ? getComputedStyle(ghost, '::before').transform : 'none',
        status: document.getElementById('status').textContent
      };
    })()`);
    if (hintStyle.transform === "none" || !hintStyle.status.startsWith("Hint:")) {
      throw new Error(`The hint was not drawn or announced: ${JSON.stringify(hintStyle)}.`);
    }
    const hintAudio = await connection.evaluate(
      "window.__irisAudio.map((entry) => entry.frequency)",
    );
    if (!hintAudio.includes(880) || !hintAudio.includes(1174.66) || hintAudio.includes(523.25)) {
      throw new Error(`The hint did not play its own cue: ${JSON.stringify(hintAudio)}.`);
    }

    await clickSelector(connection, "#btn-undo");
    const undone = await connection.evaluate(`(() => ({
      moves: document.getElementById('move-count').textContent,
      orientation: document.querySelector('.tile-tile[data-x="2"][data-y="1"]').dataset.orientation
    }))()`);
    if (undone.moves !== "0" || undone.orientation !== "/") {
      throw new Error(`Undo did not restore the previous move: ${JSON.stringify(undone)}.`);
    }

    await clickSelector(connection, "#btn-help-game");
    const help = await connection.evaluate(`(() => {
      const key = document.querySelector('#help-dialog .mix-key');
      const dialog = document.getElementById('help-dialog').getBoundingClientRect();
      const lines = key ? [...key.querySelectorAll('.mix-line')] : [];
      return {
        open: document.getElementById('help-dialog').open,
        label: document.getElementById('btn-help-close').textContent,
        equations: lines.length,
        text: key ? key.textContent.replace(/\\s+/g, ' ').trim() : '',
        overflow: lines.some((line) => {
          const rect = line.getBoundingClientRect();
          return rect.left < dialog.left || rect.right > dialog.right;
        })
      };
    })()`);
    if (!help.open || help.label !== "Back to the board") {
      throw new Error(`The in-game field guide did not open: ${JSON.stringify(help)}.`);
    }
    if (help.equations !== 4 || !help.text.includes("magenta") || !help.text.includes("white")) {
      throw new Error(`The field guide does not label the mixing equations: ${JSON.stringify(help)}.`);
    }
    if (help.overflow) {
      throw new Error(`A field-guide mixing equation overflows the dialog: ${JSON.stringify(help)}.`);
    }
    await clickSelector(connection, "#btn-help-close");
    const helpClosed = await connection.evaluate(
      "!document.getElementById('help-dialog').open",
    );
    if (!helpClosed) {
      throw new Error("The in-game field guide did not close.");
    }

    await connection.send("Page.navigate", { url: `${url}?level=crossroads` });
    await wait(600);
    await waitFor(
      connection,
      "Boolean(document.querySelector('.tile-tile[data-x=\"4\"][data-y=\"5\"]'))",
      "the crossroads board",
    );
    await connection.evaluate("window.__irisAudio = []");
    await clickMirror(connection, 4, 5);
    const chargeAudio = await connection.evaluate(
      "window.__irisAudio.map((entry) => entry.frequency)",
    );
    if (!chargeAudio.includes(523.25) || !chargeAudio.includes(783.99)) {
      throw new Error(`A new charge did not play the charge cue: ${JSON.stringify(chargeAudio)}.`);
    }
    await connection.evaluate("window.__irisAudio = []");
    await clickMirror(connection, 4, 5);
    const unchargeAudio = await connection.evaluate(
      "window.__irisAudio.map((entry) => entry.frequency)",
    );
    if (!unchargeAudio.includes(311.13) || unchargeAudio.includes(783.99)) {
      throw new Error(`A lost charge did not play the uncharge cue: ${JSON.stringify(unchargeAudio)}.`);
    }
    await connection.evaluate("window.__irisAudio = []");
    await clickMirror(connection, 4, 5);
    await clickMirror(connection, 3, 1);
    const winAudio = await connection.evaluate(
      "window.__irisAudio.map((entry) => entry.frequency)",
    );
    if (!winAudio.includes(1046.5)) {
      throw new Error(`The solved chamber did not play the win cue: ${JSON.stringify(winAudio)}.`);
    }
    const crossroads = await connection.evaluate(`(() => ({
      open: document.getElementById('win-dialog').open,
      heading: document.getElementById('win-heading').textContent,
      receivers: document.getElementById('receiver-count').textContent
    }))()`);
    if (!crossroads.open || crossroads.heading !== "Crossroads" || crossroads.receivers !== "2/2") {
      throw new Error(`The crossroads audio run did not solve the chamber: ${JSON.stringify(crossroads)}.`);
    }
    await connection.evaluate("document.getElementById('win-dialog').close()");

    await clickSelector(connection, "#btn-sound-game");
    const sound = await connection.evaluate(`(() => ({
      pressed: document.getElementById('btn-sound-game').getAttribute('aria-pressed'),
      stored: JSON.parse(localStorage.getItem('iris.progress.v1')).settings.sound
    }))()`);
    if (sound.pressed !== "false" || sound.stored !== false) {
      throw new Error(`The sound preference was not saved: ${JSON.stringify(sound)}.`);
    }

    await connection.send("Page.navigate", { url: `${url}?level=yellow-room` });
    await wait(500);
    await waitFor(
      connection,
      "Boolean(document.querySelector('.tile[data-kind=\"emitter\"]'))",
      "the yellow-room board",
    );
    const emitter = await connection.evaluate(`(() => {
      const tile = document.querySelector('.tile[data-kind="emitter"]');
      const arrow = tile ? tile.querySelector('.emitter-arrow') : null;
      if (!tile || !arrow) return null;
      const a = tile.getBoundingClientRect();
      const b = arrow.getBoundingClientRect();
      return {
        dx: Math.abs((a.x + a.width / 2) - (b.x + b.width / 2)),
        dy: Math.abs((a.y + a.height / 2) - (b.y + b.height / 2))
      };
    })()`);
    if (!emitter || emitter.dx > 3 || emitter.dy > 3) {
      throw new Error(`The emitter arrow is not centred: ${JSON.stringify(emitter)}.`);
    }

    await connection.send("Page.navigate", { url: `${url}?level=__proto__` });
    await wait(700);
    const fallback = await connection.evaluate(`(() => ({
      title: !document.querySelector('section[data-screen=title]').hidden,
      cards: document.querySelectorAll('.chamber-card').length
    }))()`);
    if (!fallback.title || fallback.cards !== 0) {
      throw new Error(`A forged level id did not fall back to the title: ${JSON.stringify(fallback)}.`);
    }

    await connection.evaluate("localStorage.clear()");
    await connection.send("Page.navigate", { url: `${url}?level=first-light&preview=victory` });
    await wait(900);
    const preview = await connection.evaluate(`(() => ({
      win: document.getElementById('win-dialog').open,
      saved: localStorage.getItem('iris.progress.v1'),
      next: document.getElementById('btn-next').hidden
    }))()`);
    if (!preview.win || preview.saved !== null || !preview.next) {
      throw new Error(`Preview mode saved progress or offered Next: ${JSON.stringify(preview)}.`);
    }
    await connection.evaluate("document.getElementById('win-dialog').close()");

    await connection.send("Emulation.setDeviceMetricsOverride", {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await connection.send("Page.navigate", { url: `${url}?level=first-light` });
    await wait(900);
    const square = await connection.evaluate(`(() => {
      const rect = document.getElementById('board').getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })()`);
    if (Math.abs(square.width - square.height) > 2) {
      throw new Error(`The board is not square at 800x600: ${JSON.stringify(square)}.`);
    }

    await connection.send("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 568,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await connection.send("Page.navigate", { url: `${url}?screen=title&preview=howto` });
    await wait(800);
    const narrowHelp = await connection.evaluate(`(() => {
      const dialog = document.getElementById('help-dialog');
      const bounds = dialog.getBoundingClientRect();
      const heading = document.getElementById('help-heading').getBoundingClientRect();
      return {
        open: dialog.open,
        active: document.activeElement && document.activeElement.id,
        scrollTop: dialog.scrollTop,
        headingTop: heading.top,
        dialogTop: bounds.top,
        overflow: [...dialog.querySelectorAll('.mix-line')].some((line) => {
          const rect = line.getBoundingClientRect();
          return rect.left < bounds.left || rect.right > bounds.right;
        })
      };
    })()`);
    if (!narrowHelp.open || narrowHelp.active !== "help-heading" || narrowHelp.scrollTop !== 0) {
      throw new Error(`The field guide did not open at its heading on a narrow screen: ${JSON.stringify(narrowHelp)}.`);
    }
    if (narrowHelp.headingTop < narrowHelp.dialogTop - 1 || narrowHelp.overflow) {
      throw new Error(`The field guide is clipped on a narrow screen: ${JSON.stringify(narrowHelp)}.`);
    }
    console.log("[OK] Iris dogfood: campaign start, 12 chambers, solved chamber, focus, arrows, Z/R/H shortcuts, hint, hint/charge/uncharge/win audio, in-game help, labeled mixing key, preview and responsive board.");
    return 0;
  } catch (error) {
    console.error(`[FAIL] Iris dogfood: ${error.message}`);
    console.error("Fix: run `npm start`, open the game, and check the browser console.");
    return 1;
  } finally {
    connection?.ws.close();
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
    try {
      server.closeAllConnections?.();
    } catch {
      // The server may already be closed.
    }
    await Promise.race([
      new Promise((resolveClose) => server.close(resolveClose)),
      wait(3000),
    ]);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // A lingering browser lock is harmless; the OS temp cleaner handles it.
    }
  }
}

process.exitCode = await main();
// A finished browser session can leave a keep-alive socket open; do not let it
// turn a green dogfood pass into a hung shell command.
setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
