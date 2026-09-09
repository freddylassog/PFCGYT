# Protocolo de eventos · FCGT · Universidad UTE

Aplicación web (computadora y celular) para gestionar los **pedidos de apoyo protocolario** de la Facultad de Ciencias Gastronómicas y Turismo: pedido formal, revisión de coordinación, convocatoria a estudiantes con clave por evento, control de horas, uniformes, novedades para decanato y reporte del semestre en Excel.

Costo mensual: **$0** (Supabase + Vercel en sus planes gratuitos).

## Cómo funciona

| Quién | Qué hace | Cómo entra |
|---|---|---|
| **Solicitante** (interno UTE o externo) | Llena el pedido de 4 pasos y adjunta la evidencia (correo o pedido formal). | Enlace público, sin clave. |
| **Coordinación** | Revisa, aprueba, convoca, confirma estudiantes, registra novedades y uniformes, descarga el reporte. | `/coordinacion` con usuario y contraseña. |
| **Estudiante** | Se inscribe a convocatorias, ve sus eventos confirmados y su uniforme. | `/estudiante` con su correo institucional y la **clave del evento** (su código, p. ej. `SOL-2026-003`). |

### Correos: la app no los envía, los prepara

No se necesita acceso de TI ni servicios de correo. En cada punto donde hace falta un correo (convocatoria, aviso a docentes por cruce de clases, matriz al docente, reporte a decanato, confirmación al estudiante, respuesta al solicitante, recordatorio 24 h) la app muestra el correo listo con dos botones:

- **Abrir en Outlook**: abre Outlook con destinatarios, asunto y texto ya escritos.
- **Copiar texto**: para pegarlo donde prefieras.

Coordinación lo envía desde su propia cuenta y luego marca **"Marcar como enviado"** para que quede registrado. Para las convocatorias, en *Resumen → Ajustes* se puede fijar el **grupo de Outlook de estudiantes**; si no hay grupo, el correo pone a todos los estudiantes activos en copia oculta (y hay un botón para copiar la lista).

### Reglas implementadas (en el navegador y en el servidor)

1. **72 horas**: no se registra un pedido a menos de 3 días.
2. **Cruce de horarios entre eventos**: si ya hay un evento (no rechazado) en esa fecha y hora se muestra el aviso *"Horario ocupado. Ya hay un evento en esa hora…"* y **no se puede registrar el pedido**. Sí se permite otro horario el mismo día. (Para que solo avise sin bloquear, cambia `BLOQUEAR_CRUCE_EVENTOS` a `false` en `lib/reglas.ts`.)
3. **Externo sin convenio**: se registra para revisión, pero no se puede aprobar hasta marcar el convenio como vigente.
4. **Alimentación** si la participación pasa de 4 h; **transporte** si termina después de las 18:00 o el lugar es lejano.
5. **Horas por evento** = salida − inicio (1 decimal). Presupuesto del semestre = horas por semana × 16 semanas.
6. Estudiantes de 1.º a 3.º; **mínimo 2 eventos** confirmados. La app **no pone notas**: solo muestra el texto de la regla y permite enviar la matriz de cada semestre al docente correspondiente (Lenguaje, Investigación y Cultura Gastronómica, fijas en la base de datos; el docente se toma del horario cargado).
7. **Cruce con clases**: clases del mismo día de la semana que chocan con el horario del evento, filtradas a los semestres de los estudiantes confirmados. Al confirmar a un estudiante se prepara el correo al docente automáticamente.
8. **Clave por evento**: es el **código del evento** (`SOL-2026-003`), fácil de recordar porque aparece en todos los correos y pantallas. Se asigna al aprobar y deja de servir al terminar el evento. No es secreta: solo sirve para que el estudiante se inscriba (además debe estar en el listado activo). Si hace falta, *"Generar otra"* la reemplaza por una aleatoria `UTE-XXXX`.
9. Las novedades solo se registran para estudiantes confirmados; una vez reportadas a decanato quedan bloqueadas.
10. Devolución del uniforme: solo se acepta **lavado**; si no, queda como *"No recibido · sin lavar"*.

## Puesta en marcha (una sola vez, ~40 minutos)

### 1. Supabase (base de datos y archivos)

