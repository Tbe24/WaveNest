import { describe, expect, it } from 'vitest';
import { parsePodcastFeed } from '../parsers/podcastFeed';

describe('parsePodcastFeed', () => {
  it('parses RSS feeds with enclosures and durations', () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech Dispatch</title>
    <description>Daily tech updates</description>
    <itunes:image href="https://example.com/cover.png" />
    <item>
      <title>Episode One</title>
      <description><![CDATA[Fresh news and analysis]]></description>
      <enclosure url="https://cdn.example.com/ep1.mp3" type="audio/mpeg" />
      <pubDate>Thu, 23 Apr 2026 10:00:00 GMT</pubDate>
      <itunes:duration>12:34</itunes:duration>
    </item>
  </channel>
</rss>`;

    const parsed = parsePodcastFeed(rss, {
      source: 'bundled-podcast',
      scope: 'international',
      category: 'tech',
      feedId: 'feed-tech-dispatch'
    });

    expect(parsed.feed.title).toBe('Tech Dispatch');
    expect(parsed.feed.description).toBe('Daily tech updates');
    expect(parsed.episodes).toHaveLength(1);
    expect(parsed.episodes[0]).toMatchObject({
      title: 'Episode One',
      streamUrl: 'https://cdn.example.com/ep1.mp3',
      category: 'tech',
      feedId: 'feed-tech-dispatch',
      durationSeconds: 754
    });
  });

  it('parses Atom feeds with enclosure links', () => {
    const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Local Voices</title>
  <subtitle>Stories from Addis</subtitle>
  <entry>
    <title>Episode Alpha</title>
    <updated>2026-04-23T11:00:00Z</updated>
    <summary>New conversations</summary>
    <link rel="enclosure" href="https://example.com/alpha.mp3" type="audio/mpeg" />
  </entry>
</feed>`;

    const parsed = parsePodcastFeed(atom, {
      source: 'imported-rss',
      scope: 'local',
      category: 'podcasts'
    });

    expect(parsed.feed.title).toBe('Local Voices');
    expect(parsed.episodes[0]).toMatchObject({
      title: 'Episode Alpha',
      streamUrl: 'https://example.com/alpha.mp3',
      scope: 'local'
    });
  });
});
