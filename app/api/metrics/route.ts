import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  // Try multiple endpoints to find the working one
  const endpoints = [
    'https://a.klaviyo.com/api/campaign-values-reports/',
    'https://a.klaviyo.com/api/reporting/campaign-values-reports/',
  ];
  const revisions = ['2024-10-15', '2024-07-15', '2024-02-15'];

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
        conversion_metric_id: null,
      },
    },
  });

  for (const endpoint of endpoints) {
    for (const revision of revisions) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            revision,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body,
          cache: 'no-store',
        });

        if (res.ok) {
          const data = await res.json() as {
            data?: {
              attributes?: {
                results?: Array<{
                  campaign_id?: string;
                  statistics?: {
                    open_rate?: number;
                    click_rate?: number;
                    unsubscribe_rate?: number;
                    bounce_rate?: number;
                    delivered?: number;
                    open_unique?: number;
                    click_unique?: number;
                    unsubscribe?: number;
                    bounce?: number;
                    revenue?: number;
                  };
                }>;
                overview?: {
                  total_delivered?: number;
                  average_open_rate?: number;
                  average_click_rate?: number;
                  total_revenue?: number;
                };
              };
            };
          };
          return NextResponse.json({
            campaigns: data.data?.attributes?.results || [],
            overview: data.data?.attributes?.overview || {},
            _endpoint: endpoint,
            _revision: revision,
          });
        }

        if (res.status !== 404) {
          const errText = await res.text();
          return NextResponse.json({ error: errText, campaigns: [] }, { status: 200 });
        }
      } catch (e) {
        continue;
      }
    }
  }

  return NextResponse.json({
    error: 'Campaign values report endpoint not found. The API key may need Analytics permissions.',
    campaigns: [],
  }, { status: 200 });
                    }
