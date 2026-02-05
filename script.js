/*
  数据请求与渲染脚本（新手友好版）
  目标：页面刷新时，从 GitHub API 获取“近7日活跃且受欢迎”的仓库，并按 AI/医疗/机器人 分类显示，每类前 5。
  说明：使用 GitHub Search API（支持 CORS），无需后端。
*/

// 自动刷新间隔（毫秒）：默认 5 分钟，可根据需要修改
var AUTO_REFRESH_MS = 5 * 60 * 1000;
var autoRefreshTimer = null;
// 每类展示数量：默认 10 条
var MAX_ITEMS_PER_CATEGORY = 10;

// 页面加载：启动首次拉取与自动刷新；绑定刷新按钮
window.addEventListener('DOMContentLoaded', function () {
  fetchWeeklyHotRepos();
  scheduleAutoRefresh();

  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      fetchWeeklyHotRepos();
    });
  }

  // 功能概览折叠按钮：点击切换显示/隐藏
  var aboutToggle = document.getElementById('about-toggle');
  var aboutContent = document.getElementById('about-content');
  if (aboutToggle && aboutContent) {
    aboutToggle.addEventListener('click', function () {
      var isHidden = aboutContent.classList.contains('hidden');
      if (isHidden) {
        aboutContent.classList.remove('hidden');
        aboutToggle.textContent = '收起说明';
        aboutToggle.setAttribute('aria-expanded', 'true');
      } else {
        aboutContent.classList.add('hidden');
        aboutToggle.textContent = '展开说明';
        aboutToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
});

// 近7日热门（近似）：pushed:>=YYYY-MM-DD + stars 降序
function fetchWeeklyHotRepos() {
  // 读取过滤控件的值
  var daysSelect = document.getElementById('days-select');
  var sortSelect = document.getElementById('sort-select');

  var days = 7;
  if (daysSelect && daysSelect.value) {
    var d = parseInt(daysSelect.value, 10);
    if (!isNaN(d) && d > 0) days = d;
  }
  var sortOption = (sortSelect && sortSelect.value) ? sortSelect.value : 'stars';

  // 计算时间窗口的日期字符串
  var today = new Date();
  var fromDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  var year = fromDate.getFullYear();
  var month = String(fromDate.getMonth() + 1).padStart(2, '0');
  var day = String(fromDate.getDate()).padStart(2, '0');
  var dateStr = year + '-' + month + '-' + day;

  // 使用最近 push 窗口
  var dateField = 'pushed';

  var peList = document.getElementById('repo-pe');
  var workflowList = document.getElementById('repo-workflow');
  if (peList) peList.innerHTML = '';
  if (workflowList) workflowList.innerHTML = '';

  if (peList) peList.appendChild(createLoadingCard('正在加载 Productivity & Efficiency 数据…'));
  if (workflowList) workflowList.appendChild(createLoadingCard('正在加载 Workflow Automation 数据…'));

  var opts = { sortOption: sortOption, dateField: dateField };

  // 依分类分别检索，提升命中度
  Promise.all([
    fetchCategoryRepos('pe', dateStr, opts),
    fetchCategoryRepos('workflow', dateStr, opts)
  ])
    .then(function (results) {
      if (peList) peList.innerHTML = '';
      if (workflowList) workflowList.innerHTML = '';
      hideError();

      var peRepos = results[0] || [];
      var workflowRepos = results[1] || [];


  // 排序并截取 Top N（支持 stars/forks/updated/trending≈）

      // 排序并截取 Top N（支持 stars/forks/updated/trending≈）
      var nowMs = Date.now();
      var comparator;
      if (opts.sortOption === 'forks') {
        comparator = function (a, b) {
          var fa = (typeof a.forks_count === 'number') ? a.forks_count : 0;
          var fb = (typeof b.forks_count === 'number') ? b.forks_count : 0;
          return fb - fa;
        };
      } else {
        // 默认：总星排序
        comparator = function (a, b) {
          var sa = (typeof a.stargazers_count === 'number') ? a.stargazers_count : 0;
          var sb = (typeof b.stargazers_count === 'number') ? b.stargazers_count : 0;
          return sb - sa;
        };
      }
      peRepos.sort(comparator); peRepos = peRepos.slice(0, MAX_ITEMS_PER_CATEGORY);
      workflowRepos.sort(comparator); workflowRepos = workflowRepos.slice(0, MAX_ITEMS_PER_CATEGORY);

      // 全局最大星数用于热度条
      var allTop = peRepos.concat(workflowRepos);
      var maxStars = 1;
      for (var i = 0; i < allTop.length; i++) {
        var s = (typeof allTop[i].stargazers_count === 'number') ? allTop[i].stargazers_count : 0;
        if (s > maxStars) maxStars = s;
      }

      // 渲染两类
      renderList(peList, peRepos, maxStars, '暂无 Productivity & Efficiency 仓库', 'pe');
      renderList(workflowList, workflowRepos, maxStars, '暂无 Workflow Automation 仓库', 'workflow');
    })
    .catch(function (error) {
      console.error('加载数据出错：', error);
      showError('数据加载失败，请刷新重试');
      if (peList) peList.innerHTML = '';
      if (workflowList) workflowList.innerHTML = '';
    });
}

/*
  功能：为指定分类构建更贴合企业提效/工作流的检索关键字
  - 使用 in:name,description,readme 与多关键字 OR 提升命中率
  - 加 stars:>50 过滤低星项目
*/
function buildCategoryQuery(category, dateStr, opts) {
  var dateField = (opts && opts.dateField) ? opts.dateField : 'pushed';
  var base = dateField + ':>=' + dateStr;
  var inFields = 'in:name,description,readme';
  if (category === 'pe') {
    // 精简关键词，避免查询过长导致 422
    var terms = [
      'productivity','efficiency','enterprise','office','document','excel','word',
      'email','collaboration','todo','task','calendar','note'
    ];
    return '(' + terms.join(' OR ') + ') ' + inFields + ' ' + base;
  } else {
    var terms2 = [
      'workflow','automation','orchestration','pipeline','ci','cd','integration','webhook','scheduler','queue',
      'rpa','bot','script','process'
    ];
    return '(' + terms2.join(' OR ') + ') ' + inFields + ' ' + base;
  }
}

/*
  功能：按分类调用 GitHub Search API 并返回仓库数组
*/
function fetchCategoryRepos(category, dateStr, opts) {
  var q = buildCategoryQuery(category, dateStr, opts);
  var sortParam = (opts && opts.sortOption) ? opts.sortOption : 'stars';
  var url = 'https://api.github.com/search/repositories'
    + '?q=' + encodeURIComponent(q)
    + '&sort=' + encodeURIComponent(sortParam)
    + '&order=desc'
    + '&per_page=100';
  return fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/vnd.github+json' }
  })
    .then(function (res) {
      if (!res.ok) {
        // 如果是 422/403 等，尝试使用更简单的回退查询
        var status = res.status;
        if (status === 422 || status === 403) {
          return res.text().then(function (t) {
            console.error('分类查询失败，状态：' + status + '，响应：', t);
            return fallbackCategoryFetch(category, dateStr, opts);
          });
        }
        throw new Error('HTTP ' + status);
      }
      return res.json();
    })
    .then(function (data) {
      if (Array.isArray(data)) {
        // 回退查询已返回数组
        return data;
      }
      var items = (data && data.items) ? data.items : [];
      // 额外用本地规则过滤一遍，确保分类准确
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var cat = detectCategory(items[i]);
        if ((category === 'pe' && cat === 'pe') || (category === 'workflow' && cat === 'workflow')) {
          out.push(items[i]);
        }
      }
      return out.length > 0 ? out : items; // 若规则无匹配，则直接返回原结果
    })
    .catch(function (err) {
      console.error('分类查询异常：', err);
      // 最终回退到极简查询
      return fallbackCategoryFetch(category, dateStr, opts);
    });
}

