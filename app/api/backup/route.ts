import {finalizeExpiredAttempts} from '../../../lib/timed-attempts';
import {env} from 'cloudflare:workers';
import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {BACKUP_FORMAT,validateBackup,type BackupData} from '../../../lib/backup-format';
import {privateHeaders as headers,tokenHash} from '../../../lib/exam-access';
import {withAnswerSizes} from '../../../lib/answer-size';
import {isWriting,missingReferences} from '../../../lib/exam-parts';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function GET(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();const examId=new URL(req.url).searchParams.get('exam');await finalizeExpiredAttempts(user.owner,examId||undefined);const filter='e.owner=?'+(examId?' AND e.id=?':'');const binds=[user.owner,...(examId?[examId]:[])];
  const [exams,submissions,reviews,publications]=await env.DB!.batch<any>([
   env.DB!.prepare(`SELECT e.* FROM exams e WHERE ${filter} ORDER BY e.created`).bind(...binds),
   env.DB!.prepare(`SELECT s.* FROM submissions s JOIN exams e ON e.id=s.exam_id WHERE ${filter} ORDER BY s.created`).bind(...binds),
   env.DB!.prepare(`SELECT r.* FROM submission_reviews r JOIN submissions s ON s.id=r.submission_id JOIN exams e ON e.id=s.exam_id WHERE ${filter}`).bind(...binds),
   env.DB!.prepare(`SELECT p.submission_id,p.payload,p.review_revision,p.published FROM submission_publications p JOIN submissions s ON s.id=p.submission_id JOIN exams e ON e.id=s.exam_id WHERE ${filter}`).bind(...binds)
  ]);
  if(examId&&!exams.results.length)return json({error:'Examen no encontrado.'},404);
  if(exams.results.length>100||submissions.results.length>300)return json({error:'El respaldo es muy grande. Descargalo por examen desde sus resultados.'},413);
  const audioIds=new Set<string>();for(const e of exams.results)for(const a of JSON.parse(e.audio_json||'[]'))audioIds.add(a.id);
  const allAudio=await env.DB!.prepare('SELECT id,name,mime,size FROM audio_files WHERE owner=?').bind(user.owner).all<any>();const audio=allAudio.results.filter(a=>audioIds.has(a.id));if(audio.length!==audioIds.size)return json({error:'Falta un audio del examen. Revisalo antes de crear el respaldo.'},409);
  const data:BackupData={format:BACKUP_FORMAT,version:1,id:crypto.randomUUID(),created:new Date().toISOString(),
   exams:exams.results.map(e=>({id:e.id,title:e.title,level:e.level,instructions:e.instructions,parts:JSON.parse(e.body),created:e.created,gradingMode:e.grading_mode,durationMinutes:e.duration_minutes,accepting:!!e.accepting,audio:JSON.parse(e.audio_json||'[]')})),
   submissions:submissions.results.map(s=>({id:s.id,examId:s.exam_id,name:s.name,course:s.course||'',answers:JSON.parse(s.answers),score:s.score,total:s.total,created:s.created,gradingStatus:s.grading_status,assessments:JSON.parse(s.feedback||'[]')})),
   reviews:reviews.results.map(r=>({submissionId:r.submission_id,finalGrade:r.final_grade,feedback:r.feedback,writingFeedback:JSON.parse(r.writing_feedback),updated:r.updated,revision:r.revision})),
   publications:publications.results.map(p=>({submissionId:p.submission_id,result:JSON.parse(p.payload),revision:p.review_revision,published:p.published})),audio};
  if(JSON.stringify(data).length>16*1024*1024)return json({error:'Los datos superan los 16 MB. Descargá un respaldo por examen.'},413);
  return json(data);
 }catch{return json({error:'No se pudo preparar el respaldo.'},503);}
}
export async function POST(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();const raw=await req.text();if(raw.length>16*1024*1024)return json({error:'El respaldo de datos supera los 16 MB. Usá respaldos por examen.'},413);
  let data;try{data=JSON.parse(raw);validateBackup(data.backup)}catch(e){return json({error:e instanceof Error?e.message:'Respaldo inválido.'},400)}
  const backup:BackupData=data.backup;const audioMap=data.audioMap;if(!audioMap||typeof audioMap!=='object'||Array.isArray(audioMap))return json({error:'Falta el mapa de audios del respaldo.'},400);
  const importId=await tokenHash(user.owner+':'+backup.id);const previous=await env.DB!.prepare('SELECT summary FROM backup_imports WHERE id=?').bind(importId).first<any>();if(previous)return json({...JSON.parse(previous.summary),alreadyImported:true});
  const own=await env.DB!.prepare('SELECT id,name,size FROM audio_files WHERE owner=?').bind(user.owner).all<any>();
  for(const old of backup.audio){const restored=own.results.find(a=>a.id===audioMap[old.id]);if(!restored||restored.size!==old.size)return json({error:'Falta restaurar un audio o su tamaño no coincide.'},400);}
  const examIds=new Map(backup.exams.map(e=>[e.id,crypto.randomUUID()]));const subIds=new Map(backup.submissions.map(s=>[s.id,crypto.randomUUID()]));const now=new Date().toISOString();const summary={exams:backup.exams.length,submissions:backup.submissions.length,reviews:backup.reviews.length};
  const statements=[env.DB!.prepare('INSERT INTO backup_imports(id,created,summary) VALUES(?,?,?)').bind(importId,now,JSON.stringify(summary))];
  for(const e of backup.exams){const audio=e.audio.map((a:any)=>({id:audioMap[a.id],title:a.title,...(a.exerciseIds?.length?{exerciseIds:a.exerciseIds}:{}),name:own.results.find(r=>r.id===audioMap[a.id])!.name,size:own.results.find(r=>r.id===audioMap[a.id])!.size}));statements.push(env.DB!.prepare('INSERT INTO exams(id,owner,title,level,instructions,body,created,grading_mode,audio_json,accepting,duration_minutes) VALUES(?,?,?,?,?,?,?,?,?,0,?)').bind(examIds.get(e.id),user.owner,e.title,e.level,e.instructions,JSON.stringify(e.parts),e.created,'exact',JSON.stringify(audio),e.durationMinutes));}
  for(const s of backup.submissions){const exam=backup.exams.find(e=>e.id===s.examId);const parts=withAnswerSizes(exam.parts);const pending=parts.some(isWriting)||missingReferences(parts)||s.gradingStatus!=='graded';statements.push(env.DB!.prepare('INSERT INTO submissions(id,exam_id,name,course,answers,score,total,created,grading_status,feedback,grading_error) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(subIds.get(s.id),examIds.get(s.examId),s.name,s.course,JSON.stringify(s.answers),s.score,s.total,s.created,pending?'awaiting_teacher':'graded',JSON.stringify(s.assessments),pending?'Entrega restaurada: revisá la corrección docente.':null));}
  for(const r of backup.reviews)statements.push(env.DB!.prepare('INSERT INTO submission_reviews(submission_id,final_grade,feedback,writing_feedback,reviewed_by,updated,revision) VALUES(?,?,?,?,?,?,1)').bind(subIds.get(r.submissionId),r.finalGrade,r.feedback,JSON.stringify(r.writingFeedback),user.userId,r.updated));
  await env.DB!.batch(statements);
  return json(summary,201);
 }catch{return json({error:'No se pudo restaurar el respaldo. No se reemplazaron los exámenes existentes. Intentá de nuevo.'},503);}
}
