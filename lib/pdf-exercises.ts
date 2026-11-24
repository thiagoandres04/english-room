import {detectTickExercises} from './pdf-ticks.ts';
import {extractPageText,type PositionedText} from './pdf-text.ts';
import type {ExerciseMark} from './exam-parts';
import {wordBankMarks,type WordBankHint} from './pdf-word-banks.ts';
import {extractStyledChoices} from './pdf-choice-layout.ts';
export type AnswerHint={line:string;answer:string;source:'circle'|'underline'|'bold'|'written'|'inline-choice';start?:number;end?:number;prompt?:string;options?:string[];kind?:'choice';inline?:boolean;multiline?:boolean};
type TextRun=PositionedText&{fontName?:string};
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
const instruction=/^\d{1,3}[.)]?\s+(?:Listen\b|Read the\b|Answer the\b|Choose\b|Match\b|Complete\b|Look at\b|Are the sentences\b|Do you agree\b|Write\b|Circle\b|Tick\b|Select\b)/i;
type SourceLine={text:string;start:number;end:number};
const letteredOption=/^([A-H])[.)]?\s+(.+)$/;
const choiceBoundary=/^(?:\d{1,3}[.)]?\s|Score\s*:|Model answer\b|©)|^(?:LISTENING|READING|WRITING|SPEAKING|GRAMMAR|VOCABULARY|USE OF ENGLISH)(?:\s*(?:&|AND|\/)\s*(?:LISTENING|READING|WRITING|SPEAKING|GRAMMAR|VOCABULARY))?\s*$/i;
/** Read a whole question block: both the stem and each alternative may wrap.
 * New questions, section headings and scores are boundaries, not option text. */
