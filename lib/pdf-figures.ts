import {extractPageText,type PositionedText} from './pdf-text.ts';
import {MAX_FIGURE_CHARS,type ExamFigure} from './exam-figures.ts';
type Operators={fnArray:ArrayLike<number>;argsArray:any[]};
const multiply=(a:number[],b:number[])=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function pdfImagePlacements(operators:Operators,ops:Record<string,number>){
 let matrix=[1,0,0,1,0,0];const stack:number[][]=[],images:{id:string;left:number;right:number;top:number;bottom:number}[]=[];
 for(let i=0;i<operators.fnArray.length;i++){
  const code=operators.fnArray[i],args=operators.argsArray[i];
  if(code===ops.save)stack.push([...matrix]);else if(code===ops.restore)matrix=stack.pop()||matrix;else if(code===ops.transform)matrix=multiply(matrix,args);
  else if(code===ops.paintImageXObject){const xs=[matrix[4],matrix[0]+matrix[4],matrix[2]+matrix[4],matrix[0]+matrix[2]+matrix[4]],ys=[matrix[5],matrix[1]+matrix[5],matrix[3]+matrix[5],matrix[1]+matrix[3]+matrix[5]];images.push({id:args[0],left:Math.min(...xs),right:Math.max(...xs),bottom:Math.min(...ys),top:Math.max(...ys)});}
 }return images;
}
export async function encodePDFFigure(image:any){
 if(!image||image.width*image.height>8000000)throw new Error('La imagen de referencia es demasiado grande. Usá una versión más liviana del PDF.');
 const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;const context=raw.getContext('2d');if(!context)throw new Error('No se pudo conservar la imagen de referencia.');
 if(image.bitmap)context.drawImage(image.bitmap,0,0);else{
  const rgba=new Uint8ClampedArray(image.width*image.height*4),data=image.data;
  for(let i=0;i<image.width*image.height;i++){const at=i*4;if(image.kind===2){rgba[at]=data[i*3];rgba[at+1]=data[i*3+1];rgba[at+2]=data[i*3+2];}else if(image.kind===3){rgba.set(data.subarray(at,at+4),at);continue;}else if(image.kind===1){const bit=i%image.width,row=Math.floor(i/image.width),v=(data[row*Math.ceil(image.width/8)+(bit>>3)]&(128>>(bit%8)))?255:0;rgba[at]=rgba[at+1]=rgba[at+2]=v;}else throw new Error('La imagen de referencia usa un formato no compatible.');rgba[at+3]=255;}
  context.putImageData(new ImageData(rgba,image.width,image.height),0,0);
 }
 const output=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(raw.width,raw.height));output.width=Math.ceil(raw.width*scale);output.height=Math.ceil(raw.height*scale);const ctx=output.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,output.width,output.height);ctx.drawImage(raw,0,0,output.width,output.height);
 for(const quality of [.92,.8,.65,.5]){const dataUrl=output.toDataURL('image/jpeg',quality);if(dataUrl.length<=MAX_FIGURE_CHARS)return {dataUrl,width:output.width,height:output.height};}
 throw new Error('La tabla o imagen ocupa demasiado espacio. Usá un PDF con la imagen más liviana.');
}
/** Preserve raster tables/diagrams immediately following a reference instruction.
 * Original pixels supply the contents; this does not call OCR or AI. */
export async function extractPDFReferenceFigures(page:{objs:{get:(id:string,callback:(image:any)=>void)=>unknown}},operators:Operators,ops:Record<string,number>,items:PositionedText[],text:string,encode=encodePDFFigure){
 const figures:{start:number;end:number;figure:ExamFigure}[]=[];
 for(const image of pdfImagePlacements(operators,ops)){
  if(image.right-image.left<100||image.top-image.bottom<45)continue;
  const above=items.filter(it=>it.str.trim()&&it.transform[5]>=image.top-2).sort((a,b)=>a.transform[5]-b.transform[5]);const nearest=above[0];if(!nearest||nearest.transform[5]-image.top>90)continue;
  const context=extractPageText(above).slice(-1200);if(!/\b(?:look at|study|use|see|refer)\b[\s\S]{0,600}\b(?:table|plan|chart|timetable|graph|diagram|picture|map)\b/i.test(context))continue;
  const row=extractPageText(above.filter(it=>Math.abs(it.transform[5]-nearest.transform[5])<2.6)),at=text.lastIndexOf(row);if(at<0)continue;
  const object=await new Promise<any>(resolve=>page.objs.get(image.id,resolve)),encoded=await encode(object);const start=at+row.length;
  const number=[...context.matchAll(/(?:^|\n)(\d{1,3})[.)]?\s+(?:look at|study|use|see|refer)\b/gi)].at(-1)?.[1];
  figures.push({start,end:start,figure:{...encoded,alt:'Tabla o imagen de referencia'+(number?' del ejercicio '+number:'')}});
 }return figures;
}
