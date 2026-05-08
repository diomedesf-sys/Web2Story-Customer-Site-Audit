import { AuditResult } from '../types';

export function generateNarrativeReport(auditData: any): string {
  const { lighthouse, crawl, ga4 } = auditData;
  let report = `# Website Diagnostic Report for ${auditData.url}\n\n`;

  // 1.1 Core Web Vitals
  const lcp = lighthouse?.audits?.['largest-contentful-paint']?.numericValue / 1000 || 0;
  if (lcp > 2.5) {
    report += `**1.1 Core Web Vitals (Performance)**\nYour site takes ${lcp.toFixed(1)} seconds to load on mobile. Google penalizes you for this, and approximately 53% of visitors leave before seeing your content.\n\n`;
  } else if (lcp > 0) {
    report += `**1.1 Core Web Vitals (Performance)**\nYour site loads in ${lcp.toFixed(1)} seconds — within the acceptable range. Continuous improvement is still recommended.\n\n`;
  }

  // 1.2 Traffic & Engagement
  if (ga4) {
    report += `**1.2 Traffic & Engagement Baseline**\nYou're currently getting limited visitors per month, with a high bounce rate. The average visit lasts only a short time, resulting in very few goal completions.\n\n`;
  }

  // 1.3 SEO/AEO Readiness
  const aeoStatus = crawl?.totalPages?.[0]?.aeoAssessment;
  if (aeoStatus && !aeoStatus.isAEOReady) {
    const missing = aeoStatus.missingCriticalTypes?.join(', ');
    report += `**1.3 & 1.6 SEO/AEO Readiness**\nYour site doesn't speak the language that AI understands. Missing schema: ${missing}. When someone asks ChatGPT or Perplexity for your services, you won't appear.\n\n`;
  }

  // 1.4 Indexing & Broken Links
  const brokenCount = crawl?.brokenLinks?.length || 0;
  if (brokenCount > 0) {
    report += `**1.4 Indexing Errors & Broken Links**\nFound ${brokenCount} broken links. Broken links destroy trust with Google and make your site look unprofessional to visitors.\n\n`;
  }

  // 1.5 Mobile Usability
  report += `**1.5 Mobile Usability**\nOver 60% of your visitors are on mobile. Your site must pass mobile usability checks for proper touch targets, readable text, and responsive layout.\n\n`;

  report += `**Recommendations**\n- Optimize images and implement lazy loading\n- Redesign Hero section for 10-Second Clarity\n- Add Schema markup for AEO\n- Fix all broken links\n- Ensure full mobile responsiveness\n`;

  return report;
}

// AEO Narrative helpers
export const getAEONarrative = (schemaResults: { isAEOReady: boolean; missingCriticalTypes: string[] }) => {
  if (schemaResults.isAEOReady) {
    return { status: 'Excellent', text: "Your site successfully speaks the 'language of AI'. With structured JSON-LD data, AI agents like ChatGPT and Perplexity can confidently cite your business." };
  }
  return {
    status: 'Poor',
    text: `Your site doesn't speak the language that AI understands. Missing: ${schemaResults.missingCriticalTypes.join(', ')}. We need to fix this so you show up in AI-generated answers.`,
  };
};

// Engagement Analyzer (Section 1.2)
export class EngagementAnalyzer {
  private static MAX_BOUNCE_RATE = 0.40;
  private static MIN_SESSION_SECONDS = 120;

  static evaluateFlame(monthlyVisitors: number, bounceRate: number, avgSessionDuration: number, goalCompletions: number) {
    const hasGoodBounceRate = bounceRate <= this.MAX_BOUNCE_RATE;
    const hasGoodSession = avgSessionDuration >= this.MIN_SESSION_SECONDS;
    const isIgnited = hasGoodBounceRate && hasGoodSession;

    return {
      isIgnited,
      evaluationStatus: isIgnited ? 'Excellent' : 'Poor',
      rawMetrics: {
        visitors: monthlyVisitors,
        bounceRateFormatted: (bounceRate * 100).toFixed(0) + '%',
        sessionFormatted: Math.round(avgSessionDuration) + ' seconds',
        conversions: goalCompletions,
      },
      failurePoints: [
        !hasGoodBounceRate ? `Bounce rate too high (${(bounceRate * 100).toFixed(0)}% vs target 40%)` : null,
        !hasGoodSession ? `Sessions too short (${Math.round(avgSessionDuration)}s vs target 120s)` : null,
      ].filter(Boolean),
    };
  }
}

// Architecture Analyzer (Section 1.4)
export class ArchitectureAnalyzer {
  static evaluateSiteDuplication(allPages: { url: string; fullText: string }[]) {
    const textHashes = new Map<string, string[]>();
    let duplicateIssues = 0;

    allPages.forEach(page => {
      const textSignature = page.fullText.replace(/\W/g, '').substring(0, 500);
      if (!textSignature) return;

      if (!textHashes.has(textSignature)) {
        textHashes.set(textSignature, [page.url]);
      } else {
        textHashes.get(textSignature)!.push(page.url);
        duplicateIssues++;
      }
    });

    const duplicates = Array.from(textHashes.entries())
      .filter(([_, urls]) => urls.length > 1)
      .map(([_, urls]) => urls);

    return {
      hasDuplicateContent: duplicates.length > 0,
      duplicateCount: duplicateIssues,
      duplicateGroups: duplicates,
      status: duplicates.length > 0 ? 'Poor' : 'Excellent',
    };
  }
}
