import { WorkspaceState } from '../types/workspace.types';
import { Recommendation, RecommendationCategory, ImpactLevel } from '../types/recommendations.types';

let idCounter = 0;
function nextId(): string {
  return `rec-${++idCounter}`;
}

function rec(
  category: RecommendationCategory,
  action: string,
  source: Recommendation['source'],
  impact: ImpactLevel,
  effort: ImpactLevel,
  evidence: string,
  findingRef?: string
): Recommendation {
  return { id: nextId(), category, action, source, impact, effort, evidence, findingRef, included: true, notes: '' };
}

export function synthesizeRecommendations(workspace: WorkspaceState): Recommendation[] {
  idCounter = 0;
  const recs: Recommendation[] = [];

  extractLighthouseRecs(workspace, recs);
  extractCrawlerRecs(workspace, recs);
  extractGA4Recs(workspace, recs);
  extractGSCRecs(workspace, recs);
  extractBilingualRecs(workspace, recs);
  extractCrossToolRecs(workspace, recs);

  return recs;
}

function extractLighthouseRecs(ws: WorkspaceState, recs: Recommendation[]): void {
  const lh = ws.captures.lighthouse.latest?.data as any;
  if (!lh) return;

  const perfScore = Math.round((lh.categories?.performance?.score ?? 0) * 100);
  const seoScore = Math.round((lh.categories?.seo?.score ?? 0) * 100);
  const a11yScore = Math.round((lh.categories?.accessibility?.score ?? 0) * 100);

  const lcp = (lh.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000;
  if (perfScore < 75) {
    const lcpNote = lcp > 2.5 ? ` LCP is ${lcp.toFixed(1)}s (target <2.5s) — the main image or heading is loading too slowly.` : '';
    recs.push(rec('technical', `Optimize performance (current score: ${perfScore}/100)`, 'lighthouse', 'high', 'medium', `Performance score is ${perfScore}, below the 75 threshold.${lcpNote}`));
  } else if (lcp > 2.5) {
    // Only show LCP as its own card if performance score is otherwise acceptable
    recs.push(rec('technical', `Fix Largest Contentful Paint (${lcp.toFixed(1)}s, target: <2.5s)`, 'lighthouse', 'high', 'medium', `LCP is ${lcp.toFixed(1)}s, failing the 2.5s threshold.`));
  }

  const cls = lh.audits?.['cumulative-layout-shift']?.numericValue ?? 0;
  if (cls > 0.1) {
    recs.push(rec('technical', `Fix layout shift (CLS: ${cls.toFixed(3)}, target: <0.1)`, 'lighthouse', 'medium', 'medium', `CLS is ${cls.toFixed(3)}, above the 0.1 threshold.`));
  }

  const byteImpact = (kb: number): ImpactLevel => kb >= 500 ? 'high' : kb >= 100 ? 'medium' : 'low';

  const unusedJs = lh.audits?.['unused-javascript'];
  if (unusedJs?.details?.overallSavingsBytes > 50000) {
    const kb = Math.round(unusedJs.details.overallSavingsBytes / 1024);
    recs.push(rec('technical', `Remove unused JavaScript (${kb}KB savings)`, 'lighthouse', byteImpact(kb), 'low', `${kb}KB of unused JavaScript detected.`));
  }

  const unusedCss = lh.audits?.['unused-css-rules'];
  if (unusedCss?.details?.overallSavingsBytes > 20000) {
    const kb = Math.round(unusedCss.details.overallSavingsBytes / 1024);
    recs.push(rec('technical', `Remove unused CSS (${kb}KB savings)`, 'lighthouse', byteImpact(kb), 'low', `${kb}KB of unused CSS detected.`));
  }

  const webp = lh.audits?.['uses-webp-images'];
  if (webp?.score !== undefined && webp.score < 1 && webp.details?.items?.length > 0) {
    recs.push(rec('quick-wins', 'Convert images to WebP format', 'lighthouse', 'medium', 'low', `${webp.details.items.length} images can be converted to WebP.`));
  }

  if (seoScore < 90) {
    recs.push(rec('technical', `Fix SEO issues (score: ${seoScore}/100)`, 'lighthouse', 'high', 'medium', `SEO score is ${seoScore}, below the 90 threshold.`));
  }

  if (a11yScore < 90) {
    recs.push(rec('technical', `Fix accessibility issues (score: ${a11yScore}/100)`, 'lighthouse', 'medium', 'medium', `Accessibility score is ${a11yScore}, below the 90 threshold.`));
  }
}

function extractCrawlerRecs(ws: WorkspaceState, recs: Recommendation[]): void {
  const crawl = ws.captures.crawl.latest?.data as any;
  if (!crawl) return;

  const pages: any[] = crawl.totalPages ?? [];
  const brokenCount = crawl.brokenLinks?.length ?? 0;

  const missingH1 = pages.filter(p => !p.headings?.some((h: string) => h.startsWith('H1'))).length;
  if (missingH1 > 0) {
    recs.push(rec('content', `Add H1 headings to ${missingH1} page(s)`, 'crawler', 'medium', 'low', `${missingH1} of ${pages.length} pages are missing an H1 heading.`));
  }

  const missingMeta = pages.filter(p => !p.metaDescription).length;
  if (missingMeta > 0) {
    recs.push(rec('content', `Add meta descriptions to ${missingMeta} page(s)`, 'crawler', 'medium', 'low', `${missingMeta} of ${pages.length} pages have no meta description.`));
  }

  if (brokenCount > 0) {
    const impact: ImpactLevel = brokenCount > 10 ? 'high' : brokenCount > 3 ? 'medium' : 'low';
    recs.push(rec('quick-wins', `Fix ${brokenCount} broken link(s)`, 'crawler', impact, 'low', `${brokenCount} broken links detected across the site.`));
  }

  const homepage = pages[0];
  if (homepage?.aeoAssessment && !homepage.aeoAssessment.isAEOReady) {
    const missing = homepage.aeoAssessment.missingCriticalTypes?.join(', ') || 'key types';
    recs.push(rec('content', `Add schema markup (missing: ${missing})`, 'crawler', 'high', 'medium', `Homepage is not AEO-ready. Missing critical schema types: ${missing}.`));
  }

  const notVoiceReady = pages.filter(p => p.voiceAssessment && !p.voiceAssessment.isVoiceReady).length;
  if (notVoiceReady > 0) {
    recs.push(rec('content', `Simplify content for voice/AI readability on ${notVoiceReady} page(s)`, 'crawler', 'low', 'medium', `${notVoiceReady} pages have reading levels above grade 8.5.`));
  }

  const duplicates = pages.filter(p => p.duplicateOf);
  if (duplicates.length > 0) {
    const sample = duplicates.slice(0, 3).map(p => p.url).join(', ');
    recs.push(rec('content', `Fix ${duplicates.length} duplicate content page(s)`, 'crawler', 'medium', 'medium', `${duplicates.length} pages share identical content with another page — a signal Google penalizes. Candidates: ${sample}${duplicates.length > 3 ? '…' : ''}.`));
  }
}

function extractGA4Recs(ws: WorkspaceState, recs: Recommendation[]): void {
  const ga4 = ws.captures.ga4.latest?.data as any;
  if (!ga4?.rows) return;

  const rows: any[] = ga4.rows;
  let totalSessions = 0;
  let weightedBounce = 0;
  let totalDuration = 0;

  for (const row of rows) {
    const metrics = row.metricValues ?? [];
    const sessions = parseInt(metrics[0]?.value ?? '0', 10);
    const bounce = parseFloat(metrics[1]?.value ?? '0');
    const duration = parseFloat(metrics[2]?.value ?? '0');
    totalSessions += sessions;
    weightedBounce += bounce * sessions;
    totalDuration += duration * sessions;
  }

  const avgBounce = totalSessions > 0 ? weightedBounce / totalSessions : 0;
  const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

  if (avgBounce > 0.70) {
    recs.push(rec('engagement', `Reduce site-wide bounce rate (${(avgBounce * 100).toFixed(1)}%)`, 'ga4', 'high', 'medium', `Average bounce rate is ${(avgBounce * 100).toFixed(1)}%, above the 70% threshold.`));
  }

  if (avgDuration < 45) {
    recs.push(rec('engagement', `Improve engagement (avg session: ${avgDuration.toFixed(0)}s)`, 'ga4', 'medium', 'medium', `Average session duration is ${avgDuration.toFixed(0)}s, below the 45s threshold.`));
  }

  // Flag individual high-bounce pages
  const highBouncePagesLimit = 3;
  const highBouncePages = rows
    .filter(r => {
      const sessions = parseInt(r.metricValues?.[0]?.value ?? '0', 10);
      const bounce = parseFloat(r.metricValues?.[1]?.value ?? '0');
      return sessions >= 10 && bounce > 0.70;
    })
    .sort((a, b) => parseInt(b.metricValues?.[0]?.value ?? '0', 10) - parseInt(a.metricValues?.[0]?.value ?? '0', 10))
    .slice(0, highBouncePagesLimit);

  for (const page of highBouncePages) {
    const pagePath = page.dimensionValues?.[0]?.value ?? 'unknown';
    const bounce = (parseFloat(page.metricValues?.[1]?.value ?? '0') * 100).toFixed(0);
    recs.push(rec('engagement', `Reduce bounce rate on ${pagePath} (${bounce}%)`, 'ga4', 'medium', 'medium', `Page ${pagePath} has a ${bounce}% bounce rate with significant traffic.`));
  }
}

function extractGSCRecs(ws: WorkspaceState, recs: Recommendation[]): void {
  const gsc = ws.captures.gsc.latest?.data as any;
  if (!gsc?.rows) return;

  const crawledPages: any[] = (ws.captures.crawl.latest?.data as any)?.totalPages ?? [];
  const rows: any[] = gsc.rows;

  // GSC uses {keys, clicks, impressions, ctr, position} — not metricValues
  const almostRanking = rows
    .filter(r => {
      const pos = r.position ?? parseFloat(r.metricValues?.[3]?.value ?? '999');
      return pos >= 11 && pos <= 20;
    })
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .slice(0, 3);

  for (const page of almostRanking) {
    const url = page.keys?.[0] ?? page.dimensionValues?.[0]?.value ?? 'unknown';
    const pos = (page.position ?? parseFloat(page.metricValues?.[3]?.value ?? '0')).toFixed(1);
    const crawledPage = crawledPages.find(p => {
      try { return new URL(p.url).pathname === new URL(url).pathname; }
      catch { return p.url === url; }
    });
    const isThin = crawledPage?.isThinContent === true;
    const action = isThin
      ? `Almost-ranking + thin content: ${url} (pos ${pos}) — content push needed to reach page 1`
      : `Almost-ranking opportunity: ${url} at position ${pos}`;
    const evidence = isThin
      ? `Page ranks at position ${pos} and has thin content. Adding depth (500+ words, FAQ schema) could push it into the top 10.`
      : `Page is ranking at position ${pos} — pushing into the top 10 would significantly increase clicks.`;
    recs.push(rec('content', action, 'gsc', 'high', 'medium', evidence));
  }

  const highImpLowCtr = rows
    .filter(r => {
      const impressions = r.impressions ?? parseInt(r.metricValues?.[1]?.value ?? '0', 10);
      const ctr = r.ctr ?? parseFloat(r.metricValues?.[2]?.value ?? '0');
      return impressions >= 500 && ctr < 0.02;
    })
    .slice(0, 3);

  for (const page of highImpLowCtr) {
    const url = page.keys?.[0] ?? page.dimensionValues?.[0]?.value ?? 'unknown';
    const impressions = page.impressions ?? parseInt(page.metricValues?.[1]?.value ?? '0', 10);
    const ctr = ((page.ctr ?? parseFloat(page.metricValues?.[2]?.value ?? '0')) * 100).toFixed(2);
    recs.push(rec('content', `Optimize title/meta for ${url} (${impressions} impressions, ${ctr}% CTR)`, 'gsc', 'medium', 'low', `Page has ${impressions} impressions but only ${ctr}% CTR — title and meta description need work.`));
  }
}

function extractBilingualRecs(ws: WorkspaceState, recs: Recommendation[]): void {
  const bilingual = ws.captures.bilingual.latest?.data as any;
  if (!bilingual?.coverage) return;

  const { coverage, gaps, parity } = bilingual;

  if (coverage.coveragePercent < 50) {
    recs.push(rec('bilingual', `Expand Spanish content coverage (currently ${coverage.coveragePercent}%)`, 'bilingual', 'high', 'high', `Only ${coverage.spanishPages} of ${coverage.englishPages} English pages have Spanish equivalents.`));
  }

  const missingGaps = gaps?.filter((g: any) => g.status === 'missing') ?? [];
  if (missingGaps.length > 0) {
    recs.push(rec('bilingual', `Translate ${missingGaps.length} missing Spanish page(s)`, 'bilingual', 'high', 'high', `${missingGaps.length} English pages have no Spanish equivalent.`));
  }

  const thinSpanish = parity?.filter((p: any) => p.parityPercent < 70) ?? [];
  if (thinSpanish.length > 0) {
    recs.push(rec('bilingual', `Expand ${thinSpanish.length} thin Spanish page(s) (below 70% content parity)`, 'bilingual', 'medium', 'medium', `${thinSpanish.length} Spanish pages have significantly less content than their English counterparts.`));
  }
}

function extractCrossToolRecs(ws: WorkspaceState, recs: Recommendation[]): void {
  const crawl = ws.captures.crawl.latest?.data as any;
  const ga4 = ws.captures.ga4.latest?.data as any;
  const lh = ws.captures.lighthouse.latest?.data as any;
  const bilingual = ws.captures.bilingual.latest?.data as any;

  // Dead pages: crawled URLs with zero GA4 sessions
  if (crawl?.totalPages && ga4?.rows) {
    const ga4Paths = new Set(
      (ga4.rows as any[]).map(r => r.dimensionValues?.[0]?.value ?? '')
    );
    const deadPages = (crawl.totalPages as any[]).filter(p => {
      try {
        const path = new URL(p.url).pathname;
        return !ga4Paths.has(path) && !ga4Paths.has(p.url);
      } catch { return false; }
    });
    if (deadPages.length > 0) {
      const sample = deadPages.slice(0, 3).map(p => new URL(p.url).pathname).join(', ');
      recs.push(rec(
        'content',
        `Remove or consolidate ${deadPages.length} page(s) with zero traffic`,
        'cross-tool',
        'medium', 'low',
        `${deadPages.length} crawled pages have no GA4 sessions. Candidates for deletion or consolidation: ${sample}${deadPages.length > 3 ? '…' : ''}.`
      ));
    }
  }

  // Hero image: match Lighthouse LCP element src to crawler image inventory
  if (lh && crawl?.allImages) {
    const lcpItems: any[] = lh.audits?.['largest-contentful-paint-element']?.details?.items ?? [];
    for (const item of lcpItems) {
      const snippet: string = item.snippet ?? '';
      const srcMatch = snippet.match(/src=["']([^"']+)["']/);
      if (!srcMatch) continue;
      const lcpSrc = srcMatch[1];
      const matched = (crawl.allImages as any[]).find(img =>
        img.src === lcpSrc || img.src?.endsWith(lcpSrc) || lcpSrc?.endsWith(img.src)
      );
      if (matched) {
        const dims = matched.width && matched.height ? `${matched.width}×${matched.height}px` : 'unknown dimensions';
        const altNote = matched.alt ? '' : ', missing alt text';
        const filename = lcpSrc.split('/').pop() ?? lcpSrc;
        recs.push(rec(
          'technical',
          `Optimize LCP hero image: ${filename} (${dims}${altNote})`,
          'cross-tool',
          'high', 'low',
          `The Largest Contentful Paint element is this image (${dims}). Compress, resize for mobile, and serve in WebP to directly reduce LCP time.`
        ));
      }
      break; // only first LCP element
    }
  }

  // Dead Spanish pages: translated pages with zero GA4 sessions
  if (bilingual?.gaps && ga4?.rows) {
    const ga4SessionMap = new Map<string, number>();
    for (const row of (ga4.rows as any[])) {
      const path: string = row.dimensionValues?.[0]?.value ?? '';
      const sessions = parseInt(row.metricValues?.[0]?.value ?? '0', 10);
      ga4SessionMap.set(path, sessions);
    }
    const translatedPages = (bilingual.gaps as any[]).filter(g => g.status !== 'missing' && g.expectedSpanishUrl);
    const deadSpanish = translatedPages.filter(g => {
      try {
        const path = new URL(g.expectedSpanishUrl).pathname;
        return !ga4SessionMap.has(path) || (ga4SessionMap.get(path) ?? 0) === 0;
      } catch { return false; }
    });
    if (deadSpanish.length > 0) {
      const sample = deadSpanish.slice(0, 3).map(g => g.expectedSpanishUrl).join(', ');
      recs.push(rec(
        'bilingual',
        `${deadSpanish.length} translated Spanish page(s) have zero traffic`,
        'cross-tool',
        'medium', 'low',
        `These pages were translated but receive no visitors — wasted effort. Improve internal linking or consolidate: ${sample}${deadSpanish.length > 3 ? '…' : ''}.`
      ));
    }
  }
}
