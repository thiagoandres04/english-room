import {detectTickExercises} from './pdf-ticks.ts';
import {extractPageText,type PositionedText} from './pdf-text.ts';
import type {ExerciseMark} from './exam-parts';
import {wordBankMarks,type WordBankHint} from './pdf-word-banks.ts';
import {extractStyledChoices} from './pdf-choice-layout.ts';
import type {ExamFigure} from './exam-figures.ts';
import {repairedChoiceHints,repairedWordBanks,recoveredTypedKeys,isReadingTitle} from './pdf-hint-repair.ts';
import {structuredSections,blankFields} from './pdf-structured-exercises.ts';
export type AnswerHint={line:string;answer:string;source:'circle'|'underline'|'bold'|'written'|'inline-choice'|'slash-options'|'figure';fragment?:string;occurrence?:number;start?:number;end?:number;figure?:ExamFigure;prompt?:string;options?:string[];kind?:'choice';inline?:boolean;multiline?:boolean};
type TextRun=PositionedText&{fontName?:string};
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
const instruction=/^\d{1,3}[.)]?\s+(?:Listen\b|Read the\b|Answer the\b|Choose\b|Match\b|Complete\b|Look at\b|Are the sentences\b|Do you agree\b|Write\b|Circle\b|Tick\b|Select\b)/i;
type SourceLine={text:string;start:number;end:number};
const letteredOption=/^([A-H])[.)]?\s+(.+)$/;
/** Ordered labels can share a row; punctuation on a label is optional. */
function optionsOnLine(text:string){
 const first=letteredOption.exec(text);if(!first)return null;
 const labels=[...text.matchAll(/(?:^|\s)([A-H])[.)]?\s+/g)];
 if(labels.length<2)return [{letter:first[1],text:first[2]}];
 if(labels.some((m,i)=>m[1]!==String.fromCharCode(first[1].charCodeAt(0)+i)))return null;
 return labels.map((m,i)=>({letter:m[1],text:text.slice(m.index!+m[0].length,labels[i+1]?.index??text.length).trim()}));
}
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
   const rowOptions=optionsOnLine(text);
   if(rowOptions){
    for(const option of rowOptions){if(!option.text||option.letter!==String.fromCharCode(65+options.length))return null;options.push(option.letter+' '+option.text);}
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
    if(ink.length){const line=extractPageText(onLine(ink[0].transform[5]));hints.push({line,answer:extractPageText(ink).replace(/\s+/g,' ').trim(),source:'underline'});}
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
 hints.push(...styled.inlineGroups.map(h=>({...h,source:'slash-options' as const})));
 return hints;
}
function hintedAnswer(source:string,options:string[],hints:AnswerHint[]){
 const normalized=normalize(source);
 for(const kinds of [['circle','underline'],['bold']]){
  const matches=new Set<string>(),labels=new Set<string>();
  for(const hint of hints.filter(h=>kinds.includes(h.source))){
   if(!normalized.includes(normalize(hint.line)))continue;
   const clean=(s:string)=>normalize(s).replace(/^([A-H])[.)]\s*/,'$1 ').replace(/[.,;:!?]+$/,'');
   const answer=clean(hint.answer);if(!answer)continue;
   for(const option of options){const comparable=clean(option),body=comparable.replace(/^[A-H]\s+/,'');if(comparable===answer||body===answer)matches.add(option);else if(comparable.startsWith(answer+' '))(hint.source==='bold'&&/^[A-H]$/.test(answer)?labels:matches).add(option);}
  }
  if(matches.size===1)return [...matches][0];
  if(matches.size>1)return '';
  if(labels.size===1)return [...labels][0];
  if(labels.size>1)return '';
 }
 return '';
}
export function detectExercises(text:string,hints:AnswerHint[]=[],wordBanks:WordBankHint[]=[]):ExerciseMark[]{
 hints=repairedChoiceHints(hints);wordBanks=repairedWordBanks(text,wordBanks,hints);
 const lines:SourceLine[]=[];let offset=0;
 for(const line of text.split('\n')){lines.push({text:line,start:offset,end:offset+line.length});offset+=line.length+1;}
 const sections=structuredSections(text);
 const marks:ExerciseMark[]=[...sections,...detectTickExercises(text),...wordBankMarks(wordBanks),...hints.filter(h=>h.source==='written'&&Number.isInteger(h.start)&&Number.isInteger(h.end)&&!isReadingTitle(text,h.start!,h.end!)).map(h=>({id:crypto.randomUUID(),start:h.start!,end:h.end!,...(h.multiline!==undefined?{multiline:h.multiline}:{}),...(h.kind==='choice'?{kind:h.kind,inline:h.inline,prompt:h.prompt,options:h.options,answer:h.answer}:{})}))].filter((m,i)=>i<sections.length||!sections.some(s=>s.start<m.end&&s.end>m.start));
 marks.push(...hints.filter(h=>h.source==='figure'&&h.figure&&Number.isInteger(h.start)&&h.start===h.end).map(h=>({id:crypto.randomUUID(),start:h.start!,end:h.end!,kind:'figure' as const,figure:h.figure})));
 marks.push(...recoveredTypedKeys(text,hints,marks));
 for(const match of text.matchAll(/\(([^()\n]*\/[^()\n]*)\)\s*_{3,}/g)){
  const options=match[1].split(/\s*\/\s*/).map(s=>s.trim()),start=match.index!,end=start+match[0].length;
  if(options.length>=2&&options.length<=12&&options.every(o=>o&&o.length<100)&&!marks.some(m=>m.start<end&&m.end>start))marks.push({id:crypto.randomUUID(),start,end,kind:'choice',inline:true,prompt:'Elegí la opción correcta',options,answer:''});
 }
 for(const hint of hints.filter(h=>h.source==='slash-options'&&h.fragment&&h.options?.length&&!hints.some(other=>other.source==='inline-choice'&&normalize(other.line)===normalize(h.line)))){
  const flexible=(value:string)=>new RegExp(value.trim().split(/\s+/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+'),'gu');
  const containers=[...text.matchAll(flexible(hint.line))];if(containers.length!==1)continue;
  const container=containers[0],matches=[...container[0].matchAll(flexible(hint.fragment!))],match=matches[hint.occurrence||0];if(!match)continue;
  const start=container.index!+match.index!,end=start+match[0].length;
  if(!marks.some(m=>m.start<end&&m.end>start))marks.push({id:crypto.randomUUID(),start,end,kind:'choice',inline:true,prompt:'Elegí la opción correcta',options:hint.options,answer:hint.answer});
 }
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
   const texts=/Choose the correct text\s*\(([^)]+)\)/i.exec(line);if(texts){const options=texts[1].match(/\b[A-H]\b/g);if(options&&options.length>=2&&new Set(options).size===options.length)matchingOptions=options;}
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
  if(/^\d{1,3}[.)]?\s/.test(line)||/[_…]{2,}/.test(line)){
   const question=readLetteredQuestion(lines,i,marks);
   if(question){addChoice(i,question.end,question.prompt,question.options);i=question.end;continue;}
  }
  if(matchingOptions){
   const match=/^(\d{1,3}|[A-H])[.)]?\s+(.+?)\s+([A-H]|\d{1,2})$/.exec(line);
   if(match&&matchingOptions.includes(match[3])){addChoice(i,i,match[1]+' '+match[2],matchingOptions,match[3]);continue;}
  }
  if(/^(?:\d{1,3}[.)]?|[A-H][.)])\s/.test(line)){
   const slash=/\b[\p{L}][\p{L}'’’-]*(?:\s*\/\s*[\p{L}][\p{L}'’’-]*){1,5}\b/u.exec(line);
   if(slash&&!/^(?:\d+[.)]?|[A-H][.)])\s*\(/.test(line)){
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
 marks.push(...blankFields(text,marks,wordBanks));
 return marks.sort((a,b)=>a.start-b.start);
}

