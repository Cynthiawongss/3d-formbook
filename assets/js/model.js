import { UI, CATEGORIES, getLang, other, t, formatBytes, mountLangSwitch } from './i18n.js';
import { loadModel, renderStill, createViewer } from './render.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const id = new URLSearchParams(location.search).get('id') || '';
const base = `models/${encodeURIComponent(id)}/`;

let data = null;
let sizes = {};
let viewer = null;
let mode = 'solid';
let part = null; // null = assembly, otherwise mesh index
const partShots = new Map();

async function main() {
  mountLangSwitch($('lang'), paint);
  try {
    const [m, idx] = await Promise.all([
      fetch(base + 'model.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('models/index.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({ models: [] })),
    ]);
    data = m;
    sizes = idx.models.find(x => x.id === id)?.sizes || {};
  } catch {
    $('state').textContent = t(UI.notFound, getLang());
    return;
  }
  paint();
  startViewer();
}

function fileUrl(p) { return base + p.split('/').map(encodeURIComponent).join('/'); }
function fileName(p) { return p.split('/').pop(); }

function paint() {
  if (!data) return;
  const lang = getLang(), o = other(lang);
  document.title = `${t(data.title, lang)} · 3d-formbook`;
  $('foot').textContent = t(UI.footer, lang);
  const main = data.files?.[0];
  $('subnav').innerHTML = `<a class="back" href="./">← ${esc(t(UI.back, lang))}</a>
    <b>${esc(t(data.title, lang))}</b><span class="en">${esc(t(data.title, o))}</span>
    <div class="links"><a href="#files">${esc(t(UI.files, lang))}</a><a href="#versions">${esc(t(UI.versions, lang))}</a><a href="#notes">${esc(t(UI.notes, lang))}</a>
    ${main ? `<a class="btn" href="${fileUrl(main.file)}" download>${esc(t(UI.downloadProject, lang))}</a>` : ''}</div>`;

  const specs = (data.specs || []).map(s => `<div class="tile"><small>${esc(t(s.label, lang))}</small><div class="n">${esc(s.value)}<span>${esc(t(s.unit, lang))}</span></div></div>`).join('');

  const files = (data.files || []).map(f => `<div class="row"><div class="name">${esc(t(f.label, lang))}<em>${esc(fileName(f.file))}</em></div>
    <a class="dl" href="${fileUrl(f.file)}" download>${esc(t(UI.download, lang))} ${esc(formatBytes(sizes[f.file]))} ↓</a></div>`).join('');

  const reusable = (data.reusable || []).map((r, i) => `<a href="${fileUrl(r.file)}" download><div class="pic" data-part="${esc(r.file)}">${partShots.get(r.file) ? `<img alt="" src="${partShots.get(r.file)}">` : (/\.(stl|3mf)$/i.test(r.file) ? '' : '{ }')}</div>
    ${esc(t(r.name, lang))}<small>${esc(t(r.note, lang))}</small></a>`).join('');

  const versions = (data.versions || []).map(v => `<div class="ver"><b>${esc(v.v)}</b><span>${esc(t(v.note, lang))}${v.current ? `<span class="now">${esc(t(UI.current, lang))}</span>` : ''}</span></div>`).join('');

  const notes = (data.notes?.[lang] || data.notes?.[o] || []).map(n => `<li>${esc(n)}</li>`).join('');
  const p = data.print;
  const print = p ? `<div class="print-kv">
      <div><small class="lbl">${lang === 'zh' ? '打印机' : 'Printer'}</small>${esc(p.printer)}</div>
      <div><small class="lbl">${lang === 'zh' ? '材料' : 'Material'}</small>${esc(t(p.material, lang))}</div>
      <div><small class="lbl">${lang === 'zh' ? '喷嘴' : 'Nozzle'}</small>${esc(p.nozzle)}</div>
      <div><small class="lbl">${lang === 'zh' ? '层高' : 'Layer'}</small>${esc(p.layer)}</div></div>
      ${p.status ? `<div class="status"><i></i>${esc(t(p.status, lang))}</div>` : ''}` : '';

  const gallery = (data.images || []).map(g => `<figure><a href="${fileUrl(g.file)}" target="_blank" rel="noopener"><img loading="lazy" alt="${esc(t(g.caption, lang))}" src="${fileUrl(g.file)}"></a><figcaption>${esc(t(g.caption, lang))}</figcaption></figure>`).join('');

  $('body').innerHTML = `<div class="bento">
    ${specs}
    <div class="tile span2" id="files"><h4>${esc(t(UI.files, lang))}<span>${(data.files || []).length}</span></h4>${files}</div>
    <div class="tile span2"><h4>${esc(t(UI.reusable, lang))}</h4><div class="parts">${reusable}</div></div>
    <div class="tile span2" id="versions"><h4>${esc(t(UI.versions, lang))}<span>${esc(data.version || '')}</span></h4>${versions}</div>
    <div class="tile span2" id="notes"><h4>${esc(t(UI.notes, lang))}</h4><ul class="notes">${notes}</ul>${print}</div>
    ${gallery ? `<div class="tile span4"><h4>${esc(t(UI.renders, lang))}<span>${esc(data.updated || '')}</span></h4><div class="gallery">${gallery}</div></div>` : ''}
  </div>`;
  paintControls();
  renderPartShots();
}

