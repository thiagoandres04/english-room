import {validateAudioAssignments} from './audio-placement';
import {multiChoiceIsValid} from './multi-choice';
import {choiceIsValid,wordBanksAreValid,type ExamPart} from './exam-parts';
const durationIsValid=(v:unknown)=>v===null||(typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=480);
export const BACKUP_FORMAT='english-room-backup';
export const MAX_BACKUP_BYTES=200*1024*1024;
export type BackupData={format:string;version:number;id:string;created:string;exams:any[];submissions:any[];reviews:any[];publications:any[];audio:any[]};
/** Validate all restored records before writing any. Identity and access tokens are excluded. */
export function validateBackup(v:any):asserts v is BackupData{
 const bad=()=>{throw new Error('El archivo no es un respaldo válido de English Room.');};
 const str=(s:any,max:number)=>typeof s==='string'&&s.length<=max;
 if(!v||v.format!==BACKUP_FORMAT||v.version!==1||!str(v.id,100)||!v.id||!str(v.created,60)||!Array.isArray(v.exams)||v.exams.length>100||!Array.isArray(v.submissions)||v.submissions.length>300||!Array.isArray(v.reviews)||v.reviews.length>300||!Array.isArray(v.audio)||v.audio.length>500||!Array.isArray(v.publications)||v.publications.length>1000)bad();
 const examIds=new Set<string>(),subIds=new Set<string>(),audioIds=new Set<string>(),reviewIds=new Set<string>();
 for(const a of v.audio){if(!a||!str(a.id,100)||!a.id||audioIds.has(a.id)||!str(a.name,180)||!str(a.mime,100)||!Number.isInteger(a.size)||a.size<12||a.size>25*1024*1024)bad();audioIds.add(a.id);}
 for(const e of v.exams){
  if(!e||!str(e.id,100)||!e.id||examIds.has(e.id)||!str(e.title,120)||!e.title.trim()||!str(e.level,30)||!str(e.instructions,2000)||!str(e.created,60)||!durationIsValid(e.durationMinutes)||!Array.isArray(e.parts)||!e.parts.length||e.parts.length>1000||!Array.isArray(e.audio)||e.audio.length>5)bad();
  const ids=new Set<string>();let count=0;
  for(const part of e.parts as ExamPart[]){if(!part||typeof part!=='object'||part.kind&&!['text','choice','multi-choice','wordbank','word-gap'].includes(part.kind))bad();if(part.id!==undefined){if(!str(part.id,100)||ids.has(part.id))bad();ids.add(part.id!);}if(part.answer!==undefined){count++;if(!part.id||!str(part.answer,6000)||part.multiline!==undefined&&typeof part.multiline!=='boolean'||part.rubric!==undefined&&!str(part.rubric,10000))bad();}else if(part.kind!=='wordbank'&&!str(part.text,180000))bad();if(!choiceIsValid(part,false)||!multiChoiceIsValid(part,false))bad();}
  if(!count||JSON.stringify(e.parts).length>250000||!wordBanksAreValid(e.parts,false)||e.audio.some((a:any)=>!a||!audioIds.has(a.id)||!str(a.title,120)||!a.title.trim()))bad();try{for(const a of e.audio)validateAudioAssignments(a.exerciseIds,e.parts)}catch{bad()}examIds.add(e.id);
 }
 for(const s of v.submissions){if(!s||!str(s.id,100)||!s.id||subIds.has(s.id)||!examIds.has(s.examId)||!str(s.name,120)||!s.name.trim()||!str(s.course,80)||!str(s.created,60)||!Number.isInteger(s.score)||s.score<0||!Number.isInteger(s.total)||s.total<1||s.score>s.total||!s.answers||typeof s.answers!=='object'||Array.isArray(s.answers)||Object.values(s.answers).some(a=>!str(a,6000))||!Array.isArray(s.assessments)||s.assessments.length>1000||s.assessments.some((a:any)=>!a||!str(a.id,100)||typeof a.correct!=='boolean'||!str(a.feedback,5000)))bad();const e=v.exams.find((e:any)=>e.id===s.examId);const questions=e.parts.filter((p:any)=>p.answer!==undefined);if(s.total!==questions.length||Object.keys(s.answers).some(id=>!questions.some((p:any)=>p.id===id)))bad();subIds.add(s.id);}
 const grade=(n:any)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=10;
 for(const r of v.reviews){if(!r||!subIds.has(r.submissionId)||reviewIds.has(r.submissionId)||!grade(r.finalGrade)||!str(r.feedback,10000)||!str(r.updated,60)||!r.writingFeedback||typeof r.writingFeedback!=='object'||Array.isArray(r.writingFeedback)||Object.values(r.writingFeedback).some((n:any)=>!n||!str(n.feedback,5000)||n.grade!==null&&!grade(n.grade)))bad();reviewIds.add(r.submissionId);}
}
