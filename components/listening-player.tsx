'use client';
import {useEffect,useRef,useState} from 'react';
import {Headphones,Loader2,RotateCcw} from 'lucide-react';
import type {ListeningTrack} from '../lib/listening';
export function ListeningPlayer({track,teacherKey,examId}:{track:ListeningTrack;teacherKey?:string;examId?:string}){
 const [source,setSource]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);const player=useRef<HTMLAudioElement>(null);
 useEffect(()=>{
  const controller=new AbortController();let disposed=false;let objectURL='';setError('');setLoading(true);setSource('');
  if(!teacherKey){setSource('/api/audio?id='+encodeURIComponent(track.id)+'&exam='+encodeURIComponent(examId||''));setLoading(false);return()=>controller.abort();}
  (async()=>{
   try{
    const response=await fetch('/api/audio?id='+encodeURIComponent(track.id),{headers:{'X-Teacher-Account':teacherKey},signal:controller.signal});
    if(!response.ok)throw new Error('No se pudo cargar este audio. Revisá el archivo o volvé a intentarlo.');
    const blob=await response.blob();if(disposed)return;objectURL=URL.createObjectURL(blob);setSource(objectURL);setLoading(false);
   }catch(e){if(!disposed){setError(e instanceof Error?e.message:'No se pudo cargar el audio.');setLoading(false)}}
  })();
  return()=>{disposed=true;controller.abort();if(objectURL)URL.revokeObjectURL(objectURL)};
 },[track.id,teacherKey,examId,attempt]);
 return <article className="listening-track"><div className="listening-track-heading"><span><Headphones size={16}/>{track.title}</span><small>{track.size<1024*1024?Math.max(1,Math.round(track.size/1024))+' KB':(track.size/1024/1024).toLocaleString('es-AR',{maximumFractionDigits:1})+' MB'}</small></div>{loading?<p className="audio-loading"><Loader2 className="spin" size={17}/>Cargando audio…</p>:source?<audio ref={player} aria-label={'Reproductor de '+track.title} controls preload="metadata" src={source} onError={()=>setError('No se pudo reproducir. Probá otra vez o consultá a la profesora.')}/>:null}{error&&<div className="audio-error" role="alert"><span>{error}</span><button onClick={()=>{setError('');if(source&&player.current)player.current.load();else setAttempt(n=>n+1)}}><RotateCcw size={14}/>Reintentar</button></div>}</article>
}
export default function ListeningSection({tracks,teacherKey,examId}:{tracks:ListeningTrack[];teacherKey?:string;examId?:string}){
 if(!tracks?.length)return null;
 return <section className="listening-section" aria-label="Audios de listening"><div className="listening-section-heading"><Headphones size={21}/><div><h2>Listening</h2><p>Escuchá el audio y después resolvé los ejercicios. Podés pausar y volver a escucharlo.</p></div></div><div className="listening-players">{tracks.map(track=><ListeningPlayer key={track.id} track={track} teacherKey={teacherKey} examId={examId}/>)}</div></section>
}
