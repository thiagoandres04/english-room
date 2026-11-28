import {extractPageText,type PositionedText} from './pdf-text.ts';
import {stripPDFStudentHeader} from './pdf-student-header.ts';
type Run=PositionedText&{fontName?:string};
const numbers=(value:any):number[]=>Array.isArray(value)?value:ArrayBuffer.isView(value)?Array.from(value as any):Object.values(value||{});
const multiply=(a:number[],b:number[])=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function preparePDFFormItems(input:Run[],operators:{fnArray:ArrayLike<number>;argsArray:any[]},ops:Record<string,number>){
 const cleaned=stripPDFStudentHeader(input);
 let items=cleaned.items.filter(i=>i.str.trim()&&!/(?:Photocopiable|©\s*Macmillan|macmillan education)/i.test(i.str));
 items=items.map(i=>({...i,str:i.str.replace(/^(\d{1,2})(?=(?:Choose|Complete|Read|Write|Rewrite|Match|Look)\b)/,'$1 ')}));
 const lines:{x:number;y:number;width:number}[]=[];let matrix=[1,0,0,1,0,0];const stack:number[][]=[];
 for(let i=0;i<operators.fnArray.length;i++){
  const code=operators.fnArray[i],args=operators.argsArray[i];
  if(code===ops.save)stack.push([...matrix]);else if(code===ops.restore)matrix=stack.pop()||matrix;else if(code===ops.transform)matrix=multiply(matrix,args);
  else if(code===ops.constructPath){
   const commands=numbers(args?.[0]),coords=numbers(args?.[1]);
   const rectangle=commands.length===1&&commands[0]===ops.rectangle;
   if(!rectangle&&(commands.length!==2||commands[0]!==ops.moveTo||commands[1]!==ops.lineTo)||coords.length!==4)continue;
   const point=(x:number,y:number)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
   const a=point(coords[0],coords[1]),b=rectangle?point(coords[0]+coords[2],coords[1]+coords[3]):point(coords[2],coords[3]),width=Math.abs(b.x-a.x);
   if(Math.abs(a.y-b.y)>.8||width<12||width>510)continue;
   const x=Math.min(a.x,b.x),y=(a.y+b.y)/2;
   if(lines.some(l=>Math.abs(l.x-x)<1&&Math.abs(l.y-y)<1&&Math.abs(l.width-width)<1))continue;
   lines.push({x,y,width});
  }
 }
 items=items.map(item=>{
  if(!/^\d{1,2}$/.test(item.str.trim()))return item;
  const baseline=items.filter(other=>other!==item&&other.str.trim()&&!/^\d+$/.test(other.str.trim())&&other.height>item.height*1.1&&item.transform[5]-other.transform[5]>2&&item.transform[5]-other.transform[5]<7).sort((a,b)=>Math.abs(a.transform[5]-item.transform[5])-Math.abs(b.transform[5]-item.transform[5]))[0];
  return baseline?{...item,transform:[...item.transform.slice(0,5),baseline.transform[5]]}:item;
 });
 const bodyTop=Math.max(0,...items.map(i=>i.transform[5]));
 for(const line of lines){
  if(line.y>bodyTop+2||line.y<55)continue;
  const nearby=items.filter(i=>i.str.trim()&&Math.abs(i.transform[5]-line.y)<Math.max(5,i.height*.7));
  const occupied=nearby.some(i=>/[\p{L}\p{N}]/u.test(i.str)&&Math.min(i.transform[4]+i.width,line.x+line.width)-Math.max(i.transform[4],line.x)>Math.min(i.width*.3,5));
  if(occupied)continue;
  const nearest=nearby.sort((a,b)=>Math.abs(a.transform[5]-line.y-1)-Math.abs(b.transform[5]-line.y-1))[0];
  if(!nearest&&line.width<70)continue;
  const baseline=nearest?.transform[5]??line.y+1;
  items.push({str:line.width>180?'____________':'______',fontName:nearest?.fontName,height:nearest?.height||8,width:line.width,transform:[8,0,0,8,line.x,baseline]});
 }
 // Reconstruct genuinely side-by-side matching columns before reading-order
 // flattening can interleave words with unrelated definitions.
 const rows:{y:number;items:Run[]}[]=[];
 for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  let row=rows.find(r=>Math.abs(r.y-item.transform[5])<2.6);if(!row){row={y:item.transform[5],items:[]};rows.push(row);}row.items.push(item);
 }
 for(let i=0;i<rows.length;i++){
  if(/correct column/i.test(extractPageText(rows[i].items))){
   const textRows=rows.slice(i+1).filter(r=>r.items.some(it=>/\p{L}/u.test(it.str)));
   const bankRow=textRows[0],categories=textRows[1];
   if(bankRow&&categories&&bankRow.items.filter(r=>r.str.trim()).length>=3&&categories.items.filter(r=>r.str.trim()).length>=2){
    const categoryCells=categories.items.filter(r=>/\p{L}/u.test(r.str)).sort((a,b)=>a.transform[4]-b.transform[4]);
    const words=new Set(bankRow.items.map(r=>r.str.trim().toLowerCase()));
    const score=rows.slice(i+1).find(r=>/^Score\s*:/i.test(extractPageText(r.items)))?.y??0;
    items=items.filter(it=>!(/^_+$/.test(it.str.trim())&&it.transform[5]<categories.y&&it.transform[5]>score));
    items=items.map(it=>{if(it.transform[5]>=categories.y||it.transform[5]<=score||!words.has(it.str.trim().toLowerCase()))return it;const index=categoryCells.findLastIndex(c=>c.transform[4]<=it.transform[4]+5);return index>=0?{...it,str:'Example: '+it.str.trim()+' → '+categoryCells[index].str.trim()}:it;});
    for(const row of [bankRow,categories]){const cells=row.items.filter(r=>/\p{L}/u.test(r.str)).sort((a,b)=>a.transform[4]-b.transform[4]);const remove=new Set(row.items);items=items.filter(it=>!remove.has(it));items.push({...cells[0],str:cells.map(c=>c.str.trim()).join(' | '),width:450});}
   }
  }
  if(!/^\d+[.)]?\s*Match\b/i.test(extractPageText(rows[i].items)))continue;
  let end=i+1;while(end<rows.length&&!/^Score\s*:|^\d+[.)]?\s+(?:Read|Choose|Complete|Write|Match)/i.test(extractPageText(rows[end].items)))end++;
  const region=rows.slice(i+1,end),all=region.flatMap(r=>r.items),labels=all.filter(r=>/^[a-h][.)]?$/i.test(r.str.trim())&&r.transform[4]>300);
  if(labels.length<3)continue;
  const rightX=Math.min(...labels.map(r=>r.transform[4]))-5;
  const left=region.map(r=>extractPageText(r.items.filter(it=>it.transform[4]<rightX))).filter(Boolean);
  const right=region.map(r=>extractPageText(r.items.filter(it=>it.transform[4]>=rightX))).filter(Boolean);
  if(!left.some(l=>/^1\s/.test(l))||!right.some(l=>/^[aA]\s/.test(l)))continue;
  const remove=new Set(all),base=all[0];items=items.filter(it=>!remove.has(it));
  items.push({...base,str:left.join('\n')+'\n'+right.join('\n'),width:400,transform:[8,0,0,8,55,region[0].y]});
 }
 return {items,headerRemoved:cleaned.removed,blankLines:lines.length};
}
