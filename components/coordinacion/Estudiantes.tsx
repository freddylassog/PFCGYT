'use client';
import { useState } from 'react';
import { guardarEstudiante, importarEstudiantes, marcarMatriz } from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { correoMatriz } from '@/lib/correos';
import { MINIMO_EVENTOS, fechaCorta } from '@/lib/reglas';
import type { Datos, Estudiante, Semestre } from '@/lib/tipos';
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

  const [semArchivo, setSemArchivo] = useState('0'); // 0 = detectar por NRC con el horario cargado
  const sinCorreo = datos.estudiantes.filter((e) => e.activo && !e.correo).length;
  const materiasDe = (e: Estudiante) => e.nrcs.map((nrc) => { const c = datos.clases.find((x) => x.nrc === nrc); return c ? `${c.materia}${c.paralelo ? ` (${c.paralelo})` : ''}` : `NRC ${nrc}`; }).join(' · ');
  function subir(archivo: File) {
    const fd = new FormData(); fd.set('archivo', archivo); fd.set('semestre', semArchivo);
    setResultado(null);
    run(() => importarEstudiantes(fd), (d) => setResultado(d ?? null));
  }

  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="cols-auto mt-6">
        <Marco className="p-4 stack-2">
          <div className="card-kicker">Listado de estudiantes · 1.º a 3.º</div>
          <div className="fs-14"><strong>{arch?.nombre ?? 'Sin archivo cargado'}</strong><div className="muted fs-12">{arch ? `${arch.info} · cargado ${fechaCorta(arch.fecha)} ${arch.fecha.slice(0, 4)}` : 'Acepta el listado por materia de la universidad (una hoja por materia con NRC; un archivo por semestre) o un listado simple: Nombre, Correo, Semestre, Paralelo, Género.'}</div></div>
          <div className="row">
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>{arch ? 'Reemplazar archivo' : 'Cargar archivo'}<input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }} /></label>
            <button type="button" className="btn btn-ghost" onClick={() => { setForm(FORM_VACIO); setVerForm(!verForm); }}>{verForm ? 'Cerrar' : 'Agregar o editar a mano'}</button>
          </div>
          {resultado && <p className="fs-12 m-0" style={{ color: 'var(--color-accent-800)' }}>{resultado.resumen}{resultado.errores.length > 0 && <span className="falta"> Filas omitidas: {resultado.errores.slice(0, 5).join(' · ')}{resultado.errores.length > 5 ? ` (+${resultado.errores.length - 5})` : ''}</span>}</p>}
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label className="fs-12 muted" htmlFor="sem-archivo">Si cargas el listado por materia, es de:</label>
            <select id="sem-archivo" className="input" style={{ width: 'auto' }} value={semArchivo} onChange={(e) => setSemArchivo(e.target.value)}>
              <option value="0">Detectar por NRC (horario cargado)</option><option value="1">1.º semestre</option><option value="2">2.º semestre</option><option value="3">3.º semestre</option>
            </select>
          </div>
          <p className="muted fs-12 m-0">El listado por materia reemplaza el semestre completo: crea a los nuevos, guarda las materias (NRC) de cada uno y desactiva a quienes ya no aparecen. Nunca borra historial. El listado simple actualiza por correo o por nombre (sirve para completar correos y género).</p>
          {sinCorreo > 0 && <p className="fs-12 m-0 falta">{sinCorreo} estudiante(s) sin correo: <a href="/api/plantilla-estudiantes">descarga la plantilla</a>, completa Correo y Género en Excel y vuelve a cargarla aquí. Sin correo no pueden entrar al portal ni vincular Telegram.</p>}
          {sinCorreo === 0 && datos.estudiantes.some((e) => e.activo) && <p className="muted fs-12 m-0"><a href="/api/plantilla-estudiantes">Descargar plantilla</a> con los estudiantes activos (para corregir correos o género y volver a cargar).</p>}
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
            <div className="field"><label>Correo institucional</label><input className="input" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} placeholder="pendiente" /></div>
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
                  <span className="muted fs-13">{m.cumplenN}/{m.n} cumplen{datos.notificaciones.botUsername || m.filas.some((f) => f.telegramChatId) ? ` · ${m.filas.filter((f) => f.telegramChatId).length} con Telegram` : ''}</span>
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
                  <thead><tr><th>Estudiante</th><th>Correo</th><th>Materias</th><th>Eventos</th><th>Horas</th><th>Detalle</th><th>Novedades</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {m.filas.length === 0 && <tr><td colSpan={9} className="muted">Sin estudiantes activos en este semestre.</td></tr>}
                    {m.filas.map((s) => (
                      <tr key={s.id}>
                        <td>{s.nombre}{s.paralelo && <span className="muted fs-11"> · {s.paralelo}</span>}{s.telegramChatId && <> <span className="tag tag-accent" style={{ fontSize: 10 }} title="Recibe mensajes personales del bot">Telegram</span></>}</td>
                        <td className="muted fs-13">{s.correo || <span className="tag tag-alerta-suave" style={{ fontSize: 10 }}>sin correo</span>}</td>
                        <td className="fs-13">{s.nrcs.length ? <span title={materiasDe(s)} style={{ cursor: 'help', textDecoration: 'underline dotted' }}>{s.nrcs.length}</span> : <span className="muted">—</span>}</td>
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
