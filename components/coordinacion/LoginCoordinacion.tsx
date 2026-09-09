'use client';
import { useActionState } from 'react';
import { loginCoordinacion } from '@/app/actions/coordinacion';
import { Marco } from '@/components/Marco';

export function LoginCoordinacion({ destino }: { destino: string }) {
  const [estado, accion, pendiente] = useActionState(loginCoordinacion, {});
  return (
    <Marco as="form" action={accion} className="p-8 max-400 stack mt-8">
      <div>
        <div className="card-kicker">Acceso restringido</div>
        <h2 style={{ margin: 'var(--space-1) 0 0' }}>Coordinación de protocolo</h2>
        <p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Solo personal autorizado: coordinación y decanato.</p>
      </div>
      <input type="hidden" name="destino" value={destino} />
      <div className="field"><label htmlFor="usuario">Usuario</label><input id="usuario" name="usuario" className="input" autoComplete="username" defaultValue="coordinacion" required /></div>
      <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" className="input" type="password" autoComplete="current-password" required /></div>
      {estado?.error && <p className="error">{estado.error}</p>}
      <button className="btn btn-primary btn-block" type="submit" style={{ minHeight: 44 }} disabled={pendiente}>{pendiente ? 'Ingresando…' : 'Ingresar'}</button>
    </Marco>
  );
}
