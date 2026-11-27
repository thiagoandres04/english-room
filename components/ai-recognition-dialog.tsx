'use client';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,Loader2,X,Upload} from 'lucide-react';
import ExamDocument from './exam-document';
import {recognitionRange,type RecognitionRange} from '../lib/ai-recognition';
import {renderRecognitionPages} from '../lib/pdf-vision';
import type {ExamPart,ExerciseMark} from '../lib/exam-parts';
type Result={parts:ExamPart[];warnings:string[];usage?:{inputTokens:number;outputTokens:number}};
type Props={text:string;marks:ExerciseMark[];pages:RecognitionRange[];pageIndex:number;selection:RecognitionRange|null;originalFile:File|null;allowPartial:boolean;request:(data:unknown)=>Promise<Result>;onApply:(range:RecognitionRange,result:Result)=>void;onBusy:(value:boolean)=>void;onClose:()=>void};
export default function AIRecognitionDialog(p:Props){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null);
 const [scope,setScope]=useState(p.allowPartial&&p.selection?'selection':p.allowPartial&&p.pages.length>1?'page':'all');
 const [file,setFile]=useState<File|null>(p.originalFile),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [result,setResult]=useState<Result|null>(null),[range,setRange]=useState<RecognitionRange|null>(null),[reviewed,setReviewed]=useState(false);
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[]);
 async function recognize(){
  setError('');setBusy(true);p.onBusy(true);
  try{
   const requested=scope==='selection'?p.selection:scope==='page'?p.pages[p.pageIndex]:{start:0,end:p.text.length};
   if(!requested)throw new Error('Seleccioná una consigna completa.');
   const region=recognitionRange(p.text,p.marks,requested),text=p.text.slice(region.start,region.end);
   if(text.length>30000)throw new Error('Este material supera el límite. Elegí una página o un ejercicio.');
   const numbers=p.pages.flatMap((page,i)=>page.start<region.end&&page.end>region.start?[i+1]:[]);
   const images=file?await renderRecognitionPages(file,numbers.length?numbers:[1]):[];
   const data=await p.request({text,contextText:p.text.slice(Math.max(0,region.start-10000),region.start),images});
   setRange(region);setResult(data);setReviewed(false);
  }catch(e:any){setError(e.message||'No se pudo reconocer el material.');}
  finally{setBusy(false);p.onBusy(false);}
 }
 return <dialog ref={dialog} className="recognition-dialog" aria-labelledby="recognition-title" onCancel={e=>{if(busy)e.preventDefault();else p.onClose()}}>
  <header><div><Sparkles size={23}/><h2 id="recognition-title">Reconocer con IA</h2></div><button aria-label="Cerrar reconocimiento con IA" disabled={busy} onClick={p.onClose}><X size={22}/></button></header>
  {!result?<><p>Usá esta ayuda cuando falten ejercicios u opciones. La propuesta se muestra antes de cambiar tu borrador.</p>
   <label className="field">Material para analizar<select aria-label="Material para analizar con IA" disabled={busy} value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Examen completo</option>{p.allowPartial&&p.pages.length>0&&<option value="page">Página actual ({p.pageIndex+1})</option>}{p.allowPartial&&p.selection&&<option value="selection">Texto seleccionado</option>}</select></label>
   {scope==='selection'&&<p>Seleccioná la consigna y sus opciones completas. Incluiremos cualquier respuesta ya marcada que atraviese la selección.</p>}
   <div className="recognition-source"><b>{file?'PDF original disponible':'Análisis de texto'}</b><p>{file?'La IA también podrá ver negritas, tablas y la distribución de las páginas.':'Para detectar negritas, tablas y opciones visuales, adjuntá el mismo PDF original. Esto conserva tu borrador.'}</p><button className="secondary" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{file?'Cambiar PDF de referencia':'Adjuntar PDF original'}</button><input ref={input} hidden type="file" accept="application/pdf,.pdf" aria-label="PDF original para reconocer con IA" onChange={e=>{const f=e.target.files?.[0];if(f){if(!f.name.toLowerCase().endsWith('.pdf')||f.size>20*1024*1024)setError('Adjuntá un PDF de hasta 20 MB.');else{setFile(f);setError('')}}}}/>{file&&<small>{file.name}</small>}</div>
   <p className="recognition-cost">Al presionar «Analizar con IA» se consume saldo de OpenAI. El costo depende del contenido y puede variar. Máximo 8 páginas y 60 respuestas por consulta. La corrección con IA de las entregas mantiene su configuración actual.</p>
   <footer><button className="secondary" disabled={busy} onClick={p.onClose}>Cancelar</button><button className="primary" disabled={busy||p.text.trim().length<15} onClick={recognize}>{busy?<Loader2 className="spin" size={17}/>:<Sparkles size={17}/>} {busy?'Analizando material…':'Analizar con IA'}</button></footer>
  </>:<><p>Propuesta: <b>{result.parts.filter(q=>q.answer!==undefined).length} respuestas</b>. Revisá las consignas y soluciones. Los cambios se aplican solamente al material elegido.</p>
   {!!result.warnings.length&&<div className="ai-warnings"><b>Observaciones</b><ul>{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
   <div className="recognition-paper"><ExamDocument parts={result.parts} answers={{}} teacher onChange={values=>{setResult({...result,parts:result.parts.map(q=>q.id&&values[q.id]!==undefined?{...q,answer:values[q.id]}:q)});setReviewed(false)}}/></div>
   {result.usage&&<p className="settings-note">Consumo de esta consulta: {result.usage.inputTokens.toLocaleString('es-AR')} tokens de entrada y {result.usage.outputTokens.toLocaleString('es-AR')} de salida.</p>}
   <label className="review-checkbox"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Revisé la propuesta y quiero aplicarla al borrador.</label>
   <footer><button className="secondary" onClick={p.onClose}>Descartar propuesta</button><button className="primary" disabled={!reviewed} onClick={()=>range&&p.onApply(range,result)}>Aplicar reconocimiento</button></footer>
  </>}
  {error&&<div className="alert" role="alert">{error}</div>}
 </dialog>;
}
