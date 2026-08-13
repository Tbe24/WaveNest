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

## Load In Chrome

1. Build the extension with `npm run build`
2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Choose `Load unpacked`
5. Select the `dist` folder
