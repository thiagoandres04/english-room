import {copyFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url);
const target=new URL('../public/pdf.worker.min.mjs',import.meta.url);
mkdirSync(fileURLToPath(new URL('../public/',import.meta.url)),{recursive:true});
copyFileSync(source,target);
console.log('PDF.js worker synchronized from the installed dependency.');
