import assert from 'node:assert/strict';import fs from 'node:fs';
import {extractAnswerHints,detectExercises,mergeDetectedExercises} from '../lib/pdf-exercises.ts';
import {extractWordBankPage} from '../lib/pdf-word-banks.ts';
import {repairSyntheticSpaces,extractPageText,combinePages} from '../lib/pdf-text.ts';
import {makeParts,toStudentParts,choiceIsValid,gradeSelections} from '../lib/exam-parts.ts';
const fonts={regular:'Test-Regular',italic:'Test-Italic',bold:'Test-Bold',boldItalic:'Test-BoldItalic'};
const ops={constructPath:4,moveTo:13,lineTo:14,curveTo:15,curveTo2:16,curveTo3:17,closePath:18,rectangle:19};
const empty={fnArray:[],argsArray:[]};
function sentence(secondFont='boldItalic'){
 let x=20;return [['6','bold'],['There','regular'],['were several exciting activities','italic'],['/','italic'],['was plenty of free time',secondFont],['during the trip.','regular']].map(([str,fontName])=>{const item={str,fontName,transform:[10,0,0,10,x,700],width:str.length*4,height:10};x+=item.width+5;return item;});
}
let items=sentence();let text=extractPageText(items);let hints=extractAnswerHints(items,empty,ops,fonts);let marks=detectExercises(text,hints);
assert.equal(marks.length,1);assert.deepEqual(marks[0].options,['were several exciting activities','was plenty of free time']);assert.equal(marks[0].prompt,'6 There ____ during the trip.');assert.equal(marks[0].answer,'was plenty of free time');
// Both alternatives bold is a presentation style, not a valid solution key.
items=sentence('boldItalic').map(i=>i.fontName==='italic'?{...i,fontName:'boldItalic'}:i);text=extractPageText(items);hints=extractAnswerHints(items,empty,ops,fonts);assert.equal(detectExercises(text,hints)[0].answer,'');
const right=items.find(i=>i.str==='was plenty of free time');const line={fnArray:[ops.constructPath],argsArray:[[[ops.moveTo,ops.lineTo],[right.transform[4],699,right.transform[4]+right.width,699]]]};
assert.equal(detectExercises(text,extractAnswerHints(items,line,ops,fonts))[0].answer,right.str);
// A phrase split into separate PDF glyph runs remains one bold alternative.
const split=sentence().flatMap(item=>item.str==='was plenty of free time'?item.str.split(' ').map((str,i,words)=>({...item,str,transform:[10,0,0,10,item.transform[4]+words.slice(0,i).join(' ').length*4+(i?4:0),700],width:str.length*4})):item);
assert.equal(detectExercises(extractPageText(split),extractAnswerHints(split,empty,ops,fonts))[0].answer,'was plenty of free time');
// A wide vector ring can surround a phrase, including in a compound path.
const left=items.find(i=>i.str==='were several exciting activities');const x=left.transform[4]-2,w=left.width+4,y=697,h=16;
const ellipse=[ops.moveTo,ops.curveTo,ops.curveTo,ops.curveTo,ops.curveTo,ops.closePath];
const points=[x,y+h/2,x,y,x+w,y,x+w,y+h/2,x+w,y+h/2,x+w,y+h,x+w/2,y+h,x+w/2,y+h,x,y+h,x,y+h/2,x,y+h/2,x,y,x,y+h/2];
const ring={fnArray:[ops.constructPath],argsArray:[[ellipse,points]]};
assert.equal(detectExercises(text,extractAnswerHints(items,ring,ops,fonts))[0].answer,left.str);
const conflicting={fnArray:[...ring.fnArray,...line.fnArray],argsArray:[...ring.argsArray,...line.argsArray]};assert.equal(detectExercises(text,extractAnswerHints(items,conflicting,ops,fonts))[0].answer,'');
const publicParts=toStudentParts(makeParts(text,detectExercises(text,extractAnswerHints(items,line,ops,fonts))));assert.ok(publicParts.every(p=>p.answer===undefined));
// A period printed in the option font belongs to the sentence, not its key.
const final=sentence().slice(0,-1).map(i=>i.str==='was plenty of free time'?{...i,str:i.str+'.',width:i.width+4}:i);
const finalChoice=detectExercises(extractPageText(final),extractAnswerHints(final,empty,ops,fonts))[0];assert.equal(finalChoice.answer,'was plenty of free time');assert.equal(finalChoice.prompt,'6 There ____.');
// A bold question number does not turn the plain statement into an option.
const boolean=[{...sentence()[0],str:'1'}, {...sentence()[1],str:'The classroom is open. T / F',width:150}];
const boolChoice=detectExercises(extractPageText(boolean),extractAnswerHints(boolean,empty,ops,fonts))[0];assert.deepEqual(boolChoice.options,['T','F']);assert.match(boolChoice.prompt,/The classroom is open\./);
const clue=[{...sentence()[0],str:'1'}, {...sentence()[1],str:'(your friends / play chess at school?)',width:180}];assert.equal(detectExercises(extractPageText(clue),extractAnswerHints(clue,empty,ops,fonts)).length,0);

