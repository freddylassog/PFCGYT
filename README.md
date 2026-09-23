# Protocolo de eventos · FCGT · Universidad UTE

Aplicación web (computadora y celular) para gestionar los **pedidos de apoyo protocolario** de la Facultad de Ciencias Gastronómicas y Turismo: pedido formal, revisión de coordinación, convocatoria a estudiantes con clave por evento, control de horas, uniformes, novedades para decanato y reporte del semestre en Excel.

Costo mensual: **$0** (Supabase + Vercel en sus planes gratuitos).

## Cómo funciona

| Quién | Qué hace | Cómo entra |
|---|---|---|
| **Solicitante** (interno UTE o externo) | Llena el pedido de 4 pasos y adjunta la evidencia (correo o pedido formal). | Enlace público, sin clave. |
| **Coordinación** | Revisa, aprueba, convoca, confirma estudiantes, registra novedades y uniformes, descarga el reporte. | `/coordinacion` con usuario y contraseña. |
| **Estudiante** | Se inscribe a convocatorias, ve sus eventos confirmados y su uniforme. Si conecta el bot de Telegram, recibe en su celular la confirmación y el recordatorio de cada evento. | `/estudiante` con su correo institucional y la **clave del evento** (su código, p. ej. `SOL-2026-003`). |

### Correos: la app no los envía, los prepara

No se necesita acceso de TI ni servicios de correo. En cada punto donde hace falta un correo (convocatoria, aviso a docentes por cruce de clases, matriz al docente, reporte a decanato, confirmación al estudiante, respuesta al solicitante, recordatorio 24 h) la app muestra el correo listo con dos botones:

- **Abrir en Outlook**: abre Outlook con destinatarios, asunto y texto ya escritos.
- **Copiar texto**: para pegarlo donde prefieras.

Coordinación lo envía desde su propia cuenta y luego marca **"Marcar como enviado"** para que quede registrado. Para las convocatorias, en *Resumen → Ajustes* se puede fijar el **grupo de Outlook de estudiantes**; si no hay grupo, el correo pone a todos los estudiantes activos en copia oculta (y hay un botón para copiar la lista).

### Reglas implementadas (en el navegador y en el servidor)

