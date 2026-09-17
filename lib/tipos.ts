// Tipos compartidos entre servidor y cliente. Fechas siempre como 'YYYY-MM-DD',
// horas como 'HH:MM' (24 h), para evitar problemas de zona horaria.

export type Estado = 'Pendiente' | 'Ajustes' | 'Aprobado' | 'Rechazado';
export type Tipo = 'interno' | 'externo';
export type Convenio = 'si' | 'no';
export type Vestimenta = 'uniforme' | 'formal' | 'ninguna';
export type Genero = 'F' | 'M';
export type Semestre = 1 | 2 | 3;
export type EstadoInscripcion = 'inscrito' | 'confirmado' | 'rechazado';
export type EstadoDevolucion = 'lavado' | 'rechazado';

/** Cuántos estudiantes hacen cada actividad. */
export interface RepartoActividad {
  actividad: string;
  cantidad: number;
}

/** Cita de entrega y devolución de uniformes de un evento (la fija coordinación). */
export interface CitaUniforme {
  entregaFecha: string;
  entregaHora: string;
  devolucionFecha: string;
  devolucionHora: string;
  lugar: string;
  /** Último aviso enviado a los estudiantes (ISO), si se avisó. */
  avisoAt: string | null;
}

/** Un día de participación de un evento. */
export interface DiaEvento {
  fecha: string;
  inicio: string;
  fin: string;
}

export interface Pedido {
  id: string;
  periodo: string;
  numero: number;
  codigo: string;
  nombre: string;
  cargo: string;
  institucion: string;
  correoSolicitante: string | null;
  tipo: Tipo;
  convenio: Convenio;
  evento: string;
  /** Primer día (para ordenar). La lista completa está en `dias`. */
  fecha: string;
  inicio: string;
  fin: string;
  dias: DiaEvento[];
  lugar: string;
  lejos: boolean;
  responsable: string;
  responsableTelefono: string;
  cantidad: number;
  actividades: string[];
  reparto: RepartoActividad[];
  vestimenta: Vestimenta;
  evidenciaPath: string | null;
  evidenciaNombre: string | null;
  estado: Estado;
  convocadaAt: string | null;
  clave: string | null;
  telegramPostAt: string | null;
  /** Fecha en que coordinación marcó el evento como finalizado (solo eventos aprobados). */
  finalizadoAt: string | null;
  /** Entrega y devolución de uniformes (solo eventos con uniforme institucional). */
  uniformeCita: CitaUniforme | null;
  createdAt: string;
}

export interface Estudiante {
  id: string;
  nombre: string;
  correo: string;
  semestre: Semestre;
  paralelo: string | null;
  genero: Genero;
  activo: boolean;
  /** Chat de Telegram vinculado (por correo), si el estudiante se registró con el bot. */
  telegramChatId: string | null;
}

export interface Docente {
  id: string;
  nombre: string;
  correo: string | null;
  activo: boolean;
}

export interface Clase {
  id: string;
  semestre: Semestre;
  paralelo: string | null;
  dia: number; // 1 = lunes … 5 = viernes
  inicio: string;
  fin: string;
  materia: string;
  teacherId: string | null;
  activo: boolean;
}

export interface MateriaNota {
  semestre: Semestre;
  materia: string;
  teacherId: string | null;
}

export interface Inscripcion {
  id: string;
  requestId: string;
  studentId: string;
  estado: EstadoInscripcion;
  createdAt: string;
}

export interface Aviso {
  id: string;
  requestId: string;
  classId: string;
  studentIds: string[];
  sentAt: string | null;
  createdAt: string;
}

export interface PrendaEntregada {
  studentId: string;
  item: string;
  entregadoAt: string;
}

export interface Devolucion {
  studentId: string;
  estado: EstadoDevolucion;
  at: string;
}

export interface Novedad {
  id: string;
  requestId: string;
  studentId: string;
  tipo: string;
  nota: string;
  fecha: string;
  reportadoAt: string | null;
}

export interface ArchivoInfo {
  nombre: string;
  fecha: string;
  info: string;
}

export interface Ajustes {
  periodo: string;
  inicioSemestre: string;
  semanas: number;
  horasSemana: number;
  correoDecanato: string;
  correoGrupoEstudiantes: string;
  correoCoordinacion: string;
  matrizEnviada: Record<string, string>;
  archivos: Record<string, ArchivoInfo>;
  telegramChatId: string;
  telegramChatNombre: string;
  telegramCanalId: string;
  telegramCanalNombre: string;
  ultimoRecordatorio: string;
  telegramBotUsername: string;
  telegramWebhookUrl: string;
  /** Lugar habitual de entrega de uniformes (se propone al fijar cada cita). */
  uniformeLugar: string;
}

/** Todo lo que necesita el panel de coordinación, cargado en una sola pasada. */
export interface Datos {
  hoy: string;
  appUrl: string;
  /** Canales de aviso de pedidos nuevos (correo / Telegram). */
  notificaciones: EstadoNotificaciones;
  ajustes: Ajustes;
  pedidos: Pedido[];
  estudiantes: Estudiante[];
  docentes: Docente[];
  clases: Clase[];
  materias: MateriaNota[];
  inscripciones: Inscripcion[];
  avisos: Aviso[];
  prendas: PrendaEntregada[];
  devoluciones: Devolucion[];
  novedades: Novedad[];
}

export interface EstadoNotificaciones {
  canales: { canal: 'correo' | 'telegram'; destino: string }[];
  /** Hay token de bot de Telegram pero aún no se detectó el chat. */
  telegramSinChat: boolean;
  /** Hay token de bot pero aún no se detectó el canal de estudiantes. */
  telegramSinCanal: boolean;
  /** Nombre del canal de estudiantes (null si no está configurado). */
  canalEstudiantes: string | null;
  /** Usuario del bot (sin @) cuando los mensajes personales están activos. */
  botUsername: string | null;
}

export interface Resultado<T = undefined> {
  ok: boolean;
  error?: string;
  datos?: T;
}
