import { NextResponse } from 'next/server';

// Cache the conversion metric ID in-memory (persists across requests in the same serverless instance)
let cachedConversionMetricId: string | null = null;

async function getConversionMetricId(apiKey: string): Promise<string | null> {
  if (cachedConversionMetricId) return cachedConversionMetricId;

  const h = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
  };

  try {
    let nextUrl: string | null = 'https://a.klaviyo.com/api/metrics/';
    const allMetrics: Array<{ id: string; name: string }> = [];
    while (nextUrl && allMetrics.length < 300) {
      const mRes = await fetch(nextUrl, { headers: h, cache: 'no-store' });
      if (!mRes.ok) break;
      const mData = await mRes.json() as {
        data?: Array<{ id: string; attributes?: { name?: string } }>;
        links?: { next?: string | null };
      };
      for (const m of mData.data || []) {
        allMetrics.push({ id: m.id, name: m.attributes?.name ?? '' });
      }
      nextUrl = mData.links?.next ?? null;
    }
    const preferred = ['Placed Order', 'Ordered Product', 'Active on Site', 'Received Email'];
    for (const name of preferred) {
      const found = allMetrics.find((m) => m.name === name);
      if (found) { cachedConversionMetricId = found.id; return found.id; }
    }
    if (allMetrics.length > 0) {
      cachedConversionMetricId = allMetrics[0].id;
      return allMetrics[0].id;
    }
  } catch (_) { /* ignore */ }
  return null;
}

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const conversionMetricId = await getConversionMetricId(apiKey);
  if (!conversionMetricId) {
    return NextResponse.json({ error: 'No metrics found in account', campaigns: [] }, { status: 200 });
  }

  const h = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);

  const makeBody = (includeRevenue: boolean) => JSON.stringify({
    data: {
      type: 'campaign-values-report',
      attributes: {
        timeframe: {
          start: start.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        },
        conversion_metric_id: conversionMetricId,
        statistics: [
          'open_rate', 'click_rate', 'unsubscribe_rate',
          'delivered', 'opens_unique', 'clicks_unique',
          ...(includeRevenue ? ['conversion_rate', 'conversion_value'] : []),
        ],
      },
    },
  });

  // Try with revenue first, fall back without if metric doesn't support it
  let res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', {
    method: 'POST', headers: h, body: makeBody(true), cache: 'no-store',
  });

  if (!res.ok && res.status === 400) {
    res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', {
      method: 'POST', headers: h, body: makeBody(false), cache: 'no-store',
    });
  }

  if (res.status === 429) {
    return NextResponse.json({ error: 'Rate limited', campaigns: [], rateLimited: true }, { status: 200 });
  }
  if (!res.ok) {
    const e = await res.text();
    return NextResponse.json({ error: e, campaigns: [], conversionMetricId }, { status: 200 });
  }

  const data = await res.json() as {
    data?: {
      attributes?: {
        results?: Array<{
          groupings?: { campaign_id?: string; send_channel?: string };
          statistics?: Record<string, number>;
        }>;
        overview?: Record<string, number>;
      };
    };
  };

  const campaigns = (data.data?.attributes?.results || [])
    .filter((r) => r.groupings?.send_channel === 'email' && r.groupings?.campaign_id)
    .map((r) => ({
      campaign_id: r.groupings!.campaign_id!,
      statistics: {
        ...(r.statistics || {}),
        open_unique: r.statistics?.opens_unique ?? r.statistics?.open_unique ?? 0,
        click_unique: r.statistics?.clicks_unique ?? r.statistics?.click_unique ?? 0,
        revenue: r.statistics?.conversion_value ?? 0,
      },
    }));

  return NextResponse.json({
    campaigns,
    overview: data.data?.attributes?.overview || {},
    conversionMetricId,
  });
}
