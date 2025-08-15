export function ttlForTimeRange(tr: '7d'|'30d'|'1y'|'all' = '30d') {
  const env = (k:string, def:number)=> Number(process.env[k] || def);
  if (tr === '7d') return env('CACHE_TTL_7D_SECONDS', 900);
  if (tr === '30d') return env('CACHE_TTL_30D_SECONDS', 3600);
  if (tr === '1y') return env('CACHE_TTL_1Y_SECONDS', 21600);
  if (tr === 'all') return env('CACHE_TTL_ALL_SECONDS', 86400);
  return env('CACHE_TTL_SECONDS', 600);
}
