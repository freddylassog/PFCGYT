'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { crearPedido, prepararEvidencia, verificarCruce, type CruceInfo, type PedidoCreado } from '@/app/actions/pedidos';
import { Marco } from '@/components/Marco';
import { IconoAlerta, IconoCalendario, IconoInfo } from '@/components/Iconos';
import { EditorDias } from '@/components/EditorDias';
import {
  ACTIVIDADES, BLOQUEAR_CRUCE_EVENTOS, FORM_INICIAL, MAX_ESTUDIANTES, VESTIMENTA, cumple72h, duracionTextoDias, esFechaISO, esHora, faltasPedido, fechaCorta, fechaLarga,
  fechaLargaDias, horarioTextoDias, ordenarDias, pasa4hDias, plazoTexto, primerDia, transporteMotivoDias, type FormPedido,
} from '@/lib/reglas';

const PASOS = ['Solicitante', 'Evento', 'Estudiantes', 'Compromisos'];

export function FormularioPedido({ hoy }: { hoy: string }) {
  const [f, setF] = useState<FormPedido>(FORM_INICIAL);
  const [paso, setPaso] = useState(1);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [cruce, setCruce] = useState<CruceInfo | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<PedidoCreado | null>(null);
  const [enviando, startEnvio] = useTransition();
  const archivoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormPedido>(k: K, v: FormPedido[K]) => setF((s) => ({ ...s, [k]: v }));

  // Verifica cruces con otros pedidos cuando cambian los días u horarios.
  const diasClave = JSON.stringify(f.dias);
  const horarioCompleto = f.dias.length > 0 && f.dias.every((d) => esFechaISO(d.fecha) && esHora(d.inicio) && esHora(d.fin));
  useEffect(() => {
    if (!horarioCompleto) return;
    let vivo = true;
    const dias = JSON.parse(diasClave) as FormPedido['dias'];
    const t = setTimeout(() => { verificarCruce(dias).then((c) => { if (vivo) setCruce(c); }).catch(() => {}); }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [horarioCompleto, diasClave]);

  const cruceActual = horarioCompleto ? cruce : null;
  const faltas = faltasPedido(f, hoy, cruceActual);
  const noPuedeEnviar = faltas.some((x) => x.length);
  const durTexto = duracionTextoDias(f.dias);
  const p4 = pasa4hDias(f.dias);
  const tm = transporteMotivoDias(f);
  const primero = primerDia(f.dias);
  const error72 = !!primero?.fecha && esFechaISO(primero.fecha) && !cumple72h(primero.fecha, hoy);

  async function subirEvidencia(archivo: File) {
    setErrorArchivo(null);
    setSubiendo(true);
    set('evidenciaPath', ''); set('evidenciaNombre', '');
    try {
      const prep = await prepararEvidencia(archivo.name, archivo.type, archivo.size);
      if (!prep.ok || !prep.datos) throw new Error(prep.error || 'No se pudo preparar la subida.');
      const resp = await fetch(prep.datos.url, {
        method: 'PUT',
        headers: { 'content-type': archivo.type || 'application/octet-stream', 'x-upsert': 'false' },
        body: archivo,
      });
      if (!resp.ok) throw new Error('La subida falló (' + resp.status + '). Intenta de nuevo.');
      setF((s) => ({ ...s, evidenciaPath: prep.datos!.path, evidenciaNombre: archivo.name }));
    } catch (e) {
      setErrorArchivo((e as Error).message);
      if (archivoRef.current) archivoRef.current.value = '';
    } finally {
      setSubiendo(false);
    }
  }

  function siguiente() { if (!faltas[paso - 1].length) setPaso((p) => Math.min(4, p + 1)); }
  function anterior() { setPaso((p) => Math.max(1, p - 1)); }

  function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (noPuedeEnviar) return;
    setErrorEnvio(null);
    startEnvio(async () => {
      const r = await crearPedido(f);
      if (r.ok && r.datos) { setEnviado(r.datos); setPaso(1); window.scrollTo({ top: 0 }); }
      else setErrorEnvio(r.error || 'No se pudo registrar el pedido.');
    });
  }

  function nuevoPedido() {
    setF({ ...FORM_INICIAL, dias: FORM_INICIAL.dias.map((d) => ({ ...d })), nombre: f.nombre, cargo: f.cargo, institucion: f.institucion, correoSolicitante: f.correoSolicitante, tipo: f.tipo, convenio: f.convenio });
    setEnviado(null); setCruce(null); setPaso(1);
  }

  if (enviado) {
    return (
      <Marco as="section" className="mt-8 p-8 max-640" style={{ marginInline: 'auto' }}>
        <div className="card-kicker">Pedido registrado</div>
        <h2 className="mt-2">{enviado.codigo}</h2>
        <p>{enviado.evento} · {enviado.fechaLarga} · {enviado.horario}</p>
        <p className="muted fs-14">Anota este código. La coordinación de protocolo revisará el pedido y te responderá al correo indicado. El pedido queda <strong>pendiente</strong> hasta la revisión de la facultad.</p>
        <div className="row mt-4">
          <button className="btn btn-primary" type="button" onClick={nuevoPedido}>Nuevo pedido</button>
          <Link className="btn btn-secondary" href={`/coordinacion?sel=${enviado.id}`}>Ver en el panel</Link>
        </div>
      </Marco>
    );
  }

  const resumenTipo = f.tipo === 'interno' ? 'Interno' : f.convenio === 'si' ? 'Externo · convenio vigente' : 'Externo · sin convenio';

  return (
    <div className="stack-6 mt-8">
      <div className="max-640">
        <h1 className="m-0">Pedido formal de apoyo protocolario</h1>
        <p className="muted mt-2 fs-14">Fecha del pedido: <strong style={{ color: 'var(--color-text)' }}>{fechaLarga(hoy)}</strong></p>
      </div>
      <form onSubmit={enviar} className="stack max-640" noValidate>
        <ol className="stepper" aria-label="Pasos">
          {PASOS.map((label, i) => {
            const n = i + 1, ok = !faltas[i].length, actual = n === paso, prevOk = faltas.slice(0, i).every((x) => !x.length);
            const estado = actual ? 'En curso' : ok ? 'Completo' : prevOk ? 'Pendiente' : '—';
            return (
              <li key={label}>
                <button type="button" onClick={() => setPaso(n)} disabled={!prevOk} className={`${actual ? 'actual' : ''} ${ok ? 'ok' : ''} ${actual || ok || prevOk ? '' : 'apagado'}`} aria-current={actual ? 'step' : undefined}>
                  <span className="paso-nombre">0{n} · {label}</span>
                  <span className="muted fs-11">{estado}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {paso === 1 && (
          <Marco as="section" className="p-6 stack">
            <h6 className="h6-accent">01 · Solicitante</h6>
            <div className="field"><label htmlFor="nombre">Nombre completo</label><input id="nombre" className="input" value={f.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Nombre y apellido" autoComplete="name" /></div>
            <div className="cols-2">
              <div className="field"><label htmlFor="cargo">Cargo</label><input id="cargo" className="input" value={f.cargo} onChange={(e) => set('cargo', e.target.value)} /></div>
              <div className="field"><label htmlFor="institucion">Institución</label><input id="institucion" className="input" value={f.institucion} onChange={(e) => set('institucion', e.target.value)} /></div>
            </div>
            <div className="field"><label htmlFor="correo">Correo de contacto</label><input id="correo" className="input" type="email" value={f.correoSolicitante} onChange={(e) => set('correoSolicitante', e.target.value)} placeholder="nombre@institucion.com" autoComplete="email" /></div>
            <div className="field">
              <label>Tipo de evento</label>
              <div className="cols-2">
                <button type="button" className={`btn btn-toggle ${f.tipo === 'interno' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={f.tipo === 'interno'} onClick={() => set('tipo', 'interno')}><span>Interno</span><small>Universidad UTE</small></button>
                <button type="button" className={`btn btn-toggle ${f.tipo === 'externo' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={f.tipo === 'externo'} onClick={() => set('tipo', 'externo')}><span>Externo</span><small>Embajada o empresa · aprobado por Cancillería</small></button>
              </div>
            </div>
            {f.tipo === 'externo' && (
              <>
                <div className="field">
                  <label>¿Existe convenio vigente con la UTE?</label>
                  <div className="seg">
                    <label className="seg-opt"><input type="radio" name="conv" checked={f.convenio === 'si'} onChange={() => set('convenio', 'si')} />Sí, vigente</label>
                    <label className="seg-opt"><input type="radio" name="conv" checked={f.convenio === 'no'} onChange={() => set('convenio', 'no')} />No / no sé</label>
                  </div>
                </div>
                {f.convenio === 'no' && (
                  <div className="aviso"><IconoInfo /><span>Sin convenio vigente el pedido se registra <strong>para revisión</strong>. La coordinación verificará el convenio antes de aprobar.</span></div>
                )}
              </>
            )}
            {faltas[0].length > 0 && <p className="muted fs-12 m-0">Falta: {faltas[0].join(', ')}</p>}
            <button className="btn btn-primary btn-40" type="button" onClick={siguiente} disabled={faltas[0].length > 0} style={{ justifySelf: 'end' }}>Continuar</button>
          </Marco>
        )}

        {paso === 2 && (
          <Marco as="section" className="p-6 stack">
            <h6 className="h6-accent">02 · Evento</h6>
            <div className="field"><label htmlFor="evento">Nombre del evento</label><input id="evento" className="input" value={f.evento} onChange={(e) => set('evento', e.target.value)} /></div>
            <div className="field">
              <label>Evidencia del pedido (correo o pedido formal · imagen o PDF)</label>
              <div className="row">
                <label className={`btn btn-secondary ${subiendo ? 'pendiente' : ''}`} style={{ cursor: 'pointer' }}>
                  {subiendo ? 'Subiendo…' : 'Adjuntar archivo'}
                  <input ref={archivoRef} type="file" accept="image/*,.pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => { const a = e.target.files?.[0]; if (a) subirEvidencia(a); }} />
                </label>
                {f.evidenciaNombre ? <span className="tag tag-accent tag-ellipsis">{f.evidenciaNombre}</span> : !subiendo && <span className="muted fs-12">Ningún archivo adjunto</span>}
              </div>
              {errorArchivo && <p className="error mt-2">{errorArchivo}</p>}
            </div>
            <div className="field">
              <label>Días y horarios de participación de los estudiantes</label>
              <EditorDias dias={f.dias} onChange={(d) => set('dias', d)} min={hoy} idPrefijo="dia" />
            </div>
            <p className="muted fs-12 m-0">Plazo: <strong style={{ color: 'var(--color-text)' }}>{primero?.fecha ? plazoTexto(primero.fecha, hoy) : 'Elige la fecha'}</strong> · Duración: <strong style={{ color: 'var(--color-text)' }}>{durTexto}</strong>.</p>
            {error72 && (
              <div className="alerta" role="alert"><IconoAlerta /><span><strong>No se puede registrar el pedido.</strong> El evento está a menos de 72 horas. Los pedidos deben ingresar con al menos 3 días de anticipación.</span></div>
            )}
            {cruceActual && (
              <div className="alerta" role="alert"><IconoCalendario /><span><strong>Horario ocupado.</strong> Ya hay un evento en esa hora el {fechaCorta(cruceActual.fecha)}: se cruza con <em>{cruceActual.evento}</em> ({cruceActual.inicio}–{cruceActual.fin}, {cruceActual.estado}). {BLOQUEAR_CRUCE_EVENTOS ? 'No se puede registrar otro evento en esa hora: elige otro horario el mismo día u otra fecha.' : 'Puedes continuar; la coordinación revisará el cruce antes de aprobar.'}</span></div>
            )}
            <div className="field"><label htmlFor="lugar">Lugar y dirección</label><input id="lugar" className="input" value={f.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="Salón, edificio, calle" /></div>
            <label className="radio fs-13"><input type="checkbox" checked={f.lejos} onChange={(e) => set('lejos', e.target.checked)} /><span className="dot cuadro" />El lugar está fuera del campus / lejos</label>
            <div className="field">
              <label>Responsable en sitio durante el evento (contacto para coordinar)</label>
              <div className="cols-2">
                <input id="responsable" className="input" value={f.responsable} onChange={(e) => set('responsable', e.target.value)} placeholder="Nombre" aria-label="Nombre del responsable" autoComplete="off" />
                <input id="telefono" className="input" type="tel" value={f.responsableTelefono} onChange={(e) => set('responsableTelefono', e.target.value)} placeholder="Teléfono (ej. 099 123 4567)" aria-label="Teléfono del responsable" autoComplete="off" />
              </div>
            </div>
            {faltas[1].length > 0 && <p className="muted fs-12 m-0">Falta: {faltas[1].join(', ')}</p>}
            <div className="between"><button className="btn btn-secondary" type="button" onClick={anterior}>Atrás</button><button className="btn btn-primary btn-40" type="button" onClick={siguiente} disabled={faltas[1].length > 0}>Continuar</button></div>
          </Marco>
        )}

        {paso === 3 && (
          <Marco as="section" className="p-6 stack">
            <h6 className="h6-accent">03 · Estudiantes</h6>
            <div className="field" style={{ maxWidth: 180 }}><label htmlFor="cantidad">Número de estudiantes</label><input id="cantidad" className="input" type="number" min={1} max={MAX_ESTUDIANTES} value={f.cantidad} onChange={(e) => set('cantidad', Math.max(1, Math.min(MAX_ESTUDIANTES, Number(e.target.value) || 1)))} /></div>
            <div className="field">
              <label>Actividades protocolarias que realizarán</label>
              <div className="stack-2">
                {ACTIVIDADES.map((a) => (
                  <label key={a} className="radio linea fs-14"><input type="checkbox" checked={f.actividades.includes(a)} onChange={() => set('actividades', f.actividades.includes(a) ? f.actividades.filter((x) => x !== a) : [...f.actividades, a])} /><span className="dot cuadro" />{a}</label>
                ))}
              </div>
            </div>
            <p className="muted fs-12 m-0">Los estudiantes no pueden realizar actividades fuera de las marcadas.</p>
            <div className="field">
              <label>Vestimenta de los estudiantes</label>
              <div className="stack-2">
                {(Object.keys(VESTIMENTA) as (keyof typeof VESTIMENTA)[]).map((k) => (
                  <label key={k} className="radio linea arriba fs-14"><input type="radio" name="vest" checked={f.vestimenta === k} onChange={() => set('vestimenta', k)} /><span className="dot" /><span>{VESTIMENTA[k].label}<div className="muted fs-12">{VESTIMENTA[k].nota}</div></span></label>
                ))}
              </div>
            </div>
            {faltas[2].length > 0 && <p className="muted fs-12 m-0">Falta: {faltas[2].join(', ')}</p>}
            <div className="between"><button className="btn btn-secondary" type="button" onClick={anterior}>Atrás</button><button className="btn btn-primary btn-40" type="button" onClick={siguiente} disabled={faltas[2].length > 0}>Continuar</button></div>
          </Marco>
        )}

        {paso === 4 && (
          <Marco as="section" className="p-6 stack">
            <h6 className="h6-accent">04 · Compromisos del organizador</h6>
            <dl className="dl" style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
              <dt className="muted">Evento</dt><dd>{f.evento} · {resumenTipo}</dd>
              <dt className="muted">Fecha</dt><dd>{fechaLargaDias(f.dias)} · {horarioTextoDias(ordenarDias(f.dias))} ({durTexto})</dd>
              <dt className="muted">Estudiantes</dt><dd>{f.cantidad} · {f.actividades.join(', ')}</dd>
              <dt className="muted">Vestimenta</dt><dd>{VESTIMENTA[f.vestimenta].label}</dd>
              <dt className="muted">Lugar</dt><dd>{f.lugar}</dd>
              <dt className="muted">Responsable</dt><dd>{f.responsable} · {f.responsableTelefono}</dd>
              <dt className="muted">Evidencia</dt><dd>{f.evidenciaNombre}</dd>
            </dl>
            <div className="stack-3 fs-14">
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}><span className={`tag ${p4 ? 'tag-solid' : 'tag-neutral'}`} style={{ flex: 'none' }}>Alimentación</span><span>Pasadas las <strong>4 horas</strong> de participación el organizador debe contemplar la alimentación de los estudiantes.{p4 && <> <strong style={{ color: 'var(--color-accent-700)' }}>Aplica a este pedido ({durTexto}).</strong></>}</span></div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}><span className={`tag ${tm ? 'tag-solid' : 'tag-neutral'}`} style={{ flex: 'none' }}>Transporte</span><span>Si el evento termina después de las <strong>18:00</strong> o el lugar es lejano, el organizador debe garantizar el transporte de regreso de cada estudiante hasta su casa, por seguridad.{tm && <> <strong style={{ color: 'var(--color-accent-700)' }}>Aplica a este pedido.</strong></>}</span></div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}><span className="tag tag-neutral" style={{ flex: 'none' }}>Actividades</span><span>Los estudiantes realizan únicamente las actividades marcadas y se retiran a la hora de salida indicada, aunque el evento continúe.</span></div>
            </div>
            <label className="radio arriba fs-14"><input type="checkbox" checked={f.acepta} onChange={(e) => set('acepta', e.target.checked)} /><span className="dot cuadro" />Acepto estos compromisos en nombre de la organización del evento.</label>
            {errorEnvio && <p className="error">{errorEnvio}</p>}
            <div className="between">
              <button className="btn btn-secondary" type="button" onClick={anterior}>Atrás</button>
              <Marco as="button" className="btn btn-primary btn-lg" type="submit" disabled={noPuedeEnviar || enviando}>{enviando ? 'Registrando…' : 'Registrar pedido'}</Marco>
            </div>
          </Marco>
        )}
      </form>
    </div>
  );
}
