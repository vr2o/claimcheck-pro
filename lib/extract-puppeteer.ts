import puppeteer from 'puppeteer';

export async function extractWithPuppeteer(url: string): Promise<{ title?: string; text?: string; notes?: string[] }> {
  const notes: string[] = [];
  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Try to extract main content
    const text = await page.evaluate(() => {
      // Try to get article text
      const article = document.querySelector('article');
      if (article) return article.innerText;
      // Fallback: get body text
      return document.body?.innerText || '';
    });
    const title = await page.title();
    notes.push('puppeteer:success');
    return { title, text, notes };
  } catch (e: any) {
    notes.push('puppeteer:failed:' + (e?.message || 'unknown'));
    return { title: url, text: '', notes };
  } finally {
    if (browser) await browser.close();
  }
}
