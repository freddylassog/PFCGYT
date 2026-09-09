'use client';
import { useActionState } from 'react';
import { loginEstudiante } from '@/app/actions/estudiante';
import { Marco } from '@/components/Marco';

export function LoginEstudiante({ clave }: { clave: string }) {
  const [estado, accion, pendiente] = useActionState(loginEstudiante, {});
  return (
    <Marco as="form" action={accion} className="p-8 max-400 stack mt-8">
      <div>
        <div className="card-kicker">Acceso de estudiantes</div>
        <h2 style={{ margin: 'var(--space-1) 0 0' }}>Mis eventos</h2>
        <p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Entra desde el link del correo de convocatoria, o con tu correo institucional y la clave del evento.</p>
      </div>
      <div className="field"><label htmlFor="correo">Correo institucional</label><input id="correo" name="correo" className="input" type="email" placeholder="nombre.apellido@ute.edu.ec" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="clave">Clave del evento</label><input id="clave" name="clave" className="input" defaultValue={clave} placeholder="SOL-2026-001" autoComplete="off" style={{ textTransform: 'uppercase' }} required /></div>
      {estado?.error && <p className="error">{estado.error}</p>}
      <button className="btn btn-primary btn-block" type="submit" style={{ minHeight: 44 }} disabled={pendiente}>{pendiente ? 'Ingresando…' : 'Ingresar'}</button>
      <p className="muted fs-12 m-0">La clave es el código del evento (por ejemplo SOL-2026-001), llega en el correo de convocatoria y vence al terminar el evento.</p>
    </Marco>
  );
}
