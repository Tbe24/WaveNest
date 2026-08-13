import { APP_STORAGE_KEY, BLOCKED_SOURCE_IDS, createEmptyStoredState } from '../constants';
import type { StoredAppState } from '../types';

let memoryState: StoredAppState = createEmptyStoredState();

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

export async function readStoredState(): Promise<StoredAppState> {
  if (!hasChromeStorage()) {
    const defaults = createEmptyStoredState();
    return {
      ...defaults,
      ...memoryState,
      playback: {
        ...defaults.playback,
        ...memoryState.playback
      },
      settings: {
        ...defaults.settings,
        ...memoryState.settings
      }
    };
  }

  const result = await chrome.storage.local.get(APP_STORAGE_KEY);
  const defaults = createEmptyStoredState();
  const stored = result[APP_STORAGE_KEY] as Partial<StoredAppState> | undefined;
  type LegacySettings = Omit<Partial<StoredAppState['settings']>, 'scopeFilter'> & {
    scopeFilter?: StoredAppState['settings']['scopeFilter'] | 'international';
  };
  const storedSettings = stored?.settings as LegacySettings | undefined;
  const migratedScopeFilter = storedSettings?.scopeFilter === 'international'
    ? 'english'
    : storedSettings?.scopeFilter;
  const storedFailures = { ...stored?.failures };
  const retiredIptvIds = (stored?.cachedRemoteSources ?? [])
    .filter((source) => source.source === 'iptv-org')
    .map((source) => source.id);
  retiredIptvIds.forEach((sourceId) => {
    delete storedFailures[sourceId];
  });
  BLOCKED_SOURCE_IDS.forEach((sourceId) => {
    delete storedFailures[sourceId];
  });

  return {
    ...defaults,
    ...stored,
    failures: storedFailures,
    cachedRemoteSources: (stored?.cachedRemoteSources ?? []).filter(
      (source) => source.source !== 'iptv-org' && !BLOCKED_SOURCE_IDS.has(source.id)
    ),
    playback: {
      ...defaults.playback,
      ...stored?.playback
    },
    settings: {
      ...defaults.settings,
      ...storedSettings,
      scopeFilter: migratedScopeFilter ?? defaults.settings.scopeFilter
    }
  };
}

export async function writeStoredState(nextState: StoredAppState): Promise<void> {
  memoryState = { ...nextState };

  if (!hasChromeStorage()) {
    return;
  }

  await chrome.storage.local.set({
    [APP_STORAGE_KEY]: nextState
  });
}