function readLetteredQuestion(lines:SourceLine[],start:number,occupied:ExerciseMark[]){
 const blocked=(i:number)=>occupied.some(m=>m.start<lines[i].end&&m.end>lines[i].start);
 let first=start+1;
 for(;first<lines.length&&first<=start+12;first++){
  const text=lines[first].text.trim();if(!text)continue;
  if(choiceBoundary.test(text)||blocked(first))return null;
  const option=letteredOption.exec(text);if(option){if(option[1]!=='A')return null;break;}
 }
 if(first>=lines.length||first>start+12)return null;
 const options:string[]=[];let end=first,blank=false;
 for(let i=first;i<lines.length&&i<first+160;i++){
  const text=lines[i].text.trim();if(!text){blank=true;continue;}
  if(choiceBoundary.test(text)||blocked(i))break;
  const option=letteredOption.exec(text);
  if(option){
   if(option[1]!==String.fromCharCode(65+options.length))return null;
   options.push(option[1]+' '+option[2]);
  }else{
   // Keep blank paragraphs outside a completed alternative, but allow an
   // unfinished sentence to continue after a PDF page separator.
   const continuesAcrossBreak=blank&&options.length>0&&!/[.!?]$/.test(options.at(-1)!)&&/^[\p{Ll}‘’'“”"(]/u.test(text);
   if(!options.length||blank&&!continuesAcrossBreak)break;
   options[options.length-1]+=' '+text;
  }
  if(options.at(-1)!.length>3000)return null;
  end=i;blank=false;
 }
 if(options.length<2||end===first+159&&lines[end+1]&&!choiceBoundary.test(lines[end+1].text.trim()))return null;
 const prompt=lines.slice(start,first).map(l=>l.text.trim()).filter(Boolean).join(' ');
 return {end,prompt,options};
}
function multiply(a:number[],b:number[]){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
/** Split compound PDF paths so rings around different answers stay separate. */
function contours(commands:ArrayLike<number>,coords:ArrayLike<number>,ops:Record<string,number>){
 const result:{points:number[];curves:number;closed:boolean}[]=[];let current={points:[] as number[],curves:0,closed:false},offset=0;
 const flush=()=>{if(current.points.length)result.push(current);current={points:[],curves:0,closed:false}};
 for(const command of Array.from(commands)){
  if(command===ops.moveTo)flush();
  const count=command===ops.curveTo?6:command===ops.curveTo2||command===ops.curveTo3?4:command===ops.rectangle?4:command===ops.moveTo||command===ops.lineTo?2:0;
  if(command===ops.curveTo||command===ops.curveTo2||command===ops.curveTo3)current.curves++;
  if(command===ops.closePath)current.closed=true;
  if(command!==ops.rectangle)for(let j=0;j<count;j++)current.points.push(coords[offset+j]);
  offset+=count;
 }flush();return result;
}
/** Recover rings around letters, words or phrases; never guess an unmarked choice. */
export function extractAnswerHints(items:TextRun[],operators:{fnArray:ArrayLike<number>;argsArray:any[]},ops:Record<string,number>,fontNames:Record<string,string>={}):AnswerHint[]{
 const hints:AnswerHint[]=[];let matrix=[1,0,0,1,0,0];const stack:number[][]=[];
 const onLine=(y:number)=>items.filter(i=>i.str.trim()&&Math.abs(i.transform[5]-y)<3);
 for(let i=0;i<operators.fnArray.length;i++){
  const code=operators.fnArray[i];const args=operators.argsArray[i];
  if(code===ops.save)stack.push([...matrix]);
  else if(code===ops.restore)matrix=stack.pop()||matrix;
  else if(code===ops.transform)matrix=multiply(matrix,args);
  else if(code===ops.constructPath){
   const commands:ArrayLike<number>=args?.[0]||[];const coords:ArrayLike<number>=args?.[1]||[];
   for(const contour of contours(commands,coords,ops)){
   const points=contour.points;
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(let j=0;j<points.length;j+=2){const x=matrix[0]*points[j]+matrix[2]*points[j+1]+matrix[4];const y=matrix[1]*points[j]+matrix[3]*points[j+1]+matrix[5];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   const width=maxX-minX,height=maxY-minY;
   if(contour.curves===0&&!contour.closed&&points.length===4&&width>=4&&width<=500&&height<.8){
    const ink=items.filter(item=>{const baseline=item.transform[5],x=item.transform[4],overlap=Math.max(0,Math.min(x+item.width,maxX)-Math.max(x,minX));return /[\p{L}\p{N}]/u.test(item.str)&&baseline-minY>=-.2&&baseline-minY<=Math.max(2,item.height*.4)&&overlap/Math.max(1,item.width)>.7});
    if(ink.length){const line=extractPageText(onLine(ink[0].transform[5]));if(line.includes('/'))hints.push({line,answer:extractPageText(ink).replace(/\s+/g,' ').trim(),source:'underline'});}
   }
   if(contour.curves<4&&!(contour.curves>=2&&contour.closed))continue;
   if(width<6||width>500||height<4||height>45||width/height>60)continue;
   const enclosed=items.filter(item=>{const x=item.transform[4]+item.width/2,y=item.transform[5]+item.height*.35;return item.str.trim()&&x>=minX&&x<=maxX&&y>=minY&&y<=maxY;});
   if(!enclosed.length)continue;
   const answer=extractPageText(enclosed).replace(/\s+/g,' ').trim();if(!/^[\p{L}\p{N}][\p{L}\p{N}\s’'.,!?()–—:;-]{0,500}$/u.test(answer))continue;
   hints.push({line:extractPageText(onLine(enclosed[0].transform[5])),answer,source:'circle'});
   }
  }
 }
 const styled=extractStyledChoices(items,fontNames);
 hints.push(...styled.boldMarks.map(h=>({...h,source:'bold' as const})),...styled.choices.map(h=>({...h,source:'inline-choice' as const,answer:''})));
 return hints;
}
function hintedAnswer(source:string,options:string[],hints:AnswerHint[]){
 const normalized=normalize(source);
 for(const kinds of [['circle','underline'],['bold']]){
  const matches=new Set<string>();
  for(const hint of hints.filter(h=>kinds.includes(h.source))){
   if(!normalized.includes(normalize(hint.line)))continue;
   const answer=normalize(hint.answer).replace(/[.,;:!?]+$/,'');if(!answer)continue;
   for(const option of options){const comparable=normalize(option).replace(/[.,;:!?]+$/,'');if(comparable===answer||comparable.startsWith(answer+' '))matches.add(option);}
  }
  if(matches.size===1)return [...matches][0];
  if(matches.size>1)return '';
 }
 return '';
}
export function detectExercises(text:string,hints:AnswerHint[]=[],wordBanks:WordBankHint[]=[]):ExerciseMark[]{
 const lines:SourceLine[]=[];let offset=0;
 for(const line of text.split('\n')){lines.push({text:line,start:offset,end:offset+line.length});offset+=line.length+1;}
 const marks:ExerciseMark[]=[...detectTickExercises(text),...wordBankMarks(wordBanks),...hints.filter(h=>h.source==='written'&&Number.isInteger(h.start)&&Number.isInteger(h.end)).map(h=>({id:crypto.randomUUID(),start:h.start!,end:h.end!,...(h.multiline!==undefined?{multiline:h.multiline}:{}),...(h.kind==='choice'?{kind:h.kind,inline:h.inline,prompt:h.prompt,options:h.options,answer:h.answer}:{})}))];
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
  let inlineFound=false;
  for(const hint of hints.filter(h=>h.source==='inline-choice'&&h.prompt&&h.options?.length)){
   const target=normalize(hint.line);if(!target.startsWith(normalize(line)))continue;
   let end=i,source=normalize(text.slice(lines[i].start,lines[end].end));
   while(source.length<target.length&&end+1<lines.length&&end<i+12){end++;source=normalize(text.slice(lines[i].start,lines[end].end));}
   if(source===target){addChoice(i,end,hint.prompt!,hint.options!);i=end;inlineFound=true;break;}
  }
  if(inlineFound)continue;
  if(/^\d{1,3}[.)]?\s/.test(line)){
   const question=readLetteredQuestion(lines,i,marks);
   if(question){addChoice(i,question.end,question.prompt,question.options);i=question.end;continue;}
  }
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
   // A completed open question keeps its statement in the document and turns
   // only the following solution into a written-response field.
   if(openQuestions&&/\?$/.test(line)){
    let answerLine=i+1;while(answerLine<lines.length&&!lines[answerLine].text.trim())answerLine++;
    const answer=lines[answerLine]?.text.trim();
    if(answer&&!/^(?:\d+[.)]?\s|Score:|[A-H][.)]?\s)/.test(answer)&&!marks.some(m=>m.start<lines[answerLine].end&&m.end>lines[answerLine].start)){
     marks.push({id:crypto.randomUUID(),start:lines[answerLine].start,end:lines[answerLine].end});i=answerLine;
    }
   }
  }else if(/^Model (?:answer|writing)$/i.test(line)){
   let start=i+1;while(start<lines.length&&!lines[start].text.trim())start++;
   let end=start;while(end<lines.length&&!/^Score:/i.test(lines[end].text.trim()))end++;
   while(end>start&&!lines[end-1].text.trim())end--;
   if(end>start)marks.push({id:crypto.randomUUID(),start:lines[start].start,end:lines[end-1].end,multiline:true});
   i=end-1;
  }
 }
 return marks.sort((a,b)=>a.start-b.start);
}

