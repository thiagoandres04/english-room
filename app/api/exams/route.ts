import {figuresAreValid} from '../../../lib/exam-figures';
import {multiChoiceIsValid} from '../../../lib/multi-choice';
import {finalizeExpiredAttempts} from '../../../lib/timed-attempts';
import {durationIsValid,validStudentToken,tokenHash} from '../../../lib/exam-access';
import {withAnswerSizes} from '../../../lib/answer-size';
import {reviewFromRow} from '../../../lib/manual-review';
import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {validateAudioTracks} from '../../../lib/audio-records';
import {toStudentParts,choiceGroupsAreValid,choiceIsValid,wordBanksAreValid,isWriting} from '../../../lib/exam-parts';
import { env } from 'cloudflare:workers';
const headers={'Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function GET(req:Request) {
 try {
  const url=new URL(req.url);const id=url.searchParams.get('id'); const account=await teacherIdentity(req);const owner=account?.owner;
  if(id){
   const exam=await env.DB!.prepare('SELECT * FROM exams WHERE id=?').bind(id).first<any>();
   if(!exam)return json({error:'No encontramos este examen. Revisá el enlace.'},404);
   const parts=withAnswerSizes(JSON.parse(exam.body));
   if(url.searchParams.get('view')==='delete'){
    if(!owner)return teacherLoginRequired();if(owner!==exam.owner)return json({error:'No encontramos ese examen en tu cuenta.'},404);
    const counts=await env.DB!.prepare(`SELECT
     (SELECT COUNT(*) FROM submissions WHERE exam_id=?) AS deliveries,
     (SELECT COUNT(*) FROM submission_reviews r JOIN submissions s ON s.id=r.submission_id WHERE s.exam_id=?) AS corrections,
     (SELECT COUNT(*) FROM submission_publications p JOIN submissions s ON s.id=p.submission_id WHERE s.exam_id=?) AS publications,
     (SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id=? AND a.deadline>? AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.id=a.id)) AS activeAttempts`).bind(id,id,id,id,Date.now()).first<any>();
    return json({id:exam.id,title:exam.title,created:exam.created,accepting:!!exam.accepting,...counts});
   }
   if(url.searchParams.get('view')==='teacher'){if(!owner)return teacherLoginRequired();if(owner!==exam.owner)return json({error:'No encontramos ese examen en tu cuenta.'},404);await finalizeExpiredAttempts(owner,id);const results=await env.DB!.prepare('SELECT s.id,s.name,s.course,s.answers,s.score,s.total,s.created,s.grading_status,s.feedback,s.grading_error,r.final_grade,r.feedback AS teacher_feedback,r.writing_feedback,r.updated AS review_updated,r.revision AS review_revision,p.published AS published_at,p.review_revision AS published_revision FROM submissions s LEFT JOIN submission_reviews r ON r.submission_id=s.id LEFT JOIN submission_publications p ON p.submission_id=s.id WHERE s.exam_id=? ORDER BY s.created DESC').bind(id).all();return json({...exam,owner:undefined,parts,body:undefined,audio_json:undefined,audio:JSON.parse(exam.audio_json||'[]'),results:results.results.map((r:any)=>({...r,review:reviewFromRow(r),publication:r.published_at?{published:r.published_at,revision:r.published_revision}:null,grading_status:r.review_revision!=null?'reviewed':parts.some(isWriting)&&r.grading_status==='graded'?'awaiting_teacher':r.grading_status}))});}
   let canRead=true;if(exam.duration_minutes){const attemptId=req.headers.get('X-Attempt-Id'),token=req.headers.get('Authorization')?.replace(/^Bearer /,'');canRead=!!(attemptId&&validStudentToken(token)&&await env.DB!.prepare('SELECT id FROM exam_attempts WHERE id=? AND exam_id=? AND token_hash=?').bind(attemptId,id,await tokenHash(token)).first());}
   return json({id:exam.id,title:exam.title,level:exam.level,accepting:!!exam.accepting,durationMinutes:exam.duration_minutes,instructions:exam.instructions,parts:canRead?toStudentParts(parts):[],audio:JSON.parse(exam.audio_json||'[]')});
  }
  if(!owner)return teacherLoginRequired();
  const rows=await env.DB!.prepare('SELECT e.id,e.title,e.level,e.created,e.accepting,e.duration_minutes AS durationMinutes,(SELECT COUNT(*) FROM submissions s WHERE s.exam_id=e.id) AS deliveries FROM exams e WHERE e.owner=? ORDER BY e.created DESC').bind(owner).all();
  return json(rows.results);
 }catch{return json({error:'No se pudo conectar. Volvé a intentarlo.'},503);}
}
export async function POST(req:Request){
 try{
  const account=await teacherIdentity(req);const owner=account?.owner;if(!owner)return teacherLoginRequired();
  const raw=await req.text();if(raw.length>250000)return json({error:'El examen es demasiado largo.'},413);
  const data=JSON.parse(raw);const {title,level,instructions,parts}=data;const duration=data.durationMinutes??null;if(!durationIsValid(duration))return json({error:'El tiempo debe ser de 1 a 480 minutos, o sin límite.'},400);const gradingMode=data.gradingMode==='ai'?'ai':'exact';
  if(gradingMode==='ai'&&!env.OPENAI_API_KEY)return json({error:'La IA todavía no está configurada.'},503);
  if(typeof title!=='string'||!title.trim()||title.length>120||typeof level!=='string'||level.length>30||typeof instructions!=='string'||instructions.length>2000||!Array.isArray(parts)||parts.length>1000)return json({error:'Revisá los datos del examen.'},400);
  let blanks=0;const ids=new Set();
  if(parts.some((p:any)=>!p||typeof p!=='object'))return json({error:'Hay ejercicios inválidos.'},400);
  if(!figuresAreValid(parts))return json({error:'Revisá las imágenes de referencia del examen.'},400);
  if(!choiceGroupsAreValid(parts))return json({error:"Revisá los ejercicios de relacionar y clasificar."},400);
  if(!wordBanksAreValid(parts,false))return json({error:'Revisá los bancos de palabras y las soluciones de sus casilleros.'},400);
  for(const p of parts){if(p.kind&&!['text','choice','multi-choice','wordbank','word-gap','figure'].includes(p.kind))return json({error:'Tipo de ejercicio inválido.'},400);if(p.kind==='wordbank'||p.kind==='figure'){if(typeof p.id!=='string'||!p.id||ids.has(p.id))return json({error:'Identificador repetido.'},400);ids.add(p.id);continue;}if(!choiceIsValid(p,false)||!multiChoiceIsValid(p,false))return json({error:'Revisá los enunciados, las opciones y la solución de cada selección.'},400);if(p.answer!==undefined){if(typeof p.answer!=='string'||p.answer.length>6000||typeof p.id!=='string'||ids.has(p.id)||(p.rubric!==undefined&&typeof p.rubric!=='string')||(p.multiline!==undefined&&typeof p.multiline!=='boolean')||(p.wide!==undefined&&typeof p.wide!=='boolean'))return json({error:'Hay respuestas inválidas.'},400);ids.add(p.id);blanks++;}else if(typeof p.text!=='string')return json({error:'Hay texto inválido.'},400);}
  if(gradingMode==='ai'&&blanks>60)return json({error:'La corrección con IA admite hasta 60 respuestas por examen.'},400);
  if(!blanks)return json({error:'Marcá al menos una respuesta para ocultar.'},400);
  let audio;try{audio=await validateAudioTracks(data.audio,owner,parts)}catch(e){return json({error:e instanceof Error?e.message:'Revisá los audios.'},400);}
  const id=crypto.randomUUID();await env.DB!.prepare('INSERT INTO exams(id,owner,title,level,instructions,body,created,grading_mode,audio_json,duration_minutes) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,owner,title.trim(),level,instructions,JSON.stringify(parts),new Date().toISOString(),gradingMode,JSON.stringify(audio),duration).run();return json({id},201);
 }catch{return json({error:'No se pudo guardar el examen. Intentá otra vez.'},503);}
}
export async function PATCH(req:Request){
 try{
  const account=await teacherIdentity(req);const owner=account?.owner;if(!owner)return teacherLoginRequired();
  const raw=await req.text();if(raw.length>64000)return json({error:'La actualización es demasiado grande.'},413);
  const data=JSON.parse(raw);if(typeof data.id!=='string')return json({error:'Examen inválido.'},400);
  const exam=await env.DB!.prepare('SELECT id,duration_minutes,body FROM exams WHERE id=? AND owner=?').bind(data.id,owner).first<any>();if(!exam)return json({error:'No encontramos ese examen en tu espacio.'},404);
  const commands=[];const result:any={};
  if(data.accepting===false)await finalizeExpiredAttempts(owner,data.id);
  if(data.accepting!==undefined){if(typeof data.accepting!=='boolean')return json({error:'Estado inválido.'},400);commands.push(env.DB!.prepare('UPDATE exams SET accepting=? WHERE id=? AND owner=?').bind(data.accepting?1:0,data.id,owner));if(data.accepting)commands.push(env.DB!.prepare('DELETE FROM submission_publications WHERE submission_id IN (SELECT id FROM submissions WHERE exam_id=?)').bind(data.id));result.accepting=data.accepting;}
  if(data.durationMinutes!==undefined){if(!durationIsValid(data.durationMinutes))return json({error:'El tiempo debe ser de 1 a 480 minutos, o sin límite.'},400);commands.push(env.DB!.prepare('UPDATE exams SET duration_minutes=? WHERE id=? AND owner=?').bind(data.durationMinutes,data.id,owner));result.durationMinutes=data.durationMinutes;}
  if(data.audio!==undefined){let audio;try{audio=await validateAudioTracks(data.audio,owner,JSON.parse(exam.body))}catch(e){return json({error:e instanceof Error?e.message:'Revisá los audios.'},400);}commands.push(env.DB!.prepare('UPDATE exams SET audio_json=? WHERE id=? AND owner=?').bind(JSON.stringify(audio),data.id,owner));result.audio=audio;}
  if(!commands.length)return json({error:'No hay cambios para guardar.'},400);
  await env.DB!.batch(commands);return json(result);
 }catch{return json({error:'No se pudieron actualizar los audios. Volvé a intentarlo.'},503);}
}

/** Delete only an owned, closed exam and its dependent records in one transaction. */
export async function DELETE(req:Request){
 try{
  const account=await teacherIdentity(req);if(!account)return teacherLoginRequired();
  const raw=await req.text();if(raw.length>2000)return json({error:'Solicitud inválida.'},400);
  let data;try{data=JSON.parse(raw)}catch{return json({error:'Solicitud inválida.'},400)}
  if(!data||typeof data.id!=='string'||data.id.length>100||data.confirmation!=='ELIMINAR'||!Number.isInteger(data.expectedDeliveries)||data.expectedDeliveries<0)return json({error:'Escribí ELIMINAR para confirmar y revisá las entregas del examen.'},400);
  const owner=account.owner;
  const exam=await env.DB!.prepare('SELECT id,accepting FROM exams WHERE id=? AND owner=?').bind(data.id,owner).first<any>();
  if(!exam)return json({error:'No encontramos ese examen en tu cuenta.'},404);
  if(exam.accepting!==0)return json({error:'Cerrá las entregas antes de eliminar el examen.',closeRequired:true},409);
  // -1 is an internal claim visible only inside this atomic D1 batch. A successful
  // batch removes the row; any failure rolls back its original closed state.
  // The claim also checks the count shown in the confirmation before deleting.
  const claimed='SELECT id FROM exams WHERE id=? AND owner=? AND accepting=-1';
  const submitted=`SELECT id FROM submissions WHERE exam_id IN (${claimed})`;
  const bind=[data.id,owner];
  const results=await env.DB!.batch([
   env.DB!.prepare('UPDATE exams SET accepting=-1 WHERE id=? AND owner=? AND accepting=0 AND (SELECT COUNT(*) FROM submissions WHERE exam_id=exams.id)=?').bind(...bind,data.expectedDeliveries),
   env.DB!.prepare(`DELETE FROM submission_publications WHERE submission_id IN (${submitted})`).bind(...bind),
   env.DB!.prepare(`DELETE FROM submission_access WHERE submission_id IN (${submitted})`).bind(...bind),
   env.DB!.prepare(`DELETE FROM submission_reviews WHERE submission_id IN (${submitted})`).bind(...bind),
   env.DB!.prepare(`DELETE FROM exam_attempts WHERE exam_id IN (${claimed})`).bind(...bind),
   env.DB!.prepare(`DELETE FROM submissions WHERE exam_id IN (${claimed})`).bind(...bind),
   env.DB!.prepare('DELETE FROM exams WHERE id=? AND owner=? AND accepting=-1').bind(...bind)
  ]);
  if(!results[results.length-1].meta.changes)return json({error:'El examen cambió desde que abriste la confirmación. Actualizá los datos y revisalos antes de borrar.'},409);
  return json({deleted:true,id:data.id});
 }catch{return json({error:'No se pudo eliminar el examen. No se aplicaron cambios; intentá de nuevo.'},503);}
}
