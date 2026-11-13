export type WritingComment={feedback:string;grade:number|null};
export type TeacherReview={finalGrade:number;feedback:string;writingFeedback:Record<string,WritingComment>;updated:string;revision:number};
export function reviewFromRow(row:any):TeacherReview|null{
 if(row.review_revision==null)return null;
 return {finalGrade:row.final_grade,feedback:row.teacher_feedback,writingFeedback:JSON.parse(row.writing_feedback),updated:row.review_updated,revision:row.review_revision};
}
