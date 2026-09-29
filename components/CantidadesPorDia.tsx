'use client';
import { InputNumero } from '@/components/InputNumero';
import { cantidadDia, fechaCorta, repartirCantidad } from '@/lib/reglas';
import type { DiaEvento } from '@/lib/tipos';

/** Cómo se reparte el total de estudiantes entre los días de un evento de varios días.
 *  Al cambiar un día, el resto se acomoda solo para que la suma siga siendo el total. */
export function CantidadesPorDia({ dias, cantidad, onChange, idPrefijo = 'cant' }: { dias: DiaEvento[]; cantidad: number; onChange: (d: DiaEvento[]) => void; idPrefijo?: string }) {
  if (dias.length <= 1) return null;
  const total = Math.max(0, Math.round(cantidad));
  const valores = dias.map((d) => cantidadDia({ cantidad: total }, d));
  const suma = valores.reduce((a, n) => a + n, 0);
  const cambiar = (i: number, v: number) => {
    const n = dias.length;
    const nuevo = Math.max(1, Math.min(total - (n - 1), Math.round(v)));
    const restante = total - nuevo;
    const otros = dias.map((_, j) => j).filter((j) => j !== i);
    let porOtro = otros.map((j) => valores[j]);
    const diff = restante - porOtro.reduce((a, x) => a + x, 0);
    const ultimo = porOtro.length - 1;
    if (porOtro[ultimo] + diff >= 1) porOtro[ultimo] += diff; else porOtro = repartirCantidad(restante, otros.length);
    const nuevos = dias.map((d, j) => ({ ...d, cantidad: j === i ? nuevo : porOtro[otros.indexOf(j)] }));
    onChange(nuevos);
  };
  return (
    <div className="field">
      <label>Estudiantes por día (se reparten los {total})</label>
      <div className="row" style={{ gap: 'var(--space-3)' }}>
        {dias.map((d, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <label htmlFor={`${idPrefijo}-dia-${i}`} className="fs-13">Día {i + 1}{d.fecha ? ` · ${fechaCorta(d.fecha)}` : ''}</label>
            <InputNumero id={`${idPrefijo}-dia-${i}`} min={1} max={Math.max(1, total - (dias.length - 1))} value={valores[i]} onChange={(n) => cambiar(i, n)} style={{ width: 70, textAlign: 'center' }} />
          </div>
        ))}
      </div>
      <p className={`fs-12 m-0 mt-2 ${suma !== total ? 'falta' : 'muted'}`}>{suma === total ? `Los ${total} estudiantes quedan repartidos así; cambia un día y el resto se acomoda solo.` : `Las cantidades por día deben sumar ${total} (ahora suman ${suma}).`}</p>
    </div>
  );
}
