'use client';
import { useRef, useState } from 'react';
import {
  cambiarEstado, confirmarDirecto, crearAviso, decidirInscripcion, eliminarPedido, fijarDiasEstudiante, finalizarEvento, guardarActaFirmada, marcarAviso, marcarConvenio, prepararActaFirmada, publicarConvocatoriaCanal, quitarActaFirmada, quitarNovedad, regenerarClave, registrarNovedad, reportarNovedades,
} from '@/app/actions/coordinacion';
import { AbrirCorreo, CorreoBox } from '@/components/CorreoBox';
import { IconoCalendario, IconoCerrar } from '@/components/Iconos';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { EditarPedido } from './EditarPedido';
import { CitaUniforme } from './CitaUniforme';
import { correoAvisoDocente, correoConvocatoria, correoDecanato, correoEstudianteDecision, correoRecordatorio, correoSolicitante, mailtoUrl } from '@/lib/correos';
import { TIPOS_NOVEDAD, fechaCorta, semCorto } from '@/lib/reglas';
import type { Datos, Estado, Estudiante } from '@/lib/tipos';
import { diasDeEstudiante, diasLlenosDe, estudiantesDeAviso, type CruceVista, type PedidoVista } from '@/lib/vista';
import type { CruceEvento } from '@/lib/reglas';

