'use client';
import Link from 'next/link';
import type { Datos } from '@/lib/tipos';
import { proximosEventos, resumenCabecera, vistaPedidos } from '@/lib/vista';
import { ProximosEventos } from './ProximosEventos';
import { Pedidos } from './Pedidos';
import { Estudiantes } from './Estudiantes';
import { Uniformes } from './Uniformes';
import { Novedades } from './Novedades';
import { Resumen } from './Resumen';

const TABS: [string, string][] = [['pedidos', 'Pedidos'], ['estudiantes', 'Estudiantes'], ['uniformes', 'Uniformes'], ['novedades', 'Novedades'], ['resumen', 'Resumen']];

export function Panel({ datos, tab, selInicial }: { datos: Datos; tab: string; selInicial: string | null }) {
  const pedidos = vistaPedidos(datos);
  const actual = TABS.some(([k]) => k === tab) ? tab : 'pedidos';
  const proximos = proximosEventos(datos, pedidos, 7);
  return (
    <>
      <div className="between abajo mt-8" style={{ gap: 'var(--space-4)' }}>
        <div><h1 className="m-0">Coordinación</h1><p className="muted" style={{ margin: 'var(--space-1) 0 0' }}>{resumenCabecera(datos, pedidos)}</p></div>
        <nav className="seg" aria-label="Pestañas">
          {TABS.map(([k, label]) => <Link key={k} href={`/coordinacion?tab=${k}`} className="seg-opt" aria-current={actual === k ? 'page' : undefined}>{label}</Link>)}
        </nav>
      </div>
      <ProximosEventos items={proximos} dias={7} />
      {actual === 'pedidos' && <Pedidos datos={datos} pedidos={pedidos} selInicial={selInicial} />}
      {actual === 'estudiantes' && <Estudiantes datos={datos} pedidos={pedidos} />}
      {actual === 'uniformes' && <Uniformes datos={datos} pedidos={pedidos} />}
      {actual === 'novedades' && <Novedades datos={datos} pedidos={pedidos} />}
      {actual === 'resumen' && <Resumen datos={datos} pedidos={pedidos} />}
    </>
  );
}
