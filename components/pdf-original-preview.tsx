'use client';
import {useEffect,useRef,useState} from 'react';
import {Loader2,Info} from 'lucide-react';
export default function PDFOriginalPreview({file,page}:{file:File;page:number}){
 const canvas=useRef<HTMLCanvasElement>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{
  let disposed=false;let document:any;let task:any;let render:any;
  setLoading(true);setError('');
  (async()=>{
   try{
    const pdfjs=await import('pdfjs-dist');if(disposed)return;pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    const data=await file.arrayBuffer();if(disposed)return;
    task=pdfjs.getDocument({data});document=await task.promise;if(disposed)return;
    const pdfPage=await document.getPage(page);if(disposed||!canvas.current)return;
    const viewport=pdfPage.getViewport({scale:1.4});const surface=canvas.current;surface.width=Math.ceil(viewport.width);surface.height=Math.ceil(viewport.height);
    const context=surface.getContext('2d');if(!context)throw new Error('Canvas unavailable');
    render=pdfPage.render({canvasContext:context,viewport});await render.promise;
    if(!disposed)setLoading(false);
   }catch(e){if(!disposed){setError('No se pudo mostrar el original. El texto para marcar sigue disponible.');setLoading(false)}}
   finally{await document?.destroy().catch(()=>{});}
  })();
  return()=>{disposed=true;render?.cancel();task?.destroy().catch(()=>{});};
 },[file,page]);
 return <div className="pdf-original-preview">{loading&&<div className="pdf-preview-status"><Loader2 className="spin" size={19}/>Abriendo página {page}…</div>}{error&&<p className="pdf-preview-status"><Info size={18}/>{error}</p>}<canvas ref={canvas} aria-label={'PDF original, página '+page} style={{display:loading||error?'none':'block'}}/><p className="settings-note">Referencia visual del original, incluidos círculos y anotaciones. Para ocultar respuestas, volvé a «Texto para marcar».</p></div>
}
