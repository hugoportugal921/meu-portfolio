import { cp } from 'node:fs/promises';
await cp(new URL('./docs/',import.meta.url),new URL('./out/',import.meta.url),{recursive:true});
console.log('Catálogo preparado em out/');
