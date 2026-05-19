import { google } from 'googleapis';
import { getGoogleAuth } from '../config/google';

export async function getGSCData(siteUrl: string) {
  try {
    const auth = getGoogleAuth();
    const webmasters = google.webmasters({ version: 'v3', auth: auth as any });

    const dateRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    };

    const [pageRes, queryRes] = await Promise.all([
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          ...dateRange,
          dimensions: ['page'],
          rowLimit: 100,
        },
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          ...dateRange,
          dimensions: ['page', 'query'],
          rowLimit: 500,
        },
      }),
    ]);

    return {
      ...pageRes.data,
      queryRows: queryRes.data.rows || [],
    };
  } catch (error) {
    console.error('GSC Error:', error);
    return null;
  }
}
