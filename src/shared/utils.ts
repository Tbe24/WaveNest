import type { AudioSource, ContentCategory, ContentScope, MarketFilter, ScopeFilter } from './types';
import { BLOCKED_SOURCE_IDS, HIT_RADIO_TERMS, NEWS_TERMS, PODCAST_TERMS, TECH_TERMS } from './constants';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function createSourceId(...parts: string[]): string {
  return slugify(parts.filter(Boolean).join('-'));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function stripHtml(value: string): string {
  return normalizeWhitespace(
    decodeXmlEntities(value)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

export function safeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return '';
  }
}

export function extractOriginPattern(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}/*`;
}

export function matchesScopeFilter(source: AudioSource, scopeFilter: ScopeFilter): boolean {
  if (scopeFilter === 'all') {
    return true;
  }

  if (scopeFilter === 'local') {
    return source.scope === 'local';
  }

  const language = source.language?.toLowerCase() ?? '';
  const tags = source.tags.join(' ').toLowerCase();
  return language.includes('english') || /(^|[\s,;-])en(?:-[a-z]+)?($|[\s,;-])/.test(language) || tags.includes('english');
}

export function matchesMarketFilter(source: AudioSource, market: MarketFilter): boolean {
  if (market === 'all') {
    return true;
  }

  return source.countryCode === market || source.tags.includes(`market-${market.toLowerCase()}`);
}

const SUBCATEGORY_TERMS: Record<string, string[]> = {
  pop: ['pop', 'hit', 'hits', 'top40', 'top 40', 'chart', 'throwback'],
  'hip-hop': ['hip hop', 'hip-hop', 'hiphop', 'rap', 'urban'],
  reggae: ['reggae', 'dancehall', 'dub'],
  rock: ['rock', 'alternative', 'metal', 'indie'],
  electronic: ['electronic', 'edm', 'dance', 'house', 'techno', 'ambient'],
  jazz: ['jazz', 'blues', 'soul'],
  country: ['country', 'americana'],
  classical: ['classical', 'opera', 'symphony'],
  ai: [' ai ', 'artificial intelligence', 'machine learning'],
  software: ['software', 'developer', 'programming', 'coding'],
  'web-dev': ['web development', 'web-development', 'javascript', 'frontend', 'backend'],
  gadgets: ['gadget', 'gadgets', 'consumer tech', 'hardware', 'devices'],
  startups: ['startup', 'startups', 'venture', 'entrepreneur'],
  science: ['science', 'space', 'medicine', 'research'],
  'world-news': ['world', 'global', 'international'],
  politics: ['politics', 'political', 'government'],
  business: ['business', 'economy', 'finance', 'market'],
  'local-news': ['local', 'ethiopia', 'addis'],
  comedy: ['comedy', 'funny', 'humor'],
  interviews: ['interview', 'interviews', 'conversation'],
  sports: ['sport', 'sports', 'football', 'soccer'],
  history: ['history', 'historical'],
  education: ['education', 'learning', 'educational']
};

export function matchesSubcategory(source: AudioSource, subcategory: string): boolean {
  if (subcategory === 'all') return true;

  const searchable = ` ${[
    source.title,
    source.subtitle,
    source.description,
    source.category,
    ...source.tags
  ].filter(Boolean).join(' ').toLowerCase()} `;

  return (SUBCATEGORY_TERMS[subcategory] ?? [subcategory]).some((term) => searchable.includes(term));
}

export function inferScope(countryCode?: string, language?: string, tags: string[] = []): ContentScope {
  const combined = [countryCode ?? '', language ?? '', ...tags].join(' ').toLowerCase();
  if (combined.includes('et') || combined.includes('ethiopia') || combined.includes('amharic')) {
    return 'local';
  }

  return 'international';
}

export function inferCategory(text: string, fallback: ContentCategory = 'talk'): ContentCategory {
  const normalized = text.toLowerCase();

  if (HIT_RADIO_TERMS.some((term) => normalized.includes(term))) {
    return 'music';
  }

  if (NEWS_TERMS.some((term) => normalized.includes(term))) {
    return 'news';
  }

  if (TECH_TERMS.some((term) => normalized.includes(term))) {
    return 'tech';
  }

  if (PODCAST_TERMS.some((term) => normalized.includes(term))) {
    return 'podcasts';
  }

  return fallback;
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) {
      continue;
    }

    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return [...seen.values()];
}

export function isStale(lastRefreshedAt: string | undefined, ttlHours: number, now = new Date()): boolean {
  if (!lastRefreshedAt) {
    return true;
  }

  const refreshedAt = new Date(lastRefreshedAt).getTime();
  if (Number.isNaN(refreshedAt)) {
    return true;
  }

  return now.getTime() - refreshedAt > ttlHours * 60 * 60 * 1000;
}

export function sortByRank(items: AudioSource[]): AudioSource[] {
  return [...items].sort((left, right) => {
    if (left.rank !== right.rank) {
      return right.rank - left.rank;
    }

    return left.title.localeCompare(right.title);
  });
}

export function dedupeAudioSources(items: AudioSource[]): AudioSource[] {
  const byStream = new Map<string, AudioSource>();

  for (const item of sortByRank(items)) {
    const key = item.streamUrl ? safeUrl(item.streamUrl) : item.id;
    const current = byStream.get(key);
    if (!current || item.rank > current.rank) {
      byStream.set(key, item);
    }
  }

  return [...byStream.values()];
}

export function isBlockedSource(source: Pick<AudioSource, 'id'>): boolean {
  return BLOCKED_SOURCE_IDS.has(source.id);
}
