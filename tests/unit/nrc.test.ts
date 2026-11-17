import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatosPorNombre, claveNombreEstudiante, semestreDeHoja, coincideNombre, esFormatoNrc, formatearNombreNrc, generoPorNombre, parseEstudiantesNrc, parseHorariosAncho, tituloNombre } from '../../lib/importar';
import { aplicarUnionParalelos, claseAplica, claveDocente, cruceClases, cruceTexto, diagnosticoCruce, estudiantesAfectados, fechasCruce, horasMaxPorDia } from '../../lib/reglas';
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

test('diagnóstico: por qué a un confirmado no le choca ninguna clase', () => {
  const clases: Clase[] = [
    { id: 'tbc', semestre: 2, paralelo: 'A', dia: 3, inicio: '07:00', fin: '11:00', materia: 'TBC II', teacherId: null, nrc: '2807', activo: true },
    { id: 'tcc', semestre: 2, paralelo: 'A', dia: 5, inicio: '07:00', fin: '12:00', materia: 'Carnicería', teacherId: null, nrc: '2808', activo: true },
    { id: 'vieja', semestre: 2, paralelo: 'A', dia: 3, inicio: '07:00', fin: '11:00', materia: 'Inactiva', teacherId: null, nrc: '9999', activo: false },
    { id: 'ts3', semestre: 3, paralelo: 'A', dia: 3, inicio: '07:00', fin: '10:00', materia: 'Servicio', teacherId: null, nrc: '3301', activo: true },
  ];
  const mie = { fecha: '2026-10-14', inicio: '07:00', fin: '11:00' }, vie = { fecha: '2026-10-16', inicio: '14:00', fin: '16:00' };
  const ev = { dias: [mie, vie] };
  const ana = { semestre: 2, paralelo: 'A', nrcs: ['2807', '2808', '2809'] };
  const d1 = diagnosticoCruce(ev, clases, ana);
  assert.deepEqual([d1.clases.map((c) => c.id), d1.cruzan.map((c) => c.id), d1.nrcsSinHorario, d1.motivo], [['tbc', 'tcc'], ['tbc'], ['2809'], null], 'con cruce no hay motivo');
  // Sus NRC no coinciden con el horario (p. ej. se cambió la columna NRC del archivo)
  const d2 = diagnosticoCruce(ev, clases, { ...ana, nrcs: ['5807', '5808'] });
  assert.deepEqual(d2.cruzan, []);
  assert.match(d2.motivo ?? '', /ninguno de sus 2 NRC \(5807, 5808\) está en el horario cargado: revisa la columna NRC del horario de 2\.º semestre/);
  // Va solo el viernes por la tarde: ese día tiene clase en otra hora
  const d3 = diagnosticoCruce(ev, clases, { ...ana, dias: [vie] });
  assert.match(d3.motivo ?? '', /^ese día sus clases son en otra hora: Carnicería \(A · NRC 2808\) 07:00–12:00 \(evento: viernes 16 oct 14:00–16:00\) · 1 de sus NRC no están en el horario \(2809\)$/);
  // Evento un lunes: no tiene clases ese día
  const d4 = diagnosticoCruce({ dias: [{ fecha: '2026-10-12', inicio: '08:00', fin: '10:00' }] }, clases, { ...ana, nrcs: ['2807'] });
  assert.equal(d4.motivo, 'no tiene clases el lunes 12 oct 08:00–10:00');
  // Sin clases de su semestre en el horario
  assert.equal(diagnosticoCruce(ev, clases, { semestre: 1, paralelo: 'C', nrcs: ['1001'] }).motivo, 'el horario cargado no tiene clases de 1.º semestre');
  // Sin NRC y de otro paralelo
  assert.equal(diagnosticoCruce(ev, clases, { semestre: 2, paralelo: 'B', nrcs: [] }).motivo, 'el horario de 2.º semestre no tiene clases del paralelo B');
  assert.equal(diagnosticoCruce(ev, clases, { semestre: 3, paralelo: null, nrcs: [] }).motivo, null, 'sin paralelo ni NRC: todas las de su semestre');
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

test('paralelos unidos: aula con el horario de 1C para todos; talleres por paralelo', () => {
  const k = (id: string, paralelo: string, dia: number, inicio: string, fin: string, materia: string, nrc: string): Clase => ({ id, semestre: 1, paralelo, dia, inicio, fin, materia, teacherId: null, nrc, activo: true });
  const clases: Clase[] = [
    k('matA', 'A', 1, '07:00', '09:00', 'MATEMÁTICA', '1101'), k('matC', 'C', 3, '07:00', '09:00', 'MATEMÁTICA', '3176'),
    k('lenA', 'A', 2, '09:00', '11:00', 'LENGUAJE', '1102'), k('lenC1', 'C', 2, '07:00', '08:00', 'LENGUAJE', '3175'), k('lenC2', 'C', 4, '07:00', '09:00', 'LENGUAJE', '3175'),
    k('tbcA', 'A', 3, '07:00', '12:00', 'TBC I', '1103'), k('tbcC', 'C1', 5, '07:00', '12:00', 'TBC I', '3180'),
    k('solaA', 'A', 5, '14:00', '16:00', 'SOLO EN A', '1104'),
    { ...k('mat2', 'A', 1, '07:00', '09:00', 'OTRO SEMESTRE', '2201'), semestre: 2 },
  ];
  assert.equal(horasMaxPorDia(clases, 1).get('TBC I'), 5);
  assert.equal(horasMaxPorDia(clases, 1).get('MATEMATICA'), 2);
  const u = aplicarUnionParalelos(clases, [{ semestre: 1, paralelo: 'C', horasMax: 2 }]);
  const por = (id: string) => u.find((c) => c.id === id)!;
  assert.deepEqual([por('matA').activo, por('matA').porUnion, por('matC').unificada, por('matC').nrcsUnidos], [false, true, true, ['1101', '3176']]);
  assert.deepEqual([por('lenA').activo, por('lenC1').unificada, por('lenC2').unificada], [false, true, true]);
  assert.deepEqual([por('tbcA').activo, por('tbcC').activo, !!por('tbcA').unificada], [true, true, false], 'taller (5 h en un día): sigue por paralelo');
  assert.equal(por('solaA').activo, true, 'materia que 1C no dicta: queda igual');
  assert.equal(por('mat2').activo, true, 'otro semestre: sin cambios');
  assert.equal(clases[0].activo, true, 'no modifica la lista original');
  // Un estudiante de 1A (NRC de 1A) recibe Matemática de 1C (miércoles) y su taller de 1A (miércoles 07–12), no la Matemática de 1A (lunes)
  const deA = { semestre: 1, paralelo: 'A', nrcs: ['1101', '1102', '1103'] };
  assert.equal(claseAplica(por('matC'), deA), true);
  assert.equal(claseAplica(por('tbcC'), deA), false, 'el taller de C no es suyo');
  const mie = { dias: [{ fecha: '2026-10-14', inicio: '07:00', fin: '10:00' }] };
  assert.deepEqual(cruceClases(mie, u, [deA]).map((c) => c.id), ['tbcA', 'matC'], 'ordenadas por paralelo');
  assert.deepEqual(cruceClases({ dias: [{ fecha: '2026-10-12', inicio: '07:00', fin: '09:00' }] }, u, [deA]).map((c) => c.id), [], 'lunes: Matemática de 1A ya no se dicta');
  assert.equal(diagnosticoCruce(mie, u, deA).nrcsSinHorario.length, 0, 'sus NRC de aula de 1A cuentan por la unión');
  // Sin NRC: por semestre
  assert.equal(claseAplica(por('matC'), { semestre: 1, paralelo: 'B', nrcs: [] }), true);
  assert.equal(claseAplica(por('matC'), { semestre: 2, paralelo: 'B', nrcs: [] }), false);
});
