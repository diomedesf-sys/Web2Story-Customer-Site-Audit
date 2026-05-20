import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { runLighthouseAudit } from '../services/lighthouse.service';
import crawlSite from '../services/crawler.service';
import { getGA4Data } from '../services/ga4.service';
import { getGSCData } from '../services/gsc.service';
import { runBroadTrafficCapture } from '../services/broad-traffic.service';
import { checkSocialProfiles } from '../services/broad-traffic.service';
import { saveCapture, hostnameFromUrl } from '../services/workspace.service';

const router = Router();

router.post('/lighthouse', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const hostname = hostnameFromUrl(url);
    console.log(`[capture/lighthouse] Running for ${hostname}`);

    const { lhr, htmlReportPath } = await runLighthouseAudit(url);
    const savedPath = await saveCapture(hostname, 'lighthouse', lhr);

    res.json({ success: true, hostname, path: savedPath, htmlReportPath, data: lhr });
  } catch (error: any) {
    console.error('[capture/lighthouse] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/crawl', async (req: Request, res: Response) => {
  try {
    const { url, maxPages, maxDepth, downloadImages } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const hostname = hostnameFromUrl(url);
    console.log(`[capture/crawl] Running for ${hostname}`);

    const crawlData = await crawlSite(url, {
      maxPages: maxPages ?? 60,
      maxDepth: maxDepth ?? 3,
      downloadImages: downloadImages ?? false,
      screenshotKeyPages: true,
    });

    // Run social profile bio check on links found during crawl
    const socialChecks = await checkSocialProfiles(crawlData.detectedSocialLinks || [], hostname);
    const data = { ...crawlData, socialChecks };

    const savedPath = await saveCapture(hostname, 'crawl', data);
    res.json({ success: true, hostname, path: savedPath, data });
  } catch (error: any) {
    console.error('[capture/crawl] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/broad-traffic', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const hostname = hostnameFromUrl(url);
    console.log(`[capture/broad-traffic] Running for ${hostname}`);

    const data = await runBroadTrafficCapture(url);
    const savedPath = await saveCapture(hostname, 'broad-traffic', data);

    res.json({ success: true, hostname, path: savedPath, data });
  } catch (error: any) {
    console.error('[capture/broad-traffic] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ga4', async (req: Request, res: Response) => {
  try {
    const { url, propertyId } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });
    if (!propertyId) return res.status(400).json({ success: false, error: 'propertyId is required for GA4' });

    const hostname = hostnameFromUrl(url);
    console.log(`[capture/ga4] Running for ${hostname} (property: ${propertyId})`);

    const data = await getGA4Data(propertyId, url);
    if (!data) {
      return res.status(502).json({ success: false, error: 'GA4 returned no data' });
    }

    const savedPath = await saveCapture(hostname, 'ga4', data);
    res.json({ success: true, hostname, path: savedPath, data });
  } catch (error: any) {
    console.error('[capture/ga4] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/gsc', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const hostname = hostnameFromUrl(url);
    console.log(`[capture/gsc] Running for ${hostname}`);

    const data = await getGSCData(url);
    if (!data) {
      return res.status(502).json({ success: false, error: 'GSC returned no data' });
    }

    const savedPath = await saveCapture(hostname, 'gsc', data);
    res.json({ success: true, hostname, path: savedPath, data });
  } catch (error: any) {
    console.error('[capture/gsc] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
