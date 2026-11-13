import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {env} from 'cloudflare:workers';
import {correctSubmission} from '../../../lib/grading';
export async function POST(req:Request){
 const headers={'Cache-Control':'no-store'};
 try{
  const account=await teacherIdentity(req);if(!account)return teacherLoginRequired();const owner=account.owner;
  const raw=await req.text();if(raw.length>1000)return Response.json({error:'Solicitud inválida.'},{status:400,headers});
  const {submissionId}=JSON.parse(raw);if(typeof submissionId!=='string')return Response.json({error:'Entrega inválida.'},{status:400,headers});
  const exam=await env.DB!.prepare('SELECT e.* FROM exams e JOIN submissions s ON e.id=s.exam_id WHERE s.id=? AND e.owner=?').bind(submissionId,owner).first<any>();
  if(!exam)return Response.json({error:'No encontramos esa entrega en tu espacio.'},{status:404,headers});
  const review=await env.DB!.prepare('SELECT submission_id FROM submission_reviews WHERE submission_id=?').bind(submissionId).first();
  if(review)return Response.json({error:'La entrega ya tiene una nota final docente. Editá la corrección manual para cambiarla.'},{status:409,headers});
  if(exam.grading_mode!=='ai')return Response.json({error:'Este examen usa corrección por coincidencia.'},{status:400,headers});
  // A terminated request can leave a claim behind; release it after two minutes.
  await env.DB!.prepare("UPDATE submissions SET grading_status='pending' WHERE id=? AND grading_status='processing' AND grading_started<?").bind(submissionId,new Date(Date.now()-120000).toISOString()).run();
  await correctSubmission(submissionId,exam);
  const row=await env.DB!.prepare('SELECT grading_status,grading_error FROM submissions WHERE id=?').bind(submissionId).first<any>();
  if(row?.grading_status==='pending')return Response.json({error:row.grading_error||'La corrección sigue pendiente.'},{status:503,headers});
  return Response.json({status:row?.grading_status},{headers});
 }catch{return Response.json({error:'La entrega está guardada. No se pudo reintentar la corrección.'},{status:503,headers});}
}
