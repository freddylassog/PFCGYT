// Datos de ejemplo compartidos por las pruebas unitarias.
import type { Datos } from '../../lib/tipos';

export function datosDemo(): Datos {
  return {
    hoy: '2026-09-08', appUrl: 'https://protocolo.test', notificaciones: { canales: [], telegramSinChat: false, telegramSinCanal: false, canalEstudiantes: null, botUsername: null },
    ajustes: { periodo: '2026-2', inicioSemestre: '2026-09-07', semanas: 16, horasSemana: 20, correoDecanato: '', correoGrupoEstudiantes: '', correoCoordinacion: '', matrizEnviada: {}, archivos: {}, telegramChatId: '', telegramChatNombre: '', telegramCanalId: '', telegramCanalNombre: '', ultimoRecordatorio: '', telegramBotUsername: '', telegramWebhookUrl: '', uniformeLugar: '', calendarioToken: '' },
    pedidos: [
      { id: 'p1', periodo: '2026-2', numero: 1, codigo: 'SOL-2026-001', nombre: 'Ana', cargo: 'Dir.', institucion: 'UTE', correoSolicitante: 'a@ute.edu.ec', tipo: 'interno', convenio: 'si', evento: 'Incorporación', fecha: '2026-09-11', inicio: '15:00', fin: '18:00', dias: [{ fecha: '2026-09-11', inicio: '15:00', fin: '18:00' }], lugar: 'Auditorio', lejos: false, responsable: 'Sec.', responsableTelefono: '02 299 0800', cantidad: 2, actividades: ['Guía de invitados'], reparto: [{ actividad: 'Guía de invitados', cantidad: 2 }], vestimenta: 'uniforme', evidenciaPath: null, evidenciaNombre: null, estado: 'Aprobado', convocadaAt: '2026-09-02', clave: 'UTE-4K7Q', telegramPostAt: null, finalizadoAt: null, uniformeCita: null, createdAt: '2026-09-01T10:00:00Z' },
      { id: 'p2', periodo: '2026-2', numero: 2, codigo: 'SOL-2026-002', nombre: 'Luis', cargo: 'Coord.', institucion: 'Embajada', correoSolicitante: null, tipo: 'externo', convenio: 'no', evento: 'Recepción', fecha: '2026-09-18', inicio: '17:00', fin: '21:00', dias: [{ fecha: '2026-09-18', inicio: '17:00', fin: '21:00' }, { fecha: '2026-09-19', inicio: '09:00', fin: '12:00' }], lugar: 'Cumbayá', lejos: true, responsable: 'M.', responsableTelefono: '', cantidad: 4, actividades: [], reparto: [], vestimenta: 'formal', evidenciaPath: null, evidenciaNombre: null, estado: 'Pendiente', convocadaAt: null, clave: null, telegramPostAt: null, finalizadoAt: null, uniformeCita: null, createdAt: '2026-09-06T10:00:00Z' },
    ],
    estudiantes: [
      { id: 's1', nombre: 'Camila Ríos', correo: 'camila.rios@ute.edu.ec', semestre: 1, paralelo: null, genero: 'F', activo: true, telegramChatId: null },
      { id: 's2', nombre: 'Andrés Molina', correo: 'andres.molina@ute.edu.ec', semestre: 1, paralelo: null, genero: 'M', activo: true, telegramChatId: null },
      { id: 's3', nombre: 'Inactivo', correo: 'x@ute.edu.ec', semestre: 2, paralelo: null, genero: 'M', activo: false, telegramChatId: null },
    ],
    docentes: [{ id: 'd1', nombre: 'Lic. María Cobo', correo: 'mcobo@ute.edu.ec', activo: true }],
    clases: [{ id: 'c1', semestre: 1, paralelo: null, dia: 5, inicio: '14:00', fin: '16:00', materia: 'Lenguaje', teacherId: 'd1', activo: true }],
    materias: [{ semestre: 1, materia: 'Lenguaje', teacherId: null }, { semestre: 2, materia: 'Investigación', teacherId: null }, { semestre: 3, materia: 'Cultura Gastronómica', teacherId: null }],
    inscripciones: [{ id: 'i1', requestId: 'p1', studentId: 's1', estado: 'confirmado', createdAt: '' }, { id: 'i2', requestId: 'p1', studentId: 's2', estado: 'inscrito', createdAt: '' }],
    avisos: [], prendas: [], devoluciones: [],
    novedades: [{ id: 'n1', requestId: 'p1', studentId: 's1', tipo: 'Llegó tarde', nota: '', fecha: '2026-09-11', reportadoAt: null }],
  };
}
