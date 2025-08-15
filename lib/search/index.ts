// lib/search/index.ts
import { factCheckDomains } from '@/lib/trustMap';
import { searchTavily } from './tavily';
import { searchGoogle } from './google';
import { searchWikipedia } from './wikipedia';

/** Existing type */
export type SearchSource = {
  url: string;
  title?: string;
  snippet?: string;
  publishDate?: string;
  domain: string;
  sourceType?: 'news' | 'gov' | 'edu' | 'ngo' | 'blog' | 'academic' | 'factcheck' | 'unknown';
  language?: string;
  discoveredVia?: 'factcheck-preflight' | 'search';
};

function domainOf(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function dedupeByDomain(items: SearchSource[], cap = 12) {
  const seen = new Set<string>();
  const out: SearchSource[] = [];
  for (const it of items) {
    if (seen.has(it.domain)) continue;
    seen.add(it.domain);
    out.push(it);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Your existing main search function (kept intact).
 * - Fact-check preflight against trusted domains
 * - General Tavily search
 * - De-duplicate by domain
 */
export async function runSearch(opts: {
  claim: string;
  language: string;
  timeRange: '7d' | '30d' | '1y' | 'all';
  isPaid: boolean;
}) {
  const sources: SearchSource[] = [];

  // 1) Fact-check preflight
  try {
    const fc = await searchTavily(opts.claim, {
      language: opts.language,
      timeRange: opts.timeRange,
      domains: factCheckDomains(),
      timeoutMs: Number(process.env.FACTCHECK_TIMEOUT_MS || '4000'),
    });
    for (const r of fc) {
      const d = domainOf(r.url);
      sources.push({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        publishDate: r.published_at,
        domain: d,
        sourceType: 'factcheck',
        discoveredVia: 'factcheck-preflight',
        language: r.language,
      });
    }
  } catch {
    // swallow; we'll still do the general search
  }

  // 2) General search
  const general = await searchTavily(opts.claim, {
    language: opts.language,
    timeRange: opts.timeRange,
  });

  for (const r of general) {
    const d = domainOf(r.url);
    const isFC = factCheckDomains().some((dom) => d.endsWith(dom));
    sources.push({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      publishDate: r.published_at,
      domain: d,
      sourceType: isFC ? 'factcheck' : ((r as any).sourceType as any) || 'unknown',
      discoveredVia: isFC ? 'factcheck-preflight' : 'search',
      language: (r as any).language,
    });
  }

  return { sources: dedupeByDomain(sources, 12) };
}

/* ------------------------------------------------------------------ */
/* New wrapper the extractor expects                                  */
/* ------------------------------------------------------------------ */

export type SearchInput = {
  query: string;
  lang?: string;
  includeCounterEvidence?: boolean; // not used in this minimal wrapper
  timeRange?: '7d' | '30d' | '1y' | 'all';
  limit?: number; // we dedupe to 12 already; you can honor this later if desired
};

/**
 * Uniform interface used by lib/extract.ts for fallbacks (e.g., Twitter/X).
 * Returns:
 *   { results, providersTried, succeeded, failed, notes }
 */
export async function searchAcrossProviders(input: SearchInput) {
  const tried: string[] = [];
  const ok: string[] = [];
  const failed: { name: string; reason: string }[] = [];
  const results: Array<{
    url: string;
    title?: string;
    snippet?: string;
    passageText?: string;
  }> = [];

  const lang = input.lang || 'und';
  const timeRange = input.timeRange || '30d';

  // Try Tavily first
  tried.push('tavily');
  let tavilyOk = false;
  try {
    const out = await runSearch({
      claim: input.query,
      language: lang,
      timeRange,
      isPaid: false,
    });
    for (const s of out.sources) {
      results.push({
        url: s.url,
        title: s.title,
        snippet: s.snippet,
        passageText: s.snippet,
      });
    }
    if (results.length > 0) {
      ok.push('tavily');
      tavilyOk = true;
    }
  } catch (e: any) {
    failed.push({ name: 'tavily', reason: e?.message ?? 'unknown' });
  }

  // Fallback: Google Custom Search if Tavily failed or returned no results
  if (!tavilyOk || results.length === 0) {
    tried.push('google');
    try {
      const googleResults = await searchGoogle(input.query, {
        language: lang,
        timeRange,
        limit: input.limit || 8,
      });
      for (const s of googleResults) {
        results.push({
          url: s.url,
          title: s.title,
          snippet: s.snippet,
          passageText: s.snippet,
        });
      }
      if (googleResults.length > 0) ok.push('google');
    } catch (e: any) {
      failed.push({ name: 'google', reason: e?.message ?? 'unknown' });
    }
  }

  // Fallback: Wikipedia if Tavily and Google fail or return no results
  if (results.length === 0) {
    tried.push('wikipedia');
    try {
      const wikiResults = await searchWikipedia(input.query, {
        language: lang,
        limit: input.limit || 5,
      });
      for (const s of wikiResults) {
        results.push({
          url: s.url,
          title: s.title,
          snippet: s.snippet,
          passageText: s.snippet,
        });
      }
      if (wikiResults.length > 0) ok.push('wikipedia');
    } catch (e: any) {
      failed.push({ name: 'wikipedia', reason: e?.message ?? 'unknown' });
    }
  }

  return {
    results,
    providersTried: tried,
    succeeded: ok,
    failed,
    notes: [],
  };
}