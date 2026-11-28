// Optional original PDFs are read locally; never include school PDFs in Git.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {preparePDFFormItems} from '../lib/pdf-form-layout.ts';
import {extractWordBankPage} from '../lib/pdf-word-banks.ts';
import {extractAnswerHints,detectExercises,mergeDetectedExercises} from '../lib/pdf-exercises.ts';
import {repairSyntheticSpaces,combinePages} from '../lib/pdf-text.ts';
import {exerciseHeader} from '../lib/pdf-structured-exercises.ts';
import {makeParts,toStudentParts,choiceGroupsAreValid,wordBanksAreValid,choiceIsValid,gradeObjectiveAnswers} from '../lib/exam-parts.ts';
const item=(str,x,y,width=50)=>({str,width,height:8,transform:[8,0,0,8,x,y]});
const ops={save:1,restore:2,transform:3,constructPath:4,rectangle:19,moveTo:13,lineTo:14};
const synthetic=preparePDFFormItems([item('1 Complete the sentence.',30,700),item('She',30,670,20),item('(go) to school.',120,670,75)],{fnArray:[4],argsArray:[[[19],[55,669,60,.4]]] },ops);
assert.ok(synthetic.items.some(i=>/^_+$/.test(i.str)));
const supplied=process.argv.slice(2);
for(let fileIndex=0;fileIndex<supplied.length;fileIndex++){
 const file=supplied[fileIndex],{getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const doc=await getDocument({data:new Uint8Array(fs.readFileSync(file))}).promise;
 const texts=[],hints=[],banks=[];
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),data=await page.getTextContent(),operators=await page.getOperatorList();let glyphs='';
  for(let j=0;j<operators.fnArray.length;j++)if(operators.fnArray[j]===OPS.showText)for(const g of operators.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')glyphs+=g.unicode;
  const fonts={};for(const k of Object.keys(data.styles)){try{fonts[k]=page.commonObjs.get(k).name||''}catch{}}
  const form=preparePDFFormItems(repairSyntheticSpaces(data.items.filter(i=>'str'in i),glyphs),operators,OPS),ah=extractAnswerHints(form.items,operators,OPS,fonts),ex=extractWordBankPage(form.items,fonts,ah),offset=texts.reduce((n,t)=>n+t.length+2,0);
  texts.push(ex.text);hints.push(...ah,...ex.writtenAnswers.map(m=>({...m,source:'written',kind:m.kind==='choice'?'choice':undefined,line:'',answer:m.answer||'',start:m.start+offset,end:m.end+offset})));
  banks.push(...ex.wordBanks.map(b=>({...b,start:b.start+offset,end:b.end+offset,gaps:b.gaps.map(g=>({...g,start:g.start+offset,end:g.end+offset}))})));
 }
 await doc.destroy();const c=combinePages(texts),marks=detectExercises(c.text,hints,banks),parts=makeParts(c.text,marks),student=toStudentParts(parts);
 assert.ok(choiceGroupsAreValid(parts));assert.ok(wordBanksAreValid(parts,false));assert.ok(parts.every(p=>choiceIsValid(p,false)));assert.ok(student.every(p=>p.answer===undefined));assert.ok(!/Student name|Group\/Class|Photocopiable/.test(c.text));
 assert.ok(marks.every((m,i)=>!i||m.start>=marks[i-1].end));
 const again=mergeDetectedExercises(marks,detectExercises(c.text,hints,banks),c.text);assert.deepEqual(makeParts(c.text,again).filter(p=>p.answer!==undefined).map(p=>p.id),parts.filter(p=>p.answer!==undefined).map(p=>p.id));
 const headers=[...c.text.matchAll(exerciseHeader)],inventory=headers.map((h,i)=>marks.filter(m=>m.start>=h.index&&m.start<(headers[i+1]?.index??c.text.length)).reduce((n,m)=>n+(m.section?m.section.filter(p=>p.answer!==undefined).length:m.kind==='wordbank'?0:1),0));
 assert.equal(inventory.length,10);
 if(fileIndex===0){
  assert.deepEqual(inventory,[6,6,6,12,6,6,6,10,12,11]);
  assert.equal(parts.filter(p=>p.groupStyle==='matching').length,6);assert.equal(parts.filter(p=>p.groupStyle==='categories').length,11);
  assert.deepEqual(parts.find(p=>p.groupStyle==='categories').options,['glass','leather','metal','wood']);
  assert.deepEqual(parts.find(p=>p.kind==='wordbank').options,['chewing gum','cotton','metal','rubber','throw away','wood']);
  assert.equal(parts.filter(p=>p.kind==='word-gap').length,6);
  assert.ok(parts.some(p=>p.options?.includes('thrown away')&&p.options?.includes('used for')));
 }else{
  assert.deepEqual(inventory,[1,6,6,6,6,5,6,7,6,6]);
  assert.equal(parts.filter(p=>p.multiline).length,1);
  assert.deepEqual(parts.find(p=>p.kind==='wordbank').options,['choose a career','do an apprenticeship','get a degree','get some careers advice','pass your driving test','set up your own business']);
  assert.equal(parts.filter(p=>p.kind==='choice'&&p.inline).length,7);
  assert.ok(parts.some(p=>p.options?.includes('can’t')&&p.options?.includes('might not')));
  assert.ok(parts.some(p=>p.options?.includes('sold out')&&p.options?.includes('released')));
  assert.equal(parts.filter(p=>p.groupStyle==='matching').length,6);
 }
 const firstMatch=parts.find(p=>p.groupStyle==='matching'),configured=parts.map(p=>p.id===firstMatch.id?{...p,answer:p.options[0]}:p);
 assert.ok(gradeObjectiveAnswers(configured,{[firstMatch.id]:firstMatch.options[0]}).some(a=>a.id===firstMatch.id&&a.correct));
 fs.writeFileSync('.sites-runtime/'+file.split('/').at(-1).replace(/\.pdf$/i,'').replaceAll(' ','-')+'-prepared.json',JSON.stringify({text:c.text,pdfPages:c.pages,marks,parts,pdfAnswerHints:hints,wordBankHints:banks}));
 console.log('PASS: '+file.split('/').at(-1)+'; ten sections; fields per section '+inventory.join(', ')+'. Grouped matching/classification, pending keys, source passages, word banks, privacy, grading and stable IDs verified.');
}
console.log('PASS: thin filled PDF rectangles become response fields. No AI calls.');
