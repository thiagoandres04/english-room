export type ExerciseTextLine={text:string;kind:'text'|'heading'|'section';number?:{raw:string;suffix:string}};
const instruction=/^(?:Listen|Read|Write|Complete|Choose|Circle|Tick|Check|Match|Answer|Look|Put|Fill|Select|Underline|Correct|Rewrite|Use|Order|Reorder|Join|Make|Find|Label|Decide|Are the sentences|Do you agree|Escrib[ií]|Complet[aá]|Eleg[ií]|Marc[aá]|Respond[eé]|Le[eé])\b/i;
const section=/^(?:LISTENING|READING|WRITING|SPEAKING|GRAMMAR|VOCABULARY|USE OF ENGLISH|COMPREHENSION)(?:\s*(?:&|AND|\/|–|-)\s*(?:LISTENING|READING|WRITING|SPEAKING|GRAMMAR|VOCABULARY|COMPREHENSION))?\s*$/i;

/** Presentation metadata only: concatenating the lines always recovers the source.
 * The editor uses DOM Range text lengths, so spacing and punctuation are CSS,
 * never inserted characters that could shift manually marked answers. */
export function exerciseTextLines(text:string,atLineStart=true):ExerciseTextLine[]{
 return (text.match(/[^\n]*\n|[^\n]+$/g)||[]).map((line,index)=>{
  if(index===0&&!atLineStart)return {text:line,kind:'text'};
  const content=line.replace(/\r?\n$/,'');
  const match=/^(\d{1,3})([.)]?)([ \t]*)(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/.exec(content);
  const rest=match?content.slice(match[0].length):content;
  const number=match?{raw:match[1]+match[2],suffix:(match[2]?'':')')+(match[3]?'':'\u00a0')}:undefined;
  return {text:line,kind:section.test(content)?'section':instruction.test(rest)&&(!!match||content===content.trimStart())?'heading':'text',...(number?{number}:{})};
 });
}
