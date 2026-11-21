import { UI, CATEGORIES, getLang, other, t, mountLangSwitch } from './i18n.js';
import { loadModel, renderStill } from './render.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Card widths repeat in this rhythm (12-column grid), like the chosen bento design.
const RHYTHM = ['s8', 's4', 's4', 's4', 's4', 's6', 's6'];
const shots = new Map(); // model id -> rendered data URL

let models = [];
let filter = 'all';

async function main() {
  try {
    const res = await fetch('models/index.json', { cache: 'no-cache' });
    models = (await res.json()).models || [];
  } catch {
    models = [];
  }
  mountLangSwitch($('lang'), paint);
  paint();
}

function paint() {
  const lang = getLang();
  document.title = `3d-formbook · ${t(UI.models, lang)}`;
  $('title').innerHTML = `${t(UI.models, lang)}<span>${t(UI.models, other(lang))}</span>`;
  $('count').textContent = t(UI.count, lang, models.length);
  $('foot').textContent = t(UI.footer, lang);

  const cats = [...new Set(models.map(m => m.category))];
  $('filters').innerHTML = [['all', UI.all], ...cats.map(c => [c, CATEGORIES[c] || CATEGORIES.other])]
    .map(([key, label]) => `<button data-f="${esc(key)}" class="${filter === key ? 'on' : ''}">${esc(t(label, lang))}</button>`).join('');
  $('filters').onclick = e => { const f = e.target.closest('button')?.dataset.f; if (f) { filter = f; paint(); } };

  const list = models.filter(m => filter === 'all' || m.category === filter);
  const cards = list.map((m, i) => {
    let size = RHYTHM[i % RHYTHM.length];
    const big = size === 's8';
    const meta = [m.version, t(CATEGORIES[m.category] || CATEGORIES.other, lang)].filter(Boolean).join(' · ');
    return `<a class="card ${size} ${big ? 'big' : ''}" href="model.html?id=${encodeURIComponent(m.id)}" data-id="${esc(m.id)}">
      <h3>${esc(t(m.title, lang))}</h3><p class="sub">${esc(t(m.title, other(lang)))}</p>
      <div class="shot">${shots.has(m.id) ? `<img alt="" src="${shots.get(m.id)}">` : `<span class="loading">${esc(t(UI.loading, lang))}</span>`}</div>
      <div class="meta">${esc(meta)}</div></a>`;
  });
  // Fill the rest of the current row with the "add next model" card.
  const used = list.reduce((sum, _, i) => sum + Number(RHYTHM[i % RHYTHM.length].slice(1)), 0) % 12;
  const addSize = used === 0 ? 's12' : `s${12 - used}`;
  cards.push(`<div class="card add ${addSize}"><div class="plus">+</div><h3>${esc(t(UI.addTitle, lang))}</h3>
    <ol>${t(UI.addSteps, lang).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="hint">README.md</div></div>`);
  $('grid').innerHTML = cards.join('');
  list.forEach(m => { if (!shots.has(m.id)) shoot(m); });
}

async function shoot(m) {
  const card = document.querySelector(`.card[data-id="${CSS.escape(m.id)}"] .shot`);
  if (!card) return;
  try {
    let url = m.cover ? `models/${m.id}/${m.cover}` : null;
    if (!url) {
      const model = await loadModel(`models/${m.id}/${m.preview.file}`, { upAxis: m.preview.upAxis || 'z' });
      const box = card.getBoundingClientRect();
      url = renderStill(model, { width: Math.round(box.width), height: Math.round(box.height), az: 0, el: 30, fit: 1, ...(m.preview.card || {}) });
    }
    shots.set(m.id, url);
    const live = document.querySelector(`.card[data-id="${CSS.escape(m.id)}"] .shot`);
    if (live) live.innerHTML = `<img alt="" src="${url}">`;
  } catch (err) {
    console.error(err);
    card.innerHTML = `<span class="loading">${esc(t(UI.loadFail, getLang()))}</span>`;
  }
}

main();
