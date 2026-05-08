export interface AuditResult {
  url: string;
  timestamp: string;
  lighthouse: any;
  ga4?: any;
  gsc?: any;
  crawl?: any;
  combinedMetrics?: any;
  narrativeReport: string;
  pdfPath?: string;
  recommendations: Array<{ section: string; action: string }>;
}
