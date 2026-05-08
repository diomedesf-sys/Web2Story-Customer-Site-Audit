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
  headings: string[];
  images: ImageData[];
  schema: any[];
  aeoAssessment: AEOAssessment;
  voiceAssessment: VoiceAssessment;
  statusCode: number;
}

export interface CrawlResult {
  baseUrl: string;
  pagesCrawled: number;
  totalPages: PageCrawlData[];
  brokenLinks: Array<{ url: string; status: number; from: string }>;
  allImages: ImageData[];
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
  if (downloadImages) {
    await fs.mkdir(path.join(reportDir, 'images'), { recursive: true });
  }

  async function crawl(url: string, depth: number = 0, fromUrl?: string) {
    if (visited.has(url) || depth > maxDepth || visited.size >= maxPages) return;
    visited.add(url);

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const statusCode = response?.status() || 0;

      if (statusCode >= 400) {
        brokenLinks.push({ url, status: statusCode, from: fromUrl || baseUrl });
        return;
      }

      const pageData = await extractPageData(page, url);
      allPages.push(pageData);
      allImages.push(...pageData.images);

      if (screenshotKeyPages && (depth === 0 || url.includes('/contact') || url.includes('/about'))) {
        const screenshotPath = path.join(reportDir, `screenshot-${new URL(url).pathname.replace(/\//g, '-')}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
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
      console.error(`Error crawling ${url}:`, error);
      brokenLinks.push({ url, status: 0, from: fromUrl || baseUrl });
    }
  }

  console.log(`🚀 Starting deep crawl for: ${baseUrl}`);
  await crawl(baseUrl);
  await browser.close();

  return {
    baseUrl,
    pagesCrawled: visited.size,
    totalPages: allPages,
    brokenLinks,
    allImages: allImages.filter((img, index, self) => index === self.findIndex(i => i.src === img.src)),
    timestamp: new Date().toISOString(),
  };
}

async function extractPageData(page: Page, url: string): Promise<PageCrawlData> {
  const [title, metaDescription, fullText, headings, images, schema] = await Promise.all([
    page.title(),
    page.locator('meta[name="description"]').getAttribute('content').catch(() => ''),
    page.evaluate(() => document.body.innerText.trim()),
    page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim() || '')
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

  return {
    url,
    title: title || '',
    metaDescription: metaDescription || '',
    fullText: fullText || '',
    headings: headings.filter(Boolean),
    images,
    schema,
    aeoAssessment,
    voiceAssessment,
    statusCode: 200,
  };
}

export default crawlSite;
