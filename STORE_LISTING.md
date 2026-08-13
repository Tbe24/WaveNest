# Chrome Web Store listing guide

## Listing copy

**Name:** WaveNest

**Summary:** Discover and play Ethiopian, US, and UK radio plus popular English podcasts in a fast side-panel audio player.

**Single purpose:** WaveNest helps users find, organize, and play live radio stations and podcast episodes without leaving Chrome.

**Detailed description:**

WaveNest brings Ethiopian radio, popular US and UK stations, VOA, music, news, technology shows, and English podcasts into one easy player.

- Browse by Local, English, Ethiopia, USA, UK, radio, podcast, and topic.
- Narrow music and technology results with useful subcategories.
- Pin favorites for fast access.
- Control play, pause, previous, next, mute, and volume from a compact popup.
- Expand into a full side panel and collapse without interrupting playback.
- Continue listening while the popup is closed.

Some stations and episodes are provided by third parties and can occasionally be offline, region-restricted, or use an unsupported format.

## Permission justifications

- **storage:** Saves favorites, player preferences, cached catalog metadata, resume position, and playback status locally in the user's Chrome profile.
- **offscreen:** Hosts the audio element required for playback to continue after the popup or side panel closes.
- **sidePanel:** Provides the full browsing and player interface in Chrome's side panel.
- **Host access:** Fetches radio-directory metadata, bundled podcast RSS feeds, and the specific HLS/audio endpoints declared in the manifest. It does not read or alter pages the user visits.

## Privacy dashboard answers

- Remote code: **No.** All executable JavaScript, including React and hls.js, is bundled inside the extension ZIP. Remote responses are data, RSS, images, playlists, and audio—not executable code.
- Advertising: **None.**
- Analytics: **None.**
- Developer-operated backend: **None.**
- Privacy policy URL: `https://github.com/Tbe24/WaveNest/blob/main/PRIVACY.md`

Review the dashboard's current data-use categories against [PRIVACY.md](PRIVACY.md). Playback choices and favorites are stored locally; the developer does not receive them.

## Artwork checklist

- Package icons: 16, 32, 48, and 128 px PNG (included).
- Store icon: supplied from the packaged 128 px icon.
- At least one screenshot showing the full side panel. Use 1280×800 or 640×400.
- Optional small promotional tile: 440×280.
- Optional marquee promotional image: 1400×560.

Do not place important text near artwork edges. Screenshots should show real WaveNest UI and avoid unrelated browser or personal information.

## Submission checklist

1. Run `npm.cmd run test`.
2. Run `npm.cmd run package`.
3. Test `dist` using Chrome's **Load unpacked** option.
4. Upload `release/WaveNest-1.0.0.zip` to the Chrome Developer Dashboard.
5. Complete Store listing, Privacy practices, and Distribution.
6. Start with **Private** trusted testers if desired, then submit as **Public** when ready.
