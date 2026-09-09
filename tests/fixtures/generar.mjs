// Genera archivos de ejemplo (mismos datos del prototipo) para probar la importación.
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const correo = (n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@ute.edu.ec';
const POOL = [['Camila Ríos',1,'F'],['Andrés Molina',1,'M'],['Valeria Suárez',1,'F'],['Mateo Castro',1,'M'],['Daniela Ortiz',2,'F'],['Sebastián Loor',2,'M'],['Paula Andrade',2,'F'],['Joaquín Vera',2,'M'],['Lucía Herrera',3,'F'],['Nicolás Peña',3,'M'],['Emilia Torres',3,'F'],['Diego Salazar',3,'M']];
const DOC = { av:['Mgtr. Ana Vallejo','avallejo@ute.edu.ec'], pm:['Chef Pablo Mena','pmena@ute.edu.ec'], lp:['Dr. Luis Paredes','lparedes@ute.edu.ec'], mc:['Lic. María Cobo','mcobo@ute.edu.ec'], rg:['Mgtr. Rosa Guerrero','rguerrero@ute.edu.ec'], jt:['Chef Juan Tapia','jtapia@ute.edu.ec'], sv:['Dra. Sofía Villacís','svillacis@ute.edu.ec'] };
const CLASES = [[1,'Lunes','07:00','09:00','Introducción al Turismo','lp'],[1,'Martes','10:00','13:00','Lenguaje','mc'],[1,'Miércoles','09:00','11:00','Técnicas Culinarias I','jt'],[1,'Jueves','15:00','17:00','Matemática Básica','rg'],[1,'Viernes','10:00','12:00','Inglés I','mc'],
 [2,'Lunes','10:00','12:00','Patrimonio Cultural','lp'],[2,'Martes','08:00','10:00','Investigación','sv'],[2,'Miércoles','14:00','17:00','Servicio de A&B','pm'],[2,'Jueves','08:00','10:00','Inglés II','mc'],[2,'Viernes','15:00','17:00','Nutrición','jt'],
 [3,'Lunes','08:00','10:00','Gestión de Eventos','av'],[3,'Martes','14:00','17:00','Cultura Gastronómica','jt'],[3,'Miércoles','10:00','12:00','Protocolo y Etiqueta','av'],[3,'Jueves','09:00','11:00','Turismo Cultural','lp'],[3,'Viernes','08:00','10:00','Marketing Turístico','rg']];

const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Estudiantes');
ws.addRow(['Nombre', 'Correo', 'Semestre', 'Género']);
POOL.forEach(([n, s, g]) => ws.addRow([n, correo(n), s, g === 'F' ? 'Femenino' : 'Masculino']));
await wb.xlsx.writeFile(dir + 'estudiantes.xlsx');

writeFileSync(dir + 'docentes.csv', '﻿Nombre;Correo\n' + Object.values(DOC).map(([n, c]) => `"${n}";${c}`).join('\n') + '\n');

const wb2 = new ExcelJS.Workbook(); const ws2 = wb2.addWorksheet('Horarios');
ws2.addRow(['Semestre', 'Día', 'Inicio', 'Fin', 'Materia', 'Correo docente']);
CLASES.forEach(([s, d, i, f, m, doc]) => {
  const r = ws2.addRow([s, d, null, null, m, DOC[doc][1]]);
  // Horas como celdas de tiempo reales de Excel (fracción de día)
  const frac = (t) => { const [h, mi] = t.split(':').map(Number); return (h * 60 + mi) / 1440; };
  r.getCell(3).value = frac(i); r.getCell(3).numFmt = 'hh:mm';
  r.getCell(4).value = frac(f); r.getCell(4).numFmt = 'hh:mm';
});
await wb2.xlsx.writeFile(dir + 'horarios.xlsx');
console.log('fixtures listos');
