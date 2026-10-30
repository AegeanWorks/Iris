# Website live-app contract

Iris is served inside the AegeanWorks website from a commit-named copy of
`index.html`, `src/**` and `assets/**`. The AegeanWorks workflow refreshes that
copy daily with `tools/sync_live_apps.py` and shows this repository's
`package.json` version, commit and a SHA-256 digest on the Live page.

Keep these rules when changing the game. A change that breaks one of them makes
the website sync fail instead of publishing a broken build.

## Required layout and paths

- Keep `index.html` at the repository root.
- Keep all runtime JavaScript, CSS and loaded images under `src/` or `assets/`.
- Use only relative URLs such as `./src/ui/app.js`; never root-absolute paths
  like `/src/...`.
- Do not reference a machine path, `file://`, or anything outside this
  repository.
- If a runtime file must move outside `index.html`, `src/` or `assets/`, update
  the copy allowlist in AegeanWorks `tools/sync_live_apps.py` in the same
  change.

## Required runtime

- The game must run from a plain static HTTP server at a nested path, for
  example `http://127.0.0.1:8000/iris/`, with no rewrite or proxy.
- Do not add a backend, API route, `fetch`, `XMLHttpRequest`, `WebSocket`,
  server-side rendering or any other network call.
- Do not register a service worker; the website owns the service worker and
  cache.
- Do not load a CDN, remote font, remote image or analytics script. Keep every
  runtime asset in the repository. The SVG XML namespace
  `http://www.w3.org/2000/svg` is the only allowed absolute URL.
- Do not navigate the top window or assume the game owns the browser tab; it
  runs inside a same-origin iframe. `window.top` and `window.parent`
  navigation are not allowed.
- Keep the `Content-Security-Policy` meta tag: `default-src 'self'` is part of
  the static promise.

## Required metadata and storage

- Keep `package.json` `version` in semver; the website displays it.
- Keep `LICENSE` as the Aegean Game License 1.1 (AGL-1.1) text.
- Prefix game progress keys with `iris` (`iris.progress.v1`) so they cannot
  collide with the host site's storage or with another game.

## Verification before merging

```bash
node --test
node scripts/check-levels.mjs
node scripts/dogfood.mjs
```

The website side validates the same contract with
`python tools/sync_live_apps.py --source-root <parent> --check-source`,
then copies the build with `--write` and verifies it with `--check`.
