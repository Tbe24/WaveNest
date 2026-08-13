import type { AudioSource, ParsePodcastFeedOptions, PodcastFeed } from '../types';
import { createSourceId, decodeXmlEntities, inferCategory, normalizeWhitespace, stripHtml } from '../utils';

function getTagText(xml: string, tagNames: string[]): string {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
    const match = xml.match(pattern);
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }

  return '';
}

function getAttributeValue(xml: string, tagName: string, attributeName: string): string {
  const pattern = new RegExp(`<${tagName}[^>]*${attributeName}="([^"]+)"[^>]*>`, 'i');
  return xml.match(pattern)?.[1] ?? '';
}

function getAtomEnclosureUrl(xml: string): string {
  const pattern = /<link\b[^>]*rel="enclosure"[^>]*href="([^"]+)"[^>]*\/?>/i;
  return xml.match(pattern)?.[1] ?? '';
}

function getItemBlocks(xml: string): { blocks: string[]; isAtom: boolean } {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  if (rssItems.length > 0) {
    return { blocks: rssItems, isAtom: false };
  }

  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return { blocks: atomEntries, isAtom: true };
}

function parseDurationSeconds(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  if (/^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  const parts = value
    .trim()
    .split(':')
    .map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) {
    return undefined;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return undefined;
}

export function parsePodcastFeed(
  input: string,
  options: ParsePodcastFeedOptions = {}
): { feed: PodcastFeed; episodes: AudioSource[] } {
  const trimmed = input.trim();
  const isAtom = trimmed.includes('<feed') && trimmed.includes('xmlns="http://www.w3.org/2005/Atom"');
  const rssChannel = trimmed.match(/<channel\b[\s\S]*?<\/channel>/i)?.[0] ?? trimmed;
  const feedRoot = isAtom ? trimmed : rssChannel;
  const feedTitle = normalizeWhitespace(getTagText(feedRoot, ['title']) || options.fallbackTitle || 'Imported Podcast');
  const feedDescription = normalizeWhitespace(getTagText(feedRoot, ['description', 'subtitle', 'itunes:summary', 'summary']) || '');
  const feedLanguage = normalizeWhitespace(getTagText(feedRoot, ['language']) || '');
  const feedImage = getAttributeValue(feedRoot, 'itunes:image', 'href') || getTagText(feedRoot, ['url', 'logo']) || '';
  const fallbackCategory = options.category ?? inferCategory(`${feedTitle} ${feedDescription}`, 'podcasts');

  const feed: PodcastFeed = {
    id: options.feedId ?? createSourceId(feedTitle, options.fallbackUrl ?? feedTitle),
    title: feedTitle,
    rssUrl: options.fallbackUrl ?? '',
    image: feedImage,
    category: fallbackCategory,
    scope: options.scope ?? 'international',
    rank: options.rankBase ?? 60,
    description: feedDescription
  };

  const { blocks, isAtom: detectedAtom } = getItemBlocks(trimmed);
  const atomMode = isAtom || detectedAtom;
  const episodes: AudioSource[] = [];

  // A feed can contain hundreds of historical episodes. Keeping the latest 20
  // makes browsing fast while still providing a useful recent catalog.
  blocks.slice(0, 20).forEach((block, index) => {
    const title = normalizeWhitespace(getTagText(block, ['title']) || `${feedTitle} Episode ${index + 1}`);
    const description = normalizeWhitespace(
      getTagText(block, ['description', 'content', 'summary', 'content:encoded', 'itunes:summary'])
    );
    const enclosureUrl =
      (atomMode ? getAtomEnclosureUrl(block) : getAttributeValue(block, 'enclosure', 'url')) ||
      getAttributeValue(block, 'media:content', 'url');
    const publishedAt =
      getTagText(block, ['pubDate', 'published', 'updated']) ||
      undefined;
    const durationSeconds = parseDurationSeconds(getTagText(block, ['itunes:duration', 'duration']));
    const episodeImage = getAttributeValue(block, 'itunes:image', 'href') || feedImage;

    if (!enclosureUrl) {
      return;
    }

    episodes.push({
      id: createSourceId(feed.id, title, enclosureUrl),
      type: 'podcast_episode',
      title,
      streamUrl: enclosureUrl,
      image: episodeImage,
      category: options.category ?? (feed.category === 'podcasts' ? 'podcasts' : feed.category),
      scope: options.scope ?? feed.scope,
      source: options.source ?? 'imported-rss',
      rank: (options.rankBase ?? 60) - index,
      tags: [feed.category, atomMode ? 'atom' : 'rss', ...(options.extraTags ?? [])],
      language: feedLanguage || undefined,
      isFeatured: index < 2,
      subtitle: feed.title,
      description,
      feedId: feed.id,
      publishedAt,
      durationSeconds,
      isLive: false,
      importId: options.importId
    });
  });

  return {
    feed,
    episodes
  };
}
