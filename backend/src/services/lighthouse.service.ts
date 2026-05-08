import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

export async function runLighthouseAudit(url: string) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });

  const result = await lighthouse(url, {
    port: chrome.port,
    output: ['json', 'html'],
    onlyCategories: ['performance', 'seo', 'accessibility', 'best-practices'],
    formFactor: 'mobile',
    throttlingMethod: 'devtools',
  });

  await chrome.kill();
  return result?.lhr;
}
