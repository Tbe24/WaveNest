import { useEffect, useState } from 'react';
import type { AudioSource, ImportKind, RemoteCatalogScope, RuntimeState, ScopeFilter } from '../types';
import { sendRuntimeMessage, subscribeToRuntimeState } from '../services/runtimeBridge';

export function useRuntimeState() {
  const [state, setState] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void sendRuntimeMessage({ type: 'GET_STATE' })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        if (response.ok && response.state) {
          setState(response.state);
          setError(null);
        } else if (!response.ok) {
          setError(response.error);
        }
      })
      .catch((reason) => {
        if (!isMounted) {
          return;
        }

        setError(reason instanceof Error ? reason.message : 'Unable to load extension state.');
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const unsubscribe = subscribeToRuntimeState((nextState) => {
      if (isMounted) {
        setState(nextState);
        setError(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const currentSource = state?.catalog.sources.find((source) => source.id === state.playback.currentSourceId);

  async function request(message: Parameters<typeof sendRuntimeMessage>[0]) {
    const response = await sendRuntimeMessage(message);
    if (!response.ok) {
      setError(response.error);
      return response;
    }

    if (response.state) {
      setState(response.state);
    }
    setError(null);
    return response;
  }

  return {
    state,
    currentSource,
    loading,
    error,
    refreshCatalog: async (scope: RemoteCatalogScope = 'all') => request({ type: 'REFRESH_CATALOG', scope }),
    loadSource: async (source: AudioSource, queueIds: string[], autoplay = true) =>
      request({ type: 'LOAD_SOURCE', source, queueIds, autoplay }),
    play: async () => request({ type: 'PLAY' }),
    pause: async () => request({ type: 'PAUSE' }),
    stop: async () => request({ type: 'STOP' }),
    closeSidePanel: async () => request({ type: 'CLOSE_SIDE_PANEL' }),
    stopAndClose: async () => request({ type: 'STOP_AND_CLOSE' }),
    seek: async (position: number) => request({ type: 'SEEK', position }),
    setVolume: async (volume: number) => {
      // Keep the slider responsive while the offscreen player catches up.
      setState((current) => current ? {
        ...current,
        playback: { ...current.playback, volume, muted: volume === 0 ? current.playback.muted : false }
      } : current);
      return request({ type: 'SET_VOLUME', volume });
    },
    toggleMute: async () => {
      setState((current) => current ? {
        ...current,
        playback: { ...current.playback, muted: !current.playback.muted }
      } : current);
      return request({ type: 'TOGGLE_MUTE' });
    },
    previous: async () => request({ type: 'REQUEST_QUEUE_JUMP', direction: 'previous' }),
    next: async () => request({ type: 'REQUEST_QUEUE_JUMP', direction: 'next' }),
    toggleFavorite: async (sourceId: string) => request({ type: 'TOGGLE_FAVORITE', sourceId }),
    setScopeFilter: async (scopeFilter: ScopeFilter) => request({ type: 'SET_SCOPE_FILTER', scopeFilter }),
    togglePinnedCategory: async (category: RuntimeState['pinnedCategories'][number]) =>
      request({ type: 'PIN_CATEGORY', category }),
    clearFailure: async (sourceId: string) => request({ type: 'CLEAR_FAILURE', sourceId }),
    importRemoteSource: async (url: string, kind: ImportKind) =>
      request({ type: 'IMPORT_REMOTE_SOURCE', url, kind }),
    importLocalSource: async (rawText: string, kind: ImportKind, title: string) =>
      request({ type: 'IMPORT_LOCAL_SOURCE', rawText, kind, title })
  };
}
