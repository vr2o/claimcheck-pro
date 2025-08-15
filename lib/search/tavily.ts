type TavilyResult = { url: string; title?: string; snippet?: string; published_at?: string; language?: string; sourceType?: string; };
function mapTimeRange(tr: '7d'|'30d'|'1y'|'all'){ if (tr==='7d')return 'week'; if (tr==='30d')return 'month'; if (tr==='1y')return 'year'; return 'all'; }
export async function searchTavily(query: string, opts: { language: string; timeRange: '7d'|'30d'|'1y'|'all'; domains?: string[]; timeoutMs?: number }): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY; if (!key) throw new Error('TAVILY_API_KEY missing');
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeoutMs || Number(process.env.PROVIDER_TIMEOUT_MS || '8000'));
  const body:any = { api_key:key, query, search_depth:'basic', include_answer:false, include_images:false, include_raw_content:false, max_results:8, topic:'news', time_range: mapTimeRange(opts.timeRange) };
  if (opts.domains?.length) body.include_domains = opts.domains;
  const res = await fetch('https://api.tavily.com/search', { method:'POST', signal:controller.signal, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).finally(()=>clearTimeout(t));
  if (!res.ok) throw new Error(`tavily error ${res.status}`);
  const data = await res.json();
  return (data?.results || []).map((r:any)=>({ url:r.url, title:r.title, snippet:r.content, published_at:r.published_time || undefined, sourceType: r.score ? 'news' : 'unknown' }));
}
