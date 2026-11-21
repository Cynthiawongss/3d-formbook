// Scans models/*/model.json and writes models/index.json for the site.
// Usage: node scripts/build-index.mjs
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modelsDir = join(root, 'models');
const problems = [];
const entries = [];

for (const dirent of await readdir(modelsDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = join(modelsDir, dirent.name);
  let data;
  try {
    data = JSON.parse(await readFile(join(dir, 'model.json'), 'utf8'));
  } catch (err) {
    problems.push(`${dirent.name}: cannot read model.json (${err.message})`);
    continue;
  }
  if (data.id !== dirent.name) problems.push(`${dirent.name}: "id" should be "${dirent.name}"`);
  if (!data.title?.zh || !data.title?.en) problems.push(`${dirent.name}: title needs both "zh" and "en"`);
  if (!data.preview?.file) problems.push(`${dirent.name}: preview.file is missing`);

  const paths = new Set([data.preview?.file, data.cover, ...(data.files || []).map(f => f.file), ...(data.images || []).map(i => i.file), ...(data.reusable || []).map(r => r.file)].filter(Boolean));
  const sizes = {};
  for (const p of paths) {
    try { sizes[p] = (await stat(join(dir, p))).size; }
    catch { problems.push(`${dirent.name}: file not found: ${p}`); }
  }
  entries.push({
    id: data.id, title: data.title, category: data.category || 'other', version: data.version || '',
    updated: data.updated || '', summary: data.summary, preview: data.preview, cover: data.cover || null, sizes,
  });
}

entries.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
await writeFile(join(modelsDir, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), models: entries }, null, 2) + '\n');

console.log(`models/index.json: ${entries.length} model(s)`);
if (problems.length) {
  console.error('Problems:\n- ' + problems.join('\n- '));
  process.exit(1);
}
