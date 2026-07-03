import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'S-PE — Prontuário Eletrônico',
  description: 'Sistema hospitalar de prontuário eletrônico',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
