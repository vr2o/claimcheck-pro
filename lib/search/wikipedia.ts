import type { SearchSource } from './index';

/**
 * Wikipedia API search provider (no key required)
 */
export async function searchWikipedia(query: string, opts: { language?: string; limit?: number } = {}): Promise<SearchSource[]> {
  const lang = opts.language || 'en';
  const limit = opts.limit || 5;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia search error ${res.status}`);
  const data = await res.json();
  return (data.query?.search || []).map((item: any) => ({
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    title: item.title,
    snippet: item.snippet.replace(/<[^>]+>/g, ''),
    publishDate: undefined,
    domain: `${lang}.wikipedia.org`,
    sourceType: 'encyclopedia',
    language: lang,
    discoveredVia: 'wikipedia',
  }));
}
