import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correoConvocatoria, mailtoUrl } from '../../lib/correos';
import type { Datos } from '../../lib/tipos';
import { avanceEstudiante, matrizSemestres, resumenHoras, vistaPedidos } from '../../lib/vista';

function datosDemo(): Datos {
  return {
    hoy: '2026-09-08', appUrl: 'https://protocolo.test', notificaciones: { canales: [], telegramSinChat: false },
    ajustes: { periodo: '2026-2', inicioSemestre: '2026-09-07', semanas: 16, horasSemana: 20, correoDecanato: '', correoGrupoEstudiantes: '', correoCoordinacion: '', matrizEnviada: {}, archivos: {}, telegramChatId: '', telegramChatNombre: '' },
    pedidos: [
      { id: 'p1', periodo: '2026-2', numero: 1, codigo: 'SOL-2026-001', nombre: 'Ana', cargo: 'Dir.', institucion: 'UTE', correoSolicitante: 'a@ute.edu.ec', tipo: 'interno', convenio: 'si', evento: 'Incorporación', fecha: '2026-09-11', inicio: '15:00', fin: '18:00', dias: [{ fecha: '2026-09-11', inicio: '15:00', fin: '18:00' }], lugar: 'Auditorio', lejos: false, responsable: 'Sec.', responsableTelefono: '02 299 0800', cantidad: 2, actividades: ['Guía de invitados'], vestimenta: 'uniforme', evidenciaPath: null, evidenciaNombre: null, estado: 'Aprobado', convocadaAt: '2026-09-02', clave: 'UTE-4K7Q', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'p2', periodo: '2026-2', numero: 2, codigo: 'SOL-2026-002', nombre: 'Luis', cargo: 'Coord.', institucion: 'Embajada', correoSolicitante: null, tipo: 'externo', convenio: 'no', evento: 'Recepción', fecha: '2026-09-18', inicio: '17:00', fin: '21:00', dias: [{ fecha: '2026-09-18', inicio: '17:00', fin: '21:00' }, { fecha: '2026-09-19', inicio: '09:00', fin: '12:00' }], lugar: 'Cumbayá', lejos: true, responsable: 'M.', responsableTelefono: '', cantidad: 4, actividades: [], vestimenta: 'formal', evidenciaPath: null, evidenciaNombre: null, estado: 'Pendiente', convocadaAt: null, clave: null, createdAt: '2026-09-06T10:00:00Z' },
    ],
    estudiantes: [
      { id: 's1', nombre: 'Camila Ríos', correo: 'camila.rios@ute.edu.ec', semestre: 1, paralelo: null, genero: 'F', activo: true },
      { id: 's2', nombre: 'Andrés Molina', correo: 'andres.molina@ute.edu.ec', semestre: 1, paralelo: null, genero: 'M', activo: true },
      { id: 's3', nombre: 'Inactivo', correo: 'x@ute.edu.ec', semestre: 2, paralelo: null, genero: 'M', activo: false },
    ],
    docentes: [{ id: 'd1', nombre: 'Lic. María Cobo', correo: 'mcobo@ute.edu.ec', activo: true }],
    clases: [{ id: 'c1', semestre: 1, paralelo: null, dia: 5, inicio: '14:00', fin: '16:00', materia: 'Lenguaje', teacherId: 'd1', activo: true }],
    materias: [{ semestre: 1, materia: 'Lenguaje', teacherId: null }, { semestre: 2, materia: 'Investigación', teacherId: null }, { semestre: 3, materia: 'Cultura Gastronómica', teacherId: null }],
    inscripciones: [{ id: 'i1', requestId: 'p1', studentId: 's1', estado: 'confirmado', createdAt: '' }, { id: 'i2', requestId: 'p1', studentId: 's2', estado: 'inscrito', createdAt: '' }],
    avisos: [], prendas: [], devoluciones: [],
    novedades: [{ id: 'n1', requestId: 'p1', studentId: 's1', tipo: 'Llegó tarde', nota: '', fecha: '2026-09-11', reportadoAt: null }],
  };
}

test('vista de pedidos: horas, cupos, cruces, bloqueo', () => {
  const d = datosDemo();
  const [p1, p2] = vistaPedidos(d);
  assert.equal(p1.horas, 3);
  assert.equal(p1.confirmadosN, 1);
  assert.equal(p1.inscritosN, 1);
  assert.equal(p1.cruces.length, 1, 'viernes 15–18 choca con Lenguaje 14–16');
  assert.equal(p1.cruces[0].docente?.correo, 'mcobo@ute.edu.ec');
  assert.equal(p1.compromisos, '—');
  assert.equal(p2.compromisos, 'Transporte');
  assert.equal(p2.horas, 7, 'dos días: 4 h + 3 h');
  assert.equal(p2.multidia, true);
  assert.equal(p2.fechaLarga, '18 y 19 sep 2026');
  assert.equal(p2.ultimaFecha, '2026-09-19');
  assert.match(p2.bloqueo ?? '', /convenio/);
  assert.equal(p2.convLabel, 'Sin convenio');
});

test('avance y matriz por semestre', () => {
  const d = datosDemo();
  const av = avanceEstudiante(d, 's1');
  assert.equal(av.eventosN, 1);
  assert.equal(av.estado, 'Falta 1 evento');
  assert.equal(av.novedadesN, 1);
  const m = matrizSemestres(d);
  assert.equal(m[0].docente?.nombre, 'Lic. María Cobo', 'docente tomado del horario');
  assert.equal(m[0].n, 2);
  assert.equal(m[1].n, 0, 'los inactivos no cuentan');
});

test('resumen de horas', () => {
  const h = resumenHoras(datosDemo());
  assert.equal(h.total, 320);
  assert.equal(h.usadas, 3);
  assert.equal(h.restantes, 317);
  assert.equal(h.semanaN, 1);
  assert.equal(h.usadasSemana, 3);
});

test('correo de convocatoria y mailto', () => {
  const d = datosDemo();
  const [p1] = vistaPedidos(d);
  const c = correoConvocatoria(d, p1);
  assert.deepEqual(c.cco, ['camila.rios@ute.edu.ec', 'andres.molina@ute.edu.ec']);
  assert.match(c.cuerpo, /UTE-4K7Q/);
  assert.match(c.cuerpo, /estudiante\?clave=UTE-4K7Q/);
  const url = mailtoUrl(c);
  assert.match(url, /^mailto:\?bcc=/);
  assert.match(url, /%0D%0A/);
  assert.doesNotMatch(url, /\+/);
});
