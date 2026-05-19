import { Router, Request, Response } from 'express';
import { getWorkspace, saveCapture } from '../services/workspace.service';
import { analyzeBilingual } from '../services/bilingual.service';
import { synthesizeRecommendations } from '../services/recommendations.service';
import { generateNarrative } from '../services/narrative.service';

const router = Router();

router.post('/bilingual', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.body;
    if (!hostname) return res.status(400).json({ success: false, error: 'hostname is required' });

    const workspace = await getWorkspace(hostname);
    if (!workspace.captures.crawl.latest) {
      return res.status(400).json({ success: false, error: 'Crawl data required before running bilingual analysis. Run the Site Crawler first.' });
    }

    console.log(`[analyze/bilingual] Running for ${hostname}`);
    const result = analyzeBilingual(workspace);
    const savedPath = await saveCapture(hostname, 'bilingual', result);

    res.json({ success: true, hostname, path: savedPath, data: result });
  } catch (error: any) {
    console.error('[analyze/bilingual] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.body;
    if (!hostname) return res.status(400).json({ success: false, error: 'hostname is required' });

    const workspace = await getWorkspace(hostname);
    console.log(`[analyze/recommendations] Running for ${hostname}`);

    const result = synthesizeRecommendations(workspace);
    const savedPath = await saveCapture(hostname, 'recommendations', result);

    res.json({ success: true, hostname, path: savedPath, data: result });
  } catch (error: any) {
    console.error('[analyze/recommendations] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/narrative', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.body;
    if (!hostname) return res.status(400).json({ success: false, error: 'hostname is required' });

    const workspace = await getWorkspace(hostname);
    console.log(`[analyze/narrative] Running for ${hostname}`);

    const result = generateNarrative(workspace);
    const savedPath = await saveCapture(hostname, 'narrative', result);

    res.json({ success: true, hostname, path: savedPath, data: result });
  } catch (error: any) {
    console.error('[analyze/narrative] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
