// lib/extract.ts
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { searchAcrossProviders } from '@/lib/search';

type ExtractOpts = { mode?: 'auto' | 'text' | 'image' | 'video' };

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const isUrl = (s: string) => {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
};

const isTwitter = (u: string) => /(^|\.)(x\.com|twitter\.com)\b/i.test(u);

/**
 * Extract textual content from a URL or return the text directly.
 * - For Twitter/X: do NOT scrape; get a snippet via search providers
 * - For HTML: use Readability; fallback to visible text
 * - For everything else: return best-effort text (capped)
 */
export async function extractContent(
  input: string,
  opts: ExtractOpts = {}
): Promise<{ title?: string; text?: string; notes?: string[] }> {
  const notes: string[] = [];
  console.log('[extractContent] input:', input);

  // Plain text input
  if (!isUrl(input)) {
    console.log('[extractContent] Detected plain text input:', input);
    return { title: 'User input', text: input, notes };
  }

  const url = input.trim();

  // Special-case Twitter/X: avoid scraping; use provider snippet
  if (isTwitter(url)) {
    console.log('[extractContent] Detected Twitter/X URL:', url);
    const viaSearch = await extractFromSearch(url).catch(() => null);
    if (viaSearch?.text) {
      notes.push('twitter-fallback:used-search-snippet');
      console.log('[extractContent] Used search snippet for Twitter/X:', viaSearch.text);
      return { title: viaSearch.title || 'Tweet', text: viaSearch.text, notes };
    }
    notes.push('twitter-fallback:search-failed');
    return { title: 'Tweet', text: url, notes };
  }

  // Try fetching HTML
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      cache: 'no-store',
    });

    const ct = res.headers.get('content-type') || '';
    const buf = await res.arrayBuffer();
    const text = new TextDecoder().decode(buf);

    if (ct.includes('text/html')) {
      const dom = new JSDOM(text, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      if (article?.textContent) {
        const title =
          article.title || dom.window.document.title || stripUrl(url);
        console.log('[extractContent] Readability extracted:', article.textContent.slice(0, 200));
        return { title, text: article.textContent, notes };
      }
      // Fallback: visible text
      const plain = dom.window.document.body?.textContent?.trim() || '';
      if (plain) {
        const title = dom.window.document.title || stripUrl(url);
        console.log('[extractContent] Fallback to visible text:', plain.slice(0, 200));
        return { title, text: plain, notes };
      }
    }

    // Non-HTML (basic fallback)
    console.log('[extractContent] Non-HTML response, fallback to raw text:', text.slice(0, 200));
    return {
      title: stripUrl(url),
      text: text.slice(0, 5000),
      notes: ['non-html-response'],
    };
  } catch (e: any) {
    notes.push(`fetch-failed:${e?.message ?? 'unknown'}`);
    console.log('[extractContent] Fetch failed:', e?.message);

    // Final fallback: ask search providers for a snippet
    const viaSearch = await extractFromSearch(url).catch(() => null);
    if (viaSearch?.text) {
      notes.push('html-fallback:used-search-snippet');
      console.log('[extractContent] Used search snippet as fallback:', viaSearch.text);
      return { title: viaSearch.title || stripUrl(url), text: viaSearch.text, notes };
    }
    return { title: stripUrl(url), text: url, notes };
  }
}

function stripUrl(u: string) {
  try {
    const { hostname, pathname } = new URL(u);
    return `${hostname}${pathname}`;
  } catch {
    return u;
  }
}

/**
 * Ask search providers for a snippet corresponding to a URL.
 * Works well for tweets and pages that block direct scraping.
 */
async function extractFromSearch(seed: string) {
  const res = await searchAcrossProviders({
    query: seed,
    lang: 'und',
    includeCounterEvidence: false,
    timeRange: 'all',
    limit: 5,
  });

  const best = (res.results || [])[0];
  if (!best) return null;

  return {
    title: best.title || best.url,
    text: best.snippet || best.passageText || best.title || best.url,
  };
}
