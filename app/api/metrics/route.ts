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

  // Step 1: Fetch all metrics (paginated) to find "Placed Order" for revenue conversion
  let conversionMetricId: string | null = null;
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

  // Note: 'conversion_value' is the revenue stat when conversion_metric_id is set
  const statistics = [
    'open_rate',
    'click_rate',
    'unsubscribe_rate',
    'delivered',
    'opens_unique',
    'clicks_unique',
    'conversion_rate',
    'conversion_value',
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
        results?: Array<{
          groupings?: { campaign_id?: string; send_channel?: string; campaign_message_id?: string };
          statistics?: Record<string, number>;
        }>;
        overview?: Record<string, number>;
      };
    };
  };

  const rawResults = data.data?.attributes?.results || [];

  // Flatten groupings.campaign_id to top-level campaign_id
  const campaigns = rawResults
    .filter((r) => r.groupings?.send_channel === 'email' && r.groupings?.campaign_id)
    .map((r) => ({
      campaign_id: r.groupings!.campaign_id!,
      statistics: r.statistics
        ? {
            ...r.statistics,
            open_unique: r.statistics.opens_unique ?? r.statistics.open_unique ?? 0,
            click_unique: r.statistics.clicks_unique ?? r.statistics.click_unique ?? 0,
            // conversion_value is the revenue attributed to this campaign
            revenue: r.statistics.conversion_value ?? 0,
          }
        : {},
    }));

  return NextResponse.json({
    campaigns,
    overview: data.data?.attributes?.overview || {},
    conversionMetricId,
  });
}
