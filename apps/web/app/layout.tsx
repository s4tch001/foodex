import type { Metadata } from 'next';
import './globals.css';

// Define the shared browser metadata, favicon, and social/app icon assets.
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
  // The root layout supplies the document language shell for every route.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
