// Run locally. The generated token is private; never commit the output.
import {randomBytes,createHash} from 'node:crypto';
const token=randomBytes(32).toString('base64url');
console.log('Set these values in your private .env.local (or runtime secrets):');
console.log('SCHOOL_SETUP_HASH='+createHash('sha256').update(token).digest('hex'));
console.log('SCHOOL_SETUP_EXPIRES='+(Date.now()+24*60*60*1000));
console.log('Open this private, one-time setup link after starting your own instance:');
console.log('http://127.0.0.1:5173/#setup='+token);
