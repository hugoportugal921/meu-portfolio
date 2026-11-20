import config from './project-config.js?v=revisao-20261120';
import { createStore } from './data.js';
const main = document.querySelector('main');
document.querySelector('[data-title]').textContent = config.title;
document.querySelector('[data-subtitle]').textContent = config.subtitle;
document.title = config.title + ' | Portfólio';
const portfolio = document.querySelector('[data-portfolio]');
portfolio.href = config.portfolioURL;
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); main.focus(); });
const store = createStore();
let cleanup = null, epoch = 0, suspended = false;
async function mountProject() {
  const current = ++epoch;
  try {
    const module = await import(config.moduleURL);
    if (current !== epoch) return;
    cleanup = module.mount(main, store);
  } catch (error) {
    if (current !== epoch) return;
    main.innerHTML = '<section class="panel"><h1>Não foi possível abrir o projeto</h1><p>Recarregue a página e tente novamente.</p></section>';
    console.error(error);
  }
}
window.addEventListener('pagehide', () => { ++epoch; cleanup?.(); cleanup = null; suspended = true; });
window.addEventListener('pageshow', event => { if (event.persisted && suspended) { suspended = false; mountProject(); } });
mountProject();
