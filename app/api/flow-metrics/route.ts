import { NextResponse } from 'next/server';

// Cache the conversion metric ID in-memory
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
    return NextResponse.json({ error: 'No metrics found in account', flows: [] }, { status: 200 });
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
          'open_rate', 'click_rate', 'unsubscribe_rate',
          'delivered', 'opens_unique', 'clicks_unique',
        ],
      },
    },
  });

  const res = await fetch('https://a.klaviyo.com/api/flow-values-reports/', {
    method: 'POST', headers: h, body, cache: 'no-store',
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

  // Aggregate per flow_id (each flow may have multiple messages)
  const flowMap: Record<string, { flow_id: string; delivered: number; opens: number; clicks: number }> = {};
  for (const r of rawResults) {
    const flowId = r.groupings?.flow_id;
    if (!flowId || r.groupings?.send_channel !== 'email') continue;
    const s = r.statistics || {};
    if (!flowMap[flowId]) flowMap[flowId] = { flow_id: flowId, delivered: 0, opens: 0, clicks: 0 };
    flowMap[flowId].delivered += s.delivered ?? 0;
    flowMap[flowId].opens += s.opens_unique ?? 0;
    flowMap[flowId].clicks += s.clicks_unique ?? 0;
  }

  const flows = Object.values(flowMap).map((f) => ({
    flow_id: f.flow_id,
    statistics: {
      delivered: f.delivered,
      opens_unique: f.opens,
      clicks_unique: f.clicks,
      open_unique: f.opens,
      click_unique: f.clicks,
      open_rate: f.delivered > 0 ? f.opens / f.delivered : 0,
      click_rate: f.delivered > 0 ? f.clicks / f.delivered : 0,
      unsubscribe_rate: 0,
    },
  }));

  return NextResponse.json({
    flows,
    overview: data.data?.attributes?.overview || {},
    conversionMetricId,
  });
}
