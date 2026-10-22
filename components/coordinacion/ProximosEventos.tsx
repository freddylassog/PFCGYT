'use client';
import Link from 'next/link';
import { Marco } from '@/components/Marco';
import type { ProximoEvento } from '@/lib/vista';

/** Tira de los eventos aprobados de los próximos días: cupos, inscripciones por revisar, uniformes retirados y correos a docentes pendientes. */
export function ProximosEventos({ items, dias }: { items: ProximoEvento[]; dias: number }) {
  if (!items.length) return null;
  return (
    <Marco className="p-3 mt-4 stack-2" aria-label="Próximos eventos">
      <div className="between" style={{ gap: 'var(--space-3)' }}>
        <h6 className="m-0">Próximos {dias} días</h6>
        <span className="muted fs-12">Cupos, inscripciones por revisar y uniformes retirados · clic para abrir el pedido</span>
      </div>
      {items.map((x) => (
        <Link key={x.p.id} href={`/coordinacion?sel=${x.p.id}`} className="linea-item" style={{ textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}>
          <span style={{ minWidth: 0 }}><strong>{x.cuando}</strong> · {x.p.evento} <span className="muted fs-12">· {x.p.codigo} · {x.p.horarioTexto}</span></span>
          <span className="row" style={{ gap: 4, flex: 'none' }}>
            <span className={`tag ${x.faltan ? 'tag-alerta-suave' : 'tag-verde'}`}>{x.p.multidia ? x.p.progreso : `${x.p.confirmadosN}/${x.p.cantidad} confirmados`}{x.faltan ? ` · faltan ${x.faltan}` : ' · completo'}</span>
            {x.inscritosN > 0 && <span className="tag tag-outline">{x.inscritosN} por revisar</span>}
            {x.uniforme && x.p.confirmadosN > 0 && <span className={`tag ${x.sinPrendasN ? 'tag-alerta-suave' : 'tag-verde'}`} title={x.sinPrendasN ? `Sin retirar: ${x.sinPrendas.map((e) => e.nombre).join(', ')}` : 'Todos los confirmados retiraron prendas'}>uniformes {x.conPrendasN}/{x.p.confirmadosN} retirados</span>}
            {x.correosPendientes > 0 && <span className="tag tag-outline">{x.correosPendientes} correo(s) a docentes sin enviar</span>}
          </span>
        </Link>
      ))}
    </Marco>
  );
}
