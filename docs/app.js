import './shell.js';
import { renderProject } from './catalog.js';
try {
  const responses = await Promise.all([fetch('./projects.json',{cache:'no-store'}),fetch('./repositories.json',{cache:'no-store'})]);
  if(responses.some(response=>!response.ok))throw new Error('Não foi possível carregar o catálogo.');
  const [projects,repositories] = await Promise.all(responses.map(response=>response.json()));
  document.querySelector('[data-projects]').innerHTML=projects.map(project=>renderProject(project,repositories)).join('');
  for(const project of projects){const link=document.querySelector(`[data-project-link="${project.slug}"]`);if(link)link.href=project.demoURL;}
} catch(error) {
  document.querySelector('[data-projects]').innerHTML='<div class="panel catalog-error"><h3>Os cartões não carregaram</h3><p class="muted">Recarregue a página. As demonstrações também podem ser abertas pelos links no menu.</p></div>';
  console.error(error);
}
