// Local integration only. No production data or AI requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.ENGLISH_ROOM_QA_URL||'http://127.0.0.1:5173';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const req=(path,data,cookie='',method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
const val=async r=>{const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d};
const fixture=JSON.parse(fs.readFileSync('.sites-runtime/teacher-guide-fixture.json'));
let r=await req('/api/auth',{action:'login',email:fixture.email,password:fixture.password});await val(r);const cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const examples=JSON.parse(fs.readFileSync(process.argv[2]));const saved=[];
for(const example of examples){
 const payload={title:'QA · '+example.name.replace(/\.pdf$/i,''),level:'B1',instructions:'Complete each exercise.',gradingMode:'exact',parts:example.parts};
 const exam=await val(await req('/api/exams',payload,cookie));
 const publicExam=await val(await req('/api/exams?id='+exam.id,undefined,'','GET'));
 assert.ok(publicExam.parts.every(p=>p.answer===undefined));assert.equal(publicExam.parts.filter(p=>p.blank).length,example.parts.filter(p=>p.answer!==undefined).length);
 assert.equal(publicExam.parts.filter(p=>p.inline).length,example.parts.filter(p=>p.inline).length);assert.deepEqual(publicExam.parts.filter(p=>p.kind==='wordbank').map(p=>p.bankMode),example.parts.filter(p=>p.kind==='wordbank').map(p=>p.bankMode));
 const inline=example.parts.find(p=>p.inline);if(inline){const invalid=structuredClone(payload);invalid.parts.find(p=>p.id===inline.id).inline='yes';assert.equal((await req('/api/exams',invalid,cookie)).status,400);}
 const bank=example.parts.find(p=>p.bankMode);if(bank){const invalid=structuredClone(payload);invalid.parts.find(p=>p.id===bank.id).bankMode='invented';assert.equal((await req('/api/exams',invalid,cookie)).status,400);}
 const answers=Object.fromEntries(example.parts.filter(p=>p.answer!==undefined).map(p=>[p.id,p.answer]));
 await val(await req('/api/submit',{examId:exam.id,name:'Alumno de prueba',course:'B1',answers}));
 const teacher=await val(await req('/api/exams?id='+exam.id+'&view=teacher',undefined,cookie,'GET'));assert.equal(teacher.grading_mode,'exact');assert.equal(teacher.results.length,1);assert.equal(teacher.results[0].total,Object.keys(answers).length);assert.equal(teacher.results[0].grading_status,'awaiting_teacher');
 const backup=await val(await req('/api/backup?exam='+exam.id,undefined,cookie,'GET'));assert.deepEqual(backup.exams[0].parts,example.parts);
 const restored=await val(await req('/api/backup',{backup,audioMap:{}},cookie));assert.equal(restored.exams,1);
 saved.push({name:example.name,id:exam.id,responses:Object.keys(answers).length});
}
fs.writeFileSync('.sites-runtime/grammar-flow-exams.json',JSON.stringify(saved));
console.log('PASS: both grammar PDFs save/serve/submit without AI; inline options and reference banks persist; invalid metadata rejected; solutions private; writing awaits teacher; backup restores both formats.');
