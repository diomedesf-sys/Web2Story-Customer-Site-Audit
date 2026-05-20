import { chromium, Browser, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// --- INTERFACES ---
export interface AEOAssessment {
  foundTypes: string[];
  missingCriticalTypes: string[];
  isAEOReady: boolean;
}

export interface VoiceAssessment {
  easeScore: number;
  gradeLevel: number;
  isVoiceReady: boolean;
}

export interface ImageData {
  src: string;
  alt: string;
  width: number;
  height: number;
  loading?: string;
  localPath?: string;
}

export interface PageCrawlData {
  url: string;
  title: string;
  metaDescription: string;
  fullText: string;
  wordCount: number;
  isThinContent: boolean;
  duplicateOf?: string;
  titleIssue: 'missing' | 'too-short' | 'too-long' | null;
  hasViewportMeta: boolean;
  canonicalUrl: string;
  canonicalMismatch: boolean;
  robotsMeta: string;
  isNoindexed: boolean;
  htmlLang: string;
  consoleErrors: string[];
  missingAltCount: number;
  formFieldCount: number;
  pageWeightBytes: number;
  ogTags: { title: string; description: string; image: string; twitterCard: string };
  socialLinks: Array<{ platform: string; url: string }>;
  colorPalette: Record<string, string>;
  headings: string[];
  images: ImageData[];
  hreflangTags: Array<{ hreflang: string; href: string }>;
  schema: any[];
  aeoAssessment: AEOAssessment;
  voiceAssessment: VoiceAssessment;
  statusCode: number;
}

export interface RobotsTxtData {
  exists: boolean;
  raw: string;
  blockedPaths: string[];
  declaredSitemaps: string[];
}

export interface SitemapHreflangEntry {
  loc: string;
  hreflang: string;
  href: string;
}

export interface SitemapData {
  found: boolean;
  url: string;
  urlCount: number;
  urls: string[];
  orphanedUrls: string[];
  hreflangEntries: SitemapHreflangEntry[];
}

export interface CrawlResult {
  baseUrl: string;
  pagesCrawled: number;
  totalPages: PageCrawlData[];
  brokenLinks: Array<{ url: string; status: number; from: string }>;
  allImages: ImageData[];
  screenshots: string[];
  robotsTxt: RobotsTxtData;
  sitemap: SitemapData;
  httpsRedirect: { enforced: boolean; finalUrl: string | null };
  detectedSocialLinks: Array<{ platform: string; url: string }>;
  timestamp: string;
}

// --- SCHEMA VALIDATOR (Section 1.6) ---
class SchemaValidator {
  private static CRITICAL_TYPES = ['LocalBusiness', 'Organization', 'FAQPage', 'Product', 'Review'];

  static validate(schemas: any[]): AEOAssessment {
    const foundTypes = new Set<string>();

    schemas.forEach(s => {
      const type = s['@type'];
      if (Array.isArray(type)) {
        type.forEach(t => foundTypes.add(t));
      } else if (type) {
        foundTypes.add(type);
      }
    });

    const foundArray = Array.from(foundTypes);
    const missing = this.CRITICAL_TYPES.filter(type => !foundArray.includes(type));

    const isAEOReady =
      (foundArray.includes('LocalBusiness') || foundArray.includes('Organization')) &&
      (foundArray.includes('FAQPage') || foundArray.includes('Product'));

    return { foundTypes: foundArray, missingCriticalTypes: missing, isAEOReady };
  }
}

// --- TEXT / VOICE ANALYZER (Section 1.3 / 1.6) ---
class TextAnalyzer {
  static evaluateVoiceReadiness(text: string): VoiceAssessment {
    if (!text || text.trim().length === 0) {
      return { easeScore: 0, gradeLevel: 0, isVoiceReady: false };
    }

    const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
    const words = text.match(/\b[-?(\w+)?]+\b/gi)?.length || 1;

    const countSyllables = (word: string) => {
      word = word.toLowerCase();
      if (word.length <= 3) return 1;
      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
      word = word.replace(/^y/, '');
      const match = word.match(/[aeiouy]{1,2}/g);
      return match ? match.length : 1;
    };

    const wordsArray = text.match(/\b[-?(\w+)?]+\b/gi) || [];
    const syllables = wordsArray.reduce((acc, word) => acc + countSyllables(word), 0);

    const easeScore = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    const gradeLevel = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
    const isVoiceReady = gradeLevel <= 8.5;

    return {
      easeScore: Math.round(easeScore),
      gradeLevel: Math.max(0, Math.round(gradeLevel * 10) / 10),
      isVoiceReady,
    };
  }
}

// --- ROBOTS.TXT & SITEMAP HELPERS ---
async function fetchRobotsTxt(origin: string): Promise<RobotsTxtData> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { exists: false, raw: '', blockedPaths: [], declaredSitemaps: [] };
    const raw = await res.text();
    const lines = raw.split(/\r?\n/);
    const blockedPaths = lines
      .filter(l => /^Disallow:/i.test(l))
      .map(l => l.replace(/^Disallow:\s*/i, '').trim())
      .filter(Boolean);
    const declaredSitemaps = lines
      .filter(l => /^Sitemap:/i.test(l))
      .map(l => l.replace(/^Sitemap:\s*/i, '').trim())
      .filter(Boolean);
    return { exists: true, raw, blockedPaths, declaredSitemaps };
  } catch {
    return { exists: false, raw: '', blockedPaths: [], declaredSitemaps: [] };
  }
}

