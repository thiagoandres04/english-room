import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractWordBankPage} from '../lib/pdf-word-banks.ts';
import {extractAnswerHints,detectExercises} from '../lib/pdf-exercises.ts';
import {repairSyntheticSpaces,combinePages} from '../lib/pdf-text.ts';
import {makeParts,toStudentParts,wordBanksAreValid,choiceIsValid,gradeObjectiveAnswers,isWriting} from '../lib/exam-parts.ts';

const fonts={body:'Demo-Regular',bold:'Demo-Bold',ink:'Demo-Overlock-Regular'};
const item=(str,x,y,fontName='body',width=str.length*4)=>({str,fontName,width,height:10,transform:[10,0,0,10,x,y]});
const partial=[item('2 Complete the sentences with the verbs in brackets.',20,800,'bold'),item('1 She',20,770),item('has visited',65,770,'ink'),item('(visit) the town, but she',120,770),item('has never lived',230,770,'ink'),item('(live) there.',300,770)];
const ex=extractWordBankPage(partial,fonts);assert.equal(ex.writtenAnswers.length,2);assert.deepEqual(ex.writtenAnswers.map(m=>ex.text.slice(m.start,m.end)),['has visited','has never lived']);
const hint=(m,offset=0)=>({...m,source:'written',line:'',answer:m.answer||'',kind:m.kind==='choice'?'choice':undefined,start:m.start+offset,end:m.end+offset});
const parts=makeParts(ex.text,detectExercises(ex.text,ex.writtenAnswers.map(m=>hint(m))));assert.ok(toStudentParts(parts).filter(p=>p.text).map(p=>p.text).join('').includes('(visit) the town, but she'));
const split=partial.flatMap(i=>i.str==='has visited'?[{...i,str:'has',width:12},{...i,str:'visited',width:28,transform:[10,0,0,10,80,770]}]:i);assert.equal(extractWordBankPage(split,fonts).writtenAnswers.length,2);
assert.equal(extractWordBankPage([item('first answer',20,770,'ink'),item('second answer',200,770,'ink')],fonts).writtenAnswers.length,2);
const bankItems=[item('1 Complete the text with the correct form of the words in the box.',20,800,'bold'),item('study',20,775),item('write',65,775),item('travel',110,775),item('We are 1',20,745),item('writing',70,745,'ink'),item('a letter.',110,745)];
const bank=extractWordBankPage(bankItems,fonts);assert.equal(bank.wordBanks.length,1);assert.equal(bank.wordBanks[0].bankMode,'write');assert.deepEqual(bank.wordBanks[0].options,['study','write','travel']);assert.equal(bank.text.slice(bank.writtenAnswers[0].start,bank.writtenAnswers[0].end),'writing');
const carry=extractWordBankPage(bankItems.slice(0,4),fonts);assert.equal(carry.wordBanks[0].bankMode,'write');assert.equal(carry.writtenAnswers.length,0);
const selection=[item('2 Choose the correct answers to complete the text.',20,800,'bold'),item('They 1',20,775),item('departed',65,775,'ink'),item('early.',110,775),item('1',20,745,'bold'),item('a',40,745,'bold'),item('arrived',50,745),item('b',100,745,'bold'),item('departed',110,745),item('c',165,745,'bold'),item('stayed',175,745)];
const table=extractWordBankPage(selection,fonts),selected=detectExercises(table.text,table.writtenAnswers.map(m=>hint(m)));assert.equal(selected.length,1);assert.equal(selected[0].inline,true);assert.deepEqual(selected[0].options,['arrived','departed','stayed']);assert.equal(selected[0].answer,'departed');assert.ok(!table.text.includes('arrived'));
const duplicate=detectExercises('1 Where is the museum?\nNear the park.',[{source:'written',line:'',answer:'',start:23,end:37}]);assert.equal(duplicate.length,1);
assert.equal(extractWordBankPage(partial.map(i=>({...i,fontName:'body'})),fonts).writtenAnswers.length,0);
const writing=detectExercises('7 Write an essay.\nModel writing\nA sample paragraph.\nScore: / 10');assert.equal(writing.length,1);assert.equal(writing[0].multiline,true);

