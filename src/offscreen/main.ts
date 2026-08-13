// The light build keeps core HLS audio playback while omitting features such
// as subtitles and alternate-video handling that an audio-only player doesn't use.
import Hls from 'hls.js/light';
import type { AudioSource, PlaybackCommand, PlaybackState, RuntimeMessage } from '../shared/types';

const audio = new Audio();
audio.preload = 'none';

let currentSource: AudioSource | null = null;
let currentQueueIds: string[] = [];
let lastPositionSent = 0;
let hls: Hls | null = null;

function destroyHls(): void {
  hls?.destroy();
  hls = null;
}

async function loadAudioUrl(url: string): Promise<void> {
  destroyHls();

  let resolvedUrl = url;
  if (url.includes('stream-al.hellorayo.co.uk/')) {
    const streamUrl = new URL(url);
    streamUrl.searchParams.set('aw_0_1st.skey', String(Math.floor(Date.now() / 1000)));
    resolvedUrl = streamUrl.toString();
  }

  if (!resolvedUrl.toLowerCase().includes('.m3u8') || !Hls.isSupported()) {
    audio.src = resolvedUrl;
    return;
  }

  // Desktop Chrome does not consistently play HLS through <audio> directly.
  // hls.js converts the playlist into Media Source segments for the same player.
  await new Promise<void>((resolve, reject) => {
    const nextHls = new Hls({ enableWorker: false });
    hls = nextHls;
    nextHls.once(Hls.Events.MEDIA_ATTACHED, () => nextHls.loadSource(resolvedUrl));
    nextHls.once(Hls.Events.MANIFEST_PARSED, () => resolve());
    nextHls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        reject(new Error(`HLS stream error: ${data.details}`));
      }
    });
    nextHls.attachMedia(audio);
  });
}

async function sendMessage(message: RuntimeMessage): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // Ignore transient background availability issues.
  }
}

function emitPatch(patch: Partial<PlaybackState>): void {
  void sendMessage({
    type: 'OFFSCREEN_PLAYBACK_PATCH',
    patch
  });
}

function syncMediaSession(): void {
  if (!('mediaSession' in navigator) || !currentSource) {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentSource.title,
    artist: currentSource.subtitle ?? (currentSource.isLive ? 'Live Radio' : 'Podcast'),
    album: currentSource.scope === 'local' ? 'Ethiopia + Global' : 'International Picks',
    artwork: currentSource.image
      ? [
          {
            src: currentSource.image,
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      : []
  });

  navigator.mediaSession.setActionHandler('play', () => {
    void runPlaybackCommand({ type: 'PLAY' });
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    void runPlaybackCommand({ type: 'PAUSE' });
  });
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number') {
      void runPlaybackCommand({ type: 'SEEK', position: details.seekTime });
    }
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    void sendMessage({
      type: 'REQUEST_QUEUE_JUMP',
      direction: 'previous'
    });
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    void sendMessage({
      type: 'REQUEST_QUEUE_JUMP',
      direction: 'next'
    });
  });
}

function applyPosition(position = 0): void {
  try {
    audio.currentTime = Math.max(position, 0);
  } catch {
    // Some streams will reject seeking until metadata is ready.
  }
}

async function handlePlaybackCommand(command: PlaybackCommand): Promise<void> {
  switch (command.type) {
    case 'LOAD_SOURCE': {
      const isSameSource = currentSource?.streamUrl === command.source.streamUrl;
      currentSource = command.source;
      currentQueueIds = command.queueIds ?? [command.source.id];
      audio.volume = command.volume ?? audio.volume;
      audio.muted = command.muted ?? audio.muted;

      if (!isSameSource) {
        await loadAudioUrl(command.source.streamUrl);
        emitPatch({
          currentSourceId: command.source.id,
          queueIds: currentQueueIds,
          status: 'loading'
        });
      }

      syncMediaSession();

      if (typeof command.position === 'number') {
        if (audio.readyState >= 1) {
          applyPosition(command.position);
        } else {
          audio.addEventListener(
            'loadedmetadata',
            () => {
              applyPosition(command.position);
            },
            { once: true }
          );
        }
      }

      if (command.autoplay) {
        await audio.play();
      } else {
        audio.pause();
        emitPatch({
          currentSourceId: command.source.id,
          queueIds: currentQueueIds,
          position: typeof command.position === 'number' ? command.position : audio.currentTime || 0,
          status: 'paused'
        });
      }
      break;
    }
    case 'PLAY':
      await audio.play();
      break;
    case 'PAUSE':
      audio.pause();
      break;
    case 'STOP':
      audio.pause();
      destroyHls();
      audio.removeAttribute('src');
      audio.load();
      currentSource = null;
      currentQueueIds = [];
      emitPatch({
        currentSourceId: undefined,
        queueIds: [],
        position: 0,
        status: 'idle',
        error: undefined
      });
      break;
    case 'SEEK':
      applyPosition(command.position);
      emitPatch({
        position: audio.currentTime
      });
      break;
    case 'SET_VOLUME':
      audio.volume = command.volume;
      if (command.volume > 0) {
        audio.muted = false;
      }
      break;
    case 'SET_MUTED':
      audio.muted = command.muted;
      break;
    case 'TOGGLE_MUTE':
      audio.muted = !audio.muted;
      emitPatch({
        muted: audio.muted
      });
      break;
  }
}

async function runPlaybackCommand(command: PlaybackCommand): Promise<void> {
  try {
    await handlePlaybackCommand(command);
  } catch (error) {
    // Selecting another station interrupts the old play() promise. That is a
    // normal cancellation, so it should not appear as an uncaught console error.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    const message = "Can't play this source right now. It may be offline or use an unsupported audio format.";
    emitPatch({ status: 'error', error: message });
    await sendMessage({
      type: 'REPORT_ERROR',
      sourceId: currentSource?.id,
      message
    });
  }
}

audio.addEventListener('play', () => {
  emitPatch({
    currentSourceId: currentSource?.id,
    queueIds: currentQueueIds,
    status: 'playing',
    volume: audio.volume,
    muted: audio.muted,
    lastPlayedAt: new Date().toISOString()
  });
});

audio.addEventListener('pause', () => {
  emitPatch({
    currentSourceId: currentSource?.id,
    queueIds: currentQueueIds,
    status: 'paused',
    position: audio.currentTime || 0
  });
});

audio.addEventListener('timeupdate', () => {
  if (Math.abs(audio.currentTime - lastPositionSent) < 5) {
    return;
  }

  lastPositionSent = audio.currentTime;
  emitPatch({
    position: audio.currentTime
  });
});

audio.addEventListener('ended', () => {
  if (currentQueueIds.length > 1) {
    void sendMessage({
      type: 'REQUEST_QUEUE_JUMP',
      direction: 'next'
    });
    return;
  }

  emitPatch({
    status: 'paused',
    position: 0
  });
});

audio.addEventListener('error', () => {
  const message = "Can't play this source right now. It may be offline or use an unsupported audio format.";
  emitPatch({
    status: 'error',
    error: message
  });
  void sendMessage({
    type: 'REPORT_ERROR',
    sourceId: currentSource?.id,
    message
  });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message.type !== 'OFFSCREEN_CONTROL') {
    return;
  }

  void runPlaybackCommand(message.command);
});

void sendMessage({
  type: 'OFFSCREEN_READY'
});
