export type SubmissionSummary={id:string;examId:string;examTitle:string;level:string;name:string;course:string|null;score:number;total:number;created:string;gradingStatus:string;finalGrade?:number|null};
export function filterSubmissions<T extends {name:string;course?:string|null;examTitle?:string}>(rows:T[],query:string):T[]{
 const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
 const terms=fold(query).split(/\s+/).filter(Boolean);if(!terms.length)return rows;
 return rows.filter(row=>{const haystack=fold([row.name,row.course||'',row.examTitle||''].join(' '));return terms.every(term=>haystack.includes(term));});
}