async function checkHttpsRedirect(hostname: string): Promise<{ enforced: boolean; finalUrl: string | null }> {
  try {
    const res = await fetch(`http://${hostname}`, { signal: AbortSignal.timeout(8000) });
    const finalUrl = res.url || null;
    return { enforced: !!finalUrl && finalUrl.startsWith('https://'), finalUrl };
  } catch {
    return { enforced: false, finalUrl: null };
  }
}

async function fetchSitemap(sitemapUrl: string): Promise<Omit<SitemapData, 'orphanedUrls'>> {
  try {
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { found: false, url: sitemapUrl, urlCount: 0, urls: [], hreflangEntries: [] };
    const xml = await res.text();
    const urls = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g), m => m[1].trim());

    const hreflangEntries: SitemapHreflangEntry[] = [];
    for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const blockXml = block[1];
      const loc = blockXml.match(/<loc>\s*([^<]+)\s*<\/loc>/)?.[1]?.trim() || '';
      for (const link of blockXml.matchAll(/<xhtml:link[^>]+>/g)) {
        const hreflang = link[0].match(/hreflang="([^"]+)"/)?.[1] || '';
        const href = link[0].match(/href="([^"]+)"/)?.[1] || '';
        if (hreflang && href) hreflangEntries.push({ loc, hreflang, href });
      }
    }

    return { found: true, url: sitemapUrl, urlCount: urls.length, urls, hreflangEntries };
  } catch {
    return { found: false, url: sitemapUrl, urlCount: 0, urls: [], hreflangEntries: [] };
  }
}

