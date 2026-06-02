import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing Klaviyo API key' }, { status: 500 });

  const allCampaigns: unknown[] = [];
  let nextUrl: string | null = 'https://a.klaviyo.com/api/campaigns?filter=equals(messages.channel,"email")&include=campaign-messages&fields[campaign]=name,status,send_strategy,audiences,created_at,updated_at';

  while (nextUrl) {
    const res = await fetch(nextUrl as string, {
      headers: { Authorization: `Klaviyo-API-Key ${apiKey}`, revision: '2024-10-15', Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) { const text = await res.text(); return NextResponse.json({ error: text }, { status: res.status }); }
    const data = await res.json() as { data?: unknown[]; links?: { next?: string } };
    allCampaigns.push(...(data.data || []));
    nextUrl = data.links?.next || null;
    if (allCampaigns.length >= 200) break;
  }

  return NextResponse.json({ data: allCampaigns });
}
