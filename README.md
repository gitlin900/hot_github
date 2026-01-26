# GitHub 每日热门仓库（新手友好版）

一个只用 HTML + CSS + 原生 JavaScript 的纯前端小项目，页面刷新时自动从 GitHub API 获取并展示“近7日/14日/30日窗口内活跃且受欢迎”的仓库列表，并按主题分类为 Productivity & Efficiency / Workflow Automation。支持按 Stars、Forks 排序，无需后端，适合新手学习与部署到 GitHub Pages。

## 一句话说明
- 数据来源：GitHub 官方 Search API（支持浏览器 CORS，无需代理）
- 展示信息：仓库名称（可点击）、描述（2 行紧凑）、星标数、语言、简易热度条、中文用途说明
- 自动刷新：默认每 5 分钟自动刷新（可在 `script.js` 的 `AUTO_REFRESH_MS` 修改）
- 文件结构：`index.html`、`style.css`、`script.js`

---

## 运行步骤（详细到双击）

1. 新建文件夹
   - 在电脑上创建一个文件夹，例如：`C:\code\hot_github`。

2. 保存项目文件
   - 将以下 3 个文件放入该文件夹：
     - `index.html`
     - `style.css`
     - `script.js`

3. 本地运行（最简单方式）
   - 直接双击 `index.html` 用浏览器打开即可（推荐使用 Edge/Chrome）。
   - 页面会自动请求 GitHub API 并展示结果（按 Productivity & Efficiency / Workflow Automation 分类，每类 10 个最热）。

4. 可选：通过本地静态服务器运行（遇到浏览器安全限制时再用）
   - 如果安装了 Python（3.x），在 `hot_github` 目录打开终端并执行：

```bash
python -m http.server 8000
```

   - 浏览器访问：`http://localhost:8000/index.html`
   - 如果未安装 Python，也可以安装 VS Code 扩展 “Live Server”，右键 `index.html` 选择 “Open with Live Server”。

---

## 部署到 GitHub Pages（免费）

1. 创建 GitHub 仓库
   - 登录 GitHub，点击 “New” 创建一个新的仓库（例如：`hot_github`）。

2. 上传文件
   - 将本地文件夹里的 `index.html`、`style.css`、`script.js`（可包含 `README.md`）推送到 GitHub 仓库的 `main` 分支。
   - 不会用 Git 的话，直接在 GitHub 网页上逐个上传文件也可以。

3. 开启 Pages
   - 进入仓库的 `Settings` → `Pages`。
   - 在 “Source” 选择分支 `main`，配置为 `/ (root)`。
   - 保存后，稍等几分钟，GitHub 会生成一个网站 URL（例如：`https://<你的用户名>.github.io/hot_github/`）。

4. 访问你的页面
   - 打开该 URL，就能看到热门仓库列表。

---

## 关于数据来源与“热度/趋势”与跨域（CORS）

- 许多文章提到的 “GitHub 官方趋势 API” 示例链接（例如 `https://api.github.com/trending?since=daily`）并不是 GitHub 官方文档提供的公开接口，通常不可用或会返回 404。
- 为保证纯前端可用、且避免跨域问题，本项目使用 GitHub 官方的 “搜索仓库” API：它支持浏览器跨域访问（`Access-Control-Allow-Origin: *`）。
- 我们用查询条件 `pushed:>=YYYY-MM-DD` 筛选窗口内的仓库，并按 `stars` 或 `forks` 等排序，近似得到 “周热度” 效果（GitHub 未公开 Trending 周增星接口）。

如果你确实需要 “趋势（Trending）” 的精确数据（例如按日新增 Star 量排序），可以考虑：
- 方案 A（推荐给新手）：继续使用当前近似方案，足够日常浏览与分类展示。
- 方案 B（第三方 API）：搜索“GitHub Trending API”找到支持 CORS 的第三方接口（注意稳定性可能随时间变化）。将 `script.js` 中的请求 URL 替换成该接口的地址即可。
- 方案 C（自建服务）：自己搭建后端去抓取 GitHub Trending 页面并提供接口（对新手不友好）。

---

## 过滤与排序（Stars/Forks）

页面顶部提供以下控件：

- 时间范围：近 7 / 14 / 30 天 / 3月（影响 `pushed` 的窗口）。
- 排序依据：
   - 总 Stars（`sort=stars`）
   - 总 Forks（`sort=forks`）
