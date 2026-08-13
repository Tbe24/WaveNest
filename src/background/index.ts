import {
  createEmptyCatalogState,
  PODCAST_TTL_HOURS,
  REMOTE_RADIO_TTL_HOURS
} from '../shared/constants';
import {
  importLocalSource,
  importRemoteSource,
  loadBundledCatalog,
  refreshImportedSources,
  refreshBundledPodcastFeeds,
  refreshRemoteCatalog
} from '../shared/services/catalogService';
import { buildCatalogSections, combineCatalogSources, mergePodcastFeeds } from '../shared/services/ranking';
import { restorePlaybackState } from '../shared/services/startup';
import { readStoredState, writeStoredState } from '../shared/services/storage';
import type {
  AudioSource,
  BundledCatalog,
  CatalogState,
  ContentCategory,
  PlaybackCommand,
  RuntimeMessage,
  RuntimeMessageResponse,
  RuntimeState,
  StoredAppState
} from '../shared/types';
import { isStale } from '../shared/utils';

let storedState: StoredAppState | null = null;
let bundledCatalog: BundledCatalog | null = null;
let runtimeState: RuntimeState | null = null;
let refreshPromise: Promise<void> | null = null;
let offscreenReadyResolver: (() => void) | null = null;
let volumePersistTimer: ReturnType<typeof setTimeout> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function ensureStoredState(): Promise<StoredAppState> {
  if (!storedState) {
    storedState = await readStoredState();
  }

  return storedState;
}

async function ensureBundledCatalog(): Promise<BundledCatalog> {
  if (!bundledCatalog) {
    bundledCatalog = await loadBundledCatalog();
  }

  return bundledCatalog;
}

async function persistStoredState(): Promise<void> {
  if (storedState) {
    await writeStoredState(storedState);
  }
}

async function rebuildRuntimeState(options: { isRefreshing?: boolean; error?: string; restorePlayback?: boolean } = {}): Promise<RuntimeState> {
  const localStoredState = await ensureStoredState();
  const localBundledCatalog = await ensureBundledCatalog();
  const importedItems = localStoredState.importedSources.flatMap((record) => record.items);
  const mergedFeeds = mergePodcastFeeds(localBundledCatalog.feeds, localStoredState.cachedPodcastFeeds);
  const sources = combineCatalogSources({
    bundledSources: localBundledCatalog.stations,
    remoteSources: localStoredState.cachedRemoteSources,
    podcastEpisodes: localStoredState.cachedPodcastEpisodes,
    importedItems
  });
  // Only convert a previously-playing session to paused when the service worker
  // starts. Live rebuilds must preserve the status reported by the audio player.
  const playback = options.restorePlayback ?? runtimeState === null
    ? restorePlaybackState(localStoredState.playback, sources)
    : { ...localStoredState.playback };
  const catalog: CatalogState = {
    ...createEmptyCatalogState(),
    sources,
    feeds: mergedFeeds,
    sections: buildCatalogSections({
      sources,
      favorites: localStoredState.favorites,
      scopeFilter: localStoredState.settings.scopeFilter,
      pinnedCategories: localStoredState.pinnedCategories,
      currentSourceId: playback.currentSourceId
    }),
    lastRemoteRefreshAt: localStoredState.lastRemoteRefreshAt,
    lastPodcastRefreshAt: localStoredState.lastPodcastRefreshAt,
    isRefreshing: options.isRefreshing ?? false,
    error: options.error
  };

  localStoredState.playback = playback;
  runtimeState = {
    settings: localStoredState.settings,
    playback,
    catalog,
    favorites: localStoredState.favorites,
    pinnedCategories: localStoredState.pinnedCategories,
    importedSources: localStoredState.importedSources,
    failures: localStoredState.failures
  };

  return runtimeState;
}

async function broadcastState(): Promise<void> {
  if (!runtimeState) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'STATE_UPDATED',
      state: runtimeState
    });
  } catch {
    // Ignore when no popup or side panel is currently listening.
  }
}

