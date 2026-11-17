import {extractPageText,type PositionedText} from './pdf-text.ts';
import {stripPDFStudentHeader} from './pdf-student-header.ts';
import type {ExerciseMark} from './exam-parts.ts';
type Run=PositionedText&{fontName?:string};
export type WordBankHint={start:number;end:number;options:string[];reusable:boolean;gaps:{start:number;end:number;answer:string}[]};
const header=/^\d+[.)]?\s+(?:Listen.*complete|Complete.*(?:words|use to)|Read.*words.*box)/i;
const handwriting=/Dekko|handwrit|Comic|Cursive|Script/i;
/** Preserve word-bank phrase boundaries and filled gap geometry before flattening the PDF. */
export function extractWordBankPage(items:Run[],fonts:Record<string,string>={}){
 const cleaned=stripPDFStudentHeader(items);items=cleaned.items;
 const rows:{y:number;items:Run[];text:string}[]=[];
 for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<2.6);if(!row){row={y,items:[],text:''};rows.push(row)}row.items.push(item);
 }
 rows.forEach(r=>r.text=extractPageText(r.items));
 const removed=new Set<Run>();const replacements=new Map<Run,string>();const virtual:Run[]=[];
 const tokens:{token:string;value:string;bank:number;gap:boolean}[]=[];
 const written:{start:number;end:number}[]=[];
 const banks:WordBankHint[]=[];
 function token(value:string,bank:number,gap:boolean){const t='\uE000'+tokens.length+'\uE001';tokens.push({token:t,value,bank,gap});return t;}
 for(let i=0;i<rows.length;i++){
  const row=rows[i];if(!header.test(row.text))continue;
  let last=i+1;while(last<rows.length&&!/^Score:|^\d+[.)]?\s+(?:Listen|Read|Write|Complete|Choose)/i.test(rows[last].text))last++;
  const grammar=/correct form of\s+use to/i.test(row.text);
  const bankRows:typeof rows=[];
  if(!grammar){
   for(let n=i+1;n<last&&row.y-rows[n].y<65;n++){
    const r=rows[n];if(/^\d|[.!?]/.test(r.text)||r.items.length<2)break;
    bankRows.push(r);
   }
   if(!bankRows.length)continue;
  }
  const options:string[]=[];
  for(const r of bankRows){
   const runs=[...r.items].sort((a,b)=>a.transform[4]-b.transform[4]);let phrase='';let previous:Run|undefined;
   for(const run of runs){const gap=previous?run.transform[4]-previous.transform[4]-previous.width:Infinity;
    if(gap>Math.max(7,run.height*.7)&&phrase){options.push(phrase.trim());phrase=''}
    phrase+=(phrase?' ':'')+run.str.trim();previous=run;
   }if(phrase)options.push(phrase.trim());
  }
  if(grammar)options.push('used to','use to',"didn't use to",'did','Did','did you use to');
  if(options.length<2||options.length>40||new Set(options).size!==options.length)continue;
  const bankIndex=banks.length;const bank:WordBankHint={start:0,end:0,options,reusable:grammar||/more than once|reuse/i.test(row.text),gaps:[]};banks.push(bank);
  const bankToken=token(options.join(' | '),bankIndex,false);
  if(grammar)virtual.push({...row.items[0],str:bankToken,transform:[...row.items[0].transform.slice(0,4),70,row.y-30],width:400});
  else{for(const r of bankRows)r.items.forEach(item=>removed.add(item));const first=[...bankRows[0].items].sort((a,b)=>a.transform[4]-b.transform[4])[0];removed.delete(first);replacements.set(first,bankToken);}
  const bankBottom=bankRows.at(-1)?.y??row.y-30;
  for(let n=i+1;n<last;n++){
   const r=rows[n];if(r.y>=bankBottom)continue;
   for(const run of r.items){
    if(!handwriting.test(fonts[run.fontName||'']||'')||!run.str.trim())continue;
    const answer=run.str.trim();if(!options.includes(answer))continue;
    replacements.set(run,token(answer,bankIndex,true));
    // Superscript gap numbers are layout annotations, not standalone text lines.
    items.filter(it=>/^\d{1,2}$/.test(it.str.trim())&&it.transform[4]<run.transform[4]&&run.transform[4]-it.transform[4]<24&&it.transform[5]-run.transform[5]>2&&it.transform[5]-run.transform[5]<7).forEach(it=>removed.add(it));
   }
  }
 }
 // Whole handwritten response lines are written answers, not slash alternatives
 // in the printed sentence-building clues (e.g. "your mum / write in a diary").
 for(const row of rows){
  if(row.items.some(i=>replacements.has(i)||removed.has(i)))continue;
  const ink=row.items.filter(i=>handwriting.test(fonts[i.fontName||'']||''));
  if(!ink.length||ink.reduce((n,i)=>n+i.str.length,0)<row.text.length*.6)continue;
  const sorted=[...row.items].sort((a,b)=>a.transform[4]-b.transform[4]);
  sorted.forEach(i=>removed.add(i));removed.delete(sorted[0]);replacements.set(sorted[0],token(row.text,-1,true));
 }
 let text=extractPageText([...items.filter(i=>!removed.has(i)).map(i=>replacements.has(i)?{...i,str:replacements.get(i)!}:i),...virtual]);
 // Replace markers in output order so all offsets refer to the final readable text.
 const seen=[...text.matchAll(/\uE000(\d+)\uE001/g)];let shift=0;
 for(const m of seen){const t=tokens[Number(m[1])];const start=m.index!+shift;text=text.slice(0,start)+t.value+text.slice(start+m[0].length);shift+=t.value.length-m[0].length;
  if(t.bank===-1)written.push({start,end:start+t.value.length});else if(t.gap)banks[t.bank].gaps.push({start,end:start+t.value.length,answer:t.value});else{banks[t.bank].start=start;banks[t.bank].end=start+t.value.length;}
 }
 const writtenAnswers:ExerciseMark[]=[];
 for(const span of written){const previous=writtenAnswers.at(-1);if(previous&&/^\s*$/.test(text.slice(previous.end,span.start))){previous.end=span.end;previous.multiline=true;}else writtenAnswers.push({...span,id:crypto.randomUUID(),multiline:true});}
 return {text,wordBanks:banks.filter(b=>b.gaps.length>0),writtenAnswers,headerRemoved:cleaned.removed};
}
export function wordBankMarks(hints:WordBankHint[]):ExerciseMark[]{return hints.flatMap(h=>{const id=crypto.randomUUID();return [{start:h.start,end:h.end,id,kind:'wordbank' as const,options:h.options,reusable:h.reusable},...h.gaps.map(g=>({...g,id:crypto.randomUUID(),kind:'word-gap' as const,bankId:id,options:h.options}))]})}
