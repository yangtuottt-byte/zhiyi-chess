import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI象棋教练',
  description: '桌面端AI教练版象棋游戏',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
