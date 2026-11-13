import {tokenHash,newToken} from './passwords';
export const validStudentToken=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export const validSubmissionId=(value:unknown):value is string=>typeof value==='string'&&/^[\da-f-]{36}$/i.test(value);
export const durationIsValid=(value:unknown)=>value===null||(typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=480);
export {tokenHash,newToken};
export const privateHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
