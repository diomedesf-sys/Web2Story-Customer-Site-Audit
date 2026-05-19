export interface LanguageCoverage {
  totalPages: number;
  englishPages: number;
  spanishPages: number;
  coveragePercent: number;
}

export interface TranslationGap {
  englishUrl: string;
  expectedSpanishUrl: string;
  status: 'missing' | 'exists';
}

export interface ContentParity {
  englishUrl: string;
  spanishUrl: string;
  englishWordCount: number;
  spanishWordCount: number;
  parityPercent: number;
}

export interface SpanishReadability {
  url: string;
  easeScore: number;
  gradeLevel: number;
  isVoiceReady: boolean;
}

export interface HreflangPageEntry {
  url: string;
  tags: Array<{ hreflang: string; href: string }>;
  issues: string[];
}

export interface BilingualAnalysis {
  coverage: LanguageCoverage;
  gaps: TranslationGap[];
  hreflang: HreflangPageEntry[];
  parity: ContentParity[];
  spanishReadability: SpanishReadability[];
  limitations: string[];
}
