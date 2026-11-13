import {selectionAnswerIsValid} from '../../../lib/multi-choice';
import {env} from 'cloudflare:workers';
import {validStudentToken,validSubmissionId,tokenHash,privateHeaders as headers} from '../../../lib/exam-access';
import {isSelection} from '../../../lib/exam-parts';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function POST(req:Request){
 try{
  const raw=await req.text();if(raw.length>2000)return json({error:'Solicitud demasiado grande.'},413);
  const {examId,submissionId,accessToken,name,course}=JSON.parse(raw);
  if(typeof examId!=='string'||!validSubmissionId(submissionId)||!validStudentToken(accessToken)||typeof name!=='string'||!name.trim()||name.length>120||typeof course!=='string'||!course.trim()||course.length>80)return json({error:'Completá tu nombre y curso antes de comenzar.'},400);
  const hash=await tokenHash(accessToken);const now=Date.now();
  const previous=await env.DB!.prepare('SELECT * FROM exam_attempts WHERE id=?').bind(submissionId).first<any>();
  if(previous){if(previous.token_hash!==hash||previous.exam_id!==examId)return json({error:'Este intento pertenece a otro acceso.'},403);const completed=await env.DB!.prepare('SELECT id FROM submissions WHERE id=?').bind(submissionId).first();return json({started:previous.started,deadline:previous.deadline,answers:JSON.parse(previous.answers),revision:previous.revision,name:previous.name,course:previous.course,now,completed:!!completed});}
  const exam=await env.DB!.prepare('SELECT duration_minutes,accepting FROM exams WHERE id=?').bind(examId).first<any>();
  if(!exam)return json({error:'Examen no encontrado.'},404);if(!exam.accepting)return json({error:'La profesora cerró las entregas de este examen.',closed:true},409);if(!exam.duration_minutes)return json({error:'Este examen no tiene tiempo límite.'},400);
  const deadline=now+exam.duration_minutes*60000;
  const inserted=await env.DB!.prepare("INSERT OR IGNORE INTO exam_attempts(id,exam_id,token_hash,name,course,started,deadline,answers,revision) SELECT ?,?,?,?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM exams WHERE id=? AND accepting=1 AND duration_minutes=?)").bind(submissionId,examId,hash,name.trim(),course.trim(),now,deadline,'{}',examId,exam.duration_minutes).run();
  if(!inserted.meta.changes)return json({error:'El examen cambió. Volvé a intentar comenzar.'},409);
  return json({started:now,deadline,now,revision:0,answers:{},name:name.trim(),course:course.trim(),completed:false},201);
 }catch{return json({error:'No se pudo iniciar el tiempo. Intentá de nuevo.'},503);}
}
export async function PUT(req:Request){
 try{
  const raw=await req.text();if(raw.length>100000)return json({error:'Las respuestas son demasiado extensas.'},413);
  const {submissionId,accessToken,answers,revision}=JSON.parse(raw);if(!validSubmissionId(submissionId)||!validStudentToken(accessToken)||!answers||typeof answers!=='object'||Array.isArray(answers)||!Number.isInteger(revision)||revision<0)return json({error:'Intento inválido.'},400);
  const hash=await tokenHash(accessToken);const row=await env.DB!.prepare('SELECT a.*,e.body,e.accepting FROM exam_attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=? AND a.token_hash=?').bind(submissionId,hash).first<any>();
  if(!row)return json({error:'Intento no encontrado.'},404);const now=Date.now();if(!row.accepting)return json({error:'La profesora cerró las entregas.',closed:true},409);if(now>=row.deadline)return json({error:'El tiempo terminó.',expired:true,now,deadline:row.deadline},410);
  const clean:Record<string,string>={};for(const p of JSON.parse(row.body).filter((p:any)=>p.answer!==undefined)){const v=answers[p.id]??'';if(typeof v!=='string'||v.length>6000||isSelection(p)&&v&&!selectionAnswerIsValid(p,v,false))return json({error:'Respuesta inválida.'},400);clean[p.id]=v;}
  const saved=await env.DB!.prepare('UPDATE exam_attempts SET answers=?,revision=revision+1 WHERE id=? AND token_hash=? AND revision=? AND deadline>? AND NOT EXISTS (SELECT 1 FROM submissions WHERE id=exam_attempts.id) AND EXISTS (SELECT 1 FROM exams WHERE id=exam_attempts.exam_id AND accepting=1)').bind(JSON.stringify(clean),submissionId,hash,revision,Date.now()).run();
  if(!saved.meta.changes)return json({error:'Este intento cambió en otra pestaña o terminó. Recargá para recuperar las respuestas guardadas.'},409);
  return json({revision:revision+1,now,deadline:row.deadline});
 }catch{return json({error:'No se pudieron guardar las respuestas. Conservamos la copia de este navegador.'},503);}
}
