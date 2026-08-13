import { PODCAST_TTL_HOURS, REMOTE_RADIO_TTL_HOURS } from '../constants';
import type {
  AudioSource,
  CatalogSection,
  ContentCategory,
  PodcastFeed,
  ScopeFilter
} from '../types';
import { dedupeAudioSources, isBlockedSource, matchesScopeFilter, sortByRank } from '../utils';

function applyFeaturedBoost(source: AudioSource): AudioSource {
  if (!source.isFeatured) {
    return source;
  }

  return {
    ...source,
    rank: source.rank + 10
  };
}

function resolveSeededSources(bundledSources: AudioSource[], remoteSources: AudioSource[]): AudioSource[] {
  const playableBundled = bundledSources.filter((source) => source.streamUrl);
  const seedStations = bundledSources.filter((source) => !source.streamUrl && source.lookupQuery);

  const resolvedSeeds = seedStations
    .map((seed) => {
      const match = remoteSources.find((candidate) =>
        candidate.title.toLowerCase().includes(seed.lookupQuery?.toLowerCase() ?? '')
      );

      if (!match) {
        return undefined;
      }

      return applyFeaturedBoost({
        ...match,
        id: seed.id,
        rank: Math.max(match.rank, seed.rank),
        isFeatured: true,
        scope: seed.scope,
        category: seed.category,
        subtitle: seed.subtitle ?? match.subtitle
      });
    })
    .filter((source): source is AudioSource => Boolean(source));

  return [...playableBundled, ...resolvedSeeds];
}

function buildSection(
  id: string,
  title: string,
  items: AudioSource[],
  refreshTtlHours: number
): CatalogSection {
  return {
    id,
    title,
    items,
    refreshTtlHours
  };
}

export function combineCatalogSources(params: {
  bundledSources: AudioSource[];
  remoteSources: AudioSource[];
  podcastEpisodes: AudioSource[];
  importedItems: AudioSource[];
}): AudioSource[] {
  const resolvedBundled = resolveSeededSources(params.bundledSources, params.remoteSources);
  const boostedRemote = params.remoteSources.map(applyFeaturedBoost);

  return sortByRank(
    dedupeAudioSources(
      [...resolvedBundled, ...boostedRemote, ...params.podcastEpisodes, ...params.importedItems]
        .filter((source) => !isBlockedSource(source))
    )
  );
}

export function buildCatalogSections(params: {
  sources: AudioSource[];
  favorites: string[];
  scopeFilter: ScopeFilter;
  pinnedCategories: ContentCategory[];
  currentSourceId?: string;
}): CatalogSection[] {
  const visibleSources = params.sources.filter((source) => matchesScopeFilter(source, params.scopeFilter));
  const favorites = visibleSources.filter((source) => params.favorites.includes(source.id));
  const local = visibleSources.filter((source) => source.scope === 'local');
  const english = visibleSources.filter((source) => matchesScopeFilter(source, 'english'));
  const topHits = visibleSources.filter((source) => source.category === 'music' && source.isLive);
  const news = visibleSources.filter((source) => source.category === 'news');
  const tech = visibleSources.filter((source) => source.category === 'tech');
  const podcasts = visibleSources.filter((source) => source.type === 'podcast_episode');
  const pinned = visibleSources.filter((source) => params.pinnedCategories.includes(source.category));
  const continueListening = visibleSources.filter((source) => source.id === params.currentSourceId);

  return [
    buildSection('continue', 'Continue Listening', continueListening, PODCAST_TTL_HOURS),
    buildSection('top-hits', 'Top Hits', topHits.slice(0, 8), REMOTE_RADIO_TTL_HOURS),
    buildSection('local', 'Local Picks', local.slice(0, 10), REMOTE_RADIO_TTL_HOURS),
    buildSection('english', 'English Picks', english.slice(0, 10), REMOTE_RADIO_TTL_HOURS),
    buildSection('news', 'News', news.slice(0, 8), REMOTE_RADIO_TTL_HOURS),
    buildSection('tech', 'Tech', tech.slice(0, 8), PODCAST_TTL_HOURS),
    buildSection('podcasts', 'Podcasts', podcasts.slice(0, 10), PODCAST_TTL_HOURS),
    buildSection('favorites', 'Favorites', favorites, PODCAST_TTL_HOURS),
    buildSection('pinned', 'Pinned For You', pinned.slice(0, 10), PODCAST_TTL_HOURS)
  ].filter((section) => section.items.length > 0);
}

export function mergePodcastFeeds(bundledFeeds: PodcastFeed[], refreshedFeeds: PodcastFeed[]): PodcastFeed[] {
  const byId = new Map<string, PodcastFeed>();
  [...bundledFeeds, ...refreshedFeeds].forEach((feed) => byId.set(feed.id, feed));
  return [...byId.values()].sort((left, right) => right.rank - left.rank);
}
