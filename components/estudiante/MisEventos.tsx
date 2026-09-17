'use client';
import { inscribirme, retirarme } from '@/app/actions/estudiante';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { MINIMO_EVENTOS, citaDevolucionTexto, citaEntregaTexto, infoUniforme, semLabel } from '@/lib/reglas';
import type { Datos, Estudiante } from '@/lib/tipos';
import { avanceEstudiante, vistaPedidos } from '@/lib/vista';

export function MisEventos({ datos, yo }: { datos: Datos; yo: Estudiante }) {
  const { pending, error, run } = useAccion();
  const pedidos = vistaPedidos(datos);
  const avance = avanceEstudiante(datos, yo.id, pedidos);
  const uni = infoUniforme(yo.genero, datos.prendas.filter((p) => p.studentId === yo.id).map((p) => p.item));
  const dev = datos.devoluciones.find((d) => d.studentId === yo.id) ?? null;
  const devTexto = dev?.estado === 'lavado' ? 'Uniforme devuelto y recibido lavado.' : dev?.estado === 'rechazado' ? 'Tu uniforme no fue recibido porque llegó sin lavar. Debes volver a entregarlo lavado.' : 'Al final del semestre devuelve el uniforme lavado; si no está lavado no se recibe.';
  const misEventos = avance.eventos;
  const convocatorias = pedidos.filter((e) => e.estado === 'Aprobado' && !e.finalizado && e.convocadaAt && e.ultimaFecha >= datos.hoy && !e.confirmados.some((c) => c.id === yo.id)).map((e) => {
    const insc = datos.inscripciones.find((i) => i.requestId === e.id && i.studentId === yo.id);
    const inscrito = insc?.estado === 'inscrito', rechazado = insc?.estado === 'rechazado';
    const fem = yo.genero === 'F';
    return {
      ...e, inscrito, rechazado, puedo: !inscrito && !rechazado && !e.lleno,
      miEstado: inscrito ? (fem ? 'Inscrita · por confirmar' : 'Inscrito · por confirmar') : rechazado ? 'No confirmada' : e.lleno ? 'Cupos completos' : 'Abierta',
      miTag: inscrito ? 'tag-outline' : rechazado || e.lleno ? 'tag-neutral' : 'tag-accent',
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
        <p className="muted fs-12 m-0">{devTexto}</p>
      </Marco>
      {datos.notificaciones.botUsername && (
        <Marco className="mt-4 max-720 p-4 stack-2">
          <div className="between"><h6 className="m-0">Avisos en tu celular</h6>{yo.telegramChatId ? <span className="tag tag-accent">Telegram conectado</span> : <span className="tag tag-outline">Sin conectar</span>}</div>
          {yo.telegramChatId
            ? <p className="muted fs-12 m-0">Recibirás por Telegram la confirmación de cada inscripción y un recordatorio el día antes de cada evento.</p>
            : <p className="fs-13 m-0">Abre <a href={`https://t.me/${datos.notificaciones.botUsername}`} target="_blank" rel="noopener">@{datos.notificaciones.botUsername}</a> en Telegram, pulsa <strong>Iniciar</strong> y escribe tu correo institucional ({yo.correo}). Desde entonces te llegarán tus confirmaciones y recordatorios al celular.</p>}
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
                <div className="muted fs-13">{e.fechaLarga} · {e.horarioTexto} · {e.horas} h · {e.vestLabel} · {e.confirmadosN}/{e.cantidad} cupos confirmados</div>
                <div className="row" style={{ gap: 4 }}>{e.actividadesEtiquetas.map((a) => <span key={a} className="tag tag-neutral">{a}</span>)}</div>
                {e.puedo && <button className="btn btn-primary btn-40" type="button" style={{ justifySelf: 'start' }} onClick={() => run(() => inscribirme(e.id))}>Inscribirme</button>}
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
              <div><div className="etiqueta">Tu horario</div>{e.horarioTexto} · {e.duracion}</div>
              <div><div className="etiqueta">Lugar</div>{e.lugar}</div>
              <div><div className="etiqueta">Responsable en sitio</div>{e.responsable}{e.responsableTelefono && <div className="muted fs-12">{e.responsableTelefono}</div>}</div>
              <div><div className="etiqueta">Vestimenta</div>{e.vestLabel}<div className="muted fs-12">{e.vestNotaEst}</div></div>
              {e.vestimenta === 'uniforme' && citaEntregaTexto(e.uniformeCita) && <div><div className="etiqueta">Entrega del uniforme</div>{citaEntregaTexto(e.uniformeCita)}{e.uniformeCita?.lugar && <div className="muted fs-12">{e.uniformeCita.lugar}</div>}</div>}
              {e.vestimenta === 'uniforme' && citaDevolucionTexto(e.uniformeCita) && <div><div className="etiqueta">Devolución del uniforme (lavado)</div>{citaDevolucionTexto(e.uniformeCita)}{e.uniformeCita?.lugar && <div className="muted fs-12">{e.uniformeCita.lugar}</div>}</div>}
            </div>
            <div><div className="etiqueta" style={{ marginBottom: 4 }}>Actividades del evento</div><div className="row" style={{ gap: 4 }}>{e.actividadesEtiquetas.map((a) => <span key={a} className="tag tag-neutral">{a}</span>)}</div></div>
          </Marco>
        ))}
      </div>
    </div>
  );
}
