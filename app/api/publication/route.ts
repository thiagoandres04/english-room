import {formatAnswer} from '../../../lib/multi-choice';
import {env} from 'cloudflare:workers';
import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {newToken,tokenHash,privateHeaders as headers} from '../../../lib/exam-access';
import {questionContexts,isWriting} from '../../../lib/exam-parts';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function POST(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();const raw=await req.text();if(raw.length>2000)return json({error:'Solicitud inválida.'},400);
  const {submissionId,action,revision}=JSON.parse(raw);if(typeof submissionId!=='string'||!['publish','withdraw','link'].includes(action))return json({error:'Solicitud inválida.'},400);
  const row=await env.DB!.prepare('SELECT s.*,e.title,e.level,e.body,e.accepting,r.final_grade,r.feedback AS teacher_feedback,r.writing_feedback,r.updated AS review_updated,r.revision AS review_revision FROM submissions s JOIN exams e ON e.id=s.exam_id LEFT JOIN submission_reviews r ON r.submission_id=s.id WHERE s.id=? AND e.owner=?').bind(submissionId,user.owner).first<any>();
  if(!row)return json({error:'Entrega no encontrada.'},404);
  if(action==='withdraw'){await env.DB!.prepare('DELETE FROM submission_publications WHERE submission_id=?').bind(submissionId).run();return json({publication:null});}
  if(row.accepting)return json({error:'Cerrá las entregas del examen antes de publicar las devoluciones.'},409);
  if(action==='link'){
   const token=newToken();const saved=await env.DB!.prepare('UPDATE submission_publications SET share_hash=? WHERE submission_id=?').bind(await tokenHash(token),submissionId).run();if(!saved.meta.changes)return json({error:'Publicá primero la devolución.'},409);
   return json({url:new URL('/?result='+submissionId,req.url).href+'#access='+token});
  }
  if(!row.review_revision||revision!==row.review_revision)return json({error:'Guardá la nota final y volvé a abrir la entrega antes de publicar.'},409);
  const answers=JSON.parse(row.answers);const comments=JSON.parse(row.writing_feedback);
  const payload={examTitle:row.title,level:row.level,name:row.name,course:row.course,submitted:row.created,finalGrade:row.final_grade,feedback:row.teacher_feedback,questions:questionContexts(JSON.parse(row.body)).map(({part:p,prompt},i)=>({number:i+1,prompt,answer:formatAnswer(p,answers[p.id!]),writing:isWriting(p),feedback:comments[p.id!]?.feedback||'',grade:comments[p.id!]?.grade??null}))};
  const published=new Date().toISOString();
  const saved=await env.DB!.prepare(`INSERT INTO submission_publications(submission_id,payload,review_revision,published) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM submission_reviews WHERE submission_id=? AND revision=?) AND EXISTS (SELECT 1 FROM exams e JOIN submissions s ON s.exam_id=e.id WHERE s.id=? AND e.accepting=0)
   ON CONFLICT(submission_id) DO UPDATE SET payload=excluded.payload,review_revision=excluded.review_revision,published=excluded.published`).bind(submissionId,JSON.stringify(payload),revision,published,submissionId,revision,submissionId).run();
  if(!saved.meta.changes)return json({error:'La corrección o el examen cambiaron. Volvé a abrir la entrega.'},409);
  return json({publication:{published,revision}});
 }catch{return json({error:'No se pudo actualizar la publicación. Intentá de nuevo.'},503);}
}
