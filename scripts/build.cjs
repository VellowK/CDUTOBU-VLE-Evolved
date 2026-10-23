const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const version = require(path.join(root,'package.json')).version;
const header = `// ==UserScript==
// @name         CDUTOBU VLE Evolved
// @namespace    local.vle.ui
// @version      ${version}
// @description  Current quizzes sidebar and DeepSeek-assisted answering.
// @author       VellowK
// @license      MIT
// @homepageURL  https://github.com/VellowK/CDUTOBU-VLE-Evolved
// @supportURL   https://github.com/VellowK/CDUTOBU-VLE-Evolved/issues
// @downloadURL  https://raw.githubusercontent.com/VellowK/CDUTOBU-VLE-Evolved/main/outputs/CDUTOBU-VLE-Evolved.user.js
// @updateURL    https://raw.githubusercontent.com/VellowK/CDUTOBU-VLE-Evolved/main/outputs/CDUTOBU-VLE-Evolved.user.js
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
const bundle = header+'\n'+sources.join('\n\n');
fs.writeFileSync(path.join(root,'outputs','CDUTOBU-VLE-Evolved.user.js'),bundle,'utf8');
// Keep the old update endpoint so existing installations can discover the rename.
fs.writeFileSync(path.join(root,'outputs','vle-upcoming-quizzes.user.js'),bundle,'utf8');
console.log(`Built outputs/CDUTOBU-VLE-Evolved.user.js (${version})`);
