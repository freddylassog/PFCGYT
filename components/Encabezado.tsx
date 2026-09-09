import { sesionCoordinacion, sesionEstudiante } from '@/lib/sesion';
import { salir } from '@/app/actions/sesion';
import { NavLinks } from './NavLinks';

export async function Encabezado() {
  const [coord, est] = await Promise.all([sesionCoordinacion(), sesionEstudiante()]);
  return (
    <header className="nav">
      <div className="nav-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-fcgt.png" alt="UTE · Facultad de Ciencias Gastronómicas y Turismo" className="logo" width={316} height={154} />
        <span className="titulo">
          <span className="kicker-verde">Coordinación</span>
          <span>Protocolo de eventos</span>
        </span>
      </div>
      <nav className="nav-links" aria-label="Secciones">
        <NavLinks coord={!!coord} est={!!est} />
        {(coord || est) && (
          <form action={salir}>
            <button className="btn btn-ghost" type="submit" style={{ fontSize: 13 }}>Cerrar sesión</button>
          </form>
        )}
      </nav>
    </header>
  );
}
