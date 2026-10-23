(() => {
  'use strict';
  if (window.top !== window.self) return;
  const panelId = 'vle-upcoming-quizzes-skeleton';
  if (document.getElementById(panelId)) return;
  const sidebarSelectors = ['#sidebar-first .region-sidebar-first', '#region-pre', '[data-region="pre"]', '#block-region-side-pre', '.block-region.side-pre'];
  const deadlineSelector = '.block_calendar_upcoming, .block_upcoming_deadlines, [data-block="calendar_upcoming"], [data-block="upcoming_deadlines"]';

  const style = document.createElement('style');
  style.textContent = `
    #${panelId} { display:block !important; visibility:visible !important;
      background:#eee; color:#000; border:1px solid #ddd;
      border-radius:0; margin:0 0 20px; padding:15px 20px; box-shadow:none;
      font-family:Georgia,"Times New Roman",Times,serif; font-size:14px; line-height:21px; }
    #${panelId} .vle-quiz-heading { font-size:1.071em; font-weight:400;
      line-height:1.2; margin:0 0 .5em; padding:0 0 5px; border-bottom:1px solid #d6d6d6; }
    #${panelId} .vle-quiz-content { padding:0; font-size:inherit; line-height:inherit; }
    #${panelId} .vle-quiz-content p { margin:0; }
    #${panelId} .vle-quiz-note { color:#666; margin-top:8px !important; font-size:.8rem; }
    #${panelId} .vle-quiz-list { list-style:none; margin:0; padding:0; }
    #${panelId} .vle-quiz-item { margin:0; padding:10px 0; border-bottom:1px solid #d6d6d6; }
    #${panelId} .vle-quiz-item:first-child { padding-top:0; }
    #${panelId} .vle-quiz-item:last-child { border:0; }
    #${panelId} a { color:#0071b3; overflow-wrap:anywhere; }
    #${panelId} .vle-quiz-meta { display:block; font-size:12px; line-height:1.5; color:#555; }
    #${panelId} .vle-quiz-refresh { font:inherit; font-size:12px; margin-top:10px; padding:3px 8px;
      border:1px solid #bbb; background:#fafafa; color:#333; cursor:pointer; }
    #${panelId} .vle-quiz-refresh:disabled { cursor:wait; opacity:.6; }
  `;
  document.head.append(style);

  const panel = document.createElement('section');
  panel.id = panelId;
  panel.className = 'block block-vle-upcoming-quizzes';
  panel.setAttribute('aria-labelledby', `${panelId}-title`);
  panel.innerHTML = `<h2 class="vle-quiz-heading" id="${panelId}-title">Upcoming Quizzes</h2>
    <div class="content vle-quiz-content"><p class="vle-quiz-status" role="status" aria-live="polite">正在检查测验…</p>
    <ul class="vle-quiz-list"></ul><p class="vle-quiz-note"></p>
    <button class="vle-quiz-refresh" type="button">刷新列表</button></div>`;
  const status = panel.querySelector('.vle-quiz-status');
  const list = panel.querySelector('.vle-quiz-list');
  const note = panel.querySelector('.vle-quiz-note');
  const refresh = panel.querySelector('button');

  function mount() {
    // Only use an established left sidebar. Never create a competing page sidebar.
    const sidebar = sidebarSelectors.map(s => document.querySelector(s)).find(Boolean);
    if (!sidebar) return;
    const content = sidebar.querySelector('.block-region-content') || sidebar;
    let deadline = sidebar.querySelector(deadlineSelector);
    if (!deadline) {
      const heading = Array.from(sidebar.querySelectorAll('h2,h3,.card-title,.header .title'))
        .find(el => /^upcoming\s+deadlines\s*$/i.test(el.textContent.trim()));
      deadline = heading?.closest('.block, section, .card');
    }
    // Walk to the whole module's sibling boundary, outside any hidden wrappers.
    // This also handles the module being nested within a layout wrapper.
    let anchor = deadline;
    while (anchor && anchor.parentElement !== content) anchor = anchor.parentElement;
    // The live Drupal homepage omits the deadlines block when empty. Keep the
    // panel directly below Current modules in that case, before Returned work.
    if (!anchor) {
      anchor = content.querySelector('#block-views-registered-modules-block-1');
      while (anchor && anchor.parentElement !== content) anchor = anchor.parentElement;
    }
    if (anchor && anchor !== panel) {
      if (anchor.nextElementSibling !== panel) anchor.after(panel);
    } else if (panel.parentElement !== content) {
      content.append(panel);
    }
  }

  mount();
  // Recover when the site inserts/removes the sidebar or replaces its contents.
  // Attribute-only deadline hiding needs no work: this panel is already a sibling.
  const observer = new MutationObserver(mount);
  observer.observe(document.body, { childList:true, subtree:true });

  const origin = location.origin;
  const maxPages = 60;
  let running = false;
  let lastItems = [];
  let lastProblems = [];

  function siteURL(raw, base) {
    try {
      const url = new URL(raw, base);
      if (url.origin !== origin || url.username || url.password) return null;
      url.hash = '';
      return url;
    } catch { return null; }
  }

  function siteTime(text) {
    // The VLE's displayed schedule is interpreted in Asia/Shanghai, never the
    // browser machine's timezone. Preserve the original text in the UI.
    const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text || '');
    if (!match) return null;
    const value = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}+08:00`);
    return Number.isFinite(value) ? value : null;
  }

  function quizzes(doc, base, course) {
    return Array.from(doc.querySelectorAll('#content .node-quiz')).flatMap(node => {
      const link = node.querySelector('h2 a') || node.querySelector('a[href^="/quiz/"]');
      const url = link && siteURL(link.getAttribute('href'), base);
      // Only link to the quiz's landing page, never its start/attempt routes.
      if (!url || !/^\/quiz\/[^/]+\/?$/.test(url.pathname) || url.search) return [];
      const fields = {};
      for (const row of node.querySelectorAll('table tr')) {
        const cells = row.querySelectorAll('th,td');
        if (cells.length >= 2) fields[cells[0].textContent.trim().toLowerCase()] = cells[1].textContent.trim();
      }
      return [{url:url.href, title:link.textContent.trim(), course,
        opens:fields.opens || '', closes:fields.closes || '',
        openAt:siteTime(fields.opens), closeAt:siteTime(fields.closes),
        always:fields.available?.toLowerCase() === 'always',
        closed:/This Quiz is closed\./i.test(node.textContent),
        notYetOpen:/This Quiz is not yet open\./i.test(node.textContent)}];
    });
  }

  function currentCourses(doc, base) {
    const found = new Map();
    for (const a of doc.querySelectorAll('#block-views-registered-modules-block-1 a')) {
      const url = siteURL(a.getAttribute('href'), base);
      if (!url || url.search || /^\/(?:user|quiz)(?:\/|$)/.test(url.pathname)
          || url.pathname === '/' || a.closest('[hidden]')) continue;
      if (!found.has(url.href)) found.set(url.href, {url:url.href, course:a.textContent.trim()});
    }
    return [...found.values()];
  }

  function nextPages(doc, base, home) {
    return Array.from(doc.querySelectorAll('#content .pager a')).flatMap(a => {
      const url = siteURL(a.getAttribute('href'), base);
      if (!url || url.pathname !== new URL(base).pathname && !(home && url.pathname === '/frontpage-alt')) return [];
      // Observed Drupal pager links use only page=N. Do not follow action URLs.
      if ([...url.searchParams.keys()].some(key => key !== 'page')) return [];
      const page = url.searchParams.get('page');
      if (page !== null && !/^\d+$/.test(page)) return [];
      return [url.href];
    });
  }

  async function readPage(url) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 12000);
    try {
      const response = await fetch(url, {method:'GET', credentials:'same-origin',
        redirect:'error', signal:abort.signal});
      if (!response.ok) throw new Error('页面读取失败');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!doc.querySelector('#content') || !doc.querySelector('#block-views-registered-modules-block-1')) {
        throw new Error('无法确认课程页面，可能需要重新登录');
      }
      return doc;
    } finally { clearTimeout(timer); }
  }

  function render() {
    const now = Date.now();
    const visible = lastItems.filter(q => !q.closed && (q.closeAt === null || q.closeAt > now))
      .sort((a,b) => (a.openAt ?? Infinity) - (b.openAt ?? Infinity) || a.title.localeCompare(b.title));
    list.replaceChildren();
    status.textContent = visible.length ? `${visible.length} 个尚未结束的测验`
      : lastProblems.length ? '暂时无法确认测验列表。' : '当前未发现尚未结束的测验。';
    for (const q of visible) {
      const item = document.createElement('li');
      item.className = 'vle-quiz-item';
      const link = document.createElement('a');
      link.href = q.url;
      link.textContent = q.title;
      item.append(link);
      const details = [q.course, q.opens ? `开放：${q.opens}` : '', q.closes ? `关闭：${q.closes}` : '',
        q.always ? '随时可用' : q.openAt !== null && q.openAt > now || q.notYetOpen && q.openAt === null
          ? '尚未开放' : q.openAt !== null && q.closeAt !== null ? '开放中' : '时间或状态未完整提供'];
      for (const text of details.filter(Boolean)) {
        const line = document.createElement('span');
        line.className = 'vle-quiz-meta';
        line.textContent = text;
        item.append(line);
      }
      list.append(item);
    }
    note.textContent = lastProblems.length ? '部分页面未读取成功，列表可能不完整。请稍后刷新。'
      : '仅 Current modules 与 Home；时间按北京时间。';
  }

  async function scan() {
    if (running) return;
    running = true;
    refresh.disabled = true;
    status.textContent = '正在检查测验…';
    const found = new Map();
    const problems = [];
    const queue = [];
    const visited = new Set();
    const courseNames = new Map();
    function collect(doc, base, home, course) {
      for (const q of quizzes(doc, base, course)) {
        const previous = found.get(q.url);
        found.set(q.url, {...q, course:q.course || previous?.course || ''});
      }
      for (const url of nextPages(doc, base, home)) queue.push({url,home,course});
    }
    try {
      const homeURL = `${origin}/`;
      const home = await readPage(homeURL);
      collect(home, homeURL, true, '');
      visited.add(homeURL);
      for (const course of currentCourses(home, homeURL)) {
        courseNames.set(course.url, course.course);
        queue.push({...course,home:false});
      }
      if (!courseNames.size) problems.push('未找到 Current modules');
      while (queue.length && visited.size < maxPages) {
        const entry = queue.shift();
        if (visited.has(entry.url)) continue;
        visited.add(entry.url);
        try { collect(await readPage(entry.url), entry.url, entry.home, entry.course); }
        catch { problems.push(entry.url); }
      }
      if (queue.some(entry => !visited.has(entry.url))) problems.push('分页数量超过上限');
    } catch { problems.push('无法读取 Home'); }
    finally {
      lastItems = [...found.values()];
      lastProblems = problems;
      render();
      running = false;
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', scan);
  // Re-evaluate closing times locally; no recurring background network requests.
  setInterval(() => { if (!running) render(); }, 60000);
  void scan();
})();

