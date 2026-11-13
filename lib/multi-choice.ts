import type {ExamPart} from './exam-parts';
/** Multi-select answers remain strings for compatibility with saved submissions. */
export function selectedOptions(value:string|undefined):string[]{try{const a=JSON.parse(value||'[]');return Array.isArray(a)&&a.every(x=>typeof x==='string')?a:[]}catch{return []}}
export function multiAnswerIsValid(part:ExamPart,value:string,complete=true){
 let a:unknown;try{a=JSON.parse(value)}catch{return !complete&&value===''}
 return Array.isArray(a)&&a.every(v=>typeof v==='string'&&part.options?.includes(v))&&new Set(a).size===a.length&&a.length<=(part.selectCount??part.options?.length??0)&&(!complete||(part.selectCount?a.length===part.selectCount:a.length>0));
}
export function multiChoiceIsValid(part:ExamPart,requireAnswer=true){return part.kind!=='multi-choice'||typeof part.prompt==='string'&&part.prompt.trim().length>0&&part.prompt.length<=12000&&Array.isArray(part.options)&&part.options.length>=2&&part.options.length<=40&&part.options.every(v=>typeof v==='string'&&!!v.trim()&&v.length<=1200)&&new Set(part.options).size===part.options.length&&(part.selectCount===undefined||Number.isInteger(part.selectCount)&&part.selectCount>=1&&part.selectCount<=part.options.length)&&(typeof part.answer==='string'&&(multiAnswerIsValid(part,part.answer)||!requireAnswer&&part.answer===''));}
export function selectionAnswerIsValid(part:ExamPart,value:string,complete=true){return part.kind==='multi-choice'?multiAnswerIsValid(part,value,complete):(!complete&&value==='')||!!part.options?.includes(value);}
export function selectionMatches(part:ExamPart,value:string){return part.kind==='multi-choice'?multiAnswerIsValid(part,value)&&JSON.stringify([...selectedOptions(value)].sort())===JSON.stringify([...selectedOptions(part.answer)].sort()):value===part.answer;}
export function formatAnswer(part:ExamPart,value:string|undefined){if(part.kind!=='multi-choice')return value||'';return selectedOptions(value).join('\n');}
export function isAnswered(part:ExamPart,value:string|undefined){return part.kind==='multi-choice'?multiAnswerIsValid(part,value||''):!!value?.trim();}
