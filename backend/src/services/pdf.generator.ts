import puppeteer from 'puppeteer';
import ejs from 'ejs';
import fs from 'fs/promises';
import path from 'path';

export interface PDFReportOptions {
  filename?: string;
  includeScreenshots?: boolean;
}

export async function generatePDFReport(
  auditData: any,
  options: PDFReportOptions = {}
): Promise<string> {
  const reportDir = path.join(process.cwd(), 'reports');
  await fs.mkdir(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = options.filename || `audit-report-${timestamp}.pdf`;
  const filePath = path.join(reportDir, fileName);

  const htmlContent = await ejs.renderFile(
    path.join(process.cwd(), 'src/templates/report-template.ejs'),
    {
      report: auditData,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      businessName: new URL(auditData.url).hostname.replace('www.', ''),
    }
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: filePath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    preferCSSPageSize: true,
  });

  await browser.close();
  return filePath;
}
