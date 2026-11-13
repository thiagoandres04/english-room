import type {ExamPart} from './exam-parts';
/** Local layout inference only: no AI request or change to grading. */
export function suggestsLongAnswer(prompt:string,answer=''){
 const context=prompt.slice(-1800);
 return answer.trim().length>160||answer.split('\n').filter(s=>s.trim()).length>2||/\b(?:write|writing|compose|redact[aá])\b[\s\S]{0,180}\b(?:essay|paragraph|story|email|e-mail|letter|article|report|review|composition|texto|ensayo|párrafo|carta)\b/i.test(context)||/\b(?:write|writing)\b[^\n]{0,140}\b(?:[4-9]\d|\d{3,4})\s*(?:[–—-]\s*\d+\s*)?words\b/i.test(context);
}
export function withAnswerSizes(parts:ExamPart[]):ExamPart[]{
 let prompt='';
 return parts.map(p=>{
  if(p.text!==undefined){prompt+=p.text;return p;}
  if(p.kind==='wordbank'){prompt='';return p;}
  if(p.answer!==undefined||p.blank){
   const long=p.multiline??suggestsLongAnswer(prompt,p.answer||'');prompt='';
   return p.kind==='choice'||p.kind==='multi-choice'||p.kind==='word-gap'||(!long&&p.multiline===undefined)?p:{...p,multiline:long};
  }
  return p;
 });
}