1. Entra a [supabase.com](https://supabase.com) → **New project** → nombre `protocolo-fcgt`, región *South America (São Paulo)*. Guarda la contraseña de la base de datos: **usa solo letras y números** (sin símbolos).
2. Cuando cargue el proyecto, abre **SQL Editor** → **New query**, pega todo el contenido de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) y pulsa **Run**. Esto crea las tablas, el periodo `2026-2` (16 semanas desde el lunes 5 de octubre de 2026; los eventos anteriores a esa fecha también se registran y cuentan en el total), las materias fijas y el bucket privado `evidencias`.
3. Copia estos datos:
   - Botón **Connect** (arriba) → pestaña **Transaction pooler** → la cadena `postgresql://postgres.xxxx:[YOUR-PASSWORD]@…pooler.supabase.com:6543/postgres`. Reemplaza `[YOUR-PASSWORD]` por tu contraseña. Es la variable `DATABASE_URL`.
   - **Project Settings → API**: `Project URL` (variable `SUPABASE_URL`) y `service_role` key (variable `SUPABASE_SERVICE_ROLE_KEY`). La clave `service_role` es secreta: nunca la compartas ni la pegues en el código.

> El plan gratuito **pausa el proyecto tras 7 días sin uso**. Si la app muestra error de conexión, entra al panel de Supabase y pulsa **Restore project**. Entrar a la app cada semana evita la pausa.

### 2. GitHub y Vercel (publicación)

1. El código vive en este repositorio de GitHub.
2. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub → **Add New → Project** → elige este repositorio.
3. En **Environment Variables** agrega las variables de [`.env.example`](.env.example):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Cadena del *Transaction pooler* de Supabase con tu contraseña. |
| `SUPABASE_URL` | Project URL de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` de Supabase. |
| `COORDINACION_PASSWORD` | La contraseña con la que entrará coordinación. |
| `COORDINACION_USUARIO` | Opcional. Usuario de coordinación; por defecto `coordinacion`. |
| `SESSION_SECRET` | Cualquier texto largo y aleatorio (firma las sesiones). |
| `NEXT_PUBLIC_APP_URL` | La dirección final, p. ej. `https://protocolo-fcgt.vercel.app` (se usa en el link de las convocatorias). |

4. Pulsa **Deploy**. En 2–3 minutos la app queda en `https://<nombre>.vercel.app`. Si cambias una variable, vuelve a desplegar (*Deployments → Redeploy*).

### 3. Primer uso

1. Entra a `https://<tu-app>/coordinacion` con el usuario `coordinacion` y tu contraseña.
2. **Resumen → Ajustes**: revisa el inicio del semestre, escribe el correo de decanato y, si lo tienes, el grupo de Outlook de estudiantes.
3. **Estudiantes → Cargar archivo**: sube el Excel de estudiantes.
4. **Horarios**: sube el directorio de docentes y luego los horarios por semestre.
5. Comparte el enlace público `https://<tu-app>/` con quienes piden apoyo protocolario.

## Formatos de Excel (.xlsx o .csv)

La primera fila lleva los títulos; el orden de las columnas no importa y no distingue mayúsculas ni tildes.

| Archivo | Columnas |
|---|---|
| **Estudiantes** | `Nombre`, `Correo`, `Semestre` (1, 2 o 3), `Género` (F/M, Femenino/Masculino) |
| **Docentes** | `Nombre`, `Correo` |
| **Horarios** | `Semestre`, `Día` (Lunes…Viernes), `Inicio` (HH:MM), `Fin` (HH:MM), `Materia`, `Correo docente` |

Cada carga **actualiza** por correo electrónico (no duplica), agrega los nuevos y marca como inactivos a quienes ya no aparecen; nunca borra historial. También puedes agregar o editar una persona o una clase a mano desde la misma pantalla. En [`tests/fixtures/`](tests/fixtures/) hay archivos de ejemplo.

## Manual breve por pantalla

