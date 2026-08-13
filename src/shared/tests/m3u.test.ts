import { describe, expect, it } from 'vitest';
import { parseM3U } from '../parsers/m3u';

describe('parseM3U', () => {
  it('parses iptv-org style EXTINF metadata into radio sources', () => {
    const sample = `#EXTM3U
#EXTINF:-1 tvg-id="" tvg-logo="https://example.com/logo.png" group-title="Music",Hit Radio 100
https://stream.example.com/hit.mp3
#EXTINF:-1 tvg-id="" tvg-logo="https://example.com/news.png" group-title="News",Addis Update
https://stream.example.com/news.mp3
`;

    const sources = parseM3U(sample, {
      source: 'iptv-org',
      scope: 'local',
      countryCode: 'ET'
    });

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      title: 'Hit Radio 100',
      streamUrl: 'https://stream.example.com/hit.mp3',
      category: 'music',
      scope: 'local',
      source: 'iptv-org',
      countryCode: 'ET'
    });
    expect(sources[1].category).toBe('news');
    expect(sources[0].tags).toContain('Music');
  });
});