1. **72 horas**: no se registra un pedido a menos de 3 días.
2. **Cruce de horarios entre eventos**: si ya hay un evento (no rechazado) en esa fecha y hora se muestra el aviso *"Horario ocupado. Ya hay un evento en esa hora…"* y **no se puede registrar el pedido**. Sí se permiten eventos distintos el mismo día en horas distintas. (Para que solo avise sin bloquear, cambia `BLOQUEAR_CRUCE_EVENTOS` a `false` en `lib/reglas.ts`.)
3. **Eventos de varios días**: el pedido puede tener varios días, cada uno con su propio horario ("+ Agregar otro día"). Cuenta como **un solo evento** por estudiante; las horas de protocolo son la suma de todos los días; la regla de 72 h se aplica al primer día; el cruce se revisa día por día; la clave vence al terminar el último día. Coordinación puede cambiar los días desde *Editar pedido*.
4. **Externo sin convenio**: se registra para revisión, pero no se puede aprobar hasta marcar el convenio como vigente.
5. **Alimentación** si algún día de participación pasa de 4 h; **transporte** si termina después de las 18:00 o el lugar es lejano.
6. **Horas por evento** = suma de (salida − inicio) de cada día (1 decimal). Presupuesto del semestre = horas por semana × 16 semanas.
7. Estudiantes de 1.º a 3.º; **mínimo 2 eventos** confirmados. La app **no pone notas**: solo muestra el texto de la regla y permite enviar la matriz de cada semestre al docente correspondiente (Lenguaje, Investigación y Cultura Gastronómica, fijas en la base de datos; el docente se toma del horario cargado).
8. **Cruce con clases**: clases del mismo día de la semana que chocan con el horario del evento, filtradas al semestre y paralelo de los estudiantes confirmados (un estudiante sin paralelo cuenta para todos los paralelos de su semestre). Al confirmar a un estudiante se prepara el correo al docente automáticamente.
9. **Clave por evento**: es el **código del evento** (`SOL-2026-003`), fácil de recordar porque aparece en todos los correos y pantallas. Se asigna al aprobar y deja de servir al terminar el evento. No es secreta: solo sirve para que el estudiante se inscriba (además debe estar en el listado activo). Si hace falta, *"Generar otra"* la reemplaza por una aleatoria `UTE-XXXX`.
10. Las novedades solo se registran para estudiantes confirmados; una vez reportadas a decanato quedan bloqueadas.
11. Devolución del uniforme: solo se acepta **lavado**; si no, queda como *"No recibido · sin lavar"*.
12. **Entrega y devolución de uniformes**: para cada evento con uniforme institucional, coordinación fija **fecha, hora y lugar de entrega** y **de devolución** (no son fijas: dependen de clases y ocupaciones) en *Uniformes → Entrega y devolución por evento* o en el panel del pedido. **Guardar y avisar por Telegram** publica la cita en el canal de estudiantes y la envía por mensaje personal a los confirmados que conectaron el bot; además queda listo el **correo a los confirmados** para Outlook. Los estudiantes la ven en su portal, en el evento confirmado. El día anterior a cada entrega o devolución la app envía un recordatorio (canal y mensajes personales) junto con el de los eventos. En *Resumen → Ajustes* se fija el lugar habitual, que se propone en cada cita.
13. **Fin de evento**: cuando un evento aprobado termina, coordinación pulsa **Fin de evento** (en *Novedades → Eventos aprobados* o en el panel del pedido). El evento pasa a **Finalizado**, se muestra en **verde** en la tabla, el tablero (columna *Finalizado*) y el calendario, deja de aceptar inscripciones y sigue contando en horas y en la matriz de los estudiantes. Si se pulsa antes de la fecha, la app pide confirmación; *Reabrir evento* lo deshace. En toda la app los eventos **internos** se ven en azul y los **externos** en naranja.
14. **Reparto por actividad**: en el paso Estudiantes el solicitante marca las actividades y escribe cuántos estudiantes van en cada una (p. ej. 4 en total: 2 en guía de invitados y 2 en acompañamiento en recorridos). La suma debe **cuadrar con la cantidad total** para pasar al siguiente paso; el reparto aparece en el panel del pedido, en la convocatoria, en el portal del estudiante y en el reporte. Coordinación puede corregirlo desde *Editar pedido*.

## Puesta en marcha (una sola vez, ~40 minutos)

### 1. Supabase (base de datos y archivos)

