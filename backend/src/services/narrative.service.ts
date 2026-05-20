import { WorkspaceState, NarrativeSection } from '../types/workspace.types';

const pl = (n: number, word: string, plural?: string) =>
  `${n} ${n === 1 ? word : (plural ?? word + 's')}`;

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
  const bt = ws.captures['broad-traffic']?.latest?.data as any;
  const bilingual = ws.captures.bilingual.latest?.data as any;

  // Collect findings scored by severity so we can lead with the worst one
  interface Finding { severity: number; sentence: string; }
  const findings: Finding[] = [];

  if (lh) {
    const perf = Math.round((lh.categories?.performance?.score ?? 0) * 100);
    const tti = (lh.audits?.['interactive']?.numericValue ?? 0) / 1000;
    const lcp = (lh.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000;
    const ttfb = (lh.audits?.['server-response-time']?.numericValue ?? 0);

    if (tti > 15) {
      findings.push({ severity: 10, sentence: `The site takes ${tti.toFixed(1)} seconds to become usable on a phone — visitors are gone long before it finishes loading.` });
    } else if (tti > 5) {
      findings.push({ severity: 8, sentence: `Mobile load time is ${tti.toFixed(1)} seconds to interactive — well above the 3.8-second threshold where users abandon a page.` });
    } else if (perf < 50) {
      findings.push({ severity: 7, sentence: `Performance scores ${perf}/100 — the site is measurably slow and losing visitors before they engage.` });
    }

    if (lcp > 6) {
      findings.push({ severity: 9, sentence: `The main content takes ${lcp.toFixed(1)} seconds to appear — Google's threshold is 2.5 seconds.` });
    }

    if (ttfb > 2000) {
      findings.push({ severity: 6, sentence: `The server itself takes ${(ttfb/1000).toFixed(1)} seconds to respond before the browser can even start loading — a hosting-level problem.` });
    }

    const seo = Math.round((lh.categories?.seo?.score ?? 0) * 100);
    const a11y = Math.round((lh.categories?.accessibility?.score ?? 0) * 100);
    if (seo < 70) findings.push({ severity: 5, sentence: `SEO scores ${seo}/100 — basic discoverability problems are preventing the site from ranking.` });
    if (a11y < 60) findings.push({ severity: 4, sentence: `Accessibility scores ${a11y}/100 — a significant portion of users with disabilities cannot use the site.` });
  }

  if (crawl) {
    const broken = crawl.brokenLinks?.length ?? 0;
    if (broken > 5) findings.push({ severity: 5, sentence: `${broken} broken links were found across the site.` });
    const missingH1 = (crawl.totalPages || []).filter((p: any) => !p.headings?.[0]).length;
    if (missingH1 > 3) findings.push({ severity: 3, sentence: `${missingH1} pages are missing H1 headings, which weakens search relevance on every affected page.` });
  }

  const biPct: number = bilingual?.coverage?.coveragePercent ?? null;
  if (biPct !== null && biPct < 20) {
    findings.push({ severity: 4, sentence: `The site has ${biPct === 0 ? 'no Spanish version' : `only ${biPct}% Spanish coverage`}, leaving a significant portion of the potential audience unreachable.` });
  }

  const reviewCount: number = bt?.gbp?.reviewCount ?? null;
  const rating: number = bt?.gbp?.rating ?? null;
  if (reviewCount !== null && reviewCount < 15) {
    findings.push({ severity: 3, sentence: `Only ${reviewCount} Google review${reviewCount !== 1 ? 's' : ''} — not enough social proof to compete with established local businesses.` });
  } else if (rating !== null && rating < 4.0) {
    findings.push({ severity: 4, sentence: `A ${rating}-star Google rating is actively discouraging new visitors before they reach the site.` });
  }

  // Sort by severity descending
  findings.sort((a, b) => b.severity - a.severity);

  const parts: string[] = [];

  if (findings.length > 0) {
    // Lead with the worst finding
    parts.push(findings[0].sentence);
    // Add up to 2 more supporting findings
    findings.slice(1, 3).forEach(f => parts.push(f.sentence));
  }

  // Add traffic context if available
  if (ga4?.rows) {
    let totalSessions = 0;
    for (const row of ga4.rows) totalSessions += parseInt(row.metricValues?.[0]?.value ?? '0', 10);
    if (totalSessions > 0) parts.push(`Over the last 30 days the site received ${totalSessions.toLocaleString()} sessions.`);
  } else if (gsc?.rows) {
    let totalClicks = 0;
    for (const row of gsc.rows) totalClicks += row.clicks ?? parseInt(row.metricValues?.[0]?.value ?? '0', 10);
    if (totalClicks > 0) parts.push(`Google Search delivered ${totalClicks.toLocaleString()} clicks over the last 30 days.`);
  }

  // Fallback
  if (parts.length === 0) {
    parts.push(`This report covers the technical health, content quality, and search visibility of ${ws.hostname}.`);
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
    if (canonicalMismatches > 0) parts.push(`${pl(canonicalMismatches, 'page')} have a canonical URL mismatch, which can cause duplicate content signals in search.`);
    if (pagesWithErrors > 0) parts.push(`${pl(pagesWithErrors, 'page')} logged JavaScript console errors during crawl.`);
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
    const ABANDONED = [
      { match: /jquery mobile/i, note: 'jQuery Mobile (abandoned ~2014 — signals a very old codebase)' },
      { match: /jquery ui/i, note: 'jQuery UI (deprecated — modern alternatives recommended)' },
      { match: /mootools/i, note: 'MooTools (effectively abandoned — last major release 2016)' },
      { match: /prototype\.?js/i, note: 'Prototype.js (abandoned — last release 2015)' },
    ];
    const flags: string[] = [];
    names.forEach((n: string) => {
      const hit = ABANDONED.find(a => a.match.test(n));
      if (hit) flags.push(hit.note);
    });
    if (flags.length > 0) {
      parts.push(`Notable concern: the site is running outdated technology — ${flags.join('; ')}. This is a strong indicator the codebase has not been meaningfully updated in years.`);
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
    if (missingMeta > 0) parts.push(`${pl(missingMeta, 'page')} are missing meta descriptions.`);
    if (missingH1 > 0) parts.push(`${pl(missingH1, 'page')} are missing H1 headings.`);
    if (broken > 0) parts.push(`${pl(broken, 'broken link')} were detected, which hurt SEO and user trust.`);
    if (thinPages > 0) parts.push(`${pl(thinPages, 'page')} have thin content (under 300 words), which weakens search relevance.`);
    if (duplicatePages > 0) parts.push(`${pl(duplicatePages, 'page')} appear to duplicate content from another page on the site.`);
    if (totalMissingAlt > 0) parts.push(`${pl(totalMissingAlt, 'image')} across the site are missing alt text, affecting accessibility and image SEO.`);
    if (missingOg > 0) parts.push(`${pl(missingOg, 'page')} lack Open Graph tags, which reduces click-through when shared on social media.`);

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
      parts.push(`${pl(almostRanking.length, 'page')} are ranking in positions 11-20 — close to the first page and worth targeting for improvement.`);
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
    return { id: 'traffic-engagement', title: 'Traffic & Engagement', generatedProse: 'Traffic & engagement data pending.' };
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
    parts.push(`${pl(totalConversions, 'conversion')} were recorded.`);
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

  parts.push(`The site has ${pl(coverage.englishPages, 'English page')} and ${pl(coverage.spanishPages, 'Spanish page')}, giving a ${coverage.coveragePercent}% Spanish coverage rate.`);

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
    parts.push(`${pl(missingGaps.length, 'English page')} have no Spanish equivalent.`);
  } else if (coverage.spanishPages > 0) {
    parts.push('All English pages have corresponding Spanish translations.');
  }

  const thinPages = parity?.filter((p: any) => p.parityPercent < 70) ?? [];
  if (thinPages.length > 0) {
    parts.push(`${pl(thinPages.length, 'Spanish page')} have less than 70% of the content of their English counterpart, suggesting incomplete translations.`);
  }

  return { id: 'bilingual-presence', title: 'Bilingual Presence', generatedProse: parts.join(' ') };
}

function buildOpportunity(ws: WorkspaceState): NarrativeSection {
  const lh = ws.captures.lighthouse.latest?.data as any;
  const crawl = ws.captures.crawl.latest?.data as any;
  const ga4 = ws.captures.ga4.latest?.data as any;
  const bilingual = ws.captures.bilingual.latest?.data as any;
  const bt = ws.captures['broad-traffic']?.latest?.data as any;

  const parts: string[] = [];

  // Pull real business context from GBP
  const bizName: string = bt?.gbp?.businessName || null;
  const category: string = bt?.gbp?.category || null;
  const address: string = bt?.gbp?.address || null;
  const reviewCount: number = bt?.gbp?.reviewCount ?? null;
  const rating: number = bt?.gbp?.rating ?? null;

  // Parse city from address (e.g. "123 Main St, Union City, NJ 07087")
  const cityMatch = address?.match(/,\s*([^,]+),\s*[A-Z]{2}/);
  const city = cityMatch ? cityMatch[1].trim() : null;

  // Industry framing
  const industryMap: Record<string, { audience: string; action: string }> = {
    'dentist':    { audience: 'new patients',   action: 'book an appointment' },
    'dental':     { audience: 'new patients',   action: 'book an appointment' },
    'doctor':     { audience: 'new patients',   action: 'schedule a visit' },
    'medical':    { audience: 'new patients',   action: 'schedule a visit' },
    'lawyer':     { audience: 'potential clients', action: 'reach out' },
    'attorney':   { audience: 'potential clients', action: 'reach out' },
    'law':        { audience: 'potential clients', action: 'reach out' },
    'restaurant': { audience: 'hungry customers', action: 'find you and show up' },
    'salon':      { audience: 'new clients',    action: 'book a service' },
    'spa':        { audience: 'new clients',    action: 'book a service' },
    'plumber':    { audience: 'homeowners',     action: 'call you' },
    'electrician':{ audience: 'homeowners',     action: 'call you' },
    'contractor': { audience: 'homeowners',     action: 'request a quote' },
  };
  const catLower = category?.toLowerCase() || '';
  const industry = Object.entries(industryMap).find(([k]) => catLower.includes(k))?.[1]
    || { audience: 'potential customers', action: 'contact the business' };

  const nameRef = bizName || (category ? `this ${category.toLowerCase()}` : 'this business');
  const locationRef = city ? ` in ${city}` : '';

  // Performance — lead with the most damning number
  const perf = lh ? Math.round((lh.categories?.performance?.score ?? 0) * 100) : null;
  const tti = lh ? ((lh.audits?.['interactive']?.numericValue ?? 0) / 1000).toFixed(1) : null;
  const lcp = lh ? ((lh.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000).toFixed(1) : null;

  if (perf !== null && perf < 50) {
    if (tti && parseFloat(tti) > 10) {
      parts.push(`${nameRef} has a performance score of ${perf}/100 — and the site takes ${tti} seconds before it's usable on a phone. By that point, the ${industry.audience} looking to ${industry.action} have already gone somewhere else.`);
    } else if (lcp && parseFloat(lcp) > 4) {
      parts.push(`${nameRef} scores ${perf}/100 on performance. The main content takes ${lcp} seconds to appear on mobile — most ${industry.audience}${locationRef} will leave before they see anything.`);
    } else {
      parts.push(`${nameRef} scores ${perf}/100 on performance${locationRef}. A slow site costs ${industry.audience} — they leave before they have a chance to ${industry.action}.`);
    }
  }

  // Bilingual — frame as customer loss, not gap
  const biPct: number = bilingual?.coverage?.coveragePercent ?? null;
  if (biPct !== null && biPct < 30) {
    if (city) {
      parts.push(`There is a Spanish-speaking community${locationRef} that cannot find ${nameRef} online — the site has ${biPct === 0 ? 'no Spanish pages at all' : `only ${biPct}% Spanish coverage`}. Those are ${industry.audience} who are actively being handed to a competitor.`);
    } else {
      parts.push(`The site has ${biPct === 0 ? 'no Spanish version' : `only ${biPct}% Spanish coverage`}. A significant portion of potential ${industry.audience} never sees this business online.`);
    }
  }

  // GBP trust signal — low reviews
  if (reviewCount !== null && reviewCount < 20) {
    const ratingNote = rating !== null && rating < 4.0
      ? ` and a ${rating}-star average`
      : '';
    parts.push(`With only ${reviewCount} Google review${reviewCount !== 1 ? 's' : ''}${ratingNote}, ${nameRef} has almost no social proof online. ${industry.audience.charAt(0).toUpperCase() + industry.audience.slice(1)} searching${locationRef} will see competitors with hundreds of reviews first.`);
  } else if (rating !== null && rating < 4.0) {
    parts.push(`A ${rating}-star rating on Google will cost ${nameRef} customers before they ever visit the site. Most ${industry.audience} filter out anything below 4 stars.`);
  }

  // AEO — AI search invisibility
  const aeoReady = crawl?.totalPages?.[0]?.aeoAssessment?.isAEOReady;
  if (aeoReady === false) {
    parts.push(`The site is also invisible to AI-powered search — when someone asks ChatGPT or Google's AI for a ${category?.toLowerCase() || 'local business'}${locationRef}, ${nameRef} won't appear because the structured data required to surface in those answers is missing.`);
  }

  // Broken links — credibility
  const brokenCount: number = crawl?.brokenLinks?.length ?? 0;
  if (brokenCount > 5) {
    parts.push(`${brokenCount} broken links across the site signal to both visitors and search engines that the site is unmaintained.`);
  }

  // Fallback if nothing fired
  if (parts.length === 0) {
    parts.push(`${nameRef} has room to improve its digital presence${locationRef}. Addressing the findings in this report would strengthen search visibility and help more ${industry.audience} find and choose this business.`);
  }

  return { id: 'the-opportunity', title: 'The Opportunity', generatedProse: parts.join(' ') };
}
