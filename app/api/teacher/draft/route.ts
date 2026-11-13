import {env} from 'cloudflare:workers';
import {teacherIdentity,teacherLoginRequired} from '../../../../lib/teacher-auth';
const headers={'Cache-Control':'no-store'};
export async function GET(req:Request){
 try{const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();const row=await env.DB!.prepare('SELECT payload,revision,updated FROM teacher_drafts WHERE user_id=?').bind(user.userId).first<{payload:string;revision:number;updated:string}>();return Response.json(row?{draft:JSON.parse(row.payload),revision:row.revision,updated:row.updated}:{draft:null,revision:0},{headers});}
 catch{return Response.json({error:'No se pudo recuperar el borrador de tu cuenta.'},{status:503,headers});}
}
export async function PUT(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();const raw=await req.text();if(raw.length>900000)return Response.json({error:'El borrador es demasiado grande para guardar en la cuenta.'},{status:413,headers});
  const {draft,revision}=JSON.parse(raw);if(!Number.isInteger(revision)||revision<0||!draft||typeof draft!=='object'||Array.isArray(draft)||typeof draft.text!=='string'||draft.text.length>180000||!Array.isArray(draft.marks)||draft.marks.length>1000)return Response.json({error:'Borrador inválido.'},{status:400,headers});
  const updated=new Date().toISOString();
  const result=revision===0
   ?await env.DB!.prepare('INSERT OR IGNORE INTO teacher_drafts(user_id,payload,revision,updated) VALUES(?,?,1,?)').bind(user.userId,JSON.stringify(draft),updated).run()
   :await env.DB!.prepare('UPDATE teacher_drafts SET payload=?,revision=revision+1,updated=? WHERE user_id=? AND revision=?').bind(JSON.stringify(draft),updated,user.userId,revision).run();
  if(!result.meta.changes)return Response.json({error:'El borrador cambió en otro dispositivo. Recargá la página para ver la versión guardada.'},{status:409,headers});
  return Response.json({revision:revision+1,updated},{headers});
 }catch{return Response.json({error:'No se pudo guardar el borrador en tu cuenta. Tu copia local sigue disponible.'},{status:503,headers});}
}
