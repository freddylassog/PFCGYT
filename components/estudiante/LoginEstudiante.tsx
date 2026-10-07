'use client';
import { useActionState, useState } from 'react';
import { loginEstudiante, registrarEstudiante } from '@/app/actions/estudiante';
import { Marco } from '@/components/Marco';

export function LoginEstudiante({ clave }: { clave: string }) {
  const [estado, accion, pendiente] = useActionState(loginEstudiante, {});
  const [reg, accionReg, pendienteReg] = useActionState(registrarEstudiante, {});
  const [registro, setRegistro] = useState(false);
  // Campos controlados: React vacía el formulario al terminar una acción y, si hubo error, el estudiante no debe volver a escribir todo.
  const [v, setV] = useState({ correo: '', clave, nombre: '', correoReg: '', claveReg: clave });
  const campo = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  if (registro) {
    return (
      <Marco as="form" action={accionReg} className="p-8 max-400 stack mt-8">
        <div>
          <div className="card-kicker">Primera vez</div>
          <h2 style={{ margin: 'var(--space-1) 0 0' }}>Regístrate con tu nombre</h2>
          <p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>La lista de la facultad no trae tu correo. Escribe tu nombre tal como aparece en la universidad (nombre y dos apellidos), tu correo institucional y la clave del evento. Es una sola vez: después entras con tu correo.</p>
        </div>
        <div className="field"><label htmlFor="nombre">Nombre completo</label><input id="nombre" name="nombre" className="input" placeholder="Nombre Apellido Apellido" autoComplete="name" required {...campo('nombre')} /></div>
        <div className="field"><label htmlFor="correo-reg">Correo institucional</label><input id="correo-reg" name="correo" className="input" type="email" placeholder="nombre.apellido@ute.edu.ec" autoComplete="email" required {...campo('correoReg')} /></div>
        <div className="field"><label htmlFor="clave-reg">Clave del evento</label><input id="clave-reg" name="clave" className="input" placeholder="SOL-2026-001" autoComplete="off" style={{ textTransform: 'uppercase' }} required {...campo('claveReg')} /></div>
        {reg?.error && <p className="error">{reg.error}</p>}
        <button className="btn btn-primary btn-block" type="submit" style={{ minHeight: 44 }} disabled={pendienteReg}>{pendienteReg ? 'Registrando…' : 'Registrarme e ingresar'}</button>
        <button className="btn btn-ghost btn-block" type="button" onClick={() => setRegistro(false)}>Ya tengo correo registrado</button>
      </Marco>
    );
  }
  return (
    <Marco as="form" action={accion} className="p-8 max-400 stack mt-8">
      <div>
        <div className="card-kicker">Acceso de estudiantes</div>
        <h2 style={{ margin: 'var(--space-1) 0 0' }}>Mis eventos</h2>
        <p className="muted fs-14" style={{ margin: 'var(--space-1) 0 0' }}>Entra desde el link del correo de convocatoria, o con tu correo institucional y la clave del evento.</p>
      </div>
      <div className="field"><label htmlFor="correo">Correo institucional</label><input id="correo" name="correo" className="input" type="email" placeholder="nombre.apellido@ute.edu.ec" autoComplete="email" required {...campo('correo')} /></div>
      <div className="field"><label htmlFor="clave">Clave del evento</label><input id="clave" name="clave" className="input" placeholder="SOL-2026-001" autoComplete="off" style={{ textTransform: 'uppercase' }} required {...campo('clave')} /></div>
      {estado?.error && <p className="error">{estado.error}</p>}
      <button className="btn btn-primary btn-block" type="submit" style={{ minHeight: 44 }} disabled={pendiente}>{pendiente ? 'Ingresando…' : 'Ingresar'}</button>
      <button className="btn btn-ghost btn-block" type="button" onClick={() => setRegistro(true)}>Primera vez: regístrate con tu nombre</button>
      <p className="muted fs-12 m-0">La clave es el código del evento (por ejemplo SOL-2026-001), llega en el correo de convocatoria y en el canal de Telegram, y vence al terminar el evento.</p>
    </Marco>
  );
}
