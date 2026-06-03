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
        results?: Array<{
          groupings?: { flow_id?: string; send_channel?: string; flow_message_id?: string };
          statistics?: Record<string, number>;
        }>;
        overview?: Record<string, number>;
      };
    };
  };

  const rawResults = data.data?.attributes?.results || [];

  // Aggregate stats by flow_id (a flow may have multiple messages)
  const flowMap: Record<string, {
    flow_id: string;
    statistics: {
      open_rate: number; click_rate: number; unsubscribe_rate: number;
      delivered: number; opens_unique: number; clicks_unique: number;
      open_unique: number; click_unique: number;
    };
    count: number;
  }> = {};

  for (const r of rawResults) {
    const flowId = r.groupings?.flow_id;
    if (!flowId || r.groupings?.send_channel !== 'email') continue;
    const s = r.statistics || {};
    if (!flowMap[flowId]) {
      flowMap[flowId] = {
        flow_id: flowId,
        statistics: { open_rate: 0, click_rate: 0, unsubscribe_rate: 0, delivered: 0, opens_unique: 0, clicks_unique: 0, open_unique: 0, click_unique: 0 },
        count: 0,
      };
    }
    const entry = flowMap[flowId];
    // Sum delivered/unique counts, and accumulate weighted rates
    entry.statistics.delivered += s.delivered ?? 0;
    entry.statistics.opens_unique += s.opens_unique ?? 0;
    entry.statistics.clicks_unique += s.clicks_unique ?? 0;
    entry.count += 1;
  }

  // Compute aggregated rates from totals
  const flows = Object.values(flowMap).map((entry) => {
    const del = entry.statistics.delivered;
    return {
      flow_id: entry.flow_id,
      statistics: {
        delivered: del,
        opens_unique: entry.statistics.opens_unique,
        clicks_unique: entry.statistics.clicks_unique,
        open_unique: entry.statistics.opens_unique,
        click_unique: entry.statistics.clicks_unique,
        open_rate: del > 0 ? entry.statistics.opens_unique / del : 0,
        click_rate: del > 0 ? entry.statistics.clicks_unique / del : 0,
        unsubscribe_rate: 0,
      },
    };
  });

  return NextResponse.json({
    flows,
    overview: data.data?.attributes?.overview || {},
    conversionMetricId,
  });
}