- **Solicitante** (`/`): 4 pasos — Solicitante (evidencia, datos, interno/externo, convenio), Evento (fecha con regla de 72 h, horario, cruces, lugar, responsable), Estudiantes (cantidad, actividades, vestimenta) y Compromisos (alimentación, transporte, actividades). Al final recibe su código `SOL-AAAA-NNN`.
- **Coordinación → Pedidos**: vista Tabla, Tablero o Calendario (la elección se recuerda). Al abrir un pedido: datos, evidencia, cruces con otros eventos, **Aprobar y convocar** (genera la clave y el correo de convocatoria), inscritos por revisar (Aceptar/Rechazar), confirmados (Quitar, Correo), agregar estudiante directamente, novedades del evento con reporte a decanato, cruce con clases con el correo a cada docente, y el correo de respuesta al solicitante.
- **Coordinación → Estudiantes**: carga del listado, matriz por semestre con estado (Cumple / Falta 1 evento / Sin eventos · nota 0) y **Enviar matriz al docente** (descarga el Excel del semestre para adjuntarlo y marca el envío).
- **Coordinación → Uniformes**: prendas entregadas por estudiante, estado (Completo / Parcial / Sin entregar) y devolución.
- **Coordinación → Novedades**: registro por evento y estudiante confirmado; **Reportar** prepara el correo a decanato y marca las novedades como reportadas.
- **Coordinación → Resumen**: horas por semana, total del semestre, horas registradas y disponibles, contadores por estado, eventos aprobados, **reporte .xlsx** (hojas Eventos, Horas, Estudiantes, Novedades), ajustes del periodo y creación del nuevo semestre.
- **Horarios**: carga de horarios y docentes, tabla semanal por semestre (editable) y lista de correos a docentes preparados con su estado (pendiente / enviado).
- **Estudiante**: avance (N / 2 eventos y horas), uniforme, convocatorias abiertas (Inscribirme / Retirar inscripción) y eventos confirmados con horario, lugar, responsable, vestimenta y actividades.

## Cada semestre

En **Resumen → Nuevo semestre** escribe el periodo (`2027-1`) y el lunes de inicio. El periodo anterior queda guardado con sus pedidos y reportes; el nuevo empieza vacío y se vuelven a cargar estudiantes, docentes y horarios. Antes de cerrar, descarga el reporte del semestre.

## Desarrollo local y pruebas

```bash
npm install
cp .env.example .env.local   # con DATABASE_URL de un Postgres local o de Supabase
npm run dev                  # http://localhost:3000
npm test                     # pruebas unitarias (reglas, importación, vistas, correos)
npm run lint && npm run typecheck && npm run build
```

Sin `SUPABASE_SERVICE_ROLE_KEY` las evidencias se guardan en `.data/evidencias/` (solo para desarrollo). Para una prueba completa con navegador: `node tests/e2e/crear-pedido.mjs` y luego `node tests/e2e/flujo.mjs` (requieren la app corriendo y Chromium de Playwright).

## Estructura

```
app/                 Páginas (App Router) y acciones de servidor
  page.tsx           Formulario público de pedido
  coordinacion/      Panel de coordinación
  horarios/          Horarios, docentes y correos a docentes
  estudiante/        Acceso y portal del estudiante
  api/               Reporte .xlsx, matriz por semestre, evidencias
  actions/           Acciones de servidor (pedidos, coordinación, estudiante, sesión)
components/          Interfaz (formulario, panel, pestañas, correos)
lib/
  reglas.ts          Reglas de negocio y formato (puras)
  vista.ts           Cálculos derivados (horas, matriz, cruces, uniformes)
  correos.ts         Textos de los correos y enlaces mailto
  importar.ts        Lectura de filas de Excel/CSV (pura)
  excel.ts           Lectura de archivos y generación del reporte (exceljs)
  datos.ts / db.ts   Acceso a Postgres (postgres.js)
  sesion.ts          Sesiones firmadas (coordinación y estudiante)
  storage.ts         Evidencias en Supabase Storage (o disco en local)
supabase/migrations/ SQL para crear la base de datos
tests/               Pruebas unitarias, flujo e2e y archivos de ejemplo
```

## Seguridad

- La base de datos solo se usa desde el servidor con la cadena de conexión; todas las tablas tienen RLS activado sin políticas, así que la API pública de Supabase no expone nada.
- Las evidencias van a un bucket **privado**; coordinación las ve mediante enlaces temporales de 1 hora.
- Coordinación entra con contraseña (variable de entorno) y sesión firmada de 12 h; el estudiante con correo + clave del evento y sesión de 8 h.