function paintControls() {
  const hero = $('hero');
  hero.querySelector('.controls')?.remove();
  hero.querySelector('.hint')?.remove();
  hero.querySelector('.badge')?.remove();
  if (!viewer) return;
  const lang = getLang();
  const modes = [['solid', UI.solid], ['wire', UI.wire], ['top', UI.top], ['spin', UI.spin]];
  const parts = viewer.meshes.length > 1 ? [[null, UI.assembly], ...viewer.meshes.map((m, i) => [i, { zh: partLabel(i, 'zh'), en: partLabel(i, 'en') }])] : [];
  hero.insertAdjacentHTML('beforeend', `<div class="badge"><b>${esc(data.version || '')}</b> · ${esc(t(CATEGORIES[data.category] || CATEGORIES.other, lang))}</div>
    <div class="hint">${esc(t(UI.dragHint, lang))}</div>
    <div class="controls">
      <div class="seg dark" id="modes">${modes.map(([k, l]) => `<button data-m="${k}" class="${mode === k ? 'on' : ''}">${esc(t(l, lang))}</button>`).join('')}</div>
      ${parts.length ? `<div class="seg dark" id="parts">${parts.map(([k, l]) => `<button data-p="${k ?? ''}" class="${part === k ? 'on' : ''}">${esc(t(l, lang))}</button>`).join('')}</div>` : ''}
    </div>`);
  $('modes').onclick = e => { const m = e.target.closest('button')?.dataset.m; if (m) setMode(m); };
  if ($('parts')) $('parts').onclick = e => { const b = e.target.closest('button'); if (!b) return; part = b.dataset.p === '' ? null : Number(b.dataset.p); viewer.showOnly(part); paintControls(); };
}

/** Names for the parts inside the preview file: taken from the matching reusable entry when possible. */
function partLabel(i, lang) {
  const name = viewer.meshes[i].name || viewer.meshes[i].parent?.name || '';
  const hit = (data.reusable || []).find(r => name && fileName(r.file).startsWith(name));
  return hit ? t(hit.name, lang) : (name || `${lang === 'zh' ? '零件' : 'Part'} ${i + 1}`);
}

function setMode(m) {
  mode = m;
  viewer.setWire(m === 'wire');
  viewer.setSpin(m === 'spin');
  if (m === 'top') viewer.viewTop(); else if (m === 'solid') viewer.viewHome();
  paintControls();
}

async function startViewer() {
  const lang = getLang();
  $('state').textContent = t(UI.loading, lang);
  try {
    const pv = data.preview;
    const model = await loadModel(base + pv.file, { upAxis: pv.upAxis || 'z' });
    $('state').remove();
    viewer = createViewer($('hero'), model, { az: 20, el: 30, fit: 1, ...(pv.hero || {}) });
    paintControls();
  } catch (err) {
    console.error(err);
    $('state').textContent = t(UI.loadFail, lang);
  }
}

async function renderPartShots() {
  for (const el of document.querySelectorAll('.parts .pic[data-part]')) {
    const file = el.dataset.part;
    if (!/\.(stl|3mf)$/i.test(file)) continue;
    if (!partShots.has(file)) {
      try {
        const model = await loadModel(base + file, { upAxis: 'z' });
        const box = el.getBoundingClientRect();
        partShots.set(file, renderStill(model, { width: Math.round(box.width), height: Math.round(box.height), az: 15, el: 40, fit: 0.95 }));
      } catch { continue; }
    }
    el.innerHTML = `<img alt="" src="${partShots.get(file)}">`;
  }
}

main();
