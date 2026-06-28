import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  metadataBase: new URL('https://nintindoadam.github.io'),
  title: {
    default: 'Sala Posiedzeń Sejmu — interaktywna mapa',
    template: '%s — Sala Posiedzeń Sejmu',
  },
  description:
    'Interaktywna mapa sali posiedzeń Sejmu RP. Najedź na miejsce, aby poznać posła, jego klub i okręg. Kliknij, by zobaczyć pełny profil.',
  keywords: ['Sejm', 'posłowie', 'parlament', 'mapa sali', 'kluby', 'Polska'],
  openGraph: {
    title: 'Sala Posiedzeń Sejmu — interaktywna mapa',
    description:
      'Najedź na miejsce, aby poznać posła i jego klub. Kliknij, by zobaczyć pełny profil.',
    locale: 'pl_PL',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f5f0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
