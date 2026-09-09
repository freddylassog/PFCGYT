'use client';
import { useState } from 'react';
import { eliminarClase, guardarClase, guardarDocente, importarDocentes, importarHorarios, marcarAviso } from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { correoAvisoDocente } from '@/lib/correos';
import { DIAS_CLASE, SEMESTRES, fechaCorta, semLabel } from '@/lib/reglas';
import type { Datos, Estudiante, Semestre } from '@/lib/tipos';
import { docenteDe, vistaPedidos } from '@/lib/vista';

const CLASE_VACIA = { id: '', semestre: 1, paralelo: '', dia: 1, inicio: '08:00', fin: '10:00', materia: '', teacherId: '', activo: true };

export function Horarios({ datos }: { datos: Datos }) {
  const { pending, error, run } = useAccion();
  const [sem, setSem] = useState<Semestre>(1);
  const [res, setRes] = useState<Record<string, string>>({});
  const [clase, setClase] = useState(CLASE_VACIA);
  const [verClase, setVerClase] = useState(false);
  const [doc, setDoc] = useState({ id: '', nombre: '', correo: '' });
  const [verDoc, setVerDoc] = useState(false);
  const pedidos = vistaPedidos(datos);
  const arch = datos.ajustes.archivos;
  const clases = datos.clases.filter((c) => c.activo && c.semestre === sem).sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio) || (a.paralelo || '').localeCompare(b.paralelo || ''));

  function subir(clave: 'horarios' | 'docentes', archivo: File) {
    const fd = new FormData(); fd.set('archivo', archivo);
    const fn = clave === 'horarios' ? importarHorarios : importarDocentes;
    run(() => fn(fd), (d) => setRes({ ...res, [clave]: d ? `${d.resumen}${d.errores.length ? ' Filas omitidas: ' + d.errores.slice(0, 4).join(' · ') : ''}` : '' }));
  }

  const avisos = datos.avisos.map((a) => {
    const p = pedidos.find((x) => x.id === a.requestId);
    const c = datos.clases.find((x) => x.id === a.classId);
    if (!p || !c) return null;
    const cruce = { ...c, docente: docenteDe(datos, c.teacherId), semLabel: semLabel(c.semestre), aviso: a };
    const est = a.studentIds.map((id) => datos.estudiantes.find((e) => e.id === id)).filter((e): e is Estudiante => !!e);
    return { a, p, c: cruce, est, correo: correoAvisoDocente(p, cruce, est) };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => (x.a.sentAt ? 1 : 0) - (y.a.sentAt ? 1 : 0) || y.a.createdAt.localeCompare(x.a.createdAt));

  const tarjeta = (clave: 'horarios' | 'docentes', titulo: string, columnas: string) => {
    const info = arch[clave];
    return (
      <Marco className="p-4 stack-2">
        <div className="card-kicker">{titulo}</div>
        <div className="fs-14"><strong>{info?.nombre ?? 'Sin archivo cargado'}</strong><div className="muted fs-12">{info ? `${info.info} · cargado ${fechaCorta(info.fecha)} ${info.fecha.slice(0, 4)}` : `Columnas: ${columnas}. Formato .xlsx o .csv.`}</div></div>
        <label className="btn btn-secondary" style={{ justifySelf: 'start', cursor: 'pointer' }}>{info ? 'Reemplazar archivo' : 'Cargar archivo'}<input type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(clave, f); e.target.value = ''; }} /></label>
        {res[clave] && <p className="fs-12 m-0" style={{ color: 'var(--color-accent-800)' }}>{res[clave]}</p>}
      </Marco>
    );
  };

  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="mt-8 max-760"><h1 className="m-0">Horarios y docentes</h1><p className="muted" style={{ margin: 'var(--space-1) 0 0' }}>Carga el horario de la universidad (1.º a 3.º) y el directorio de docentes con sus correos. El sistema detecta qué materias chocan con cada evento según el semestre y el paralelo de cada estudiante confirmado, y prepara el correo al docente; tú lo envías desde Outlook.</p></div>
      <div className="cols-auto mt-6">
        {tarjeta('horarios', 'Horarios por semestre', 'el archivo de la universidad tal cual (ASIGNATURA, NIVEL, PARALELO, DOCENTE, LUNES…VIERNES)')}
        {tarjeta('docentes', 'Directorio de docentes', 'Nombre, Correo')}
      </div>
      {error && <p className="error mt-3">{error}</p>}

      <div className="between abajo mt-8" style={{ gap: 'var(--space-3)' }}>
        <h3 className="m-0">Horario semanal</h3>
        <div className="row">
          <div className="seg">{SEMESTRES.map((n) => <label key={n} className="seg-opt"><input type="radio" name="sem" checked={sem === n} onChange={() => setSem(n)} />{n}.º</label>)}</div>
          <button type="button" className="btn btn-ghost" onClick={() => { setClase({ ...CLASE_VACIA, semestre: sem }); setVerClase(!verClase); }}>{verClase ? 'Cerrar' : 'Agregar clase'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setDoc({ id: '', nombre: '', correo: '' }); setVerDoc(!verDoc); }}>{verDoc ? 'Cerrar' : 'Agregar docente'}</button>
        </div>
      </div>
      {verClase && (
        <Marco as="form" className="p-4 mt-3 stack-3" onSubmit={(e: React.FormEvent) => { e.preventDefault(); run(() => guardarClase({ ...clase, id: clase.id || undefined, teacherId: clase.teacherId || null }), () => { setVerClase(false); setClase(CLASE_VACIA); }); }}>
          <h6 className="h6-accent">{clase.id ? 'Editar clase' : 'Nueva clase'}</h6>
          <div className="cols-auto-150" style={{ alignItems: 'end' }}>
            <div className="field"><label>Semestre</label><select className="input" value={clase.semestre} onChange={(e) => setClase({ ...clase, semestre: Number(e.target.value) })}>{SEMESTRES.map((n) => <option key={n} value={n}>{n}.º</option>)}</select></div>
            <div className="field"><label>Paralelo</label><input className="input" value={clase.paralelo} onChange={(e) => setClase({ ...clase, paralelo: e.target.value })} placeholder="A, B, C1…" /></div>
            <div className="field"><label>Día</label><select className="input" value={clase.dia} onChange={(e) => setClase({ ...clase, dia: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DIAS_CLASE[d]}</option>)}</select></div>
            <div className="field"><label>Inicio</label><input className="input" type="time" value={clase.inicio} onChange={(e) => setClase({ ...clase, inicio: e.target.value })} required /></div>
            <div className="field"><label>Fin</label><input className="input" type="time" value={clase.fin} onChange={(e) => setClase({ ...clase, fin: e.target.value })} required /></div>
            <div className="field"><label>Materia</label><input className="input" value={clase.materia} onChange={(e) => setClase({ ...clase, materia: e.target.value })} required /></div>
            <div className="field"><label>Docente</label><select className="input" value={clase.teacherId} onChange={(e) => setClase({ ...clase, teacherId: e.target.value })}><option value="">—</option>{datos.docentes.filter((d) => d.activo).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
            <button className="btn btn-primary" type="submit">Guardar</button>
          </div>
        </Marco>
      )}
      {verDoc && (
        <Marco as="form" className="p-4 mt-3 stack-3" onSubmit={(e: React.FormEvent) => { e.preventDefault(); run(() => guardarDocente({ ...doc, id: doc.id || undefined, activo: true }), () => { setVerDoc(false); setDoc({ id: '', nombre: '', correo: '' }); }); }}>
          <h6 className="h6-accent">{doc.id ? 'Editar docente' : 'Nuevo docente'}</h6>
          <div className="cols-auto-150" style={{ alignItems: 'end' }}>
            <div className="field"><label>Nombre</label><input className="input" value={doc.nombre} onChange={(e) => setDoc({ ...doc, nombre: e.target.value })} required /></div>
            <div className="field"><label>Correo</label><input className="input" type="email" value={doc.correo} onChange={(e) => setDoc({ ...doc, correo: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit">Guardar</button>
          </div>
          {datos.docentes.length > 0 && <div className="row fs-12">{datos.docentes.filter((d) => d.activo).map((d) => <button key={d.id} type="button" className={`btn btn-sm ${d.correo ? 'btn-ghost' : 'btn-secondary'}`} title={d.correo ?? 'Sin correo: pulsa para completarlo'} onClick={() => setDoc({ id: d.id, nombre: d.nombre, correo: d.correo ?? '' })}>{d.nombre}{d.correo ? '' : ' · sin correo'}</button>)}</div>}
        </Marco>
      )}
      <Marco className="mt-3 scroll-x">
        <table className="table" style={{ minWidth: 560 }}>
          <thead><tr><th>Día</th><th>Hora</th><th>Materia</th><th>Paralelo</th><th>Docente</th><th>Correo</th><th></th></tr></thead>
          <tbody>
            {clases.length === 0 && <tr><td colSpan={7} className="muted">Sin clases cargadas para {sem}.º semestre.</td></tr>}
            {clases.map((c) => {
              const d = docenteDe(datos, c.teacherId);
              return (
                <tr key={c.id}>
                  <td>{DIAS_CLASE[c.dia]}</td><td className="nowrap">{c.inicio}–{c.fin}</td><td>{c.materia}</td><td>{c.paralelo ?? '—'}</td><td>{d?.nombre ?? '—'}</td><td className="muted fs-13">{d?.correo ?? <span className="tag tag-outline">sin correo</span>}</td>
                  <td className="nowrap"><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setClase({ id: c.id, semestre: c.semestre, paralelo: c.paralelo ?? '', dia: c.dia, inicio: c.inicio, fin: c.fin, materia: c.materia, teacherId: c.teacherId ?? '', activo: true }); setVerClase(true); }}>Editar</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`¿Eliminar ${c.materia} (${DIAS_CLASE[c.dia]} ${c.inicio})?`)) run(() => eliminarClase(c.id)); }}>Quitar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Marco>

      {datos.docentes.some((d) => d.activo && !d.correo) && <p className="aviso mt-3 fs-13" style={{ maxWidth: 760 }}>Hay docentes sin correo ({datos.docentes.filter((d) => d.activo && !d.correo).length}). Carga el directorio de docentes (Nombre, Correo) o pulsa &quot;Agregar docente&quot; y elige el nombre para completarlo.</p>}
      <div className="mt-8"><h3 className="m-0">Correos a docentes</h3><p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Aviso de ausencia justificada por apoyo protocolario. Se preparan al confirmar estudiantes; ábrelos en Outlook, envíalos y márcalos como enviados.</p></div>
      <div className="stack mt-4 max-760">
        {!avisos.length && <p className="muted">Aún no hay correos preparados.</p>}
        {avisos.map(({ a, p, c, est, correo }) => (
          <Marco key={a.id} className="p-6 stack-2 fs-14">
            <div className="between">
              <div className="card-kicker">Para: {c.docente?.nombre ?? 'docente sin registrar'} · {c.docente?.correo ?? '—'} · {a.sentAt ? `enviado ${fechaCorta(a.sentAt)}` : 'pendiente de envío'}</div>
              {a.sentAt ? <span className="tag tag-accent">Enviado</span> : <span className="tag tag-outline">Pendiente</span>}
            </div>
            <h4 className="m-0">Ausencia justificada en {c.materia} ({c.semLabel}) · {p.fechaLarga}</h4>
            <p className="m-0">Estimado/a docente: los siguientes estudiantes participarán en el evento <strong>{p.evento}</strong> ({p.inicio}–{p.fin}) como apoyo protocolario de la facultad, por lo que no asistirán a su clase de {c.inicio}–{c.fin}.</p>
            <div className="row" style={{ gap: 4 }}>{est.map((s) => <span key={s.id} className="tag tag-neutral">{s.nombre}</span>)}</div>
            <p className="muted fs-13 m-0">Coordinación de Protocolo · FCGT · Universidad UTE</p>
            <CorreoBox titulo="Correo listo para enviar" correo={correo} extra={a.sentAt
              ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => marcarAviso(a.id, false))}>Marcar como no enviado</button>
              : <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => marcarAviso(a.id, true))}>Marcar como enviado</button>} />
          </Marco>
        ))}
      </div>
    </div>
  );
}
