import {makeParts,type ExamPart,type ExerciseMark} from './exam-parts.ts';

export const MAX_RECOGNITION_PAGES=8;
export type RecognitionRange={start:number;end:number};
export function recognitionRange(text:string,marks:ExerciseMark[],range:RecognitionRange):RecognitionRange{
 let {start,end}=range;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>text.length)throw new Error('Seleccioná una consigna completa.');
 // Keep an existing question and its shared word bank intact when replacing a region.
 let changed=true;
 while(changed){changed=false;const touched=marks.filter(m=>m.start<end&&m.end>start);
  const banks=new Set(touched.flatMap(m=>m.bankId?[m.bankId]:m.kind==='wordbank'?[m.id]:[]));
  for(const m of marks.filter(m=>touched.includes(m)||banks.has(m.id)||!!m.bankId&&banks.has(m.bankId))){const a=Math.min(start,m.start),b=Math.max(end,m.end);if(a!==start||b!==end){start=a;end=b;changed=true;}}
 }
 return {start,end};
}
export function replaceRecognizedRange(text:string,marks:ExerciseMark[],range:RecognitionRange,parts:ExamPart[]):ExamPart[]{
 const {start,end}=recognitionRange(text,marks,range);
 const before=marks.filter(m=>m.end<=start&&m.start<start);
 const after=marks.filter(m=>m.start>=end).map(m=>({...m,start:m.start-end,end:m.end-end}));
 const figures=marks.filter(m=>m.kind==='figure'&&m.start>=start&&m.start<end).map(m=>({id:m.id,kind:'figure' as const,figure:m.figure}));
 return [...makeParts(text.slice(0,start),before),...figures,...parts,...makeParts(text.slice(end),after)];
}
export function validRecognitionImages(images:unknown):images is string[]{
 return Array.isArray(images)&&images.length<=MAX_RECOGNITION_PAGES&&images.every(s=>typeof s==='string'&&s.length<=1000000&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(s))&&images.reduce((n,s)=>n+s.length,0)<=6500000;
}
