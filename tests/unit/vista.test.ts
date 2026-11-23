import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correoConvocatoria, mailtoUrl, outlookWebUrl } from '../../lib/correos';
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
  assert.equal(p2.compromisos, 'Transporte ida y regreso');
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
  assert.equal(av.protocolosN, 1);
  assert.equal(av.estado, 'Falta 1 protocolo');
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
  const web = outlookWebUrl({ para: ['docente@ute.edu.ec'], asunto: 'Ausencia justificada · miércoles', cuerpo: 'Hola\n\nAdiós' });
  assert.match(web, /^https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\?to=docente%40ute\.edu\.ec&subject=Ausencia%20justificada/);
  assert.match(web, /body=Hola%0A%0AAdi%C3%B3s/);
  assert.doesNotMatch(web, /\+/);
  assert.match(outlookWebUrl({ para: ['d@ute.edu.ec'], asunto: 'A', cuerpo: 'B' }, 'office365'), /^https:\/\/outlook\.office365\.com\/mail\/deeplink\/compose\?to=d%40ute\.edu\.ec&subject=A&body=B$/);
  assert.match(outlookWebUrl({ para: ['d@ute.edu.ec'], asunto: 'A', cuerpo: 'B' }, 'cuenta0'), /^https:\/\/outlook\.office\.com\/mail\/0\/deeplink\/compose\?to=d%40ute\.edu\.ec/);
  assert.match(outlookWebUrl({ para: ['d@ute.edu.ec'], asunto: 'A', cuerpo: 'B' }, 'owa'), /^https:\/\/outlook\.office\.com\/owa\/\?path=%2Fmail%2Faction%2Fcompose&to=d%40ute\.edu\.ec&subject=A&body=B$/);
  const conCco = outlookWebUrl(c);
  assert.match(conCco, /^https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\?mailtouri=mailto%3A%3Fbcc%3Dcamila\.rios%2540ute\.edu\.ec%252Candres\.molina%2540ute\.edu\.ec%26subject%3D/, 'con CCO va el mailto completo');
  assert.doesNotMatch(conCco, /\+/);
});

test('protocolos: cada día de evento al que va cuenta como uno', () => {
  const d = datosDemo();
  const p = d.pedidos.find((x) => x.dias.length > 1)!; // pedido de dos días del demo
  p.estado = 'Aprobado';
  d.inscripciones = [
    { id: 'i1', requestId: p.id, studentId: 's1', estado: 'confirmado', dias: null, createdAt: '' },
    { id: 'i2', requestId: p.id, studentId: 's2', estado: 'confirmado', dias: [p.dias[1].fecha], createdAt: '' },
  ];
  d.hoy = p.dias[0].fecha;
  const a1 = avanceEstudiante(d, 's1');
  assert.deepEqual([a1.eventosN, a1.protocolosN, a1.porRealizarN, a1.cumple, a1.estado], [1, 2, 1, true, 'Cumple'], 'congreso de 2 días = 2 protocolos');
  const a2 = avanceEstudiante(d, 's2');
  assert.deepEqual([a2.protocolosN, a2.estado], [1, 'Falta 1 protocolo'], 'solo va el día 2');
  const m = matrizSemestres(d).find((x) => x.filas.some((f) => f.id === 's1'))!;
  assert.match(m.filas.find((f) => f.id === 's1')!.detalle, /\(\d+ \w+, \d+ \w+ por realizar\)/);
  assert.equal(avanceEstudiante({ ...d, inscripciones: [] }, 's1').estado, 'Sin protocolos · nota 0');
});
