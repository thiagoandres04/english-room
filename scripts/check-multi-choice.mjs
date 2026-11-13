import assert from 'node:assert/strict';
import {detectExercises} from '../lib/pdf-exercises.ts';
import {makeParts,toStudentParts,gradeObjectiveAnswers,missingReferences} from '../lib/exam-parts.ts';
import {multiAnswerIsValid,selectionMatches,isAnswered} from '../lib/multi-choice.ts';
const worksheet=`LISTENING
1 Listen and tick the three sentences you hear.
1 The library opens at nine.
✓
2 The bus arrives at six.
3 The cafe serves breakfast.
✓
4 The station is near the park.
5 The museum closes on Monday.
6 The school has a new garden.
✓
Score: / 3`;
const marks=detectExercises(worksheet);assert.equal(marks.length,1);
const parts=makeParts(worksheet,marks);const q=parts.find(p=>p.kind==='multi-choice');
assert.equal(q.selectCount,3);assert.equal(q.options.length,6);assert.deepEqual(JSON.parse(q.answer),[q.options[0],q.options[2],q.options[5]]);
const student=toStudentParts(parts).find(p=>p.kind==='multi-choice');assert.equal('answer' in student,false);assert.equal(student.selectCount,3);
assert.equal(selectionMatches(q,JSON.stringify([...JSON.parse(q.answer)].reverse())),true);
assert.equal(gradeObjectiveAnswers(parts,{[q.id]:q.answer})[0].correct,true);
assert.equal(isAnswered(q,JSON.stringify([q.options[0]])),false);
assert.equal(multiAnswerIsValid(q,JSON.stringify([q.options[0]]),false),true);
assert.equal(multiAnswerIsValid(q,JSON.stringify([q.options[0],q.options[0],q.options[2]])),false);
assert.equal(missingReferences([detectExercises(worksheet.replace(/^✓\n/gm,''))[0]]),true);
console.log('PASS: synthetic listening checklist, hidden solutions, selection count and deterministic grading.');
