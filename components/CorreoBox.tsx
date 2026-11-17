'use client';
import { useState } from 'react';
import { FORMAS_OUTLOOK, mailtoUrl, outlookWebUrl, type Correo, type FormaOutlook } from '@/lib/correos';
import { usePreferencia } from './usePreferencia';

const CLAVES_FORMA = FORMAS_OUTLOOK.map((f) => f.clave);
import { IconoCopiar, IconoCorreo } from './Iconos';

const AVISO_COPIADO = 'Texto del correo copiado. Si Outlook te pide escoger la cuenta y abre sin el correo, vuelve aquí y pulsa el botón otra vez (con la sesión ya abierta sí lo llena), o crea un correo nuevo y pega con Ctrl+V.';

/** Botones para abrir un correo en Outlook (programa del equipo y Outlook web). Al pulsarlos se copia también el texto,
 *  porque si Microsoft pide escoger la cuenta, Outlook pierde el borrador y abre vacío. */
export function AbrirCorreo({ correo, compacto = false }: { correo: Correo; compacto?: boolean }) {
  const [aviso, setAviso] = useState(false);
  const [forma] = usePreferencia<FormaOutlook>('pf_outlook', 'office', CLAVES_FORMA);
  const copiarAlAbrir = () => {
    try {
      navigator.clipboard.writeText(correo.cuerpo).then(() => { setAviso(true); setTimeout(() => setAviso(false), 12000); }).catch(() => {});
    } catch { /* sin portapapeles: el enlace igual se abre */ }
  };
  const web = <a key="web" className="btn btn-secondary btn-sm" href={outlookWebUrl(correo, forma)} target="_blank" rel="noreferrer" onClick={copiarAlAbrir} title="Redactar en outlook.office.com con la cuenta institucional del navegador">Outlook web</a>;
  const programa = compacto
    ? <a key="programa" className="btn btn-ghost btn-sm" href={mailtoUrl(correo)} onClick={copiarAlAbrir} title="Abrir en el programa de correo del equipo">Abrir correo</a>
    : <a key="programa" className="btn btn-primary btn-sm" href={mailtoUrl(correo)} onClick={copiarAlAbrir}><IconoCorreo /> Abrir en Outlook</a>;
  return (
    <>
      {compacto ? [web, programa] : [programa, web]}
      {aviso && <span className="fs-12" role="status" style={{ color: 'var(--color-accent-800)', flexBasis: '100%' }}>{AVISO_COPIADO}</span>}
    </>
  );
}

/** Muestra un correo generado con botones para abrirlo en Outlook o copiarlo por partes.
 *  La app no envía correos: coordinación los manda desde su cuenta. */
export function CorreoBox({
  correo, titulo, abierto = false, extra, nota,
}: { correo: Correo; titulo: string; abierto?: boolean; extra?: React.ReactNode; nota?: string }) {
  const [ver, setVer] = useState(abierto);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [forma, elegirForma] = usePreferencia<FormaOutlook>('pf_outlook', 'office', CLAVES_FORMA);

  async function copiar(texto: string, que: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(que);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt('Copia el texto:', texto);
    }
  }

  const sinDestino = !correo.para.length && !correo.cco?.length;
  return (
    <div className="correo">
      <div className="between">
        <strong className="heading" style={{ fontSize: 14 }}>{titulo}</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Ver correo'}</button>
      </div>
      {ver && (
        <>
          <div className="cab">
            <span><strong>Para:</strong> {correo.para.join(', ') || (correo.cco?.length ? '(destinatarios en CCO)' : '— escribe el destinatario en Outlook')}</span>
            {correo.cco?.length ? <span><strong>CCO:</strong> {correo.cco.length} destinatario(s)</span> : null}
            <span><strong>Asunto:</strong> {correo.asunto}</span>
          </div>
          <pre>{correo.cuerpo}</pre>
        </>
      )}
      <div className="row">
        <AbrirCorreo correo={correo} />
        {correo.para.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(correo.para.join('; '), 'para')}><IconoCopiar /> {copiado === 'para' ? 'Copiado' : 'Copiar destinatario'}</button>}
        {correo.cco?.length ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(correo.cco!.join('; '), 'cco')}><IconoCopiar /> {copiado === 'cco' ? 'Copiado' : 'Copiar destinatarios (CCO)'}</button>
        ) : null}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(correo.asunto, 'asunto')}><IconoCopiar /> {copiado === 'asunto' ? 'Copiado' : 'Copiar asunto'}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(correo.cuerpo, 'todo')}><IconoCopiar /> {copiado === 'todo' ? 'Copiado' : 'Copiar texto'}</button>
        {extra}
      </div>
      {sinDestino && <p className="muted fs-12 m-0">Sin destinatario configurado: agrega el correo en Outlook antes de enviar.</p>}
      <details className="fs-12">
        <summary style={{ cursor: 'pointer' }}>¿Outlook pide escoger la cuenta y abre sin el correo? Prueba otra forma</summary>
        <div className="stack-2 mt-2">
          <p className="muted m-0">Abre cada forma con este correo. Si una llega con el destinatario, el asunto y el texto, pulsa «Usar siempre esta»: desde entonces el botón «Outlook web» la usa en este navegador.</p>
          {FORMAS_OUTLOOK.map((f) => (
            <div key={f.clave} className="row" style={{ gap: 6, alignItems: 'center' }}>
              <a className="btn btn-ghost btn-sm" href={outlookWebUrl(correo, f.clave)} target="_blank" rel="noreferrer">Abrir {f.label}</a>
              {forma === f.clave ? <span className="tag tag-verde" style={{ fontSize: 10 }}>en uso</span> : <button type="button" className="btn btn-secondary btn-sm" onClick={() => elegirForma(f.clave)}>Usar siempre esta</button>}
            </div>
          ))}
          <p className="muted m-0">Si ninguna llega llena: arma el correo con «Copiar destinatario», «Copiar asunto» y «Copiar texto» (al abrir Outlook el texto ya queda copiado).</p>
        </div>
      </details>
      {nota && <p className="muted fs-12 m-0">{nota}</p>}
    </div>
  );
}
