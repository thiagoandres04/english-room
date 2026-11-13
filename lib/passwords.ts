import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
export class PasswordPolicyError extends Error{}
// OWASP scrypt profile: 32 MiB with p=3; native node:crypto on Workers.
const settings={N:32768,r:8,p:3,maxmem:64*1024*1024};
export function checkPassword(password:unknown):asserts password is string{
 if(typeof password!=='string'||password.length<12||password.length>128||new TextEncoder().encode(password).length>512)throw new PasswordPolicyError('Usá una contraseña de entre 12 y 128 caracteres.');
 if(['password123456','123456789012','contraseña123','qwerty12345678'].includes(password.toLowerCase()))throw new PasswordPolicyError('Elegí una contraseña menos predecible.');
}
function derive(password:string,salt:string){return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,settings,(error,key)=>error?reject(error):resolve(key)));}
export async function hashPassword(password:string){checkPassword(password);const salt=randomBytes(16).toString('hex');return 'scrypt-v1$'+salt+'$'+(await derive(password,salt)).toString('hex');}
export async function verifyPassword(password:string,stored:string){
 const [,salt,value]=stored.split('$');const valid=/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(stored);
 const actual=await derive(password,valid?salt:'00000000000000000000000000000000');const expected=Buffer.from(valid?value:'00'.repeat(32),'hex');return timingSafeEqual(actual,expected)&&valid;
}
export const newToken=()=>randomBytes(32).toString('base64url');
export async function tokenHash(value:string){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');}
