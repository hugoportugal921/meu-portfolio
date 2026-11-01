import { setupNavigation } from './navigation.js';
const main = document.querySelector('#main');
const navigation = setupNavigation({body:document.body,sidebar:document.querySelector('#sidebar'),shell:document.querySelector('.app-shell'),toggle:document.querySelector('.menu-button'),closeButton:document.querySelector('.sidebar-close'),backdrop:document.querySelector('.menu-backdrop'),skipLink:document.querySelector('.skip-link'),main,mobileQuery:window.matchMedia('(max-width:680px)'),keyboardTarget:document});
const paths = {
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers:'<path d="m3 7 9-4 9 4-9 4Z"/><path d="m3 12 9 4 9-4M3 17l9 4 9-4"/>',
  chart:'<path d="M4 3v17h17M9 15v-4m5 4V6m5 9V9"/>',
  scan:'<path d="M8 3H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M3 12h18"/><rect x="8" y="7" width="8" height="10" rx="2"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
};
document.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[node.dataset.icon]||''}</svg>`;});
document.querySelector('#sidebar').addEventListener('click',event=>{if(event.target.closest('a'))navigation.close();});
