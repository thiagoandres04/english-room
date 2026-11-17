import {extractPageText,type PositionedText} from './pdf-text.ts';

// Only inspect the short opening block, before any exercise or subject heading.
// A date or score in an exercise must never be mistaken for a student form.
const exerciseStart=/^(?:\d{1,3}[.)]?\s|(?:LISTENING|READING|WRITING|SPEAKING|GRAMMAR|VOCABULARY|USE OF ENGLISH|COMPREHENSION)(?:\s*(?:&|AND)\s*\w+)?\s*$|(?:Listen|Read|Write|Complete|Choose|Circle|Tick|Match|Answer)\b)/i;
const labels=[
 /\b(?:student(?:['’]s)?\s+name|pupil(?:['’]s)?\s+name|full\s+name|name(?:\s+and\s+surname)?|nombre(?:\s+y\s+apellido)?|alumno(?:\/a)?)\b/i,
 /\b(?:group\s*\/\s*class|group|class|course|grupo|curso|clase)\b/i,
 /\b(?:date|fecha)\b/i,
 /\b(?:score|mark|marks|nota|puntaje|calificaci[oó]n)\b/i,
];
const fieldStart=/^(?:student(?:['’]s)?\s+name|pupil(?:['’]s)?\s+name|full\s+name|name(?:\s+and\s+surname)?|nombre(?:\s+y\s+apellido)?|alumno(?:\/a)?|group\s*\/\s*class|group|class|course|grupo|curso|clase|date|fecha|score|marks?|nota|puntaje|calificaci[oó]n)(?=\s|[:：._–—-]|$)/i;

/** Drop the student form and its cover title; preserve original exercise runs. */
export function stripPDFStudentHeader<T extends PositionedText>(items:T[]):{items:T[];removed:boolean}{
 const rows:{y:number;items:T[]}[]=[];
 for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<2.6);
  if(!row){row={y,items:[]};rows.push(row)}row.items.push(item);
 }
 const found=new Set<number>();let last=-1;
 for(let i=0;i<Math.min(rows.length,12);i++){
  const text=extractPageText(rows[i].items).replace(/\s+/g,' ').trim();
  if(exerciseStart.test(text)||text.length>160)break;
  if(!fieldStart.test(text))continue;
  labels.forEach((label,index)=>{if(label.test(text))found.add(index)});last=i;
 }
 // Require multiple fields, including a name or class, to avoid deleting titles
 // such as “Date” or a reading passage that happens to mention a score.
 if(last<0||found.size<2||(!found.has(0)&&!found.has(1)))return {items,removed:false};
 const removed=new Set(rows.slice(0,last+1).flatMap(r=>r.items));
 return {items:items.filter(i=>!removed.has(i)),removed:true};
}
