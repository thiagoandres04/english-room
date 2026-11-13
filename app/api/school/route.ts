import {env} from 'cloudflare:workers';
import {teacherIdentity} from '../../../lib/teacher-auth';
import {AccessError,authHeaders,sameOrigin,emailAddress,personName} from '../../../lib/school-auth';
import {newToken,tokenHash} from '../../../lib/passwords';
async function admin(req:Request){const user=await teacherIdentity(req);if(!user)throw new AccessError('Iniciá sesión en tu cuenta del colegio.',401);if(user.role!=='admin')throw new AccessError('Esta sección es para la administración del colegio.',403);return user;}
const failure=(e:unknown)=>Response.json({error:e instanceof AccessError?e.message:'No se pudo actualizar el colegio.'},{status:e instanceof AccessError?e.status:503,headers:authHeaders});
export async function GET(req:Request){try{const user=await admin(req);const teachers=await env.DB!.prepare('SELECT id,email,display_name AS name,role,active,created FROM school_users WHERE school_id=? ORDER BY created').bind(user.schoolId).all();const invitations=await env.DB!.prepare('SELECT id,email,display_name AS name,role,kind,expires,used_at AS usedAt,revoked,created FROM school_invites WHERE school_id=? ORDER BY created DESC LIMIT 100').bind(user.schoolId).all();return Response.json({schoolName:user.schoolName,teachers:teachers.results,invitations:invitations.results},{headers:authHeaders})}catch(e){return failure(e)}}
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))throw new AccessError('Solicitud no permitida.',403);const user=await admin(req);const raw=await req.text();if(raw.length>3000)throw new AccessError('Solicitud inválida.');const data=JSON.parse(raw),now=Date.now();
  if(data.action==='invite'||data.action==='reset'){
   const email=emailAddress(data.email),role=data.role==='admin'?'admin':'teacher';const existing=await env.DB!.prepare('SELECT id,active FROM school_users WHERE email=? AND school_id=?').bind(email,user.schoolId).first<any>();
   if(data.action==='invite'&&existing)throw new AccessError('Ese profesor ya tiene una cuenta. Usá Recuperar acceso.');
   if(data.action==='reset'&&(!existing||!existing.active))throw new AccessError('Activá la cuenta del profesor antes de recuperar su acceso.');
   const name=data.action==='invite'?personName(data.name):email,token=newToken(),id=crypto.randomUUID(),kind=data.action==='reset'?'reset':'invite',expires=now+(kind==='reset'?3600000:604800000);
   await env.DB!.batch([
    env.DB!.prepare('UPDATE school_invites SET revoked=1 WHERE school_id=? AND email=? AND used_at IS NULL AND revoked=0').bind(user.schoolId,email),
    env.DB!.prepare('INSERT INTO school_invites(id,school_id,email,display_name,role,kind,token_hash,expires,revoked,created,created_by) VALUES(?,?,?,?,?,?,?,?,0,?,?)').bind(id,user.schoolId,email,name,role,kind,await tokenHash(token),expires,now,user.userId)
   ]);
   return Response.json({id,url:new URL('/#invite='+token,req.url).toString(),expires,email},{status:201,headers:authHeaders});
  }
  if(data.action==='revoke'){await env.DB!.prepare('UPDATE school_invites SET revoked=1 WHERE id=? AND school_id=? AND used_at IS NULL').bind(data.id,user.schoolId).run();return Response.json({ok:true},{headers:authHeaders});}
  if(data.action==='active'){
   if(data.id===user.userId)throw new AccessError('No podés desactivar tu propia cuenta.');if(typeof data.active!=='boolean')throw new AccessError('Estado inválido.');
   const found=await env.DB!.prepare('SELECT id FROM school_users WHERE id=? AND school_id=?').bind(data.id,user.schoolId).first();if(!found)throw new AccessError('Profesor no encontrado.',404);
   await env.DB!.batch([env.DB!.prepare('UPDATE school_users SET active=? WHERE id=? AND school_id=?').bind(data.active?1:0,data.id,user.schoolId),env.DB!.prepare('DELETE FROM school_sessions WHERE user_id=?').bind(data.id)]);return Response.json({ok:true},{headers:authHeaders});
  }
  throw new AccessError('Acción inválida.');
 }catch(e){return failure(e)}
}
