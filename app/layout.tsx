import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteDisclaimer } from '@/app/_components/site-disclaimer';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Next.js</title>
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: 'RealRate',
  description: '적금 상품 금리 비교',
};