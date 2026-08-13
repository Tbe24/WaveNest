export type AudioSourceType = 'radio' | 'podcast_episode';
export type ContentCategory = 'music' | 'news' | 'tech' | 'talk' | 'podcasts';
export type ContentScope = 'local' | 'international';
export type ScopeFilter = 'all' | 'local' | 'english';
export type MarketFilter = 'all' | 'ET' | 'US' | 'GB';
export type RemoteCatalogScope = 'all' | ContentScope;
export type CatalogSource =
  | 'bundled'
  | 'iptv-org'
  | 'radio-browser'
  | 'bundled-podcast'
  | 'imported-m3u'
  | 'imported-rss';
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type ImportKind = 'm3u' | 'rss';

export interface AudioSource {
  id: string;
  type: AudioSourceType;
  title: string;
  streamUrl: string;
  image?: string;
  category: ContentCategory;
  scope: ContentScope;
  source: CatalogSource;
  rank: number;
  tags: string[];
  language?: string;
  countryCode?: string;
  isFeatured: boolean;
  subtitle?: string;
  description?: string;
  homepage?: string;
  feedId?: string;
  publishedAt?: string;
  durationSeconds?: number;
  isLive?: boolean;
  lookupQuery?: string;
  importId?: string;
}

export interface PodcastFeed {
  id: string;
  title: string;
  rssUrl: string;
  image?: string;
  category: ContentCategory;
  scope: ContentScope;
  rank: number;
  description?: string;
  tags?: string[];
}

export interface PlaybackState {
  currentSourceId?: string;
  status: PlaybackStatus;
  volume: number;
  muted: boolean;
  position: number;
  lastPlayedAt?: string;
  error?: string;
  queueIds: string[];
}

export interface CatalogSection {
  id: string;
  title: string;
  items: AudioSource[];
  refreshTtlHours: number;
}

export interface SourceFailure {
  message: string;
  occurredAt: string;
  sourceId?: string;
}

export interface ImportedSourceRecord {
  id: string;
  kind: ImportKind;
  title: string;
  url?: string;
  createdAt: string;
  lastRefreshedAt: string;
  feed?: PodcastFeed;
  items: AudioSource[];
}

export interface CatalogState {
  sources: AudioSource[];
  feeds: PodcastFeed[];
  sections: CatalogSection[];
  lastRemoteRefreshAt?: string;
  lastPodcastRefreshAt?: string;
  isRefreshing: boolean;
  error?: string;
}

export interface SettingsState {
  defaultScope: 'ethiopia+global';
  startupBehavior: 'restore_last_wait_for_play';
  playbackScope: 'in_extension_only';
  scopeFilter: ScopeFilter;
}

export interface RuntimeState {
  settings: SettingsState;
  playback: PlaybackState;
  catalog: CatalogState;
  favorites: string[];
  pinnedCategories: ContentCategory[];
  importedSources: ImportedSourceRecord[];
  failures: Record<string, SourceFailure>;
}

export interface StoredAppState {
  playback: PlaybackState;
  episodeResumePositions: Record<string, number>;
  favorites: string[];
  pinnedCategories: ContentCategory[];
  importedSources: ImportedSourceRecord[];
  failures: Record<string, SourceFailure>;
  lastRemoteRefreshAt?: string;
  lastPodcastRefreshAt?: string;
  cachedRemoteSources: AudioSource[];
  cachedPodcastEpisodes: AudioSource[];
  cachedPodcastFeeds: PodcastFeed[];
  settings: SettingsState;
}

export interface BundledCatalog {
  stations: AudioSource[];
  feeds: PodcastFeed[];
}

export interface RemoteCatalogResult {
  sources: AudioSource[];
  fetchedAt: string;
}

export interface PodcastCatalogResult {
  feeds: PodcastFeed[];
  episodes: AudioSource[];
  fetchedAt: string;
}

export interface ParseM3UOptions {
  source?: CatalogSource;
  scope?: ContentScope;
  category?: ContentCategory;
  countryCode?: string;
  language?: string;
  rankBase?: number;
  featured?: boolean;
  extraTags?: string[];
  importId?: string;
}

export interface ParsePodcastFeedOptions {
  source?: CatalogSource;
  scope?: ContentScope;
  category?: ContentCategory;
  rankBase?: number;
  feedId?: string;
  importId?: string;
  fallbackTitle?: string;
  fallbackUrl?: string;
  extraTags?: string[];
}

export type PlaybackCommand =
  | {
      type: 'LOAD_SOURCE';
      source: AudioSource;
      queueIds?: string[];
      autoplay?: boolean;
      position?: number;
      volume?: number;
      muted?: boolean;
    }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'SEEK'; position: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_MUTED'; muted: boolean }
  | { type: 'TOGGLE_MUTE' };

export type RuntimeMessage =
  | { type: 'GET_STATE' }
  | { type: 'REFRESH_CATALOG'; scope: RemoteCatalogScope }
  | { type: 'LOAD_SOURCE'; source: AudioSource; queueIds?: string[]; autoplay?: boolean }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'SEEK'; position: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'REQUEST_QUEUE_JUMP'; direction: 'next' | 'previous' }
  | { type: 'SYNC_STATE' }
  | { type: 'REPORT_ERROR'; sourceId?: string; message: string }
  | { type: 'IMPORT_REMOTE_SOURCE'; url: string; kind: ImportKind }
  | { type: 'IMPORT_LOCAL_SOURCE'; rawText: string; kind: ImportKind; title: string }
  | { type: 'TOGGLE_FAVORITE'; sourceId: string }
  | { type: 'SET_SCOPE_FILTER'; scopeFilter: ScopeFilter }
  | { type: 'PIN_CATEGORY'; category: ContentCategory }
  | { type: 'CLEAR_FAILURE'; sourceId: string }
  | { type: 'OPEN_SIDE_PANEL'; windowId?: number }
  | { type: 'CLOSE_SIDE_PANEL' }
  | { type: 'STOP_AND_CLOSE' }
  | { type: 'OFFSCREEN_CONTROL'; command: PlaybackCommand }
  | { type: 'OFFSCREEN_READY' }
  | { type: 'OFFSCREEN_PLAYBACK_PATCH'; patch: Partial<PlaybackState> };

export type RuntimeMessageResponse =
  | { ok: true; state?: RuntimeState; imported?: ImportedSourceRecord }
  | { ok: false; error: string };
