'use client';
import MultiChoiceQuestion from './multi-choice-question';
import ExerciseText from './exercise-text';
import ExamFigure from './exam-figure';
import {withAnswerSizes} from '../lib/answer-size';
import {Fragment,useRef,useState} from 'react';
import ListeningSection from './listening-player';
import {audioTargets,unplacedAudio} from '../lib/audio-placement';
import type {ListeningTrack} from '../lib/listening';
import ChoiceQuestion from './choice-question';
import {layoutParts,placeWord,type ExamPart} from '../lib/exam-parts';
type Pick={bankId:string;word:string;from?:string};
export default function ExamDocument({parts,answers,onChange,teacher=false,audio=[],teacherKey,examId}:{audio?:ListeningTrack[];teacherKey?:string;examId?:string;parts:ExamPart[];answers:Record<string,string>;onChange:(answers:Record<string,string>)=>void;teacher?:boolean}){
 const displayParts=layoutParts(withAnswerSizes(parts));const targets=audioTargets(displayParts);
 const audioAt=(partIndex:number,offset:number|null)=>{const target=targets.find(t=>t.partIndex===partIndex&&t.offset===offset);if(!target)return null;const tracks=audio.filter(t=>t.exerciseIds?.includes(target.id));return tracks.length?<div className="exercise-listening" data-audio-exercise={target.id}><p className="exercise-listening-label">Audio para {target.label.split(' · ')[0].toLowerCase()}</p><ListeningSection tracks={tracks} teacherKey={teacherKey} examId={examId}/></div>:null;};
 const [pick,setPick]=useState<Pick|null>(null);const [over,setOver]=useState('');const [message,setMessage]=useState('');
 const pointer=useRef<{x:number;y:number;chosen:Pick;moved:boolean}|null>(null);const suppressClick=useRef(false);
 const value=(p:ExamPart)=>teacher?p.answer||'':answers[p.id!]||'';
 function assign(p:ExamPart,chosen:Pick){
  const bank=parts.find(b=>b.kind==='wordbank'&&b.id===p.bankId);
  if(!bank||chosen.bankId!==p.bankId||!bank.options?.includes(chosen.word))return;
  const next=teacher?{...answers,[p.id!]:chosen.word}:placeWord(parts,answers,p.id!,chosen.bankId,chosen.word);
  onChange(next);setPick(null);setMessage(`Casillero ${numbers.get(p.id!)}: ${chosen.word}`);
 }
 const numbers=new Map<string,number>();let count=0;parts.forEach(p=>{if(p.blank||p.answer!==undefined)numbers.set(p.id!,++count)});
 const dragStart=(event:React.DragEvent,chosen:Pick)=>{setPick(chosen);event.dataTransfer.setData('application/english-room-word',JSON.stringify(chosen));event.dataTransfer.effectAllowed='move'};
 const pointerHandlers=(chosen:Pick)=>({
  onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{if(teacher||event.button!==0)return;pointer.current={x:event.clientX,y:event.clientY,chosen,moved:false};suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId)},
  onPointerMove:(event:React.PointerEvent<HTMLButtonElement>)=>{const current=pointer.current;if(!current)return;if(Math.hypot(event.clientX-current.x,event.clientY-current.y)>6)current.moved=true;if(current.moved){setPick(current.chosen);setOver(document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-word-gap]')?.dataset.wordGap||'')}},
  onPointerUp:(event:React.PointerEvent<HTMLButtonElement>)=>{const current=pointer.current;pointer.current=null;if(!current?.moved)return;suppressClick.current=true;const targetId=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-word-gap]')?.dataset.wordGap;const target=parts.find(p=>p.id===targetId&&p.kind==='word-gap');if(target)assign(target,current.chosen);setOver('')},
  onPointerCancel:()=>{pointer.current=null;setOver('')}
 });
 return <><span className="sr-only" role="status" aria-live="polite">{message}</span><ListeningSection tracks={unplacedAudio(audio,targets)} teacherKey={teacherKey} examId={examId}/>{displayParts.map((p,i)=><Fragment key={p.id||i}>{audioAt(i,null)}{(()=>{
  if(p.kind==='figure'&&p.figure)return <ExamFigure figure={p.figure}/>;
  if(p.kind==='wordbank')return <section className="word-bank" key={p.id} aria-label="Banco de palabras"><div className="word-bank-heading"><b>Banco de palabras</b><span>{p.bankMode==='write'?'Usá la forma correcta.':p.reusable?'Podés repetir las opciones.':'Usá cada opción una vez.'}</span></div><p>{p.bankMode==='write'?'Usá estas palabras como referencia y escribí la forma correcta en cada casillero.':teacher?'Revisá las soluciones en cada casillero.':'Arrastrá una palabra al casillero, o tocá la palabra y luego el casillero.'}</p><div className="word-bank-options">{p.options?.map(word=>{if(p.bankMode==='write')return <span className="bank-word reference-word" key={word}>{word}</span>;const used=!teacher&&!p.reusable&&parts.some(g=>g.kind==='word-gap'&&g.bankId===p.id&&answers[g.id!]===word);return <button type="button" key={word} className={'bank-word '+(pick?.bankId===p.id&&pick?.word===word?'selected ':'')+(used?'used':'')} draggable={false} {...pointerHandlers({bankId:p.id!,word})} aria-pressed={pick?.bankId===p.id&&pick?.word===word} onDragStart={e=>dragStart(e,{bankId:p.id!,word})} onDragEnd={()=>setOver('')} onClick={()=>{if(!suppressClick.current)setPick(pick?.bankId===p.id&&pick?.word===word?null:{bankId:p.id!,word})}}>{word}{used&&<span aria-label="En uso">✓</span>}</button>})}</div>{pick?.bankId===p.id&&<small className="word-bank-selection">Seleccionaste “{pick?.word}”. Elegí el casillero. <button type="button" onClick={()=>setPick(null)}>Cancelar</button></small>}</section>;
  if(p.kind==='word-gap')return teacher?<label key={p.id} className="word-gap-teacher"><span>{numbers.get(p.id!)}</span><select aria-label={'Solución del casillero '+numbers.get(p.id!)} value={value(p)} onChange={e=>onChange({...answers,[p.id!]:e.target.value})}><option value="">Elegí la solución</option>{p.options?.map(o=><option key={o} value={o}>{o}</option>)}</select></label>:<span key={p.id} data-word-gap={p.id} className={'word-gap '+(value(p)?'filled ':'')+(over===p.id?'drag-over ':'')+(pick?.bankId===p.bankId?'ready':'')} onDragOver={e=>{if(pick?.bankId===p.bankId){e.preventDefault();e.dataTransfer.dropEffect='move';setOver(p.id!)}}} onDragLeave={()=>setOver('')} onDrop={e=>{e.preventDefault();setOver('');try{assign(p,JSON.parse(e.dataTransfer.getData('application/english-room-word')))}catch{}}}><button type="button" className="word-gap-target" aria-label={'Casillero '+numbers.get(p.id!)+(value(p)?': '+value(p):': vacío')} draggable={false} {...pointerHandlers({bankId:p.bankId!,word:value(p),from:p.id})} onDragStart={e=>dragStart(e,{bankId:p.bankId!,word:value(p),from:p.id})} onDragEnd={()=>setOver('')} onClick={()=>{if(suppressClick.current)return;if(pick)assign(p,pick);else if(value(p))setPick({bankId:p.bankId!,word:value(p),from:p.id})}}><sup>{numbers.get(p.id!)}</sup>{value(p)||'Soltá aquí'}</button>{value(p)&&<button type="button" className="word-gap-clear" aria-label={'Vaciar casillero '+numbers.get(p.id!)} onClick={()=>{onChange({...answers,[p.id!]:''});setPick(null)}}>×</button>}</span>;
  if(p.kind==='multi-choice')return <MultiChoiceQuestion key={p.id} part={p} teacher={teacher} value={value(p)} onChange={v=>onChange({...answers,[p.id!]:v})}/>;
  if(p.kind==='choice')return <ChoiceQuestion key={p.id} part={p} teacher={teacher} value={value(p)} onChange={v=>onChange({...answers,[p.id!]:v})}/>;
  if(p.blank||p.answer!==undefined){if(teacher)return <label key={p.id} className="written-solution"><span>Solución docente {numbers.get(p.id!)}</span><textarea aria-label={'Solución '+numbers.get(p.id!)} maxLength={6000} value={value(p)} onChange={e=>onChange({...answers,[p.id!]:e.target.value})}/></label>;
   return p.multiline?<textarea key={p.id} className="long-answer" rows={9} aria-label={'Respuesta '+numbers.get(p.id!)} autoComplete="off" maxLength={6000} placeholder="Write your answer here…" value={value(p)} onChange={e=>onChange({...answers,[p.id!]:e.target.value})}/>:<input className="short-answer" key={p.id} aria-label={'Respuesta '+numbers.get(p.id!)} autoComplete="off" maxLength={6000} placeholder="Your answer" value={value(p)} onChange={e=>onChange({...answers,[p.id!]:e.target.value})}/>;
  }return p.text?<ExerciseText key={i} text={p.text} beforeLine={offset=>audioAt(i,offset)} atLineStart={i===0||(['choice','multi-choice','wordbank'].includes(parts[i-1]?.kind||'')&&!parts[i-1]?.inline)||/\n$/.test(parts[i-1]?.text||'')}/>:null;
 })()}</Fragment>)}</>;
}
