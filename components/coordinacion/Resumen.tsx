'use client';
import { useState } from 'react';
import { detectarCanal, detectarTelegram, guardarAjustes, nuevoPeriodo, probarCanal, probarNotificacion } from '@/app/actions/coordinacion';
import { IconoDescargar } from '@/components/Iconos';
import { Marco } from '@/components/Marco';
import { useAccion } from '@/components/useAccion';
import { ESTADOS, fechaLarga } from '@/lib/reglas';
import type { Datos } from '@/lib/tipos';
import { resumenHoras, type PedidoVista } from '@/lib/vista';

export function Resumen({ datos, pedidos }: { datos: Datos; pedidos: PedidoVista[] }) {
  const { pending, error, run } = useAccion();
  const h = resumenHoras(datos, pedidos);
  const [horas, setHoras] = useState(String(h.horasSemana));
  const a = datos.ajustes;
  const [aj, setAj] = useState({ correoDecanato: a.correoDecanato, correoGrupoEstudiantes: a.correoGrupoEstudiantes, correoCoordinacion: a.correoCoordinacion, inicioSemestre: a.inicioSemestre });
  const [np, setNp] = useState({ periodo: '', inicio: '' });
  const [prueba, setPrueba] = useState<string | null>(null);
  const aprobados = pedidos.filter((e) => e.estado === 'Aprobado');
  const color = h.restantes < 0 ? 'var(--color-accent-900)' : 'var(--color-accent)';

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
        {ESTADOS.map((est) => <Marco key={est} className="p-4"><div className="card-kicker">{est}s</div><div className="num-xl">{pedidos.filter((e) => e.estado === est).length}</div></Marco>)}
      </div>
      <Marco className="mt-6 scroll-x">
        <table className="table" style={{ minWidth: 640 }}>
          <thead><tr><th>Evento aprobado</th><th>Tipo</th><th>Fecha</th><th>Horas</th><th>Confirmados</th><th>Vestimenta</th><th>Compromisos</th><th>Novedades</th></tr></thead>
          <tbody>
            {aprobados.length === 0 && <tr><td colSpan={8} className="muted">Aún no hay eventos aprobados.</td></tr>}
            {aprobados.map((e) => <tr key={e.id}><td>{e.evento}<div className="muted fs-12">{e.institucion}</div></td><td>{e.tipoLabel}</td><td className="nowrap">{e.fechaCorta}</td><td className="nowrap">{e.horas} h</td><td>{e.confirmadosN}/{e.cantidad}</td><td>{e.vestCorta}</td><td>{e.compromisos}</td><td className="fs-12">{e.novedadesTexto}</td></tr>)}
          </tbody>
        </table>
      </Marco>

      <Marco className="mt-8 p-4 stack-3">
        <h6 className="h6-accent">Avisos de pedidos nuevos</h6>
        {datos.notificaciones.canales.length ? (
          <p className="m-0 fs-14">Cada pedido nuevo te avisa por: {datos.notificaciones.canales.map((n) => n.canal === 'correo' ? `correo a ${n.destino}` : n.destino).join(' y ')}.</p>
        ) : (
          <p className="m-0 fs-14 muted">Sin avisos configurados. Para recibir un correo o un mensaje de Telegram cuando entre un pedido, agrega las variables en Vercel (ver README, sección Avisos).</p>
        )}
        {datos.notificaciones.telegramSinChat && (
          <p className="aviso m-0 fs-13">Telegram casi listo: abre tu bot en Telegram, pulsa <strong>Iniciar</strong>, escríbele &quot;hola&quot; y luego pulsa <strong>Detectar mi chat de Telegram</strong>.</p>
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
            <p className="aviso m-0 fs-13">Crea un canal en Telegram, agrega tu bot como administrador (con permiso de publicar), escribe cualquier mensaje en el canal y pulsa <strong>Detectar canal de estudiantes</strong>. Luego comparte el enlace de invitación del canal con los estudiantes.</p>
          )}
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => detectarCanal(), (d) => setPrueba(`Canal detectado: ${d?.nombre}. Pulsa "Probar canal" para publicar un mensaje de prueba.`)); }}>Detectar canal de estudiantes</button>
            {datos.notificaciones.canalEstudiantes && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPrueba(null); run(() => probarCanal(), () => setPrueba('Mensaje de prueba publicado en el canal.')); }}>Probar canal</button>}
          </div>
        </Marco>
      )}
      <div className="cols-auto mt-4">
        <Marco as="form" className="p-4 stack-3" onSubmit={(e: React.FormEvent) => { e.preventDefault(); run(() => guardarAjustes(aj)); }}>
          <h6 className="h6-accent">Ajustes del periodo {a.periodo}</h6>
          <div className="field"><label>Inicio del semestre (lunes de la semana 1)</label><input className="input" type="date" value={aj.inicioSemestre} onChange={(e) => setAj({ ...aj, inicioSemestre: e.target.value })} /><div className="muted fs-12 mt-2">{fechaLarga(aj.inicioSemestre)}</div></div>
          <div className="field"><label>Correo de decanato (reporte de novedades)</label><input className="input" type="email" value={aj.correoDecanato} onChange={(e) => setAj({ ...aj, correoDecanato: e.target.value })} placeholder="decanato.fcgt@ute.edu.ec" /></div>
          <div className="field"><label>Grupo de Outlook de estudiantes (convocatorias)</label><input className="input" type="email" value={aj.correoGrupoEstudiantes} onChange={(e) => setAj({ ...aj, correoGrupoEstudiantes: e.target.value })} placeholder="protocolo.estudiantes@ute.edu.ec" /><div className="muted fs-12 mt-2">Si lo dejas vacío, el correo de convocatoria pone a todos los estudiantes activos en copia oculta.</div></div>
          <div className="field"><label>Correo de coordinación (para copia)</label><input className="input" type="email" value={aj.correoCoordinacion} onChange={(e) => setAj({ ...aj, correoCoordinacion: e.target.value })} /></div>
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