async function inspectPDF(path){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const doc=await getDocument({data:new Uint8Array(fs.readFileSync(path))}).promise;
 const texts=[],hints=[],banks=[];
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),data=await page.getTextContent(),op=await page.getOperatorList();let glyphs='';
  for(let j=0;j<op.fnArray.length;j++)if(op.fnArray[j]===OPS.showText)for(const g of op.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')glyphs+=g.unicode;
  const fonts={};for(const k of Object.keys(data.styles)){try{fonts[k]=page.commonObjs.get(k).name||''}catch{}}
  const items=repairSyntheticSpaces(data.items.filter(i=>'str'in i),glyphs),ex=extractWordBankPage(items,fonts),offset=texts.reduce((n,t)=>n+t.length+2,0);
  hints.push(...extractAnswerHints(items,op,OPS,fonts),...ex.writtenAnswers.map(m=>hint(m,offset)));
  banks.push(...ex.wordBanks.map(b=>({...b,start:b.start+offset,end:b.end+offset,gaps:b.gaps.map(g=>({...g,start:g.start+offset,end:g.end+offset}))})));texts.push(ex.text);
 }
 await doc.destroy();const combined=combinePages(texts),marks=detectExercises(combined.text,hints,banks),parts=makeParts(combined.text,marks);
 assert.ok(marks.every((m,i)=>!i||m.start>=marks[i-1].end),'Answer ranges must not overlap or repeat.');
 assert.ok(parts.every(p=>choiceIsValid(p)));assert.ok(wordBanksAreValid(parts));assert.ok(toStudentParts(parts).every(p=>p.answer===undefined));
 for(const m of marks.filter(m=>m.inline||!m.kind))assert.ok(combined.text.slice(m.start,m.end).trim());
 return {text:combined.text,marks,parts};
}
for(const path of process.argv.slice(2)){
 const {text,marks,parts}=await inspectPDF(path),responses=parts.filter(p=>p.answer!==undefined),student=toStudentParts(parts),visible=student.filter(p=>p.text).map(p=>p.text).join('');
 if(/Jrs/i.test(path)){
  assert.equal(responses.length,44);assert.equal(parts.filter(p=>p.kind==='choice').length,9);assert.equal(parts.filter(p=>p.answer!==undefined&&!p.kind).length,35);
  assert.ok(responses.some(p=>p.answer==='has never ridden'));assert.ok(responses.some(p=>p.answer==='interested in'));assert.ok(!visible.includes('has never ridden'));
  assert.match(visible,/c o d e r r e w a r d i n g i n t e r e s t e d i n c h a l l e n g i n g\ns a f e e n e r g e t i c u n i v e r s i t y/);
  assert.equal(parts.filter(isWriting).length,6);
 }else{
  assert.equal(responses.length,37);assert.equal(parts.filter(p=>p.kind==='choice'&&p.inline).length,7);assert.equal(parts.filter(p=>p.kind==='wordbank'&&p.bankMode==='write').length,2);
  assert.deepEqual(parts.filter(p=>p.inline).map(p=>p.answer),['hit','original','joy','That year','thrown away','protect','bored']);
  assert.ok(student.filter(p=>p.kind==='wordbank').every(p=>p.bankMode==='write'));assert.ok(student.filter(p=>p.inline).every(p=>p.blank));
  assert.ok(visible.includes('Unless Sanjay'));assert.ok(!visible.includes('will have changed'));assert.ok(!visible.includes('There are many arguments'));assert.equal(parts.filter(isWriting).length,1);
  assert.ok(parts.find(p=>p.prompt?.startsWith('1 Abby')).prompt.includes('was ____'));
 }
 const correct=gradeObjectiveAnswers(parts,Object.fromEntries(responses.map(p=>[p.id,p.answer])));assert.ok(correct.every(a=>a.correct));assert.equal(correct.length,responses.length-parts.filter(isWriting).length);
 console.log(`PASS: ${/Jrs/i.test(path)?'Jrs':'Teens'} PDF: ${responses.length} unique responses, complete options, private solutions and deterministic grading.`);
}
console.log('PASS: inline/split handwriting, inflected-word banks across pages, A/B/C passage gaps, preserved printed stems, duplicate prevention and model writing.');
