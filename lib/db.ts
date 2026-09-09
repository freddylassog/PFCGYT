import 'server-only';
import postgres, { type Sql } from 'postgres';

declare global {
  var __protocoloSql: Sql | undefined;
}

/** Conexión a Postgres (Supabase). Se crea una sola vez por proceso. */
export function db(): Sql {
  if (!globalThis.__protocoloSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta la variable DATABASE_URL (cadena de conexión de Supabase).');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalThis.__protocoloSql = postgres(url, {
      ssl: local ? false : 'require',
      max: 3,
      prepare: false,        // requerido por el pooler de Supabase (modo transacción)
      idle_timeout: 20,
      connect_timeout: 15,
      types: {
        // Las fechas llegan como texto 'YYYY-MM-DD' (sin conversión a Date/zonas horarias)
        date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      },
    });
  }
  return globalThis.__protocoloSql;
}
