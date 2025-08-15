import type { SearchSource } from './search';
import { clamp01 } from './utils';
export type ScoredSource = SearchSource & { credibilityScore: number; directnessScore?: number; methodologyScore?: number; stance?: 'supporting'|'challenging'|'neutral'; bias?: { politicalLean?: number; commercialInterest?: number; framing?: string[] }; qualityScore?: number; };

const DEFAULTS = { credibility:0.5, directness:0.5, methodology:0.5, recency:0.5 };

function recencyScore(publishDate?: string){ if(!publishDate) return DEFAULTS.recency; const dt=new Date(publishDate).getTime(); if(isNaN(dt))return DEFAULTS.recency; const ageDays=(Date.now()-dt)/(1000*60*60*24); if(ageDays<=7)return 1; if(ageDays<=30)return 0.8; if(ageDays<=365)return 0.6; return 0.4; }
function roughDirectness(claim:string, snippet?:string){ if(!snippet) return DEFAULTS.directness; const a=new Set(claim.toLowerCase().split(/\W+/).filter(Boolean)); const b=new Set(snippet.toLowerCase().split(/\W+/).filter(Boolean)); const inter=[...a].filter(x=>b.has(x)).length; return clamp01(inter/Math.max(8, a.size)); }
function stanceHeuristic(claim:string, snippet?:string): 'supporting'|'challenging'|'neutral' { if(!snippet) return 'neutral'; const s=snippet.toLowerCase(); const neg=/\b(not|no|false|hoax|refute|debunk|deny|dispute|contradict)\b/; const pos=/\b(confirm|corroborate|support|affirm|verify)\b/; if(neg.test(s)) return 'challenging'; if(pos.test(s)) return 'supporting'; return 'neutral'; }

export function scoreAll(opts:{ claim:string; language:string; sources: Array<Omit<ScoredSource,'qualityScore'|'stance'|'directnessScore'|'methodologyScore'>>; isPaid:boolean; }) {
  const weighted = opts.sources.map(s => {
    const directness = roughDirectness(opts.claim, s.snippet);
    const methodology = /study|dataset|methodology|replication|survey|randomized|placebo|meta-?analysis/i.test(s.snippet || '') ? 0.8 : 0.5;
    const rec = recencyScore(s.publishDate);
    const stance = stanceHeuristic(opts.claim, s.snippet);
    const credibility = s.credibilityScore ?? DEFAULTS.credibility;
    const quality = 0.40 * credibility + 0.25 * directness + 0.15 * methodology + 0.10 * rec + 0.10 * 0.5;
    return { ...s, directnessScore: directness, methodologyScore: methodology, qualityScore: clamp01(quality), stance };
  });
  const N = Number(process.env.EQS_TOP_N || '5');
  const top = [...weighted].sort((a, b) => (b.directnessScore || 0) - (a.directnessScore || 0)).slice(0, N);
  const eqs = Math.round(100 * (top.reduce((acc, s) => acc + Math.pow(s.directnessScore || 0.5, 2) * (s.qualityScore || 0.5), 0) / (top.reduce((acc, s) => acc + Math.pow(s.directnessScore || 0.5, 2), 0) || 1)));
  const domains = new Set(weighted.map(s => (s.domain ? s.domain.split('.').slice(-1)[0] : 'unknown')));
  const stances = new Set(weighted.map(s => s.stance));
  const types = new Set(weighted.map(s => s.sourceType));
  const sdiRaw = (domains.size + stances.size + types.size) / 20;
  const sdi = Math.round(10 * Math.min(1, sdiRaw));
  const consensus = { supporting: weighted.filter(s => s.stance === 'supporting').length, challenging: weighted.filter(s => s.stance === 'challenging').length, neutral: weighted.filter(s => s.stance === 'neutral').length };
  return { eqs, sdi, sourcesWithScores: weighted, consensus };
}