/** Re-recognition can extend a truncated option without erasing teacher edits. */
export function mergeDetectedExercises(previous:ExerciseMark[],detected:ExerciseMark[]):ExerciseMark[]{
 const ids=new Map<string,string>();
 function mappedOption(value:string,options:string[]){
  const exact=options.find(o=>normalize(o)===normalize(value));if(exact)return exact;
  const matches=options.filter(o=>normalize(o).startsWith(normalize(value)+' ')||normalize(value).startsWith(normalize(o)+' '));
  return matches.length===1?matches[0]:undefined;
 }
 const next=detected.filter(candidate=>!previous.some(old=>!old.kind&&old.start<candidate.end&&old.end>candidate.start&&(old.start!==candidate.start||old.end!==candidate.end))).map(candidate=>{
  const old=previous.find(m=>m.start===candidate.start&&m.kind===candidate.kind&&(m.end===candidate.end||m.kind==='choice'&&candidate.end>=m.end&&normalize(candidate.prompt||'').startsWith(normalize(m.prompt||''))));
  const result={...candidate};if(!old)return result;
  ids.set(candidate.id,old.id);result.id=old.id;
  if(old.answer){
   if(candidate.kind==='choice')result.answer=mappedOption(old.answer,candidate.options||[])??candidate.answer;
   else if(candidate.kind==='multi-choice'){
    try{const selected:unknown=JSON.parse(old.answer);if(Array.isArray(selected)&&selected.every(v=>typeof v==='string')){const mapped=selected.map(v=>mappedOption(v,candidate.options||[]));if(mapped.every(Boolean))result.answer=JSON.stringify(mapped);}}catch{}
   }else result.answer=old.answer;
  }
  if(old.multiline!==undefined)result.multiline=old.multiline;
  return result;
 });
 for(const candidate of next)if(candidate.bankId)candidate.bankId=ids.get(candidate.bankId)||candidate.bankId;
 return [...previous.filter(old=>!next.some(c=>c.start<old.end&&c.end>old.start)),...next].sort((a,b)=>a.start-b.start);
}
