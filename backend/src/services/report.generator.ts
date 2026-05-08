import { generateNarrativeReport } from '../utils/narrativeTemplates';
import { generatePDFReport } from './pdf.generator';
import { AuditResult } from '../types';

export async function generateFullReport(auditData: any): Promise<AuditResult> {
  const narrative = generateNarrativeReport(auditData);
  const pdfPath = await generatePDFReport(auditData);

  return {
    url: auditData.url,
    timestamp: new Date().toISOString(),
    lighthouse: auditData.lighthouse,
    ga4: auditData.ga4,
    gsc: auditData.gsc,
    crawl: auditData.crawl,
    combinedMetrics: auditData.combinedMetrics,
    narrativeReport: narrative,
    pdfPath: pdfPath,
    recommendations: [
      { section: '1.1', action: 'Compress images to WebP/AVIF + implement lazy loading' },
      { section: '1.2', action: 'Redesign Hero section to pass the 10-Second Clarity Test' },
      { section: '1.3', action: 'Fix crawlability issues and optimize for AI scrapers' },
      { section: '1.4', action: 'Run full QA testing, remove noindex blocks, set up 301 redirects' },
      { section: '1.5', action: 'Implement fluid typography, 44px+ touch targets, force HTTPS' },
      { section: '1.6', action: 'Inject LocalBusiness + FAQ Schema markup for AEO' },
    ],
  };
}
