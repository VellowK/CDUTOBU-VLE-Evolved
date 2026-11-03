(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('vle-deepseek-assistant')) return;
  const provider = VLEDeepSeek;
  const keyName = 'vle-deepseek-api-key';
  const confidenceFloor = 0.85;
  const supportedImage = /\.(?:png|jpe?g|gif|webp)$/i;
  const highlightClass = 'vle-ai-suggested-option';
  const highlightTableClass = 'vle-ai-suggestion-table';
  const highlightedRows = new Set();
  const highlightedTables = new Set();
  let highlightedFingerprint = '';
  const highlightStyle = document.createElement('style');
  highlightStyle.textContent = `
    #quiz-question-answering-form table.${highlightTableClass} {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
    }
    #quiz-question-answering-form tr.${highlightClass},
    #quiz-question-answering-form tr.${highlightClass} > td,
    #quiz-question-answering-form tr.${highlightClass} > th {
      background-color: #fff3a3 !important;
    }
    #quiz-question-answering-form tr.${highlightClass} > td,
    #quiz-question-answering-form tr.${highlightClass} > th {
      border-inline-color: #fff3a3 !important;
    }`;
  document.head.append(highlightStyle);
  const host = document.createElement('section');
  host.id = 'vle-deepseek-assistant';
  host.className = 'block block-vle-assistant';
  // Keep the password field outside the page's ordinary querySelector tree.
  const ui = host.attachShadow({mode:'closed'});
  ui.innerHTML = `<style>
    :host { display:block; }
    * { box-sizing:border-box; } h2 {margin:0}
    p {margin:8px 0;overflow-wrap:anywhere} button,input{font:inherit}
    button {padding:5px 8px;margin:4px 3px 4px 0;border:1px solid #bbb;background:#fafafa;color:#222;cursor:pointer}
    button:disabled{opacity:.5;cursor:default} button.primary{background:var(--vle-link-color,#555);color:#fff;border-color:var(--vle-link-color,#555)}
    input[type=password]{width:100%;padding:5px;border:1px solid #bbb;background:white;color:#222}
    .small{opacity:.8}.result{white-space:pre-wrap;max-height:300px;overflow:auto}
    details{border-top:1px solid #d6d6d6;margin-top:10px;padding-top:8px}summary{cursor:pointer}
    label{display:block;margin:8px 0}a{color:var(--vle-link-color,inherit);text-decoration:var(--vle-link-decoration,none)} [hidden]{display:none!important}
  </style><h2>DeepSeek 助手</h2>
  <div class="assistant-content">
  <p class="state" role="status" aria-live="polite">正在识别页面…</p>
  <p class="small">点击解答会把本题文字、选项和题图发送给 DeepSeek，按 API 用量计费。</p>
  <div><button class="solve" type="button">解答当前题目</button></div>
  <div><button class="auto primary" type="button">自动答题</button>
    <button class="stop" type="button" disabled>停止</button></div>
  <p class="small">单题解答将建议选项标黄，请自行选择；自动答题会填写并进入下一题，到 Finish 前停止。</p>
  <p class="result"></p>
  <details><summary>API 设置</summary>
    <p class="small">DeepSeek · deepseek-flash（支持题图）</p>
    <label>API Key<input class="key" type="password" autocomplete="off" spellcheck="false" placeholder="粘贴 DeepSeek API Key"></label>
    <button class="save" type="button">保存 Key</button><button class="forget" type="button">清除 Key</button>
    <p class="saved small"></p><p class="small">Key 仅保存到油猴脚本存储，不写入网页存储。只发送至 api.deepseek.com。</p>
    <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">获取 DeepSeek API Key</a>
  </details></div>`;
  const find = s => ui.querySelector(s);
  const state = find('.state');
  const result = find('.result');
  const solveButton = find('.solve');
  const autoButton = find('.auto');
  const stopButton = find('.stop');
  const keyInput = find('.key');
  let busy = false;
  let controller;
  let generation = 0;
  let suggestion = null;
  let tabData = {};
  let run = {enabled:false};
  let lastFingerprint = '';
  let nextCheckTimer;
  const gmAvailable = typeof GM_getValue === 'function' && typeof GM_setValue === 'function'
    && typeof GM_deleteValue === 'function' && typeof GM_xmlhttpRequest === 'function';
  const canContinue = typeof GM_getTab === 'function' && typeof GM_saveTab === 'function';
  const ready = new Promise(resolve => {
    if (!canContinue) return resolve();
    GM_getTab(data => { tabData = data || {}; run = tabData.vleQuizAI || {enabled:false}; resolve(); });
  });

  function putRun(next) {
    run = next;
    tabData.vleQuizAI = run;
    if (canContinue) GM_saveTab(tabData);
  }
  function getKey() { return gmAvailable ? GM_getValue(keyName,'') : ''; }
  function keyState() { find('.saved').textContent = getKey() ? '已保存 API Key（不回显）。' : '尚未配置 API Key。'; }
  function quizPath() { return location.pathname.match(/^\/node\/\d+\/take(?:\/\d+)?\/?$/)?.[0].match(/^\/node\/\d+\/take/)?.[0] || ''; }
  function shown(el) { return !!el && !el.disabled && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'; }

  function clearHighlights() {
    for (const row of highlightedRows) row.classList.remove(highlightClass);
    for (const table of highlightedTables) table.classList.remove(highlightTableClass);
    highlightedRows.clear();
    highlightedTables.clear();
    highlightedFingerprint = '';
  }

  function highlightSuggestion(q, indices) {
    clearHighlights();
    for (const index of indices) {
      const row = q.options[index].input.closest('tr');
      row.classList.add(highlightClass);
      highlightedRows.add(row);
      const table = row.closest('table');
      table.classList.add(highlightTableClass);
      highlightedTables.add(table);
    }
    if (highlightedRows.size) highlightedFingerprint = q.fingerprint;
  }

  function mountAI() {
    const panel = document.getElementById('vle-upcoming-quizzes-skeleton');
    if (panel?.parentElement) {
      if (panel.nextElementSibling !== host) panel.after(host);
    } else {
      const region = document.querySelector('#sidebar-first .region-sidebar-first');
      if (region && host.parentElement !== region) region.append(host);
    }
    syncNativeStyle();
  }

  function syncNativeStyle() {
    const reference = document.querySelector('#block-views-registered-modules-block-1');
    if (!reference) return;
    const typography = ['font-family','font-size','font-weight','font-style','line-height','color'];
    const copy = (target,source,properties) => {
      if (!source) return;
      const computed = getComputedStyle(source);
      for (const property of properties) {
        const value = computed.getPropertyValue(property);
        if (target.style.getPropertyValue(property) !== value) target.style.setProperty(property,value);
      }
    };
    copy(host,reference,typography);
    copy(find('h2'),reference.querySelector('h2'),[...typography,'padding','margin','border-bottom']);
    copy(find('.assistant-content'),reference.querySelector('.content'),[...typography,'padding','margin']);
    const link = reference.querySelector('.content a');
    if (link) {
      const computed = getComputedStyle(link);
      host.style.setProperty('--vle-link-color',computed.color);
      host.style.setProperty('--vle-link-decoration',computed.textDecorationLine);
    }
  }

  function question() {
    const form = document.querySelector('#quiz-question-answering-form');
    if (!form || !shown(form)) throw new Error('请由你打开 Quiz 并开始尝试，助手不会自动开始测验。');
    const inputs = [...form.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(shown);
    const type = VLEChoices.classify(inputs);
    const options = inputs.map(input => {
      const row = input.closest('tr');
      const text = row?.innerText.trim();
      if (!row || !text) throw new Error('选项结构不完整，未修改答案。');
      return {input,text,checked:input.checked};
    });
    const stem = [...form.querySelectorAll('p')].filter(p => !p.closest('tr') && shown(p))
      .map(p => p.innerText.trim()).filter(Boolean).join('\n');
    if (!stem || stem.length > 20000 || options.some(o => o.text.length > 6000)) {
      throw new Error('题干为空或过长，已停止。');
    }
    const images = new Set();
    const addImage = raw => {
      if (!raw) throw new Error('题图地址缺失，已停止。');
      if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(raw)) {
        if (raw.length > 6 * 1024 * 1024) throw new Error('题图过大，请手动查看。');
        images.add(raw); return;
      }
      const url = new URL(raw,location.href);
      if (url.origin !== location.origin || url.search || url.username || url.password || !supportedImage.test(url.pathname)) {
        throw new Error('题图为外站、带查询参数或格式不支持，请手动查看。');
      }
      url.hash = '';
      images.add(url.href);
    };
    for (const img of form.querySelectorAll('img')) {
      const raw = img.getAttribute('src');
      if (raw?.includes('/modules/file/icons/')) continue;
      if (shown(img)) addImage(raw);
    }
    for (const a of form.querySelectorAll('a[href]')) {
      const raw = a.getAttribute('href');
      const url = new URL(raw,location.href);
      if (supportedImage.test(url.pathname)) addImage(raw);
      else if (a.closest('.file') || /\.(pdf|docx?|svg|pptx?)$/i.test(url.pathname)) {
        throw new Error('本题含不支持的附件，请手动查看后作答。');
      }
    }
    if (form.querySelector('svg,canvas') || images.size > 4) throw new Error('题图数量或格式超出当前支持范围。');
    const progress = document.querySelector('#quiz-progress')?.textContent.trim() || '';
    const fingerprint = JSON.stringify({path:quizPath(),progress,type,stem,options:options.map(o => [o.input.name,o.input.value,o.text]),images:[...images]});
    return {form,stem,type,options,images:[...images],progress,fingerprint};
  }

  function buttons() {
    let current = false;
    try { question(); current = true; } catch {}
    solveButton.disabled = busy || run.enabled || !gmAvailable || !current;
    autoButton.disabled = busy || run.enabled || !gmAvailable || !canContinue || !current;
    autoButton.textContent = run.enabled ? '自动答题中…' : '自动答题';
    stopButton.disabled = !busy && !run.enabled;
  }

  function halt(message) {
    generation++;
    controller?.abort();
    controller = null;
    busy = false;
    clearTimeout(nextCheckTimer);
    putRun({enabled:false});
    if (message) state.textContent = message;
    buttons();
  }

  async function imageData(url, signal) {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url,{method:'GET',credentials:'same-origin',redirect:'error',signal});
    if (!response.ok) throw new Error('无法读取题图，未向模型发送不完整题目。');
    const blob = await response.blob();
    if (!/^image\/(png|jpeg|gif|webp)$/i.test(blob.type) || blob.size > 4 * 1024 * 1024) {
      throw new Error('题图格式不支持或超过 4MB。');
    }
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('题图读取失败。'));
      reader.readAsDataURL(blob);
    });
  }

  function applyAnswer(item) {
    if (!item || !item.answer.indices.length) throw new Error('没有可采用的答案。');
    if (item.answer.needsReview || item.answer.confidence < confidenceFloor) {
      throw new Error('这道题需要先人工核对。');
    }
    const current = question();
    if (current.fingerprint !== item.question.fingerprint) throw new Error('题目已变化，未填入旧答案。');
    VLEChoices.apply(current.options,item.answer.indices,current.type,shown,
      () => question().fingerprint === current.fingerprint);
  }

  async function nextQuestion(item) {
    const current = question();
    if (current.fingerprint !== item.question.fingerprint) throw new Error('题目已变化，未自动翻页。');
    if (!VLEChoices.matches(current.options,item.answer.indices)) throw new Error('勾选集合已变化，未自动翻页。');
    const next = current.form.querySelector('#edit-navigation-submit');
    if (!shown(next)) throw new Error('未识别到可见的下一题按钮。');
    if (next.value?.trim().toLowerCase() !== 'next') {
      halt('已填入最后一题，请核对后由你点击 Finish 正式提交。');
      return;
    }
    const steps = (run.steps || 0) + 1;
    if (steps >= 100) { halt('已达到连续处理上限，请人工核对。'); return; }
    putRun({...run,enabled:true,steps,lastFingerprint:current.fingerprint,phase:'navigating'});
    state.textContent = '已填写，正在进入下一题…';
    buttons();
    next.click();
    // Full navigation resumes from the per-tab userscript state. For AJAX navigation,
    // wait for a genuinely new question and never repeat a failed Next submission.
    const started = Date.now();
    const wait = () => {
      if (!run.enabled) return;
      try {
        const q = question();
        if (q.fingerprint !== current.fingerprint) { void solve(true); return; }
      } catch {}
      if (Date.now()-started > 10000) { halt('页面没有进入下一题，已停止，请检查是否需要手动继续。'); return; }
      nextCheckTimer = setTimeout(wait,400);
    };
    nextCheckTimer = setTimeout(wait,400);
  }

  async function solve(automatic = false) {
    await ready;
    if (busy || automatic && !run.enabled) return;
    clearHighlights();
    let timer;
    const token = ++generation;
    try {
      const q = question();
      const key = getKey();
      if (!key) { find('details').open = true; throw new Error('请先填写并保存 DeepSeek API Key。'); }
      if (automatic && (run.quizPath !== quizPath() || run.lastFingerprint === q.fingerprint)) {
        throw new Error('测验或题目状态未变化，未重复自动作答。');
      }
      if (automatic) putRun({...run,phase:'solving'});
      busy = true;
      suggestion = null;
      result.textContent = '';
      controller = new AbortController();
      timer = setTimeout(() => controller?.abort(),65000);
      buttons();
      state.textContent = `${automatic ? '自动答题 · ' : ''}${q.progress || '当前题'}：正在请求 DeepSeek…`;
      const images = [];
      for (const url of q.images) images.push(await imageData(url,controller.signal));
      if (images.reduce((sum,s) => sum+s.length,0) > 12 * 1024 * 1024) throw new Error('题图总大小超限，请手动查看。');
      const response = await provider.request(key,provider.body(q,images),controller.signal);
      if (token !== generation) return;
      const current = question();
      if (current.fingerprint !== q.fingerprint) throw new Error('题目已变化，已丢弃旧回答。');
      if (current.options.some((o,i) => o.checked !== q.options[i].checked)) throw new Error('检测到你手动修改了选项，未覆盖你的选择。');
      const answer = provider.parse(response,q.options.length,q.type);
      suggestion = {question:q,answer};
      if (!automatic) highlightSuggestion(current,answer.indices);
      const review = answer.needsReview || answer.confidence < confidenceFloor || !answer.indices.length;
      result.textContent = `${!answer.indices.length ? '未给出确定答案' : (q.type === 'multiple' ? '建议（多选）：\n' : '建议：')+answer.indices.map(index => q.options[index].text).join('\n')}\n置信度：${Math.round(answer.confidence*100)}%\n${answer.reason}`;
      state.textContent = review ? '需要人工核对，请在题目中自行选择；未自动填写或翻页。'
        : automatic ? '正在填写建议答案…' : '建议选项已标黄，请在题目中自行选择。';
      if (automatic) {
        if (review) { halt('已暂停：这道题需要人工核对。'); return; }
        applyAnswer(suggestion);
        busy = false;
        buttons();
        await nextQuestion(suggestion);
      }
    } catch (error) {
      if (token === generation) halt(error.message || '解答失败，已停止。');
    } finally {
      clearTimeout(timer);
      if (token === generation) { busy = false; controller = null; buttons(); }
    }
  }

  solveButton.addEventListener('click',() => { if (run.enabled) halt(); void solve(false); });
  autoButton.addEventListener('click',async () => {
    await ready;
    if (busy || run.enabled) return;
    if (!quizPath()) { state.textContent = '未识别到本次测验路径，不能连续解答。'; return; }
    putRun({enabled:true,quizPath:quizPath(),steps:0,lastFingerprint:'',phase:'solving'});
    buttons();
    void solve(true);
  });
  stopButton.addEventListener('click',() => halt('已停止，未继续翻页或提交。'));
  find('.save').addEventListener('click',() => {
    if (!gmAvailable) { state.textContent = '请通过油猴安装脚本。'; return; }
    const key = keyInput.value.trim();
    if (key.length < 12 || key.length > 256 || /\s/.test(key)) { state.textContent = 'API Key 格式不正确。'; return; }
    halt();
    GM_setValue(keyName,key);
    keyInput.value = '';
    keyState();
    state.textContent = 'API Key 已保存。可解答当前题目或开启自动答题。';
  });
  find('.forget').addEventListener('click',() => {
    halt();
    if (gmAvailable) GM_deleteValue(keyName);
    keyInput.value = '';
    keyState();
    state.textContent = 'API Key 已清除。';
  });

  function pageChanged() {
    mountAI();
    let q;
    try { q = question(); }
    catch (error) {
      clearHighlights();
      // AJAX may remove the old form before inserting the next one. The navigation
      // waiter owns this transition and its timeout; do not halt in the gap.
      if (run.enabled && run.phase === 'navigating') { buttons(); return; }
      if (run.enabled || busy) halt(error.message);
      else if (!suggestion) state.textContent = document.querySelector('#quiz-question-answering-form')
        ? error.message : '在 Quiz 答题页可解答当前题。';
      buttons(); return;
    }
    if (highlightedFingerprint && highlightedFingerprint !== q.fingerprint) clearHighlights();
    if (lastFingerprint && lastFingerprint !== q.fingerprint && !busy) {
      suggestion = null; result.textContent = '';
      state.textContent = '题目已变化，请重新解答。';
    }
    lastFingerprint = q.fingerprint;
    if (state.textContent === '正在识别页面…' || /^已识别[单多]选题/.test(state.textContent)) {
      const kind = q.type === 'multiple' ? '多选' : '单选';
      state.textContent = getKey() ? `已识别${kind}题，可解答。` : `已识别${kind}题，请先配置 API Key。`;
    }
    buttons();
  }
  // Shadow UI updates do not trigger this observer; timer ticks do not initiate API calls.
  const observer = new MutationObserver(pageChanged);
  observer.observe(document.body,{childList:true,subtree:true});
  mountAI(); keyState(); pageChanged();
  void ready.then(() => {
    if (!gmAvailable) { state.textContent = '请在油猴中安装此脚本后配置 API Key。'; buttons(); return; }
    if (run.enabled) {
      if (run.quizPath !== quizPath()) halt('已离开本次测验，连续解答停止。');
      else void solve(true);
    }
  });
})();
