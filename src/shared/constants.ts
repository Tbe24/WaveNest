import type {
  AudioSource,
  CatalogState,
  PlaybackState,
  SettingsState,
  StoredAppState
} from './types';

export const APP_STORAGE_KEY = 'chrome-audio-hub-state';
export const REMOTE_RADIO_TTL_HOURS = 12;
export const PODCAST_TTL_HOURS = 24;

// Known non-audio or unreliable catalog entries that should never be shown.
// Mereja is an IPTV video feed rather than a dependable radio stream.
export const BLOCKED_SOURCE_IDS = new Set([
  'mereja-tv-1080p-not-24-7-https-rumble-com-live-hls-dvr-4c14o3-playlist-m3u8'
]);

export const DEFAULT_SETTINGS: SettingsState = {
  defaultScope: 'ethiopia+global',
  startupBehavior: 'restore_last_wait_for_play',
  playbackScope: 'in_extension_only',
  scopeFilter: 'all'
};

export function createEmptyPlaybackState(): PlaybackState {
  return {
    currentSourceId: undefined,
    status: 'idle',
    volume: 0.8,
    muted: false,
    position: 0,
    lastPlayedAt: undefined,
    error: undefined,
    queueIds: []
  };
}

export function createEmptyCatalogState(): CatalogState {
  return {
    sources: [],
    feeds: [],
    sections: [],
    isRefreshing: false
  };
}

export function createEmptyStoredState(): StoredAppState {
  return {
    playback: createEmptyPlaybackState(),
    episodeResumePositions: {},
    favorites: [],
    pinnedCategories: ['music', 'news', 'tech'],
    importedSources: [],
    failures: {},
    cachedRemoteSources: [],
    cachedPodcastEpisodes: [],
    cachedPodcastFeeds: [],
    settings: { ...DEFAULT_SETTINGS }
  };
}

export const EMPTY_PLAYBACK_STATE = createEmptyPlaybackState();
export const EMPTY_CATALOG_STATE = createEmptyCatalogState();
export const EMPTY_STORED_STATE = createEmptyStoredState();

export const IPTV_PLAYLISTS: Array<{
  url: string;
  scope: 'all' | 'local' | 'international';
  category?: AudioSource['category'];
  countryCode?: string;
  language?: string;
  extraTags?: string[];
}> = [
  {
    url: 'https://iptv-org.github.io/iptv/countries/et.m3u',
    scope: 'local',
    countryCode: 'ET',
    language: 'Amharic',
    extraTags: ['ethiopia', 'local']
  },
  {
    url: 'https://iptv-org.github.io/iptv/languages/amh.m3u',
    scope: 'local',
    language: 'Amharic',
    countryCode: 'ET',
    extraTags: ['amharic', 'ethiopia']
  },
  {
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    scope: 'all',
    category: 'music',
    extraTags: ['music']
  },
  {
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    scope: 'all',
    category: 'news',
    extraTags: ['news']
  },
  {
    url: 'https://iptv-org.github.io/iptv/countries/int.m3u',
    scope: 'international',
    extraTags: ['international']
  }
];

export const RADIO_BROWSER_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info'
];

export const HIT_RADIO_TERMS = [
  'hit',
  'hits',
  'top',
  'top40',
  'top 40',
  'chart',
  'charts',
  'pop',
  'hot'
];

export const NEWS_TERMS = ['news', 'world', 'headline', 'talk', 'public'];
export const TECH_TERMS = ['tech', 'technology', 'developer', 'software', 'startup'];
export const PODCAST_TERMS = ['podcast', 'episode', 'show'];
