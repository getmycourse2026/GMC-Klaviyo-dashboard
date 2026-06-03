import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const h = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // Step 1: Fetch all metrics (with pagination) to find conversion metric ID
  let conversionMetricId: string | null = null;
  try {
    let nextUrl: string | null = 'https://a.klaviyo.com/api/metrics/';
    const allMetrics: Array<{ id: string; name: string }> = [];
    while (nextUrl && allMetrics.length < 200) {
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
    const preferred = ['Placed Order', 'Ordered Product', 'Active on Site', 'Viewed Product', 'Received Email'];
    for (const name of preferred) {
      const found = allMetrics.find((m) => m.name === name);
      if (found) { conversionMetricId = found.id; break; }
    }
    if (!conversionMetricId && allMetrics.length > 0) {
      conversionMetricId = allMetrics[0].id;
    }
  } catch (_) { /* ignore */ }

  if (!conversionMetricId) {
    return NextResponse.json({ error: 'No metrics found in account', campaigns: [] }, { status: 200 });
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);

  // Valid statistics for campaign-values-reports (no 'revenue' — that's a conversion metric)
  const statistics = [
    'open_rate',
    'click_rate',
    'unsubscribe_rate',
    'delivered',
    'opens_unique',
    'clicks_unique',
  ];

  const body = JSON.stringify({
    data: {
      type: 'campaign-values-report',
      attributes: {
        timeframe: {
          start: start.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        },
        conversion_metric_id: conversionMetricId,
        statistics,
      },
    },
  });

  const res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', {
    method: 'POST',
    headers: h,
    body,
    cache: 'no-store',
  });

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
        results?: Array<{ campaign_id?: string; statistics?: Record<string, number> }>;
        overview?: Record<string, number>;
      };
    };
  };

  const results = data.data?.attributes?.results || [];

  // Normalise field names (API returns opens_unique / clicks_unique)
  const normalised = results.map((r) => ({
    ...r,
    statistics: r.statistics
      ? {
          ...r.statistics,
          open_unique: r.statistics.opens_unique ?? r.statistics.open_unique ?? 0,
          click_unique: r.statistics.clicks_unique ?? r.statistics.click_unique ?? 0,
        }
      : r.statistics,
  }));

  return NextResponse.json({
    campaigns: normalised,
    overview: data.data?.attributes?.overview || {},
    conversionMetricId,
  });
}