async function getOffscreenContexts(documentUrl: string): Promise<chrome.runtime.ExtensionContext[]> {
  return new Promise((resolve) => {
    chrome.runtime.getContexts(
      {
        contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        documentUrls: [documentUrl]
      },
      (contexts) => resolve(contexts ?? [])
    );
  });
}

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const contexts = await getOffscreenContexts(offscreenUrl);

  if (contexts.length > 0) {
    return;
  }

  const readyPromise = new Promise<void>((resolve) => {
    offscreenReadyResolver = resolve;
  });

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play radio and podcast audio while the popup and side panel are closed.'
  });

  await Promise.race([readyPromise, delay(500)]);
}

async function postToOffscreen(command: PlaybackCommand): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_CONTROL',
    command
  } satisfies RuntimeMessage);
}

function mergeScopedSources(
  existingItems: AudioSource[],
  nextItems: AudioSource[],
  scope: 'all' | 'local' | 'international'
): AudioSource[] {
  if (scope === 'all') {
    return nextItems;
  }

  return [...existingItems.filter((item) => item.scope !== scope), ...nextItems];
}

function mergeScopedFeeds<T extends { scope: 'local' | 'international' }>(
  existingItems: T[],
  nextItems: T[],
  scope: 'all' | 'local' | 'international'
): T[] {
  if (scope === 'all') {
    return nextItems;
  }

  return [...existingItems.filter((item) => item.scope !== scope), ...nextItems];
}

function getCurrentSource(): AudioSource | undefined {
  if (!runtimeState?.playback.currentSourceId) {
    return undefined;
  }

  return runtimeState.catalog.sources.find((source) => source.id === runtimeState?.playback.currentSourceId);
}

async function applyPlaybackPatch(patch: Partial<RuntimeState['playback']>): Promise<void> {
  const localStoredState = await ensureStoredState();
  const nextPlayback = {
    ...localStoredState.playback,
    ...patch
  };

  localStoredState.playback = nextPlayback;

  if (nextPlayback.currentSourceId && typeof nextPlayback.position === 'number') {
    const resumeSource = runtimeState?.catalog.sources.find(
      (source) => source.id === nextPlayback.currentSourceId
    );

    if (resumeSource?.type === 'podcast_episode') {
      localStoredState.episodeResumePositions[nextPlayback.currentSourceId] = nextPlayback.position;
    }
  }

  await persistStoredState();
  await rebuildRuntimeState({
    isRefreshing: runtimeState?.catalog.isRefreshing
  });
  await broadcastState();
}

async function recordFailure(sourceId: string | undefined, message: string): Promise<void> {
  const localStoredState = await ensureStoredState();
  const failureKey = sourceId ?? 'global';

  localStoredState.failures[failureKey] = {
    message,
    sourceId,
    occurredAt: new Date().toISOString()
  };

  localStoredState.playback = {
    ...localStoredState.playback,
    status: 'error',
    error: message
  };

  await persistStoredState();
  await rebuildRuntimeState({
    error: message,
    isRefreshing: runtimeState?.catalog.isRefreshing
  });
  await broadcastState();
}

async function selectSource(
  source: AudioSource,
  queueIds: string[],
  autoplay: boolean,
  position?: number
): Promise<void> {
  const localStoredState = await ensureStoredState();
  const resumePosition =
    typeof position === 'number'
      ? position
      : source.type === 'podcast_episode'
        ? localStoredState.episodeResumePositions[source.id] ?? 0
        : 0;

  localStoredState.playback = {
    ...localStoredState.playback,
    currentSourceId: source.id,
    queueIds,
    position: resumePosition,
    status: autoplay ? 'loading' : 'paused',
    error: undefined
  };

  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
  await ensureOffscreenDocument();
  await postToOffscreen({
    type: 'LOAD_SOURCE',
    source,
    queueIds,
    autoplay,
    position: resumePosition,
    volume: localStoredState.playback.volume,
    muted: localStoredState.playback.muted
  });
}

