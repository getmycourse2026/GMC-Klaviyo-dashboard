import { NextResponse } from 'next/server';
export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
  const h = { Authorization: `Klaviyo-API-Key ${apiKey}`, revision: '2024-10-15', Accept: 'application/json', 'Content-Type': 'application/json' };
  let metricId = 'ULMNaq';
  try {
    const mr = await fetch('https://a.klaviyo.com/api/metrics/?page[size]=50', { headers: { Authorization: `Klaviyo-API-Key ${apiKey}`, revision: '2024-10-15', Accept: 'application/json' }, cache: 'no-store' });
    if (mr.ok) {
      const md = await mr.json() as { data?: Array<{ id: string; attributes?: { name: string } }> };
      const placed = md.data?.find(m => m.attributes?.name?.toLowerCase().includes('placed order') || m.attributes?.name?.toLowerCase().includes('checkout') || m.attributes?.name?.toLowerCase().includes('purchase'));
      if (placed) metricId = placed.id;
      else if (md.data?.length) metricId = md.data[0].id;
    }
  } catch (_) {}
  const now = new Date(); const start = new Date(now); start.setDate(start.getDate() - 90);
  const body = JSON.stringify({ data: { type: 'campaign-values-report', attributes: { timeframe: { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }, statistics: ['open_rate','click_rate','unsubscribe_rate','bounce_rate','delivered','opens_unique','clicks_unique','bounced','recipients'], conversion_metric_id: metricId } } });
  const res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', { method: 'POST', headers: h, body, cache: 'no-store' });
  if (res.status === 429) return NextResponse.json({ error: 'Rate limited', campaigns: [], rateLimited: true }, { status: 200 });
  if (!res.ok) { const e = await res.text(); return NextResponse.json({ error: e, campaigns: [], metricId }, { status: 200 }); }
  const data = await res.json() as { data?: { attributes?: { results?: Array<{ campaign_id?: string; statistics?: Record<string, number> }>; overview?: Record<string, number> } } };
  return NextResponse.json({ campaigns: data.data?.attributes?.results || [], overview: data.data?.attributes?.overview || {} });
        }
