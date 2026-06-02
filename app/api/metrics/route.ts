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
          'unsubscribes',
          'bounced',
          'recipients',
        ],
        conversion_metric_id: 'ULMNaq',
      },
    },
  });

  const res = await fetch('https://a.klaviyo.com/api/campaign-values-reports/', {
    method: 'POST',