/** Re-recognition can extend a truncated option without erasing teacher edits. */
export function mergeDetectedExercises(previous:ExerciseMark[],detected:ExerciseMark[],text=''):ExerciseMark[]{
 const ids=new Map<string,string>();
 function mappedOption(value:string,options:string[]){
  const exact=options.find(o=>normalize(o)===normalize(value));if(exact)return exact;
  const matches=options.filter(o=>normalize(o).startsWith(normalize(value)+' ')||normalize(value).startsWith(normalize(o)+' '));
  return matches.length===1?matches[0]:undefined;
 }
 const next=detected.filter(candidate=>!previous.some(old=>!old.kind&&old.start<candidate.end&&old.end>candidate.start&&(old.start!==candidate.start||old.end!==candidate.end)&&!(candidate.kind==='choice'&&/^[\s_.…–—-]+$/.test(text.slice(old.start,old.end))))).map(candidate=>{
  const old=previous.find(m=>m.start===candidate.start&&m.kind===candidate.kind&&(m.end===candidate.end||m.kind==='choice'&&candidate.end>=m.end&&normalize(candidate.prompt||'').startsWith(normalize(m.prompt||''))));
  const result={...candidate};if(!old)return result;
  ids.set(candidate.id,old.id);result.id=old.id;
  if(candidate.section&&old.section)result.section=candidate.section.map(part=>{const previous=old.section!.find(p=>p.kind===part.kind&&p.prompt===part.prompt&&p.answer!==undefined);return previous?{...part,id:previous.id,answer:previous.answer}:part;});
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
 return [...previous.filter(old=>!next.some(c=>c.start<old.end&&c.end>old.start||old.kind==='figure'&&c.kind==='figure'&&c.start===old.start)),...next].sort((a,b)=>a.start-b.start);
}
