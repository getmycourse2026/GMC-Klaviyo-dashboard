import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing Klaviyo API key' }, { status: 500 });

  const allFlows: any[] = [];
  let url: string | null = 'https://a.klaviyo.com/api/flows?fields[flow]=name,status,trigger_type,created,updated';

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Klaviyo-API-Key ${apiKey}`, revision: '2024-10-15', Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) { const text = await res.text(); return NextResponse.json({ error: text }, { status: res.status }); }
    const data = await res.json();
    allFlows.push(...(data.data || []));
    url = data.links?.next || null;
    if (allFlows.length >= 500) break;
  }

  return NextResponse.json({ data: allFlows });
        }
