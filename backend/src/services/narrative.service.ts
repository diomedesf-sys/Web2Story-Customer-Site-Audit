import { WorkspaceState, NarrativeSection } from '../types/workspace.types';

export function generateNarrative(workspace: WorkspaceState): NarrativeSection[] {
  return [
    buildExecutiveSummary(workspace),
    buildTechnicalHealth(workspace),
    buildContentSEO(workspace),
    buildTrafficEngagement(workspace),
    buildBilingualPresence(workspace),
    buildOpportunity(workspace),
  ];
}

function buildExecutiveSummary(ws: WorkspaceState): NarrativeSection {
  const lh = ws.captures.lighthouse.latest?.data as any;
  const crawl = ws.captures.crawl.latest?.data as any;
  const ga4 = ws.captures.ga4.latest?.data as any;
  const gsc = ws.captures.gsc.latest?.data as any;

  const parts: string[] = [];

  parts.push(`This diagnostic report evaluates the website for ${ws.hostname}, assessing its technical performance, content quality, search visibility, and user engagement.`);

  if (lh) {
    const perf = Math.round((lh.categories?.performance?.score ?? 0) * 100);
    const seo = Math.round((lh.categories?.seo?.score ?? 0) * 100);
    parts.push(`The site scores ${perf}/100 on performance and ${seo}/100 on SEO according to Lighthouse analysis.`);
  }

  if (crawl) {
    const pages = crawl.pagesCrawled ?? 0;
    const broken = crawl.brokenLinks?.length ?? 0;
    parts.push(`A crawl of ${pages} pages revealed ${broken} broken link(s) and assessed content quality across the site.`);
  }

  if (ga4?.rows) {
    let totalSessions = 0;
    for (const row of ga4.rows) {
      totalSessions += parseInt(row.metricValues?.[0]?.value ?? '0', 10);
    }
    parts.push(`Over the last 30 days, the site received ${totalSessions.toLocaleString()} sessions.`);
  }

  if (gsc?.rows) {
    let totalClicks = 0;
    for (const row of gsc.rows) {
      totalClicks += row.clicks ?? parseInt(row.metricValues?.[0]?.value ?? '0', 10);
    }
    parts.push(`Google Search delivered ${totalClicks.toLocaleString()} clicks during the same period.`);
  }

  return {
    id: 'executive-summary',
    title: 'Executive Summary',
    generatedProse: parts.join(' '),
  };
}

