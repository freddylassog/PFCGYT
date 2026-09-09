'use client';
import { useState } from 'react';
import { mailtoUrl, textoCorreo, type Correo } from '@/lib/correos';
import { IconoCopiar, IconoCorreo } from './Iconos';

/** Muestra un correo generado con botones para abrirlo en Outlook o copiarlo.
 *  La app no envía correos: coordinación los manda desde su cuenta. */
export function CorreoBox({
  correo, titulo, abierto = false, extra, nota,
}: { correo: Correo; titulo: string; abierto?: boolean; extra?: React.ReactNode; nota?: string }) {
  const [ver, setVer] = useState(abierto);
  const [copiado, setCopiado] = useState<string | null>(null);

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
        <a className="btn btn-primary btn-sm" href={mailtoUrl(correo)}><IconoCorreo /> Abrir en Outlook</a>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(textoCorreo(correo), 'todo')}><IconoCopiar /> {copiado === 'todo' ? 'Copiado' : 'Copiar texto'}</button>
        {correo.cco?.length ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copiar(correo.cco!.join('; '), 'cco')}>{copiado === 'cco' ? 'Copiado' : 'Copiar destinatarios'}</button>
        ) : null}
        {extra}
      </div>
      {sinDestino && <p className="muted fs-12 m-0">Sin destinatario configurado: agrega el correo en Outlook antes de enviar.</p>}
      {nota && <p className="muted fs-12 m-0">{nota}</p>}
    </div>
  );
}
