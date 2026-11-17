import {exerciseTextLines} from '../lib/exercise-text-layout.ts';

function body(text:string){
 // Some PDFs glue a separately printed gap number to the previous word.
 // Keep those source characters intact too; only supply the visual spacing.
 const pieces=[];let start=0;
 for(const match of text.matchAll(/(?<=[a-z])([1-9])(?=\s+[A-Za-z])/g)){
  pieces.push(text.slice(start,match.index),<span key={match.index} className="exercise-inline-number">{match[0]}</span>);start=match.index!+match[0].length;
 }
 pieces.push(text.slice(start));return pieces;
}
export default function ExerciseText({text,atLineStart=true}:{text:string;atLineStart?:boolean}){
 return <>{exerciseTextLines(text,atLineStart).map((line,index)=>{
  const content=line.number?<><span className="exercise-number" data-suffix={line.number.suffix}>{line.number.raw}</span>{body(line.text.slice(line.number.raw.length))}</>:body(line.text);
  return <span key={index} className={line.kind==='heading'?'exercise-heading':line.kind==='section'?'exercise-section':undefined}>{content}</span>;
 })}</>;
}