function buildTechnicalHealth(ws: WorkspaceState): NarrativeSection {
  const lh = ws.captures.lighthouse.latest?.data as any;
  const crawl = ws.captures.crawl.latest?.data as any;

  if (!lh) {
    return { id: 'technical-health', title: 'Technical Health', generatedProse: 'Lighthouse data is not available. Run the Lighthouse capture to generate this section.' };
  }

  const perf = Math.round((lh.categories?.performance?.score ?? 0) * 100);
  const seo = Math.round((lh.categories?.seo?.score ?? 0) * 100);
  const a11y = Math.round((lh.categories?.accessibility?.score ?? 0) * 100);
  const bp = Math.round((lh.categories?.['best-practices']?.score ?? 0) * 100);
  const lcp = ((lh.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000).toFixed(1);
  const cls = (lh.audits?.['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3);
  const tbt = (lh.audits?.['total-blocking-time']?.numericValue ?? 0).toFixed(0);

  const parts: string[] = [];
  parts.push(`The site's mobile performance score is ${perf}/100. Core Web Vitals show an LCP of ${lcp}s, CLS of ${cls}, and TBT of ${tbt}ms.`);
  parts.push(`SEO scores ${seo}/100, accessibility ${a11y}/100, and best practices ${bp}/100.`);

  if (perf < 50) {
    parts.push('Performance is critically low and will directly impact user experience, bounce rates, and search rankings.');
  } else if (perf < 75) {
    parts.push('Performance needs improvement. Users on mobile devices are likely experiencing noticeable delays.');
  } else if (perf >= 90) {
    parts.push('Performance is strong. The site loads well on mobile devices.');
  }

  if (crawl) {
    const pages: any[] = crawl.totalPages ?? [];
    const canonicalMismatches = pages.filter(p => p.canonicalMismatch).length;
    const pagesWithErrors = pages.filter(p => p.consoleErrors?.length > 0).length;
    if (canonicalMismatches > 0) parts.push(`${canonicalMismatches} page(s) have a canonical URL mismatch, which can cause duplicate content signals in search.`);
    if (pagesWithErrors > 0) parts.push(`${pagesWithErrors} page(s) logged JavaScript console errors during crawl.`);
  }

  const opportunities: string[] = [];
  const oppKeys = ['uses-webp-images', 'unused-javascript', 'unused-css-rules', 'render-blocking-resources'];
  for (const key of oppKeys) {
    const audit = lh.audits?.[key];
    if (audit?.score !== undefined && audit.score < 1 && audit.details?.items?.length > 0) {
      opportunities.push(audit.title ?? key);
    }
  }
  if (opportunities.length > 0) {
    parts.push(`Key optimization opportunities include: ${opportunities.join(', ')}.`);
  }

  const techStack = lh.audits?.['js-libraries']?.details?.items;
  if (techStack?.length > 0) {
    const names = techStack.map((t: any) => t.title ?? t.name).filter(Boolean);
    if (names.length > 0) {
      parts.push(`Detected technologies: ${names.join(', ')}.`);
    }
  }

  return { id: 'technical-health', title: 'Technical Health', generatedProse: parts.join(' ') };
}

function buildContentSEO(ws: WorkspaceState): NarrativeSection {
  const crawl = ws.captures.crawl.latest?.data as any;
  const gsc = ws.captures.gsc.latest?.data as any;

  const parts: string[] = [];

  if (crawl) {
    const pages: any[] = crawl.totalPages ?? [];
    const missingMeta = pages.filter(p => !p.metaDescription).length;
    const missingH1 = pages.filter(p => !p.headings?.some((h: string) => h.startsWith('H1:'))).length;
    const broken = crawl.brokenLinks?.length ?? 0;
    const thinPages = pages.filter(p => p.isThinContent).length;
    const duplicatePages = pages.filter(p => p.duplicateOf).length;
    const totalMissingAlt = pages.reduce((sum: number, p: any) => sum + (p.missingAltCount ?? 0), 0);
    const missingOg = pages.filter(p => !p.ogTags?.title && !p.ogTags?.image).length;

    parts.push(`The site contains ${pages.length} crawled pages.`);
    if (missingMeta > 0) parts.push(`${missingMeta} page(s) are missing meta descriptions.`);
    if (missingH1 > 0) parts.push(`${missingH1} page(s) are missing H1 headings.`);
    if (broken > 0) parts.push(`${broken} broken link(s) were detected, which hurt SEO and user trust.`);
    if (thinPages > 0) parts.push(`${thinPages} page(s) have thin content (under 300 words), which weakens search relevance.`);
    if (duplicatePages > 0) parts.push(`${duplicatePages} page(s) appear to duplicate content from another page on the site.`);
    if (totalMissingAlt > 0) parts.push(`${totalMissingAlt} image(s) across the site are missing alt text, affecting accessibility and image SEO.`);
    if (missingOg > 0) parts.push(`${missingOg} page(s) lack Open Graph tags, which reduces click-through when shared on social media.`);

    const homepage = pages[0];
    if (homepage?.aeoAssessment) {
      if (homepage.aeoAssessment.isAEOReady) {
        parts.push('The homepage is AEO-ready with proper schema markup for AI engine visibility.');
      } else {
        const missing = homepage.aeoAssessment.missingCriticalTypes?.join(', ') ?? 'key types';
        parts.push(`The homepage is not AEO-ready. Missing schema types: ${missing}. This limits visibility in AI-powered search results.`);
      }
    }
  } else {
    parts.push('Crawler data is not available. Run the Site Crawler capture to generate this section.');
  }

  if (gsc?.rows) {
    const rows: any[] = gsc.rows;
    let totalClicks = 0;
    let totalImpressions = 0;
    for (const row of rows) {
      totalClicks += row.clicks ?? parseInt(row.metricValues?.[0]?.value ?? '0', 10);
      totalImpressions += row.impressions ?? parseInt(row.metricValues?.[1]?.value ?? '0', 10);
    }
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) : 0;
    parts.push(`Google Search Console reports ${totalClicks.toLocaleString()} clicks from ${totalImpressions.toLocaleString()} impressions (${(avgCtr * 100).toFixed(2)}% CTR) over the last 30 days.`);

    const almostRanking = rows.filter(r => {
      const pos = r.position ?? parseFloat(r.metricValues?.[3]?.value ?? '999');
      return pos >= 11 && pos <= 20;
    });
    if (almostRanking.length > 0) {
      parts.push(`${almostRanking.length} page(s) are ranking in positions 11-20 — close to the first page and worth targeting for improvement.`);
    }
  }

  return {
    id: 'content-seo',
    title: 'Content & SEO',
    generatedProse: parts.length > 0 ? parts.join(' ') : 'No data available for this section.',
  };
}

function buildTrafficEngagement(ws: WorkspaceState): NarrativeSection {
  const ga4 = ws.captures.ga4.latest?.data as any;
  if (!ga4?.rows) {
    return { id: 'traffic-engagement', title: 'Traffic & Engagement', generatedProse: 'GA4 data is not available. Run the GA4 capture to generate this section.' };
  }

  const rows: any[] = ga4.rows;
  let totalSessions = 0;
  let weightedBounce = 0;
  let weightedDuration = 0;
  let totalConversions = 0;

  for (const row of rows) {
    const metrics = row.metricValues ?? [];
    const sessions = parseInt(metrics[0]?.value ?? '0', 10);
    totalSessions += sessions;
    weightedBounce += parseFloat(metrics[1]?.value ?? '0') * sessions;
    weightedDuration += parseFloat(metrics[2]?.value ?? '0') * sessions;
    totalConversions += parseInt(metrics[3]?.value ?? '0', 10);
  }

  const avgBounce = totalSessions > 0 ? weightedBounce / totalSessions : 0;
  const avgDuration = totalSessions > 0 ? weightedDuration / totalSessions : 0;

  const parts: string[] = [];
  parts.push(`Over the last 30 days, the site received ${totalSessions.toLocaleString()} sessions with a ${(avgBounce * 100).toFixed(1)}% bounce rate and ${avgDuration.toFixed(0)}s average session duration.`);

  if (totalConversions > 0) {
    parts.push(`${totalConversions.toLocaleString()} conversion(s) were recorded.`);
  } else {
    parts.push('No conversions were recorded during this period.');
  }

  if (avgBounce > 0.70) {
    parts.push('The bounce rate is critically high. Visitors are leaving the site before engaging with the content.');
  } else if (avgBounce > 0.55) {
    parts.push('The bounce rate is moderate. There is room to improve initial engagement.');
  }

  if (avgDuration < 45) {
    parts.push('Session duration is very low, suggesting visitors are not finding what they need.');
  }

  return { id: 'traffic-engagement', title: 'Traffic & Engagement', generatedProse: parts.join(' ') };
}

function buildBilingualPresence(ws: WorkspaceState): NarrativeSection {
  const bilingual = ws.captures.bilingual.latest?.data as any;
  const ga4 = ws.captures.ga4.latest?.data as any;

  if (!bilingual?.coverage) {
    return { id: 'bilingual-presence', title: 'Bilingual Presence', generatedProse: 'Bilingual analysis is not available. Run the Bilingual Audit to generate this section.' };
  }

  const { coverage, gaps, parity, limitations } = bilingual;
  const parts: string[] = [];

  parts.push(`The site has ${coverage.englishPages} English page(s) and ${coverage.spanishPages} Spanish page(s), giving a ${coverage.coveragePercent}% Spanish coverage rate.`);

  if (ga4?.languageGroups?.rows) {
    let totalSessions = 0;
    let spanishSessions = 0;
    for (const row of ga4.languageGroups.rows) {
      const lang: string = row.dimensionValues?.[0]?.value ?? '';
      const sessions = parseInt(row.metricValues?.[0]?.value ?? '0', 10);
      totalSessions += sessions;
      if (lang.startsWith('es')) spanishSessions += sessions;
    }
    if (totalSessions > 0) {
      const spanishPct = Math.round((spanishSessions / totalSessions) * 100);
      parts.push(`GA4 shows ${spanishPct}% of sessions over the last 30 days came from Spanish-speaking visitors.`);
      if (spanishPct > coverage.coveragePercent) {
        parts.push(`Spanish visitor share (${spanishPct}%) exceeds Spanish page coverage (${coverage.coveragePercent}%) — a measurable gap in serving existing demand.`);
      }
    }
  }

  const missingGaps = gaps?.filter((g: any) => g.status === 'missing') ?? [];
  if (missingGaps.length > 0) {
    parts.push(`${missingGaps.length} English page(s) have no Spanish equivalent.`);
  } else if (coverage.spanishPages > 0) {
    parts.push('All English pages have corresponding Spanish translations.');
  }

  const thinPages = parity?.filter((p: any) => p.parityPercent < 70) ?? [];
  if (thinPages.length > 0) {
    parts.push(`${thinPages.length} Spanish page(s) have less than 70% of the content of their English counterpart, suggesting incomplete translations.`);
  }

  if (limitations?.length > 0) {
    parts.push(`Note: ${limitations[0]}`);
  }

  return { id: 'bilingual-presence', title: 'Bilingual Presence', generatedProse: parts.join(' ') };
}

function buildOpportunity(ws: WorkspaceState): NarrativeSection {
  const lh = ws.captures.lighthouse.latest?.data as any;
  const crawl = ws.captures.crawl.latest?.data as any;
  const ga4 = ws.captures.ga4.latest?.data as any;
  const bilingual = ws.captures.bilingual.latest?.data as any;

  const parts: string[] = [];

  parts.push('Based on this diagnostic, there is a clear opportunity to improve this business\'s digital presence.');

  const issues: string[] = [];
  if (lh) {
    const perf = Math.round((lh.categories?.performance?.score ?? 0) * 100);
    if (perf < 75) issues.push('slow loading speeds');
  }
  if (crawl?.brokenLinks?.length > 0) issues.push('broken links hurting credibility');
  if (crawl?.totalPages?.[0]?.aeoAssessment?.isAEOReady === false) issues.push('invisible to AI search engines');
  if (ga4?.rows) {
    let totalSessions = 0;
    let weightedBounce = 0;
    for (const row of ga4.rows) {
      const s = parseInt(row.metricValues?.[0]?.value ?? '0', 10);
      totalSessions += s;
      weightedBounce += parseFloat(row.metricValues?.[1]?.value ?? '0') * s;
    }
    if (totalSessions > 0 && (weightedBounce / totalSessions) > 0.65) issues.push('high bounce rates losing potential customers');
  }
  if (bilingual?.coverage?.coveragePercent < 50) issues.push('untapped Spanish-speaking market');

  if (issues.length > 0) {
    parts.push(`The current site suffers from ${issues.join(', ')}.`);
  }

  parts.push('A professionally redesigned website addressing these findings would strengthen the business\'s online presence, improve search rankings, and convert more visitors into customers.');

  return { id: 'the-opportunity', title: 'The Opportunity', generatedProse: parts.join(' ') };
}
