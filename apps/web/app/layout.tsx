import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foodex | The Food Codex',
  description:
    'Search packaged foods and unlock detailed nutrition through a Stripe test subscription.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
