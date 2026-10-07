import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatosPorNombre, claveNombreEstudiante, semestreDeHoja, coincideNombre, esFormatoNrc, formatearNombreNrc, generoPorNombre, parseEstudiantesNrc, parseHorariosAncho, tituloNombre } from '../../lib/importar';
import { claseAplica, claveDocente, cruceClases, cruceTexto, estudiantesAfectados, fechasCruce } from '../../lib/reglas';
import type { Clase } from '../../lib/tipos';

test('nombres del listado por materia: "NOMBRE, APELLIDO/APELLIDO I." → nombre legible', () => {
  assert.deepEqual(formatearNombreNrc('ANDREI, CARRIÓN/TISCAMA R.'), { nombre: 'Andrei R. Carrión Tiscama', primerNombre: 'ANDREI' });
  assert.deepEqual(formatearNombreNrc('ANETH, LINCANGO/'), { nombre: 'Aneth Lincango', primerNombre: 'ANETH' });
  assert.equal(formatearNombreNrc('MARÍA DE LOURDES, DE LA TORRE/PAZ').nombre, 'María de Lourdes de la Torre Paz');
  assert.equal(formatearNombreNrc('Juan Pérez').nombre, 'Juan Pérez', 'sin coma se respeta el orden');
  assert.equal(tituloNombre('CARRIÓN TISCAMA'), 'Carrión Tiscama');
  assert.equal(claveNombreEstudiante('Andrei R. Carrión Tiscama'), 'ANDREI R CARRION TISCAMA');
  assert.equal(coincideNombre('Camila Ríos', 'CAMILA, RÍOS/'), true);
  assert.equal(coincideNombre('Andrei R. Carrión Tiscama', 'Andrei Carrión Tiscama'), true, 'la inicial no cuenta');
  assert.equal(coincideNombre('Camila Ríos', 'Camila Rivas'), false);
  assert.equal(coincideNombre('Camila', 'Camila Ríos'), false, 'un solo nombre no basta');
  assert.equal(generoPorNombre('DANIELA'), 'F');
  assert.equal(generoPorNombre('ESTEFANY'), 'F');
  assert.equal(generoPorNombre('ZOE'), 'F');
  assert.equal(generoPorNombre('JOSHUA'), 'M');
  assert.equal(generoPorNombre('RICARDO'), 'M');
  assert.equal(generoPorNombre('SISA'), 'F');
});

const hojas = [
  { nombre: 'LENGUAJE - 1C', filas: [['262651', 'LENGUAJE Y ESCRITURA APLICADA A LA CULINARIA', 'PARALELO ', 'NRC'], ['1', 'ANDREI, CARRIÓN/TISCAMA R.', 'C', '3175'], ['2', 'TANIA, MONTENEGRO/LIMA E.', 'C', '3175'], ['', '', '', '']] },
  { nombre: 'TBC I - 1C1', filas: [['262651', 'TECNICAS BASICAS DE COCINA I', 'PARALELO', 'NRC'], ['1', 'ANDREI, CARRIÓN/TISCAMA R.', 'C1', '3180']] },
  { nombre: 'MATEMÁTICA - 1C', filas: [['262651', 'MATEMÁTICA PARA LA ADMINISTRACIÓN GASTRONÓMICA', 'PARALELO', 'NRC'], ['1', 'ANDREI, CARRIÓN/TISCAMA R.', 'C', '3176'], ['3', 'RICARDO, PACHECO/TOAPANTA M.', 'C', '3176']] },
  { nombre: 'Hoja vacía', filas: [] },
];

test('listado por materia: un estudiante por nombre con todos sus NRC, paralelo más frecuente y materias', () => {
  assert.equal(esFormatoNrc(hojas), true);
  assert.equal(esFormatoNrc([{ nombre: 'x', filas: [['Nombre', 'Correo', 'Semestre']] }]), false);
  const { ok, materias, errores } = parseEstudiantesNrc(hojas);
  assert.deepEqual(ok.map((e) => [e.nombre, e.paralelo, e.nrcs]), [
    ['Andrei R. Carrión Tiscama', 'C', ['3175', '3176', '3180']],
    ['Tania E. Montenegro Lima', 'C', ['3175']],
    ['Ricardo M. Pacheco Toapanta', 'C', ['3176']],
  ]);
  assert.deepEqual(materias, [
    { nrc: '3175', materia: 'LENGUAJE Y ESCRITURA APLICADA A LA CULINARIA', paralelo: 'C', semestre: 1 },
    { nrc: '3180', materia: 'TECNICAS BASICAS DE COCINA I', paralelo: 'C1', semestre: 1 },
    { nrc: '3176', materia: 'MATEMÁTICA PARA LA ADMINISTRACIÓN GASTRONÓMICA', paralelo: 'C', semestre: 1 },
  ]);
  assert.equal(semestreDeHoja('CONTABILIDAD 2A'), 2);
  assert.equal(semestreDeHoja('TGCYA - 3B1'), 3);
  assert.equal(semestreDeHoja('TBC I - 1C1'), 1);
  assert.equal(semestreDeHoja('Hoja1'), null);
  assert.equal(semestreDeHoja('MATEMÁTICA - 1C'), 1);
  assert.deepEqual(errores, []);
});

