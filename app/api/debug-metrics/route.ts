import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const h = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
  };

  // Try fetching metrics list
  const mRes = await fetch('https://a.klaviyo.com/api/metrics/?page[size]=100', {
    headers: h,
    cache: 'no-store',
  });
  const mStatus = mRes.status;
  const mText = await mRes.text();

  return NextResponse.json({ status: mStatus, body: mText.substring(0, 3000) });
}
