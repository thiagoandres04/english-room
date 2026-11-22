import type {ExamPart} from './exam-parts.ts';
import type {ListeningTrack} from './listening.ts';
import {exerciseTextLines} from './exercise-text-layout.ts';
export const MAX_AUDIO_ASSIGNMENTS=40;
export type AudioTarget={id:string;label:string;partIndex:number;offset:number|null};
function hash(text:string){let n=2166136261;for(const c of text){n=Math.imul(n^c.charCodeAt(0),16777619)}return (n>>>0).toString(36)}
/** Anchors depend on instruction text, not answer offsets or teacher solutions. */
export function audioTargets(parts:ExamPart[]):AudioTarget[]{
 const targets:AudioTarget[]=[];const seen=new Map<string,number>();let atLineStart=true;
 parts.forEach((part,partIndex)=>{
  const text=part.text??(['choice','multi-choice'].includes(part.kind||'')?part.prompt:undefined);
  if(text!==undefined){let offset=0;for(const line of exerciseTextLines(text,part.text===undefined||atLineStart)){
   if(line.kind==='heading'){
    const normalized=line.text.trim().replace(/\s+/g,' '),key=hash(normalized),occurrence=(seen.get(key)||0)+1;seen.set(key,occurrence);
    const number=/^\d{1,3}/.exec(normalized)?.[0];
    targets.push({id:`exercise:${key}:${occurrence}`,label:`${number?'Ejercicio '+number:'Consigna '+(targets.length+1)} · ${normalized.replace(/^\d{1,3}[.)]?\s*/,'').slice(0,130)}`,partIndex,offset:part.text===undefined?null:offset});
   }offset+=line.text.length;
  }}
  atLineStart=part.text!==undefined?/\n$/.test(part.text):['choice','multi-choice','wordbank'].includes(part.kind||'');
 });
 // Older exams may have no recognizable instruction. Allow placing an audio
 // beside a specific response rather than inventing an exercise association.
 if(!targets.length){let n=0;parts.forEach((p,partIndex)=>{if((p.blank||p.answer!==undefined)&&p.id)targets.push({id:'answer:'+p.id,label:'Respuesta '+(++n)+(p.prompt?' · '+p.prompt.slice(0,130):''),partIndex,offset:null})})}
 return targets;
}
export function validateAudioAssignments(value:unknown,parts?:ExamPart[]):string[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>MAX_AUDIO_ASSIGNMENTS||value.some(id=>typeof id!=='string'||id.length>140)||new Set(value).size!==value.length)throw new Error('Revisá los ejercicios asignados al audio.');
 if(parts){const ids=new Set(audioTargets(parts).map(t=>t.id));if(value.some(id=>!ids.has(id)))throw new Error('Cambió una consigna asignada al audio. Volvé a elegir sus ejercicios antes de guardar.');}
 return value;
}
export function unplacedAudio(tracks:ListeningTrack[],targets:AudioTarget[]){
 const ids=new Set(targets.map(t=>t.id));
 return tracks.filter(t=>!Array.isArray(t.exerciseIds)||!t.exerciseIds.some(id=>ids.has(id)));
}
