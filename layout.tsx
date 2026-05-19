import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Klaviyo Dashboard | Get My Course',
  description: 'Live Klaviyo campaigns and flows dashboard for Get My Course',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#08080a' }}>{children}</body>
    </html>
  );
}
