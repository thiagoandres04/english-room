'use client';
import {useRef} from 'react';
import {ZoomIn,X} from 'lucide-react';
import {figureIsValid,type ExamFigure as Figure} from '../lib/exam-figures';
export default function ExamFigure({figure,editor=false}:{figure:Figure;editor?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 if(!figureIsValid(figure))return null;
 return <figure className="exam-figure"><button type="button" className="exam-figure-open" aria-label="Ampliar tabla o imagen de referencia" title="Ampliar tabla o imagen de referencia" onClick={()=>dialog.current?.showModal()}><img src={figure.dataUrl} width={figure.width} height={figure.height} alt={figure.alt}/><ZoomIn aria-hidden="true" size={22}/></button>{!editor&&<figcaption>Tabla de referencia · Tocá la imagen para ampliarla.</figcaption>}<dialog ref={dialog} className="exam-figure-dialog" aria-label="Tabla o imagen de referencia ampliada" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><button type="button" className="exam-figure-close" aria-label="Cerrar imagen ampliada" onClick={()=>dialog.current?.close()}><X size={24}/></button><div className="exam-figure-zoom"><img src={figure.dataUrl} width={figure.width} height={figure.height} alt={figure.alt}/></div></dialog></figure>;
}
