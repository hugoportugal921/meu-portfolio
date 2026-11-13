import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
for(const app of ['transfers','analytics','shell'])execFileSync(process.execPath,[root+'/node_modules/vite/bin/vite.js','build','--config',`apps/${app}/vite.config.ts`],{cwd:root,stdio:'inherit'});
for(const app of ['transfers','analytics']){mkdirSync(`${root}/build/remotes/${app}`,{recursive:true});cpSync(`${root}/apps/${app}/dist`,`${root}/build/remotes/${app}`,{recursive:true});}
