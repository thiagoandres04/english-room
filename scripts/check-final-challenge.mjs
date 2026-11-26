import assert from 'node:assert/strict';import fs from 'node:fs';
import {extractAnswerHints,detectExercises,mergeDetectedExercises} from '../lib/pdf-exercises.ts';
import {extractWordBankPage} from '../lib/pdf-word-banks.ts';
import {extractPDFReferenceFigures} from '../lib/pdf-figures.ts';
import {repairSyntheticSpaces,combinePages} from '../lib/pdf-text.ts';
import {makeParts,toStudentParts,choiceIsValid,wordBanksAreValid,gradeObjectiveAnswers} from '../lib/exam-parts.ts';
import {figureIsValid,figuresAreValid} from '../lib/exam-figures.ts';
const fonts={r:'Demo-Regular',b:'Demo-Bold',i:'Demo-Italic',bi:'Demo-BoldItalic'};
const item=(str,x,y,fontName='r')=>({str,fontName,width:str.length*4,height:10,transform:[10,0,0,10,x,y]});
const ops={constructPath:4,moveTo:13,lineTo:14,curveTo:15,save:1,restore:2,transform:3,paintImageXObject:85};
const empty={fnArray:[],argsArray:[]};
const question='1 Choose the best answer.\n1 They work in a hospital.\nA. might be B. must be C are allowed to';
const picks=detectExercises(question,[{source:'bold',line:'A. might be B. must be C are allowed to',answer:'B. must be'}]);assert.equal(picks.length,1);assert.deepEqual(picks[0].options,['A might be','B must be','C are allowed to']);assert.equal(picks[0].answer,'B must be');
const boldLabels=[{source:'bold',line:'A. might be B. must be C are allowed to',answer:'A.'},{source:'bold',line:'A. might be B. must be C are allowed to',answer:'must be'},{source:'bold',line:'A. might be B. must be C are allowed to',answer:'C.'}];assert.equal(detectExercises(question,boldLabels)[0].answer,'B must be');
const rows=[item('A.',20,700),item('We admired the',35,700),item('ancient castle /',100,700,'i'),item('modern museum',170,700,'bi'),item('/ busy square',235,700,'i'),item('during our visit.',300,700)];
const {extractPageText}=await import('../lib/pdf-text.ts');const slash=detectExercises(extractPageText(rows),extractAnswerHints(rows,empty,ops,fonts));assert.deepEqual(slash[0].options,['ancient castle','modern museum','busy square']);assert.equal(slash[0].answer,'modern museum');assert.ok(slash[0].prompt.includes('during our visit.'));
const plain=[item('B. They feel calm /',20,700),item('happy',110,700,'b'),item('/ tired today.',140,700)];assert.equal(detectExercises(extractPageText(plain),extractAnswerHints(plain,empty,ops,fonts))[0].answer,'happy');
const acronym=[item('1 They work at the',20,700),item('NASA',110,700,'b'),item('centre.',140,700)];assert.equal(extractWordBankPage(acronym,fonts).writtenAnswers.length,0);
const pixel={dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=',width:1,height:1,alt:'Reference table'};
assert.ok(figureIsValid(pixel));assert.ok(!figureIsValid({...pixel,dataUrl:'https://example.test/image.png'}));assert.ok(!figureIsValid({...pixel,dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}));assert.ok(!figureIsValid({...pixel,dataUrl:pixel.dataUrl+'A'.repeat(60000)}));assert.ok(!figuresAreValid([{kind:'figure',figure:pixel,answer:'secret'}]));
const figureHint={source:'figure',start:3,end:3,line:'',answer:'',figure:pixel};const original=detectExercises('ABC\nDEF',[figureHint]);const reread=mergeDetectedExercises(original,detectExercises('ABC\nDEF',[figureHint]));assert.equal(reread.length,1);assert.equal(reread[0].id,original[0].id);assert.equal(makeParts('ABC\nDEF',original).filter(p=>p.figure).length,1);

if(process.argv[2]){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const doc=await getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2]))}).promise;const texts=[],hints=[],banks=[];
 for(let n=1;n<=doc.numPages;n++){
  const p=await doc.getPage(n),data=await p.getTextContent(),operators=await p.getOperatorList();let glyphs='';for(let j=0;j<operators.fnArray.length;j++)if(operators.fnArray[j]===OPS.showText)for(const g of operators.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')glyphs+=g.unicode;
  const names={};for(const k of Object.keys(data.styles)){try{names[k]=p.commonObjs.get(k).name||''}catch{}}
  const items=repairSyntheticSpaces(data.items.filter(i=>'str'in i),glyphs),pageHints=extractAnswerHints(items,operators,OPS,names),ex=extractWordBankPage(items,names,pageHints),offset=texts.reduce((n,t)=>n+t.length+2,0);
  const figures=await extractPDFReferenceFigures(p,operators,OPS,items,ex.text,async image=>({dataUrl:process.argv[3]?'data:image/jpeg;base64,'+fs.readFileSync(process.argv[3]).toString('base64'):pixel.dataUrl,width:image.width,height:image.height}));
  hints.push(...pageHints,...ex.writtenAnswers.map(m=>({...m,source:'written',kind:m.kind==='choice'?'choice':undefined,line:'',answer:m.answer||'',start:m.start+offset,end:m.end+offset})),...figures.map(m=>({...m,source:'figure',line:'',answer:'',start:m.start+offset,end:m.end+offset})));
  banks.push(...ex.wordBanks.map(b=>({...b,start:b.start+offset,end:b.end+offset,gaps:b.gaps.map(g=>({...g,start:g.start+offset,end:g.end+offset}))})));texts.push(ex.text);
 }
 await doc.destroy();const c=combinePages(texts),marks=detectExercises(c.text,hints,banks),parts=makeParts(c.text,marks),choices=parts.filter(p=>p.kind==='choice'),questions=parts.filter(p=>p.answer!==undefined);
 assert.equal(questions.length,52);assert.equal(choices.length,26);assert.ok(choices.every(p=>choiceIsValid(p)));assert.ok(wordBanksAreValid(parts));assert.ok(figuresAreValid(parts));assert.ok(marks.every((m,i)=>!i||m.start>=marks[i-1].end));
 const grammar=c.text.indexOf('GRAMMAR'),vocab=c.text.indexOf('VOCABULARY'),gChoices=marks.filter(m=>m.kind==='choice'&&m.start>grammar&&m.start<vocab),vChoices=marks.filter(m=>m.kind==='choice'&&m.start>vocab);
 assert.deepEqual(gChoices.map(m=>m.answer[0]),['B','A','C','B','C']);assert.deepEqual(gChoices[0].options,['A ’d better','B have to','C are allowed to']);assert.ok(gChoices.every(m=>m.options.length===3));
 assert.deepEqual(vChoices.slice(0,5).map(m=>m.answer[0]),['C','A','C','B','A']);assert.deepEqual(vChoices.slice(5).map(m=>m.answer),['villain','vinyl','screenplay','editor','sequel']);assert.ok(vChoices.every(m=>m.options.length===3));
 assert.deepEqual(choices.slice(5,11).map(m=>m.answer[0]),['B','A','C','C','A','C']);assert.ok(questions.some(p=>p.answer==='WILL HAVE BEEN TRAVELLING'));
 const table=marks.find(m=>m.kind==='figure');assert.ok(table);assert.ok(c.text.slice(Math.max(0,table.start-300),table.start).includes('Renata'));assert.ok(c.text.slice(table.end,table.end+100).includes('On Monday'));assert.equal(table.figure.width,562);assert.equal(table.figure.height,383);assert.equal(table.figure.alt,'Tabla o imagen de referencia del ejercicio 3');
 const student=toStudentParts(parts);assert.ok(student.every(p=>p.answer===undefined));assert.equal(student.filter(p=>p.kind==='figure').length,1);assert.equal(gradeObjectiveAnswers(parts,Object.fromEntries(questions.map(p=>[p.id,p.answer]))).filter(p=>p.correct).length,52);
 assert.ok(!student.filter(p=>p.text).map(p=>p.text).join('').includes('WILL HAVE BEEN TRAVELLING'));
 if(process.argv[3])fs.writeFileSync('.sites-runtime/final-challenge-prepared.json',JSON.stringify({name:'TEENS 5 FINAL CHALLENGE 2026.pdf',text:c.text,pdfPages:c.pages,marks,parts,pdfAnswerHints:hints,wordBankHints:banks}));
 console.log('PASS: original four-page PDF: 52 private references, 26 selections with bold solutions, all requested grammar/vocabulary options, 1 correctly placed embedded table and exact grading without AI.');
}
console.log('PASS: horizontal A/B/C, mixed punctuation, bold labels versus full answers, lettered multiword slash choices, acronyms preserved, bounded safe figures and stable re-recognition.');