1. Entra a [supabase.com](https://supabase.com) → **New project** → nombre `protocolo-fcgt`, región *South America (São Paulo)*. Guarda la contraseña de la base de datos: **usa solo letras y números** (sin símbolos).
2. No hace falta crear tablas a mano: **la app crea y actualiza su base de datos sola** la primera vez que se usa (aplica en orden los archivos de `supabase/migrations/` y anota cuáles ya corrió en la tabla `schema_migrations`). Eso crea las tablas, el periodo `2026-2` (16 semanas desde el lunes 5 de octubre de 2026; los eventos anteriores a esa fecha también se registran y cuentan en el total), las materias fijas y el bucket privado `evidencias`. Si prefieres hacerlo a mano, también puedes pegar cada archivo en **SQL Editor** → **Run**; son idempotentes.
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
| **Estudiantes** | `Nombre`, `Correo`, `Semestre` (1, 2 o 3), `Género` (F/M, Femenino/Masculino) y, opcional, `Paralelo` (A, B, C1…). Con paralelo, los avisos a docentes solo salen para las clases de ese paralelo. |
| **Docentes** | `Nombre`, `Correo`. El nombre debe coincidir con el del horario (sin importar tildes ni mayúsculas). |
| **Horarios** | **El archivo de la universidad tal cual**: `ASIGNATURA`, `NIVEL`, `PARALELO`, `DOCENTE`, `LUNES`…`VIERNES` con los horarios escritos en cada día (`9:00-11:00`, `07:00 -09:00`, `9:00 10:00`; se entienden todos). También se acepta una fila por clase: `Semestre`, `Paralelo`, `Día`, `Inicio`, `Fin`, `Materia`, `Docente` y/o `Correo docente`. |

Orden recomendado: primero **Docentes**, luego **Horarios**. Si se cargan al revés, los docentes que vienen en el horario se crean sin correo y se completan al cargar el directorio (o a mano en *Agregar docente*).

Cada carga **actualiza** por correo electrónico (no duplica), agrega los nuevos y marca como inactivos a quienes ya no aparecen; nunca borra historial. También puedes agregar o editar una persona o una clase a mano desde la misma pantalla. En [`tests/fixtures/`](tests/fixtures/) hay archivos de ejemplo.

## Manual breve por pantalla

- **Solicitante** (`/`): 4 pasos — Solicitante (datos, interno/externo, convenio), Evento (nombre, evidencia adjunta, uno o varios días con su horario, regla de 72 h, cruces, lugar, responsable en sitio con nombre y teléfono de contacto), Estudiantes (cantidad, actividades con cuántos estudiantes en cada una, vestimenta) y Compromisos (alimentación, transporte, actividades). Al final recibe su código `SOL-AAAA-NNN`.
- **Coordinación → Pedidos**: vista Tabla, Tablero o Calendario (la elección se recuerda); color azul para eventos internos, naranja para externos y verde para finalizados (leyenda bajo el calendario). Al final del panel de cada pedido está **Eliminar pedido** (para pruebas o duplicados): borra el pedido con sus inscripciones, novedades, avisos a docentes y evidencia, previa confirmación (si tiene estudiantes confirmados pide escribir el código). No se puede deshacer; para descartar un pedido real usa **Rechazar**, que lo conserva en el reporte. Al abrir un pedido: datos, evidencia, **Editar pedido** (cantidad de estudiantes, días y horarios, lugar, actividades, vestimenta y datos del solicitante), cruces con otros eventos, **Aprobar y convocar** (genera la clave y el correo de convocatoria), inscritos por revisar (Aceptar/Rechazar), confirmados (Quitar, Correo), agregar estudiante directamente, novedades del evento con reporte a decanato, cruce con clases con el correo a cada docente, y el correo de respuesta al solicitante.
- **Coordinación → Estudiantes**: carga del listado (con la etiqueta *Telegram* en quienes conectaron el bot), matriz por semestre con estado (Cumple / Falta 1 evento / Sin eventos · nota 0) y **Enviar matriz al docente** (descarga el Excel del semestre para adjuntarlo y marca el envío).
- **Coordinación → Uniformes**: arriba, **Entrega y devolución por evento** (fecha, hora y lugar; Guardar / Guardar y avisar por Telegram; correo a los confirmados). Abajo, solo los estudiantes confirmados en eventos con uniforme institucional (o con prendas entregadas), con sus eventos y citas; interruptor para ver a todos. Prendas entregadas, estado (Completo / Parcial / Sin entregar) y devolución.
- **Coordinación → Novedades**: lista de eventos aprobados con el botón **Fin de evento** (o *Reabrir*), registro de novedades por evento y estudiante confirmado; **Reportar** prepara el correo a decanato y marca las novedades como reportadas.
- **Coordinación → Resumen**: horas por semana, total del semestre, horas registradas y disponibles, contadores por estado, eventos aprobados, **reporte .xlsx** (hojas Eventos, Horas, Estudiantes, Novedades), ajustes del periodo y creación del nuevo semestre.
- **Horarios**: carga de horarios y docentes, tabla semanal por semestre (editable) y lista de correos a docentes preparados con su estado (pendiente / enviado).
- **Estudiante**: avance (N / 2 eventos y horas), uniforme, tarjeta *Avisos en tu celular* (enlace al bot y estado de conexión), convocatorias abiertas (Inscribirme / Retirar inscripción) y eventos confirmados con horario, lugar, responsable, vestimenta y actividades.

## Avisos de pedidos nuevos

La app puede avisar a coordinación cada vez que entra un pedido, por dos canales gratuitos que no dependen de TI. Se activan con variables en Vercel (Settings → Environment Variables → luego *Redeploy*); en **Resumen → Avisos de pedidos nuevos** hay un botón **Enviar prueba**.

- **Correo con Resend** (recomendado): entra a [resend.com](https://resend.com) y crea la cuenta **con la dirección donde quieres recibir los avisos** (sin dominio propio, Resend solo permite enviar a esa misma dirección). En *API Keys → Create API Key* copia la clave. Variables: `RESEND_API_KEY` (la clave) y `NOTIFICACION_CORREO` (esa misma dirección). Los avisos llegan desde `onboarding@resend.dev`; la primera vez revisa la carpeta de spam.
- **Telegram** (mensaje al celular): en Telegram habla con **@BotFather**, envía `/newbot`, sigue los pasos y copia el token. Variable: `TELEGRAM_BOT_TOKEN`. Tras el *Redeploy*, abre tu bot en Telegram, pulsa **Iniciar**, escríbele "hola" y en la app pulsa **Detectar mi chat de Telegram** (Resumen → Avisos): la app guarda tu chat. (`TELEGRAM_CHAT_ID` es opcional para fijarlo a mano.)

El aviso incluye código, evento, fechas y horario, solicitante, cantidad de estudiantes, reparto por actividad, lugar, responsable y el enlace directo al pedido. Por Telegram también llega un aviso cada vez que un estudiante **se inscribe** o **retira su inscripción** (con el conteo de inscritos y el enlace al pedido para aceptar o rechazar). Si un canal falla, el pedido se registra igual y el error queda en los registros de Vercel.

### Canal de Telegram para estudiantes

Con el mismo bot, la app puede publicar en un canal de Telegram al que se suscriben los estudiantes:

1. En Telegram crea un canal (por ejemplo "Protocolo FCGT · Estudiantes"), privado o público.
2. En el canal: **Administradores → Añadir administrador** → busca tu bot → dale permiso de **Publicar mensajes**.
3. Escribe cualquier mensaje en el canal y, en la app, **Resumen → Canal de Telegram para estudiantes → Detectar canal de estudiantes**. Luego **Probar canal**.
4. Comparte el enlace de invitación del canal con los estudiantes (uno solo, se une quien quiera).

Desde entonces: al **aprobar** un pedido, la convocatoria se publica automáticamente en el canal (con el enlace para inscribirse y la clave); en el panel del pedido hay un botón **Volver a publicar** por si editas algo. Además, todos los días a las 18:00 (hora de Ecuador) la app publica un **recordatorio** con los eventos de mañana (horario, lugar, responsable, vestimenta y confirmados) y te avisa a ti por Telegram. El recordatorio lo dispara un cron de Vercel (`vercel.json`); si defines `CRON_SECRET` en Vercel, la ruta queda protegida, y en cualquier caso solo publica una vez por día.

### Mensajes personales del bot a cada estudiante

Además del canal, el mismo bot puede escribirle **a cada estudiante en privado**. Se activa una sola vez desde la app y no necesita nada en Vercel (usa el `TELEGRAM_BOT_TOKEN` ya configurado):

1. En **Resumen → Mensajes personales del bot** pulsa **Activar mensajes personales**. La app registra en Telegram la dirección donde el bot recibe los mensajes (`/api/telegram/webhook`, protegida con un secreto derivado de `SESSION_SECRET`) y guarda el nombre del bot.
2. Cada estudiante abre el bot (el enlace `t.me/<bot>` aparece en su portal, en la tarjeta *Avisos en tu celular*, y puedes compartirlo también en el canal), pulsa **Iniciar** y escribe su **correo institucional**. Si el correo está en el listado activo del semestre, queda vinculado y recibe la confirmación; si no, el bot le explica que pida a coordinación que lo agregue.
3. En **Coordinación → Estudiantes** verás la etiqueta *Telegram* junto a cada estudiante conectado y el total conectado.

Desde entonces cada estudiante conectado recibe: la **confirmación** cuando coordinación lo acepta en un evento (con fecha, horario, lugar, responsable, vestimenta y actividades), el aviso si **no fue aceptado** o fue **retirado**, y un **recordatorio personal** el día antes de cada evento confirmado (junto con el del canal). Quien no conecte el bot sigue viendo todo en su portal y en el canal. **Desactivar** deja de recibir mensajes en la app (los estudiantes ya vinculados se conservan por si vuelves a activarlo). Si en Vercel cambias `SESSION_SECRET`, vuelve a pulsar **Activar** para renovar el secreto.

## Calendario en el celular (iPhone, Google Calendar, Outlook)

En **Resumen → Calendario en tu celular** pulsa **Crear enlace del calendario**. La app genera un enlace privado (`/api/calendario/<clave>`) en formato iCalendar con un evento por cada día de cada pedido (con estado, confirmados, actividades, lugar y responsable) y con las entregas y devoluciones de uniformes. En el iPhone, **Agregar al calendario del iPhone** abre la suscripción (o Ajustes → Apps → Calendario → Cuentas → Añadir cuenta → Otro → Añadir calendario suscrito, pegando el enlace). Google Calendar (Desde URL) y Outlook (Suscribirse desde la web) aceptan el mismo enlace. El calendario se actualiza solo (el iPhone lo consulta cada cierto tiempo; se puede forzar deslizando hacia abajo en la app Calendario). Los pedidos por aprobar aparecen con el prefijo *[Por aprobar]* y los finalizados con *[Finalizado]*; los rechazados no aparecen. Las horas están en hora de Ecuador. El enlace es privado: **Generar nuevo enlace** anula el anterior. Al iniciar un nuevo semestre el enlace se conserva y pasa a mostrar el periodo nuevo.

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

Sin `SUPABASE_SERVICE_ROLE_KEY` las evidencias se guardan en `.data/evidencias/` (solo para desarrollo). Para una prueba completa con navegador: `node tests/e2e/crear-pedido.mjs`, luego `node tests/e2e/flujo.mjs` `node tests/e2e/reparto.mjs` (reparto por actividad), `node tests/e2e/fin-evento.mjs` (fin de evento y colores), `node tests/e2e/uniformes.mjs` (citas de uniformes) y, para el bot, `node tests/e2e/telegram.mjs` (requieren la app corriendo y Chromium de Playwright).

## Estructura

```
app/                 Páginas (App Router) y acciones de servidor
  page.tsx           Formulario público de pedido
  coordinacion/      Panel de coordinación
  horarios/          Horarios, docentes y correos a docentes
  estudiante/        Acceso y portal del estudiante
  api/               Reporte .xlsx, matriz por semestre, evidencias, calendario .ics, cron de recordatorios y webhook de Telegram
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

## Actualizaciones

Cada vez que se publica una versión nueva (push a GitHub → Vercel la despliega), la app revisa al primer uso si hay archivos nuevos en `supabase/migrations/` y los aplica automáticamente. Coordinación no tiene que hacer nada. Para cambiar la base de datos, agrega un archivo `000N_descripcion.sql` idempotente (`if not exists`, `on conflict do nothing`) y nunca edites los ya publicados.

## Seguridad

- La base de datos solo se usa desde el servidor con la cadena de conexión; todas las tablas (incluida `schema_migrations`, la de control de actualizaciones) tienen RLS activado sin políticas, así que la API pública de Supabase no expone nada. Si Supabase envía el aviso *rls_disabled_in_public*, basta con abrir la app una vez tras desplegar: la app activa RLS en cualquier tabla propia que le falte.
- Las evidencias van a un bucket **privado**; coordinación las ve mediante enlaces temporales de 1 hora.
- Coordinación entra con contraseña (variable de entorno) y sesión firmada de 12 h; el estudiante con correo + clave del evento y sesión de 8 h.
