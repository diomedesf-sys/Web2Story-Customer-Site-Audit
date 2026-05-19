import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export async function runLighthouseAudit(url: string) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--user-data-dir=${path.join(os.tmpdir(), 'lh-profile')}`,
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
