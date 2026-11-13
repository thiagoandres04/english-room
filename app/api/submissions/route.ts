import {finalizeExpiredAttempts} from '../../../lib/timed-attempts';
import {withAnswerSizes} from '../../../lib/answer-size';
import {isWriting} from '../../../lib/exam-parts';
import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {env} from 'cloudflare:workers';
export async function GET(req:Request){
 const headers={'Cache-Control':'no-store'};
 try{
  const account=await teacherIdentity(req);if(!account)return teacherLoginRequired();const owner=account.owner;await finalizeExpiredAttempts(owner);
  const rows=await env.DB!.prepare(`SELECT s.id,s.exam_id AS examId,e.title AS examTitle,e.level,e.body,s.name,s.course,s.score,s.total,s.created,CASE WHEN r.submission_id IS NOT NULL THEN 'reviewed' ELSE s.grading_status END AS gradingStatus,r.final_grade AS finalGrade FROM submissions s JOIN exams e ON e.id=s.exam_id LEFT JOIN submission_reviews r ON r.submission_id=s.id WHERE e.owner=? ORDER BY s.created DESC`).bind(owner).all();
  return Response.json(rows.results.map((row:any)=>{const {body,...summary}=row;return {...summary,gradingStatus:summary.gradingStatus==='graded'&&withAnswerSizes(JSON.parse(body)).some(isWriting)?'awaiting_teacher':summary.gradingStatus}}),{headers});
 }catch{return Response.json({error:'No se pudieron cargar los exámenes entregados. Volvé a intentarlo.'},{status:503,headers});}
}
