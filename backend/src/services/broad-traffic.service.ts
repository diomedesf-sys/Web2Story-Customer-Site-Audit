async function fetchDomainAge(hostname: string): Promise<{ registrationDate: string; ageYears: number } | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${hostname}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const regEvent = (data.events || []).find((e: any) => e.eventAction === 'registration');
    if (!regEvent?.eventDate) return null;
    const registrationDate = regEvent.eventDate;
    const ageMs = Date.now() - new Date(registrationDate).getTime();
    const ageYears = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
    return { registrationDate, ageYears };
  } catch {
    return null;
  }
}

export async function runBroadTrafficCapture(url: string) {
  const hostname = new URL(url).hostname.replace(/^www\./, '');

  const domainAge = await fetchDomainAge(hostname);

  return {
    hostname,
    timestamp: new Date().toISOString(),
    domainAge,
    crux: null,
    spanishGap: true,
    gbp: {
      recentReviewCount: 0,
      totalReviewCount: 0,
      rating: null,
      category: '',
      yearsInBusiness: 0,
      hasPhotos: null,
      hasPosts: null,
    },
    ads: {
      metaAdsFound: false,
      googleAdsFound: false,
      metaAdCount: 0,
    },
    social: {
      hasSpanishPage: false,
      facebookFollowers: null,
      instagramFollowers: null,
      lastPostDays: null,
    },
    competitor: {
      theyWin: false,
      competitorUrl: null,
      competitorScore: null,
    },
    _status: {
      domainAge: domainAge ? 'done' : 'error',
      crux: 'pending',
      spanishGap: 'pending',
      gbp: 'pending',
      ads: 'pending',
      social: 'pending',
      competitor: 'pending',
    }
  };
}
