import {env} from 'cloudflare:workers';
import {withAnswerSizes} from './answer-size';
import {gradeObjectiveAnswers,isWriting,missingReferences} from './exam-parts';
/** Lazily finalize expired server snapshots, including attempts whose browser was closed. */
export async function finalizeExpiredAttempts(owner:string,examId?:string){
 const rows=await env.DB!.prepare(`SELECT a.*,e.body,e.grading_mode FROM exam_attempts a JOIN exams e ON e.id=a.exam_id LEFT JOIN submissions s ON s.id=a.id WHERE e.owner=? AND e.accepting=1 AND a.deadline<=? AND s.id IS NULL${examId?' AND e.id=?':''} LIMIT 100`).bind(owner,Date.now(),...(examId?[examId]:[])).all<any>();
 for(const a of rows.results){const parts=withAnswerSizes(JSON.parse(a.body));const answers=JSON.parse(a.answers);const questions=parts.filter(p=>p.answer!==undefined);const clean=Object.fromEntries(questions.map(p=>[p.id!,answers[p.id!]||'']));const assessments=gradeObjectiveAnswers(parts,clean);const score=assessments.filter(v=>v.correct).length;const status=a.grading_mode==='ai'&&!missingReferences(parts)?'pending':parts.some(isWriting)||missingReferences(parts)?'awaiting_teacher':'graded';const now=new Date().toISOString();await env.DB!.batch([
  env.DB!.prepare('INSERT OR IGNORE INTO submissions(id,exam_id,name,course,answers,score,total,created,grading_status,feedback,grading_error) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM exams WHERE id=? AND accepting=1)').bind(a.id,a.exam_id,a.name,a.course,JSON.stringify(clean),score,questions.length,now,status,JSON.stringify(assessments),status==='graded'?null:'Entrega automática al finalizar el tiempo. Revisá la corrección docente.',a.exam_id),
  env.DB!.prepare('INSERT OR IGNORE INTO submission_access(submission_id,token_hash) SELECT ?,? WHERE EXISTS (SELECT 1 FROM submissions WHERE id=? AND created=?)').bind(a.id,a.token_hash,a.id,now)
 ]);}
}
