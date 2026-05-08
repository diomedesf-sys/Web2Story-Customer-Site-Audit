import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getGoogleAuth } from '../config/google';

export async function getGA4Data(propertyId: string, url: string) {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      auth: getGoogleAuth() as any,
    });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'sessions' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
      ],
    });

    return response;
  } catch (error) {
    console.error('GA4 Error:', error);
    return null;
  }
}
