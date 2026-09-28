import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { Encabezado } from '@/components/Encabezado';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-barlow', display: 'swap' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-barlow-condensed', display: 'swap' });

const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: 'Protocolo de eventos · FCGT · Universidad UTE',
  description: 'Pedidos de apoyo protocolario, convocatoria de estudiantes y seguimiento del semestre.',
  applicationName: 'Protocolo de eventos · FCGT',
  // Vista previa del enlace en WhatsApp, Telegram, correo, etc. (la imagen sale de app/opengraph-image.png)
  openGraph: {
    type: 'website', locale: 'es_EC', siteName: 'Protocolo de eventos · FCGT · Universidad UTE',
    title: 'Protocolo de eventos · FCGT · Universidad UTE',
    description: 'Pedidos de apoyo protocolario, convocatoria de estudiantes y seguimiento del semestre.',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <div className="page">
          <Encabezado />
          {children}
        </div>
      </body>
    </html>
  );
}
