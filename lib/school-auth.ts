import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {hashPassword,verifyPassword,checkPassword,newToken,tokenHash} from './passwords';
export class AccessError extends Error{constructor(message:string,public status=400){super(message)}}
export const authHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export type SchoolUser={userId:string;displayName:string;email:string;fullName:null;owner:string;role:'admin'|'teacher';schoolId:string;schoolName:string};
export type School={id:string;name:string;created:number};
export const school=()=>env.DB!.prepare('SELECT id,name,created FROM school_settings WHERE id=?').bind('main').first<School>();
export function sameOrigin(req:Request){const origin=req.headers.get('Origin');return (!origin||origin===new URL(req.url).origin)&&req.headers.get('Sec-Fetch-Site')!=='cross-site';}
export function emailAddress(value:unknown){if(typeof value!=='string'||value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new AccessError('Escribí un correo válido.');return value.trim().toLowerCase();}
export function personName(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>100)throw new AccessError('Escribí un nombre (hasta 100 caracteres).');return value.trim();}
const local=(req:Request)=>['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname);
const cookieName=(req:Request)=>local(req)?'er_school_session':'__Host-er_school_session';
export function sessionCookie(req:Request,token:string,clear=false){return `${cookieName(req)}=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${local(req)?'':'; Secure'}`;}
function cookieToken(req:Request){const name=cookieName(req);const found=(req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));if(found.length!==1)return '';const token=found[0].slice(name.length+1);return /^[A-Za-z0-9_-]{43}$/.test(token)?token:'';}
export async function schoolSession(req:Request):Promise<SchoolUser|null>{
 const token=cookieToken(req);if(!token)return null;
 const row=await env.DB!.prepare('SELECT u.id AS userId,u.display_name AS displayName,u.email,u.role,u.school_id AS schoolId,s.name AS schoolName FROM school_sessions x JOIN school_users u ON u.id=x.user_id JOIN school_settings s ON s.id=u.school_id WHERE x.token_hash=? AND x.expires>? AND u.active=1').bind(await tokenHash(token),Date.now()).first<any>();
 return row?{...row,fullName:null,owner:'account:'+row.userId}:null;
}
export async function sessionRecord(userId:string){const token=newToken();return {token,statement:env.DB!.prepare('INSERT INTO school_sessions(token_hash,user_id,expires,created) VALUES(?,?,?,?)').bind(await tokenHash(token),userId,Date.now()+604800000,Date.now())};}
export async function limitAttempts(req:Request,key:string,max=12){
 const now=Date.now(),reset=now+900000;const hash=await tokenHash(key);
 const row=await env.DB!.prepare('INSERT INTO school_auth_limits(key_hash,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts').bind(hash,reset,now,now).first<{attempts:number}>();
 if((row?.attempts||0)>max)throw new AccessError('Demasiados intentos. Esperá 15 minutos antes de volver a probar.',429);
}
export const clientBucket=(req:Request)=>req.headers.get('CF-Connecting-IP')||'shared';
export async function login(req:Request,data:any){
 const email=emailAddress(data.email);await limitAttempts(req,'login-ip:'+clientBucket(req),100);await limitAttempts(req,'login-email:'+email,12);
 if(typeof data.password!=='string'||data.password.length>128)throw new AccessError('Correo o contraseña incorrectos.',401);
 const user=await env.DB!.prepare('SELECT id,password_hash,active FROM school_users WHERE email=?').bind(email).first<any>();
 const valid=await verifyPassword(data.password,user?.password_hash||'');if(!valid||!user?.active)throw new AccessError('Correo o contraseña incorrectos.',401);
 const session=await sessionRecord(user.id);await session.statement.run();return session.token;
}
export async function logout(req:Request){const token=cookieToken(req);if(token)await env.DB!.prepare('DELETE FROM school_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();}
export async function bootstrap(req:Request,data:any){
 await limitAttempts(req,'setup:'+clientBucket(req),8);
 if(await school())throw new AccessError('El colegio ya está configurado.',409);
 const token=typeof data.token==='string'?data.token:'';if(!/^[A-Za-z0-9_-]{43}$/.test(token)||!env.SCHOOL_SETUP_HASH||Date.now()>Number(env.SCHOOL_SETUP_EXPIRES||0)||await tokenHash(token)!==env.SCHOOL_SETUP_HASH)throw new AccessError('El enlace de configuración no es válido o venció.',403);
 const email=emailAddress(data.email),name=personName(data.name),schoolName=personName(data.schoolName);checkPassword(data.password);
 const password=await hashPassword(data.password),id=crypto.randomUUID(),claim=crypto.randomUUID(),now=Date.now(),session=await sessionRecord(id);
 const result=await env.DB!.batch([
  env.DB!.prepare('INSERT OR IGNORE INTO school_settings(id,name,created,setup_claim) VALUES(?,?,?,?)').bind('main',schoolName,now,claim),
  env.DB!.prepare('INSERT INTO school_users(id,school_id,email,display_name,password_hash,role,active,created) SELECT ?,?,?,?,?,?,1,? WHERE EXISTS (SELECT 1 FROM school_settings WHERE id=? AND setup_claim=?)').bind(id,'main',email,name,password,'admin',now,'main',claim),
  env.DB!.prepare('INSERT INTO school_sessions(token_hash,user_id,expires,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM school_users WHERE id=?) AND EXISTS (SELECT 1 FROM school_settings WHERE id=? AND setup_claim=?)').bind(await tokenHash(session.token),id,now+604800000,now,id,'main',claim)
 ]);
 if(!result[1].meta.changes||!result[2].meta.changes)throw new AccessError('El colegio ya fue configurado. Iniciá sesión.',409);
 return session.token;
}
export async function invitation(token:unknown){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AccessError('La invitación no es válida o venció.',410);
 const invite=await env.DB!.prepare('SELECT i.id,i.email,i.display_name AS name,i.role,i.kind,i.school_id,s.name AS schoolName FROM school_invites i JOIN school_settings s ON s.id=i.school_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.revoked=0 AND i.expires>?').bind(await tokenHash(token),Date.now()).first<any>();
 if(!invite)throw new AccessError('La invitación no es válida, ya fue utilizada o venció.',410);return invite;
}
export async function acceptInvite(req:Request,data:any){
 await limitAttempts(req,'accept:'+clientBucket(req),30);const invite=await invitation(data.token);checkPassword(data.password);
 const hash=await tokenHash(data.token),password=await hashPassword(data.password),now=Date.now(),claim=crypto.randomUUID();
 let id=crypto.randomUUID();if(invite.kind==='reset'){const user=await env.DB!.prepare('SELECT id FROM school_users WHERE email=? AND school_id=? AND active=1').bind(invite.email,invite.school_id).first<{id:string}>();if(!user)throw new AccessError('Consultá al administrador del colegio para recuperar el acceso.');id=user.id;}
 const session=await sessionRecord(id);const condition='EXISTS (SELECT 1 FROM school_invites WHERE id=? AND claim_id=?)';
 const operations=[env.DB!.prepare('UPDATE school_invites SET used_at=?,claim_id=? WHERE id=? AND used_at IS NULL AND revoked=0 AND expires>?').bind(now,claim,invite.id,now)];
 if(invite.kind==='reset'){
  operations.push(env.DB!.prepare('UPDATE school_users SET password_hash=? WHERE id=? AND active=1 AND '+condition).bind(password,id,invite.id,claim));
  operations.push(env.DB!.prepare('DELETE FROM school_sessions WHERE user_id=? AND '+condition).bind(id,invite.id,claim));
 }else operations.push(env.DB!.prepare('INSERT INTO school_users(id,school_id,email,display_name,password_hash,role,active,created) SELECT ?,?,?,?,?,?,1,? WHERE '+condition).bind(id,invite.school_id,invite.email,invite.name,password,invite.role,now,invite.id,claim));
 operations.push(env.DB!.prepare('INSERT INTO school_sessions(token_hash,user_id,expires,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM school_users WHERE id=? AND active=1) AND '+condition).bind(await tokenHash(session.token),id,now+604800000,now,id,invite.id,claim));
 const result=await env.DB!.batch(operations);if(!result[0].meta.changes||!result.at(-1)?.meta.changes)throw new AccessError('La invitación ya fue utilizada.',410);return session.token;
}
/** A user proves possession of both sessions before migrating their own previous material. */
export async function migratePrevious(req:Request,user:SchoolUser){
 const old=await getChatGPTUser();if(!old)throw new AccessError('Ingresá una vez con tu acceso anterior para recuperar ese material.',401);
 const oldOwner='account:'+old.userId;if(oldOwner===user.owner)return;
 await env.DB!.batch([
  env.DB!.prepare('UPDATE exams SET owner=? WHERE owner=?').bind(user.owner,oldOwner),
  env.DB!.prepare('UPDATE audio_files SET owner=? WHERE owner=?').bind(user.owner,oldOwner),
  env.DB!.prepare('UPDATE teacher_legacy_claims SET user_id=? WHERE user_id=?').bind(user.userId,old.userId),
  env.DB!.prepare("INSERT INTO teacher_drafts(user_id,payload,revision,updated) SELECT ?,payload,1,updated FROM teacher_drafts WHERE user_id=? ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,revision=teacher_drafts.revision+1,updated=excluded.updated WHERE COALESCE(trim(json_extract(teacher_drafts.payload,'$.text')),'')='' AND COALESCE(json_array_length(teacher_drafts.payload,'$.audio'),0)=0").bind(user.userId,old.userId)
 ]);
}
