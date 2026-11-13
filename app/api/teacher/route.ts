import {env} from 'cloudflare:workers';
import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){
 try{const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();return Response.json({userId:user.userId,displayName:user.displayName,email:user.email,role:user.role,schoolId:user.schoolId,schoolName:user.schoolName},{headers});}
 catch{return Response.json({error:'No se pudo abrir la cuenta docente.'},{status:503,headers});}
}
/** One-time, explicit claim of a browser-key workspace. Existing exam links stay unchanged. */
export async function POST(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();
  const raw=await req.text();if(raw.length>500)return Response.json({error:'Solicitud inválida.'},{status:400,headers});
  const {legacyKey}=JSON.parse(raw);if(typeof legacyKey!=='string'||!/^[\w-]{36,100}$/.test(legacyKey))return Response.json({error:'La clave anterior no es válida.'},{status:400,headers});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(legacyKey))),b=>b.toString(16).padStart(2,'0')).join('');
  const condition='EXISTS (SELECT 1 FROM teacher_legacy_claims WHERE legacy_hash=? AND user_id=?)';
  const result=await env.DB!.batch([
   env.DB!.prepare('INSERT OR IGNORE INTO teacher_legacy_claims(legacy_hash,user_id,created) VALUES(?,?,?)').bind(hash,user.userId,new Date().toISOString()),
   env.DB!.prepare('UPDATE exams SET owner=? WHERE owner=? AND '+condition).bind(user.owner,legacyKey,hash,user.userId),
   env.DB!.prepare('UPDATE audio_files SET owner=? WHERE owner=? AND '+condition).bind(user.owner,legacyKey,hash,user.userId)
  ]);
  const claim=await env.DB!.prepare('SELECT user_id FROM teacher_legacy_claims WHERE legacy_hash=?').bind(hash).first<{user_id:string}>();
  if(claim?.user_id!==user.userId)return Response.json({error:'Este espacio anterior ya está vinculado a otra cuenta docente.'},{status:409,headers});
  return Response.json({linked:true,exams:result[1].meta.changes,audios:result[2].meta.changes},{headers});
 }catch{return Response.json({error:'No se pudieron vincular los exámenes. Conservá tu clave anterior y volvé a intentarlo.'},{status:503,headers});}
}
