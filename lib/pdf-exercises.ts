import {detectTickExercises} from './pdf-ticks.ts';
import {extractPageText,type PositionedText} from './pdf-text.ts';
import type {ExerciseMark} from './exam-parts';
import {wordBankMarks,type WordBankHint} from './pdf-word-banks.ts';
export type AnswerHint={line:string;answer:string;source:'circle'|'bold'|'written';start?:number;end?:number};
type TextRun=PositionedText&{fontName?:string};
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
const instruction=/^\d{1,3}[.)]?\s+(?:Listen\b|Read the\b|Answer the\b|Choose\b|Match\b|Complete\b|Look at\b|Are the sentences\b|Do you agree\b|Write\b|Circle\b|Tick\b|Select\b)/i;
function multiply(a:number[],b:number[]){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
/** Recover small vector rings around option glyphs; never guess an unmarked choice. */
export function extractAnswerHints(items:TextRun[],operators:{fnArray:ArrayLike<number>;argsArray:any[]},ops:Record<string,number>,fontNames:Record<string,string>={}):AnswerHint[]{
 const hints:AnswerHint[]=[];let matrix=[1,0,0,1,0,0];const stack:number[][]=[];
 const onLine=(y:number)=>items.filter(i=>i.str.trim()&&Math.abs(i.transform[5]-y)<3);
 for(let i=0;i<operators.fnArray.length;i++){
  const code=operators.fnArray[i];const args=operators.argsArray[i];
  if(code===ops.save)stack.push([...matrix]);
  else if(code===ops.restore)matrix=stack.pop()||matrix;
  else if(code===ops.transform)matrix=multiply(matrix,args);
  else if(code===ops.constructPath){
   const commands:number[]=args?.[0]||[];const coords:number[]=args?.[1]||[];
   if(commands.length>24||commands.filter(c=>c===ops.curveTo).length<4)continue;
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(let j=0;j<coords.length;j+=2){const x=matrix[0]*coords[j]+matrix[2]*coords[j+1]+matrix[4];const y=matrix[1]*coords[j]+matrix[3]*coords[j+1]+matrix[5];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   const width=maxX-minX,height=maxY-minY;if(width<6||width>60||height<5||height>23||width/height>5)continue;
   const enclosed=items.filter(item=>{const x=item.transform[4]+item.width/2,y=item.transform[5]+item.height*.35;return item.str.trim()&&x>=minX&&x<=maxX&&y>=minY&&y<=maxY;});
   if(!enclosed.length)continue;
   const answer=extractPageText(enclosed);if(!/^(?:[A-H]|T|F|NI|\d{1,2})$/.test(answer))continue;
   hints.push({line:extractPageText(onLine(enclosed[0].transform[5])),answer,source:'circle'});
  }
 }
 for(const item of items){
  if(!item.str.trim()||!/bold|black|heavy|semibold/i.test(fontNames[item.fontName||'']||''))continue;
  const answer=item.str.trim().replace(/[.,;:!?]+$/,'');if(!/^[\p{L}’'-]{2,30}$/u.test(answer))continue;
  const line=extractPageText(onLine(item.transform[5]));if(!line.includes('/'))continue;
  hints.push({line,answer,source:'bold'});
 }
 return hints;
}
function hintedAnswer(source:string,options:string[],hints:AnswerHint[]){
 const normalized=normalize(source);
 for(const kind of ['circle','bold'] as const){
  const matches=new Set<string>();
  for(const hint of hints.filter(h=>h.source===kind)){
   if(!normalized.includes(normalize(hint.line)))continue;
   for(const option of options)if(option===hint.answer||option.startsWith(hint.answer+' '))matches.add(option);
  }
  if(matches.size===1)return [...matches][0];
 }
 return '';
}
export function detectExercises(text:string,hints:AnswerHint[]=[],wordBanks:WordBankHint[]=[]):ExerciseMark[]{
 const lines:{text:string;start:number;end:number}[]=[];let offset=0;
 for(const line of text.split('\n')){lines.push({text:line,start:offset,end:offset+line.length});offset+=line.length+1;}
 const marks:ExerciseMark[]=[...detectTickExercises(text),...wordBankMarks(wordBanks),...hints.filter(h=>h.source==='written'&&Number.isInteger(h.start)&&Number.isInteger(h.end)).map(h=>({id:crypto.randomUUID(),start:h.start!,end:h.end!,multiline:true}))];
 const addChoice=(lineIndex:number,endIndex:number,prompt:string,options:string[],answer?:string)=>{
  const start=lines[lineIndex].start,end=lines[endIndex].end;
  marks.push({id:crypto.randomUUID(),start,end,kind:'choice',prompt,options,answer:answer??hintedAnswer(text.slice(start,end),options,hints)});
 };
 let matchingOptions:string[]|null=null;let openQuestions=true;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].text.trim();if(!line)continue;
  if(marks.some(m=>m.start<lines[i].end&&m.end>lines[i].start))continue;
  if(instruction.test(line)){
   matchingOptions=null;openQuestions=!/\b(?:complete|fill|tick|check|match)\b/i.test(line);
   const match=/Match.*(?:speakers?|numbers?)\s+(\d+)\s*[–—-]\s*(\d+)/i.exec(line);
   if(match){const first=Number(match[1]),last=Number(match[2]);if(last>=first&&last-first<12)matchingOptions=Array.from({length:last-first+1},(_,j)=>String(first+j));}
   continue;
  }
  if(/^Score:/i.test(line)){matchingOptions=null;openQuestions=true;continue;}
  if(matchingOptions){
   const match=/^([A-H])[.)]?\s+(.+?)\s+(\d{1,2})$/.exec(line);
   if(match&&matchingOptions.includes(match[3])){addChoice(i,i,match[1]+' '+match[2],matchingOptions,match[3]);continue;}
  }
  if(/^\d{1,3}[.)]?\s/.test(line)){
   const slash=/\b[\p{L}][\p{L}'’’-]*(?:\s*\/\s*[\p{L}][\p{L}'’’-]*){1,5}\b/u.exec(line);
   if(slash&&!/^\d+[.)]?\s*\(/.test(line)){
    const options=slash[0].split(/\s*\/\s*/).map(o=>o.trim());
    if(new Set(options).size===options.length){
     const isBoolean=options.every(o=>['T','F','NI','True','False'].includes(o));
     const prompt=(line.slice(0,slash.index)+(isBoolean?'':'____')+line.slice(slash.index+slash[0].length)).trim();
     addChoice(i,i,prompt,options);continue;
    }
   }
   // Lettered alternatives belong to the immediately preceding question. Keep
   // the complete alternative label with its value to avoid dropping its text.
   let next=i+1;while(next<lines.length&&!lines[next].text.trim())next++;
   const choices:string[]=[];let end=i;
   while(next<lines.length){const m=/^([A-H])[.)]?\s+(.+)$/.exec(lines[next].text.trim());if(!m||m[1]!==String.fromCharCode(65+choices.length))break;choices.push(m[1]+' '+m[2]);end=next;next++;}
   if(choices.length>=2){addChoice(i,end,line,choices);i=end;continue;}
   // A completed open question keeps its statement in the document and turns
   // only the following solution into a written-response field.
   if(openQuestions&&/\?$/.test(line)){
    let answerLine=i+1;while(answerLine<lines.length&&!lines[answerLine].text.trim())answerLine++;
    const answer=lines[answerLine]?.text.trim();
    if(answer&&!/^(?:\d+[.)]?\s|Score:|[A-H][.)]?\s)/.test(answer)){
     marks.push({id:crypto.randomUUID(),start:lines[answerLine].start,end:lines[answerLine].end});i=answerLine;
    }
   }
  }else if(/^Model answer$/i.test(line)){
   let start=i+1;while(start<lines.length&&!lines[start].text.trim())start++;
   let end=start;while(end<lines.length&&!/^Score:/i.test(lines[end].text.trim()))end++;
   while(end>start&&!lines[end-1].text.trim())end--;
   if(end>start)marks.push({id:crypto.randomUUID(),start:lines[start].start,end:lines[end-1].end,multiline:true});
   i=end-1;
  }
 }
 return marks.sort((a,b)=>a.start-b.start);
}
