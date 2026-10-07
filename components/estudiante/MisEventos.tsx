'use client';
import { useState } from 'react';
import { inscribirme, retirarme } from '@/app/actions/estudiante';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { citaDevolucionTexto, citaEntregaTexto, fechaCorta, fechaLarga, horarioTextoDias, horarioUniformeTexto, horasDias, infoUniforme, MINIMO_EVENTOS, redondear1, semLabel } from '@/lib/reglas';
import { actividadesDeEstudiante, diasDeEstudiante, estadoDevolucionDe, limiteDevolucionDe } from '@/lib/vista';
import type { Datos, Estudiante } from '@/lib/tipos';
import { avanceEstudiante, vistaPedidos } from '@/lib/vista';

export function MisEventos({ datos, yo }: { datos: Datos; yo: Estudiante }) {
  const { pending, error, run } = useAccion();
  const pedidos = vistaPedidos(datos);
  const avance = avanceEstudiante(datos, yo.id, pedidos);
  const uni = infoUniforme(yo.genero, datos.prendas.filter((p) => p.studentId === yo.id).map((p) => p.item));
  const misEventos = avance.eventos;
  // Devoluciones pendientes (por evento, con plazo).
  const misDevoluciones = misEventos.filter((e) => e.vestimenta === 'uniforme').map((e) => ({ e, estado: estadoDevolucionDe(e, yo.id, datos.hoy), limite: limiteDevolucionDe(e, yo.id) }));
  const porDevolver = misDevoluciones.filter((x) => x.estado.clave === 'pendiente' || x.estado.clave === 'vencido' || x.estado.clave === 'rechazado');
  const devAlerta = porDevolver.some((x) => x.estado.clave !== 'pendiente');
  const devTexto = porDevolver.length
    ? `Por devolver (lavado): ${porDevolver.map((x) => `${x.e.evento} hasta el ${fechaCorta(x.limite)}${x.estado.clave === 'vencido' ? ' (plazo vencido)' : x.estado.clave === 'rechazado' ? ' (llegó sin lavar: vuelve a entregarlo lavado)' : ''}`).join(' · ')}.`
    : `Después de cada evento tienes ${datos.ajustes.uniformeDiasDevolucion} días para devolver el uniforme lavado; si no está lavado no se recibe.`;
  const horarioFijo = datos.ajustes.uniformeHorario.length ? `${horarioUniformeTexto(datos.ajustes.uniformeHorario)}${datos.ajustes.uniformeLugar ? ` · ${datos.ajustes.uniformeLugar}` : ''}` : '';
  const [diasElegidos, setDiasElegidos] = useState<Record<string, string[]>>({});
  /** Fechas de un evento que aún tienen cupo (los días llenos quedan bloqueados). */
  const conCupo = (e: { cuposDias: { fecha: string; cantidad: number; confirmados: number }[] }) => e.cuposDias.filter((c) => c.confirmados < c.cantidad).map((c) => c.fecha);
  const convocatorias = pedidos.filter((e) => e.estado === 'Aprobado' && !e.finalizado && e.convocadaAt && e.ultimaFecha >= datos.hoy && !e.confirmados.some((c) => c.id === yo.id)).map((e) => {
    const insc = datos.inscripciones.find((i) => i.requestId === e.id && i.studentId === yo.id);
    const inscrito = insc?.estado === 'inscrito', rechazado = insc?.estado === 'rechazado';
    const fem = yo.genero === 'F';
    return {
      ...e, inscrito, rechazado, puedo: !inscrito && !rechazado && !e.lleno,
      miEstado: inscrito ? (fem ? 'Inscrita · por confirmar' : 'Inscrito · por confirmar') : rechazado ? 'No confirmada' : e.lleno ? 'Cupos completos' : 'Abierta',
      miTag: inscrito ? 'tag-outline' : rechazado ? 'tag-alerta' : e.lleno ? 'tag-neutral' : 'tag-accent',
    };
  });

  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="between abajo mt-8 max-720" style={{ gap: 'var(--space-3)' }}>
        <div><h1 className="m-0">Mis eventos</h1><p className="muted" style={{ margin: 'var(--space-1) 0 0' }}>{yo.nombre} · {semLabel(yo.semestre)} · mínimo {MINIMO_EVENTOS} eventos en el semestre</p></div>
        <div style={{ textAlign: 'right' }}><div className="card-kicker">Mi avance</div><div className="num">{avance.eventosN} / {MINIMO_EVENTOS} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>eventos · {avance.horas} h</span></div></div>
      </div>
      <Marco className="mt-6 max-720 p-4 stack-2">
        <div className="between"><h6 className="m-0">Mi uniforme</h6><span className={`tag ${uni.tagClass}`}>{uni.estado}</span></div>
        <div className="row" style={{ gap: 6 }}>{uni.items.map((l) => <span key={l} className={`tag ${uni.tiene.includes(l) ? 'tag-accent' : 'tag-outline'}`}>{l}{uni.tiene.includes(l) ? '' : ' · pendiente'}</span>)}</div>
        <p className={`fs-12 m-0 ${devAlerta ? 'falta' : 'muted'}`}>{devTexto}</p>
        {horarioFijo && <p className="fs-12 m-0"><strong>Retiro y devolución:</strong> {horarioFijo}. Retira el uniforme antes de cada evento y devuélvelo lavado después, en cualquiera de esas franjas.</p>}
      </Marco>
      {datos.notificaciones.botUsername && (
        <Marco className="mt-4 max-720 p-4 stack-2">
          <div className="between"><h6 className="m-0">Avisos en tu celular</h6>{yo.telegramChatId ? <span className="tag tag-accent">Telegram conectado</span> : <span className="tag tag-outline">Sin conectar</span>}</div>
          {yo.telegramChatId
            ? <p className="muted fs-12 m-0">Recibirás por Telegram la confirmación de cada inscripción y un recordatorio el día antes de cada evento.</p>
            : <p className="fs-13 m-0">Abre <a href={`https://t.me/${datos.notificaciones.botUsername}`} target="_blank" rel="noopener">@{datos.notificaciones.botUsername}</a> en Telegram, pulsa <strong>Iniciar</strong> y escribe tu nombre completo o tu correo institucional{yo.correo ? ` (${yo.correo})` : ''}. Desde entonces te llegarán tus confirmaciones, recordatorios y avisos de uniforme al celular.</p>}
        </Marco>
      )}
      {error && <p className="error mt-4 max-720">{error}</p>}
      {convocatorias.length > 0 && (
        <>
          <div className="mt-6 max-720"><h3 className="m-0">Convocatorias abiertas</h3><p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Inscríbete; coordinación confirma quién entra.</p></div>
          <div className="stack-3 mt-3 max-720">
            {convocatorias.map((e) => (
              <Marco key={e.id} className="p-4 stack-2">
                <div className="between arriba"><div><div className="card-kicker">{e.tipoLabel} · {e.institucion}</div><h4 style={{ margin: '2px 0 0' }}>{e.evento}</h4></div><span className={`tag ${e.miTag}`}>{e.miEstado}</span></div>
                <div className="muted fs-13">{e.fechaLarga} · {e.horarioTexto} · {e.horas} h · {e.vestLabel} · {e.multidia ? `cupos por día: ${e.cuposDias.map((c, i) => `día ${i + 1}: ${c.confirmados}/${c.cantidad}`).join(' · ')}` : `${e.confirmadosN}/${e.cantidad} cupos confirmados`}</div>
                <div className="row" style={{ gap: 4 }}>{e.actividadesEtiquetas.map((a) => <span key={a} className="tag tag-neutral">{a}</span>)}</div>
                {e.puedo && e.multidia && (
                  <div className="stack-2">
                    <div className="row" style={{ gap: 'var(--space-3)' }}>
                      <span className="fs-13">Puedo asistir:</span>
                      {e.dias.map((d, i) => { const cupo = e.cuposDias[i]; const llenoDia = !!cupo && cupo.confirmados >= cupo.cantidad; const sel = !llenoDia && (diasElegidos[e.id] ?? conCupo(e)).includes(d.fecha); return (
                        <label key={d.fecha} className="radio fs-13" style={llenoDia ? { opacity: 0.55 } : undefined}><input type="checkbox" checked={sel} disabled={llenoDia} onChange={() => setDiasElegidos((m) => { const act = m[e.id] ?? conCupo(e); return { ...m, [e.id]: sel ? act.filter((f) => f !== d.fecha) : [...act, d.fecha] }; })} /><span className="dot cuadro" />Día {i + 1} · {fechaCorta(d.fecha)} ({d.inicio}–{d.fin}){llenoDia ? ' · cupos completos' : ''}</label>
                      ); })}
                    </div>
                    <p className="muted fs-12 m-0">{e.mismosEstudiantes ? `El organizador prefiere que vayan los mismos ${e.cantidad} estudiantes los ${e.dias.length} días. Si solo puedes uno, marca solo ese día.` : 'Marca solo los días que puedes asistir.'}</p>
                  </div>
                )}
                {e.puedo && <button className="btn btn-primary btn-40" type="button" style={{ justifySelf: 'start' }} disabled={e.multidia && (diasElegidos[e.id] ?? conCupo(e)).length === 0} onClick={() => { const sel = e.multidia ? (diasElegidos[e.id] ?? conCupo(e)) : null; run(() => inscribirme(e.id, sel && sel.length < e.dias.length ? sel : null)); }}>Inscribirme</button>}
                {e.inscrito && <button className="btn btn-ghost" type="button" style={{ justifySelf: 'start' }} onClick={() => run(() => retirarme(e.id))}>Retirar inscripción</button>}
              </Marco>
            ))}
          </div>
        </>
      )}
      <div className="mt-6 max-720"><h3 className="m-0">Eventos confirmados</h3></div>
      <div className="stack mt-3 max-720">
        {!misEventos.length && <p className="muted m-0">Aún no tienes eventos confirmados.</p>}
        {misEventos.map((e) => (
          <Marco key={e.id} className="p-6 stack-3">
            <div className="between arriba"><div><div className="card-kicker">{e.tipoLabel} · {e.institucion}</div><h3 style={{ margin: '2px 0 0' }}>{e.evento}</h3></div><span className={`tag ${e.finalizado ? 'tag-verde' : 'tag-accent'}`}>{e.finalizado ? 'Finalizado' : 'Confirmado'} · {e.horas} h</span></div>
            <div className="fs-14" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
              <div><div className="etiqueta">Fecha</div>{e.fechaLarga}</div>
              <div><div className="etiqueta">Tu horario</div>{e.multidia ? <>{horarioTextoDias(diasDeEstudiante(e, yo.id))} · {redondear1(horasDias(diasDeEstudiante(e, yo.id)))} h<div className="muted fs-12">Tus días: {diasDeEstudiante(e, yo.id).map((d) => fechaCorta(d.fecha)).join(', ')}</div></> : <>{e.horarioTexto} · {e.duracion}</>}</div>
              <div><div className="etiqueta">Lugar</div>{e.mismoLugar ? e.lugar : e.dias.map((d, i) => <div key={d.fecha}>Día {i + 1}: {d.lugar || e.lugar}</div>)}</div>
              <div><div className="etiqueta">Responsable en sitio</div>{e.responsable}{e.responsableTelefono && <div className="muted fs-12">{e.responsableTelefono}</div>}</div>
              <div><div className="etiqueta">Vestimenta</div>{e.vestLabel}<div className="muted fs-12">{e.vestNotaEst}</div></div>
              {(e.comidas > 0 || e.transporteTexto) && <div><div className="etiqueta">Alimentación y transporte</div>{e.comidas > 0 ? `${e.comidas} ${e.comidas > 1 ? 'alimentaciones' : 'alimentación'}` : 'Sin alimentación'}{e.transporteTexto ? ` · transporte: ${e.transporteTexto.toLowerCase()}` : ''}<div className="muted fs-12">A cargo del organizador.</div></div>}
              {e.vestimenta === 'uniforme' && (citaEntregaTexto(e.uniformeCita) ? <div><div className="etiqueta">Entrega del uniforme</div>{citaEntregaTexto(e.uniformeCita)}{e.uniformeCita?.lugar && <div className="muted fs-12">{e.uniformeCita.lugar}</div>}</div> : horarioFijo ? <div><div className="etiqueta">Retiro del uniforme</div>{horarioFijo}<div className="muted fs-12">Antes del evento.</div></div> : null)}
              {e.vestimenta === 'uniforme' && (() => { const dv = estadoDevolucionDe(e, yo.id, datos.hoy); return <div><div className="etiqueta">Devolución del uniforme (lavado)</div>{citaDevolucionTexto(e.uniformeCita) ?? `Hasta el ${fechaLarga(limiteDevolucionDe(e, yo.id))}`}<div className={`fs-12 ${dv.clave === 'vencido' || dv.clave === 'rechazado' ? 'falta' : 'muted'}`}>{dv.clave === 'en-curso' ? (e.uniformeCita?.lugar || e.devolucionDondeTexto || `${e.devolucionDias} días después del evento`) : dv.label}</div></div>; })()}
            </div>
            <div><div className="etiqueta" style={{ marginBottom: 4 }}>{e.repartoPorDia ? 'Tus actividades' : 'Actividades del evento'}</div><div className="row" style={{ gap: 4 }}>{(e.repartoPorDia ? actividadesDeEstudiante(e, yo.id) : e.actividadesEtiquetas).map((a) => <span key={a} className="tag tag-neutral">{a}</span>)}</div></div>
          </Marco>
        ))}
      </div>
    </div>
  );
}
