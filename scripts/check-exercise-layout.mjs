import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exerciseTextLines} from '../lib/exercise-text-layout.ts';
const text='GRAMMAR\n2 Complete the text with one word.\nTed: Do you remember?\nAmy: Yes, we4 had fun.\n\n3Complete the second sentence.\n1We need to protect the environment!\nThe environment needs to be protected.\n2) People should pick up litter.\n3. Do not drop litter.\n2026 was a good year.\n';
const lines=exerciseTextLines(text);assert.equal(lines.map(l=>l.text).join(''),text);
assert.equal(lines.filter(l=>l.kind==='heading').length,2);
assert.equal(lines[0].kind,'section');
assert.deepEqual(lines.find(l=>l.text.startsWith('1We')).number,{raw:'1',suffix:')\u00a0'});
assert.equal(lines.find(l=>l.text.startsWith('2)')).number.suffix,'');
assert.equal(lines.find(l=>l.text.startsWith('3.')).number.suffix,'');
assert.equal(lines.find(l=>l.text.startsWith('2026')).number,undefined);
assert.equal(exerciseTextLines('2 years later',false)[0].number,undefined);
assert.equal(exerciseTextLines('afterwards\n4 Write an essay.',false)[1].kind,'heading');
// Render the actual component, without changing the production app or database.
const ts=await import('typescript');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
fs.mkdirSync('.sites-runtime/layout-preview',{recursive:true});
const compiled=ts.transpileModule(fs.readFileSync('components/exercise-text.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
fs.writeFileSync('.sites-runtime/qa-exercise-text.mjs',compiled);
const {default:ExerciseText}=await import('../.sites-runtime/qa-exercise-text.mjs?'+Date.now());
const rendered=renderToStaticMarkup(createElement(ExerciseText,{text}));
assert.match(rendered,/exercise-heading/);assert.match(rendered,/data-suffix="\) "/);assert.match(rendered,/exercise-inline-number/);
assert.equal(rendered.replace(/<[^>]+>/g,'').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'),text);
let samples=[text];
if(process.argv[2]){
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');const {repairSyntheticSpaces}=await import('../lib/pdf-text.ts');const {extractWordBankPage}=await import('../lib/pdf-word-banks.ts');
 const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2]))}).promise;samples=[];
 for(let n=1;n<=pdf.numPages;n++){
  const p=await pdf.getPage(n),data=await p.getTextContent(),ops=await p.getOperatorList();let raw='';
  for(let j=0;j<ops.fnArray.length;j++)if(ops.fnArray[j]===OPS.showText)for(const g of ops.argsArray[j]?.[0]||[])if(g&&typeof g.unicode==='string')raw+=g.unicode;
  const page=extractWordBankPage(repairSyntheticSpaces(data.items.filter(i=>'str'in i),raw));
  const layout=exerciseTextLines(page.text);assert.equal(layout.map(l=>l.text).join(''),page.text);samples.push(page.text);
 }
 await pdf.destroy();
 assert.ok(exerciseTextLines(samples[0]).some(l=>l.kind==='heading'&&l.text.startsWith('2 Complete')));
 assert.ok(exerciseTextLines(samples[1]).some(l=>l.kind==='heading'&&l.text.startsWith('3 Complete')));
}
const css=fs.readFileSync('app/globals.css','utf8');
const content=samples.map((text,i)=>`<article class="exercise-text" id="page-${i+1}">${renderToStaticMarkup(createElement(ExerciseText,{text}))}</article>`).join('');
fs.writeFileSync('.sites-runtime/layout-preview/index.html',`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prueba local · Formato de ejercicios</title><style>${css} body{padding:24px} article.exercise-text{background:white;margin:0 auto 28px;max-width:900px;white-space:pre-wrap;font-size:16px;line-height:1.8;padding:24px;max-height:none}</style>${content}</html>`);
console.log('PASS: headings, numbering, existing punctuation, real PDF exercises 2/3, source text and manual-selection offsets preserved.');