（已简化）不再提供最小 Stars / Forks 过滤，也不再提供“最近更新/Trending”排序；结果以选择的时间窗口与排序为主。

### 卡片中的“适用场景”

每个项目卡片下方新增一行“适用场景：”，根据分类给出典型使用场景：
- Productivity & Efficiency：团队任务管理、笔记归档、文档与表格处理、邮件与协作
- Workflow Automation：构建/部署流水线、系统集成、触发式任务编排、RPA 自动化

## 如何自定义筛选（例如只看某种语言或关键词）

打开 `script.js`，找到构建 `apiUrl` 的部分：

```js
var apiUrl = 'https://api.github.com/search/repositories'
+ '?q=' + encodeURIComponent('pushed:>=' + dateStr)
  + '&sort=stars'
  + '&order=desc'
  + '&per_page=50';
```

把查询字符串中加入语言条件（例如 JavaScript）：

```js
+ '?q=' + encodeURIComponent('pushed:>=' + dateStr + ' language:JavaScript')
```

或过滤更“新”的仓库（按创建时间）：

```js
+ '?q=' + encodeURIComponent('created:>=' + dateStr)
```

也可以组合多个条件（以空格分隔）：

```js
+ '?q=' + encodeURIComponent('pushed:>=' + dateStr + ' language:Python stars:>100')
```

提示：未经认证的 GitHub API 访问有速率限制（通常每小时 60 次）。如果你频繁刷新页面可能会触发限流，稍等片刻再试即可。

---

## 文件说明

- `index.html`：页面结构；包含标题、错误提示容器、仓库列表容器。
- `style.css`：页面样式；卡片风格、蓝色标题、灰色元信息、内容居中。
- `script.js`：核心逻辑；
  - 计算日期 → 构建 API URL → `fetch` 请求 → 解析数据 → 生成卡片。
  - 失败时显示“数据加载失败，请刷新重试”。
   - 分类（生产力/办公效率/工作流自动化）并各取前 5；为每个仓库生成中文用途说明。

---

## 常见问题

- 看不到数据？
  - 可能是 API 限流（稍后再试），或当天活跃仓库较少。
  - 打开浏览器开发者工具（F12）查看 Console 是否有报错。

- 跨域会不会有问题？
  - GitHub Search API 支持 CORS，直接在前端页面可访问，无需代理。

- 能不能精确做到 GitHub 官方 Trending 排序？
  - GitHub 未公开该接口。当前方案使用“最近活跃 + 星标排序”近似替代，足够新手学习和展示。

### 分类关键词（可按需调整）

在 `script.js` 中的 `detectCategory()` 使用简单关键词匹配进行分类，同时 `buildCategoryQuery()` 针对企业提效与工作流自动化优化检索关键字：
- Productivity & Efficiency：`productivity`、`efficiency`、`enterprise`、`office`、`document`、`docs`、`excel`、`spreadsheet`、`word`、`ppt`、`powerpoint`、`email`、`collaboration`、`team`、`note`、`knowledge`、`todo`、`task`、`calendar`、`planner`、`time tracking`、`pomodoro`、`kanban`，以及中文如“效率”“生产力”“企业”“办公”“文档”“表格”“邮件”“协作”“团队”“笔记”“知识”“待办”“任务”“日历”“计划”“时间跟踪”“番茄钟”“看板”等
- Workflow Automation：`workflow`、`automation`、`orchestration`、`pipeline`、`ci`、`cd`、`integration`、`webhook`、`scheduler`、`queue`、`rpa`、`bot`、`script`、`process`、`business workflow`、`workflow management`、`team collaboration`，以及中文如“工作流”“自动化”“编排”“流水线”“集成”“触发器”“调度”“队列”“机器人流程自动化”“机器人”“脚本”“流程”“业务流程”“工作流管理”“协作”等

说明：检索时使用 `in:name,description,readme` 与 `stars:>50` 进行筛选，并按 `stars` 降序排序，尽量更贴近“企业提效”的热门工具。

你可以增删关键词以更贴近你的主题范围。

### 自动刷新间隔如何修改

打开 `script.js` 顶部找到：

```js
var AUTO_REFRESH_MS = 5 * 60 * 1000; // 默认 5 分钟
```

把 `5 * 60 * 1000` 改为你需要的毫秒值，例如 1 分钟：`1 * 60 * 1000`。

祝使用愉快！
