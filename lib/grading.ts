import {gradeSelections,missingReferences,MISSING_REFERENCE_MESSAGE,isWriting} from './exam-parts';
import {withAnswerSizes} from './answer-size';
import {env} from 'cloudflare:workers';
import {gradeExam, type ExamPart} from './ai';
/** Claim an ungraded submission so concurrent retries never duplicate AI calls. */
export async function correctSubmission(id:string,exam:{body:string;instructions:string;grading_mode:string}) {
  if(missingReferences(JSON.parse(exam.body))){await env.DB!.prepare("UPDATE submissions SET grading_error=? WHERE id=? AND grading_status='pending'").bind(MISSING_REFERENCE_MESSAGE,id).run();return;}
  const claim=await env.DB!.prepare("UPDATE submissions SET grading_status='processing', grading_started=? WHERE id=? AND grading_status='pending' AND NOT EXISTS (SELECT 1 FROM submission_reviews WHERE submission_id=submissions.id)").bind(new Date().toISOString(),id).run();
  if(!claim.meta.changes)return;
  try{
    const row=await env.DB!.prepare('SELECT answers FROM submissions WHERE id=?').bind(id).first<{answers:string}>();
    if(!row)throw new Error('Missing submission');
    const parts:ExamPart[]=withAnswerSizes(JSON.parse(exam.body));const answers=JSON.parse(row.answers);
    const selections=gradeSelections(parts,answers);
    const writtenParts:ExamPart[]=parts.map(p=>p.kind==='wordbank'?{text:'Banco de palabras: '+p.options?.join(' / ')}:p.kind==='word-gap'?{text:'____'}:p.kind==='choice'||p.kind==='multi-choice'?{text:p.prompt+' (Opciones: '+p.options?.join(' / ')+')'}:p);
    const written=writtenParts.some(p=>p.answer!==undefined)?await gradeExam(env.OPENAI_API_KEY,writtenParts,exam.instructions,answers):[];
    const assessments=[...selections,...written];
    const score=assessments.filter(a=>a.correct).length;
    await env.DB!.prepare("UPDATE submissions SET score=?,feedback=?,grading_status=?,grading_error=? WHERE id=? AND grading_status='processing' AND NOT EXISTS (SELECT 1 FROM submission_reviews WHERE submission_id=submissions.id)").bind(score,JSON.stringify(assessments),parts.some(isWriting)?'awaiting_teacher':'graded',parts.some(isWriting)?'La IA dejó una sugerencia. La profesora debe revisar el writing y asignar la nota final.':null,id).run();
  }catch(error){
    const message=error instanceof Error?error.message:'La corrección no se pudo completar.';
    await env.DB!.prepare("UPDATE submissions SET grading_status='pending', grading_error=? WHERE id=? AND grading_status='processing' AND NOT EXISTS (SELECT 1 FROM submission_reviews WHERE submission_id=submissions.id)").bind(message,id).run();
  }
}
