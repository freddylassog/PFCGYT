'use client';
import { useState } from 'react';
import {
  cambiarEstado, confirmarDirecto, crearAviso, decidirInscripcion, marcarAviso, marcarConvenio, quitarNovedad, regenerarClave, registrarNovedad, reportarNovedades,
} from '@/app/actions/coordinacion';
import { CorreoBox } from '@/components/CorreoBox';
import { IconoCalendario, IconoCerrar } from '@/components/Iconos';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { EditarPedido } from './EditarPedido';
import { correoAvisoDocente, correoConvocatoria, correoDecanato, correoEstudianteDecision, correoRecordatorio, correoSolicitante, mailtoUrl } from '@/lib/correos';
import { TIPOS_NOVEDAD, claseAplica, fechaCorta, infoUniforme, semCorto } from '@/lib/reglas';
import type { Datos, Estado, Estudiante } from '@/lib/tipos';
import type { CruceVista, PedidoVista } from '@/lib/vista';

export function PanelPedido({ p, datos, pedidos, cruceEvento, onCerrar }: { p: PedidoVista; datos: Datos; pedidos: PedidoVista[]; cruceEvento: PedidoVista | null; onCerrar: () => void }) {
  const { pending, error, run } = useAccion();
  const [nv, setNv] = useState({ stId: '', tipo: TIPOS_NOVEDAD[0], nota: '' });
  const [verDecanato, setVerDecanato] = useState(false);
  const [agregarId, setAgregarId] = useState('');
  const [editando, setEditando] = useState(false);
  const nEstudiantes = datos.estudiantes.filter((e) => e.activo).length;
  const eventosPor = (id: string) => pedidos.filter((x) => x.estado === 'Aprobado' && x.confirmados.some((e) => e.id === id)).length;
  const uniformeIncompleto = (e: Estudiante) => p.vestimenta === 'uniforme' && !infoUniforme(e.genero, datos.prendas.filter((x) => x.studentId === e.id).map((x) => x.item)).completo;
  const pendientes = p.novedades.filter((n) => n.pendiente);
  const disponibles = datos.estudiantes.filter((e) => e.activo && !p.confirmados.some((c) => c.id === e.id) && !p.inscritos.some((c) => c.id === e.id));

  function estudiantesAviso(c: CruceVista): Estudiante[] {
    if (c.aviso) return c.aviso.studentIds.map((id) => datos.estudiantes.find((e) => e.id === id)).filter((e): e is Estudiante => !!e);
    const delSem = p.confirmados.filter((e) => claseAplica(c, e));
    return delSem.length ? delSem : p.confirmados;
  }

  const cambiar = (estado: Estado) => run(() => cambiarEstado(p.id, estado));

  return (
    <Marco as="aside" className={`panel-lateral ${pending ? 'pendiente' : ''}`} aria-label={`Detalle del pedido ${p.codigo}`}>
      <div className="between arriba">
        <div><div className="card-kicker">{p.codigo} · {p.tipoLabel}</div><h3 style={{ margin: '2px 0 0' }}>{p.evento}</h3></div>
        <button className="btn btn-icon btn-ghost" type="button" onClick={onCerrar} aria-label="Cerrar"><IconoCerrar /></button>
      </div>
      <div className="row">
        <span className={`tag ${p.tagClass}`}>{p.estado}</span>
        <span className={`tag ${p.convTag}`}>{p.convLabel}</span>
        {p.tipo === 'externo' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => marcarConvenio(p.id, p.convenio === 'no' ? 'si' : 'no'))}>{p.convenio === 'no' ? 'Marcar convenio vigente' : 'Marcar sin convenio'}</button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditando(!editando)}>{editando ? 'Cerrar edición' : 'Editar pedido'}</button>
      </div>
      {editando && <EditarPedido p={p} onCerrar={() => setEditando(false)} />}
      <dl className="dl">
        <dt className="muted">Solicita</dt><dd>{p.nombre}, {p.cargo} · {p.institucion}</dd>
        <dt className="muted">Correo</dt><dd>{p.correoSolicitante ? <a href={`mailto:${p.correoSolicitante}`}>{p.correoSolicitante}</a> : '—'}</dd>
        <dt className="muted">Fecha</dt><dd>{p.fechaLarga}</dd>
        <dt className="muted">Horario</dt><dd>{p.inicio}–{p.fin} · <strong>{p.horas} h</strong> de protocolo</dd>
        <dt className="muted">Estudiantes</dt><dd>{p.cantidad} solicitados</dd>
        <dt className="muted">Vestimenta</dt><dd>{p.vestLabel}</dd>
        <dt className="muted">Lugar</dt><dd>{p.lugar}{p.lejos ? ' · lejos' : ''}</dd>
        <dt className="muted">Responsable</dt><dd>{p.responsable}</dd>
        <dt className="muted">Pedido</dt><dd>{p.fechaPedido} · {p.evidenciaPath ? <a href={`/api/evidencia/${p.id}`} target="_blank" rel="noopener">{p.evidenciaTexto}</a> : p.evidenciaTexto}</dd>
      </dl>
      <div><h6 style={{ margin: '0 0 4px' }}>Actividades</h6><div className="row" style={{ gap: 4 }}>{p.actividades.map((a) => <span key={a} className="tag tag-neutral">{a}</span>)}</div></div>
      {(p.pasa4h || p.transporte) && (
        <div className="stack-2 fs-13" style={{ gap: 4 }}>
          {p.pasa4h && <div style={{ display: 'flex', gap: 6 }}><span className="tag tag-accent" style={{ flex: 'none' }}>Alimentación</span><span>Más de 4 h: el organizador cubre alimentación.</span></div>}
          {p.transporte && <div style={{ display: 'flex', gap: 6 }}><span className="tag tag-accent" style={{ flex: 'none' }}>Transporte</span><span>{p.transporteMotivo}: transporte de regreso obligatorio.</span></div>}
        </div>
      )}
      {cruceEvento && (
        <div className="alerta" role="status"><IconoCalendario /><span><strong>Hay otro evento en esa hora.</strong> Se cruza con <em>{cruceEvento.codigo} · {cruceEvento.evento}</em> ({cruceEvento.inicio}–{cruceEvento.fin}, {cruceEvento.estado}). Revisa los cupos antes de aprobar.</span></div>
      )}

      {/* Convocatoria e inscripciones */}
      <div className="stack-2 borde-arriba">
        <div className="between"><h6 className="m-0">Convocatoria a estudiantes</h6><span className="heading">{p.confirmadosN} / {p.cantidad} confirmados</span></div>
        {!p.convocadaAt && <p className="muted fs-12 m-0">Al aprobar, el sistema genera la clave del evento y el correo de convocatoria (fecha, horario, horas, actividades y vestimenta) para los {nEstudiantes} estudiantes de 1.º a 3.º con el link para inscribirse. Tú lo envías desde Outlook y confirmas quién entra.</p>}
        {p.convocadaAt && (
          <>
            <span className="tag tag-accent" style={{ justifySelf: 'start' }}>Convocatoria abierta · {fechaCorta(p.convocadaAt)} · {nEstudiantes} estudiantes</span>
            <div className="between fs-12" style={{ border: '1px solid var(--color-divider)', padding: '6px 8px' }}>
              <span><span className="muted">Clave del evento (para inscribirse):</span> <strong className="heading" style={{ fontSize: 14, letterSpacing: '.08em' }}>{p.clave ?? '—'}</strong></span>
              <button className="btn btn-ghost btn-sm" type="button" title="Cambia la clave por una aleatoria (UTE-XXXX)" onClick={() => { if (confirm('¿Cambiar la clave por una aleatoria? Los estudiantes deberán usar la nueva.')) run(() => regenerarClave(p.id)); }}>Generar otra</button>
            </div>
            <CorreoBox titulo="Correo de convocatoria" correo={correoConvocatoria(datos, p)} nota={datos.ajustes.correoGrupoEstudiantes ? undefined : 'Sin grupo de Outlook configurado: los estudiantes activos van en CCO. Puedes fijar el grupo en Resumen → Ajustes.'} />
            {p.inscritosN > 0 && (
              <>
                <div className="card-kicker">Inscritos por revisar · {p.inscritosN}</div>
                {p.inscritos.map((s) => (
                  <div key={s.id} className="linea-item">
                    <span style={{ minWidth: 0 }}>{s.nombre} <span className="muted fs-11">{semCorto(s.semestre)} · {eventosPor(s.id)} ev.</span>{uniformeIncompleto(s) && <> <span className="tag tag-outline" style={{ fontSize: 10 }}>Uniforme incompleto</span></>}</span>
                    <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                      <button className="btn btn-primary btn-sm" type="button" disabled={p.lleno} onClick={() => run(() => decidirInscripcion(p.id, s.id, 'aceptar'))}>Aceptar</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => decidirInscripcion(p.id, s.id, 'rechazar'))}>Rechazar</button>
                    </span>
                  </div>
                ))}
              </>
            )}
            {p.confirmadosN > 0 && (
              <>
                <div className="card-kicker">Confirmados</div>
                {p.confirmados.map((s) => (
                  <div key={s.id} className="linea-item">
                    <span>{s.nombre} <span className="muted fs-11">{semCorto(s.semestre)}</span></span>
                    <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                      <a className="btn btn-ghost btn-sm" href={mailtoUrl(correoEstudianteDecision(p, s, true))} title="Correo de confirmación">Correo</a>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => decidirInscripcion(p.id, s.id, 'quitar'))}>Quitar</button>
                    </span>
                  </div>
                ))}
              </>
            )}
            {!p.inscritosN && !p.confirmadosN && <p className="muted fs-12 m-0">Aún no hay inscripciones.</p>}
            {!p.lleno && disponibles.length > 0 && (
              <div className="row" style={{ gap: 4 }}>
                <select className="input" style={{ flex: 1, minWidth: 160 }} value={agregarId} onChange={(e) => setAgregarId(e.target.value)} aria-label="Agregar estudiante directamente">
                  <option value="">Agregar estudiante…</option>
                  {disponibles.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {semCorto(e.semestre)}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" type="button" disabled={!agregarId} onClick={() => run(() => confirmarDirecto(p.id, agregarId), () => setAgregarId(''))}>Confirmar</button>
              </div>
            )}
            {p.estado === 'Aprobado' && p.confirmadosN > 0 && <CorreoBox titulo="Recordatorio 24 h a confirmados" correo={correoRecordatorio(p)} />}
          </>
        )}
      </div>

      {/* Novedades */}
      {p.convocadaAt && (
        <div className="stack-2 borde-arriba">
          <div className="between"><h6 className="m-0">Novedades del evento</h6><span className="muted fs-12">{p.novedades.length} registradas</span></div>
          {p.novedades.map((n) => (
            <div key={n.id} className="linea-item arriba">
              <div style={{ minWidth: 0 }}><strong>{n.estudiante?.nombre}</strong> · {n.tipo}{n.nota && <div className="muted">{n.nota}</div>}</div>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 'none' }}>
                {n.reportadoAt ? <span className="tag tag-accent">Decanato · {fechaCorta(n.reportadoAt)}</span> : <><span className="tag tag-outline">Sin reportar</span><button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => quitarNovedad(n.id))}>Quitar</button></>}
              </span>
            </div>
          ))}
          {p.confirmadosN > 0 ? (
            <>
              <div className="cols-2" style={{ gap: 'var(--space-2)' }}>
                <select className="input" value={nv.stId} onChange={(e) => setNv({ ...nv, stId: e.target.value })} aria-label="Estudiante"><option value="">Estudiante…</option>{p.confirmados.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
                <select className="input" value={nv.tipo} onChange={(e) => setNv({ ...nv, tipo: e.target.value })} aria-label="Tipo de novedad">{TIPOS_NOVEDAD.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                <input className="input" value={nv.nota} onChange={(e) => setNv({ ...nv, nota: e.target.value })} placeholder="Detalle (opcional)" style={{ gridColumn: '1/-1' }} aria-label="Detalle" />
                <button className="btn btn-secondary" type="button" disabled={!nv.stId} onClick={() => run(() => registrarNovedad(p.id, nv.stId, nv.tipo, nv.nota), () => setNv({ ...nv, stId: '', nota: '' }))}>Registrar novedad</button>
                <button className="btn btn-primary" type="button" disabled={!pendientes.length} onClick={() => setVerDecanato(true)}>Reportar a decanato</button>
              </div>
              {verDecanato && pendientes.length > 0 && (
                <CorreoBox titulo={`Correo a decanato · ${pendientes.length} novedad(es)`} abierto correo={correoDecanato(datos, [{ pedido: p, novedades: pendientes }])}
                  extra={<button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => reportarNovedades(pendientes.map((n) => n.id)), () => setVerDecanato(false))}>Marcar como reportadas</button>} />
              )}
              <p className="muted fs-11 m-0">Las novedades reportadas van a decanato para sanción y quedan en el reporte del evento.</p>
            </>
          ) : <p className="muted fs-12 m-0">Confirma estudiantes para registrar novedades.</p>}
        </div>
      )}

      {/* Cruce con clases */}
      <div className="punteado">
        <h6 className="h6-accent">Cruce con clases · {p.cruceAmbito}</h6>
        {p.cruces.map((c) => {
          const est = estudiantesAviso(c);
          const correo = correoAvisoDocente(p, c, est);
          return (
            <div key={c.id} className="fs-13 between arriba">
              <div><strong>{c.materia}</strong> · {c.semLabel} · {c.inicio}–{c.fin}<div className="muted">{c.docente ? `${c.docente.nombre} · ${c.docente.correo ?? 'sin correo (complétalo en Horarios)'}` : 'Docente sin registrar'}</div></div>
              {c.aviso?.sentAt ? (
                <span className="row" style={{ gap: 4 }}><span className="tag tag-accent">Correo enviado · {fechaCorta(c.aviso.sentAt)}</span><button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => marcarAviso(c.aviso!.id, false))}>Deshacer</button></span>
              ) : c.aviso ? (
                <span className="row" style={{ gap: 4 }}>
                  <span className="tag tag-outline">Pendiente de envío</span>
                  <a className="btn btn-secondary btn-sm" href={mailtoUrl(correo)}>Abrir correo</a>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => marcarAviso(c.aviso!.id, true))}>Marcar enviado</button>
                </span>
              ) : (
                <button className="btn btn-secondary btn-sm" type="button" disabled={!p.confirmadosN} title={p.confirmadosN ? '' : 'Confirma estudiantes primero'} onClick={() => run(() => crearAviso(p.id, c.id))}>Preparar correo</button>
              )}
            </div>
          );
        })}
        {!p.cruces.length && <p className="muted fs-13 m-0">No se cruza con ninguna clase.</p>}
        {p.cruces.some((c) => !c.aviso?.sentAt) && <p className="muted fs-12 m-0">Los correos a docentes se preparan automáticamente al confirmar estudiantes de ese semestre. Envíalos desde aquí o desde Horarios y márcalos como enviados.</p>}
      </div>

      {p.bloqueo && <p className="error">{p.bloqueo}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="cols-2" style={{ gap: 'var(--space-2)' }}>
        <button className="btn btn-primary btn-40" type="button" style={{ gridColumn: '1/-1' }} disabled={!!p.bloqueo || p.estado === 'Aprobado'} onClick={() => cambiar('Aprobado')}>Aprobar y convocar estudiantes</button>
        <button className="btn btn-secondary" type="button" disabled={p.estado === 'Ajustes'} onClick={() => cambiar('Ajustes')}>Pedir ajustes</button>
        <button className="btn btn-secondary" type="button" disabled={p.estado === 'Rechazado'} onClick={() => { if (p.estado !== 'Aprobado' || confirm('El pedido está aprobado. ¿Rechazarlo de todos modos?')) cambiar('Rechazado'); }}>Rechazar</button>
      </div>
      <CorreoBox titulo={`Correo al solicitante · ${p.estado}`} correo={correoSolicitante(p)} />
    </Marco>
  );
}
