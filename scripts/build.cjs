const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const header = `// ==UserScript==
// @name         VLE Upcoming Quizzes + DeepSeek
// @namespace    local.vle.ui
// @version      0.3.0
// @description  Current quizzes sidebar and DeepSeek-assisted answering.
// @author       VellowK
// @license      MIT
// @homepageURL  https://github.com/VellowK/CDUTOBU-VLE-Evolved
// @supportURL   https://github.com/VellowK/CDUTOBU-VLE-Evolved/issues
// @downloadURL  https://raw.githubusercontent.com/VellowK/CDUTOBU-VLE-Evolved/main/outputs/vle-upcoming-quizzes.user.js
// @updateURL    https://raw.githubusercontent.com/VellowK/CDUTOBU-VLE-Evolved/main/outputs/vle-upcoming-quizzes.user.js
// @match        https://vle.zycdut.net/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getTab
// @grant        GM_saveTab
// @connect      api.deepseek.com
// @noframes
// ==/UserScript==
`;
const sources=['sidebar.js','deepseek.js','quiz-assistant.js'].map(name =>
  fs.readFileSync(path.join(root,'src',name),'utf8').replace(/^\uFEFF/,''));
fs.writeFileSync(path.join(root,'outputs','vle-upcoming-quizzes.user.js'),header+'\n'+sources.join('\n\n'),'utf8');
console.log('Built outputs/vle-upcoming-quizzes.user.js (0.3.0)');
