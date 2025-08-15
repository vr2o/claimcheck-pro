import { trustForDomain, isFactChecker } from '@/lib/trustMap';
export function assessCredibility(domain: string, sourceType?: string, discoveredVia?: string): number {
  const base = trustForDomain(domain, sourceType);
  const boost = isFactChecker(domain) || discoveredVia === 'factcheck-preflight' ? 0.05 : 0;
  return Math.max(0, Math.min(1, base + boost));
}
