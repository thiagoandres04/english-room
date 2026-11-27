import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractAnswerHints,detectExercises,mergeDetectedExercises} from '../lib/pdf-exercises.ts';
import {extractWordBankPage} from '../lib/pdf-word-banks.ts';
import {extractPageText,repairSyntheticSpaces,combinePages} from '../lib/pdf-text.ts';
import {makeParts,toStudentParts,choiceIsValid,wordBanksAreValid,gradeObjectiveAnswers} from '../lib/exam-parts.ts';
import {repairedWordBanks,repairedChoiceHints,recoveredTypedKeys} from '../lib/pdf-hint-repair.ts';
const fonts={r:'Example-Regular',b:'Example-Bold'};
const item=(str,x,y,fontName='r',width=str.length*5)=>({str,fontName,width,height:13,transform:[13,0,0,13,x,y]});
const empty={fnArray:[],argsArray:[]};
for(const [runs,expected,key] of [
 [[item('E. Good headlines must depend on /',20,700),item('stand out',230,700,'b'),item('/ review.',300,700)],['depend on','stand out','review'],'stand out'],
 [[item('C. A poster uses social media /',20,700),item('layout',230,700,'b'),item('/ submarine in this example.',280,700)],['social media','layout','submarine'],'layout'],
 [[item('A. The picture is multi-player /',20,700),item('realistic',230,700,'b'),item('/',280,700),item('persuasive',35,682)],['multi-player','realistic','persuasive'],'realistic'],
]){
 const text=extractPageText(runs),choices=detectExercises(text,extractAnswerHints(runs,empty,{},fonts));
 assert.equal(choices.length,1);assert.deepEqual(choices[0].options,expected);assert.equal(choices[0].answer,key);assert.ok(!choices[0].prompt.includes('/'));assert.equal(choices[0].end,text.length);
}
const bankRuns=[item('3. Complete with words from the box. Use the correct form of verbs.',20,700),item('practise',20,670,'r',45),item('achieve',76,670,'r',44),item('health',127.5,670,'r',38),item('race',173,670,'r',28)];
const bank=extractWordBankPage(bankRuns,fonts).wordBanks[0];assert.deepEqual(bank.options,['practise','achieve','health','race']);assert.equal(bank.bankMode,'write');
const phraseRuns=[item('3. Complete with words from the box. Use the correct form of verbs.',20,700),item('look',20,670,'r',25),item('after',48,670,'r',28),item('bring',84,670,'r',30),item('up',117,670,'r',14)];
assert.deepEqual(extractWordBankPage(phraseRuns,fonts).wordBanks[0].options,['look after','bring up']);
const unnumbered='Choose the correct option.\nThis soup tastes ____\nA. sweet B. sour C. loud';assert.equal(detectExercises(unnumbered,[{source:'bold',line:'A. sweet B. sour C. loud',answer:'sour'}])[0].answer,'B sour');
const oldLine='E. Good headlines must depend on / stand out / review.';
assert.deepEqual(repairedChoiceHints([{source:'bold',line:oldLine,answer:'stand out'}]).find(h=>h.source==='inline-choice').options,['depend on','stand out','review']);
const oldBankText='fitness marathon proud\n\nImprove FITNESS. Enter a MARATHON. Be PROUD.';
assert.deepEqual(repairedWordBanks(oldBankText,[{start:0,end:22,options:['fitness marathon proud'],reusable:false,bankMode:'write',gaps:[]}],[{source:'underline',line:'Improve FITNESS.',answer:'FITNESS.'},{source:'underline',line:'Enter a MARATHON.',answer:'MARATHON.'},{source:'underline',line:'Be PROUD.',answer:'PROUD.'}])[0].options,['fitness','marathon','proud']);
assert.equal(recoveredTypedKeys('NAME: ____\nGRAMMAR\nImprove FITNESS.',[{source:'underline',line:'NAME: ____',answer:'NAME'},{source:'underline',line:'GRAMMAR',answer:'GRAMMAR'},{source:'underline',line:'Improve FITNESS.',answer:'FITNESS.'}],[]).length,1);
const oldPlaceholder={id:'placeholder',start:unnumbered.indexOf('____'),end:unnumbered.indexOf('____')+4};assert.equal(mergeDetectedExercises([oldPlaceholder],detectExercises(unnumbered),unnumbered)[0].kind,'choice');

