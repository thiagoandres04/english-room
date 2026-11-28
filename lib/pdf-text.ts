/** Reconstruct reading order from geometry, not the PDF content-stream order. */
export type PositionedText = { str:string; transform:number[]; width:number; height:number; hasEOL?:boolean; dir?:string };
export type PDFTextPage = { start:number; end:number };
type Run = {text:string;x:number;y:number;width:number;height:number;index:number};
type Line = {y:number;height:number;runs:Run[]};
function median(values:number[],fallback:number){if(!values.length)return fallback;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];}
function joinRuns(runs:Run[]){
  let text='';let previous:Run|undefined;
  for(const run of runs.sort((a,b)=>a.x-b.x||a.index-b.index)){
    // Ignore the synthetic whitespace items emitted by PDF.js. Their geometry is
    // sometimes oversized; actual glyph positions are the reliable separator.
    const gap=previous?run.x-(previous.x+previous.width):0;
    const threshold=Math.max(.35,Math.min(run.height,previous?.height||run.height)*.06);
    const numberedGap=/^\d{1,2}$/.test(run.text)&&/\p{L}$/u.test(text);
    const contraction=gap<3&&(/^['’]$/.test(run.text)&&/\p{L}$/u.test(text)||/^['’]$/.test(previous?.text||'')&&/^(?:t|s|re|ve|ll|d|m)\b/.test(run.text));
    const needsSpace=previous&&!contraction&&(gap>threshold||numberedGap)&&!/^[,.;:!?%)\]}]/u.test(run.text)&&!/[([{]$/u.test(text);
    text+=(needsSpace?' ':'')+run.text;
    previous=run;
  }
  return text.trim();
}
export function repairSyntheticSpaces(items:PositionedText[],glyphText?:string):PositionedText[]{
  if(!glyphText)return items;
  const normalize=(s:string)=>s.normalize('NFKC');
  const raw=normalize(glyphText);
  const normalized=items.map(i=>normalize(i.str));
  // Only trust the glyph stream when every real character matches exactly.
  // Layout-inferred gaps between separate runs are still handled geometrically.
  if(raw.replace(/\s/g,'')!==normalized.join('').replace(/\s/g,''))return items;
  const realSpaces=new Set<number>();let position=0;
  for(const c of raw){if(/\s/u.test(c))realSpaces.add(position);else position+=c.length;}
  let offset=0;let interiorSpaces=0;let matchedSpaces=0;
  for(const str of normalized){for(let i=0;i<str.length;i++){const c=str[i];if(/\s/u.test(c)){if(i>0&&i<str.length-1){interiorSpaces++;if(realSpaces.has(offset))matchedSpaces++;}}else offset++;}}
  // PDFs without meaningful space glyphs rely on positioned word gaps. Preserve
  // their inferred whitespace rather than joining all words together.
  if(interiorSpaces<5||matchedSpaces/interiorSpaces<.8)return items;
  offset=0;
  return items.map((item,index)=>{
    const str=normalized[index];let repaired='';
    for(let i=0;i<str.length;i++){
      const c=str[i];
      if(/\s/u.test(c)){
        const insideWord=i>0&&i<str.length-1&&/\p{L}/u.test(str[i-1])&&/\p{L}/u.test(str[i+1]);
        if(!insideWord||realSpaces.has(offset))repaired+=c;
      }else{repaired+=c;offset++;}
    }
    return {...item,str:repaired};
  });
}
export function extractPageText(items:PositionedText[],glyphText?:string):string {
  items=repairSyntheticSpaces(items,glyphText);
  const runs:Run[]=items.flatMap((item,index)=>{
    if(typeof item.str!=='string'||!item.str.trim()||!item.transform)return [];
    const [a,b,c,d,x,y]=item.transform;
    if(![x,y].every(Number.isFinite))return [];
    return [{text:item.str.replace(/[\t\u00a0]/g,' ').replace(/ {2,}/g,' ').trim(),x,y,width:Math.max(0,item.width||0),height:Math.max(1,item.height||Math.hypot(c,d)||Math.hypot(a,b)||10),index}];
  });
  if(!runs.length)return '';
  const lines:Line[]=[];
  // Baseline tolerance reunites mixed-font runs and superscripts while keeping
  // neighboring lines separate. Synthetic EOLs never create additional lines.
  for(const run of runs.sort((a,b)=>b.y-a.y||a.x-b.x||a.index-b.index)){
    const tolerance=Math.max(1.2,Math.min(run.height,14)*.22);
    const line=lines.findLast(l=>Math.abs(l.y-run.y)<=Math.max(tolerance,Math.min(l.height,14)*.22));
    if(line){line.runs.push(run);line.height=Math.max(line.height,run.height)}else lines.push({y:run.y,height:run.height,runs:[run]});
  }
  lines.sort((a,b)=>b.y-a.y);
  const gaps=lines.slice(1).map((l,i)=>lines[i].y-l.y).filter(g=>g>3&&g<30);
  const normalGap=median(gaps,median(runs.map(r=>r.height),10)*1.5);
  const contents=lines.map(line=>joinRuns(line.runs));
  const rightMargin=Math.max(...runs.map(r=>r.x+r.width));
  let text='';
  for(let i=0;i<lines.length;i++){
    if(i){
      const previous=lines[i-1];const current=lines[i];const gap=previous.y-current.y;
      const paragraph=gap>Math.max(normalGap*1.35,Math.max(previous.height,current.height)*1.95);
      const previousLeft=Math.min(...previous.runs.map(r=>r.x));const currentLeft=Math.min(...current.runs.map(r=>r.x));
      const previousRight=Math.max(...previous.runs.map(r=>r.x+r.width));
      const lineStartsItem=/^(?:\d{1,3}[.)]?\s|[A-E][.)]?\s|Score:|LISTENING|READING|Model answer)/u.test(contents[i]);
      // Long prose lines wrap to the viewport; question/answer pairs, numbered
      // items and options retain their own line. Keep real paragraph spacing.
      const softWrap=!paragraph&&contents[i-1].length>=65&&previousRight>=rightMargin-previous.height*4&&Math.abs(currentLeft-previousLeft)<=current.height*3&&!/[?:]$/u.test(contents[i-1])&&!lineStartsItem;
      text+=paragraph?'\n\n':softWrap?' ':'\n';
    }
    text+=contents[i];
  }
  return text.trim();
}
export function combinePages(pageTexts:string[]):{text:string;pages:PDFTextPage[]}{
  let text='';const pages:PDFTextPage[]=[];
  for(const content of pageTexts){if(pages.length)text+='\n\n';const start=text.length;text+=content;pages.push({start,end:text.length});}
  return {text,pages};
}
