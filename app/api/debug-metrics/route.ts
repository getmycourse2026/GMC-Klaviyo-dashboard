import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const h = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
  };

  // Fetch all metrics with pagination
  let nextUrl: string | null = 'https://a.klaviyo.com/api/metrics/';
  const allMetrics: Array<{ id: string; name: string }> = [];
  while (nextUrl && allMetrics.length < 300) {
    const mRes = await fetch(nextUrl, { headers: h, cache: 'no-store' });
    if (!mRes.ok) {
      return NextResponse.json({ error: 'Metrics fetch failed', status: mRes.status });
    }
    const mData = await mRes.json() as {
      data?: Array<{ id: string; attributes?: { name?: string } }>;
      links?: { next?: string | null };
    };
    for (const m of mData.data || []) {
      allMetrics.push({ id: m.id, name: m.attributes?.name ?? '' });
    }
    nextUrl = mData.links?.next ?? null;
  }

  return NextResponse.json({ total: allMetrics.length, metrics: allMetrics });
}
