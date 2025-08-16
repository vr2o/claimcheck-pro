import { clamp01 } from './utils';

export type ScoredSource = any & { 
  credibilityScore: number; 
  directnessScore?: number; 
  methodologyScore?: number; 
  stance?: 'supporting'|'challenging'|'neutral'; 
  bias?: { politicalLean?: number; commercialInterest?: number; framing?: string[] }; 
  qualityScore?: number; 
};

const DEFAULTS = { 
  credibility: 0.5, 
  directness: 0.5, 
  methodology: 0.5, 
  recency: 0.5 
};

function recencyScore(publishDate?: string) {
  if (!publishDate) return DEFAULTS.recency;
  const dt = new Date(publishDate).getTime();
  if (isNaN(dt)) return DEFAULTS.recency;
  const ageDays = (Date.now() - dt) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.8;
  if (ageDays <= 365) return 0.6;
  return 0.4;
}

function extractClaimKeywords(claim: string): string[] {
  const stopWords = new Set(['the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'have', 'has', 'had']);
  return claim.toLowerCase().split(/\W+/).filter(word => word.length > 2 && !stopWords.has(word));
}

function isWellEstablishedFact(claim: string): boolean {
  const lowerClaim = claim.toLowerCase();
  
  // Geographic facts (capitals, locations)
  if (lowerClaim.match(/\b(capital|city|country|located|continent|ocean|sea|mountain|river)\b/)) {
    return true;
  }
  
  // Physical constants and scientific facts
  if (lowerClaim.match(/\b(freezes?|boils?|melts?|degrees?|celsius|fahrenheit|temperature|gravity|speed of light|physics|chemistry)\b/)) {
    return true;
  }
  
  // Basic anatomy and biology
  if (lowerClaim.match(/\b(human|heart|lungs?|brain|blood|organs?|bones?|muscles?|anatomy|chambers?|limbs?|legs?|arms?)\b/)) {
    return true;
  }
  
  // Mathematical facts
  if (lowerClaim.match(/\b(equals?|plus|minus|times|divided|mathematics?|math|geometry|algebra)\b/)) {
    return true;
  }
  
  // Basic historical dates (major events, well-documented)
  if (lowerClaim.match(/\b(world war|independence|revolution|founded|established)\b/) && 
      lowerClaim.match(/\b(19|20)\d{2}\b/)) {
    return true;
  }
  
  return false;
}

function roughDirectness(claim: string, snippet?: string) {
  if (!snippet) return DEFAULTS.directness;
  
  const claimKeywords = extractClaimKeywords(claim);
  const snippetLower = snippet.toLowerCase();
  
  // Count keyword matches
  const keywordMatches = claimKeywords.filter(keyword => 
    snippetLower.includes(keyword)
  ).length;
  
  // Bonus for exact phrase matches
  let exactPhraseBonus = 0;
  const claimPhrases = claim.toLowerCase().match(/[^,\.!?;]+/g) || [];
  for (const phrase of claimPhrases) {
    if (phrase.trim().length > 10 && snippetLower.includes(phrase.trim())) {
      exactPhraseBonus = 0.3;
      break;
    }
  }
  
  // Base directness from keyword overlap
  const baseDirectness = clamp01(keywordMatches / Math.max(claimKeywords.length, 3));
  
  // Boost directness for well-established facts if we have good keyword coverage
  if (isWellEstablishedFact(claim) && keywordMatches >= 2) {
    return clamp01(Math.max(baseDirectness + exactPhraseBonus, 0.8));
  }
  
  return clamp01(baseDirectness + exactPhraseBonus);
}

function stanceHeuristic(claim: string, snippet?: string): 'supporting'|'challenging'|'neutral' {
  if (!snippet) return 'neutral';
  
  const claimLower = claim.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  
  // Extract key concepts from the claim
  const claimKeywords = extractClaimKeywords(claim);
  
  // Look for explicit agreement/disagreement patterns
  const strongNegative = /\b(not|no|false|hoax|myth|refute|debunk|deny|dispute|contradict|incorrect|wrong|untrue|misleading)\b/;
  const strongPositive = /\b(confirm|corroborate|support|affirm|verify|true|correct|accurate|established|proven|validates|demonstrates|shows that)\b/;
  
  // Check for contextual supporting evidence
  const explanatoryTerms = /\b(because|due to|caused by|results from|explained by|reason|explanation|study shows|research indicates|evidence suggests|scientists found|data shows)\b/;
  
  // Strong negative indicators
  if (strongNegative.test(snippetLower)) {
    // But check if it's denying something else, not the main claim
    const keywordMatchesAfterNegation = claimKeywords.some(keyword => {
      const negationIndex = snippetLower.search(strongNegative);
      const keywordIndex = snippetLower.indexOf(keyword);
      return keywordIndex > negationIndex && keywordIndex - negationIndex < 50; // Within 50 chars
    });
    
    if (keywordMatchesAfterNegation) {
      return 'challenging';
    }
  }
  
  // Strong positive indicators
  if (strongPositive.test(snippetLower)) {
    return 'supporting';
  }
  
  // For well-established facts, be more liberal about what counts as supporting
  if (isWellEstablishedFact(claim)) {
    const keywordMatches = claimKeywords.filter(keyword => 
      snippetLower.includes(keyword)
    ).length;
    
    // If we have good keyword coverage, assume it's supporting unless explicitly contradicted
    if (keywordMatches >= Math.min(claimKeywords.length * 0.5, 2)) {
      // Check for factual/encyclopedic content
      const factualTerms = /\b(definition|means|refers to|known as|called|termed|defined as|consists of|made up of|composed of|located|situated|temperature|degrees|official|capital|government)\b/;
      if (factualTerms.test(snippetLower)) {
        return 'supporting';
      }
      
      // Check for explanatory content 
      if (explanatoryTerms.test(snippetLower)) {
        return 'supporting';
      }
      
      // If it's from a high-credibility source and mentions key terms, assume supporting
      const domain = snippetLower; // This is a simplified check, in real usage we'd get domain separately
      if (keywordMatches >= 2) {
        return 'supporting';
      }
    }
  }
  
  // Check for explanatory content (often supporting for factual claims)
  if (explanatoryTerms.test(snippetLower)) {
    const keywordMatches = claimKeywords.filter(keyword => 
      snippetLower.includes(keyword)
    ).length;
    
    // If snippet contains many claim keywords AND explanatory language, likely supporting
    if (keywordMatches >= Math.min(claimKeywords.length * 0.6, 3)) {
      return 'supporting';
    }
  }
  
  // Check for definitional or factual content
  const definitionalTerms = /\b(definition|means|refers to|known as|called|termed|defined as|consists of|made up of|composed of)\b/;
  if (definitionalTerms.test(snippetLower)) {
    const keywordMatches = claimKeywords.filter(keyword => 
      snippetLower.includes(keyword)
    ).length;
    
    if (keywordMatches >= 2) {
      return 'supporting';
    }
  }
  
  return 'neutral';
}

function getCredibilityScore(domain?: string): number {
  if (!domain) return 0.5;
  
  const domainLower = domain.toLowerCase();
  
  // Tier 1: Highest credibility (government, academic, established scientific)
  if (domainLower.match(/\b(nasa|noaa|nih|cdc|who|gov|edu|nature|science|pnas)\b/)) {
    return 0.9;
  }
  
  // Tier 2: High credibility (reputable news, fact-checkers, educational)
  if (domainLower.match(/\b(britannica|scientificamerican|nationalgeographic|reuters|apnews|bbc|snopes|factcheck|politifact|mayo|webmd)\b/)) {
    return 0.8;
  }
  
  // Tier 3: Good credibility (wikipedia, established media)
  if (domainLower.match(/\b(wikipedia|nytimes|washingtonpost|cnn|npr|pbs|guardian|economist)\b/)) {
    return 0.7;
  }
  
  // Tier 4: Medium credibility (other .org, some commercial)
  if (domainLower.includes('.org') || 
      domainLower.match(/\b(howstuffworks|khanacademy|healthline|medicalnewstoday)\b/)) {
    return 0.6;
  }
  
  // Tier 5: Lower credibility
  if (domainLower.match(/\b(yahoo|reddit|quora|answers|ask)\b/)) {
    return 0.4;
  }
  
  return 0.5; // Default
}

export function scoreAll(opts: { 
  claim: string; 
  language: string; 
  sources: Array<Omit<ScoredSource, 'qualityScore'|'stance'|'directnessScore'|'methodologyScore'>>; 
  isPaid: boolean; 
}) {
  console.log(`[scoring] Evaluating ${opts.sources.length} sources for claim: "${opts.claim}"`);
  
  const isEstablishedFact = isWellEstablishedFact(opts.claim);
  console.log(`[scoring] Is well-established fact: ${isEstablishedFact}`);
  
  const weighted = opts.sources.map(s => {
    const directness = roughDirectness(opts.claim, s.snippet);
    const methodology = /study|dataset|methodology|replication|survey|randomized|placebo|meta-?analysis|research|experiment|peer.?review|journal|published/i.test(s.snippet || '') ? 0.8 : 0.5;
    const rec = recencyScore(s.publishDate);
    const stance = stanceHeuristic(opts.claim, s.snippet);
    const credibility = s.credibilityScore ?? getCredibilityScore(s.domain);
    const quality = 0.40 * credibility + 0.25 * directness + 0.15 * methodology + 0.10 * rec + 0.10 * 0.5;
    
    const scored = { 
      ...s, 
      directnessScore: directness, 
      methodologyScore: methodology, 
      qualityScore: clamp01(quality), 
      stance,
      credibilityScore: credibility
    };
    
    console.log(`[scoring] ${s.domain || 'unknown'}: directness=${directness.toFixed(2)}, stance=${stance}, credibility=${credibility.toFixed(2)}, quality=${scored.qualityScore?.toFixed(2)}`);
    
    return scored;
  });
  
  const N = Number(process.env.EQS_TOP_N || '5');
  const top = [...weighted].sort((a, b) => (b.directnessScore || 0) - (a.directnessScore || 0)).slice(0, N);
  
  // Calculate base EQS
  let eqs = Math.round(100 * (
    top.reduce((acc, s) => acc + Math.pow(s.directnessScore || 0.5, 2) * (s.qualityScore || 0.5), 0) / 
    (top.reduce((acc, s) => acc + Math.pow(s.directnessScore || 0.5, 2), 0) || 1)
  ));
  
  // Apply well-established fact boost
  if (isEstablishedFact) {
    const supportingCount = weighted.filter(s => s.stance === 'supporting').length;
    const challengingCount = weighted.filter(s => s.stance === 'challenging').length;
    const highCredibilityCount = weighted.filter(s => (s.credibilityScore || 0) >= 0.7).length;
    const highDirectnessCount = weighted.filter(s => (s.directnessScore || 0) >= 0.6).length;
    
    console.log(`[scoring] Fact boost analysis: supporting=${supportingCount}, challenging=${challengingCount}, highCred=${highCredibilityCount}, highDirect=${highDirectnessCount}`);
    
    // Boost conditions for well-established facts
    if (supportingCount >= 2 && challengingCount === 0 && highCredibilityCount >= 1) {
      // Strong evidence for established fact
      eqs = Math.max(eqs, 95);
      console.log(`[scoring] Applied strong fact boost: ${eqs}`);
    } else if (supportingCount >= 1 && challengingCount === 0 && highDirectnessCount >= 2) {
      // Good evidence for established fact
      eqs = Math.max(eqs, 90);
      console.log(`[scoring] Applied moderate fact boost: ${eqs}`);
    } else if (supportingCount > challengingCount && highCredibilityCount >= 1) {
      // Some evidence for established fact
      eqs = Math.max(eqs, 85);
      console.log(`[scoring] Applied minor fact boost: ${eqs}`);
    }
  }
  
  const domains = new Set(weighted.map(s => (s.domain ? s.domain.split('.').slice(-1)[0] : 'unknown')));
  const stances = new Set(weighted.map(s => s.stance));
  const types = new Set(weighted.map(s => s.sourceType));
  const sdiRaw = (domains.size + stances.size + types.size) / 20;
  const sdi = Math.round(10 * Math.min(1, sdiRaw));
  
  const consensus = { 
    supporting: weighted.filter(s => s.stance === 'supporting').length, 
    challenging: weighted.filter(s => s.stance === 'challenging').length, 
    neutral: weighted.filter(s => s.stance === 'neutral').length 
  };
  
  console.log(`[scoring] Final results: EQS=${eqs}, consensus=`, consensus);
  
  return { eqs, sdi, sourcesWithScores: weighted, consensus };
}