// --- MAIN CRAWL FUNCTION ---
export async function crawlSite(
  baseUrl: string,
  options: {
    maxPages?: number;
    maxDepth?: number;
    downloadImages?: boolean;
    screenshotKeyPages?: boolean;
  } = {}
): Promise<CrawlResult> {
  const { maxPages = 80, maxDepth = 3, downloadImages = false, screenshotKeyPages = true } = options;

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (compatible; WebsiteAuditEngine/1.0)',
  });

  const page = await context.newPage();
  const visited = new Set<string>();
  const brokenLinks: Array<{ url: string; status: number; from: string }> = [];
  const allPages: PageCrawlData[] = [];
  const allImages: ImageData[] = [];

  const reportDir = path.join(process.cwd(), 'reports', new URL(baseUrl).hostname);
  const screenshotsDir = path.join(reportDir, 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });
  if (downloadImages) {
    await fs.mkdir(path.join(reportDir, 'images'), { recursive: true });
  }

  const screenshottedUrls = new Set<string>();
  const screenshotPaths: string[] = [];

  const screenshotHostname = new URL(baseUrl).hostname;

  async function takeScreenshot(targetUrl: string) {
    const pathname = new URL(targetUrl).pathname;
    const slug = pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
    const filename = `screenshot-${slug}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshottedUrls.add(targetUrl);
    screenshotPaths.push(`/reports/${screenshotHostname}/screenshots/${filename}`);
  }

  function isServicePage(url: string): boolean {
    return /\/(services?|what-we-do)(\/|$)/i.test(new URL(url).pathname);
  }

  function isContactPage(url: string): boolean {
    return /\/contact(\/|$)/i.test(new URL(url).pathname);
  }

  async function crawl(url: string, depth: number = 0, fromUrl?: string) {
    if (visited.has(url) || depth > maxDepth || visited.size >= maxPages) return;
    visited.add(url);

    const consoleErrors: string[] = [];
    const onConsoleError = (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    page.on('console', onConsoleError);

    let pageWeightBytes = 0;
    const onResponse = (response: { headers: () => Record<string, string> }) => {
      const length = parseInt(response.headers()['content-length'] || '0', 10);
      if (length > 0) pageWeightBytes += length;
    };
    page.on('response', onResponse);

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const statusCode = response?.status() || 0;

      if (statusCode >= 400) {
        page.off('console', onConsoleError);
        page.off('response', onResponse);
        brokenLinks.push({ url, status: statusCode, from: fromUrl || baseUrl });
        return;
      }

      const pageData = await extractPageData(page, url);
      page.off('console', onConsoleError);
      page.off('response', onResponse);
      pageData.consoleErrors = consoleErrors;
      pageData.pageWeightBytes = pageWeightBytes;
      allPages.push(pageData);
      allImages.push(...pageData.images.map(img => ({ ...img, foundOn: url })));

      if (screenshotKeyPages && (depth === 0 || isServicePage(url) || isContactPage(url))) {
        await takeScreenshot(url);
      }

      if (depth < maxDepth) {
        const links = await page.$$eval('a[href]', anchors =>
          anchors.map(a => a.getAttribute('href')).filter(Boolean)
        );

        for (const link of links) {
          try {
            const absoluteUrl = new URL(link!, url).href;
            if (
              absoluteUrl.startsWith(baseUrl) &&
              !visited.has(absoluteUrl) &&
              !absoluteUrl.includes('#') &&
              !absoluteUrl.match(/\.(pdf|jpg|png|zip)$/i)
            ) {
              await crawl(absoluteUrl, depth + 1, url);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
    } catch (error) {
      page.off('console', onConsoleError);
      page.off('response', onResponse);
      console.error(`Error crawling ${url}:`, error);
      brokenLinks.push({ url, status: 0, from: fromUrl || baseUrl });
    }
  }

  const origin = new URL(baseUrl).origin;
  const hostname = new URL(baseUrl).hostname;
  const [robotsTxtData, httpsRedirect] = await Promise.all([
    fetchRobotsTxt(origin),
    checkHttpsRedirect(hostname),
  ]);

  console.log(`🚀 Starting deep crawl for: ${baseUrl}`);
  await crawl(baseUrl);

  // Post-crawl screenshots: data-driven picks that require knowing all pages first
  if (screenshotKeyPages && allPages.length > 0) {
    const candidates = allPages.filter(p => !screenshottedUrls.has(p.url));

    // Priority 4: page with the most images (reveals visual quality & alt/compression issues)
    const mostImages = candidates.sort((a, b) => b.images.length - a.images.length)[0];

    // Priority 5: page with the lowest voice readiness score (concrete problem to show in pitch)
    const lowestVoice = candidates
      .filter(p => p.url !== mostImages?.url)
      .sort((a, b) => a.voiceAssessment.easeScore - b.voiceAssessment.easeScore)[0];

    for (const target of [mostImages, lowestVoice].filter(Boolean)) {
      try {
        await page.goto(target.url, { waitUntil: 'networkidle', timeout: 30000 });
        await takeScreenshot(target.url);
      } catch (e) {
        console.error(`Post-crawl screenshot failed for ${target.url}:`, e);
      }
    }
  }

  // Mobile screenshot of homepage — isolated context, no viewport bleed into crawl
  if (screenshotKeyPages) {
    try {
      const mobileContext = await browser.newContext({
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      });
      const mobilePage = await mobileContext.newPage();
      await mobilePage.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
      const mobilePath = path.join(screenshotsDir, 'screenshot-home-mobile.png');
      await mobilePage.screenshot({ path: mobilePath, fullPage: true });
      screenshotPaths.push(`/reports/${screenshotHostname}/screenshots/screenshot-home-mobile.png`);
      await mobileContext.close();
    } catch (e) {
      console.error('[crawler] Mobile screenshot failed:', e);
    }
  }

  await browser.close();

  // Duplicate content detection: fingerprint first 500 chars of fullText per page
  const fingerprintMap = new Map<string, string>();
  for (const p of allPages) {
    const fp = p.fullText.trim().slice(0, 500);
    if (!fp) continue;
    const existing = fingerprintMap.get(fp);
    if (existing) {
      p.duplicateOf = existing;
    } else {
      fingerprintMap.set(fp, p.url);
    }
  }

  // Sitemap: try declared URLs first, then fall back to /sitemap.xml
  const sitemapUrl = robotsTxtData.declaredSitemaps[0] || `${origin}/sitemap.xml`;
  const sitemapRaw = await fetchSitemap(sitemapUrl);
  const orphanedUrls = sitemapRaw.urls.filter(u => !visited.has(u));
  const sitemapData: SitemapData = { ...sitemapRaw, orphanedUrls };

  return {
    baseUrl,
    pagesCrawled: visited.size,
    totalPages: allPages,
    brokenLinks,
    allImages: allImages.filter((img, index, self) => index === self.findIndex(i => i.src === img.src)),
    screenshots: screenshotPaths,
    robotsTxt: robotsTxtData,
    sitemap: sitemapData,
    httpsRedirect,
    detectedSocialLinks: Array.from(
      new Map(allPages.flatMap(p => p.socialLinks).map(l => [l.url, l])).values()
    ),
    timestamp: new Date().toISOString(),
  };
}

async function extractPageData(page: Page, url: string): Promise<PageCrawlData> {
  const [title, metaDescription, canonicalUrl, fullText, headings, images, formFieldCount, hreflangTags, hasViewportMeta, robotsMeta, htmlLang, ogTags, socialLinks, colorPalette, schema] = await Promise.all([
    page.title(),
    page.locator('meta[name="description"]').getAttribute('content').catch(() => ''),
    page.locator('link[rel="canonical"]').getAttribute('href').catch(() => ''),
    page.evaluate(() => document.body.innerText.trim()),
    page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3')).map(h => `${h.tagName}: ${h.textContent?.trim() || ''}`)
    ),
    page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src || img.getAttribute('data-src') || '',
        alt: img.alt || '',
        width: img.width || 0,
        height: img.height || 0,
        loading: img.loading || '',
      }))
    ),
    page.evaluate(() => document.querySelectorAll('input, textarea, select').length),
    page.evaluate(() =>
      Array.from(document.querySelectorAll('link[hreflang]')).map(el => ({
        hreflang: el.getAttribute('hreflang') || '',
        href: el.getAttribute('href') || '',
      }))
    ),
    page.evaluate(() => !!document.querySelector('meta[name="viewport"]')),
    page.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''),
    page.evaluate(() => document.documentElement.lang || ''),
    page.evaluate(() => ({
      title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
      description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
      image: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '',
    })),
    page.evaluate(() => {
      const SOCIAL_PATTERNS: [RegExp, string][] = [
        [/facebook\.com/, 'Facebook'],
        [/instagram\.com/, 'Instagram'],
        [/twitter\.com|x\.com/, 'Twitter/X'],
        [/linkedin\.com/, 'LinkedIn'],
        [/youtube\.com/, 'YouTube'],
        [/tiktok\.com/, 'TikTok'],
      ];
      const seen = new Set<string>();
      const links: { platform: string; url: string }[] = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        for (const [pattern, platform] of SOCIAL_PATTERNS) {
          if (pattern.test(href) && !seen.has(href)) {
            seen.add(href);
            links.push({ platform, url: href });
            break;
          }
        }
      });
      return links;
    }),
    page.evaluate(() => {
      const pick = (el: Element | null, prop: string): string => {
        if (!el) return '';
        const v = (window.getComputedStyle(el) as any)[prop] || '';
        return v === 'rgba(0, 0, 0, 0)' || v === 'transparent' ? '' : v;
      };
      const btn = document.querySelector('button, [class*="btn"], [class*="button"]');
      const nav = document.querySelector('nav, header');
      const h1 = document.querySelector('h1');
      const link = document.querySelector('a');
      const raw: Record<string, string> = {
        bodyBg:    pick(document.body, 'backgroundColor'),
        bodyText:  pick(document.body, 'color'),
        navBg:     pick(nav, 'backgroundColor'),
        h1Color:   pick(h1, 'color'),
        buttonBg:  pick(btn, 'backgroundColor'),
        buttonText: pick(btn, 'color'),
        linkColor: pick(link, 'color'),
      };
      return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
    }),
    page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(script => {
          try {
            return JSON.parse(script.textContent || '{}');
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    }),
  ]);

  const aeoAssessment = SchemaValidator.validate(schema);
  const voiceAssessment = TextAnalyzer.evaluateVoiceReadiness(fullText || '');
  const wordCount = (fullText || '').trim().split(/\s+/).filter(Boolean).length;
  const cleanTitle = (title || '').trim();
  const titleIssue = !cleanTitle ? 'missing' : cleanTitle.length < 30 ? 'too-short' : cleanTitle.length > 60 ? 'too-long' : null;

  return {
    url,
    title: cleanTitle,
    metaDescription: metaDescription || '',
    fullText: fullText || '',
    wordCount,
    isThinContent: wordCount < 300,
    titleIssue,
    hasViewportMeta,
    canonicalUrl: canonicalUrl || '',
    canonicalMismatch: !!canonicalUrl && canonicalUrl !== url,
    robotsMeta: robotsMeta || '',
    isNoindexed: robotsMeta.toLowerCase().includes('noindex'),
    htmlLang: htmlLang || '',
    consoleErrors: [],
    pageWeightBytes: 0,
    formFieldCount,
    missingAltCount: images.filter(img => !img.alt).length,
    ogTags,
    socialLinks,
    colorPalette,
    headings: headings.filter(Boolean),
    images,
    hreflangTags,
    schema,
    aeoAssessment,
    voiceAssessment,
    statusCode: 200,
  };
}

export default crawlSite;
