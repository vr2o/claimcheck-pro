interface SearchParams {
  query: string;
  lang?: string;
  includeCounterEvidence?: boolean;
  timeRange?: string;
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  passageText?: string;
  publishDate?: string;
  domain?: string;
  sourceType?: string;
  discoveredVia?: string;
}

interface SearchResults {
  results: SearchResult[];
  providersTried: string[];
  succeeded: string[];
  failed: Array<{ name: string; reason: string }>;
  notes: string[];
}

function analyzeClaimType(claim: string): {
  type: 'scientific' | 'medical' | 'historical' | 'political' | 'general';
  keywords: string[];
  context: string[];
} {
  const lowerClaim = claim.toLowerCase();
  
  // Scientific/physics claims
  if (lowerClaim.match(/\b(sky|light|color|physics|gravity|temperature|boil|melt|freeze|atmosphere|wavelength|energy|matter|chemical|reaction)\b/)) {
    return {
      type: 'scientific',
      keywords: extractKeywords(claim),
      context: ['scientific explanation', 'physics', 'research', 'study', 'evidence']
    };
  }
  
  // Medical/anatomy claims
  if (lowerClaim.match(/\b(human|body|anatomy|medical|health|disease|organ|bone|muscle|blood|brain|heart|lung|leg|arm|eye|ear)\b/)) {
    return {
      type: 'medical',
      keywords: extractKeywords(claim),
      context: ['medical', 'anatomy', 'physiology', 'health', 'research']
    };
  }
  
  // Historical claims
  if (lowerClaim.match(/\b(history|historical|year|century|war|battle|ancient|medieval|renaissance|revolution|empire|king|queen|president)\b/) ||
      lowerClaim.match(/\b(19|20)\d{2}\b/) || // Years like 1969, 2001
      lowerClaim.match(/\b(happened|occurred|founded|established|discovered|invented|died|born|ruled)\b/)) {
    return {
      type: 'historical',
      keywords: extractKeywords(claim),
      context: ['historical', 'history', 'documented', 'records', 'evidence']
    };
  }
  
  // Political claims
  if (lowerClaim.match(/\b(government|politics|political|policy|law|congress|senate|president|minister|election|vote|democrat|republican|liberal|conservative)\b/)) {
    return {
      type: 'political',
      keywords: extractKeywords(claim),
      context: ['political', 'government', 'policy', 'fact check', 'verification']
    };
  }
  
  // Default to general
  return {
    type: 'general',
    keywords: extractKeywords(claim),
    context: ['fact check', 'verification', 'evidence']
  };
}

function extractKeywords(claim: string): string[] {
  // Remove common words and extract meaningful keywords
  const stopWords = new Set(['the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'that', 'this', 'these', 'those']);
  
  return claim
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 8); // Limit to most important keywords
}

function constructFactCheckQuery(claim: string): string {
  const analysis = analyzeClaimType(claim);
  const keywords = analysis.keywords.join(' ');
  const contextTerms = analysis.context.join(' ');
  
  // Create a focused query based on claim type
  switch (analysis.type) {
    case 'scientific':
      return `${keywords} ${contextTerms} scientific explanation research`;
    case 'medical':
      return `${keywords} ${contextTerms} medical information`;
    case 'historical':
      return `${keywords} ${contextTerms} historical facts`;
    case 'political':
      return `"${claim}" ${contextTerms} snopes politifact`;
    default:
      return `"${claim}" ${contextTerms} true false`;
  }
}

function getRelevantDomains(claim: string): string[] {
  const analysis = analyzeClaimType(claim);
  
  const baseDomains = [
    'wikipedia.org',
    'britannica.com',
    'snopes.com',
    'factcheck.org',
    'reuters.com',
    'apnews.com',
    'bbc.com'
  ];
  
  const typeDomains: { [key: string]: string[] } = {
    scientific: [
      'nasa.gov',
      'noaa.gov',
      'scientificamerican.com',
      'nature.com',
      'science.org',
      'physics.org',
      'nationalgeographic.com',
      'howstuffworks.com',
      'khanacademy.org'
    ],
    medical: [
      'mayoclinic.org',
      'webmd.com',
      'nih.gov',
      'who.int',
      'cdc.gov',
      'health.harvard.edu',
      'hopkinsmedicine.org'
    ],
    historical: [
      'history.com',
      'smithsonianmag.com',
      'nationalarchives.gov',
      'loc.gov',
      'historynet.com'
    ],
    political: [
      'politifact.com',
      'factcheck.org',
      'snopes.com',
      'washingtonpost.com',
      'nytimes.com',
      'congress.gov'
    ]
  };
  
  return [...baseDomains, ...(typeDomains[analysis.type] || [])];
}

function constructCounterQuery(claim: string): string {
  const analysis = analyzeClaimType(claim);
  const keywords = analysis.keywords.slice(0, 3).join(' '); // Use fewer keywords for counter search
  
  switch (analysis.type) {
    case 'scientific':
      return `${keywords} myth debunked incorrect misconception false`;
    case 'medical':
      return `${keywords} myth medical misinformation false claim`;
    case 'historical':
      return `${keywords} myth historical inaccuracy false disputed`;
    case 'political':
      return `"${claim}" false misleading fact check debunked`;
    default:
      return `"${claim}" myth false debunked incorrect wrong`;
  }
}

async function searchTavily(query: string, options: { 
  includeImages?: boolean; 
  includeDomains?: string[]; 
  excludeDomains?: string[];
  maxResults?: number 
} = {}): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not found in environment');
  }

  try {
    const requestBody: any = {
      query,
      search_depth: 'advanced',
      include_answer: false,
      include_images: options.includeImages || false,
      max_results: options.maxResults || 10,
    };

    // Add domain filters if provided
    if (options.includeDomains && options.includeDomains.length > 0) {
      requestBody.include_domains = options.includeDomains;
    }
    
    if (options.excludeDomains && options.excludeDomains.length > 0) {
      requestBody.exclude_domains = options.excludeDomains;
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.results || []).map((result: any) => ({
      url: result.url,
      title: result.title || '',
      snippet: result.content || '',
      passageText: result.content || '',
      publishDate: result.published_date || null,
      domain: new URL(result.url).hostname,
      sourceType: 'web',
      discoveredVia: 'tavily',
    }));
  } catch (error: any) {
    console.error('[search] Tavily error:', error);
    throw error;
  }
}

