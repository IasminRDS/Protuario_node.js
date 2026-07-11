import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'S-PE — Prontuário Eletrônico',
  description: 'Sistema hospitalar de prontuário eletrônico',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport = {
  themeColor: '#0f766e',
};

// Aplica o tema salvo (ou a preferência do SO) ANTES da hidratação — evita
// flash de tema errado. Roda inline no <head>; falha silenciosa sem storage.
const temaInitScript = `
try {
  var t = localStorage.getItem('snpe-tema');
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
