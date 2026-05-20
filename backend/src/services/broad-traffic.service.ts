import { chromium } from 'playwright';

interface GBPData {
  businessName: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  hasPhotos: boolean;
  hasPosts: boolean;
}

interface CrUXMetric {
  percentile: number;
  category: 'FAST' | 'AVERAGE' | 'SLOW';
}

interface PSIData {
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  bestPracticesScore: number;
  crux: {
    lcp: CrUXMetric | null;
    fcp: CrUXMetric | null;
    cls: CrUXMetric | null;
    ttfb: CrUXMetric | null;
    inp: CrUXMetric | null;
  } | null;
  strategy: 'mobile';
}

async function fetchDomainAge(hostname: string): Promise<{ registrationDate: string; ageYears: number } | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${hostname}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const regEvent = (data.events || []).find((e: any) => e.eventAction === 'registration');
    if (!regEvent?.eventDate) return null;
    const registrationDate = regEvent.eventDate;
    const ageMs = Date.now() - new Date(registrationDate).getTime();
    const ageYears = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
    return { registrationDate, ageYears };
  } catch {
    return null;
  }
}

async function fetchGBP(hostname: string): Promise<GBPData> {
  const empty: GBPData = {
    businessName: null, rating: null, reviewCount: null, category: null,
    address: null, phone: null, hasPhotos: false, hasPosts: false,
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    // Search Google Maps for the business
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(hostname)}`, {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    await page.waitForTimeout(3000);

    // If on search results list, click first result
    const firstResult = await page.$('a[href*="/maps/place/"]');
    if (firstResult) {
      await firstResult.click();
      await page.waitForTimeout(3000);
    }

    // Business name
    const businessName = await page.$eval('h1', el => el.textContent?.trim() || null).catch(() => null);

    // Rating — look for aria-label containing "stars"
    const ratingLabel = await page.$eval('[aria-label*="stars"]', el => el.getAttribute('aria-label') || '').catch(() => '');
    const ratingMatch = ratingLabel.match(/(\d+\.?\d*)\s+star/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    // Review count — aria-label containing "reviews"
    const reviewLabel = await page.$eval('[aria-label*="reviews"]', el => el.getAttribute('aria-label') || '').catch(() => '');
    const reviewMatch = reviewLabel.match(/([\d,]+)\s+review/i);
    const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, ''), 10) : null;

    // Category — first button in the category row
    const category = await page.$eval('button.DkEaL', el => el.textContent?.trim() || null).catch(() => null);

    // Address
    const address = await page.$eval('[data-item-id="address"] .fontBodyMedium', el => el.textContent?.trim() || null)
      .catch(() => null);

    // Phone
    const phone = await page.$eval('[data-item-id*="phone"] .fontBodyMedium', el => el.textContent?.trim() || null)
      .catch(() => null);

    // Photos — check if the photos button is visible with a count
    const photosLabel = await page.$eval('[aria-label*="photo"]', el => el.getAttribute('aria-label') || '').catch(() => '');
    const hasPhotos = photosLabel.length > 0;

    return { businessName, rating, reviewCount, category, address, phone, hasPhotos, hasPosts: false };
  } catch (e) {
    console.error('[broad-traffic/gbp]', (e as Error).message);
    return empty;
  } finally {
    await browser?.close();
  }
}

async function fetchIndexCount(hostname: string): Promise<number | null> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    await page.goto(`https://www.google.com/search?q=site%3A${hostname}&hl=en&gl=us`, {
      waitUntil: 'domcontentloaded', timeout: 15000,
    });
    await page.waitForTimeout(2000);

    // Check for CAPTCHA
    const title = await page.title();
    if (title.toLowerCase().includes('unusual traffic') || title.toLowerCase().includes('captcha')) {
      console.warn('[broad-traffic/index] Google CAPTCHA detected — returning null');
      return null;
    }

    // Result count from stats bar
    const statsText = await page.$eval('#result-stats', el => el.textContent || '').catch(() => '');
    const countMatch = statsText.match(/About ([\d,]+)/i) || statsText.match(/([\d,]+) result/i);
    if (countMatch) return parseInt(countMatch[1].replace(/,/g, ''), 10);

    // Fallback: count result divs
    const resultDivs = await page.$$('div.g');
    return resultDivs.length > 0 ? resultDivs.length : null;
  } catch (e) {
    console.error('[broad-traffic/index]', (e as Error).message);
    return null;
  } finally {
    await browser?.close();
  }
}

async function fetchPSI(url: string): Promise<PSIData | null> {
  const apiKey = process.env.GOOGLE_PSI_API_KEY;
  if (!apiKey) return null;

  try {
    const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}&category=performance&category=accessibility&category=seo&category=best-practices`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) {
      console.warn('[broad-traffic/psi] API error:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const data = await res.json();
    const cats = data.lighthouseResult?.categories;
    const metrics = data.loadingExperience?.metrics;

    const metric = (key: string): CrUXMetric | null => {
      const m = metrics?.[key];
      if (!m || m.percentile == null) return null;
      return { percentile: m.percentile, category: m.category };
    };

    return {
      performanceScore: Math.round((cats?.performance?.score ?? 0) * 100),
      accessibilityScore: Math.round((cats?.accessibility?.score ?? 0) * 100),
      seoScore: Math.round((cats?.seo?.score ?? 0) * 100),
      bestPracticesScore: Math.round((cats?.['best-practices']?.score ?? 0) * 100),
      crux: metrics ? {
        lcp: metric('LARGEST_CONTENTFUL_PAINT_MS'),
        fcp: metric('FIRST_CONTENTFUL_PAINT_MS'),
        cls: metric('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
        ttfb: metric('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
        inp: metric('INTERACTION_TO_NEXT_PAINT'),
      } : null,
      strategy: 'mobile',
    };
  } catch (e) {
    console.error('[broad-traffic/psi]', (e as Error).message);
    return null;
  }
}

export async function runBroadTrafficCapture(url: string) {
  const hostname = new URL(url).hostname.replace(/^www\./, '');

  console.log(`[broad-traffic] Starting parallel captures for ${hostname}`);

  // Run everything in parallel
  const [domainAge, gbp, indexedPages, psi] = await Promise.all([
    fetchDomainAge(hostname),
    fetchGBP(hostname),
    fetchIndexCount(hostname),
    fetchPSI(url),
  ]);

  const hasPSI = psi !== null;
  const hasGBP = gbp.businessName !== null || gbp.rating !== null;

  return {
    hostname,
    timestamp: new Date().toISOString(),
    domainAge,
    psi: psi ?? null,
    indexedPages,
    gbp,
    social: {
      hasSpanishPage: false,
      facebookFollowers: null,
      instagramFollowers: null,
      lastPostDays: null,
    },
    competitor: {
      theyWin: false,
      competitorUrl: null,
      competitorScore: null,
    },
    _status: {
      domainAge: domainAge ? 'done' : 'error',
      psi: hasPSI ? 'done' : (process.env.GOOGLE_PSI_API_KEY ? 'error' : 'no-key'),
      indexedPages: indexedPages !== null ? 'done' : 'error',
      gbp: hasGBP ? 'done' : 'error',
      social: 'pending',
      competitor: 'pending',
    },
  };
}
