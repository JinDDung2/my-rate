import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteDisclaimer } from '@/app/_components/site-disclaimer';
import './globals.css';

export const metadata: Metadata = {
  title: 'RealRate',
  description: '적금 상품 금리 비교',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body className="flex min-h-[100dvh] flex-col">
        {children}
        <SiteDisclaimer />
      </body>
    </html>
  );
}
