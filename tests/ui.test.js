import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const theme = readFileSync(new URL("../src/theme.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/ui/app.js", import.meta.url), "utf8");
const progress = readFileSync(new URL("../src/ui/progress.js", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function ids() {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
}

function attributes(name) {
  return new Set(
    [...html.matchAll(new RegExp(`data-${name}="([^"]+)"`, "g"))].map((match) => match[1]),
  );
}

test("the shell has the required screens, dialogs and controls", () => {
  const found = ids();
  for (const id of [
    "title-heading",
    "chambers-heading",
    "chamber-list",
    "board",
    "move-count",
    "par-count",
    "receiver-count",
    "status",
    "btn-play",
    "btn-how",
    "btn-back-title",
    "btn-chambers",
    "btn-undo",
    "btn-reset",
    "btn-hint",
    "btn-help-game",
    "btn-sound-title",
    "btn-sound-game",
    "help-dialog",
    "win-dialog",
    "win-stars",
    "win-moves",
    "win-par",
    "win-best",
    "btn-next",
    "btn-replay",
    "btn-win-chambers",
  ]) {
    assert.ok(found.has(id), `missing #${id}`);
  }
});

test("the UI inventory names every control, panel and cue", () => {
  const output = execFileSync(process.execPath, ["scripts/ui-inventory.mjs"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  assert.deepEqual(output, [
    "control: back-title @ index.html",
    "control: chambers @ index.html",
    "control: help-close @ index.html",
    "control: help-game @ index.html",
    "control: hint @ index.html",
    "control: how-to-play @ index.html",
    "control: next @ index.html",
    "control: play @ index.html",
    "control: replay @ index.html",
    "control: reset @ index.html",
    "control: sound-game @ index.html",
    "control: sound-title @ index.html",
    "control: undo @ index.html",
    "control: win-chambers @ index.html",
    "cue: status @ index.html",
    "panel: board @ index.html",
    "panel: chambers @ index.html",
    "panel: game @ index.html",
    "panel: title @ index.html",
  ]);
});

test("every identifier the app requires exists in the shell", () => {
  const found = ids();
  for (const match of app.matchAll(/required\("([^"]+)"\)/g)) {
    assert.ok(found.has(match[1]), `app requires missing #${match[1]}`);
  }
});

test("the UI attribute sets match between the shell and the app", () => {
  assert.deepEqual([...attributes("ui")].sort(), [
    "back-title",
    "chambers",
    "help-close",
    "help-game",
    "hint",
    "how-to-play",
    "next",
    "play",
    "replay",
    "reset",
    "sound-game",
    "sound-title",
    "undo",
    "win-chambers",
  ]);
  assert.deepEqual([...attributes("panel")].sort(), ["board", "chambers", "game", "title"]);
  assert.deepEqual([...attributes("cue")], ["status"]);
});

test("the page is a self-contained static document", () => {
  assert.match(html, /<script type="module" src="\.\/src\/ui\/app\.js"><\/script>/);
  assert.match(html, /href="\.\/src\/theme\.css"/);
  assert.match(html, /href="\.\/src\/styles\.css"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
});

test("the runtime makes no network call and registers no service worker", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const runtimeFiles = readdirSync(sourceRoot, { recursive: true })
    .filter((name) => /\.(js|css|html)$/.test(String(name)))
    .map((name) => readFileSync(new URL(String(name).replaceAll("\\", "/"), sourceRoot), "utf8"));
  const runtime = [html, ...runtimeFiles].join("\n");
  for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "navigator.serviceWorker", "sendBeacon"]) {
    assert.equal(runtime.includes(forbidden), false, `runtime uses ${forbidden}`);
  }
  assert.equal(runtime.includes("window.top"), false);
  assert.equal(runtime.includes("window.parent"), false);
  assert.ok(runtimeFiles.length >= 6);
});

test("mirrors stay in the tab order and board focus is restored", () => {
  assert.match(app, /button\.tabIndex = 0/);
  assert.match(app, /closest\?\.\("\.tile-tile"\)/);
  assert.match(app, /Object\.hasOwn\(LEVEL_BY_ID, levelParam\)/);
});

test("all runtime URLs are relative", () => {
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    assert.ok(url.startsWith("./") || url.startsWith("#"), `absolute runtime URL ${url}`);
  }
});

test("raw colors live only in the theme stylesheet", () => {
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(styles, /\brgba?\(/i);
  assert.match(theme, /--beam-r:/);
  assert.match(theme, /--beam-g:/);
  assert.match(theme, /--beam-b:/);
  assert.match(theme, /--beam-w:/);
});

test("the progress key is namespaced for the host site", () => {
  assert.match(progress, /iris\.progress\.v1/);
  assert.doesNotMatch(progress, /prism-relay\./);
});

test("the package manifest matches the README promise", () => {
  assert.equal(packageJson.version, "0.2.0");
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.scripts.test, "node --test");
  assert.equal(packageJson.engine ?? packageJson.engines.node, ">=20");
  assert.match(packageJson.description, /color-mixing puzzle/);
});
