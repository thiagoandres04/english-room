import {extractPageText,type PositionedText} from './pdf-text.ts';
type Run=PositionedText&{fontName?:string};
export type StyledChoice={line:string;prompt:string;options:string[]};
const bold=(font:string)=>/bold|black|heavy|semibold/i.test(font);
function style(run:Run,fonts:Record<string,string>){
 const font=fonts[run.fontName||'']||run.fontName||'';
 const family=font.replace(/^[A-Z]{6}\+/,'').replace(/bold|black|heavy|semibold|italic|oblique|regular|medium|[\s_-]/gi,'').toLowerCase();
 return /italic|oblique/i.test(font)?'italic:'+family:bold(font)?'bold:'+family:'font:'+font;
}
function flexibleMatch(text:string,part:string){
 const pattern=part.trim().split(/\s+/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
 return new RegExp(pattern,'u').exec(text);
}
/** Font changes delimit complete alternatives, including phrases and wraps.
 * Bold is evidence of a solution only when exactly one alternative matches. */
export function extractStyledChoices(items:Run[],fonts:Record<string,string>={}){
 const rows:{y:number;items:Run[];text:string}[]=[];
 for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<2.6);if(!row){row={y,items:[],text:''};rows.push(row)}row.items.push(item);
 }
 rows.forEach(r=>r.text=extractPageText(r.items));
 const choices:StyledChoice[]=[],boldMarks:{line:string;answer:string}[]=[];
 for(let i=0;i<rows.length;i++){
  if(!/^(?:\d{1,3}[.)]?|[A-H][.)])\s/.test(rows[i].text))continue;
  let end=i+1;while(end<rows.length&&!/^(?:(?:\d{1,3}[.)]?|[A-H][.)])\s|Score\s*:|LISTENING\b|READING\b|WRITING\b|GRAMMAR\b|VOCABULARY\b)/i.test(rows[end].text))end++;
  const block=rows.slice(i,end).flatMap(r=>r.items.sort((a,b)=>a.transform[4]-b.transform[4]));
  const line=extractPageText(block);
  const groups:Run[][]=[];let key='';
  for(const run of block){const next=style(run,fonts);if(next!==key){groups.push([]);key=next;}groups.at(-1)!.push(run);}
  const candidates:StyledChoice[]=[];
  for(const group of groups){
   // Plain body text can include T/F, answer synonyms, or sentence-building
   // clues. Only an emphasized span supplies reliable phrase boundaries.
   if(!/^(?:italic|bold):/.test(style(group[0],fonts)))continue;
   const text=extractPageText(group);if(!text.includes('/')||/^(?:\d{1,3}[.)]?|[A-H][.)])\s/.test(text))continue;
   const punctuation=/[.,;:!?]+$/.exec(text)?.[0]||'';
   const alternatives=punctuation?text.slice(0,-punctuation.length):text;
   const options=alternatives.split(/\s*\/\s*/).map(t=>t.replace(/\s+/g,' ').trim());
   if(options.length<2||options.length>12||options.some(t=>!t||t.length>3000)||new Set(options).size!==options.length)continue;
   const match=flexibleMatch(line,text);if(!match)continue;
   const before=line.slice(0,match.index),after=punctuation+line.slice(match.index+match[0].length);
   const prompt=(before+(/[\p{L}\p{N}]$/u.test(before)?' ':'')+'____'+(/^[\p{L}\p{N}]/u.test(after)?' ':'')+after).replace(/\s+/g,' ').trim();
   candidates.push({line,prompt,options});
  }
  if(candidates.length===1)choices.push(candidates[0]);
  let ink:Run[]=[];
  const flush=()=>{if(!ink.length)return;for(const answer of extractPageText(ink).split(/\s*\/\s*/).map(t=>t.replace(/\s+/g,' ').trim().replace(/[.,;:!?]+$/,'')))if(/[\p{L}]/u.test(answer)&&answer.length<=3000)boldMarks.push({line,answer});ink=[];};
  for(const run of block){if(bold(fonts[run.fontName||'']||'')&&!/^\d{1,3}[.)]?$/.test(run.str.trim()))ink.push(run);else flush();}flush();
 }
 return {choices,boldMarks};
}
