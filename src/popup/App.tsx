import { NowPlayingCard } from '../shared/components/NowPlayingCard';
import { SourceSection } from '../shared/components/SourceSection';
import { ScopeToggle } from '../shared/components/ScopeToggle';
import { useRuntimeState } from '../shared/hooks/useRuntimeState';

export function App() {
  const runtime = useRuntimeState();
  const topHits = runtime.state?.catalog.sections.find((section) => section.id === 'top-hits')?.items.slice(0, 3) ?? [];
  const favorites = runtime.state?.catalog.sources.filter((source) => runtime.state?.favorites.includes(source.id)) ?? [];

  async function openSidePanel() {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.id) {
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      window.close();
    }
  }

  async function stopAndClose() {
    await runtime.stop();
    window.close();
  }

  return (
    <main className="popup-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">WaveNest</p>
          <h1>Mini Player</h1>
        </div>
        <div className="header-actions">
          <button
            className="ghost-button"
            onClick={() => void runtime.refreshCatalog('all')}
            disabled={runtime.state?.catalog.isRefreshing}
            type="button"
          >
            {runtime.state?.catalog.isRefreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button
            className="icon-button"
            onClick={() => void openSidePanel()}
            aria-label="Open full panel"
            title="Open full panel"
            type="button"
          >
            <span aria-hidden="true">⤢</span>
          </button>
          <button className="close-button" onClick={() => void stopAndClose()} title="Stop audio and close" type="button">
            ×
          </button>
        </div>
      </header>

      <NowPlayingCard
        compact
        source={runtime.currentSource}
        playback={runtime.state?.playback ?? { currentSourceId: undefined, status: 'idle', volume: 0.8, muted: false, position: 0, queueIds: [] }}
        isFavorite={Boolean(runtime.currentSource && runtime.state?.favorites.includes(runtime.currentSource.id))}
        onPlay={() => void runtime.play()}
        onPause={() => void runtime.pause()}
        onStop={() => void runtime.stop()}
        onPrevious={() => void runtime.previous()}
        onNext={() => void runtime.next()}
        onToggleMute={() => void runtime.toggleMute()}
        onVolumeChange={(volume) => void runtime.setVolume(volume)}
        onToggleFavorite={() => {
          if (runtime.currentSource) {
            void runtime.toggleFavorite(runtime.currentSource.id);
          }
        }}
      />

      <section className="quick-browse" aria-label="Choose audio language">
        <span>Browse</span>
        <ScopeToggle
          value={runtime.state?.settings.scopeFilter ?? 'all'}
          onChange={(scope) => void runtime.setScopeFilter(scope)}
        />
      </section>

      <SourceSection
        title="Favorites"
        items={favorites.slice(0, 4)}
        currentSourceId={runtime.state?.playback.currentSourceId}
        favorites={runtime.state?.favorites ?? []}
        failures={runtime.state?.failures ?? {}}
        compact
        onSelect={(source, queueIds) => void runtime.loadSource(source, queueIds, true)}
        onToggleFavorite={(sourceId) => void runtime.toggleFavorite(sourceId)}
      />

      <SourceSection
        title="Top Hits"
        items={topHits}
        currentSourceId={runtime.state?.playback.currentSourceId}
        favorites={runtime.state?.favorites ?? []}
        failures={runtime.state?.failures ?? {}}
        compact
        onSelect={(source, queueIds) => void runtime.loadSource(source, queueIds, true)}
        onToggleFavorite={(sourceId) => void runtime.toggleFavorite(sourceId)}
      />

      {runtime.error ? <p className="helper-text helper-text--error">{runtime.error}</p> : null}
    </main>
  );
}