async function playCurrentSource(): Promise<void> {
  const currentSource = getCurrentSource();
  if (!currentSource) {
    throw new Error('No source selected.');
  }

  const queueIds = runtimeState?.playback.queueIds.length
    ? runtimeState.playback.queueIds
    : [currentSource.id];

  await ensureOffscreenDocument();
  await postToOffscreen({
    type: 'LOAD_SOURCE',
    source: currentSource,
    queueIds,
    autoplay: true,
    position: runtimeState?.playback.position ?? 0,
    volume: runtimeState?.playback.volume ?? 0.8,
    muted: runtimeState?.playback.muted ?? false
  });
}

async function setVolume(volume: number): Promise<void> {
  const safeVolume = Math.min(1, Math.max(0, volume));
  // Change the real audio first. Persisting on every slider step used to make
  // audible changes wait behind storage writes and full catalog rebuilds.
  await postToOffscreen({ type: 'SET_VOLUME', volume: safeVolume });

  const localStoredState = await ensureStoredState();
  localStoredState.playback = {
    ...localStoredState.playback,
    volume: safeVolume,
    muted: safeVolume > 0 ? false : localStoredState.playback.muted
  };
  if (runtimeState) {
    runtimeState = { ...runtimeState, playback: { ...localStoredState.playback } };
  }

  if (volumePersistTimer) {
    clearTimeout(volumePersistTimer);
  }
  volumePersistTimer = setTimeout(() => {
    volumePersistTimer = null;
    void (async () => {
      await persistStoredState();
      await broadcastState();
    })();
  }, 200);
}

async function toggleMute(): Promise<void> {
  const muted = !(runtimeState?.playback.muted ?? false);
  await ensureOffscreenDocument();
  await postToOffscreen({ type: 'SET_MUTED', muted });
  await applyPlaybackPatch({ muted });
}

async function jumpQueue(direction: 'next' | 'previous'): Promise<void> {
  if (!runtimeState?.playback.currentSourceId) {
    return;
  }

  const queueIds =
    runtimeState.playback.queueIds.length > 0
      ? runtimeState.playback.queueIds
      : runtimeState.catalog.sources.map((source) => source.id);
  const currentIndex = queueIds.indexOf(runtimeState.playback.currentSourceId);

  if (currentIndex < 0 || queueIds.length === 0) {
    return;
  }

  const offset = direction === 'next' ? 1 : -1;
  const targetIndex = (currentIndex + offset + queueIds.length) % queueIds.length;
  const targetSourceId = queueIds[targetIndex];
  const targetSource = runtimeState.catalog.sources.find((source) => source.id === targetSourceId);

  if (!targetSource) {
    return;
  }

  await selectSource(targetSource, queueIds, true, 0);
}

async function maybeRefreshCatalog(): Promise<void> {
  const localStoredState = await ensureStoredState();
  const localBundledCatalog = await ensureBundledCatalog();
  const remoteIsStale = isStale(localStoredState.lastRemoteRefreshAt, REMOTE_RADIO_TTL_HOURS);
  const podcastIsStale = isStale(localStoredState.lastPodcastRefreshAt, PODCAST_TTL_HOURS);
  const cachedFeedIds = new Set(localStoredState.cachedPodcastFeeds.map((feed) => feed.id));
  const hasNewBundledFeeds = localBundledCatalog.feeds.some((feed) => !cachedFeedIds.has(feed.id));

  if (remoteIsStale || podcastIsStale || hasNewBundledFeeds) {
    void refreshCatalog('all');
  }
}

