import {selectionMatches,formatAnswer} from './multi-choice.ts';
import {withAnswerSizes} from './answer-size.ts';
import type {ExamFigure} from './exam-figures.ts';
export type ExamPart={text?:string;id?:string;answer?:string;rubric?:string;multiline?:boolean;wide?:boolean;blank?:boolean;kind?:'text'|'choice'|'multi-choice'|'wordbank'|'word-gap'|'figure';figure?:ExamFigure;prompt?:string;options?:string[];bankId?:string;bankMode?:'write';inline?:boolean;reusable?:boolean;selectCount?:number;groupId?:string;groupStyle?:'matching'|'categories'};
export type ExerciseMark=ExamPart&{start:number;end:number;id:string;section?:ExamPart[]};
export function makeParts(text:string,marks:ExerciseMark[]):ExamPart[]{
 const parts:ExamPart[]=[];let position=0;
 for(const mark of [...marks].sort((a,b)=>a.start-b.start)){
  if(mark.start>position)parts.push({text:text.slice(position,mark.start)});
  if(mark.section){parts.push(...mark.section);position=mark.end;continue;}
  parts.push(mark.kind==='figure'?{id:mark.id,kind:'figure',figure:mark.figure}:mark.kind==='wordbank'?{id:mark.id,kind:'wordbank',options:mark.options,reusable:mark.reusable,...(mark.bankMode?{bankMode:mark.bankMode}:{})}:mark.kind==='word-gap'?{id:mark.id,kind:'word-gap',bankId:mark.bankId,options:mark.options,answer:mark.answer||''}:mark.kind==='choice'||mark.kind==='multi-choice'?{id:mark.id,kind:mark.kind,prompt:mark.prompt,options:mark.options,answer:mark.answer||'',...(mark.inline?{inline:true}:{}),...(mark.groupId?{groupId:mark.groupId,groupStyle:mark.groupStyle}:{}),...(mark.selectCount?{selectCount:mark.selectCount}:{})}:{id:mark.id,answer:mark.blank?(mark.answer||''):text.slice(mark.start,mark.end),...(mark.wide?{wide:true}:{}),...(mark.multiline!==undefined?{multiline:mark.multiline}:{})});
  position=mark.end;
 }
 if(position<text.length)parts.push({text:text.slice(position)});
 return withAnswerSizes(parts);
}
export function choiceLabel(value:string){return value==='T'?'True':value==='F'?'False':value==='NI'?'No information':value;}
export function toStudentParts(parts:ExamPart[]):ExamPart[]{return withAnswerSizes(parts).map(p=>p.kind==='figure'?{kind:p.kind,id:p.id,figure:p.figure}:p.kind==='wordbank'?{kind:p.kind,id:p.id,options:p.options,reusable:p.reusable,...(p.bankMode?{bankMode:p.bankMode}:{})}:p.answer!==undefined?{id:p.id,blank:true,...(p.wide?{wide:true}:{}),...(p.multiline!==undefined?{multiline:p.multiline}:{}),...(p.kind==='choice'||p.kind==='multi-choice'?{kind:p.kind,prompt:p.prompt,options:p.options,...(p.inline?{inline:true}:{}),...(p.groupId?{groupId:p.groupId,groupStyle:p.groupStyle}:{}),...(p.selectCount?{selectCount:p.selectCount}:{})}:p.kind==='word-gap'?{kind:p.kind,bankId:p.bankId,options:p.options}:{})}:{text:p.text});}
export function choiceGroupsAreValid(parts:ExamPart[]){
 const grouped=parts.filter(p=>p.groupId!==undefined||p.groupStyle!==undefined);
 if(grouped.some(p=>p.kind!=='choice'||typeof p.groupId!=='string'||!p.groupId||p.groupId.length>100||!['matching','categories'].includes(p.groupStyle||'')))return false;
 for(const id of new Set(grouped.map(p=>p.groupId))){const rows=grouped.filter(p=>p.groupId===id);if(rows.length<2||rows.length>40||rows.some(p=>p.groupStyle!==rows[0].groupStyle||JSON.stringify(p.options)!==JSON.stringify(rows[0].options)))return false;}
 return true;
}
export const hasReference=(p:ExamPart)=>typeof p.answer==='string'&&!!p.answer.trim()&&!/^[\s_.…–—-]+$/.test(p.answer);
export const missingReferences=(parts:ExamPart[])=>parts.some(p=>p.answer!==undefined&&!hasReference(p));
export const MISSING_REFERENCE_MESSAGE='La entrega está guardada y queda pendiente de revisión docente porque el examen no tiene todas las soluciones de referencia.';
export const isSelection=(p:ExamPart)=>p.kind==='choice'||p.kind==='multi-choice'||p.kind==='word-gap';
export function wordBanksAreValid(parts:ExamPart[],requireAnswers=true){
 const banks=parts.filter(p=>p.kind==='wordbank');const ids=new Set(banks.map(p=>p.id));
 if(ids.size!==banks.length||banks.some(b=>!b.id||b.answer!==undefined||b.bankMode!==undefined&&b.bankMode!=='write'||typeof b.reusable!=='boolean'||!Array.isArray(b.options)||b.options.length<2||b.options.length>40||new Set(b.options).size!==b.options.length||b.options.some(o=>typeof o!=='string'||!o.trim()||o.length>120)))return false;
 return parts.filter(p=>p.kind==='word-gap').every(p=>{const b=banks.find(b=>b.id===p.bankId);return b&&b.bankMode!=='write'&&typeof p.answer==='string'&&(b.options!.includes(p.answer)||(!requireAnswers&&!p.answer.trim()))&&JSON.stringify(p.options)===JSON.stringify(b.options)});
}
/** A move between filled gaps swaps words; reusable grammar options stay available. */
export function placeWord(parts:ExamPart[],answers:Record<string,string>,targetId:string,bankId:string,word:string){
 const target=parts.find(p=>p.id===targetId&&p.kind==='word-gap'&&p.bankId===bankId);const bank=parts.find(p=>p.kind==='wordbank'&&p.id===bankId);
 if(!target||!bank?.options?.includes(word))return answers;
 const next={...answers,[targetId]:word};
 if(!bank.reusable){const old=parts.find(g=>g.kind==='word-gap'&&g.bankId===bankId&&g.id!==targetId&&answers[g.id!]===word);if(old)next[old.id!]=answers[targetId]||'';}
 return next;
}
export function choiceIsValid(p:ExamPart,requireAnswers=true){return p.kind!=='choice'||((p.inline===undefined||typeof p.inline==='boolean')&&typeof p.prompt==='string'&&p.prompt.trim().length>0&&p.prompt.length<=12000&&Array.isArray(p.options)&&p.options.length>=2&&p.options.length<=12&&p.options.every(o=>typeof o==='string'&&!!o.trim()&&o.length<=3000)&&new Set(p.options).size===p.options.length&&(p.options.includes(p.answer||'')||(!requireAnswers&&typeof p.answer==='string'&&!p.answer.trim())));}
export function gradeSelections(parts:ExamPart[],answers:Record<string,string>){return parts.filter(isSelection).map(p=>({id:p.id!,correct:selectionMatches(p,answers[p.id!]||''),feedback:selectionMatches(p,answers[p.id!]||'')?'La opción elegida es correcta.':`La opción correcta es ${choiceLabel(formatAnswer(p,p.answer))}. Elegiste ${choiceLabel(formatAnswer(p,answers[p.id!])||'sin respuesta')}.`}));}
/** Choice rows are block controls; source newlines around them are layout, not blank questions. */
export function layoutParts(parts:ExamPart[]):ExamPart[]{return parts.map((p,i)=>{
 if(p.text===undefined)return p;let text=p.text;
 if(['choice','multi-choice','wordbank'].includes(parts[i-1]?.kind||'')&&!parts[i-1]?.inline)text=text.replace(/^\s*\n+/, '');
 if(['choice','multi-choice','wordbank'].includes(parts[i+1]?.kind||'')&&!parts[i+1]?.inline)text=text.replace(/\n+\s*$/, '');
 return {...p,text};
});}

/** Writing is reviewed by the teacher; reference texts are examples, not exact keys. */
export const isWriting=(p:ExamPart)=>p.answer!==undefined&&!isSelection(p)&&p.multiline===true;
export function questionContexts(parts:ExamPart[]){
 let context='';
 return withAnswerSizes(parts).flatMap(p=>{
  if(p.text!==undefined){context+=p.text;return [];}
  if(p.kind==='wordbank'){context+='\nBanco de palabras: '+p.options?.join(' / ')+'\n';return [];}
  if(p.answer===undefined)return [];
  const result={part:p,prompt:p.prompt||context.trim()};context='';return [result];
 });
}
export function gradeObjectiveAnswers(parts:ExamPart[],answers:Record<string,string>){
 const normalize=(s:string)=>s.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
 return withAnswerSizes(parts).filter(p=>p.answer!==undefined&&!isWriting(p)&&hasReference(p)).map(p=>{
  const correct=isSelection(p)?selectionMatches(p,answers[p.id!]||''):normalize(answers[p.id!]||'')===normalize(p.answer!);
  return {id:p.id!,correct,feedback:correct?'La respuesta coincide con la solución docente.':`Solución docente: ${choiceLabel(formatAnswer(p,p.answer))}.`};
 });
}
