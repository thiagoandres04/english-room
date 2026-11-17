import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripPDFStudentHeader} from '../lib/pdf-student-header.ts';
import {extractWordBankPage} from '../lib/pdf-word-banks.ts';
import {extractPageText,repairSyntheticSpaces,combinePages} from '../lib/pdf-text.ts';
import {detectExercises} from '../lib/pdf-exercises.ts';
const item=(str,y,x=30)=>({str,transform:[10,0,0,10,x,y],width:str.length*5,height:10});
const exercise=[item('LISTENING',680),item('1 Listen and select T (True) or F (False).',660),item('1 Sara was rehearsing at school. T / F',640),item('Score: / 5',620)];
const header=[item('Get Involved! B1+',800),item('Student name',780),item('Group/Class',760),item('Date',740),item('Score',740,300)];
const cleaned=stripPDFStudentHeader([...header,...exercise]);
assert.equal(cleaned.removed,true);assert.deepEqual(cleaned.items,exercise);
assert.deepEqual(stripPDFStudentHeader([...exercise,...header.map(i=>({...i,transform:[10,0,0,10,30,i.transform[5]-500]}))]).items,[...exercise,...header.map(i=>({...i,transform:[10,0,0,10,30,i.transform[5]-500]}))]);
assert.equal(stripPDFStudentHeader([item('Date',800),item('A story about a student and their class.',780)]).removed,false);
assert.equal(stripPDFStudentHeader([item('Name the animals.',800),item('1 Read the text.',780),item('Date Score',760)]).removed,false);
for(const fields of [
 ['Name: __________','Class: ______','Date: ______ Score: ____'],
 ['Nombre y apellido: María','Curso: B1','Fecha: ____ Nota: ____'],
 ["Student’s name: Sam",'Group / Class: B1','Date: 12/11/2026 Score: 80'],
 ['Student name Group/Class Date Score'],
])assert.equal(stripPDFStudentHeader([...fields.map((s,i)=>item(s,800-i*20)),...exercise]).removed,true);
const page=extractWordBankPage([...header,...exercise]);
assert.equal(page.text,extractPageText(exercise));
assert.equal(detectExercises(page.text).filter(m=>m.kind==='choice').length,1);
assert.ok(page.text.includes('Score: / 5'));assert.ok(!page.text.includes('Student name'));
// Real files are supplied explicitly; they remain outside source and artifacts.
if(process.argv.length>2){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const path of process.argv.slice(2)){
  const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(path))}).promise;const pages=[];let removed=0;
  for(let n=1;n<=pdf.numPages;n++){
   const p=await pdf.getPage(n),data=await p.getTextContent(),ops=await p.getOperatorList();let glyphs='';
   for(let j=0;j<ops.fnArray.length;j++)if(ops.fnArray[j]===OPS.showText)for(const g of ops.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')glyphs+=g.unicode;
   const fonts={};for(const k of Object.keys(data.styles)){try{fonts[k]=p.commonObjs.get(k).name||''}catch{}}
   const items=repairSyntheticSpaces(data.items.filter(i=>'str'in i),glyphs),filtered=stripPDFStudentHeader(items),page=extractWordBankPage(items,fonts);
   assert.equal(page.headerRemoved,filtered.removed);if(page.headerRemoved)removed++;
   assert.ok(!page.text.includes('Student name'));assert.ok(!page.text.includes('Group/Class'));
   for(const b of page.wordBanks)for(const gap of b.gaps)assert.equal(page.text.slice(gap.start,gap.end),gap.answer);
   for(const span of page.writtenAnswers)assert.ok(page.text.slice(span.start,span.end).trim());
   if(!filtered.removed)assert.equal(extractPageText(filtered.items),extractPageText(items));
   pages.push(page.text);
  }
  assert.equal(removed,1);assert.ok(pages[0].startsWith('LISTENING'));assert.ok(pages.join('').includes('Score:'));
  const combined=combinePages(pages);combined.pages.forEach((p,i)=>assert.equal(combined.text.slice(p.start,p.end),pages[i]));
  await pdf.destroy();console.log('PASS: real PDF, header removed; exercises, section scores, word-bank offsets and pages preserved.');
 }
}
console.log('PASS: English/Spanish student forms, filled and split fields, preserved exercises and false-positive guards.');
