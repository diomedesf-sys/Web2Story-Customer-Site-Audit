import fs from 'fs/promises';
import path from 'path';
import {
  CaptureToolName,
  CaptureSlot,
  WorkspaceState,
  WorkspaceListItem,
} from '../types/workspace.types';

const REPORTS_DIR = path.join(process.cwd(), 'reports');

const TOOL_NAMES: CaptureToolName[] = [
  'broad-traffic', 'lighthouse', 'crawl', 'ga4', 'gsc', 'bilingual', 'recommendations', 'narrative',
];

export function hostnameFromUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  }
}

function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function workspacePath(hostname: string): string {
  return path.join(REPORTS_DIR, hostname);
}

export async function saveCapture(
  hostname: string,
  tool: CaptureToolName,
  data: unknown
): Promise<string> {
  const timestamp = generateTimestamp();
  const dir = path.join(workspacePath(hostname), tool);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${timestamp}.json`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

  return path.relative(REPORTS_DIR, filePath);
}

export async function getWorkspace(hostname: string): Promise<WorkspaceState> {
  const wsPath = workspacePath(hostname);
  const [notes, category] = await Promise.all([getNotes(hostname), getCategory(hostname)]);

  const captures: Record<string, CaptureSlot> = {};

  for (const tool of TOOL_NAMES) {
    captures[tool] = await loadCaptureSlot(wsPath, tool);
  }

  return {
    hostname,
    notes,
    category,
    captures: captures as WorkspaceState['captures'],
  };
}

async function loadCaptureSlot(wsPath: string, tool: string): Promise<CaptureSlot> {
  const toolDir = path.join(wsPath, tool);
  let entries: string[];

  try {
    const dirEntries = await fs.readdir(toolDir);
    entries = dirEntries
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
  } catch {
    return { latest: null, history: [] };
  }

  if (entries.length === 0) {
    return { latest: null, history: [] };
  }

  const history = entries.map(f => ({
    timestamp: f.replace('.json', ''),
    path: path.relative(REPORTS_DIR, path.join(toolDir, f)),
  }));

  const latestFile = path.join(toolDir, entries[0]);
  let data: unknown = null;
  try {
    const raw = await fs.readFile(latestFile, 'utf-8');
    data = JSON.parse(raw);
  } catch {
    // corrupted file — leave data null
  }

  return {
    latest: {
      timestamp: history[0].timestamp,
      path: history[0].path,
      data,
    },
    history,
  };
}

export async function listWorkspaces(): Promise<WorkspaceListItem[]> {
  let hostnames: string[];
  try {
    const entries = await fs.readdir(REPORTS_DIR, { withFileTypes: true });
    hostnames = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }

  const items: WorkspaceListItem[] = [];

  for (const hostname of hostnames) {
    const captureCount = {} as Record<CaptureToolName, number>;
    let lastActivity = '';

    for (const tool of TOOL_NAMES) {
      const toolDir = path.join(REPORTS_DIR, hostname, tool);
      try {
        const files = await fs.readdir(toolDir);
        const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
        captureCount[tool] = jsonFiles.length;
        if (jsonFiles.length > 0) {
          const ts = jsonFiles[0].replace('.json', '');
          if (ts > lastActivity) lastActivity = ts;
        }
      } catch {
        captureCount[tool] = 0;
      }
    }

    items.push({ hostname, lastActivity, captureCount });
  }

  return items.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export async function getCapture(
  hostname: string,
  tool: CaptureToolName,
  timestamp: string
): Promise<unknown> {
  const filePath = path.join(workspacePath(hostname), tool, `${timestamp}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

export async function saveNotes(hostname: string, notes: string): Promise<void> {
  const dir = workspacePath(hostname);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'notes.md'), notes, 'utf-8');
}

async function getNotes(hostname: string): Promise<string> {
  try {
    return await fs.readFile(path.join(workspacePath(hostname), 'notes.md'), 'utf-8');
  } catch {
    return '';
  }
}

export async function saveCategory(hostname: string, category: string): Promise<void> {
  const dir = workspacePath(hostname);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'category.txt'), category, 'utf-8');
}

async function getCategory(hostname: string): Promise<string | undefined> {
  try {
    const val = await fs.readFile(path.join(workspacePath(hostname), 'category.txt'), 'utf-8');
    return val.trim() || undefined;
  } catch {
    return undefined;
  }
}
