import type {ExerciseMark} from './exam-parts';
const tick=/[✓✔☑√\uf0fc]/u;
const stripTicks=(value:string)=>value.replace(/[✓✔☑√\uf0fc□☐]/gu,'').trim();
/** Recognize tick lists before line-based single-choice detection. No AI involved. */
export function detectTickExercises(text:string):ExerciseMark[]{
 const lines:{text:string;start:number;end:number}[]=[];let offset=0;for(const t of text.split('\n')){lines.push({text:t,start:offset,end:offset+t.length});offset+=t.length+1;}
 const marks:ExerciseMark[]=[];
 const counts:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
 for(let i=0;i<lines.length;i++){
  const prompt=lines[i].text.trim();if(!/\b(?:tick|check|mark)\b/i.test(prompt)||!/\b(?:listen|sentences?|statements?|things?|mention|hear|correct)\b/i.test(prompt)||/\b(?:true|false)\b/i.test(prompt))continue;
  const count=/\b(?:tick|check|mark)\s*(?:[✓✔☑√\uf0fc()]\s*)*(?:(?:the|only|any)\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\b/i.exec(prompt);
  const selectCount=count?(counts[count[1].toLowerCase()]||Number(count[1])):undefined;
  const options:string[]=[];const correct:boolean[]=[];let end=i;let number=1;
  for(let j=i+1;j<lines.length;j++){
   const raw=lines[j].text.trim();if(!raw)continue;if(/^Score\s*:|^(?:LISTENING|GRAMMAR|READING|VOCABULARY|WRITING)\b|^\d+[.)]?\s+(?:Listen|Complete|Write|Match|Choose|Read|Tick|Check|Mark)\b/i.test(raw))break;
   const option=/^(?:[✓✔☑√\uf0fc□☐]\s*)?(\d{1,2})[.)]?\s+(.+)$/u.exec(raw);
   if(option){if(Number(option[1])!==number)break;options.push(stripTicks(raw));correct.push(tick.test(raw));number++;end=j;}
   else if(/^[✓✔☑√\uf0fc□☐\s]+$/u.test(raw)){if(options.length){correct[correct.length-1]||=tick.test(raw);end=j;}}
   else if(options.length&&!/^\d+[.)]?\s|^\[|^\(\d/.test(raw)){options[options.length-1]+=' '+stripTicks(raw);correct[correct.length-1]||=tick.test(raw);end=j;}
   else break;
  }
  if(options.length<2||options.length>40||new Set(options).size!==options.length||selectCount!==undefined&&(selectCount<1||selectCount>options.length))continue;
  const chosen=options.filter((_,index)=>correct[index]);const answer=chosen.length&&(selectCount===undefined||chosen.length===selectCount)?JSON.stringify(chosen):'';
  marks.push({id:crypto.randomUUID(),start:lines[i].start,end:lines[end].end,kind:'multi-choice',prompt,options,answer,...(selectCount?{selectCount}:{})});i=end;
 }
 return marks;
}