// 极简回退查询（防止 422/限流导致失败）
function fallbackCategoryFetch(category, dateStr, opts) {
  var dateField = (opts && opts.dateField) ? opts.dateField : 'pushed';
  var sortParam = (opts && opts.sortOption) ? opts.sortOption : 'stars';
  var base = dateField + ':>=' + dateStr;
  var inFields = 'in:name,description,readme';
  var simple = (category === 'pe')
    ? '(productivity OR efficiency OR enterprise)'
    : '(workflow OR automation OR orchestration)';
  var q = simple + ' ' + inFields + ' ' + base;
  var url = 'https://api.github.com/search/repositories'
    + '?q=' + encodeURIComponent(q)
    + '&sort=' + encodeURIComponent(sortParam)
    + '&order=desc'
    + '&per_page=50';
  return fetch(url, { method: 'GET', headers: { 'Accept': 'application/vnd.github+json' } })
    .then(function (res) { return res.json(); })
    .then(function (data) { return (data && data.items) ? data.items : []; })
    .catch(function (e) { console.error('回退查询仍失败：', e); return []; });
}

// “加载中”提示卡片
function createLoadingCard(text) {
  var card = document.createElement('div');
  card.className = 'repo-card';
  var p = document.createElement('p');
  p.className = 'repo-desc';
  p.textContent = text;
  card.appendChild(p);
  return card;
}

