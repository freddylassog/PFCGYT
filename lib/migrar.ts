import 'server-only';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db';

// La app aplica sola los archivos de supabase/migrations/ que falten en la
// base de datos (tabla schema_migrations). Así coordinación nunca tiene que
// pegar SQL a mano: al publicar una versión nueva, la base se actualiza al
// primer uso. Los archivos son idempotentes y se aplican en orden alfabético.

let enCurso: Promise<void> | null = null;

export function asegurarEsquema(): Promise<void> {
  if (!enCurso) enCurso = migrar().catch((e) => { enCurso = null; throw e; });
  return enCurso;
}

async function migrar(): Promise<void> {
  const sql = db();
  await sql`create table if not exists schema_migrations (nombre text primary key, aplicada_at timestamptz not null default now())`;
  // Como todas las tablas: con seguridad por filas y sin políticas, para que la API pública de Supabase no la exponga.
  await sql`alter table schema_migrations enable row level security`;
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'supabase', 'migrations');
  const archivos = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const aplicadas = new Set((await sql`select nombre from schema_migrations`).map((r) => String(r.nombre)));
  const pendientes = archivos.filter((f) => !aplicadas.has(f));
  if (!pendientes.length) return;
  await sql.begin(async (tx) => {
    // Un solo proceso migra a la vez (varias instancias pueden arrancar juntas).
    await tx`select pg_advisory_xact_lock(4242)`;
    const ya = new Set((await tx`select nombre from schema_migrations`).map((r) => String(r.nombre)));
    for (const f of pendientes) {
      if (ya.has(f)) continue;
      const texto = await readFile(path.join(dir, f), 'utf8');
      await tx.unsafe(texto);
      await tx`insert into schema_migrations (nombre) values (${f})`;
      console.log(`[migraciones] aplicada ${f}`);
    }
  });
}
