import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const h = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
  };

  // Try different URL formats for metrics list
  const url1 = 'https://a.klaviyo.com/api/metrics/';
  const url2 = 'https://a.klaviyo.com/api/metrics/?page%5Bsize%5D=50';

  const r1 = await fetch(url1, { headers: h, cache: 'no-store' });
  const s1 = r1.status;
  const t1 = await r1.text();

  const r2 = await fetch(url2, { headers: h, cache: 'no-store' });
  const s2 = r2.status;
  const t2 = await r2.text();

  return NextResponse.json({
    url1: { status: s1, body: t1.substring(0, 1500) },
    url2: { status: s2, body: t2.substring(0, 1500) },
  });
}
