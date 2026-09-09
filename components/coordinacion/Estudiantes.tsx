'use client';
import { useState } from 'react';
import { guardarEstudiante, importarEstudiantes, marcarMatriz } from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { correoMatriz } from '@/lib/correos';
import { MINIMO_EVENTOS, fechaCorta } from '@/lib/reglas';
import type { Datos, Semestre } from '@/lib/tipos';
import { matrizSemestres, type PedidoVista } from '@/lib/vista';

const FORM_VACIO = { id: '', nombre: '', correo: '', semestre: 1, paralelo: '', genero: 'F' as 'F' | 'M', activo: true };

export function Estudiantes({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const [resultado, setResultado] = useState<{ resumen: string; errores: string[] } | null>(null);
  const [verCorreo, setVerCorreo] = useState<Semestre | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [verForm, setVerForm] = useState(false);
  const matriz = matrizSemestres(datos, pedidos);
  const arch = datos.ajustes.archivos.estudiantes;
  const inactivos = datos.estudiantes.filter((e) => !e.activo);

  function subir(archivo: File) {
    const fd = new FormData(); fd.set('archivo', archivo);
    setResultado(null);
    run(() => importarEstudiantes(fd), (d) => setResultado(d ?? null));
  }

  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="cols-auto mt-6">
        <Marco className="p-4 stack-2">
          <div className="card-kicker">Listado de estudiantes · 1.º a 3.º</div>
          <div className="fs-14"><strong>{arch?.nombre ?? 'Sin archivo cargado'}</strong><div className="muted fs-12">{arch ? `${arch.info} · cargado ${fechaCorta(arch.fecha)} ${arch.fecha.slice(0, 4)}` : 'Columnas: Nombre, Correo, Semestre, Paralelo, Género (F/M). Formato .xlsx o .csv.'}</div></div>
          <div className="row">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>{arch ? 'Reemplazar archivo' : 'Cargar archivo'}<input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} /></label>
            <button type="button" className="btn btn-ghost" onClick={() => { setForm(FORM_VACIO); setVerForm(!verForm); }}>{verForm ? 'Cerrar' : 'Agregar o editar a mano'}</button>
          </div>
          {resultado && <p className="fs-12 m-0" style={{ color: 'var(--color-accent-800)' }}>{resultado.resumen}{resultado.errores.length > 0 && <> Filas omitidas: {resultado.errores.slice(0, 5).join(' · ')}{resultado.errores.length > 5 ? ` (+${resultado.errores.length - 5})` : ''}</>}</p>}
          {error && <p className="error">{error}</p>}
          <p className="muted fs-12 m-0">La carga actualiza por correo, agrega los nuevos y desactiva a quienes ya no aparecen. Nunca borra historial.</p>
        </Marco>
        <Marco className="p-4 stack-2" style={{ alignContent: 'start' }}>
          <div className="card-kicker">Regla del semestre</div>
          <p className="m-0 fs-14">Cada estudiante debe cumplir <strong>al menos {MINIMO_EVENTOS} eventos</strong>. La matriz se envía al docente de la materia de cada semestre para la nota; quien no cumpla puede recibir <strong>0</strong> en esa materia.</p>
        </Marco>
      </div>

      {verForm && (
        <Marco as="form" className="p-4 mt-4 stack-3" onSubmit={(e: React.FormEvent) => { e.preventDefault(); run(() => guardarEstudiante({ ...form, id: form.id || undefined }), () => { setForm(FORM_VACIO); setVerForm(false); }); }}>
          <h6 className="h6-accent">{form.id ? 'Editar estudiante' : 'Nuevo estudiante'}</h6>
          <div className="cols-auto-150" style={{ alignItems: 'end' }}>
            <div className="field"><label>Nombre</label><input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
            <div className="field"><label>Correo institucional</label><input className="input" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} required /></div>
            <div className="field"><label>Semestre</label><select className="input" value={form.semestre} onChange={(e) => setForm({ ...form, semestre: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}.º</option>)}</select></div>
            <div className="field"><label>Paralelo</label><input className="input" value={form.paralelo} onChange={(e) => setForm({ ...form, paralelo: e.target.value })} placeholder="A, B, C1…" /></div>
            <div className="field"><label>Género (uniforme)</label><select className="input" value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value as 'F' | 'M' })}><option value="F">Femenino</option><option value="M">Masculino</option></select></div>
            <label className="radio fs-13"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /><span className="dot cuadro" />Activo</label>
            <button className="btn btn-primary" type="submit">Guardar</button>
          </div>
        </Marco>
      )}

      <div className="stack-6 mt-6">
        {matriz.map((m) => {
          const correo = correoMatriz(datos, m);
          return (
            <div key={m.semestre}>
              <div className="between abajo" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div>
                  <h3 className="m-0">{m.semLabel}</h3>
                  <div className="muted fs-13">Matriz para el docente{m.docente ? `: ${m.docente.nombre} · ${m.docente.correo ?? 'sin correo'}` : ' (según el horario cargado)'}</div>
                </div>
                <div className="row">
                  <span className="muted fs-13">{m.cumplenN}/{m.n} cumplen</span>
                  {m.enviada && <span className="tag tag-accent">Matriz enviada · {fechaCorta(m.enviada)}</span>}
                  <button className="btn btn-secondary" type="button" onClick={() => setVerCorreo(verCorreo === m.semestre ? null : m.semestre)}>Enviar matriz al docente</button>
                </div>
              </div>
              {verCorreo === m.semestre && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <CorreoBox titulo={`Correo al docente · ${m.semLabel}`} abierto correo={correo} nota="Descarga la matriz en Excel y adjúntala al correo antes de enviarlo."
                    extra={<>
                      <a className="btn btn-secondary btn-sm" href={`/api/matriz/${m.semestre}`}>Descargar matriz (.xlsx)</a>
                      {m.enviada ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => marcarMatriz(m.semestre, false))}>Desmarcar envío</button> : <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => marcarMatriz(m.semestre, true), () => setVerCorreo(null))}>Marcar como enviada</button>}
                    </>} />
                </div>
              )}
              <Marco className="scroll-x">
                <table className="table" style={{ minWidth: 640 }}>
                  <thead><tr><th>Estudiante</th><th>Correo</th><th>Eventos</th><th>Horas</th><th>Detalle</th><th>Novedades</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {m.filas.length === 0 && <tr><td colSpan={8} className="muted">Sin estudiantes activos en este semestre.</td></tr>}
                    {m.filas.map((s) => (
                      <tr key={s.id}>
                        <td>{s.nombre}{s.paralelo && <span className="muted fs-11"> · {s.paralelo}</span>}</td>
                        <td className="muted fs-13">{s.correo}</td>
                        <td>{s.eventosN}</td>
                        <td className="nowrap">{s.horas} h</td>
                        <td className="muted fs-12">{s.detalle}</td>
                        <td className="fs-12">{s.novedadesN || '—'}</td>
                        <td><span className={`tag ${s.tagClass}`}>{s.estado}</span></td>
                        <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setForm({ id: s.id, nombre: s.nombre, correo: s.correo, semestre: s.semestre, paralelo: s.paralelo ?? '', genero: s.genero, activo: s.activo }); setVerForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Marco>
            </div>
          );
        })}
        {inactivos.length > 0 && (
          <details>
            <summary className="muted fs-13" style={{ cursor: 'pointer' }}>Estudiantes inactivos ({inactivos.length})</summary>
            <div className="stack-2 mt-2">
              {inactivos.map((e) => (
                <div key={e.id} className="linea-item"><span>{e.nombre} <span className="muted fs-11">{e.semestre}.º · {e.correo}</span></span><button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => guardarEstudiante({ ...e, activo: true }))}>Reactivar</button></div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
