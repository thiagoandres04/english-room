'use client';
import PublicationControls from './publication-controls';
import {useState,useEffect} from 'react';
import {CheckCircle2,Loader2,MessageSquare,PenLine} from 'lucide-react';
import {formatAnswer} from '../lib/multi-choice';
import {questionContexts,isWriting,gradeObjectiveAnswers,type ExamPart} from '../lib/exam-parts';
import type {TeacherReview,WritingComment} from '../lib/manual-review';
type ReviewInput={submissionId:string;finalGrade:number;feedback:string;writingFeedback:Record<string,WritingComment>;revision:number};
export default function SubmissionCorrection({submission,parts,gradingMode,onSave,teacherId,accepting,onPublication}:{submission:any;parts:ExamPart[];gradingMode:string;teacherId:string;accepting:boolean;onPublication:(value:any)=>void;onSave:(input:ReviewInput)=>Promise<TeacherReview>}){
 const saved:TeacherReview|null=submission.review;
 const [grade,setGrade]=useState(saved?String(saved.finalGrade):'');
 const [feedback,setFeedback]=useState(saved?.feedback||'');
 const [notes,setNotes]=useState<Record<string,{feedback:string;grade:string}>>(()=>Object.fromEntries(Object.entries(saved?.writingFeedback||{}).map(([id,n])=>[id,{feedback:n.feedback,grade:n.grade==null?'':String(n.grade)}])));
 const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const answers:Record<string,string>=JSON.parse(submission.answers);
 const questions=questionContexts(parts);const writing=questions.filter(q=>isWriting(q.part));
 const dirty=grade!==(saved?String(saved.finalGrade):'')||feedback!==(saved?.feedback||'')||writing.some(({part:p})=>{const n=notes[p.id!],old=saved?.writingFeedback[p.id!];return (n?.feedback||'')!==(old?.feedback||'')||(n?.grade||'')!==(old?.grade==null?'':String(old.grade))});
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 let assessments:any[]=[];try{assessments=submission.feedback?JSON.parse(submission.feedback):gradeObjectiveAnswers(parts,answers)}catch{}
 const objective=questions.filter(q=>!isWriting(q.part));const autoCorrect=objective.filter(({part:p})=>assessments.find(a=>a.id===p.id)?.correct).length;
 function note(id:string,field:'feedback'|'grade',value:string){setNotes(prev=>({...prev,[id]:{feedback:prev[id]?.feedback||'',grade:prev[id]?.grade||'',[field]:value}}));setMessage('')}
 async function save(e:React.FormEvent){
  e.preventDefault();setError('');setMessage('');
  if(!grade.trim()){setError('Ingresá la nota final del examen.');return;}
  const finalGrade=Number(grade.replace(',','.'));
  const valid=(n:number)=>Number.isFinite(n)&&n>=0&&n<=10&&Math.abs(n*100-Math.round(n*100))<0.000001;
  if(!valid(finalGrade)){setError('La nota final debe estar entre 0 y 10, con hasta dos decimales.');return;}
  const writingFeedback:Record<string,WritingComment>={};
  for(const {part:p} of writing){const n=notes[p.id!]||{feedback:'',grade:''};const number=n.grade.trim()?Number(n.grade.replace(',','.')):null;if(number!==null&&!valid(number)){setError('Las notas de writing deben estar entre 0 y 10, con hasta dos decimales.');return;}writingFeedback[p.id!]={feedback:n.feedback,grade:number};}
  setSaving(true);try{await onSave({submissionId:submission.id,finalGrade,feedback,writingFeedback,revision:saved?.revision||0});setGrade(String(finalGrade));setFeedback(feedback.trim());setNotes(Object.fromEntries(Object.entries(writingFeedback).map(([id,n])=>[id,{feedback:n.feedback.trim(),grade:n.grade==null?'':String(n.grade)}])));setMessage('Corrección guardada en tu cuenta.');}catch(e:any){setError(e.message)}finally{setSaving(false)}
 }
 return <form className="submission-correction" onSubmit={save}>
  <div className="correction-intro"><PenLine size={19}/><div><h3>{writing.length?'Corrección de writing y nota final':'Revisión docente y nota final'}</h3><p>{writing.length?'Leé cada texto, dejá tus comentarios y asigná la nota final del examen.':'Revisá las respuestas y asigná la nota final del examen.'} Guardar esta corrección no consume IA.</p></div></div>
  {objective.length>0&&<p className="automatic-result">Puntaje automático orientativo: <b>{autoCorrect} / {objective.length}</b> respuestas objetivas. Las respuestas sin referencia requieren revisión.</p>}
  <div className="correction-questions">{questions.map(({part:p,prompt},index)=>{
   const long=isWriting(p);const assessment=assessments.find(a=>a.id===p.id);
   return <article className={'correction-question '+(long?'writing-question':'')} key={p.id}>
    <div className="correction-question-heading"><h4>{long?'Writing':'Respuesta'} {index+1}</h4>{long?<span className={saved?'review-done':'review-wait'}>{saved?'Revisión guardada':'Revisión docente'}</span>:assessment&&<span className={assessment.correct?'review-done':'review-wait'}>{assessment.correct?'Coincide':'A revisar'}</span>}</div>
    {prompt&&<div className="correction-prompt"><small>Consigna y contexto</small><p>{prompt}</p></div>}
    <div className="student-response"><small>Respuesta del alumno</small><p>{formatAnswer(p,answers[p.id!])||'Sin responder'}</p>{long&&<small>{(answers[p.id!]||'').trim().split(/\s+/).filter(Boolean).length} palabras</small>}</div>
    {long?<>
     {(p.answer?.trim()||p.rubric)&&<details className="writing-reference"><summary>Ver referencia y criterios de la profesora</summary>{p.answer?.trim()&&<p>{p.answer}</p>}{p.rubric&&<p><b>Criterios: </b>{p.rubric}</p>}<small>La referencia es un ejemplo. El alumno puede escribir otro texto válido.</small></details>}
     {gradingMode==='ai'&&assessment&&<details className="writing-reference ai-suggestion"><summary>Ver sugerencia de la IA</summary><p>{assessment.feedback}</p><small>La profesora decide la nota final.</small></details>}
     <label className="field writing-comment">Devolución de este writing<textarea aria-label={'Devolución de writing '+(index+1)} rows={4} maxLength={5000} disabled={saving} placeholder="Por ejemplo: desarrollaste bien los argumentos. Revisá el uso del pasado y los conectores…" value={notes[p.id!]?.feedback||''} onChange={e=>note(p.id!,'feedback',e.target.value)}/></label>
     <label className="field writing-grade">Nota de este writing · opcional (0 a 10)<input aria-label={'Nota de writing '+(index+1)} inputMode="decimal" disabled={saving} maxLength={5} placeholder="Ej.: 8,5" value={notes[p.id!]?.grade||''} onChange={e=>note(p.id!,'grade',e.target.value)}/></label>
    </>:<div className="objective-reference"><small>Solución docente</small><p>{formatAnswer(p,p.answer).trim()||'Sin solución de referencia'}</p>{assessment&&gradingMode==='ai'&&<p>{assessment.feedback}</p>}</div>}
   </article>
  })}</div>
  <section className="final-review" aria-label="Nota final y devolución"><div className="final-review-heading"><MessageSquare size={20}/><div><h3>Nota final del examen</h3><p>Esta nota la decide la profesora. Las notas individuales no se promedian automáticamente.</p></div></div>
   <label className="field final-grade">Nota final · escala de 0 a 10<input aria-label="Nota final del examen" inputMode="decimal" maxLength={5} required disabled={saving} placeholder="Ej.: 8,5" value={grade} onChange={e=>{setGrade(e.target.value);setMessage('')}}/></label>
   <label className="field">Devolución general<textarea aria-label="Devolución general del examen" rows={5} maxLength={10000} disabled={saving} placeholder="Escribí tus observaciones sobre el examen y qué puede mejorar el alumno." value={feedback} onChange={e=>{setFeedback(e.target.value);setMessage('')}}/></label>
   {saved&&<p className="review-saved-at">Última corrección: {new Date(saved.updated).toLocaleString('es-AR')}. Podés editarla y volver a guardar.</p>}
   {error&&<p className="correction-error" role="alert">{error}</p>}{message&&<p className="correction-success" role="status"><CheckCircle2 size={16}/>{message}</p>}
   <div className="final-review-actions"><small>{dirty?'Tenés cambios sin guardar.':'La nota y la devolución quedan guardadas en esta entrega.'}</small><button type="submit" className="primary" disabled={saving||(!dirty&&!!saved)}>{saving?<Loader2 size={16} className="spin"/>:<CheckCircle2 size={16}/>} {saving?'Guardando…':saved?'Guardar cambios':'Guardar corrección'}</button></div>
  </section>
  {saved&&<PublicationControls submissionId={submission.id} revision={saved.revision} publication={submission.publication||null} dirty={dirty} accepting={accepting} teacherId={teacherId} onChange={onPublication}/>}
  <a className="secondary result-print" href={'/api/export?format=html&submission='+submission.id} target="_blank" rel="noreferrer">Imprimir entrega / Guardar como PDF</a>
 </form>
}
