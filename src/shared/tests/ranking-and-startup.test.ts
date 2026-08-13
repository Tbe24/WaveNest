import { describe, expect, it } from 'vitest';
import { buildCatalogSections, combineCatalogSources } from '../services/ranking';
import { restorePlaybackState } from '../services/startup';
import type { AudioSource } from '../types';
import { matchesMarketFilter, matchesScopeFilter, matchesSubcategory } from '../utils';

const bundledSeed: AudioSource = {
  id: 'seed-sheger',
  type: 'radio',
  title: 'Sheger FM',
  streamUrl: '',
  category: 'talk',
  scope: 'local',
  source: 'bundled',
  rank: 90,
  tags: ['ethiopia'],
  countryCode: 'ET',
  isFeatured: true,
  lookupQuery: 'Sheger FM'
};

const remoteSheger: AudioSource = {
  id: 'remote-sheger',
  type: 'radio',
  title: 'Sheger FM 102.1',
  streamUrl: 'https://stream.example.com/sheger.mp3',
  category: 'talk',
  scope: 'local',
  source: 'radio-browser',
  rank: 25,
  tags: ['ethiopia', 'talk'],
  countryCode: 'ET',
  isFeatured: false
};

const internationalHit: AudioSource = {
  id: 'intl-hit',
  type: 'radio',
  title: 'Top Hits FM',
  streamUrl: 'https://stream.example.com/hits.mp3',
  category: 'music',
  scope: 'international',
  source: 'iptv-org',
  rank: 80,
  tags: ['top40', 'hits'],
  countryCode: 'US',
  language: 'English',
  isFeatured: true,
  isLive: true
};

describe('catalog ranking and startup restore', () => {
  it('resolves curated seeds against remote sources and builds sections', () => {
    const combined = combineCatalogSources({
      bundledSources: [bundledSeed],
      remoteSources: [remoteSheger, internationalHit],
      podcastEpisodes: [],
      importedItems: []
    });

    expect(combined.find((source) => source.id === 'seed-sheger')?.streamUrl).toBe(
      'https://stream.example.com/sheger.mp3'
    );

    const sections = buildCatalogSections({
      sources: combined,
      favorites: ['intl-hit'],
      scopeFilter: 'all',
      pinnedCategories: ['music', 'news'],
      currentSourceId: 'intl-hit'
    });

    expect(sections.find((section) => section.id === 'top-hits')?.items[0].id).toBe('intl-hit');
    expect(sections.find((section) => section.id === 'favorites')?.items).toHaveLength(1);
  });

  it('restores the last source without autoplaying on startup', () => {
    const restored = restorePlaybackState(
      {
        currentSourceId: 'intl-hit',
        status: 'playing',
        volume: 0.7,
        muted: false,
        position: 48,
        queueIds: ['intl-hit']
      },
      [internationalHit]
    );

    expect(restored.status).toBe('paused');
    expect(restored.currentSourceId).toBe('intl-hit');
    expect(restored.position).toBe(48);
  });

  it('separates Ethiopian local audio from English-language audio', () => {
    expect(matchesScopeFilter(bundledSeed, 'local')).toBe(true);
    expect(matchesScopeFilter(bundledSeed, 'english')).toBe(false);
    expect(matchesScopeFilter(internationalHit, 'english')).toBe(true);
    expect(matchesScopeFilter(internationalHit, 'local')).toBe(false);
  });

  it('removes blocked non-radio catalog entries', () => {
    const blockedMereja = {
      ...internationalHit,
      id: 'mereja-tv-1080p-not-24-7-https-rumble-com-live-hls-dvr-4c14o3-playlist-m3u8',
      title: 'Mereja TV (1080p) [Not 24/7]'
    };
    const combined = combineCatalogSources({
      bundledSources: [],
      remoteSources: [blockedMereja, internationalHit],
      podcastEpisodes: [],
      importedItems: []
    });

    expect(combined.map((source) => source.id)).toEqual(['intl-hit']);
  });

  it('filters sources into Ethiopia, US, and UK collections', () => {
    expect(matchesMarketFilter(bundledSeed, 'ET')).toBe(true);
    expect(matchesMarketFilter(internationalHit, 'US')).toBe(true);
    expect(matchesMarketFilter(internationalHit, 'GB')).toBe(false);
  });

  it('filters music and tech sources by subcategory terms', () => {
    expect(matchesSubcategory(internationalHit, 'pop')).toBe(true);
    expect(matchesSubcategory(internationalHit, 'reggae')).toBe(false);
    expect(matchesSubcategory({ ...internationalHit, tags: ['hip-hop', 'rap'] }, 'hip-hop')).toBe(true);
  });
});
