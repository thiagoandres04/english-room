'use client';
import {choiceLabel,type ExamPart} from '../lib/exam-parts';
export default function ChoiceQuestion({part,value,onChange,teacher=false}:{part:ExamPart;value:string;onChange:(value:string)=>void;teacher?:boolean}){
 const long=(part.options||[]).some(o=>o.length>25);const boolean=(part.options||[]).every(o=>['T','F','NI','True','False'].includes(o));
 return <fieldset className={'choice-question '+(teacher?'teacher-choice ':'')+(long?'long-choices ':'')+(boolean?'boolean-choices':'')}><legend>{teacher?'Solución docente: ':''}{part.prompt}</legend><div className="choice-prompt" aria-hidden="true">{part.prompt}</div><div className="choice-options">{part.options?.map(option=><label key={option} className={value===option?'chosen':''}><input type="radio" name={(teacher?'solution-':'response-')+part.id} value={option} checked={value===option} onChange={()=>onChange(option)}/><span>{choiceLabel(option)}</span></label>)}</div>{teacher&&<small className={'choice-teacher-hint '+(!value?'unconfigured':'')}>{value?'Solución docente seleccionada. El alumno la verá sin marcar.':'Solución opcional. Podés compartir el examen y revisar las entregas después.'}</small>}</fieldset>
}
