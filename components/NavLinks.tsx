'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconoCandado } from './Iconos';

const RUTAS: { href: string; label: string; protegido: 'coord' | 'est' | null }[] = [
  { href: '/', label: 'Solicitante', protegido: null },
  { href: '/coordinacion', label: 'Coordinación', protegido: 'coord' },
  { href: '/horarios', label: 'Horarios', protegido: 'coord' },
  { href: '/estudiante', label: 'Estudiante', protegido: 'est' },
];

export function NavLinks({ coord, est }: { coord: boolean; est: boolean }) {
  const path = usePathname();
  return (
    <>
      {RUTAS.map((r) => {
        const actual = r.href === '/' ? path === '/' : path.startsWith(r.href);
        const bloqueado = r.protegido === 'coord' ? !coord : r.protegido === 'est' ? !est : false;
        return (
          <Link key={r.href} href={r.href} aria-current={actual ? 'page' : undefined}>
            {r.label}
            {bloqueado && <IconoCandado />}
          </Link>
        );
      })}
    </>
  );
}
