# WaveNest

A Chrome MV3 extension for radio and podcasts with Ethiopia-first picks, international stations, podcast imports, and an in-extension audio player that keeps playing through an offscreen document.

## Features

- Popup mini-player with favorites and quick controls
- Side panel browsing for `Top Hits`, `Local Picks`, `International Picks`, `News`, `Tech`, and `Podcasts`
- Offscreen audio playback so streams continue when the popup or panel closes
- Bundled Ethiopia + international curation
- Remote `M3U` and podcast `RSS` imports with optional host permissions
- Podcast resume positions and stored stream failure history

## Development

```bash
npm install
npm run test
npm run build
```

On Windows PowerShell, use `npm.cmd` if the system execution policy blocks `npm.ps1`:

```powershell
npm.cmd run test
npm.cmd run build
```

## Production package

```powershell
npm.cmd run package
```

This runs the strict TypeScript build and creates `release/WaveNest-<version>.zip`. The ZIP contains the contents of `dist` directly, so `manifest.json` is at the archive root as required by the Chrome Web Store.

## Load In Chrome

1. Build the extension with `npm run build`
2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Choose `Load unpacked`
5. Select the `dist` folder

See [STORE_LISTING.md](STORE_LISTING.md) for Chrome Web Store copy, permission justifications, artwork requirements, and the submission checklist. See [PRIVACY.md](PRIVACY.md) for the public privacy disclosure.
