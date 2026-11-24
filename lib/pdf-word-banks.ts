import {extractPageText,type PositionedText} from './pdf-text.ts';
import {stripPDFStudentHeader} from './pdf-student-header.ts';
import type {ExerciseMark} from './exam-parts.ts';
type Run=PositionedText&{fontName?:string};
export type WordBankHint={start:number;end:number;options:string[];reusable:boolean;bankMode?:'write';gaps:{start:number;end:number;answer:string}[]};
const header=/^\d+[.)]?\s+(?:Listen.*complete|Complete.*(?:words|verbs|adjectives|nouns|phrases|box|use to)|Read.*(?:words.*box|complete))/i;
const handwriting=/Dekko|Overlock|handwrit|Comic|Cursive|Script/i;
/** Preserve word-bank phrase boundaries and filled gap geometry before flattening the PDF. */
export function extractWordBankPage(items:Run[],fonts:Record<string,string>={}){
 const cleaned=stripPDFStudentHeader(items);items=cleaned.items;
 const rows:{y:number;items:Run[];text:string}[]=[];
 for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<2.6);if(!row){row={y,items:[],text:''};rows.push(row)}row.items.push(item);
 }
 rows.forEach(r=>r.text=extractPageText(r.items));
 const removed=new Set<Run>();const replacements=new Map<Run,string>();const virtual:Run[]=[];
 const tokens:{token:string;value:string;bank:number;gap:boolean;choice?:{prompt:string;options:string[];answer:string}}[]=[];
 const written:{start:number;end:number;choice?:{prompt:string;options:string[];answer:string}}[]=[];
 const banks:WordBankHint[]=[];
 function token(value:string,bank:number,gap:boolean,choice?:{prompt:string;options:string[];answer:string}){const t='\uE000'+tokens.length+'\uE001';tokens.push({token:t,value,bank,gap,choice});return t;}
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
  const changeForm=/\b(?:correct|appropriate) form\b|change.*form/i.test(row.text)&&!grammar;
  const bankIndex=banks.length;const bank:WordBankHint={start:0,end:0,options,reusable:grammar||/more than once|reuse/i.test(row.text),...(changeForm?{bankMode:'write' as const}:{}),gaps:[]};banks.push(bank);
  const bankToken=token(options.join(' | '),bankIndex,false);
  if(grammar)virtual.push({...row.items[0],str:bankToken,transform:[...row.items[0].transform.slice(0,4),70,row.y-30],width:400});
  else{for(const r of bankRows)r.items.forEach(item=>removed.add(item));const first=[...bankRows[0].items].sort((a,b)=>a.transform[4]-b.transform[4])[0];removed.delete(first);replacements.set(first,bankToken);}
  const bankBottom=bankRows.at(-1)?.y??row.y-30;
  for(let n=i+1;n<last;n++){
   const r=rows[n];if(r.y>=bankBottom)continue;
   for(const run of r.items){
    if(changeForm||!handwriting.test(fonts[run.fontName||'']||'')||!run.str.trim())continue;
    const answer=run.str.trim();if(!options.includes(answer))continue;
    replacements.set(run,token(answer,bankIndex,true));
    // Superscript gap numbers are layout annotations, not standalone text lines.
    items.filter(it=>/^\d{1,2}$/.test(it.str.trim())&&it.transform[4]<run.transform[4]&&run.transform[4]-it.transform[4]<24&&it.transform[5]-run.transform[5]>2&&it.transform[5]-run.transform[5]<7).forEach(it=>removed.add(it));
   }
  }
 }
 // Numbered A/B/C tables can supply alternatives for filled gaps in a passage.
 // Keep each selector inside that passage, and remove its redundant source row.
 const inlineChoices=new Map<Run,{prompt:string;options:string[];answer:string}>();
 for(let r=0;r<rows.length;r++){
  const row=rows[r],runs=[...row.items].sort((a,b)=>a.transform[4]-b.transform[4]);
  if(!/^\d{1,3}[.)]?$/.test(runs[0]?.str.trim()||''))continue;
  const labels=runs.map((run,i)=>/^[a-h]$/i.test(run.str.trim())&&/bold/i.test(fonts[run.fontName||'']||'')?i:-1).filter(i=>i>0);
  if(labels.length<2||labels.some((at,i)=>runs[at].str.toLowerCase()!==String.fromCharCode(97+i)))continue;
  const options=labels.map((at,i)=>extractPageText(runs.slice(at+1,labels[i+1]??runs.length)).replace(/\s+/g,' ').trim());
  if(options.some(o=>!o)||new Set(options).size!==options.length)continue;
  let first=r-1;while(first>=0&&!/^Score:|^\d+[.)]?\s+(?:Choose|Select|Complete|Read|Listen|Write)/i.test(rows[first].text))first--;
  // Other rows of the same options table are not section boundaries.
  if(first<0||!/^\d+[.)]?\s+(?:Choose|Select).*\b(?:text|dialogue|passage)\b/i.test(rows[first].text))continue;
  const number=runs[0].str.replace(/[.)]/g,'').trim();const candidates:Run[]=[];
  for(let n=first+1;n<r;n++){
   const body=[...rows[n].items].sort((a,b)=>a.transform[4]-b.transform[4]);
   body.forEach((run,j)=>{if(!handwriting.test(fonts[run.fontName||'']||'')||!run.str.trim())return;const before=body.slice(0,j).filter(t=>t.str.trim()).at(-1);if(/(?:^|[^\d])(\d{1,3})[.)]?\s*$/.exec(before?.str||'')?.[1]===number)candidates.push(run);});
  }
  if(candidates.length!==1)continue;const run=candidates[0];
  inlineChoices.set(run,{prompt:'Casillero '+number,options,answer:options.find(o=>o.toLowerCase()===run.str.trim().toLowerCase())||''});
  row.items.forEach(item=>removed.add(item));
 }
 // Reunite wrapped ends of letter chains in their original column. Their
 // letters remain a puzzle; answer words are never substituted into the clue.
 for(let r=0;r<rows.length;r++){
  if(!/^\d+[.)]?\s+Find the words\b/i.test(rows[r].text))continue;
  const first=rows[r+1];if(!first)continue;
  const letters=first.items.filter(i=>/^(?:\p{L}\s*){4,}$/u.test(i.str.trim())&&i.str.trim().split(/\s+/).every(s=>s.length===1));
  if(!letters.length)continue;
  const columns:Run[][]=[];
  for(const run of letters.sort((a,b)=>a.transform[4]-b.transform[4])){const previous=columns.at(-1)?.at(-1);if(!previous||run.transform[4]-previous.transform[4]-previous.width>Math.max(20,run.height*2))columns.push([]);columns.at(-1)!.push(run);}
  let end=r+2;while(end<rows.length&&rows[end].items.every(i=>/^\p{L}$/u.test(i.str.trim()))){
   for(const run of rows[end].items){const column=columns.find(c=>run.transform[4]>=c[0].transform[4]-3&&run.transform[4]<=c[0].transform[4]+c.reduce((n,i)=>n+i.width,0)+15);column?.push(run);}end++;
  }
  columns.forEach((column,i)=>{column.forEach(run=>removed.add(run));const base=column[0];virtual.push({...base,str:column.map(run=>run.str.replace(/\s/g,'')).join('').split('').join(' '),transform:[...base.transform.slice(0,4),base.transform[4],first.y-i*20],width:400});});
 }
 // Filled answers may occupy only a small part of a printed sentence. Group
 // adjacent handwriting runs, while keeping printed stems and clues visible.
 for(const row of rows){
  const sorted=[...row.items].filter(i=>i.str.trim()).sort((a,b)=>a.transform[4]-b.transform[4]);
  const ink=sorted.filter(i=>handwriting.test(fonts[i.fontName||'']||'')&&!replacements.has(i)&&!removed.has(i));
  if(!ink.length)continue;
  const fullLine=sorted.every(i=>ink.includes(i)||!/[\p{L}\p{N}]/u.test(i.str))&&ink.every((run,i)=>!i||run.transform[4]-ink[i-1].transform[4]-ink[i-1].width<=Math.max(7,run.height));
  const groups:Run[][]=[];
  if(fullLine)groups.push(sorted);else for(const run of ink){const previous=groups.at(-1)?.at(-1);const between=previous&&sorted.slice(sorted.indexOf(previous)+1,sorted.indexOf(run));if(!previous||run.transform[4]-previous.transform[4]-previous.width>Math.max(7,run.height)||between?.some(i=>/[\p{L}\p{N}]/u.test(i.str)))groups.push([]);groups.at(-1)!.push(run);}
  for(const group of groups){const first=group[0],value=extractPageText(group),choice=inlineChoices.get(first);group.forEach(i=>removed.add(i));removed.delete(first);replacements.set(first,token(value,-1,true,choice?{...choice,answer:choice.options.find(o=>o.toLowerCase()===value.toLowerCase())||''}:undefined));}
 }
 let text=extractPageText([...items.filter(i=>!removed.has(i)).map(i=>replacements.has(i)?{...i,str:replacements.get(i)!}:i),...virtual]);
 // Replace markers in output order so all offsets refer to the final readable text.
 const seen=[...text.matchAll(/\uE000(\d+)\uE001/g)];let shift=0;
 for(const m of seen){const t=tokens[Number(m[1])];const start=m.index!+shift;text=text.slice(0,start)+t.value+text.slice(start+m[0].length);shift+=t.value.length-m[0].length;
  if(t.bank===-1)written.push({start,end:start+t.value.length,choice:t.choice});else if(t.gap)banks[t.bank].gaps.push({start,end:start+t.value.length,answer:t.value});else{banks[t.bank].start=start;banks[t.bank].end=start+t.value.length;}
 }
 const writtenAnswers:ExerciseMark[]=[];
 for(const {choice,...span} of written){const previous=writtenAnswers.at(-1),between=previous?text.slice(previous.end,span.start):'';if(!choice&&previous&&!previous.kind&&/\n/.test(between)&&/^\s*$/.test(between)){previous.end=span.end;previous.multiline=true;}else writtenAnswers.push({...span,id:crypto.randomUUID(),...(choice?{...choice,kind:'choice' as const,inline:true}:{})});}
 return {text,wordBanks:banks.filter(b=>b.gaps.length>0||b.bankMode==='write'),writtenAnswers,headerRemoved:cleaned.removed};
}
export function wordBankMarks(hints:WordBankHint[]):ExerciseMark[]{return hints.flatMap(h=>{const id=crypto.randomUUID();return [{start:h.start,end:h.end,id,kind:'wordbank' as const,options:h.options,reusable:h.reusable,...(h.bankMode?{bankMode:h.bankMode}:{})},...h.gaps.map(g=>({...g,id:crypto.randomUUID(),kind:'word-gap' as const,bankId:id,options:h.options}))]})}
