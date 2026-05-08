'use client';

import { useState } from 'react';
import { Play, Download, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface CombinedMetrics {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  totalPagesCrawled: number;
  brokenLinksCount: number;
  schemaCount: number;
  imagesCount: number;
  overallHealth: string;
}

interface AuditReport {
  url: string;
  timestamp: string;
  narrative: string;
  pdfUrl?: string;
  recommendations: Array<{ section: string; action: string }>;
  combinedMetrics?: CombinedMetrics;
  lighthouse?: any;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function ScoreCard({ label, score }: { label: string; score: number }) {
  const color = score >= 90 ? 'text-green-600' : score >= 75 ? 'text-yellow-600' : 'text-red-600';
  const bg = score >= 90 ? 'bg-green-50' : score >= 75 ? 'bg-yellow-50' : 'bg-red-50';
  return (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <div className={`text-3xl font-bold ${color}`}>{score}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

export default function AuditDashboard() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState('');

  const startAudit = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setReport(null);

    try {
      const res = await axios.post(`${API_BASE}/api/audit/deep`, { url });
      setReport(res.data.report);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to run audit. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <h1 className="text-5xl font-bold text-white mb-3">
            Website Audit Engine
          </h1>
          <p className="text-blue-300 text-lg">Professional diagnostics &bull; Business-focused insights &bull; PDF Reports</p>
        </div>

        {/* URL Input */}
        <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8 mb-10 shadow-xl">
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-6 py-4 text-lg bg-white/5 border border-white/20 text-white placeholder-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && startAudit()}
            />
            <button
              onClick={startAudit}
              disabled={loading || !url}
              className="px-10 py-4 bg-blue-500 hover:bg-blue-400 disabled:bg-gray-600 text-white rounded-xl font-semibold flex items-center gap-3 transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
              {loading ? 'Running...' : 'Run Audit'}
            </button>
          </div>
          {loading && (
            <p className="text-blue-300 text-sm mt-4 text-center animate-pulse">
              🔍 Running Lighthouse audit, deep crawl, and schema validation... This may take 30-60 seconds.
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 p-4 rounded-xl mb-8 flex items-center gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {report && (
          <div className="space-y-8">
            {/* Header bar */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-white">Audit Results</h2>
                <p className="text-blue-300">{report.url}</p>
              </div>
              {report.pdfUrl && (
                <a
                  href={`${API_BASE}${report.pdfUrl}`}
                  download
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  Download PDF Report
                </a>
              )}
            </div>

            {/* Combined Metrics */}
            {report.combinedMetrics && (
              <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
                <h3 className="text-xl font-semibold text-white mb-5">Performance Overview</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <ScoreCard label="Performance" score={report.combinedMetrics.performanceScore} />
                  <ScoreCard label="SEO Score" score={report.combinedMetrics.seoScore} />
                  <ScoreCard label="Accessibility" score={report.combinedMetrics.accessibilityScore} />
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Pages Crawled', value: report.combinedMetrics.totalPagesCrawled },
                    { label: 'Broken Links', value: report.combinedMetrics.brokenLinksCount },
                    { label: 'Schema Found', value: report.combinedMetrics.schemaCount },
                    { label: 'Images', value: report.combinedMetrics.imagesCount },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/5 rounded-xl p-3">
                      <div className="text-2xl font-bold text-white">{value}</div>
                      <div className="text-xs text-blue-300 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Narrative Report */}
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
              <h3 className="text-xl font-semibold text-white mb-4">Executive Summary</h3>
              <div className="whitespace-pre-line text-blue-100 leading-relaxed">{report.narrative}</div>
            </div>

            {/* Recommendations */}
            <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-8">
              <h3 className="text-xl font-semibold text-white mb-6">Priority Recommendations</h3>
              <div className="grid gap-4">
                {report.recommendations?.map((rec, i) => (
                  <div key={i} className="border-l-4 border-orange-400 bg-orange-500/10 p-4 rounded-r-xl">
                    <span className="font-bold text-orange-300">{rec.section}: </span>
                    <span className="text-blue-100">{rec.action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Technical Data */}
            {report.lighthouse && (
              <details className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6">
                <summary className="cursor-pointer font-medium text-lg text-white">View Raw Technical Data (Lighthouse)</summary>
                <pre className="mt-4 text-sm bg-black/40 text-green-300 p-4 rounded-xl overflow-auto max-h-96">
                  {JSON.stringify(report.lighthouse?.categories, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
