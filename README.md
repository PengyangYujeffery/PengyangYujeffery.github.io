# pengyangyu.com

郁鹏洋（Pengyang Yu）的个人学术主页。纯静态网站（HTML + CSS + 原生 JS），托管在 Cloudflare Workers 上。

## 目录结构

```text
.
├── public/                 网站本身：只有这个目录会被发布
│   ├── *.html              首页、研究、论文、教学、动态、搜索
│   ├── _redirects          路由：/research → research.html、/en、/zh、旧版网址跳转
│   ├── robots.txt
│   ├── sitemap.xml         由构建脚本生成
│   ├── baidu_verify_*      百度站长验证文件（不要删）
│   └── assets/             css / js / 图片 / 研究图谱数据
├── content/                会在多个地方出现的内容，只在这里写一次
│   ├── publications.json   论文：首页精选、论文页、站内搜索
│   ├── news.json           动态页、站内搜索
│   ├── teaching.json       教学页、站内搜索
│   └── search.json         站内搜索里额外的条目
├── partials/               所有页面共用的 HTML：head、导航栏、侧边栏、页脚、脚本
├── tools/
│   ├── build.py            把 content/ 和 partials/ 同步进 public/
│   └── serve.py            本地预览，路由规则和线上一致
└── wrangler.jsonc          Cloudflare 配置（只发布 public/）
```

## 常见修改

| 想改什么 | 改哪里 |
| --- | --- |
| 新增论文、更新论文状态 | `content/publications.json`（`"selected": true` 的会出现在首页） |
| 新增动态 | `content/news.json`（新的放最前面） |
| 新增教学经历 | `content/teaching.json` |
| 头像、姓名、邮箱、社交链接 | `partials/sidebar.html`；换头像时还要改 `public/index.html` 里的 `og:image` |
| 导航栏 | `partials/nav.html` |
| 页面独有的文字（简介、研究方向等） | 直接改 `public/*.html`，标记区域之外的部分 |
| 研究图谱 | `public/assets/data/research-map.json` |
| 样式、交互 | `public/assets/css/`、`public/assets/js/` |

改完 `content/` 或 `partials/` 后运行：

```powershell
py tools/build.py
```

页面里 `<!-- build:xxx -->` 与 `<!-- /build:xxx -->` 之间的内容由脚本生成，手改会在下次构建时被覆盖。`py tools/build.py --check` 只检查不写入，有内容没同步时返回非零。

### 论文字段

- `status`：`published`、`accepted`（列在“已发表论文”）、`in-progress`、`planned`（列在“当前研究工作”）
- 已发表的论文写 `journal`、`year`、`pages`（可选）、`type`、`doi`；未发表的写 `subtitle`
- `title_zh` 只用于站内搜索；`links` 可加额外链接，例如 `[{"label": "Code", "url": "https://..."}]`

### 双语

每段文字带 `data-i18n data-en="…" data-zh="…"`，含链接等 HTML 的用 `data-i18n-html`，由 `assets/js/site.js` 切换语言。`content/` 里写成 `{"en": "…", "zh": "…"}` 会自动生成这些属性，含 HTML 时再加 `"html": true`。

## 本地预览

```powershell
py tools/serve.py
```

然后打开 http://127.0.0.1:8000/ 。`/research`、`/en`、`/zh` 等路由和旧版网址跳转都按 `_redirects` 处理，与线上一致。

## 部署

推送到 GitHub 的 `main` 分支后，Cloudflare Workers 会自动把 `public/` 发布到 pengyangyu.com，本地不需要安装 Node.js。资源默认每次都会向服务器重新验证，改了 CSS/JS 不需要手动加版本号。

GitHub Pages 仍然开着，只是为了让旧地址 pengyangyujeffery.github.io 自动跳转到 pengyangyu.com。它用的 `gh-pages` 分支是旧版 al-folio 网站，已不再更新，不要删除。

## 其他

- 主题：19:00–06:00 自动深色。手动切换会保持到下一个切换时间点（06:00 或 19:00），换页、刷新都不会丢（`assets/js/theme.js`）。
- 图标：导航栏图标是内联 SVG；Google Scholar 和 ORCID 图标来自 academicons（cdnjs，带完整性校验）。
- 模板：基于 Luka Homepage 模板，许可证见 `LICENSE.md`。
