import { WorkspaceState } from '../types/workspace.types';
import {
  BilingualAnalysis,
  LanguageCoverage,
  TranslationGap,
  ContentParity,
  SpanishReadability,
  HreflangPageEntry,
} from '../types/bilingual.types';

const SPANISH_URL_PATTERNS = ['/es/', '/es', '/spanish/', '/espanol/'];

function isSpanishUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return SPANISH_URL_PATTERNS.some(p => pathname.includes(p));
}

function toExpectedSpanishUrl(englishUrl: string): string {
  const parsed = new URL(englishUrl);
  const enPath = parsed.pathname.replace(/\/$/, '');
  parsed.pathname = `/es${enPath || '/'}`;
  return parsed.href;
}

function wordCount(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

export function analyzeBilingual(workspace: WorkspaceState): BilingualAnalysis {
  const crawlData = workspace.captures.crawl.latest?.data as any;
  if (!crawlData?.totalPages) {
    return {
      coverage: { totalPages: 0, englishPages: 0, spanishPages: 0, coveragePercent: 0 },
      gaps: [],
      hreflang: [],
      parity: [],
      spanishReadability: [],
      limitations: ['No crawl data available.'],
    };
  }

  const pages: any[] = crawlData.totalPages;
  const spanishPages = pages.filter(p => isSpanishUrl(p.url));
  const englishPages = pages.filter(p => !isSpanishUrl(p.url));

  const coverage: LanguageCoverage = {
    totalPages: pages.length,
    englishPages: englishPages.length,
    spanishPages: spanishPages.length,
    coveragePercent: englishPages.length > 0
      ? Math.round((spanishPages.length / englishPages.length) * 100)
      : 0,
  };

  const spanishUrlSet = new Set(spanishPages.map(p => p.url));

  const gaps: TranslationGap[] = englishPages.map(ep => {
    const expected = toExpectedSpanishUrl(ep.url);
    const exists = spanishUrlSet.has(expected) ||
      spanishPages.some(sp => {
        const spPath = new URL(sp.url).pathname;
        const enPath = new URL(ep.url).pathname;
        return spPath.replace(/^\/es/, '') === enPath;
      });

    return {
      englishUrl: ep.url,
      expectedSpanishUrl: expected,
      status: exists ? 'exists' as const : 'missing' as const,
    };
  });

  const parity: ContentParity[] = [];
  for (const gap of gaps.filter(g => g.status === 'exists')) {
    const enPage = englishPages.find(p => p.url === gap.englishUrl);
    const esPage = spanishPages.find(sp => {
      const spPath = new URL(sp.url).pathname;
      const enPath = new URL(gap.englishUrl).pathname;
      return spPath.replace(/^\/es/, '') === enPath;
    });

    if (enPage && esPage) {
      const enWords = wordCount(enPage.fullText);
      const esWords = wordCount(esPage.fullText);
      parity.push({
        englishUrl: enPage.url,
        spanishUrl: esPage.url,
        englishWordCount: enWords,
        spanishWordCount: esWords,
        parityPercent: enWords > 0 ? Math.round((esWords / enWords) * 100) : 0,
      });
    }
  }

  const spanishReadability: SpanishReadability[] = spanishPages.map(sp => ({
    url: sp.url,
    easeScore: sp.voiceAssessment?.easeScore ?? 0,
    gradeLevel: sp.voiceAssessment?.gradeLevel ?? 0,
    isVoiceReady: sp.voiceAssessment?.isVoiceReady ?? false,
  }));

  const crawledUrls = new Set(pages.map((p: any) => p.url));
  const siteHasSpanishPages = spanishPages.length > 0;

  const hreflang: HreflangPageEntry[] = pages
    .filter((p: any) => (p.hreflangTags?.length ?? 0) > 0)
    .map((p: any) => {
      const tags: Array<{ hreflang: string; href: string }> = p.hreflangTags;
      const issues: string[] = [];
      const hasXDefault = tags.some(t => t.hreflang === 'x-default');
      if (!hasXDefault) issues.push('Missing x-default tag');
      tags.forEach(t => {
        if (t.href && !crawledUrls.has(t.href)) {
          issues.push(`href not found in crawl: ${t.href}`);
        }
      });
      return { url: p.url, tags, issues };
    });

  // Flag pages that have no hreflang at all when the site has Spanish pages
  if (siteHasSpanishPages) {
    pages
      .filter((p: any) => (p.hreflangTags?.length ?? 0) === 0)
      .forEach((p: any) => {
        hreflang.push({ url: p.url, tags: [], issues: ['No hreflang tags — missing bilingual signal for Google'] });
      });
  }

  const limitations: string[] = [
    'Language detection is URL-pattern-based only (/es/, /spanish/, /espanol/). Pages in Spanish without these URL patterns are not detected.',
    'Readability uses English Flesch formula, not Fernandez-Huerta. Scores may be inaccurate for Spanish text.',
  ];

  return { coverage, gaps, hreflang, parity, spanishReadability, limitations };
}
