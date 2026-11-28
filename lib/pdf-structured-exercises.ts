import type {ExerciseMark,ExamPart} from './exam-parts';
import type {WordBankHint} from './pdf-word-banks';
export const exerciseHeader=/^\d{1,2}[.)]?\s*(?:Choose|Complete|Read|Rewrite|Write|Match|Look|What are they made of)\b[^\n]*/gmi;
export function structuredSections(text:string):ExerciseMark[]{
 const headers=[...text.matchAll(exerciseHeader)],result:ExerciseMark[]=[];
 for(let i=0;i<headers.length;i++){
  const h=headers[i],start=h.index!,limit=headers[i+1]?.index??text.length;
  const score=/^Score\s*:/mi.exec(text.slice(start,limit)),end=score?start+score.index:limit;
  const block=text.slice(start,end),lines=block.split('\n').map(l=>l.trim()).filter(Boolean);
  if(/\bMatch\b/i.test(h[0])){
   const left:{label:string;value:string}[]=[],right:{label:string;value:string}[]=[];let side:'left'|'right'='left';
   for(const line of lines.slice(1)){
    const a=/^(\d{1,2})[.)]?\s+(.+)$/.exec(line),b=/^([A-Ha-h])[.)]?\s+(.+)$/.exec(line);
    if(b){side='right';right.push({label:b[1].toUpperCase(),value:b[2].replace(/_{3,}/g,'').trim()});}
    else if(a&&side==='left')left.push({label:a[1],value:a[2].replace(/_{3,}/g,'').trim()});
    else if(!/^(?:READING|WRITING|GRAMMAR|VOCABULARY|ADDITIONAL)/i.test(line)){const previous=(side==='left'?left:right).at(-1);if(previous)previous.value+=' '+line.replace(/_{3,}/g,'').trim();}
   }
   if(left.length>=2&&left.length<=40&&right.length>=2&&right.length<=12&&right.every((r,j)=>r.label===String.fromCharCode(65+j))){
    const groupId=crypto.randomUUID(),options=right.map(r=>r.label+' '+r.value);
    const section:ExamPart[]=[{text:h[0]+'\n\n'},...left.map(l=>({id:crypto.randomUUID(),kind:'choice' as const,prompt:l.label+') '+l.value,options,answer:'',groupId,groupStyle:'matching' as const})),{text:'\n\n'}];
    result.push({id:crypto.randomUUID(),start,end,section});
   }
  }else if(/\bcorrect column\b/i.test(h[0])){
   const rows=lines.slice(1).filter(l=>l.includes('|'));if(rows.length<2)continue;
   const words=rows[0].split('|').map(s=>s.trim()).filter(Boolean),options=rows[1].split('|').map(s=>s.trim()).filter(Boolean);
   if(words.length<2||words.length>40||options.length<2||options.length>12)continue;
   const examples=lines.filter(l=>/^Example:/i.test(l));const fixed=examples.map(l=>/^Example:\s*(.*?)\s*→/.exec(l)?.[1]?.toLowerCase());
   const groupId=crypto.randomUUID(),section:ExamPart[]=[{text:h[0]+'\n'+examples.join('\n')+'\n\n'},...words.filter(w=>!fixed.includes(w.toLowerCase())).map(word=>({id:crypto.randomUUID(),kind:'choice' as const,prompt:word,options,answer:'',groupId,groupStyle:'categories' as const})),{text:'\n\n'}];
   result.push({id:crypto.randomUUID(),start,end,section});
  }else if(/\bWrite\s+\d{2,3}\s*[–—-]\s*\d{2,3}\s+words\b|\bWrite\b.*\b(?:story|essay|paragraph)\b/i.test(h[0])){
   const placeholders=[...block.matchAll(/_{3,}/g)];if(!placeholders.length)continue;
   const first=placeholders[0].index!,last=placeholders.at(-1)!;
   result.push({id:crypto.randomUUID(),start:start+first,end:start+last.index!+last[0].length,blank:true,answer:'',multiline:true});
  }
 }
 return result;
}
export function blankFields(text:string,occupied:ExerciseMark[],banks:WordBankHint[]):ExerciseMark[]{
 const result:ExerciseMark[]=[];
 for(const match of text.matchAll(/_{3,}/g)){
  const start=match.index!,end=start+match[0].length;if(occupied.some(m=>m.start<end&&m.end>start))continue;
  const prefix=text.slice(Math.max(0,start-100),start);if(/(?:Student name|Group\/Class|^NAME:|Score:)\s*$/im.test(prefix))continue;
  const bank=[...occupied].filter(m=>m.kind==='wordbank'&&m.end<=start).sort((a,b)=>b.start-a.start)[0];
  const between=bank?text.slice(bank.end,start):'';
  if(bank&&bank.bankMode!=='write'&&!/^Score\s*:|^\d{1,2}[.)]?\s+(?:Read|Choose|Complete|Write|Match|Look)/mi.test(between))result.push({id:crypto.randomUUID(),start,end,kind:'word-gap',bankId:bank.id,options:bank.options,answer:''});
  else result.push({id:crypto.randomUUID(),start,end,blank:true,answer:'',...(match[0].length>=12?{wide:true}:{})});
 }
 return result;
}
