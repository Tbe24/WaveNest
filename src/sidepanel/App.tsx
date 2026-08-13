import { useEffect, useState } from 'react';
import { CategoryChips, type BrowseCategory } from '../shared/components/CategoryChips';
import { NowPlayingCard } from '../shared/components/NowPlayingCard';
import { MarketToggle } from '../shared/components/MarketToggle';
import { ScopeToggle } from '../shared/components/ScopeToggle';
import { SubcategoryChips, type SubcategoryFilter } from '../shared/components/SubcategoryChips';
import { SourceSection } from '../shared/components/SourceSection';
import { useRuntimeState } from '../shared/hooks/useRuntimeState';
import type { MarketFilter } from '../shared/types';
import { matchesMarketFilter, matchesScopeFilter, matchesSubcategory } from '../shared/utils';

const RESULTS_PAGE_SIZE = 60;

export function App() {
  const runtime = useRuntimeState();
  const [categoryFilter, setCategoryFilter] = useState<BrowseCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState<SubcategoryFilter>('all');
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const scopeFilter = runtime.state?.settings.scopeFilter ?? 'all';
  const browseItems = runtime.state?.catalog.sources.filter((source) => {
    const matchesScope = matchesScopeFilter(source, scopeFilter);
    const matchesMarket = matchesMarketFilter(source, marketFilter);
    const matchesCategory =
      categoryFilter === 'all' ||
      (categoryFilter === 'radio' && source.type === 'radio') ||
      (categoryFilter === 'podcasts' && source.type === 'podcast_episode') ||
      source.category === categoryFilter;
    const matchesSubcategoryFilter = matchesSubcategory(source, subcategoryFilter);
    const searchableText = [source.title, source.subtitle, source.language, source.category, ...source.tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    // Text search is global so a source such as VOA remains discoverable even
    // when an unrelated region or category filter was previously selected.
    if (normalizedQuery) {
      return searchableText.includes(normalizedQuery);
    }

    return matchesScope && matchesMarket && matchesCategory && matchesSubcategoryFilter;
  }) ?? [];
  // Favorites remain pinned regardless of the active browse filters.
  const favoriteItems = runtime.state?.catalog.sources.filter((source) => runtime.state?.favorites.includes(source.id)) ?? [];
  const visibleBrowseItems = browseItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(RESULTS_PAGE_SIZE);
  }, [scopeFilter, marketFilter, categoryFilter, subcategoryFilter, normalizedQuery]);

  return (
    <main className="panel-shell">
      <header className="app-header app-header--panel">
        <div>
          <p className="eyebrow">WaveNest</p>
          <h1>Radio Console</h1>
        </div>
        <div className="header-actions">
          <button
            className="ghost-button"
            onClick={() => void runtime.refreshCatalog('all')}
            disabled={runtime.state?.catalog.isRefreshing}
            type="button"
          >
            {runtime.state?.catalog.isRefreshing ? 'Refreshing sources…' : '↻ Refresh sources'}
          </button>
          <button
            className="icon-button"
            onClick={() => void runtime.closeSidePanel().then(() => window.close())}
            aria-label="Return to compact player"
            title="Return to compact player"
            type="button"
          >
            <span aria-hidden="true">⤡</span>
          </button>
          <button
            className="close-button close-button--labeled"
            onClick={() => void runtime.stopAndClose().then(() => window.close())}
            title="Stop audio and close the panel"
            type="button"
          >
            <span aria-hidden="true">×</span> Stop & close
          </button>
        </div>
      </header>

      <NowPlayingCard
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

      <section className="section-block">
        <div className="section-block__header">
          <div>
            <h2>Choose what you want</h2>
          </div>
          <span>{browseItems.length} results</span>
        </div>
        <ScopeToggle
          value={runtime.state?.settings.scopeFilter ?? 'all'}
          onChange={(scopeFilter) => void runtime.setScopeFilter(scopeFilter)}
        />
        <div className="filter-group">
          <span>Region</span>
          <MarketToggle value={marketFilter} onChange={setMarketFilter} />
        </div>
        <div className="filter-group">
          <span>Category</span>
        <CategoryChips
          selected={categoryFilter}
          onSelect={(category) => {
            setCategoryFilter(category);
            setSubcategoryFilter('all');
          }}
        />
        </div>
        <SubcategoryChips
          category={categoryFilter}
          selected={subcategoryFilter}
          onSelect={setSubcategoryFilter}
        />
        <label className="search-control">
          <span className="search-control__icon" aria-hidden="true">⌕</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search stations, podcasts, language..."
            aria-label="Search stations and podcasts"
            type="search"
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery('')} type="button">Clear</button>
          ) : null}
        </label>
      </section>

      {favoriteItems.length > 0 ? (
        <SourceSection
          title="♥ Your Favorites"
          items={favoriteItems}
          currentSourceId={runtime.state?.playback.currentSourceId}
          favorites={runtime.state?.favorites ?? []}
          failures={runtime.state?.failures ?? {}}
          onSelect={(source, queueIds) => void runtime.loadSource(source, queueIds, true)}
          onToggleFavorite={(sourceId) => void runtime.toggleFavorite(sourceId)}
        />
      ) : null}

      <SourceSection
        title={searchQuery ? `Results for “${searchQuery}”` : marketFilter === 'ET' ? 'Ethiopia' : marketFilter === 'US' ? 'USA Popular' : marketFilter === 'GB' ? 'UK Popular' : scopeFilter === 'local' ? 'Local Audio' : scopeFilter === 'english' ? 'English Audio' : 'All Audio'}
        items={visibleBrowseItems}
        currentSourceId={runtime.state?.playback.currentSourceId}
        favorites={runtime.state?.favorites ?? []}
        failures={runtime.state?.failures ?? {}}
        onSelect={(source, queueIds) => void runtime.loadSource(source, queueIds, true)}
        onToggleFavorite={(sourceId) => void runtime.toggleFavorite(sourceId)}
      />

      {visibleBrowseItems.length < browseItems.length ? (
        <button
          className="ghost-button load-more-button"
          onClick={() => setVisibleCount((count) => count + RESULTS_PAGE_SIZE)}
          type="button"
        >
          Show more ({browseItems.length - visibleBrowseItems.length} remaining)
        </button>
      ) : null}

      {!runtime.loading && browseItems.length === 0 ? (
        <section className="empty-state">
          <h2>No audio found</h2>
          <p>Try All, choose another category, clear the search, or refresh the sources.</p>
        </section>
      ) : null}

      {runtime.error ? <p className="helper-text helper-text--error">{runtime.error}</p> : null}
    </main>
  );
}
