import Parser from 'rss-parser';
import type { SearchSource } from './index';

const parser = new Parser();

// Default news/blog RSS feeds
const FEEDS = [
  'http://feeds.bbci.co.uk/news/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
  'https://www.reutersagency.com/feed/?best-topics=top-news',
  'https://apnews.com/rss',
  'https://www.npr.org/rss/rss.php?id=1001',
  'https://www.theguardian.com/world/rss',
];

export async function searchRSS(query: string, opts: { limit?: number } = {}): Promise<SearchSource[]> {
  const limit = opts.limit || 8;
  const results: SearchSource[] = [];
  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      for (const item of feed.items || []) {
        const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
        if (text.includes(query.toLowerCase())) {
          results.push({
            url: item.link || '',
            title: item.title || '',
            snippet: item.contentSnippet || '',
            publishDate: item.pubDate,
            domain: (() => { try { return new URL(item.link || '').hostname.replace(/^www\./, ''); } catch { return 'unknown'; } })(),
            sourceType: 'news',
            language: 'en',
            discoveredVia: 'search', // Use allowed value
          });
        }
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    } catch (e) {
      // Ignore feed errors
    }
  }
  console.log('[searchRSS] Results:', results);
  return results;
}
