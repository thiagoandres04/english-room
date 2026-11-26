export type ExamFigure={dataUrl:string;alt:string;width:number;height:number};
export const MAX_FIGURE_CHARS=60000;
export const MAX_DOCUMENT_FIGURE_CHARS=120000;
/** Only bounded, embedded raster images; no remote URLs, SVG, or active content. */
export function figureIsValid(v:unknown):v is ExamFigure{
 const f=v as ExamFigure;return !!f&&typeof f==='object'&&typeof f.dataUrl==='string'&&f.dataUrl.length<=MAX_FIGURE_CHARS&&/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(f.dataUrl)&&typeof f.alt==='string'&&f.alt.length>0&&f.alt.length<=300&&Number.isInteger(f.width)&&Number.isInteger(f.height)&&f.width>0&&f.height>0&&f.width<=4096&&f.height<=4096;
}
export function figuresAreValid(parts:{kind?:string;figure?:ExamFigure;answer?:string}[]){const images=parts.filter(p=>p.kind==='figure');return images.length<=8&&images.every(p=>p.answer===undefined&&figureIsValid(p.figure))&&images.reduce((n,p)=>n+(p.figure?.dataUrl.length||0),0)<=MAX_DOCUMENT_FIGURE_CHARS;}
