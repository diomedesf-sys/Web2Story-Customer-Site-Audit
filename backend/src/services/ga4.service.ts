import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { getGoogleAuth } from '../config/google';

export async function getGA4Data(propertyId: string, url: string) {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      auth: getGoogleAuth() as any,
    });

    const property = `properties/${propertyId}`;
    const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];

    const [pagesRes, channelRes, deviceRes, newVsRes, languageRes] = await Promise.all([
      analyticsDataClient.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'conversions' },
        ],
      }),
      analyticsDataClient.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
      }),
      analyticsDataClient.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
      }),
      analyticsDataClient.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'sessions' }],
      }),
      analyticsDataClient.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'languageCode' }],
        metrics: [{ name: 'sessions' }],
      }),
    ]);

    return {
      ...pagesRes[0],
      channelGroups: channelRes[0],
      devices: deviceRes[0],
      newVsReturning: newVsRes[0],
      languageGroups: languageRes[0],
    };
  } catch (error) {
    console.error('GA4 Error:', error);
    return null;
  }
}
