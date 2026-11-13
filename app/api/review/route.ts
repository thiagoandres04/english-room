import {env} from 'cloudflare:workers';
import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {withAnswerSizes} from '../../../lib/answer-size';
import {isWriting} from '../../../lib/exam-parts';
import type {WritingComment,TeacherReview} from '../../../lib/manual-review';
const headers={'Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function PUT(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();
  const raw=await req.text();if(raw.length>120000)return json({error:'La devolución es demasiado extensa.'},413);
  let data;try{data=JSON.parse(raw)}catch{return json({error:'Corrección inválida.'},400)}
  if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Corrección inválida.'},400);
  const {submissionId,finalGrade,feedback,writingFeedback,revision}=data;
  if(typeof submissionId!=='string'||!Number.isInteger(revision)||revision<0||typeof finalGrade!=='number'||!Number.isFinite(finalGrade)||finalGrade<0||finalGrade>10||Math.abs(finalGrade*100-Math.round(finalGrade*100))>0.000001||typeof feedback!=='string'||feedback.length>10000||!writingFeedback||typeof writingFeedback!=='object'||Array.isArray(writingFeedback))return json({error:'Ingresá una nota final entre 0 y 10 (hasta dos decimales) y revisá la devolución.'},400);
  const row=await env.DB!.prepare('SELECT e.body,s.grading_status,s.grading_started FROM submissions s JOIN exams e ON e.id=s.exam_id WHERE s.id=? AND e.owner=?').bind(submissionId,user.owner).first<any>();
  if(!row)return json({error:'No encontramos esa entrega en tu cuenta.'},404);
  const writing=withAnswerSizes(JSON.parse(row.body)).filter(isWriting);const ids=new Set(writing.map(p=>p.id!));
  const clean:Record<string,WritingComment>={};
  for(const [id,note] of Object.entries(writingFeedback)){
   const n=note as WritingComment;
   if(!ids.has(id)||!n||typeof n!=='object'||typeof n.feedback!=='string'||n.feedback.length>5000||!(n.grade===null||(typeof n.grade==='number'&&Number.isFinite(n.grade)&&n.grade>=0&&n.grade<=10&&Math.abs(n.grade*100-Math.round(n.grade*100))<0.000001)))return json({error:'Revisá los comentarios y las notas de writing (0 a 10).'},400);
   clean[id]={feedback:n.feedback.trim(),grade:n.grade};
  }
  const updated=new Date().toISOString();const stale=new Date(Date.now()-120000).toISOString();
  // The conditional upsert protects edits from another tab and an active AI claim.
  const saved=await env.DB!.prepare(`INSERT INTO submission_reviews(submission_id,final_grade,feedback,writing_feedback,reviewed_by,updated,revision)
   SELECT ?,?,?,?,?,?,1 WHERE EXISTS (SELECT 1 FROM submissions WHERE id=? AND (grading_status!='processing' OR grading_started IS NULL OR grading_started<?)) AND (?=0 OR EXISTS (SELECT 1 FROM submission_reviews WHERE submission_id=?))
   ON CONFLICT(submission_id) DO UPDATE SET final_grade=excluded.final_grade,feedback=excluded.feedback,writing_feedback=excluded.writing_feedback,reviewed_by=excluded.reviewed_by,updated=excluded.updated,revision=submission_reviews.revision+1
   WHERE submission_reviews.revision=? RETURNING revision`).bind(submissionId,finalGrade,feedback.trim(),JSON.stringify(clean),user.userId,updated,submissionId,stale,revision,submissionId,revision).first<{revision:number}>();
  if(!saved)return json({error:row.grading_status==='processing'&&row.grading_started>stale?'Esperá a que termine la corrección con IA y volvé a guardar.':'La corrección cambió en otra pestaña o dispositivo. Volvé a abrir la entrega para ver la versión guardada antes de editar.'},409);
  const review:TeacherReview={finalGrade,feedback:feedback.trim(),writingFeedback:clean,updated,revision:saved.revision};
  return json({review});
 }catch{return json({error:'No se pudo guardar la corrección. Tus comentarios siguen en pantalla; intentá de nuevo.'},503);}
}
