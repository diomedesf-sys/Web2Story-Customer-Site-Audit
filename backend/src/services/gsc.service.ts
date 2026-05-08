import { google } from 'googleapis';
import { getGoogleAuth } from '../config/google';

export async function getGSCData(siteUrl: string) {
  try {
    const auth = getGoogleAuth();
    const webmasters = google.webmasters({ version: 'v3', auth: auth as any });

    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dimensions: ['page'],
        rowLimit: 100,
      },
    });

    return response.data;
  } catch (error) {
    console.error('GSC Error:', error);
    return null;
  }
}
