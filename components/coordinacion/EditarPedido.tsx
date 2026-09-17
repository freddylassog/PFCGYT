'use client';
import { useState } from 'react';
import { editarPedido, type CambiosPedido } from '@/app/actions/coordinacion';
import { useAccion } from '@/components/useAccion';
import { EditorDias } from '@/components/EditorDias';
import { InputNumero } from '@/components/InputNumero';
import { EditorReparto } from '@/components/EditorReparto';
import { MAX_ESTUDIANTES, VESTIMENTA, ajustarRepartoATotal, duracionTextoDias } from '@/lib/reglas';
import type { Vestimenta } from '@/lib/tipos';
import type { PedidoVista } from '@/lib/vista';

export function EditarPedido({ p, onCerrar }: { p: PedidoVista; onCerrar: () => void }) {
  const { pending, error, run } = useAccion();
  const [c, setC] = useState<CambiosPedido>({
    nombre: p.nombre, cargo: p.cargo, institucion: p.institucion, correoSolicitante: p.correoSolicitante ?? '',
    evento: p.evento, dias: p.dias.map((d) => ({ ...d })), lugar: p.lugar, lejos: p.lejos, responsable: p.responsable, responsableTelefono: p.responsableTelefono,
    cantidad: p.cantidad, vestimenta: p.vestimenta, reparto: p.reparto.length ? p.reparto.map((x) => ({ ...x })) : p.actividades.map((a, i) => ({ actividad: a, cantidad: i === 0 ? Math.max(1, p.cantidad - (p.actividades.length - 1)) : 1 })),
  });
  const set = <K extends keyof CambiosPedido>(k: K, v: CambiosPedido[K]) => setC((s) => ({ ...s, [k]: v }));
  return (
    <form className={`punteado ${pending ? 'pendiente' : ''}`} onSubmit={(e) => { e.preventDefault(); run(() => editarPedido(p.id, c), onCerrar); }}>
      <h6 className="h6-accent">Editar pedido</h6>
      <div className="field"><label>Nombre del evento</label><input className="input" value={c.evento} onChange={(e) => set('evento', e.target.value)} required /></div>
      <div className="field"><label>Días y horarios de participación</label><EditorDias dias={c.dias} onChange={(d) => set('dias', d)} idPrefijo="edit-dia" /></div>
      <div className="field" style={{ maxWidth: 200 }}><label>Número de estudiantes</label><InputNumero id="edit-cantidad" min={1} max={MAX_ESTUDIANTES} value={c.cantidad} onChange={(n) => setC((s) => ({ ...s, cantidad: n, reparto: ajustarRepartoATotal(s.reparto, n) }))} required /></div>
      <p className="muted fs-12 m-0">Duración: {duracionTextoDias(c.dias)}. Confirmados actuales: {p.confirmadosN} (la cantidad no puede ser menor).</p>
      <div className="field"><label>Lugar y dirección</label><input className="input" value={c.lugar} onChange={(e) => set('lugar', e.target.value)} required /></div>
      <label className="radio fs-13"><input type="checkbox" checked={c.lejos} onChange={(e) => set('lejos', e.target.checked)} /><span className="dot cuadro" />El lugar está fuera del campus / lejos</label>
      <div className="cols-2" style={{ gap: 'var(--space-2)' }}>
        <div className="field"><label>Responsable en sitio</label><input className="input" value={c.responsable} onChange={(e) => set('responsable', e.target.value)} required /></div>
        <div className="field"><label>Teléfono</label><input className="input" type="tel" value={c.responsableTelefono} onChange={(e) => set('responsableTelefono', e.target.value)} required /></div>
      </div>
      <div className="field"><label>Vestimenta</label><select className="input" value={c.vestimenta} onChange={(e) => set('vestimenta', e.target.value)}>{(Object.keys(VESTIMENTA) as Vestimenta[]).map((k) => <option key={k} value={k}>{VESTIMENTA[k].label}</option>)}</select></div>
      <div className="field"><label>Actividades y estudiantes en cada una</label>
        <EditorReparto reparto={c.reparto} cantidad={c.cantidad} onChange={(r) => set('reparto', r)} idPrefijo="edit-act" />
      </div>
      <details>
        <summary className="muted fs-12" style={{ cursor: 'pointer' }}>Datos del solicitante</summary>
        <div className="stack-2 mt-2">
          <div className="field"><label>Nombre</label><input className="input" value={c.nombre} onChange={(e) => set('nombre', e.target.value)} required /></div>
          <div className="cols-2" style={{ gap: 'var(--space-2)' }}>
            <div className="field"><label>Cargo</label><input className="input" value={c.cargo} onChange={(e) => set('cargo', e.target.value)} required /></div>
            <div className="field"><label>Institución</label><input className="input" value={c.institucion} onChange={(e) => set('institucion', e.target.value)} required /></div>
          </div>
          <div className="field"><label>Correo</label><input className="input" type="email" value={c.correoSolicitante} onChange={(e) => set('correoSolicitante', e.target.value)} /></div>
        </div>
      </details>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button className="btn btn-primary btn-sm" type="submit">Guardar cambios</button><button className="btn btn-ghost btn-sm" type="button" onClick={onCerrar}>Cancelar</button></div>
    </form>
  );
}
