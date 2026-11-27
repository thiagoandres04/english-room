import {MAX_RECOGNITION_PAGES} from './ai-recognition';
export async function renderRecognitionPages(file:File,pageNumbers:number[]):Promise<string[]>{
 if(pageNumbers.length>MAX_RECOGNITION_PAGES)throw new Error('Analizá hasta 8 páginas por vez. Elegí una página para continuar.');
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
 const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
 try{const result:string[]=[];
  for(const number of pageNumbers){
   if(number>doc.numPages)throw new Error('El PDF adjunto no coincide con las páginas del borrador.');
   const page=await doc.getPage(number),base=page.getViewport({scale:1});
   const viewport=page.getViewport({scale:Math.min(2,1800/Math.max(base.width,base.height))});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la imagen del PDF.');
   await page.render({canvasContext:context,viewport,background:'white'}).promise;
   let data=canvas.toDataURL('image/jpeg',.85);if(data.length>1000000)data=canvas.toDataURL('image/jpeg',.6);
   if(data.length>1000000)throw new Error('Esta página tiene demasiados detalles. Probá con una versión más liviana.');
   result.push(data);canvas.width=canvas.height=0;page.cleanup();
  }return result;
 }finally{await doc.destroy();}
}