if(process.argv[2]){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2]))}).promise;
 const pages=[],answerHints=[],banks=[];
 for(let n=1;n<=pdf.numPages;n++){
  const page=await pdf.getPage(n),data=await page.getTextContent(),op=await page.getOperatorList();let raw='';
  for(let j=0;j<op.fnArray.length;j++)if(op.fnArray[j]===OPS.showText)for(const g of op.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')raw+=g.unicode;
  const fonts={};for(const k of Object.keys(data.styles)){try{fonts[k]=page.commonObjs.get(k).name||''}catch{}}
  const items=repairSyntheticSpaces(data.items.filter(i=>'str'in i),raw);answerHints.push(...extractAnswerHints(items,op,OPS,fonts));
  const extracted=extractWordBankPage(items,fonts),offset=pages.reduce((n,t)=>n+t.length+2,0);
  banks.push(...extracted.wordBanks.map(b=>({...b,start:b.start+offset,end:b.end+offset,gaps:b.gaps.map(g=>({...g,start:g.start+offset,end:g.end+offset}))})));pages.push(extracted.text);
 }
 await pdf.destroy();const combined=combinePages(pages);const marks=detectExercises(combined.text,answerHints,banks),choices=marks.filter(m=>m.kind==='choice');
 assert.equal(choices.length,6);assert.ok(choices.every(p=>choiceIsValid(p)));assert.deepEqual(choices.map(p=>p.answer),['interested','locker','university','safe','gym','was lots of litter']);
 assert.deepEqual(choices[5].options,['were lots of special effects','was lots of litter']);assert.match(choices[5].prompt,/^6 There ____ in the cloakroom/);
 assert.equal(banks.length,2);assert.equal(marks.filter(m=>m.kind==='word-gap').length,12);
 for(const b of banks)for(const g of b.gaps)assert.equal(combined.text.slice(g.start,g.end),g.answer);
 const parts=makeParts(combined.text,marks);assert.equal(parts.filter(p=>p.answer!==undefined).length,18);assert.equal(gradeSelections(parts,Object.fromEntries(parts.filter(p=>p.answer!==undefined).map(p=>[p.id,p.answer]))).filter(a=>a.correct).length,18);
 assert.ok(toStudentParts(parts).every(p=>p.answer===undefined));assert.ok(marks.every((m,i)=>i===0||m.start>=marks[i-1].end));
 const before={...choices[5],id:'old-phrase',prompt:'6 There were lots of special ____ lots of litter in the cloakroom, so we helped tidy it up.',options:['effects','was'],answer:''};const updated=mergeDetectedExercises([before],marks);assert.deepEqual(updated.find(m=>m.start===before.start).options,choices[5].options);
 console.log('PASS: original Reading Jrs 2 PDF: 6 complete choices with circle/underline solutions, 2 word banks, 18 private reference answers and valid offsets.');
}
console.log('PASS: multiword and split bold options, ambiguous bold rejected, wide rings and underlines recognized, student solutions private.');
