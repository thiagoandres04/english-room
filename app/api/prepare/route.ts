import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {validateAudioTracks} from '../../../lib/audio-records';
import {env} from 'cloudflare:workers';
import {prepareExam,AIError} from '../../../lib/ai';
export async function POST(req:Request){
 const headers={'Cache-Control':'no-store'};
 try{
  const account=await teacherIdentity(req);if(!account)return teacherLoginRequired();const owner=account.owner;
  const raw=await req.text();if(raw.length>140000)return Response.json({error:'Para preparar con IA, dividí el material en archivos de hasta 30.000 caracteres.'},{status:413,headers});
  const {text,level,audio}=JSON.parse(raw);
  if(typeof text!=='string'||text.trim().length<15||text.length>30000||typeof level!=='string'||level.length>30)return Response.json({error:'La IA admite entre 15 y 30.000 caracteres por examen. Revisá el texto y el nivel.'},{status:400,headers});
  let tracks;try{tracks=await validateAudioTracks(audio,owner)}catch(e){return Response.json({error:e instanceof Error?e.message:'Revisá los audios.'},{status:400,headers});}
  return Response.json(await prepareExam(env.OPENAI_API_KEY,text,level,fetch,tracks.length>0),{headers});
 }catch(e){return Response.json({error:e instanceof AIError?e.message:'No pudimos preparar el examen. Revisá el material.'},{status:e instanceof AIError?e.status:503,headers});}
}