// 仓库卡片（含名称、描述、星标数、语言、热度条）
function createRepoCard(repo, maxStars, category) {
  var card = document.createElement('div');
  card.className = 'repo-card';

  var name = document.createElement('div');
  name.className = 'repo-name';
  var link = document.createElement('a');
  link.href = repo.html_url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = repo.full_name || repo.name || '未命名仓库';
  name.appendChild(link);

  var desc = document.createElement('p');
  desc.className = 'repo-desc';
  desc.textContent = repo.description ? repo.description : '暂无描述';

  var meta = document.createElement('div');
  meta.className = 'repo-meta';
  var starsNum = (typeof repo.stargazers_count === 'number') ? repo.stargazers_count : 0;
  var stars = starsNum.toLocaleString();
  var language = repo.language ? repo.language : '未知语言';
  meta.textContent = '⭐ ' + stars + ' · 语言：' + language;

  // 热度条（相对 maxStars）
  var hotBar = document.createElement('div');
  hotBar.className = 'hot-bar';
  var hotFill = document.createElement('div');
  hotFill.className = 'hot-fill';
  var percent = Math.round((starsNum / maxStars) * 100);
  if (percent < 3) percent = 3;
  if (percent > 100) percent = 100;
  hotFill.style.width = percent + '%';
  hotBar.appendChild(hotFill);

  // 中文用途说明（基于关键词的简单概述）
  var cn = document.createElement('p');
  cn.className = 'repo-cn';
  cn.textContent = buildChineseSummary(repo, category);

  // 适用场景（单独一行）
  var scenes = document.createElement('p');
  scenes.className = 'repo-scenes';
  scenes.textContent = '适用场景：' + buildChineseScenes(repo, category);

  card.appendChild(name);
  card.appendChild(desc);
  card.appendChild(meta);
  card.appendChild(hotBar);
  card.appendChild(cn);
  card.appendChild(scenes);
  return card;
}

// 错误提示
function showError(msg) {
  var errorBox = document.getElementById('error');
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}
function hideError() {
  var errorBox = document.getElementById('error');
  if (!errorBox) return;
  errorBox.style.display = 'none';
}

// 按关键词分类（中英文关键字）
function detectCategory(repo) {
  var text = '';
  if (repo && repo.full_name) text += ' ' + repo.full_name.toLowerCase();
  if (repo && repo.name) text += ' ' + repo.name.toLowerCase();
  if (repo && repo.description) text += ' ' + repo.description.toLowerCase();
  if (repo && Array.isArray(repo.topics)) {
    text += ' ' + repo.topics.join(' ').toLowerCase();
  }

  var productivityKeys = [
    'productivity','todo','task','note','calendar','planner','time tracking','pomodoro','focus','kanban',
    '效率','生产力','待办','任务','笔记','日历','时间跟踪','专注','番茄钟','看板'
  ];
  var officeKeys = [
    'office','document','docs','excel','spreadsheet','word','ppt','powerpoint','mail','email','collab','collaboration',
    '办公','辦公','文档','表格','电子表格','邮件','协作','協作'
  ];
  var workflowKeys = [
    'workflow','automation','pipeline','orchestration','ci','cd','integration','zapier','ifttt','bot','script',
    '工作流','自动化','流程','流水线','集成','编排','腳本','脚本','机器人流程自动化','RPA'
  ];

  if (hasAny(text, productivityKeys)) return 'pe';
  if (hasAny(text, officeKeys)) return 'pe';
  if (hasAny(text, workflowKeys)) return 'workflow';
  return null;
}

function hasAny(text, keys) {
  var lower = text || '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i].toLowerCase();
    if (lower.indexOf(k) !== -1) return true;
  }
  return false;
}

