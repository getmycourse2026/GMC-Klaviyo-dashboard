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

  // Step 1: Fetch available metrics to find conversion metric ID
  let conversionMetricId: string | null = null;
  try {
    const mRes = await fetch('https://a.klaviyo.com/api/metrics/', {
      headers: h,
      cache: 'no-store',
    });
    if (mRes.ok) {
      const mData = await mRes.json() as { data?: Array<{ id: string; attributes?: { name?: string } }> };
      const metrics = mData.data || [];
      const preferred = ['Placed Order', 'Ordered Product', 'Active on Site', 'Viewed Product', 'Received Email'];
      for (const name of preferred) {
        const found = metrics.find((m) => m.attributes?.name === name);
        if (found) { conversionMetricId = found.id; break; }
      }
      if (!conversionMetricId) {
        const fallback = metrics.find((m) => !m.attributes?.name?.includes('SMS'));
        if (fallback) conversionMetricId = fallback.id;
      }
    }
  } catch (_) { /* ignore */ }

  if (!conversionMetricId) {
    return NextResponse.json({ error: 'No metrics found in account', flows: [] }, { status: 200 });
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);

  const body = JSON.stringify({
    data: {
      type: 'flow-values-report',
      attributes: {
        timeframe: {
          start: start.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        },
        conversion_metric_id: conversionMetricId,
        statistics: [
          'open_rate',
          'click_rate',
          'unsubscribe_rate',
          'delivered',
          'opens_unique',
          'clicks_unique',
          'revenue',
        ],
      },
    },
  });

  const res = await fetch('https://a.klaviyo.com/api/flow-values-reports/', {
    method: 'POST',
    headers: h,
    body,
    cache: 'no-store',
  });

  if (res.status === 429) {
    return NextResponse.json({ error: 'Rate limited', flows: [], rateLimited: true }, { status: 200 });
  }

  if (!res.ok) {
    const e = await res.text();
    return NextResponse.json({ error: e, flows: [], conversionMetricId }, { status: 200 });
  }

  const data = await res.json() as {
    data?: {
      attributes?: {
        results?: Array<{ flow_id?: string; statistics?: Record<string, number> }>;
        overview?: Record<string, number>;
      };
    };
  };

  const results = (data.data?.attributes?.results || []).map((r) => ({
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
    flows: results,
    overview: data.data?.attributes?.overview || {},
    conversionMetricId,
  });
}
