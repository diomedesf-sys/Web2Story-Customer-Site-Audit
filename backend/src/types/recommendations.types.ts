export type RecommendationCategory = 'quick-wins' | 'technical' | 'content' | 'engagement' | 'bilingual';
export type RecommendationSource = 'lighthouse' | 'crawler' | 'ga4' | 'gsc' | 'bilingual' | 'cross-tool';
export type ImpactLevel = 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  action: string;
  source: RecommendationSource;
  impact: ImpactLevel;
  effort: ImpactLevel;
  evidence: string;
  findingRef?: string;
  included: boolean;
  notes: string;
}