export function PanelPedido({ p, datos, pedidos, cruceEvento, onCerrar }: { p: PedidoVista; datos: Datos; pedidos: PedidoVista[]; cruceEvento: CruceEvento<PedidoVista> | null; onCerrar: () => void }) {
  const { pending, error, run: correr } = useAccion();
  // El error se muestra junto a la sección donde se pulsó: inscripciones o el resto del panel.
  const [zonaError, setZonaError] = useState<'inscripciones' | 'general'>('general');
  const run: typeof correr = (fn, ok) => { setZonaError('general'); correr(fn, ok); };
  const runIns: typeof correr = (fn, ok) => { setZonaError('inscripciones'); correr(fn, ok); };
  const [nv, setNv] = useState({ stId: '', tipo: TIPOS_NOVEDAD[0], nota: '' });
  const [verDecanato, setVerDecanato] = useState(false);
  const [agregarId, setAgregarId] = useState('');
  // Días del estudiante que coordinación agrega (varios días): por defecto, los que tienen cupo; null = sin tocar aún.
  const [agregarDias, setAgregarDias] = useState<string[] | null>(null);
  const [editando, setEditando] = useState(false);
  const [verCorreo, setVerCorreo] = useState<string | null>(null);
  const [subiendoActa, setSubiendoActa] = useState(false);
  const [errorActa, setErrorActa] = useState<string | null>(null);
  const actaRef = useRef<HTMLInputElement>(null);
  async function subirActa(archivo: File) {
    setErrorActa(null); setSubiendoActa(true);
    try {
      const prep = await prepararActaFirmada(p.id, archivo.name, archivo.type, archivo.size);
      if (!prep.ok || !prep.datos) throw new Error(prep.error || 'No se pudo preparar la subida.');
      const resp = await fetch(prep.datos.url, { method: 'PUT', headers: { 'content-type': archivo.type || 'application/octet-stream', 'x-upsert': 'false' }, body: archivo });
      if (!resp.ok) throw new Error('La subida falló (' + resp.status + '). Intenta de nuevo.');
      const r = await guardarActaFirmada(p.id, prep.datos.path, archivo.name);
      if (!r.ok) throw new Error(r.error || 'No se pudo guardar el acta.');
    } catch (e) { setErrorActa((e as Error).message); } finally { setSubiendoActa(false); if (actaRef.current) actaRef.current.value = ''; }
  }
  const nEstudiantes = datos.estudiantes.filter((e) => e.activo).length;
  const eventosPor = (id: string) => pedidos.filter((x) => x.estado === 'Aprobado' && x.confirmados.some((e) => e.id === id)).length;
  const pendientes = p.novedades.filter((n) => n.pendiente);
  const disponibles = datos.estudiantes.filter((e) => e.activo && !p.confirmados.some((c) => c.id === e.id) && !p.inscritos.some((c) => c.id === e.id));

  // Pendiente: quienes hoy le chocan esa clase (días de asistencia al día); enviado: lo que se mandó.
  const estudiantesAviso = (c: CruceVista): Estudiante[] => estudiantesDeAviso(p, c, c.aviso, datos.estudiantes);

  const cambiar = (estado: Estado) => run(() => cambiarEstado(p.id, estado));
  /** En eventos de varios días: botones D1, D2… para marcar a qué días va el estudiante. */
  const chipsDias = (studentId: string) => {
    if (!p.multidia) return null;
    const mios = diasDeEstudiante(p, studentId).map((d) => d.fecha);
    return (
      <span className="row" style={{ gap: 3, display: 'inline-flex', marginLeft: 6 }} title="Días a los que asiste (clic para cambiar)">
        {p.dias.map((d, i) => {
          const va = mios.includes(d.fecha);
          return <button key={d.fecha} type="button" className={`tag ${va ? 'tag-accent' : 'tag-outline'}`} style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer' }} aria-pressed={va} aria-label={`Día ${i + 1} · ${fechaCorta(d.fecha)}`}
            onClick={() => { const nuevos = va ? mios.filter((f) => f !== d.fecha) : [...mios, d.fecha]; if (!nuevos.length) return; runIns(() => fijarDiasEstudiante(p.id, studentId, nuevos.length === p.dias.length ? null : nuevos)); }}>D{i + 1}</button>;
        })}
      </span>
    );
  };
  function eliminar() {
    const detalle = [p.confirmadosN ? `${p.confirmadosN} estudiante(s) confirmado(s)` : '', p.inscritosN ? `${p.inscritosN} inscripción(es) por revisar` : '', p.novedades.length ? `${p.novedades.length} novedad(es)` : '', p.evidenciaPath ? 'la evidencia adjunta' : ''].filter(Boolean).join(', ');
    if (!confirm(`¿Eliminar para siempre el pedido ${p.codigo} · ${p.evento}?${detalle ? `\nSe borrarán también: ${detalle}.` : ''}\nEsta acción no se puede deshacer (si solo quieres descartarlo, usa Rechazar).`)) return;
    if (p.confirmadosN > 0 && prompt(`Este pedido tiene estudiantes confirmados y sus horas dejarán de contar. Para confirmar, escribe el código ${p.codigo}:`)?.trim().toUpperCase() !== p.codigo) return;
    run(() => eliminarPedido(p.id), onCerrar);
  }

  return (
    <Marco as="aside" className={`panel-lateral ${pending ? 'pendiente' : ''}`} aria-label={`Detalle del pedido ${p.codigo}`}>
      <div className="between arriba">
        <div><div className="card-kicker">{p.codigo} · {p.tipoLabel}</div><h3 style={{ margin: '2px 0 0' }}>{p.evento}</h3></div>
        <button className="btn btn-icon btn-ghost" type="button" onClick={onCerrar} aria-label="Cerrar"><IconoCerrar /></button>
      </div>
      <div className="row">
        <span className={`tag ${p.tagClass}`}>{p.estadoLabel}{p.finalizado && p.finalizadoAt ? ` · ${fechaCorta(p.finalizadoAt)}` : ''}</span>
        <span className={`tag tag-${p.tipo}`}>{p.tipoLabel}</span>
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
        <dt className="muted">Horario</dt><dd>{p.multidia ? p.dias.map((d) => <div key={d.fecha}>{fechaCorta(d.fecha)} · {d.inicio}–{d.fin}</div>) : `${p.inicio}–${p.fin}`}<div><strong>{p.horas} h</strong> de protocolo{p.multidia ? ` en ${p.dias.length} días` : ''}</div></dd>
        <dt className="muted">Estudiantes</dt><dd>{p.cantidad} solicitados</dd>
        <dt className="muted">Vestimenta</dt><dd>{p.vestLabel}</dd>
        <dt className="muted">Lugar</dt><dd>{p.mismoLugar ? <>{p.lugar}{p.lejos ? ' · fuera del DMQ / aeropuerto' : ''}</> : p.dias.map((d, i) => <div key={d.fecha}>Día {i + 1}: {d.lugar || p.lugar}{d.lejos ? ' · fuera del DMQ / aeropuerto' : ''}</div>)}</dd>
        <dt className="muted">Responsable</dt><dd>{p.responsable}{p.responsableTelefono && <> · <a href={`tel:${p.responsableTelefono.replace(/[^\d+]/g, '')}`}>{p.responsableTelefono}</a></>}</dd>
        <dt className="muted">Pedido</dt><dd>{p.fechaPedido} · {p.evidenciaPath ? <a href={`/api/evidencia/${p.id}`} target="_blank" rel="noopener">{p.evidenciaTexto}</a> : p.evidenciaTexto}</dd>
      </dl>
      <div><h6 style={{ margin: '0 0 4px' }}>Actividades</h6><div className="row" style={{ gap: 4 }}>{p.actividadesEtiquetas.map((a) => <span key={a} className="tag tag-neutral">{a}</span>)}</div></div>
      <div className="stack-2 fs-13" style={{ gap: 4 }}>
        <div className="between"><h6 className="m-0">Compromisos del organizador</h6>{p.actaUrl && <a className="btn btn-secondary btn-sm" href={p.actaUrl} target="_blank" rel="noopener">Acta de compromiso (PDF)</a>}</div>
        {p.compromisosLista.map((c) => (
          <div key={c.clave} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><span className={`tag ${c.aplica ? 'tag-accent' : 'tag-neutral'}`} style={{ flex: 'none' }}>{c.titulo}</span><span className={c.aplica ? '' : 'muted'}>{c.texto}</span></div>
        ))}
        <p className="muted fs-12 m-0">Aceptados en la app por {p.nombre} ({p.correoSolicitante || 'sin correo'}) el {p.fechaPedido}. El acta en PDF lleva esa aceptación; la firma manuscrita es opcional.</p>
        <div className="row" style={{ gap: 6 }}>
          {p.actaFirmadaPath
            ? <><a className="tag tag-verde" href={`/api/acta-firmada/${p.id}`} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>Acta firmada · {p.actaFirmadaAt ? fechaCorta(p.actaFirmadaAt.slice(0, 10)) : ''} · {p.actaFirmadaNombre}</a><button className="btn btn-ghost btn-sm" type="button" onClick={() => { if (confirm('¿Quitar el acta firmada?')) run(() => quitarActaFirmada(p.id)); }}>Quitar</button></>
            : <><button className="btn btn-ghost btn-sm" type="button" disabled={subiendoActa} onClick={() => actaRef.current?.click()}>{subiendoActa ? 'Subiendo…' : 'Subir acta firmada (opcional)'}</button><input ref={actaRef} type="file" accept="image/*,.pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { const a = e.target.files?.[0]; if (a) subirActa(a); }} /></>}
        </div>
        {errorActa && <p className="error">{errorActa}</p>}
      </div>
      {cruceEvento && (
        <div className="alerta" role="status"><IconoCalendario /><span><strong>Hay otro evento en esa hora.</strong> El {fechaCorta(cruceEvento.dia.fecha)} se cruza con <em>{cruceEvento.pedido.codigo} · {cruceEvento.pedido.evento}</em> ({cruceEvento.dia.inicio}–{cruceEvento.dia.fin}, {cruceEvento.pedido.estado}). Revisa los cupos antes de aprobar.</span></div>
      )}

      {/* Convocatoria e inscripciones */}
      <div className="stack-2 borde-arriba">
        <div className="between"><h6 className="m-0">Convocatoria a estudiantes</h6><span className="heading">{p.multidia ? p.progreso : `${p.confirmadosN} / ${p.cantidad} confirmados`}</span></div>
        {p.multidia && <p className="muted fs-12 m-0">{p.mismosEstudiantes ? `Se necesitan ${p.cantidad} estudiantes cada día, en lo posible los mismos` : 'Distintos estudiantes cada día'}: {p.cuposDias.map((c, i) => `día ${i + 1} (${fechaCorta(c.fecha)}): ${c.confirmados}/${c.cantidad}`).join(' · ')}. Cada estudiante marca al inscribirse los días que puede; los botones D1, D2… junto a su nombre muestran y cambian sus días. Si un día ya está lleno, usa «Aceptar en D2» o agrega estudiantes sobre el cupo.</p>}
        {!p.convocadaAt && <p className="muted fs-12 m-0">Al aprobar, el sistema genera la clave del evento y el correo de convocatoria (fecha, horario, horas, actividades y vestimenta) para los {nEstudiantes} estudiantes de 1.º a 3.º con el link para inscribirse. Tú lo envías desde Outlook y confirmas quién entra.</p>}
        {p.convocadaAt && (
          <>
            <span className="tag tag-accent" style={{ justifySelf: 'start' }}>Convocatoria abierta · {fechaCorta(p.convocadaAt)} · {nEstudiantes} estudiantes</span>
            <div className="between fs-12" style={{ border: '1px solid var(--color-divider)', padding: '6px 8px' }}>
              <span><span className="muted">Clave del evento (para inscribirse):</span> <strong className="heading" style={{ fontSize: 14, letterSpacing: '.08em' }}>{p.clave ?? '—'}</strong></span>
              <button className="btn btn-ghost btn-sm" type="button" title="Cambia la clave por una aleatoria (UTE-XXXX)" onClick={() => { if (confirm('¿Cambiar la clave por una aleatoria? Los estudiantes deberán usar la nueva.')) run(() => regenerarClave(p.id)); }}>Generar otra</button>
            </div>
            {datos.notificaciones.canalEstudiantes && (
              <div className="between fs-12" style={{ border: '1px solid var(--color-divider)', padding: '6px 8px' }}>
                <span>{p.telegramPostAt ? <span className="tag tag-accent">Publicado en Telegram · {fechaCorta(p.telegramPostAt.slice(0, 10))}</span> : <span className="tag tag-outline">Sin publicar en Telegram</span>}</span>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => publicarConvocatoriaCanal(p.id))}>{p.telegramPostAt ? 'Volver a publicar' : 'Publicar en el canal'}</button>
              </div>
            )}
            <CorreoBox titulo="Correo de convocatoria" correo={correoConvocatoria(datos, p)} nota={datos.ajustes.correoGrupoEstudiantes ? undefined : 'Sin grupo de Outlook configurado: los estudiantes activos van en CCO. Puedes fijar el grupo en Resumen → Ajustes.'} />
            {p.inscritosN > 0 && (
              <>
                <div className="card-kicker">Inscritos por revisar · {p.inscritosN}</div>
                {p.inscritos.map((s) => { const llenos = diasLlenosDe(p, s.id); const sinCupo = llenos.length > 0; const todoLleno = llenos.length === diasDeEstudiante(p, s.id).length; return (
                  <div key={s.id} className="linea-item">
                    <span style={{ minWidth: 0 }}>{s.nombre} <span className="muted fs-11">{semCorto(s.semestre)} · {eventosPor(s.id)} ev.</span>{sinCupo && <> <span className="tag tag-alerta-suave" style={{ fontSize: 10 }} title={todoLleno ? 'Sus días ya tienen el cupo completo' : 'Ese día ya tiene el cupo completo: apágalo para aceptarlo en los demás'}>{p.multidia && !todoLleno ? `Sin cupo ${llenos.map((f) => `D${p.dias.findIndex((d) => d.fecha === f) + 1}`).join(', ')}` : 'Sin cupo'}</span></>}{chipsDias(s.id)}</span>
                    <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                      {(() => {
                        const fechas = p.dias.map((d) => d.fecha);
                        const mios = diasDeEstudiante(p, s.id).map((d) => d.fecha);
                        const libres = p.cuposDias.filter((c) => c.confirmados < c.cantidad).map((c) => c.fecha);
                        const objetivo = !sinCupo ? [] : todoLleno ? libres : mios.filter((f) => !llenos.includes(f));
                        if (sinCupo && p.multidia && objetivo.length) return <button className="btn btn-primary btn-sm" type="button" title="Sus días elegidos están llenos: se acepta en los días con cupo" onClick={() => runIns(() => decidirInscripcion(p.id, s.id, 'aceptar', { ajustarDias: true }))}>Aceptar en {objetivo.map((f) => `D${fechas.indexOf(f) + 1}`).join(' y ')}</button>;
                        if (sinCupo) return <button className="btn btn-secondary btn-sm" type="button" title="Todos sus días tienen el cupo completo" onClick={() => { if (confirm(`Los días de ${s.nombre} ya tienen el cupo completo. ¿Aceptarlo de todos modos, sobre el cupo pedido?`)) runIns(() => decidirInscripcion(p.id, s.id, 'aceptar', { sobrecupo: true })); }}>Aceptar sobre el cupo</button>;
                        return <button className="btn btn-primary btn-sm" type="button" onClick={() => runIns(() => decidirInscripcion(p.id, s.id, 'aceptar'))}>Aceptar</button>;
                      })()}
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => runIns(() => decidirInscripcion(p.id, s.id, 'rechazar'))}>Rechazar</button>
                    </span>
                  </div>
                ); })}
              </>
            )}
            {p.confirmadosN > 0 && (
              <>
                <div className="card-kicker">Confirmados</div>
                {p.confirmados.map((s) => (
                  <div key={s.id} className="linea-item">
                    <span>{s.nombre} <span className="muted fs-11">{semCorto(s.semestre)}</span>{chipsDias(s.id)}</span>
                    <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
                      <a className="btn btn-ghost btn-sm" href={mailtoUrl(correoEstudianteDecision(p, s, true))} title="Correo de confirmación">Correo</a>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => runIns(() => decidirInscripcion(p.id, s.id, 'quitar'))}>Quitar</button>
                    </span>
                  </div>
                ))}
              </>
            )}
            {!p.inscritosN && !p.confirmadosN && <p className="muted fs-12 m-0">Aún no hay inscripciones.</p>}
            {p.estado === 'Aprobado' && disponibles.length > 0 && (() => {
              // Coordinación siempre puede sumar estudiantes: a los días con cupo o, confirmando, sobre el cupo.
              const fechas = p.dias.map((d) => d.fecha);
              const conCupo = p.cuposDias.filter((c) => c.confirmados < c.cantidad).map((c) => c.fecha);
              // Mismos estudiantes: todos los días con cupo; distintos cada día: solo el primero con cupo (no ocupa los demás).
              const porDefecto = p.mismosEstudiantes ? conCupo : conCupo.slice(0, 1);
              const elegidos = p.multidia ? (agregarDias ?? porDefecto) : fechas;
              const llenosSel = p.multidia ? p.cuposDias.filter((c) => elegidos.includes(c.fecha) && c.confirmados >= c.cantidad) : (p.lleno ? p.cuposDias.length ? p.cuposDias : [{ fecha: p.fecha, cantidad: p.cantidad, confirmados: p.confirmadosN }] : []);
              const etiquetaDia = (f: string) => `D${fechas.indexOf(f) + 1}`;
              const confirmar = () => {
                if (p.multidia && !elegidos.length) return;
                if (llenosSel.length && !confirm(`${llenosSel.map((c) => `${p.multidia ? etiquetaDia(c.fecha) : 'El evento'} ya tiene ${c.confirmados}/${c.cantidad}`).join(' y ')}. ¿Agregar de todos modos? Quedará un estudiante sobre el cupo pedido.`)) return;
                runIns(() => confirmarDirecto(p.id, agregarId, { dias: p.multidia ? elegidos : undefined, sobrecupo: llenosSel.length > 0 }), () => { setAgregarId(''); setAgregarDias(null); });
              };
              return (
                <div className="stack-2" style={{ gap: 4 }}>
                  <div className="row" style={{ gap: 4 }}>
                    <select className="input" style={{ flex: 1, minWidth: 160 }} value={agregarId} onChange={(e) => setAgregarId(e.target.value)} aria-label="Agregar estudiante directamente">
                      <option value="">{p.lleno ? 'Agregar estudiante (sobre el cupo)…' : 'Agregar estudiante…'}</option>
                      {disponibles.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {semCorto(e.semestre)}</option>)}
                    </select>
                    <button className="btn btn-secondary btn-sm" type="button" disabled={!agregarId || (p.multidia && !elegidos.length)} onClick={confirmar}>Confirmar</button>
                  </div>
                  {p.multidia && (
                    <div className="row fs-12" style={{ gap: 4, alignItems: 'center' }} aria-label="Días del estudiante que agregas">
                      <span className="muted">Va los días:</span>
                      {p.cuposDias.map((c) => {
                        const va = elegidos.includes(c.fecha);
                        const lleno = c.confirmados >= c.cantidad;
                        return <button key={c.fecha} type="button" className={`tag ${va ? 'tag-accent' : 'tag-outline'}`} style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer' }} aria-pressed={va} title={lleno ? 'Cupo completo: se agrega sobre el cupo' : 'Con cupo'}
                          onClick={() => setAgregarDias(va ? elegidos.filter((f) => f !== c.fecha) : [...elegidos, c.fecha])}>{etiquetaDia(c.fecha)} · {c.confirmados}/{c.cantidad}</button>;
                      })}
                      {!elegidos.length ? <span className="falta">Toca el día al que va (un día lleno se suma sobre el cupo).</span> : <span className="muted">toca para cambiar</span>}
                    </div>
                  )}
                </div>
              );
            })()}
            {error && zonaError === 'inscripciones' && <p className="error m-0" role="alert">{error}</p>}
            {p.estado === 'Aprobado' && p.confirmadosN > 0 && <CorreoBox titulo="Recordatorio 24 h a confirmados" correo={correoRecordatorio(p)} />}
          </>
        )}
      </div>

      {/* Uniformes: entrega y devolución */}
      {p.vestimenta === 'uniforme' && p.convocadaAt && (
        <div className="stack-2 borde-arriba">
          <h6 className="m-0">Uniformes · entrega y devolución</h6>
          <CitaUniforme p={p} datos={datos} idPrefijo="panel-cita" />
        </div>
      )}

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
          const abierto = verCorreo === c.id;
          const verBoton = c.aviso ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => setVerCorreo(abierto ? null : c.id)}>{abierto ? 'Ocultar' : 'Ver / copiar'}</button> : null;
          return (
            <div key={c.id}>
              <div className="fs-13 between arriba">
                <div><strong>{c.materia}</strong> · {c.semLabel} · {c.cuando}<div className="muted">{c.docente ? `${c.docente.nombre} · ${c.docente.correo ?? 'sin correo (complétalo en Horarios)'}` : 'Docente sin registrar'}</div></div>
                {c.aviso?.sentAt ? (
                  <span className="row" style={{ gap: 4 }}><span className="tag tag-accent">Correo enviado · {fechaCorta(c.aviso.sentAt)}</span>{verBoton}<button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => marcarAviso(c.aviso!.id, false))}>Deshacer</button></span>
                ) : c.aviso ? (
                  <span className="row" style={{ gap: 4 }}>
                    <span className="tag tag-outline">Pendiente de envío</span>
                    <AbrirCorreo correo={correo} compacto />
                    {verBoton}
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => run(() => marcarAviso(c.aviso!.id, true))}>Marcar enviado</button>
                  </span>
                ) : (
                  <button className="btn btn-secondary btn-sm" type="button" disabled={!p.confirmadosN} title={p.confirmadosN ? '' : 'Confirma estudiantes primero'} onClick={() => run(() => crearAviso(p.id, c.id))}>Preparar correo</button>
                )}
              </div>
              {abierto && <div className="mt-2"><CorreoBox titulo={`Correo a ${c.docente?.nombre ?? 'docente'}`} correo={correo} abierto /></div>}
            </div>
          );
        })}
        {!p.cruces.length && <p className="muted fs-13 m-0">No se cruza con ninguna clase.</p>}
        {p.sinCruce.map(({ estudiante: e, motivo }) => (
          <p key={e.id} className="muted fs-12 m-0">Sin cruce · <strong>{e.nombre}</strong> ({semCorto(e.semestre)}{e.paralelo ? ` ${e.paralelo}` : ''}, {e.nrcs.length ? `${e.nrcs.length} materias por NRC` : 'sin materias por NRC'}): {motivo}.</p>
        ))}
        {p.inscritosN > 0 && <p className="muted fs-12 m-0">Los {p.inscritosN} inscrito(s) por revisar no cuentan en el cruce hasta que los confirmes.</p>}
        {p.cruces.some((c) => !c.aviso?.sentAt) && <p className="muted fs-12 m-0">Los correos a docentes se preparan automáticamente al confirmar estudiantes de ese semestre. Envíalos desde aquí o desde Horarios y márcalos como enviados.</p>}
      </div>

      {p.bloqueo && <p className="error">{p.bloqueo}</p>}
      {error && zonaError === 'general' && <p className="error" role="alert">{error}</p>}
      <div className="cols-2" style={{ gap: 'var(--space-2)' }}>
        <button className="btn btn-primary btn-40" type="button" style={{ gridColumn: '1/-1' }} disabled={!!p.bloqueo || p.estado === 'Aprobado'} onClick={() => cambiar('Aprobado')}>Aprobar y convocar estudiantes</button>
        {p.estado === 'Aprobado' && (p.finalizado
          ? <button className="btn btn-secondary btn-40" type="button" style={{ gridColumn: '1/-1' }} onClick={() => run(() => finalizarEvento(p.id, false))}>Reabrir evento (quitar fin de evento)</button>
          : <button className="btn btn-verde btn-40" type="button" style={{ gridColumn: '1/-1' }} onClick={() => { if (p.terminado || confirm(`El evento aún no termina (${p.fechaCorta}). ¿Marcarlo como finalizado de todos modos?`)) run(() => finalizarEvento(p.id, true)); }}>Fin de evento</button>)}
        <button className="btn btn-secondary" type="button" disabled={p.estado === 'Ajustes'} onClick={() => cambiar('Ajustes')}>Pedir ajustes</button>
        <button className="btn btn-secondary" type="button" disabled={p.estado === 'Rechazado'} onClick={() => { if (p.estado !== 'Aprobado' || confirm('El pedido está aprobado. ¿Rechazarlo de todos modos?')) cambiar('Rechazado'); }}>Rechazar</button>
      </div>
      <CorreoBox titulo={`Correo al solicitante · ${p.estado}`} correo={correoSolicitante(p)} />
      <div className="between borde-arriba" style={{ paddingTop: 'var(--space-2)' }}>
        <span className="muted fs-12">Pedido de prueba o duplicado: se puede borrar del todo.</span>
        <button className="btn btn-ghost btn-sm" type="button" style={{ color: 'var(--color-alerta)' }} onClick={eliminar}>Eliminar pedido</button>
      </div>
    </Marco>
  );
}
