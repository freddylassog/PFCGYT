#!/bin/sh
# Levanta Postgres local (puerto 5433) y el servidor de desarrollo si no están corriendo.
PGBIN=/usr/lib/postgresql/16/bin; PGDATA=/tmp/pgdata
if ! psql -h 127.0.0.1 -p 5433 -U postgres -tc "select 1" >/dev/null 2>&1; then
  if [ ! -d "$PGDATA/base" ]; then rm -rf "$PGDATA"; mkdir -p "$PGDATA"; chown nobody "$PGDATA"; su nobody -s /bin/sh -c "$PGBIN/initdb -D $PGDATA -U postgres --auth=trust -E UTF8 --locale=C.UTF-8" >/dev/null 2>&1; fi
  rm -f "$PGDATA/postmaster.pid"; su nobody -s /bin/sh -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5433 -k /tmp' -l $PGDATA/log start" >/dev/null 2>&1; sleep 2
  psql -h 127.0.0.1 -p 5433 -U postgres -tc "select 1 from pg_database where datname='protocolo'" | grep -q 1 || psql -h 127.0.0.1 -p 5433 -U postgres -qc "create database protocolo"
fi
for f in supabase/migrations/*.sql; do psql -h 127.0.0.1 -p 5433 -U postgres -d protocolo -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -v NOTICE; done
psql -h 127.0.0.1 -p 5433 -U postgres -d protocolo -qc "update settings set inicio_semestre='2026-10-05'"
if ! curl -s -o /dev/null http://localhost:3000/; then
  (npm run dev -- -p 3000 > /tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/dev.log 2>&1 &)
  for i in 1 2 3 4 5 6 7 8 9 10; do sleep 2; curl -s -o /dev/null http://localhost:3000/ && break; done
fi
echo "postgres: $(psql -h 127.0.0.1 -p 5433 -U postgres -tc 'select 1' 2>/dev/null | tr -d ' ') · web: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
