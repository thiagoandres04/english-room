import {selectionAnswerIsValid} from '../../../lib/multi-choice';
import {isSelection,missingReferences,isWriting,gradeObjectiveAnswers} from '../../../lib/exam-parts';
import {withAnswerSizes} from '../../../lib/answer-size';
import {validStudentToken,validSubmissionId,tokenHash,newToken,privateHeaders as headers} from '../../../lib/exam-access';
import {env} from 'cloudflare:workers';
import {correctSubmission} from '../../../lib/grading';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function POST(req:Request){
 try{
  const raw=await req.text();if(raw.length>100000)return json({error:'La entrega es demasiado grande.'},413);
  const input=JSON.parse(raw);let {examId,name,course,answers}=input;
  if(typeof examId!=='string'||!answers||typeof answers!=='object'||Array.isArray(answers))return json({error:'Revisá los datos de la entrega.'},400);
  const id=validSubmissionId(input.submissionId)?input.submissionId:crypto.randomUUID();const token=validStudentToken(input.accessToken)?input.accessToken:newToken();const hash=await tokenHash(token);
  const previous=await env.DB!.prepare('SELECT s.exam_id,a.token_hash FROM submissions s LEFT JOIN submission_access a ON a.submission_id=s.id WHERE s.id=?').bind(id).first<any>();
  if(previous){if(previous.exam_id!==examId)return json({error:'No se pudo identificar la entrega.'},409);return json({id,received:true,...(previous.token_hash===hash?{accessToken:token}:{})},201);}
  const exam=await env.DB!.prepare('SELECT body,instructions,grading_mode,accepting,duration_minutes FROM exams WHERE id=?').bind(examId).first<any>();if(!exam)return json({error:'No encontramos el examen.'},404);
  if(!exam.accepting)return json({error:'La profesora cerró las entregas de este examen. Tus respuestas siguen en este navegador.',closed:true},409);
  const attempt=await env.DB!.prepare('SELECT * FROM exam_attempts WHERE id=?').bind(id).first<any>();
  if(exam.duration_minutes&&!attempt)return json({error:'Presioná Comenzar para iniciar el tiempo del examen.'},400);
  let expired=false;
  if(attempt){if(attempt.exam_id!==examId||attempt.token_hash!==hash)return json({error:'No pudimos verificar tu intento.'},403);name=attempt.name;course=attempt.course;expired=Date.now()>=attempt.deadline;if(expired)answers=JSON.parse(attempt.answers);}
  if(typeof name!=='string'||!name.trim()||name.length>120||typeof course!=='string'||!course.trim()||course.length>80)return json({error:'Completá tu nombre y curso.'},400);
  const parts=withAnswerSizes(JSON.parse(exam.body));const questions=parts.filter(p=>p.answer!==undefined);const clean:Record<string,string>={};
  for(const p of questions){const value=answers[p.id!]??'';if(typeof value!=='string'||value.length>6000||(!expired&&!value.trim()))return json({error:'Respondé todos los espacios antes de entregar (hasta 6.000 caracteres por respuesta).'},400);if(isSelection(p)&&value&&!selectionAnswerIsValid(p,value,!expired))return json({error:'Marcá una opción disponible en cada ejercicio.'},400);clean[p.id!]=value;}
  for(const bank of parts.filter(p=>p.kind==='wordbank'&&!p.reusable)){const values=questions.filter(p=>p.kind==='word-gap'&&p.bankId===bank.id).map(p=>clean[p.id!]).filter(Boolean);if(new Set(values).size!==values.length)return json({error:'Usá cada palabra del banco una sola vez.'},400);}
  const noReferences=missingReferences(questions);const hasWriting=questions.some(isWriting);const assessments=gradeObjectiveAnswers(parts,clean);const score=assessments.filter(a=>a.correct).length;
  const status=exam.grading_mode==='ai'&&!noReferences?'pending':hasWriting||noReferences?'awaiting_teacher':'graded';
  const reviewMessage=hasWriting?'El writing está pendiente de corrección docente.':noReferences?'Hay respuestas sin solución de referencia. Revisá la entrega y asigná una nota final.':null;
  const now=new Date().toISOString();
  const saved=await env.DB!.batch([
   env.DB!.prepare('INSERT OR IGNORE INTO submissions(id,exam_id,name,course,answers,score,total,created,grading_status,grading_error,feedback) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM exams WHERE id=? AND accepting=1)').bind(id,examId,name.trim().replace(/\s+/g,' '),course.trim().replace(/\s+/g,' '),JSON.stringify(clean),score,questions.length,now,status,reviewMessage,JSON.stringify(assessments),examId),
   env.DB!.prepare('INSERT OR IGNORE INTO submission_access(submission_id,token_hash) SELECT ?,? WHERE EXISTS (SELECT 1 FROM submissions WHERE id=? AND created=?)').bind(id,hash,id,now)
  ]);
  if(!saved[0].meta.changes){const existing=await env.DB!.prepare('SELECT s.id,a.token_hash FROM submissions s JOIN submission_access a ON a.submission_id=s.id WHERE s.id=? AND s.exam_id=?').bind(id,examId).first<any>();if(existing?.token_hash===hash)return json({id,received:true,accessToken:token},201);return json({error:'El examen se cerró antes de recibir la entrega. Tus respuestas se conservan.',closed:true},409);}
  if(!noReferences&&exam.grading_mode==='ai')await correctSubmission(id,exam);
  return json({id,received:true,accessToken:token,expired},201);
 }catch{return json({error:'No se pudo enviar. Tus respuestas siguen aquí; intentá de nuevo.'},503);}
}
