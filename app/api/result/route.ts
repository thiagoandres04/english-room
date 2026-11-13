import {env} from 'cloudflare:workers';
import {validStudentToken,validSubmissionId,tokenHash,privateHeaders as headers} from '../../../lib/exam-access';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export async function GET(req:Request){
 try{
  const id=new URL(req.url).searchParams.get('id');const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!validSubmissionId(id)||!validStudentToken(token))return json({error:'Usá el enlace personal de tu devolución.'},404);
  const hash=await tokenHash(token);
  const row=await env.DB!.prepare('SELECT p.payload,p.published,e.accepting,a.token_hash,p.share_hash FROM submissions s JOIN exams e ON e.id=s.exam_id LEFT JOIN submission_access a ON a.submission_id=s.id LEFT JOIN submission_publications p ON p.submission_id=s.id WHERE s.id=?').bind(id).first<any>();
  if(!row||(hash!==row.token_hash&&hash!==row.share_hash))return json({error:'El enlace no está disponible. Pedile tu enlace personal a la profesora.'},404);
  if(!row.payload||row.accepting)return json({published:false});
  return json({published:true,result:{...JSON.parse(row.payload),published:row.published}});
 }catch{return json({error:'No se pudo consultar la devolución. Intentá de nuevo.'},503);}
}
