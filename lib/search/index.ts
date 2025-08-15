import { factCheckDomains } from '@/lib/trustMap';
import { searchTavily } from './tavily';

export type SearchSource = {
  url: string; title?: string; snippet?: string; publishDate?: string; domain: string;
  sourceType?: 'news'|'gov'|'edu'|'ngo'|'blog'|'academic'|'factcheck'|'unknown';
  language?: string; discoveredVia?: 'factcheck-preflight'|'search';
};

function domainOf(url: string){ try { const u = new URL(url); return u.hostname.replace(/^www\./,''); } catch { return 'unknown'; } }
function dedupeByDomain(items: SearchSource[], cap=12){ const seen=new Set<string>(); const out:SearchSource[]=[]; for(const it of items){ if(seen.has(it.domain))continue; seen.add(it.domain); out.push(it); if(out.length>=cap)break; } return out; }

export async function runSearch(opts:{ claim:string; language:string; timeRange:'7d'|'30d'|'1y'|'all'; isPaid:boolean; }) {
  const sources: SearchSource[] = [];
  try {
    const fc = await searchTavily(opts.claim, { language:opts.language, timeRange:opts.timeRange, domains: factCheckDomains(), timeoutMs: Number(process.env.FACTCHECK_TIMEOUT_MS || '4000') });
    for (const r of fc) {
      const d = domainOf(r.url);
      sources.push({ url:r.url, title:r.title, snippet:r.snippet, publishDate:r.published_at, domain:d, sourceType:'factcheck', discoveredVia:'factcheck-preflight', language:r.language });
    }
  } catch {}
  const general = await searchTavily(opts.claim, { language:opts.language, timeRange:opts.timeRange });
  for (const r of general) {
    const d = domainOf(r.url);
    const isFC = factCheckDomains().some(dom => d.endsWith(dom));
    sources.push({ url:r.url, title:r.title, snippet:r.snippet, publishDate:r.published_at, domain:d, sourceType: isFC?'factcheck':(r.sourceType as any)||'unknown', discoveredVia: isFC?'factcheck-preflight':'search', language:r.language });
  }
  return { sources: dedupeByDomain(sources, 12) };
}
