export type CaptureToolName = 'lighthouse' | 'crawl' | 'broad-traffic' | 'ga4' | 'gsc' | 'bilingual' | 'recommendations' | 'narrative';

export interface CaptureEntry {
  timestamp: string;
  path: string;
}

export interface CaptureSlot<T = unknown> {
  latest: { timestamp: string; path: string; data: T } | null;
  history: CaptureEntry[];
}

export interface WorkspaceState {
  hostname: string;
  notes: string;
  category?: string;
  captures: {
    lighthouse: CaptureSlot;
    crawl: CaptureSlot;
    'broad-traffic': CaptureSlot;
    ga4: CaptureSlot;
    gsc: CaptureSlot;
    bilingual: CaptureSlot;
    recommendations: CaptureSlot;
    narrative: CaptureSlot;
  };
}

export interface WorkspaceListItem {
  hostname: string;
  lastActivity: string;
  captureCount: Record<CaptureToolName, number>;
}

export interface NarrativeSection {
  id: string;
  title: string;
  generatedProse: string;
  editedProse?: string;
  editedProseEs?: string;
}
