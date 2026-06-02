import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);
  const startStr = start.toISOString().split('T')[0];
  const endStr = now.toISOString().split('T')[0];

  const body = JSON.stringify({
    data: {
      type: 'campaign-values-report',
      attributes: {
        timeframe: { start: startStr, end: endStr },
        statistics: [
          'open_rate',
          'click_rate',
          'unsubscribe_rate',
          'bounce_rate',
          'delivered',
          'opens_unique',
          'clicks_unique',
          'unsubscribed',
          'bounced',
          'recipients',
        ],
        conversion_metric_id: 'ULMNaq',
      },
    },
  });

  const res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: '2024-10-15',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: errText, campaigns: [] }, { status: 200 });
  }

  const data = await res.json() as {
    data?: {
      attributes?: {
        results?: Array<{
          campaign_id?: string;
          statistics?: Record<string, number>;
        }>;
        overview?: Record<string, number>;
      };
    };
  };

  return NextResponse.json({
    campaigns: data.data?.attributes?.results || [],
    overview: data.data?.attributes?.overview || {},
  });
}
