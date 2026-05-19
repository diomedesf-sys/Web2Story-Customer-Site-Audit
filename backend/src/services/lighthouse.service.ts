import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

export async function runLighthouseAudit(url: string) {
  // Use Playwright's Chromium so the same binary works locally and in Docker
  const chromePath = chromium.executablePath();

  // Use a local profile dir to avoid Windows temp folder permission issues
  const userDataDir = path.join(process.cwd(), '.lh-profile');
  await fs.mkdir(userDataDir, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromePath,
    userDataDir,
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
  });

  const result = await lighthouse(url, {
    port: chrome.port,
    output: ['json', 'html'],
    onlyCategories: ['performance', 'seo', 'accessibility', 'best-practices'],
    formFactor: 'mobile',
    throttlingMethod: 'devtools',
  });

  await chrome.kill();

  const lhr = result?.lhr ?? null;
  const htmlReport = Array.isArray(result?.report) ? result.report[1] : null;

  let htmlReportPath: string | null = null;
  if (htmlReport) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const dir = path.join(process.cwd(), 'reports', hostname, 'lighthouse');
      await fs.mkdir(dir, { recursive: true });
      htmlReportPath = path.join(dir, `${timestamp}.html`);
      await fs.writeFile(htmlReportPath, htmlReport, 'utf-8');
    } catch (e) {
      console.error('[lighthouse] Failed to save HTML report:', e);
    }
  }

  return { lhr, htmlReportPath };
}
