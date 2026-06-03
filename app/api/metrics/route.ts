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

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 90);

  // SRMfMc = "Placed Order" metric ID for this account
  // Note: this account's Placed Order is a custom event without conversion value support,
  // so we query open/click stats only. Revenue shows '-' on the dashboard.
  const body = JSON.stringify({
    data: {
      type: 'campaign-values-report',
      attributes: {
        timeframe: {
          start: start.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        },
        conversion_metric_id: 'SRMfMc',
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

  const res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', {
    method: 'POST', headers: h, body, cache: 'no-store',
  });

  if (res.status === 429) {
    return NextResponse.json({ error: 'Rate limited', campaigns: [], rateLimited: true }, { status: 200 });
  }
  if (!res.ok) {
    const e = await res.text();
    return NextResponse.json({ error: e, campaigns: [] }, { status: 200 });
  }

  const data = await res.json() as {
    data?: {
      attributes?: {
        results?: Array<{
          groupings?: { campaign_id?: string; send_channel?: string };
          statistics?: Record<string, number>;
        }>;
        overview?: Record<string, number>;
      };
    };
  };

  const campaigns = (data.data?.attributes?.results || [])
    .filter((r) => r.groupings?.send_channel === 'email' && r.groupings?.campaign_id)
    .map((r) => ({
      campaign_id: r.groupings!.campaign_id!,
      statistics: {
        ...(r.statistics || {}),
        open_unique: r.statistics?.opens_unique ?? r.statistics?.open_unique ?? 0,
        click_unique: r.statistics?.clicks_unique ?? r.statistics?.click_unique ?? 0,
        revenue: 0,
      },
    }));

  return NextResponse.json({
    campaigns,
    overview: data.data?.attributes?.overview || {},
  });
}
