import { Router, Request, Response } from 'express';
import {
  getWorkspace,
  listWorkspaces,
  getCapture,
  saveNotes,
  saveCategory,
  saveCapture,
} from '../services/workspace.service';
import { CaptureToolName } from '../types/workspace.types';
import { Recommendation } from '../types/recommendations.types';
import { NarrativeSection } from '../types/workspace.types';

const router = Router();

const VALID_TOOLS: CaptureToolName[] = [
  'lighthouse', 'crawl', 'ga4', 'gsc', 'bilingual', 'recommendations', 'narrative',
];

// List all prospect workspaces
router.get('/', async (_req: Request, res: Response) => {
  try {
    const workspaces = await listWorkspaces();
    res.json({ success: true, data: workspaces });
  } catch (error: any) {
    console.error('[workspace/list] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get full workspace state for a prospect
router.get('/:hostname', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.params;
    const workspace = await getWorkspace(hostname);
    res.json({ success: true, data: workspace });
  } catch (error: any) {
    console.error('[workspace/get] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a specific historical capture snapshot
router.get('/:hostname/capture/:tool/:timestamp', async (req: Request, res: Response) => {
  try {
    const { hostname, tool, timestamp } = req.params;
    if (!VALID_TOOLS.includes(tool as CaptureToolName)) {
      return res.status(400).json({ success: false, error: `Invalid tool: ${tool}` });
    }

    const data = await getCapture(hostname, tool as CaptureToolName, timestamp);
    res.json({ success: true, data });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: 'Capture not found' });
    }
    console.error('[workspace/capture] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save operator prospect notes
router.put('/:hostname/notes', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.params;
    const { notes } = req.body;
    if (typeof notes !== 'string') {
      return res.status(400).json({ success: false, error: 'notes must be a string' });
    }

    await saveNotes(hostname, notes);
    res.json({ success: true, hostname });
  } catch (error: any) {
    console.error('[workspace/notes] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save industry/category tag for benchmarking
router.put('/:hostname/category', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.params;
    const { category } = req.body;
    if (typeof category !== 'string') {
      return res.status(400).json({ success: false, error: 'category must be a string' });
    }

    await saveCategory(hostname, category);
    res.json({ success: true, hostname, category });
  } catch (error: any) {
    console.error('[workspace/category] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save operator-edited recommendations (included toggles, notes)
router.put('/:hostname/recommendations', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.params;
    const { recommendations } = req.body as { recommendations: Recommendation[] };
    if (!Array.isArray(recommendations)) {
      return res.status(400).json({ success: false, error: 'recommendations must be an array' });
    }

    const savedPath = await saveCapture(hostname, 'recommendations', recommendations);
    res.json({ success: true, hostname, path: savedPath });
  } catch (error: any) {
    console.error('[workspace/recommendations] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save operator-edited narrative sections
router.put('/:hostname/narrative', async (req: Request, res: Response) => {
  try {
    const { hostname } = req.params;
    const { sections } = req.body as { sections: NarrativeSection[] };
    if (!Array.isArray(sections)) {
      return res.status(400).json({ success: false, error: 'sections must be an array' });
    }

    const savedPath = await saveCapture(hostname, 'narrative', sections);
    res.json({ success: true, hostname, path: savedPath });
  } catch (error: any) {
    console.error('[workspace/narrative] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