if(process.argv[2]){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2]))}).promise;
 const texts=[],hints=[],banks=[];
 for(let n=1;n<=doc.numPages;n++){
  const p=await doc.getPage(n),d=await p.getTextContent(),op=await p.getOperatorList();let glyphs='';
  for(let j=0;j<op.fnArray.length;j++)if(op.fnArray[j]===OPS.showText)for(const g of op.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')glyphs+=g.unicode;
  const names={};for(const k of Object.keys(d.styles)){try{names[k]=p.commonObjs.get(k).name||''}catch{}}
  const items=repairSyntheticSpaces(d.items.filter(i=>'str'in i),glyphs),ah=extractAnswerHints(items,op,OPS,names),ex=extractWordBankPage(items,names,ah),offset=texts.reduce((n,t)=>n+t.length+2,0);
  hints.push(...ah,...ex.writtenAnswers.map(m=>({...m,source:'written',kind:m.kind==='choice'?'choice':undefined,line:'',answer:m.answer||'',start:m.start+offset,end:m.end+offset})));
  banks.push(...ex.wordBanks.map(b=>({...b,start:b.start+offset,end:b.end+offset,gaps:b.gaps.map(g=>({...g,start:g.start+offset,end:g.end+offset}))})));
  texts.push(ex.text);
 }
 await doc.destroy();const c=combinePages(texts),marks=detectExercises(c.text,hints,banks),parts=makeParts(c.text,marks),vocab=c.text.indexOf('VOCABULARY');
 const choices=marks.filter(m=>m.kind==='choice'&&m.start>vocab),bank=parts.find(p=>p.kind==='wordbank');
 assert.deepEqual(bank.options,['persevere','achieve','fitness','marathon','proud','programme','endurance','qualify']);assert.equal(bank.bankMode,'write');
 const bankIndex=parts.indexOf(bank),lastReferences=parts.slice(bankIndex+1).filter(p=>p.answer!==undefined).map(p=>p.answer);
 assert.deepEqual(lastReferences,['ACHIEVED','PROGRAMME','FITNESS','PERSEVERED','ENDURANCE','QUALIFY','MARATHON','PROUD']);
 const pick=fragment=>choices.find(q=>q.prompt.includes(fragment));
 assert.deepEqual(pick('important words').options,['depend on','stand out','review']);assert.equal(pick('important words').answer,'stand out');assert.ok(!pick('important words').prompt.includes('depend'));
 assert.deepEqual(pick('graphics').options,['multi-player','realistic','persuasive']);assert.equal(pick('graphics').answer,'realistic');assert.ok(!c.text.slice(pick('graphics').end,pick('graphics').end+30).includes('persuasive'));
 assert.deepEqual(pick('impressive advert').options,['social media','layout','submarine']);assert.equal(pick('impressive advert').answer,'layout');
 assert.deepEqual(pick('Jessica:').options,['captured','entertaining','highlighted']);assert.equal(pick('Jessica:').answer,'entertaining');
 assert.ok(pick('honey'));assert.ok(parts.every(p=>choiceIsValid(p,false)));assert.ok(wordBanksAreValid(parts,false));assert.ok(marks.every((m,i)=>!i||m.start>=marks[i-1].end));
 assert.deepEqual(mergeDetectedExercises(marks,detectExercises(c.text,hints,banks)).map(m=>m.id),marks.map(m=>m.id));
 const student=toStudentParts(parts);assert.ok(student.every(p=>p.answer===undefined));
 const visible=student.filter(p=>p.text).map(p=>p.text).join('');for(const reference of lastReferences)assert.ok(!visible.includes(reference));
 const keys=Object.fromEntries(parts.filter(p=>p.answer!==undefined).map(p=>[p.id,p.answer]));assert.ok(gradeObjectiveAnswers(parts,keys).every(a=>a.correct));
 if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify({filename:process.argv[2].split('/').at(-1),text:c.text,pdfPages:c.pages,marks,parts,pdfAnswerHints:hints,wordBankHints:banks}));
 console.log('PASS: original PDF: '+parts.filter(p=>p.answer!==undefined).length+' response fields, '+choices.length+' vocabulary selections, eight separate bank words, intact wraps and multiword keys, no overlapping fields, stable IDs and private solutions.');
}
console.log('PASS: tight bank spacing preserves normal phrase spaces; plain-font slash alternatives preserve bold multiword keys and wrapped endings; unnumbered A/B/C questions recognized.');