async function refreshCatalog(scope: 'all' | 'local' | 'international'): Promise<void> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const localStoredState = await ensureStoredState();
    const localBundledCatalog = await ensureBundledCatalog();

    await rebuildRuntimeState({ isRefreshing: true });
    await broadcastState();

    try {
      const [remoteCatalog, podcastCatalog, refreshedImports] = await Promise.all([
        refreshRemoteCatalog(scope),
        refreshBundledPodcastFeeds(localBundledCatalog.feeds, scope),
        refreshImportedSources(localStoredState.importedSources)
      ]);

      localStoredState.cachedRemoteSources = mergeScopedSources(
        localStoredState.cachedRemoteSources,
        remoteCatalog.sources,
        scope
      );
      localStoredState.lastRemoteRefreshAt = remoteCatalog.fetchedAt;
      localStoredState.cachedPodcastEpisodes = mergeScopedSources(
        localStoredState.cachedPodcastEpisodes,
        podcastCatalog.episodes,
        scope
      );
      localStoredState.cachedPodcastFeeds = mergeScopedFeeds(
        localStoredState.cachedPodcastFeeds,
        podcastCatalog.feeds,
        scope
      );
      localStoredState.lastPodcastRefreshAt = podcastCatalog.fetchedAt;
      localStoredState.importedSources = refreshedImports;

      await persistStoredState();
      await rebuildRuntimeState();
      await broadcastState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh the catalog.';
      await rebuildRuntimeState({
        error: message
      });
      await broadcastState();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function toggleFavorite(sourceId: string): Promise<void> {
  const localStoredState = await ensureStoredState();
  const favorites = new Set(localStoredState.favorites);
  if (favorites.has(sourceId)) {
    favorites.delete(sourceId);
  } else {
    favorites.add(sourceId);
  }

  localStoredState.favorites = [...favorites];
  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
}

async function togglePinnedCategory(category: ContentCategory): Promise<void> {
  const localStoredState = await ensureStoredState();
  const pinnedCategories = new Set(localStoredState.pinnedCategories);
  if (pinnedCategories.has(category)) {
    pinnedCategories.delete(category);
  } else {
    pinnedCategories.add(category);
  }

  localStoredState.pinnedCategories = [...pinnedCategories];
  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
}

async function setScopeFilter(scopeFilter: RuntimeState['settings']['scopeFilter']): Promise<void> {
  const localStoredState = await ensureStoredState();
  localStoredState.settings = {
    ...localStoredState.settings,
    scopeFilter
  };
  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
}

async function clearFailure(sourceId: string): Promise<void> {
  const localStoredState = await ensureStoredState();
  delete localStoredState.failures[sourceId];
  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
}

async function openSidePanel(windowId?: number): Promise<void> {
  const localWindowId = windowId ?? (await chrome.windows.getLastFocused()).id;
  if (!localWindowId) {
    return;
  }

  await chrome.sidePanel.open({ windowId: localWindowId });
}

async function stopPlayback(): Promise<void> {
  await ensureOffscreenDocument();
  await postToOffscreen({ type: 'STOP' });
  await applyPlaybackPatch({
    currentSourceId: undefined,
    queueIds: [],
    position: 0,
    status: 'idle',
    error: undefined
  });
}

async function closeSidePanel(openCompactPlayer = false): Promise<void> {
  // Chrome 116 has no sidePanel.close(). Temporarily disabling the registered
  // panel closes it; re-enabling keeps it available for the next toolbar click.
  await chrome.sidePanel.setOptions({ enabled: false });
  await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });

  if (openCompactPlayer) {
    // Newer Chrome versions can reopen the toolbar popup after collapsing the
    // panel. Older versions simply close the panel; the next toolbar click
    // opens the same compact player.
    try {
      await chrome.action.openPopup();
    } catch {
      // openPopup is unavailable or disallowed on some supported Chrome builds.
    }
  }
}

async function stopAndCloseSidePanel(): Promise<void> {
  await stopPlayback();
  await closeSidePanel();
}

