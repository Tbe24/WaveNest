import type { AudioSource, ParseM3UOptions } from '../types';
import { createSourceId, inferCategory, inferScope, normalizeWhitespace, safeUrl } from '../utils';

function parseExtInfAttributes(meta: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w-]+)="([^"]*)"/g;

  let match = pattern.exec(meta);
  while (match) {
    attributes[match[1]] = match[2];
    match = pattern.exec(meta);
  }

  return attributes;
}

export function parseM3U(input: string, options: ParseM3UOptions = {}): AudioSource[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim());
  const sources: AudioSource[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('#EXTINF')) {
      continue;
    }

    const commaIndex = line.indexOf(',');
    const meta = commaIndex >= 0 ? line.slice('#EXTINF:'.length, commaIndex) : line.slice('#EXTINF:'.length);
    const title = normalizeWhitespace(commaIndex >= 0 ? line.slice(commaIndex + 1) : 'Untitled stream');
    const attributes = parseExtInfAttributes(meta);

    let streamUrl = '';
    while (!streamUrl && index + 1 < lines.length) {
      index += 1;
      const candidate = lines[index];
      if (candidate && !candidate.startsWith('#')) {
        streamUrl = safeUrl(candidate);
      }
    }

    if (!streamUrl) {
      continue;
    }

    const groupTitle = attributes['group-title'] ?? '';
    const language = options.language ?? attributes['tvg-language'] ?? '';
    const tags = [
      groupTitle,
      attributes['tvg-name'] ?? '',
      ...(options.extraTags ?? [])
    ]
      .flatMap((value) => value.split(/[|,/]/))
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean);

    const category = options.category ?? inferCategory([groupTitle, title, tags.join(' ')].join(' '), 'talk');
    const scope = options.scope ?? inferScope(options.countryCode ?? attributes['tvg-country'], language, tags);

    sources.push({
      id: createSourceId(title, streamUrl),
      type: 'radio',
      title,
      streamUrl,
      image: attributes['tvg-logo'] ?? '',
      category,
      scope,
      source: options.source ?? 'imported-m3u',
      rank: options.rankBase ?? 50,
      tags,
      language: language || undefined,
      countryCode: options.countryCode ?? attributes['tvg-country'] ?? undefined,
      isFeatured: options.featured ?? false,
      subtitle: groupTitle || undefined,
      homepage: attributes['tvg-url'] ?? undefined,
      isLive: true,
      importId: options.importId
    });
  }

  return sources;
}
