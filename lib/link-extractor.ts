import { JSDOM } from 'jsdom';

interface ExtractedContent {
  title: string;
  mainClaim: string;
  description?: string;
  publishDate?: string;
  author?: string;
  url: string;
}

export async function extractClaimFromUrl(url: string): Promise<ExtractedContent> {
  try {
    console.log(`[link-extractor] Fetching content from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClaimCheckBot/1.0; +https://claimcheck.pro)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract title
    let title = '';
    const titleElement = document.querySelector('title');
    if (titleElement) {
      title = titleElement.textContent?.trim() || '';
    }

    // Try to get better title from meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
    if (ogTitle && ogTitle.length > title.length) title = ogTitle;
    if (twitterTitle && twitterTitle.length > title.length) title = twitterTitle;

    // Extract description
    let description = '';
    const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
    
    description = ogDescription || metaDescription || twitterDescription || '';

    // Extract main content/claim
    let mainContent = '';
    
    // Try to find the main article content
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.content',
      '.entry-content',
      '.post-body',
      '.article-body',
      'h1, h2', // Fallback to headlines
    ];

    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Get text from the first few elements
        const texts = Array.from(elements)
          .slice(0, 3)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 20)
          .join(' ');
        
        if (texts.length > mainContent.length) {
          mainContent = texts;
        }
      }
    }

    // If we still don't have good content, try paragraphs
    if (mainContent.length < 50) {
      const paragraphs = document.querySelectorAll('p');
      mainContent = Array.from(paragraphs)
        .slice(0, 5)
        .map(p => p.textContent?.trim())
        .filter(text => text && text.length > 20)
        .join(' ');
    }

    // Extract other metadata
    const publishDate = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
                       document.querySelector('meta[name="date"]')?.getAttribute('content') ||
                       document.querySelector('time')?.getAttribute('datetime');

    const author = document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                   document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
                   document.querySelector('.author')?.textContent?.trim();

    // Generate a concise claim from the extracted content
    const mainClaim = generateClaimFromContent(title, description, mainContent);

    console.log(`[link-extractor] Extracted claim: "${mainClaim}"`);

    return {
      title: title || 'Untitled',
      mainClaim,
      description,
      publishDate,
      author,
      url
    };

  } catch (error: any) {
    console.error('[link-extractor] Failed to extract content:', error);
    throw new Error(`Failed to extract content from URL: ${error.message}`);
  }
}

function generateClaimFromContent(title: string, description: string, content: string): string {
  // Clean and prioritize content
  const cleanTitle = cleanText(title);
  const cleanDescription = cleanText(description);
  const cleanContent = cleanText(content);

  // Try different strategies to generate a good claim
  
  // Strategy 1: If title is a clear statement/claim
  if (isFactualStatement(cleanTitle)) {
    return truncateToSentence(cleanTitle, 200);
  }

  // Strategy 2: Use description if it's factual
  if (cleanDescription && isFactualStatement(cleanDescription)) {
    return truncateToSentence(cleanDescription, 200);
  }

  // Strategy 3: Find factual statements in content
  const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
  for (const sentence of sentences.slice(0, 5)) {
    const trimmed = sentence.trim();
    if (isFactualStatement(trimmed) && trimmed.length > 20 && trimmed.length < 200) {
      return trimmed;
    }
  }

  // Strategy 4: Combine title and description
  if (cleanTitle && cleanDescription) {
    const combined = `${cleanTitle}: ${cleanDescription}`;
    if (combined.length < 250) {
      return truncateToSentence(combined, 200);
    }
  }

  // Strategy 5: Use title + first sentence
  if (cleanTitle && sentences.length > 0) {
    const combined = `${cleanTitle}. ${sentences[0].trim()}`;
    return truncateToSentence(combined, 200);
  }

  // Fallback: Use title or first sentence
  return truncateToSentence(cleanTitle || sentences[0]?.trim() || 'Content from link', 150);
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:-]/g, '')
    .trim();
}

function isFactualStatement(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Skip if it looks like navigation, ads, or website elements
  const skipPatterns = [
    /^(home|about|contact|menu|navigation|search|subscribe|login|register|cookie|privacy)/,
    /^(click here|read more|learn more|sign up|get started)/,
    /(advertisement|ad|sponsored|promoted content)/,
    /^(join|follow|share|like|comment)/
  ];
  
  if (skipPatterns.some(pattern => pattern.test(lowerText))) {
    return false;
  }

  // Look for factual indicators
  const factualPatterns = [
    // Statements with specific data
    /\b(according to|study shows|research indicates|data shows|statistics show)/,
    // Scientific/factual language
    /\b(scientists|researchers|experts|studies|evidence|findings)/,
    // Specific facts
    /\b(is|are|was|were|has|have|will|would|can|could)\b.*\b(the|a|an)\b/,
    // Quantifiable statements
    /\b\d+(\.\d+)?\s*(percent|%|degrees?|years?|million|billion|thousand)/,
    // Geographic/temporal facts
    /\b(in|on|at|during|since|until|from|between)\s+\d{4}\b/,
    // Definitive statements
    /\b(confirmed|announced|declared|stated|reported|revealed)\b/
  ];

  return factualPatterns.some(pattern => pattern.test(lowerText)) || 
         (text.length > 20 && text.length < 300 && /^[A-Z].*[.!?]?$/.test(text));
}

function truncateToSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to cut at sentence boundary
  const sentences = text.split(/[.!?]+/);
  let result = sentences[0];
  
  for (let i = 1; i < sentences.length && result.length < maxLength - 50; i++) {
    const addition = sentences[i].trim();
    if (result.length + addition.length + 2 <= maxLength) {
      result += '. ' + addition;
    } else {
      break;
    }
  }
  
  // Ensure it ends properly
  if (!result.match(/[.!?]$/)) {
    result += '.';
  }
  
  return result.length <= maxLength ? result : text.substring(0, maxLength - 3) + '...';
}