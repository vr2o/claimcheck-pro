const FACTCHECKERS = ['snopes.com','politifact.com','factcheck.org','reuters.com','apnews.com'];
export const FACTCHECK_BOOST = 0.05;
const BASE_TRUST: Record<string, number> = { 'snopes.com':0.9,'politifact.com':0.9,'reuters.com':0.85,'apnews.com':0.82,'bbc.com':0.82,'nytimes.com':0.8,'nature.com':0.92,'who.int':0.92,'nih.gov':0.92,'harvard.edu':0.9 };
export function isFactChecker(domain: string){ return FACTCHECKERS.some(d => domain.endsWith(d)); }
export function trustForDomain(domain: string, sourceType?: string): number {
  if (BASE_TRUST[domain]) return BASE_TRUST[domain];
  if (isFactChecker(domain)) return 0.88;
  if (/\.(gov|edu)$/.test(domain)) return 0.85;
  if (sourceType === 'academic') return 0.88;
  if (sourceType === 'news') return 0.7;
  return 0.55;
}
export function factCheckDomains(): string[] { return (process.env.FACTCHECK_DOMAINS || FACTCHECKERS.join(',')).split(',').map(s=>s.trim()); }
