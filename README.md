# 3d-formbook

我自己建模、自己打印的 3D 模型库。网站会直接在浏览器里显示 STL / 3MF 模型，可以旋转、看线框、单独看每个零件，也能下载文件。

A personal library of 3D models I design and print. The site renders STL / 3MF files right in the browser — orbit, wireframe, per-part view — and every file can be downloaded.

---

## 添加一个新模型 · Adding a model

1. 在 `models/` 下新建一个文件夹，名字用英文小写和短横线，例如 `models/snap-box/`。
   Create a folder under `models/`, e.g. `models/snap-box/` (lowercase, dashes).
2. 把模型文件放进 `files/`，预览图（可选）放进 `images/`，建模源码（可选）放进 `source/`。
   Put model files in `files/`, optional renders in `images/`, optional source in `source/`.
3. 复制 [`docs/model.template.json`](docs/model.template.json) 到这个文件夹，改名为 `model.json` 并填好。`id` 必须和文件夹名一样。
   Copy the template to `model.json` in that folder and fill it in. `id` must match the folder name.
4. 推送到 GitHub。网站会在一两分钟内自动更新。
   Push to GitHub; the site rebuilds itself in a minute or two.

```
models/
  snap-box/
    model.json
    files/   snap-box.3mf, snap-box.stl …
    images/  (可选 optional)
    source/  (可选 optional)
```

### model.json 字段 · Fields

| 字段 Field | 说明 |
|---|---|
| `title` | `{ "zh": "中文名", "en": "English" }` |
| `category` | `jewelry` 首饰 · `vessel` 器物 · `part` 结构件 · `study` 练习 · `other` 其他 |
| `preview.file` | 用来显示 3D 预览的文件（STL 或 3MF）。多零件的 3MF 会自动出现零件切换。 |
| `preview.upAxis` | 打印文件一般是 `"z"` |
| `preview.card` / `preview.hero` | 首页卡片 / 详情页的初始视角：`az` 水平角、`el` 俯仰角、`fit` 远近（越大越远） |
| `specs` | 详情页上方的数字卡片 |
| `files` | 可下载的文件列表，第一个会作为「下载打印工程」按钮 |
| `reusable` | 可复用结构（零件、源码） |
| `versions` / `notes` / `images` / `print` | 版本、笔记、预览图、打印参数，都可省略 |

---

## 本地预览 · Preview locally

```bash
node scripts/build-index.mjs
python3 -m http.server 8000
```

然后打开 http://localhost:8000 。`build-index` 会检查 `model.json` 和文件是否齐全。

Then open http://localhost:8000. `build-index` also checks that every `model.json` and file is in place.

## 技术说明 · Notes

- 纯静态网站，没有构建步骤；three.js 已放在 `assets/vendor/three/`（MIT License）。
- GitHub Actions（`.github/workflows/pages.yml`）在每次推送到 `main` 时生成 `models/index.json` 并发布到 GitHub Pages。
- 单个文件需小于 100 MB（GitHub 限制）。`.gcode` 默认不提交，切片工程请用 3MF。
