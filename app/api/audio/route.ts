import {teacherIdentity,teacherLoginRequired} from '../../../lib/teacher-auth';
import {env} from 'cloudflare:workers';
import {MAX_AUDIO_BYTES,parseAudioRange,sniffAudio} from '../../../lib/listening';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 try{
  const user=await teacherIdentity(req);if(!user)return teacherLoginRequired();
  const owner=user.owner;
  if(!env.BUCKET)return json({error:'El almacenamiento de audio todavía no está disponible.'},503);
  const length=Number(req.headers.get('Content-Length')||0);if(length>MAX_AUDIO_BYTES+1024*1024)return json({error:'Cada audio puede pesar hasta 25 MB.'},413);
  const form=await req.formData();const file=form.get('file');
  if(!file||typeof file==='string'||file.size<12||file.size>MAX_AUDIO_BYTES)return json({error:'Elegí un audio válido de hasta 25 MB.'},400);
  const mime=sniffAudio(new Uint8Array(await file.slice(0,32).arrayBuffer()));
  if(!mime)return json({error:'El archivo no es un audio compatible. Usá MP3, M4A, WAV, OGG o WebM.'},415);
  const id=crypto.randomUUID();const objectKey='listening/'+id;const name=file.name.replace(/[\\/\u0000-\u001f]/g,'').slice(0,180)||'Audio';
  await env.BUCKET.put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:mime}});
  try{await env.DB!.prepare('INSERT INTO audio_files(id,owner,uploader_id,object_key,name,mime,size,created) VALUES(?,?,?,?,?,?,?,?)').bind(id,owner,user.userId,objectKey,name,mime,file.size,new Date().toISOString()).run();}
  catch(error){await env.BUCKET.delete(objectKey);throw error;}
  return json({id,name,size:file.size,title:name.replace(/\.[a-z0-9]+$/i,'')||'Listening'},201);
 }catch{return json({error:'No se pudo subir el audio. Intentá de nuevo.'},503);}
}
async function serve(req:Request,head=false){
 try{
  const url=new URL(req.url);const id=url.searchParams.get('id');if(!id)return json({error:'Falta el audio.'},400);
  const row=await env.DB!.prepare('SELECT owner,object_key,mime,size FROM audio_files WHERE id=?').bind(id).first<{owner:string;object_key:string;mime:string;size:number}>();
  if(!row)return json({error:'Audio no encontrado.'},404);
  const teacher=(await teacherIdentity(req))?.owner===row.owner;
  if(!teacher){
   const examId=url.searchParams.get('exam');const exam=examId?await env.DB!.prepare('SELECT audio_json FROM exams WHERE id=?').bind(examId).first<{audio_json:string|null}>():null;
   if(!exam||!JSON.parse(exam.audio_json||'[]').some((a:any)=>a.id===id))return json({error:'Este audio no está disponible para ese examen.'},404);
  }
  if(!env.BUCKET)return json({error:'Audio no disponible.'},503);
  let range:ReturnType<typeof parseAudioRange>;
  try{range=parseAudioRange(req.headers.get('Range'),row.size)}catch{return new Response(null,{status:416,headers:{'Content-Range':`bytes */${row.size}`,'Accept-Ranges':'bytes'}})}
  const headers=new Headers({'Content-Type':row.mime,'Content-Length':String(range?.length||row.size),'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=0, must-revalidate'});
  if(range)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${row.size}`);
  if(head){if(!await env.BUCKET.head(row.object_key))return json({error:'Audio no encontrado.'},404);return new Response(null,{status:range?206:200,headers});}
  const object=await env.BUCKET.get(row.object_key,range?{range}:undefined);if(!object)return json({error:'Audio no encontrado.'},404);
  return new Response(object.body,{status:range?206:200,headers});
 }catch{return json({error:'No se pudo cargar el audio. Volvé a intentarlo.'},503);}
}
export async function GET(req:Request){return serve(req)}
export async function HEAD(req:Request){return serve(req,true)}
