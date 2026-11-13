import {PasswordPolicyError} from '../../../lib/passwords';
import {getChatGPTUser} from '../../chatgpt-auth';
import {AccessError,authHeaders,school,schoolSession,sameOrigin,login,logout,bootstrap,invitation,acceptInvite,sessionCookie,migratePrevious} from '../../../lib/school-auth';
export async function GET(req:Request){try{const settings=await school();const user=await schoolSession(req),previous=await getChatGPTUser();return Response.json({configured:!!settings,schoolName:settings?.name||'',user,previousAccountAvailable:!!previous,previousEmail:previous?.email||''},{headers:authHeaders})}catch{return Response.json({error:'No se pudo abrir el acceso del colegio.'},{status:503,headers:authHeaders})}}
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))throw new AccessError('Solicitud no permitida.',403);
  if(!req.headers.get('Content-Type')?.includes('application/json'))throw new AccessError('Solicitud inválida.',415);
  const raw=await req.text();if(raw.length>12000)throw new AccessError('Solicitud demasiado grande.',413);const data=JSON.parse(raw);
  if(data.action==='lookup'){const i=await invitation(data.token);return Response.json({email:i.email,name:i.name,schoolName:i.schoolName,kind:i.kind},{headers:authHeaders});}
  if(data.action==='logout'){await logout(req);return Response.json({ok:true},{headers:{...authHeaders,'Set-Cookie':sessionCookie(req,'',true)}});}
  if(data.action==='migrate'){const user=await schoolSession(req);if(!user||req.headers.get('X-Teacher-Account')!==user.userId)throw new AccessError('Volvé a iniciar sesión en tu cuenta del colegio.',401);await migratePrevious(req,user);return Response.json({ok:true},{headers:authHeaders});}
  const token=data.action==='login'?await login(req,data):data.action==='bootstrap'?await bootstrap(req,data):data.action==='accept'?await acceptInvite(req,data):null;
  if(!token)throw new AccessError('Solicitud inválida.');return Response.json({ok:true},{headers:{...authHeaders,'Set-Cookie':sessionCookie(req,token)}});
 }catch(e){return Response.json({error:e instanceof AccessError||e instanceof PasswordPolicyError?e.message:'No se pudo completar el acceso. Intentá de nuevo.'},{status:e instanceof AccessError?e.status:e instanceof PasswordPolicyError||e instanceof SyntaxError?400:503,headers:authHeaders});}
}
