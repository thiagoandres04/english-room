import assert from 'node:assert/strict';
import fs from 'node:fs';
import {detectExercises,mergeDetectedExercises} from '../lib/pdf-exercises.ts';
import {makeParts,toStudentParts,gradeSelections,choiceIsValid} from '../lib/exam-parts.ts';
import {combinePages} from '../lib/pdf-text.ts';

const text=`2 Listen and choose the correct option.
1 The first speaker explains
why she changed her plans.
A she wanted to spend more time
with her family.
B she had to finish an important
project at work.
C her friend suggested a different plan.

2 The second speaker says that
A the station is next to the park.

B the train arrives at
half past seven.

C she has already bought her ticket.
Score: / 2

READING
6 Choose the correct option.
1 Before starting, the writer suggests you should
A think about the benefits of changing
your routine.
B make every change on the first day.
Score: / 1
Unrelated material must stay in the document.`;
const hints=[{source:'circle',line:'B she had to finish an important',answer:'B'},{source:'circle',line:'C she has already bought her ticket.',answer:'C'},{source:'circle',line:'A think about the benefits of changing',answer:'A'}];
const marks=detectExercises(text,hints);assert.equal(marks.length,3);
assert.equal(marks[0].prompt,'1 The first speaker explains why she changed her plans.');
assert.deepEqual(marks[0].options,['A she wanted to spend more time with her family.','B she had to finish an important project at work.','C her friend suggested a different plan.']);
assert.equal(marks[1].options[1],'B the train arrives at half past seven.');
assert.equal(marks[2].options[0],'A think about the benefits of changing your routine.');
assert.deepEqual(marks.map(m=>m.answer[0]),['B','C','A']);
assert.ok(marks.every(m=>choiceIsValid(m)));assert.ok(marks.every((m,i)=>i===0||m.start>=marks[i-1].end));
const parts=makeParts(text,marks);assert.equal(gradeSelections(parts,Object.fromEntries(marks.map(m=>[m.id,m.answer]))).filter(a=>a.correct).length,3);
const student=toStudentParts(parts);assert.ok(!JSON.stringify(student).includes('"answer"'));assert.ok(student.some(p=>p.text?.includes('Unrelated material')));
assert.ok(student.filter(p=>p.kind==='choice').every(p=>p.options.every(o=>!o.includes('Score:'))));
const split=combinePages([text.slice(0,text.indexOf('project at work.')),text.slice(text.indexOf('project at work.'))]);
assert.equal(detectExercises(split.text,hints)[0].options[1],marks[0].options[1]);
// Existing teacher choices must survive extending an incomplete detected span.
const old={...marks[0],id:'teacher-edited-id',end:text.indexOf('project at work.')-1,options:['A she wanted to spend more time','B she had to finish an important'],answer:'A she wanted to spend more time'};
const merged=mergeDetectedExercises([old],marks);assert.equal(merged[0].id,old.id);assert.equal(merged[0].answer,marks[0].options[0]);
assert.equal(mergeDetectedExercises(merged,detectExercises(text,hints))[0].id,old.id);
const manuallyMarked={id:'manual',start:text.indexOf('with her family.'),end:text.indexOf('with her family.')+16,multiline:false};
assert.ok(mergeDetectedExercises([manuallyMarked],marks).some(m=>m.id==='manual'));
assert.ok(!mergeDetectedExercises([manuallyMarked],marks).some(m=>m.kind==='choice'&&m.start===marks[0].start));
const oldBank=[{id:'old-bank',kind:'wordbank',start:0,end:6,options:['one','two'],reusable:false},{id:'old-gap',kind:'word-gap',bankId:'old-bank',start:10,end:13,options:['one','two'],answer:'two'}];
const newBank=[{...oldBank[0],id:'new-bank'},{...oldBank[1],id:'new-gap',bankId:'new-bank',answer:'one'}];
const bankMerged=mergeDetectedExercises(oldBank,newBank);assert.equal(bankMerged[1].bankId,'old-bank');assert.equal(bankMerged[1].answer,'two');
const oldChecklist={id:'old-checklist',kind:'multi-choice',start:20,end:50,prompt:'Tick two.',options:['A first item','B second item'],answer:'["A first item"]'};
const checkMerged=mergeDetectedExercises([oldChecklist],[{...oldChecklist,id:'new-checklist',answer:'["B second item"]'}]);assert.equal(checkMerged[0].answer,oldChecklist.answer);
assert.equal(detectExercises('1 How did it happen?\nA short answer without alternatives.\n2 Another question?\nIt happened yesterday.').filter(m=>m.kind==='choice').length,0);
assert.equal(detectExercises('1 Choose the correct sentence.\nA It is sunny.\nC It is cloudy.').length,0);
assert.equal(detectExercises('1 The writer believes\nA one idea\nB another idea\n\nA paragraph outside the choices.\nREADING').filter(m=>m.kind==='choice').length,0);

// Optional private browser-extracted pages; copyrighted source stays untracked.
if(process.argv[2]){
 const pages=JSON.parse(fs.readFileSync(process.argv[2]));const combined=combinePages(pages);const all=detectExercises(combined.text);assert.equal(all.length,24);
 const c=all.filter(m=>m.options?.[0]?.startsWith('A '));assert.equal(c.length,12);
 const section2=/^2 Listen\b/m.exec(combined.text).index,section3=/^3 Read\b/m.exec(combined.text).index,section6=/^6 Choose\b/m.exec(combined.text).index;
 const inSection2=c.filter(m=>m.start>section2&&m.start<section3);
 for(const n of [2,4,5])assert.equal(inSection2.find(m=>m.prompt.startsWith(n+' ')).options.length,3);
 assert.equal(c.find(m=>m.start>section6&&m.prompt.startsWith('4 ')).options.length,2);
 for(const m of c)assert.equal((m.prompt+' '+m.options.join(' ')).replace(/\s+/g,' ').trim(),combined.text.slice(m.start,m.end).replace(/\s+/g,' ').trim());
 assert.ok(c.every(m=>choiceIsValid(m,false)));assert.ok(all.every((m,i)=>i===0||m.start>=all[i-1].end));
 console.log('PASS: actual three-page exam: all 24 questions; exercise 2 points 2/4/5 and exercise 6 point 4 complete.');
}
console.log('PASS: wrapped stems and A/B/C options, page breaks, marked solutions, document boundaries, stable IDs and teacher edits.');
