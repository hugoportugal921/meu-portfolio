import {defineConfig} from 'vite';
export default defineConfig({root: new URL('.',import.meta.url).pathname,base:'./',build:{outDir:'../../build',emptyOutDir:true}});
