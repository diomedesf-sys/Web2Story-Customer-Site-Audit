import { runLighthouseAudit } from './lighthouse.service';
import crawlSite from './crawler.service';
import { getGA4Data } from './ga4.service';
import { getGSCData } from './gsc.service';
import { generateFullReport } from './report.generator';
import { AuditResult } from '../types';

export interface DeepAuditOptions {
  maxPages?: number;
  includeGA4?: boolean;
  includeGSC?: boolean;
  downloadImages?: boolean;
  ga4PropertyId?: string;
}

export interface CombinedMetrics {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  totalPagesCrawled: number;
  brokenLinksCount: number;
  schemaCount: number;
  imagesCount: number;
  overallHealth: 'Excellent' | 'Good' | 'Needs Improvement' | 'Poor';
}

export async function runDeepAudit(url: string, options: DeepAuditOptions = {}): Promise<AuditResult> {
  const { maxPages = 60, includeGA4 = false, includeGSC = false, downloadImages = false, ga4PropertyId } = options;

  console.log(`🔍 Starting Deep Audit for: ${url}`);

  try {
    const [lighthouseResult, crawlResult] = await Promise.all([
      runLighthouseAudit(url).catch(err => { console.warn('Lighthouse failed:', err.message); return null; }),
      crawlSite(url, { maxPages, downloadImages, screenshotKeyPages: true }).catch(err => { console.warn('Crawler failed:', err.message); return null; }),
    ]);

    let ga4Result = null;
    let gscResult = null;

    if (includeGA4 && ga4PropertyId) {
      ga4Result = await getGA4Data(ga4PropertyId, url).catch(() => null);
    }
    if (includeGSC) {
      gscResult = await getGSCData(url).catch(() => null);
    }

    const auditData = {
      url,
      timestamp: new Date().toISOString(),
      lighthouse: lighthouseResult,
      crawl: crawlResult,
      ga4: ga4Result,
      gsc: gscResult,
      combinedMetrics: calculateCombinedMetrics(lighthouseResult, crawlResult),
    };

    const report = await generateFullReport(auditData);
    console.log(`✅ Deep Audit completed for ${url} | Pages: ${crawlResult?.pagesCrawled || 0}`);
    return report;
  } catch (error: any) {
    throw new Error(`Audit failed: ${error.message}`);
  }
}

function calculateCombinedMetrics(lighthouse: any, crawl: any): CombinedMetrics {
  const performanceScore = lighthouse?.categories?.performance?.score ? Math.round(lighthouse.categories.performance.score * 100) : 0;
  const seoScore = lighthouse?.categories?.seo?.score ? Math.round(lighthouse.categories.seo.score * 100) : 0;
  const accessibilityScore = lighthouse?.categories?.accessibility?.score ? Math.round(lighthouse.categories.accessibility.score * 100) : 0;
  const brokenLinksCount = crawl?.brokenLinks?.length || 0;
  const totalPagesCrawled = crawl?.pagesCrawled || 0;
  const schemaCount = crawl?.totalPages?.reduce((sum: number, page: any) => sum + (page.schema?.length || 0), 0) || 0;
  const imagesCount = crawl?.allImages?.length || 0;

  let overallHealth: CombinedMetrics['overallHealth'] = 'Needs Improvement';
  if (performanceScore >= 90 && seoScore >= 90 && brokenLinksCount === 0) overallHealth = 'Excellent';
  else if (performanceScore >= 75 && seoScore >= 80 && brokenLinksCount <= 5) overallHealth = 'Good';
  else if (performanceScore < 50 || seoScore < 60 || brokenLinksCount > 15) overallHealth = 'Poor';

  return { performanceScore, seoScore, accessibilityScore, totalPagesCrawled, brokenLinksCount, schemaCount, imagesCount, overallHealth };
}

export default runDeepAudit;
