import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// 브랜드 본문 폰트: 그리운 경찰공평체 (서울경찰청 X 그리운, 무료). Figma 디자인 폰트.
const poppySans = localFont({
  src: './fonts/Griun_PolFairness-Rg.woff2',
  variable: '--font-poppy',
  display: 'swap',
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Poppy',
  description: '블록 코딩으로 로봇을 움직이는 행사장 체험 서비스',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${poppySans.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