test('horario de la universidad: trae el NRC de cada clase', () => {
  const filas = [{ asignatura: 'MATEMÁTICA PARA LA ADMINISTRACIÓN', nivel: '1', paralelo: 'C', nrc: '3176', docente: 'LASSO GARZON FREDDY XAVIER', miercoles: '7:00 - 9:00', jueves: '10:00 - 11:00' }];
  const { ok } = parseHorariosAncho(filas);
  assert.deepEqual(ok.map((c) => [c.dia, c.inicio, c.fin, c.nrc]), [[3, '07:00', '09:00', '3176'], [4, '10:00', '11:00', '3176']]);
});

test('cruce por matrícula real: solo las clases en que el estudiante está matriculado', () => {
  const clases: Clase[] = [
    { id: 'mat1c', semestre: 1, paralelo: 'C', dia: 3, inicio: '07:00', fin: '09:00', materia: 'Matemática', teacherId: null, nrc: '3176', activo: true },
    { id: 'hsa1c', semestre: 1, paralelo: 'C', dia: 3, inicio: '09:00', fin: '11:00', materia: 'Higiene', teacherId: null, nrc: '3178', activo: true },
    { id: 'manual', semestre: 1, paralelo: 'C', dia: 3, inicio: '08:00', fin: '09:00', materia: 'Agregada a mano', teacherId: null, nrc: null, activo: true },
  ];
  const ev = { dias: [{ fecha: '2026-10-14', inicio: '07:00', fin: '11:00' }] }; // miércoles
  const andrei = { semestre: 1, paralelo: 'C', nrcs: ['3176', '3180'] };
  const sinNrc = { semestre: 1, paralelo: 'C', nrcs: [] };
  assert.equal(claseAplica(clases[0], andrei), true);
  assert.equal(claseAplica(clases[1], andrei), false, 'no cursa Higiene aunque sea de su semestre y paralelo');
  assert.equal(claseAplica(clases[2], andrei), true, 'clase sin NRC: se asume por semestre y paralelo');
  assert.equal(claseAplica(clases[1], sinNrc), true, 'estudiante sin NRC: regla anterior');
  assert.deepEqual(cruceClases(ev, clases, [andrei]).map((c) => c.id), ['mat1c', 'manual']);
  assert.deepEqual(cruceClases(ev, clases, [sinNrc]).map((c) => c.id), ['mat1c', 'manual', 'hsa1c'], 'ordenadas por hora');
  assert.deepEqual(cruceClases(ev, clases, []).map((c) => c.id), ['mat1c', 'manual', 'hsa1c'], 'sin confirmados: todas');
});

test('registro por nombre y docentes sin importar el orden', () => {
  const lista = [{ nombre: 'Andrei R. Carrión Tiscama' }, { nombre: 'Andrei Carrión Paz' }, { nombre: 'Tania E. Montenegro Lima' }];
  assert.deepEqual(candidatosPorNombre(lista, 'andrei carrion tiscama').map((e) => e.nombre), ['Andrei R. Carrión Tiscama'], 'nombre y dos apellidos: uno solo');
  assert.deepEqual(candidatosPorNombre(lista, 'Andrei Carrión').map((e) => e.nombre), ['Andrei R. Carrión Tiscama', 'Andrei Carrión Paz'], 'ambiguo');
  assert.deepEqual(candidatosPorNombre(lista, 'Tania Montenegro').map((e) => e.nombre), ['Tania E. Montenegro Lima']);
  assert.deepEqual(candidatosPorNombre(lista, 'Tania'), [], 'una sola palabra no basta');
  assert.deepEqual(candidatosPorNombre(lista, 'Nadie Conocido'), []);
  assert.equal(claveDocente('LASSO GARZON FREDDY XAVIER'), claveDocente('Freddy Xavier Lasso Garzón'));
  assert.notEqual(claveDocente('LASSO GARZON FREDDY XAVIER'), claveDocente('LASSO GARZON FREDDY'));
});

test('evento de dos días: cada estudiante cuenta solo en los días a los que va', () => {
  const clases: Clase[] = [
    { id: 'tbc', semestre: 2, paralelo: 'A', dia: 3, inicio: '07:00', fin: '11:00', materia: 'TBC II', teacherId: null, nrc: '2807', activo: true },
    { id: 'tcc', semestre: 2, paralelo: 'A', dia: 5, inicio: '07:00', fin: '12:00', materia: 'Carnicería', teacherId: null, nrc: '2808', activo: true },
  ];
  const mie = { fecha: '2026-10-14', inicio: '08:00', fin: '10:00' }, vie = { fecha: '2026-10-16', inicio: '08:00', fin: '10:00' };
  const ev = { dias: [mie, vie] };
  const ana = { semestre: 2, paralelo: 'A', nrcs: ['2807', '2808'], dias: [mie] }; // va solo el miércoles
  const luis = { ...ana, dias: undefined }; // va los dos días
  assert.deepEqual(cruceClases(ev, clases, [ana]).map((c) => c.id), ['tbc'], 'Ana no va el viernes: Carnicería no se cruza');
  assert.deepEqual(cruceClases(ev, clases, [luis]).map((c) => c.id), ['tbc', 'tcc']);
  assert.deepEqual(estudiantesAfectados(ev, clases[1], [ana, luis]).map((e) => (e.dias ? 'solo algunos días' : 'todos')), ['todos']);
  assert.deepEqual(fechasCruce(ev.dias, clases[1]).map((d) => d.fecha), ['2026-10-16']);
  assert.equal(cruceTexto(ev.dias, clases[0]), 'miércoles 14 oct · 07:00–11:00');
  assert.equal(cruceTexto(ev.dias, clases[1]), 'viernes 16 oct · 07:00–12:00');
});
