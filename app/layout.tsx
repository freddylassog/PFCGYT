import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { Encabezado } from '@/components/Encabezado';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-barlow', display: 'swap' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-barlow-condensed', display: 'swap' });

export const metadata: Metadata = {
  title: 'Protocolo de eventos · FCGT · Universidad UTE',
  description: 'Pedidos de apoyo protocolario, convocatoria de estudiantes y seguimiento del semestre.',
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
