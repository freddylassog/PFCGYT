'use client';
import { useState } from 'react';
import { activarMensajesPersonales, desactivarMensajesPersonales, detectarCanal, detectarTelegram, guardarAjustes, nuevoPeriodo, probarCanal, probarNotificacion, crearEnlaceCalendario } from '@/app/actions/coordinacion';
import { IconoDescargar } from '@/components/Iconos';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { anticipacionVigente, DIAS_CLASE, ESTADO_PLURAL, ESTADOS_VISIBLES, fechaLarga, horarioUniformeTexto } from '@/lib/reglas';
import type { Datos } from '@/lib/tipos';
import { resumenHoras, type PedidoVista } from '@/lib/vista';

export function Resumen({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const h = resumenHoras(datos, pedidos);
  const [horas, setHoras] = useState(String(h.horasSemana));
  const a = datos.ajustes;
  const [aj, setAj] = useState({ correoDecanato: a.correoDecanato, correoGrupoEstudiantes: a.correoGrupoEstudiantes, correoCoordinacion: a.correoCoordinacion, inicioSemestre: a.inicioSemestre, uniformeLugar: a.uniformeLugar, anticipacionHoras: a.anticipacionHoras, anticipacionHasta: a.anticipacionHasta, uniformeDiasDevolucion: a.uniformeDiasDevolucion });
  // Horario fijo de uniformes: una fila por día (lunes a viernes); la casilla apaga el día.
  const [hu, setHu] = useState(() => [1, 2, 3, 4, 5].map((dia) => { const f = a.uniformeHorario.find((x) => x.dia === dia); return { dia, activo: !!f, inicio: f?.inicio ?? '', fin: f?.fin ?? '', atiende: f?.atiende ?? '' }; }));
  const huActivo = hu.filter((f) => f.activo).map(({ dia, inicio, fin, atiende }) => ({ dia, inicio, fin, atiende }));
  const setFila = (i: number, cambio: Partial<(typeof hu)[number]>) => setHu(hu.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const [np, setNp] = useState({ periodo: '', inicio: '' });
  const [prueba, setPrueba] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const base = datos.appUrl.replace(/\/$/, '');
  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt('Copia el enlace:', texto); }
  }
  const aprobados = pedidos.filter((e) => e.estado === 'Aprobado');
  const color = h.restantes < 0 ? 'var(--color-alerta)' : 'var(--color-accent)';

  return (
    <div className={pending ? 'pendiente' : ''}>
      <div className="between abajo mt-6" style={{ gap: 'var(--space-3)' }}>
        <h3 className="m-0">Resumen del semestre {a.periodo}</h3>
        <Marco as="a" className="btn btn-primary btn-40" href="/api/reporte"><IconoDescargar /> Descargar reporte del semestre (.xlsx)</Marco>
      </div>
      <Marco className="mt-4 p-4 stack-3">
        <div className="cols-auto-150">
          <div className="field" style={{ maxWidth: 160 }}><label htmlFor="hs">Horas asignadas por semana</label><input id="hs" className="input" type="number" min={0} max={80} value={horas} onChange={(e) => setHoras(e.target.value)} onBlur={() => { const n = Number(horas); if (Number.isFinite(n) && n !== h.horasSemana) run(() => guardarAjustes({ horasSemana: n })); }} /></div>
          <div><div className="card-kicker">Semestre ({h.semanas} semanas)</div><div className="num">{h.total} h</div></div>
          <div><div className="card-kicker">Registradas en eventos aprobados</div><div className="num">{h.usadas} h</div></div>
          <div><div className="card-kicker">Disponibles</div><div className="num" style={{ color }}>{h.restantes} h</div></div>
        </div>
        <div className="barra"><div style={{ width: `${h.pct}%`, background: color }} /></div>
        <p className="muted fs-12 m-0">Horas por evento = tiempo de participación solicitado (inicio a salida de los estudiantes). {h.antesDeInicio ? `El semestre inicia el ${fechaLarga(a.inicioSemestre)} (faltan ${h.diasParaInicio} días); los eventos anteriores cuentan en el total.` : `Semana ${h.semanaN} de ${h.semanas}: ${h.usadasSemana} h de ${h.horasSemana} h.`}</p>
      </Marco>
      <div className="cols-auto-140 mt-4">
        {ESTADOS_VISIBLES.map((est) => <Marco key={est} className={`p-4 ${est === 'Finalizado' ? 'marco-tipo finalizado' : ''}`}><div className="card-kicker">{ESTADO_PLURAL[est]}</div><div className="num-xl">{pedidos.filter((e) => e.estadoLabel === est).length}</div></Marco>)}
      </div>
      <Marco className="mt-6 scroll-x">
        <table className="table" style={{ minWidth: 640 }}>
          <thead><tr><th>Evento aprobado</th><th>Tipo</th><th>Fecha</th><th>Horas</th><th>Confirmados</th><th>Vestimenta</th><th>Compromisos</th><th>Novedades</th></tr></thead>
          <tbody>
            {aprobados.length === 0 && <tr><td colSpan={8} className="muted">Aún no hay eventos aprobados.</td></tr>}
            {aprobados.map((e) => <tr key={e.id}><td>{e.evento}<div className="muted fs-12">{e.institucion}</div></td><td>{e.tipoLabel}</td><td className="nowrap">{e.fechaCorta}</td><td className="nowrap">{e.horas} h</td><td>{e.progreso}</td><td>{e.vestCorta}</td><td>{e.compromisos}</td><td className="fs-12">{e.novedadesTexto}</td></tr>)}
          </tbody>
        </table>
      </Marco>

      <Marco className="mt-8 p-4 stack-3">
        <h6 className="h6-accent">Calendario en tu celular (iPhone, Google Calendar u Outlook)</h6>
        {a.calendarioToken ? (
          <>
            <p className="m-0 fs-14">Calendario privado con todos los eventos del semestre (día por día, con estado y confirmados) y las entregas y devoluciones de uniformes. Una vez agregado se actualiza solo; no hay que volver a agregarlo.</p>
            <div className="row">
              <a className="btn btn-primary btn-sm" href={`${base.replace(/^https?:\/\//, 'webcal://')}/api/calendario/${a.calendarioToken}`}>Agregar al calendario del iPhone</a>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(`${base}/api/calendario/${a.calendarioToken}`)}>{copiado ? 'Enlace copiado' : 'Copiar enlace'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm('¿Generar un enlace nuevo? El anterior dejará de funcionar y tendrás que volver a agregar el calendario.')) run(() => crearEnlaceCalendario()); }}>Generar nuevo enlace</button>
            </div>
            <p className="muted fs-12 m-0" style={{ overflowWrap: 'anywhere' }}>Enlace: {base}/api/calendario/{a.calendarioToken}</p>
            <p className="muted fs-12 m-0">En el iPhone: toca &quot;Agregar al calendario&quot; y confirma <strong>Suscribirse</strong>. Si no se abre, ve a Ajustes → Apps → Calendario → Cuentas → Añadir cuenta → Otro → <strong>Añadir calendario suscrito</strong> y pega el enlace. En Google Calendar: Otros calendarios → + → Desde URL. En Outlook: Agregar calendario → Suscribirse desde la web. El enlace es privado: quien lo tenga puede ver el calendario; &quot;Generar nuevo enlace&quot; anula el anterior.</p>
          </>
        ) : (
          <>
            <p className="m-0 fs-14 muted">Crea un enlace privado para ver los eventos y las citas de uniformes en el calendario de tu celular o computadora. Se actualiza solo.</p>
            <button type="button" className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }} onClick={() => run(() => crearEnlaceCalendario())}>Crear enlace del calendario</button>
          </>
        )}
      </Marco>

      <Marco className="mt-4 p-4 stack-3">
        <h6 className="h6-accent">Avisos de pedidos nuevos</h6>
        {datos.notificaciones.canales.length ? (
          <p className="m-0 fs-14">Cada pedido nuevo te avisa por: {datos.notificaciones.canales.map((n) => n.canal === 'correo' ? `correo a ${n.destino}` : n.destino).join(' y ')}.</p>
        ) : (
          <p className="m-0 fs-14 muted">Sin avisos configurados. Para recibir un correo o un mensaje de Telegram cuando entre un pedido, agrega las variables en Vercel (ver README, sección Avisos).</p>
        )}
        {datos.notificaciones.telegramSinChat && (
          <p className="aviso-info m-0 fs-13">Telegram casi listo: abre tu bot en Telegram, pulsa <strong>Iniciar</strong>, escríbele &quot;hola&quot; y luego pulsa <strong>Detectar mi chat de Telegram</strong>.</p>
        )}
        <div className="row">
          {(datos.notificaciones.telegramSinChat || datos.notificaciones.canales.some((n) => n.canal === 'telegram')) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => detectarTelegram(), (d) => setPrueba(`Chat de Telegram detectado: ${d?.nombre}. Ahora pulsa "Enviar prueba".`)); }}>Detectar mi chat de Telegram</button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => probarNotificacion(), () => setPrueba('Prueba enviada. Revisa tu bandeja o Telegram (en el correo, la carpeta de spam la primera vez).')); }}>Enviar prueba</button>
          {prueba && <span className="fs-13" style={{ color: 'var(--color-accent-800)' }}>{prueba}</span>}
        </div>
      </Marco>
      {(datos.notificaciones.canalEstudiantes || datos.notificaciones.telegramSinCanal) && (
        <Marco className="mt-4 p-4 stack-3">
          <h6 className="h6-accent">Canal de Telegram para estudiantes</h6>
          {datos.notificaciones.canalEstudiantes ? (
            <p className="m-0 fs-14">Canal conectado: <strong>{datos.notificaciones.canalEstudiantes}</strong>. Al aprobar un pedido, la convocatoria se publica ahí automáticamente; cada día a las 18:00 se publica el recordatorio de los eventos de mañana.</p>
          ) : (
            <p className="aviso-info m-0 fs-13">Crea un canal en Telegram, agrega tu bot como administrador (con permiso de publicar), escribe cualquier mensaje en el canal y pulsa <strong>Detectar canal de estudiantes</strong>. Luego comparte el enlace de invitación del canal con los estudiantes.</p>
          )}
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => detectarCanal(), (d) => setPrueba(`Canal detectado: ${d?.nombre}. Pulsa "Probar canal" para publicar un mensaje de prueba.`)); }}>Detectar canal de estudiantes</button>
            {datos.notificaciones.canalEstudiantes && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => probarCanal(), () => setPrueba('Mensaje de prueba publicado en el canal.')); }}>Probar canal</button>}
          </div>
        </Marco>
      )}
      {(datos.notificaciones.canalEstudiantes || datos.notificaciones.telegramSinCanal || datos.notificaciones.botUsername) && (
        <Marco className="mt-4 p-4 stack-3">
          <h6 className="h6-accent">Mensajes personales del bot a cada estudiante</h6>
          {datos.notificaciones.botUsername ? (
            <p className="m-0 fs-14">Activos con <strong>@{datos.notificaciones.botUsername}</strong>. Cada estudiante abre el bot, pulsa Iniciar y escribe su correo institucional; desde entonces recibe en su celular la confirmación de cada inscripción, el aviso si no fue confirmado y el recordatorio el día anterior. En la pestaña Estudiantes se ve quién ya lo hizo.</p>
          ) : (
            <p className="m-0 fs-14 muted">Inactivos. Al activarlos, el bot podrá recibir mensajes de los estudiantes (para vincular su correo) y enviarles confirmaciones y recordatorios personales.</p>
          )}
          <div className="row">
            {datos.notificaciones.botUsername
              ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm('¿Desactivar los mensajes personales? Los estudiantes dejarán de recibir avisos en su celular.')) run(() => desactivarMensajesPersonales()); }}>Desactivar</button>
              : <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => activarMensajesPersonales(), (d) => setPrueba(`Mensajes personales activos con @${d?.bot}. Pide a los estudiantes que abran el bot y escriban su correo.`)); }}>Activar mensajes personales</button>}
            {datos.notificaciones.botUsername && <a className="btn btn-secondary btn-sm" href={`https://t.me/${datos.notificaciones.botUsername}`} target="_blank" rel="noopener">Abrir el bot</a>}
          </div>
        </Marco>
      )}
      <div className="cols-auto mt-4">
        <Marco as="form" className="p-4 stack-3" onSubmit={(e: React.FormEvent) => { e.preventDefault(); run(() => guardarAjustes({ ...aj, uniformeHorario: huActivo })); }}>
          <h6 className="h6-accent">Ajustes del periodo {a.periodo}</h6>
          <div className="field"><label>Inicio del semestre (lunes de la semana 1)</label><input className="input" type="date" value={aj.inicioSemestre} onChange={(e) => setAj({ ...aj, inicioSemestre: e.target.value })} /><div className="muted fs-12 mt-2">{fechaLarga(aj.inicioSemestre)}</div></div>
          <div className="field"><label>Correo de decanato (reporte de novedades)</label><input className="input" type="email" value={aj.correoDecanato} onChange={(e) => setAj({ ...aj, correoDecanato: e.target.value })} placeholder="decanato.fcgt@ute.edu.ec" /></div>
          <div className="field"><label>Grupo de Outlook de estudiantes (convocatorias)</label><input className="input" type="email" value={aj.correoGrupoEstudiantes} onChange={(e) => setAj({ ...aj, correoGrupoEstudiantes: e.target.value })} placeholder="protocolo.estudiantes@ute.edu.ec" /><div className="muted fs-12 mt-2">Si lo dejas vacío, el correo de convocatoria pone a todos los estudiantes activos en copia oculta.</div></div>
          <div className="field"><label>Correo de coordinación (para copia)</label><input className="input" type="email" value={aj.correoCoordinacion} onChange={(e) => setAj({ ...aj, correoCoordinacion: e.target.value })} /></div>
          <div className="field"><label>Horario de retiro y devolución de uniformes (todo el periodo)</label>
            <div className="stack-2">
              {hu.map((f, i) => (
                <div key={f.dia} className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <label className="radio fs-13" style={{ minWidth: 104 }}><input id={`hu-${f.dia}-activo`} type="checkbox" checked={f.activo} onChange={(e) => setFila(i, { activo: e.target.checked })} /><span className="dot cuadro" />{DIAS_CLASE[f.dia]}</label>
                  <input id={`hu-${f.dia}-inicio`} className="input" type="time" aria-label={`${DIAS_CLASE[f.dia]} · desde`} style={{ width: 112 }} value={f.inicio} disabled={!f.activo} onChange={(e) => setFila(i, { inicio: e.target.value })} />
                  <span className="muted fs-12">a</span>
                  <input id={`hu-${f.dia}-fin`} className="input" type="time" aria-label={`${DIAS_CLASE[f.dia]} · hasta`} style={{ width: 112 }} value={f.fin} disabled={!f.activo} onChange={(e) => setFila(i, { fin: e.target.value })} />
                  <input id={`hu-${f.dia}-atiende`} className="input" aria-label={`${DIAS_CLASE[f.dia]} · quién atiende`} style={{ flex: 1, minWidth: 150 }} placeholder="Quién atiende" value={f.atiende} disabled={!f.activo} onChange={(e) => setFila(i, { atiende: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="muted fs-12 mt-2">{huActivo.length ? <>Los estudiantes verán: <strong>{horarioUniformeTexto(huActivo)}</strong>. Franjas de 2 horas, fijas todo el semestre; también salen en tu calendario suscrito.</> : 'Sin horario fijo: cada evento necesita su propia entrega y devolución (pestaña Uniformes).'}</div>
          </div>
          <div className="field"><label>Lugar de retiro y devolución de uniformes</label><input className="input" value={aj.uniformeLugar} onChange={(e) => setAj({ ...aj, uniformeLugar: e.target.value })} placeholder="ej. Oficina de coordinación de protocolo" /><div className="muted fs-12 mt-2">Se muestra junto al horario y se propone al fijar una entrega especial por evento.</div></div>
          <div className="field" style={{ maxWidth: 260 }}><label htmlFor="dias-dev">Plazo para devolver el uniforme (días después del evento)</label><input id="dias-dev" className="input" type="number" min={1} max={60} value={aj.uniformeDiasDevolucion} onChange={(e) => setAj({ ...aj, uniformeDiasDevolucion: Number(e.target.value) })} /><div className="muted fs-12 mt-2">Cuenta desde el último día de cada estudiante en el evento. El bot recuerda el día después del evento, 2 días antes, el día del plazo y al vencer; a ti te llega la lista de vencidos.</div></div>
          <div className="cols-2">
            <div className="field"><label>Anticipación mínima de los pedidos (horas)</label><input className="input" type="number" min={1} max={720} value={aj.anticipacionHoras} onChange={(e) => setAj({ ...aj, anticipacionHoras: Number(e.target.value) })} /></div>
            <div className="field"><label>Esa anticipación vale hasta (opcional)</label><input className="input" type="date" value={aj.anticipacionHasta} onChange={(e) => setAj({ ...aj, anticipacionHasta: e.target.value })} /></div>
          </div>
          <p className="muted fs-12 m-0">Regla normal: 72 horas (3 días). Para una excepción temporal, pon por ejemplo 24 y la fecha del último día en que aplica; pasado ese día la app vuelve sola a 72 horas. Hoy rige: <strong>{anticipacionVigente(aj, datos.hoy)} h</strong>.</p>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" type="submit" style={{ justifySelf: 'start' }}>Guardar ajustes</button>
        </Marco>
        <Marco as="form" className="p-4 stack-3" style={{ alignContent: 'start' }} onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (confirm(`¿Iniciar el periodo ${np.periodo}? El periodo ${a.periodo} queda guardado para reportes y el nuevo empieza sin pedidos ni estudiantes.`)) run(() => nuevoPeriodo(np.periodo, np.inicio), () => setNp({ periodo: '', inicio: '' })); }}>
          <h6 className="h6-accent">Nuevo semestre</h6>
          <p className="muted fs-13 m-0">Al cerrar el semestre, crea el siguiente periodo. Los pedidos, estudiantes y reportes de {a.periodo} quedan guardados; luego cargas el nuevo listado de estudiantes y los horarios.</p>
          <div className="cols-2">
            <div className="field"><label>Periodo</label><input className="input" value={np.periodo} onChange={(e) => setNp({ ...np, periodo: e.target.value })} placeholder="2027-1" pattern="\\d{4}-[12]" /></div>
            <div className="field"><label>Inicio (lunes)</label><input className="input" type="date" value={np.inicio} onChange={(e) => setNp({ ...np, inicio: e.target.value })} /></div>
          </div>
          <button className="btn btn-secondary" type="submit" disabled={!np.periodo || !np.inicio} style={{ justifySelf: 'start' }}>Iniciar periodo</button>
        </Marco>
      </div>
    </div>
  );
}
