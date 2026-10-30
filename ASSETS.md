# Asset Manifest

Assets listed here are offered under the Aegean Game License 1.1 (AGL-1.1) as part of the game.
Assets not listed remain proprietary: they may be used only to play the game and may not be
extracted, redistributed or included in a mod without a grant.

| Path or pattern | Type | Rights holder | License | Notes |
|---|---|---|---|---|
| `assets/favicon.svg` | vector art | AegeanWorks | AGL-1.1 | Three-disc additive light mark |
| `assets/logo.svg` | vector art | AegeanWorks | AGL-1.1 | Square project logo |
| `assets/social-preview.svg` | vector art | AegeanWorks | AGL-1.1 | 1280x640 preview card |
| `assets/social-preview.png` | raster art | AegeanWorks | AGL-1.1 | Rendered preview used by GitHub |
| `src/theme.css` | color tokens | AegeanWorks | AGL-1.1 | Palette expressed as CSS custom properties |
| `src/game/levels.js` | level data | AegeanWorks | AGL-1.1 | Twelve authored chambers and their solutions |

## Generated assets

The logo, social preview and favicon are original vector artwork committed with
their source SVG. The PNG preview is rendered from `assets/social-preview.svg`.
No third-party imagery, fonts, textures or audio files are used.

All sound cues are synthesized at runtime with the Web Audio API by
`src/ui/audio.js`; the repository ships no audio files.
