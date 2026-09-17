import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correoConvocatoria, mailtoUrl } from '../../lib/correos';
import { datosDemo } from './datos-demo';
import { avanceEstudiante, matrizSemestres, resumenHoras, vistaPedidos } from '../../lib/vista';


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
