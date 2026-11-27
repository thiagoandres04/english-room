import type {AnswerHint} from './pdf-exercises';
import type {WordBankHint} from './pdf-word-banks';
import type {ExerciseMark} from './exam-parts';
import {plainSlashChoice} from './pdf-choice-layout.ts';
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
const clean=(value:string)=>normalize(value).replace(/[.,;:!?]+$/,'');
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const flexible=(value:string)=>new RegExp(normalize(value).split(' ').map(escape).join('\\s+'),'gu');
export function isReadingTitle(text:string,start:number,end:number){
 return /(?:^|\n)\s*READING\s*$/i.test(text.slice(0,start))&&/^\s*By\s+\p{Lu}/u.test(text.slice(end));
}

/** Reuse saved font/underline evidence when an existing draft is re-recognized. */
export function repairedChoiceHints(hints:AnswerHint[]):AnswerHint[]{
 const lines=new Map<string,AnswerHint[]>();
 for(const hint of hints.filter(h=>h.source==='bold'&&h.line.includes('/'))){const key=normalize(hint.line);lines.set(key,[...(lines.get(key)||[]),hint]);}
 return [...hints,...[...lines.values()].flatMap(group=>{
  if(hints.some(h=>h.source==='inline-choice'&&normalize(h.line)===normalize(group[0].line)))return [];
  const choice=plainSlashChoice(group[0].line,group.map(h=>clean(h.answer)));
  return choice?[{...choice,source:'inline-choice' as const,answer:''}]:[];
 })];
}
export function repairedWordBanks(text:string,banks:WordBankHint[],hints:AnswerHint[]):WordBankHint[]{
 return banks.map(bank=>{
  const tail=text.slice(bank.end),boundary=/\n\s*(?:\d+[.)]?\s+(?:Read|Listen|Write|Complete|Choose|Match)|GRAMMAR\b|VOCABULARY\b|READING\b|LISTENING\b)/i.exec(tail);
  const body=normalize(tail.slice(0,boundary?.index??tail.length));
  const references=[...new Set(hints.filter(h=>h.source==='underline'&&body.includes(normalize(h.line))).map(h=>clean(h.answer).toLowerCase()).filter(v=>/^[\p{L}][\p{L}\s’'-]*$/u.test(v)))];
  function split(value:string):string[]{
   const words=value.trim().split(/\s+/);if(words.length<2||words.length>40)return [value];
   const solutions:string[][]=[];
   function visit(at:number,parts:string[]){if(solutions.length>1)return;if(at===words.length){solutions.push(parts);return;}for(let end=words.length;end>at;end--){const candidate=words.slice(at,end).join(' ');if(references.includes(candidate.toLowerCase()))visit(end,[...parts,candidate]);}}
   visit(0,[]);return solutions.length===1?solutions[0]:[value];
  }
  const options=bank.options.flatMap(split);
  return options.length<=40&&new Set(options).size===options.length?{...bank,options}:bank;
 });
}
/** Only explicit, uppercase underlined keys qualify; punctuation stays in the text. */
export function recoveredTypedKeys(text:string,hints:AnswerHint[],occupied:ExerciseMark[]):ExerciseMark[]{
 const recovered:ExerciseMark[]=[];
 for(const hint of hints){
  if(/^(?:NAME|STUDENT(?:'S)? NAME|GROUP(?:\/CLASS)?|CLASS|DATE|SCORE)\s*(?::|[_…]{2,})/i.test(normalize(hint.line)))continue;
  if(/^(?:READING|LISTENING|GRAMMAR|VOCABULARY|WRITING|SPEAKING|USE OF ENGLISH)$/i.test(normalize(hint.line)))continue;
  const value=clean(hint.answer);if(hint.source!=='underline'||!/[\p{Lu}]{2}/u.test(value)||!/^[\p{Lu}\s’'-]+$/u.test(value))continue;
  const rows=[...text.matchAll(flexible(hint.line))];if(rows.length!==1)continue;
  const row=rows[0],keys=[...row[0].matchAll(flexible(value))];if(keys.length!==1)continue;
  const start=row.index!+keys[0].index!,end=start+keys[0][0].length;
  if([...occupied,...recovered].some(m=>m.start<end&&m.end>start))continue;
  recovered.push({id:crypto.randomUUID(),start,end});
 }
 return recovered;
}
