import {env} from 'cloudflare:workers';
import {MAX_AUDIO_TRACKS,type ListeningTrack} from './listening';
import {validateAudioAssignments} from './audio-placement';
import type {ExamPart} from './exam-parts';
export async function validateAudioTracks(value:unknown,owner:string,parts?:ExamPart[]):Promise<ListeningTrack[]>{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>MAX_AUDIO_TRACKS)throw new Error('Podés adjuntar hasta 5 audios por examen.');
 const seen=new Set<string>();const tracks:ListeningTrack[]=[];
 for(const item of value){
  if(!item||typeof item.id!=='string'||typeof item.title!=='string'||!item.title.trim()||item.title.length>120||seen.has(item.id))throw new Error('Revisá los títulos y los archivos de listening.');
  seen.add(item.id);
  const record=await env.DB!.prepare('SELECT id,name,size FROM audio_files WHERE id=? AND owner=?').bind(item.id,owner).first<{id:string;name:string;size:number}>();
  if(!record)throw new Error('Uno de los audios no pertenece a tu espacio o no está disponible. Volvé a cargarlo.');
  const exerciseIds=validateAudioAssignments(item.exerciseIds,parts);
  tracks.push({...record,title:item.title.trim(),...(exerciseIds.length?{exerciseIds}:{})});
 }
 return tracks;
}
