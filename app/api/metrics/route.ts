import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 500 });

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: '2024-10-15',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    // Fetch campaign values report (last 90 days)
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    const startStr = start.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];

    const reportRes = await fetch('https://a.klaviyo.com/api/campaign-values-reports/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: {
              start: startStr,
              end: endStr,
            },
            conversion_metric_id: '',
            filter: 'equals(messages.channel,"email")',
          },
        },
      }),
      cache: 'no-store',
    });

    if (!reportRes.ok) {
      const errText = await reportRes.text();
      // Fall back to basic stats if report fails
      return NextResponse.json({ error: errText, campaigns: [] }, { status: 200 });
    }

    const reportData = await reportRes.json() as {
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
              conversion_rate?: number;
              conversion_value?: number;
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

    const results = reportData.data?.attributes?.results || [];
    const overview = reportData.data?.attributes?.overview || {};

    return NextResponse.json({ campaigns: results, overview });
  } catch (e) {
    return NextResponse.json({ error: String(e), campaigns: [] }, { status: 200 });
  }
      }
