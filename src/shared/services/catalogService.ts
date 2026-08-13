import stationsData from '../curated/stations.json';
import podcastsData from '../curated/podcasts.json';
import { RADIO_BROWSER_SERVERS } from '../constants';
import { parseM3U } from '../parsers/m3u';
import { parsePodcastFeed } from '../parsers/podcastFeed';
import type {
  AudioSource,
  BundledCatalog,
  ImportedSourceRecord,
  ImportKind,
  ParsePodcastFeedOptions,
  PodcastCatalogResult,
  PodcastFeed,
  RemoteCatalogResult,
  RemoteCatalogScope
} from '../types';
import { createSourceId, dedupeAudioSources, inferCategory, normalizeWhitespace } from '../utils';

const DEFAULT_IMPORT_RANK = 70;

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  language: string;
  countrycode: string;
  homepage: string;
  votes: number;
  clickcount: number;
}

export async function loadBundledCatalog(): Promise<BundledCatalog> {
  return {
    stations: stationsData as AudioSource[],
    feeds: podcastsData as PodcastFeed[]
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain,application/x-mpegurl,application/vnd.apple.mpegurl,text/html,application/xml,application/rss+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fetchRadioBrowserSources(scope: RemoteCatalogScope): Promise<AudioSource[]> {
  const queries =
    scope === 'local'
      ? ['/json/stations/search?countrycode=ET&hidebroken=true&limit=1000&order=votes&reverse=true']
      : scope === 'international'
        ? [
            '/json/stations/search?countrycode=US&hidebroken=true&limit=60&order=votes&reverse=true',
            '/json/stations/search?countrycode=GB&hidebroken=true&limit=60&order=votes&reverse=true',
            '/json/stations/topclick/30?hidebroken=true'
          ]
        : [
            '/json/stations/search?countrycode=ET&hidebroken=true&limit=1000&order=votes&reverse=true',
            '/json/stations/search?countrycode=US&hidebroken=true&limit=60&order=votes&reverse=true',
            '/json/stations/search?countrycode=GB&hidebroken=true&limit=60&order=votes&reverse=true',
            '/json/stations/topclick/30?hidebroken=true'
          ];

  for (const server of RADIO_BROWSER_SERVERS) {
    try {
      const payloads = await Promise.all(
        queries.map((query) => fetchJson<RadioBrowserStation[]>(`${server}${query}`))
      );

      return dedupeAudioSources(
        payloads
          .flat()
          .filter((station) => station.url_resolved)
          .map((station) => ({
            id: station.stationuuid,
            type: 'radio',
            title: normalizeWhitespace(station.name),
            streamUrl: station.url_resolved,
            image: station.favicon,
            category: inferCategory(`${station.tags} ${station.name}`, 'talk'),
            scope: station.countrycode === 'ET' ? 'local' : 'international',
            source: 'radio-browser',
            rank: station.votes + station.clickcount,
            tags: [
              `market-${station.countrycode.toLowerCase()}`,
              ...station.tags
              .split(',')
              .map((value) => normalizeWhitespace(value))
              .filter(Boolean)
            ],
            language: station.language,
            countryCode: station.countrycode,
            isFeatured: station.countrycode === 'ET' || station.votes > 20,
            subtitle: 'Radio Browser',
            homepage: station.homepage,
            isLive: true
          }))
      );
    } catch {
      continue;
    }
  }

  return [];
}

export async function refreshRemoteCatalog(scope: RemoteCatalogScope): Promise<RemoteCatalogResult> {
  const radioBrowserSources = await fetchRadioBrowserSources(scope);

  return {
    // IPTV-org is intentionally excluded: its lists are television directories,
    // not radio audience charts, and commonly contain video-only HLS feeds.
    sources: radioBrowserSources,
    fetchedAt: new Date().toISOString()
  };
}

export async function refreshBundledPodcastFeeds(
  feeds: PodcastFeed[],
  scope: RemoteCatalogScope
): Promise<PodcastCatalogResult> {
  const targetFeeds = feeds.filter((feed) => scope === 'all' || feed.scope === scope);
  const results = await Promise.allSettled(
    targetFeeds.map(async (feed) => {
      const input = await fetchText(feed.rssUrl);
      return parsePodcastFeed(input, {
        source: 'bundled-podcast',
        scope: feed.scope,
        category: feed.category,
        rankBase: feed.rank,
        feedId: feed.id,
        fallbackTitle: feed.title,
        fallbackUrl: feed.rssUrl,
        extraTags: feed.tags
      } satisfies ParsePodcastFeedOptions);
    })
  );

  const refreshedFeeds: PodcastFeed[] = [];
  const episodes: AudioSource[] = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    refreshedFeeds.push(result.value.feed);
    episodes.push(...result.value.episodes);
  }

  return {
    feeds: refreshedFeeds,
    episodes,
    fetchedAt: new Date().toISOString()
  };
}

function buildImportedRecord(params: {
  id?: string;
  createdAt?: string;
  kind: ImportKind;
  title: string;
  url?: string;
  items: AudioSource[];
  feed?: PodcastFeed;
}): ImportedSourceRecord {
  const timestamp = new Date().toISOString();
  const id = params.id ?? createSourceId(params.kind, params.title, params.url ?? timestamp);

  return {
    id,
    kind: params.kind,
    title: params.title,
    url: params.url,
    createdAt: params.createdAt ?? timestamp,
    lastRefreshedAt: timestamp,
    feed: params.feed,
    items: params.items.map((item) => ({
      ...item,
      importId: id
    }))
  };
}

function inferImportKind(url: string, kind: ImportKind): ImportKind {
  if (kind) {
    return kind;
  }

  return url.endsWith('.m3u') || url.endsWith('.m3u8') ? 'm3u' : 'rss';
}

export async function importRemoteSource(url: string, kind: ImportKind): Promise<ImportedSourceRecord> {
  const normalizedUrl = new URL(url).toString();
  const resolvedKind = inferImportKind(normalizedUrl, kind);
  const payload = await fetchText(normalizedUrl);

  if (resolvedKind === 'm3u') {
    const items = parseM3U(payload, {
      source: 'imported-m3u',
      rankBase: DEFAULT_IMPORT_RANK
    });
    return buildImportedRecord({
      kind: 'm3u',
      title: normalizedUrl,
      url: normalizedUrl,
      items
    });
  }

  const parsed = parsePodcastFeed(payload, {
    source: 'imported-rss',
    category: 'podcasts',
    rankBase: DEFAULT_IMPORT_RANK,
    fallbackTitle: normalizedUrl,
    fallbackUrl: normalizedUrl
  });

  return buildImportedRecord({
    kind: 'rss',
    title: parsed.feed.title,
    url: normalizedUrl,
    items: parsed.episodes,
    feed: {
      ...parsed.feed,
      rssUrl: normalizedUrl
    }
  });
}

export function importLocalSource(rawText: string, kind: ImportKind, title: string): ImportedSourceRecord {
  if (kind === 'm3u') {
    return buildImportedRecord({
      kind,
      title,
      items: parseM3U(rawText, {
        source: 'imported-m3u',
        rankBase: DEFAULT_IMPORT_RANK
      })
    });
  }

  const parsed = parsePodcastFeed(rawText, {
    source: 'imported-rss',
    category: 'podcasts',
    rankBase: DEFAULT_IMPORT_RANK,
    fallbackTitle: title
  });

  return buildImportedRecord({
    kind,
    title: parsed.feed.title || title,
    items: parsed.episodes,
    feed: parsed.feed
  });
}

export async function refreshImportedSources(
  records: ImportedSourceRecord[]
): Promise<ImportedSourceRecord[]> {
  const results = await Promise.all(
    records.map(async (record) => {
      if (!record.url) {
        return record;
      }

      try {
        const refreshed = await importRemoteSource(record.url, record.kind);
        return buildImportedRecord({
          id: record.id,
          createdAt: record.createdAt,
          kind: refreshed.kind,
          title: refreshed.title,
          url: refreshed.url,
          items: refreshed.items,
          feed: refreshed.feed
        });
      } catch {
        return record;
      }
    })
  );

  return results;
}