export async function searchAcrossProviders(params: SearchParams): Promise<SearchResults> {
  const { query, lang = 'en', includeCounterEvidence = true, timeRange = '30d' } = params;
  
  // Analyze claim and optimize query
  const claimAnalysis = analyzeClaimType(query);
  const optimizedQuery = constructFactCheckQuery(query);
  const relevantDomains = getRelevantDomains(query);
  
  console.log(`[search] Original query: "${query}"`);
  console.log(`[search] Claim type: ${claimAnalysis.type}`);
  console.log(`[search] Keywords:`, claimAnalysis.keywords);
  console.log(`[search] Optimized query: "${optimizedQuery}"`);
  console.log(`[search] Target domains:`, relevantDomains.slice(0, 5)); // Log first 5 for brevity

  const results: SearchResult[] = [];
  const providersTried: string[] = [];
  const succeeded: string[] = [];
  const failed: Array<{ name: string; reason: string }> = [];
  const notes: string[] = [];

  // Exclude irrelevant domains that often contain false matches
  const excludeDomains = [
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'reddit.com',
    'yahoo.com',
    'pinterest.com',
    'linkedin.com'
  ];

  // Try Tavily with domain targeting
  providersTried.push('tavily');
  try {
    const tavilyResults = await searchTavily(optimizedQuery, {
      maxResults: 8,
      includeDomains: relevantDomains,
      excludeDomains: excludeDomains,
    });
    
    results.push(...tavilyResults);
    succeeded.push('tavily');
    console.log(`[search] Tavily returned ${tavilyResults.length} results`);
  } catch (error: any) {
    failed.push({ name: 'tavily', reason: error.message });
    console.error('[search] Tavily failed:', error.message);
    
    // Fallback: try without domain restrictions
    try {
      const fallbackResults = await searchTavily(optimizedQuery, {
        maxResults: 8,
        excludeDomains: excludeDomains,
      });
      results.push(...fallbackResults);
      succeeded.push('tavily-fallback');
      console.log(`[search] Tavily fallback returned ${fallbackResults.length} results`);
    } catch (fallbackError: any) {
      console.error('[search] Tavily fallback also failed:', fallbackError.message);
    }
  }

  // For counter-evidence, only search if we have good supporting evidence
  if (includeCounterEvidence && results.length >= 3) {
    const counterQuery = constructCounterQuery(query);
    console.log(`[search] Counter-evidence query: "${counterQuery}"`);
    
    try {
      const counterResults = await searchTavily(counterQuery, {
        maxResults: 2, // Fewer counter results
        excludeDomains: excludeDomains,
      });
      
      // Mark these as potentially challenging
      const markedCounterResults = counterResults.map(result => ({
        ...result,
        discoveredVia: 'tavily-counter',
      }));
      
      results.push(...markedCounterResults);
      console.log(`[search] Counter-evidence returned ${counterResults.length} results`);
    } catch (error: any) {
      console.error('[search] Counter-evidence search failed:', error.message);
    }
  }

  return {
    results,
    providersTried,
    succeeded,
    failed,
    notes,
  };
}