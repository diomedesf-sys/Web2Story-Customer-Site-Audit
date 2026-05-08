import express from "express";
import path from "path";
import { runLighthouseAudit } from "../services/lighthouse.service";
import crawlSite from "../services/crawler.service";
import { generateFullReport } from "../services/report.generator";
import runDeepAudit from "../services/deepAudit.service";

const router = express.Router();

// Standard audit (Lighthouse + Crawl)
router.post("/start", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    console.log(`🔍 Starting audit for: ${url}`);

    const [lighthouse, crawl] = await Promise.all([
      runLighthouseAudit(url),
      crawlSite(url),
    ]);

    const report = await generateFullReport({ url, lighthouse, crawl });

    res.json({
      success: true,
      message: "Audit completed successfully",
      report: {
        url: report.url,
        timestamp: report.timestamp,
        narrative: report.narrativeReport,
        pdfUrl: report.pdfPath
          ? `/reports/${path.basename(report.pdfPath)}`
          : undefined,
        recommendations: report.recommendations,
        combinedMetrics: report.combinedMetrics,
      },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Deep audit (Lighthouse + Crawl + optional GA4 + GSC)
router.post("/deep", async (req, res) => {
  try {
    const {
      url,
      ga4PropertyId,
      includeGA4 = false,
      includeGSC = false,
    } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const report = await runDeepAudit(url, {
      ga4PropertyId,
      includeGA4,
      includeGSC,
    });

    res.json({
      success: true,
      message: "Deep audit completed",
      report: {
        ...report,
        pdfUrl: report.pdfPath
          ? `/reports/${path.basename(report.pdfPath)}`
          : undefined,
      },
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
