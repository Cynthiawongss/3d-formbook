// Tiny bilingual helper. Text objects look like { zh: '…', en: '…' }.
const KEY = '3d-formbook-lang';

export const UI = {
  models: { zh: '模型', en: 'Models' },
  all: { zh: '全部', en: 'All' },
  back: { zh: '全部模型', en: 'All models' },
  overview: { zh: '概览', en: 'Overview' },
  files: { zh: '文件', en: 'Files' },
  versions: { zh: '版本', en: 'Versions' },
  notes: { zh: '笔记', en: 'Notes' },
  print: { zh: '打印', en: 'Print' },
  reusable: { zh: '可复用结构', en: 'Reusable parts' },
  renders: { zh: '网格预览图', en: 'Mesh renders' },
  download: { zh: '下载', en: 'Download' },
  downloadProject: { zh: '下载打印工程', en: 'Download print project' },
  current: { zh: '当前', en: 'Current' },
  solid: { zh: '实体', en: 'Solid' },
  wire: { zh: '线框', en: 'Wire' },
  top: { zh: '俯视', en: 'Top' },
  spin: { zh: '旋转', en: 'Spin' },
  assembly: { zh: '组装', en: 'Assembly' },
  loading: { zh: '正在载入模型…', en: 'Loading model…' },
  loadFail: { zh: '模型载入失败', en: 'Could not load model' },
  dragHint: { zh: '拖动旋转 · 滚轮缩放', en: 'Drag to orbit · scroll to zoom' },
  addTitle: { zh: '添加下一个模型', en: 'Add the next model' },
  addSteps: {
    zh: ['在 models/ 下新建一个文件夹', '放入模型文件和 model.json', '推送到 GitHub，网站自动更新'],
    en: ['Create a folder under models/', 'Add the model files and model.json', 'Push to GitHub — the site updates itself'],
  },
  count: { zh: n => `${n} 个模型`, en: n => `${n} model${n === 1 ? '' : 's'}` },
  footer: { zh: '自己建模、自己打印的模型库', en: 'A library of models I designed and printed' },
  notFound: { zh: '找不到这个模型', en: 'Model not found' },
};

export const CATEGORIES = {
  jewelry: { zh: '首饰', en: 'Jewelry' },
  vessel: { zh: '器物', en: 'Vessels' },
  part: { zh: '结构件', en: 'Parts' },
  study: { zh: '练习', en: 'Studies' },
  other: { zh: '其他', en: 'Other' },
};

export function getLang() {
  const saved = localStorage.getItem(KEY);
  if (saved === 'zh' || saved === 'en') return saved;
  return 'zh';
}
export function setLang(lang) { localStorage.setItem(KEY, lang); document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'; }
export const other = lang => (lang === 'zh' ? 'en' : 'zh');

/** Pick the string for a language from a {zh,en} object (falls back to the other language). */
export function t(obj, lang, ...args) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  const v = obj[lang] ?? obj[other(lang)];
  return typeof v === 'function' ? v(...args) : v;
}

export function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Wires up the 中 / EN switch in the header; calls onChange(lang) after switching. */
export function mountLangSwitch(el, onChange) {
  const paint = () => {
    const lang = getLang();
    el.innerHTML = `<button data-l="zh" class="${lang === 'zh' ? 'on' : ''}">中</button><span>/</span><button data-l="en" class="${lang === 'en' ? 'on' : ''}">EN</button>`;
  };
  el.addEventListener('click', e => {
    const l = e.target.closest('button')?.dataset.l;
    if (!l || l === getLang()) return;
    setLang(l); paint(); onChange(l);
  });
  setLang(getLang()); paint();
}
