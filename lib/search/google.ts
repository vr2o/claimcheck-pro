import type { SearchSource } from './index';

/**
 * Google Custom Search API provider
 * Requires GOOGLE_API_KEY and GOOGLE_CSE_ID in env
 */
export async function searchGoogle(query: string, opts: { language?: string; timeRange?: string; limit?: number } = {}): Promise<SearchSource[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) throw new Error('GOOGLE_API_KEY or GOOGLE_CSE_ID missing');

  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: String(opts.limit || 8),
    lr: opts.language ? `lang_${opts.language}` : '',
    sort: opts.timeRange === '7d' ? 'date' : '',
  });

  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google search error ${res.status}`);
  const data = await res.json();

  return (data.items || []).map((item: any) => ({
    url: item.link,
    title: item.title,
    snippet: item.snippet,
    publishDate: undefined,
    domain: (() => { try { return new URL(item.link).hostname.replace(/^www\./, ''); } catch { return 'unknown'; } })(),
    sourceType: 'news',
    language: opts.language,
    discoveredVia: 'google',
  }));
}