async function importRemote(url: string, kind: 'm3u' | 'rss') {
  const localStoredState = await ensureStoredState();
  const imported = await importRemoteSource(url, kind);
  localStoredState.importedSources = [...localStoredState.importedSources, imported];
  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
  return imported;
}

async function importLocal(rawText: string, kind: 'm3u' | 'rss', title: string) {
  const localStoredState = await ensureStoredState();
  const imported = importLocalSource(rawText, kind, title);
  localStoredState.importedSources = [...localStoredState.importedSources, imported];
  await persistStoredState();
  await rebuildRuntimeState();
  await broadcastState();
  return imported;
}

async function handleMessage(message: RuntimeMessage): Promise<RuntimeMessageResponse> {
  await rebuildRuntimeState({
    isRefreshing: runtimeState?.catalog.isRefreshing
  });

  switch (message.type) {
    case 'GET_STATE':
      void maybeRefreshCatalog();
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'REFRESH_CATALOG':
      await refreshCatalog(message.scope);
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'LOAD_SOURCE':
      await selectSource(message.source, message.queueIds ?? [message.source.id], Boolean(message.autoplay));
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'PLAY':
      await playCurrentSource();
      return {
        ok: true
      };
    case 'PAUSE':
      await postToOffscreen({ type: 'PAUSE' });
      return {
        ok: true
      };
    case 'STOP':
      await stopPlayback();
      return { ok: true, state: runtimeState ?? undefined };
    case 'SEEK':
      await postToOffscreen({ type: 'SEEK', position: message.position });
      return {
        ok: true
      };
    case 'SET_VOLUME':
      await setVolume(message.volume);
      return {
        ok: true
      };
    case 'TOGGLE_MUTE':
      await toggleMute();
      return {
        ok: true
      };
    case 'SYNC_STATE':
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'REPORT_ERROR':
      await recordFailure(message.sourceId, message.message);
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'IMPORT_REMOTE_SOURCE':
      return {
        ok: true,
        imported: await importRemote(message.url, message.kind),
        state: runtimeState ?? undefined
      };
    case 'IMPORT_LOCAL_SOURCE':
      return {
        ok: true,
        imported: await importLocal(message.rawText, message.kind, message.title),
        state: runtimeState ?? undefined
      };
    case 'TOGGLE_FAVORITE':
      await toggleFavorite(message.sourceId);
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'SET_SCOPE_FILTER':
      await setScopeFilter(message.scopeFilter);
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'PIN_CATEGORY':
      await togglePinnedCategory(message.category);
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'CLEAR_FAILURE':
      await clearFailure(message.sourceId);
      return {
        ok: true,
        state: runtimeState ?? undefined
      };
    case 'OPEN_SIDE_PANEL':
      await openSidePanel(message.windowId);
      return {
        ok: true
      };
    case 'CLOSE_SIDE_PANEL':
      await closeSidePanel(true);
      return { ok: true, state: runtimeState ?? undefined };
    case 'STOP_AND_CLOSE':
      await stopAndCloseSidePanel();
      return { ok: true, state: runtimeState ?? undefined };
    case 'REQUEST_QUEUE_JUMP':
      await jumpQueue(message.direction);
      return {
        ok: true
      };
    case 'OFFSCREEN_READY':
      offscreenReadyResolver?.();
      offscreenReadyResolver = null;
      return {
        ok: true
      };
    case 'OFFSCREEN_PLAYBACK_PATCH':
      await applyPlaybackPatch(message.patch);
      return {
        ok: true
      };
    case 'OFFSCREEN_CONTROL':
      return {
        ok: true
      };
    default:
      return {
        ok: false,
        error: 'Unsupported message type.'
      };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureStoredState();
    await rebuildRuntimeState();
    await persistStoredState();
    await chrome.sidePanel.setOptions({
      path: 'sidepanel.html',
      enabled: true
    });
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void rebuildRuntimeState();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    void openSidePanel();
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected extension error.'
      } satisfies RuntimeMessageResponse)
    );

  return true;
});
