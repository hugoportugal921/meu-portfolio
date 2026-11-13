import {defineConfig} from 'vite';
export default defineConfig({root:new URL('.',import.meta.url).pathname,define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{minify:true,outDir:'dist',emptyOutDir:true,lib:{entry:'src/mount.tsx',formats:['es'],fileName:()=> 'mount.js'}}});
