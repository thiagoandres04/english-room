import assert from 'node:assert/strict';
import {filterSubmissions} from '../lib/student-search.ts';
const rows=[{name:'José Pérez',course:'Teens 3',examTitle:'Unit 1'},{name:'Ana Gómez',course:'2° B',examTitle:'Reading'},{name:'Alumno anterior',course:null,examTitle:'Old test'}];
assert.equal(filterSubmissions(rows,'jose')[0].name,'José Pérez');assert.equal(filterSubmissions(rows,'PÉREZ')[0].name,'José Pérez');assert.equal(filterSubmissions(rows,'teens jose').length,1);assert.equal(filterSubmissions(rows,'gomez 2°').length,1);assert.equal(filterSubmissions(rows,'anterior').length,1);assert.equal(filterSubmissions(rows,'   ').length,3);assert.equal(filterSubmissions(rows,'nadie').length,0);
console.log('PASS: búsqueda por nombre, curso y examen, insensible a mayúsculas y tildes, compatible con entregas anteriores sin curso.');
