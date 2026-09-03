import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foodex | The Food Codex',
  description:
    'Search packaged foods and unlock detailed nutrition through a Stripe test subscription.',
  icons: {
    icon: [
      { url: '/foodex-logo-32.webp', type: 'image/webp', sizes: '32x32' },
      { url: '/foodex-logo-64.webp', type: 'image/webp', sizes: '64x64' },
    ],
    shortcut: { url: '/foodex-logo-32.webp', type: 'image/webp' },
    apple: { url: '/foodex-logo-192.webp', type: 'image/webp', sizes: '192x192' },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