// 渲染列表（为空给出提示）
function renderList(container, items, maxStars, emptyMsg, category) {
  if (!container) return;
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.appendChild(createLoadingCard(emptyMsg));
    return;
  }
  for (var i = 0; i < items.length; i++) {
    container.appendChild(createRepoCard(items[i], maxStars, category));
  }
}

// 定时自动刷新
function scheduleAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(function () {
    fetchWeeklyHotRepos();
  }, AUTO_REFRESH_MS);
}

/*
  功能：生成中文用途说明（规则匹配）
  - 不调用外部翻译，仅根据名称/描述/话题关键词生成简短中文概述
  - 若未匹配到具体关键词，则给出该类别的通用说明
*/
function buildChineseSummary(repo, category) {
  var text = '';
  if (repo && repo.full_name) text += ' ' + repo.full_name.toLowerCase();
  if (repo && repo.name) text += ' ' + repo.name.toLowerCase();
  if (repo && repo.description) text += ' ' + repo.description.toLowerCase();
  if (repo && Array.isArray(repo.topics)) {
    text += ' ' + repo.topics.join(' ').toLowerCase();
  }

  // 规则库（英文+中文关键词）
  var rules = [
    // Productivity
    {keys: ['todo','待办','task','任务'], msg: '用于待办/任务管理，帮助安排与跟踪进度。', cat: 'pe'},
    {keys: ['note','笔记'], msg: '用于笔记记录与知识管理。', cat: 'pe'},
    {keys: ['calendar','日历','schedule','日程'], msg: '用于日历/日程安排与提醒。', cat: 'pe'},
    {keys: ['time tracking','时间跟踪','timer'], msg: '用于时间跟踪与统计分析。', cat: 'pe'},
    {keys: ['pomodoro','番茄钟','focus','专注'], msg: '用于专注与番茄钟时间管理。', cat: 'pe'},
    {keys: ['kanban','看板'], msg: '用于看板式项目/任务管理。', cat: 'pe'},

    // Office Efficiency
    {keys: ['document','docs','文档','word'], msg: '用于文档编辑与处理，提高办公效率。', cat: 'pe'},
    {keys: ['excel','spreadsheet','表格','电子表格'], msg: '用于表格/数据处理与分析。', cat: 'pe'},
    {keys: ['ppt','powerpoint','幻灯片'], msg: '用于演示文稿的制作与优化。', cat: 'pe'},
    {keys: ['mail','email','邮件'], msg: '用于邮件管理、批量处理或自动化。', cat: 'pe'},
    {keys: ['collab','collaboration','协作','協作'], msg: '用于团队协作与多人编辑。', cat: 'pe'},

    // Workflow Automation
    {keys: ['workflow','工作流'], msg: '用于工作流的设计与自动化执行。', cat: 'workflow'},
    {keys: ['automation','自动化'], msg: '用于自动化处理重复任务。', cat: 'workflow'},
    {keys: ['pipeline','流水线','ci','cd'], msg: '用于构建/部署流水线，集成与交付。', cat: 'workflow'},
    {keys: ['orchestration','编排'], msg: '用于流程编排与任务调度。', cat: 'workflow'},
    {keys: ['integration','集成','zapier','ifttt'], msg: '用于系统/服务集成与触发式自动化。', cat: 'workflow'},
    {keys: ['bot','机器人','script','脚本','腳本','rpa'], msg: '用于脚本/机器人自动化（RPA）。', cat: 'workflow'}
  ];

  // 优先匹配当前类别的规则
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (category && r.cat !== category) continue;
    if (hasAny(text, r.keys)) return r.msg;
  }
  // 次级匹配（不限定类别）
  for (var j = 0; j < rules.length; j++) {
    var r2 = rules[j];
    if (hasAny(text, r2.keys)) return r2.msg;
  }

  // 通用中文说明（按类别）并附加适用场景
  if (category === 'pe') return '与生产力与办公效率相关的工具，辅助任务、文档、表格与协作。';
  if (category === 'workflow') return '与工作流自动化相关的工具，用于简化重复流程。';
  return '开源项目用途：提升效率或自动化处理任务。';
}

// 简单的适用场景文本（按类别）
function buildChineseScenes(repo, category) {
  if (category === 'pe') return '团队任务管理、笔记归档、文档与表格处理、邮件与协作';
  if (category === 'workflow') return '构建/部署流水线、系统集成、触发式任务编排、RPA 自动化';
  return '个人与团队的日常工作提效';
}
