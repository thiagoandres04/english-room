import {schoolSession,sameOrigin} from './school-auth';
/** Only the school's server-side session authenticates teachers. */
export async function teacherIdentity(req:Request){
 if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req))return null;
 const user=await schoolSession(req);const expected=req.headers.get('X-Teacher-Account');if(expected&&expected!==user?.userId)return null;return user;
}
export const teacherLoginRequired=()=>Response.json({error:'Iniciá sesión con tu correo y contraseña del colegio.',loginRequired:true},{status:401,headers:{'Cache-Control':'no-store'}});
