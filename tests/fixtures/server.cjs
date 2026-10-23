const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('outputs');
let scenario = 'normal';
const requests = [];
const mockCalls = [];
const quiz = (title,slug,open,close,closed=false) => `<div class="node node-quiz"><h2><a href="/quiz/${slug}">${title}</a></h2><table><tr><th>Opens</th><td>${open}</td></tr><tr><th>Closes</th><td>${close}</td></tr></table>${closed?'This Quiz is closed.':''}</div>`;
const upcomingA = quiz('示例 A（测试数据）','test-a','2099-10-23 13:30','2099-10-23 14:00');
const upcomingB = quiz('示例 B（测试数据）','test-b','2099-11-03 13:15','2099-11-03 13:25');
const closed = quiz('已关闭示例（测试数据）','closed','2000-10-23 13:30','2000-10-23 14:00',true);
function page(content, script=false) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>VLE 侧栏本地测试</title><style>
  body{margin:0;background:white;color:#000;font:14px/21px Georgia,"Times New Roman",serif}header{background:#8d0000;color:white;padding:22px;font:20px Georgia}main{display:flex;gap:32px;padding:25px;max-width:1050px;margin:auto}#sidebar-first{width:210px;flex-shrink:0}.block{background:#eee;border:1px solid #ddd;margin:0 0 20px;padding:15px 20px}.block .content{font-size:.914em;line-height:1.4;margin-top:10px}.more-link{text-align:right}h2{font:1.071em/1.2 Georgia;margin:0 0 .5em;padding:0 0 5px;border-bottom:1px solid #d6d6d6}a{color:#ba0000;text-decoration:none}a:hover{text-decoration:underline}#content{flex:1}button{cursor:pointer}#content .node-quiz{margin:20px 0;padding:10px;border:1px solid #ddd}
  </style><header>VLE · 本地验证 / 全部为合成数据</header><main><aside id="sidebar-first"><div class="section"><div class="region region-sidebar-first">
  <div class="block" id="block-views-registered-modules-block-1"><h2>Current modules</h2><div class="content"><ul><li><a href="/course/network">Network（测试课程）</a></li><li><a href="/course/fcs">FCS（测试课程）</a></li></ul><div class="more-link"><a href="/user/test/modules">All modules</a></div></div></div>
  ${scenario==='absent'?'':'<div class="deadline-wrapper" '+(scenario==='hidden'?'hidden':'')+'><div class="block" id="test-deadline"><h2>Upcoming deadlines</h2><div class="content">示例模块</div></div></div>'}
  <div class="block"><h2>Returned work</h2><div class="content">原模块保留</div></div>
  </div></div></aside><div id="content"><h1>侧栏检测测试</h1><p>当前场景：${scenario}。以下列表均为测试数据，不连接真实 VLE。</p>
  <button id="hide-ddl" type="button">隐藏 deadlines</button><button id="remove-ddl" type="button">移除 deadlines</button><button id="restore-ddl" type="button">恢复 deadlines</button>
  ${content}</div></main>${script?`<script src="/vle-upcoming-quizzes.user.js"></script><script>
  const wrapper=document.querySelector('.deadline-wrapper');const region=document.querySelector('.region-sidebar-first');
  document.querySelector('#hide-ddl').onclick=()=>{if(wrapper)wrapper.hidden=true;};
  document.querySelector('#remove-ddl').onclick=()=>{if(wrapper)wrapper.remove();};
  document.querySelector('#restore-ddl').onclick=()=>{if(wrapper){wrapper.hidden=false;region.querySelector('#block-views-registered-modules-block-1').after(wrapper);}};
  </script>`:''}</html>`;
}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:8765');
  if(url.searchParams.has('scenario')) scenario=url.searchParams.get('scenario');
  if(url.pathname==='/vle-upcoming-quizzes.user.js') {res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(root,'vle-upcoming-quizzes.user.js'),'utf8').replace("mode:'closed'","mode:'open'"));}
  if(url.pathname==='/gm-test-shim.js') {res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(__dirname,'gm-test-shim.js')));}
  if(url.pathname==='/fixtures/test.png') {res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64'));}
  if(url.pathname==='/__mock_deepseek') {
    let raw='';req.on('data',data=>raw+=data);req.on('end',()=>{
      const call=JSON.parse(raw);mockCalls.push(call);
      const review=call.mode==='review';
      const choice=call.payload.messages[1].content?.includes?.('connect')?'o1':'o2';
      const answer={choice_ids:review?[]:[call.mode==='invalid'?'o99':choice],confidence:review?0.2:call.mode==='low'?0.6:0.98,needs_review:review,reason:review?'题干包含无效的十进制数字，需要人工核对。':'模拟模型回答，仅用于本地测试。'};
      if(call.mode==='auth')res.statusCode=401;
      res.setHeader('Content-Type','application/json');
      const send=()=>res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]}));
      if(call.mode==='slow')setTimeout(send,2200);else send();
    });return;
  }
  if(url.pathname==='/__mock_audit') {res.setHeader('Content-Type','text/plain');return res.end(JSON.stringify(mockCalls));}
  if(url.pathname==='/node/1/take') {
    const caseName=url.searchParams.get('case')||'normal';
    const second=url.searchParams.get('p')==='2';
    const stem=caseName==='review'?'What is 25E base 10 in hexadecimal?':second?'Which device connects different networks?':'How many bits does an IPv4 address contain?';
    const choices=second?['Router','Switch']:['16','32','64','128'];
    const type=caseName==='unsupported'?'checkbox':'radio';
    const content=`<p id="case-marker">AI 场景：${caseName}</p><div id="quiz-progress">Page ${second?2:1} of 2</div><div class="countdown">Time left: 00:10:00</div>
      <form id="quiz-question-answering-form" method="get" action="/node/1/take">
      <h2>Question ${second?2:1}</h2><p class="stem">${stem}</p>
      ${caseName==='image'?'<span class="file"><a href="/fixtures/test.png">Synthetic image.png</a></span>':''}
      <input type="hidden" name="p" value="2"><input type="hidden" name="case" value="${caseName}">
      <input type="hidden" name="dummy-token" value="MUST_NOT_SEND_THIS">
      <table>${choices.map((text,index)=>`<tr class="multichoice-row"><td><input type="${type}" class="form-radio" name="question[${second?202:201}][answer][user_answer]" value="${index+1}" id="option-${index+1}"></td><td><p>${text}</p></td></tr>`).join('')}</table>
      <input type="submit" hidden id="edit-navigation-submit-hidden" value="Next">
      <input type="${second?'button':'submit'}" id="edit-navigation-submit" value="${second?'Finish':'Next'}" ${second?'onclick="document.querySelector(\'.finish-count\').textContent=\'FINISH CLICKED\'"':''}>
      <p class="finish-count"></p></form><button type="button" onclick="document.querySelector('.stem').textContent='Changed question; do not fill old answer'">切换测试题</button>
      <p>GM 接口和模型均为本地模拟，测试 Key 为虚构值。未向 DeepSeek 发送任何数据。</p>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.end(page(content,false).replace('</html>','<script src="/gm-test-shim.js"></script><script src="/vle-upcoming-quizzes.user.js"></script></html>'));
  }
  if(url.pathname==='/__audit') {res.setHeader('Content-Type','text/plain');return res.end(JSON.stringify(requests));}
  if(url.pathname.startsWith('/quiz/')) {res.statusCode=400;return res.end('Quiz landing pages must not be fetched by the scanner');}
  requests.push(url.pathname+url.search);
  console.log('READ',url.pathname+url.search);
  if(url.pathname.startsWith('/user/')) {res.statusCode=400;return res.end('Archived modules must not be fetched');}
  if(url.pathname==='/course/fcs'&&scenario==='failure') {res.statusCode=503;return res.end('Synthetic failure');}
  let content='';
  if(scenario!=='empty') {
    if(url.pathname==='/') content=upcomingB+'<ul class="pager"><li><a href="/frontpage-alt?page=1">next ›</a></li></ul>';
    if(url.pathname==='/frontpage-alt') content=upcomingA;
    if(url.pathname==='/course/network') content=closed+quiz('时间过期但没有 closed 文本','expired','2000-01-01 10:00','2000-01-01 11:00');
    if(url.pathname==='/course/fcs') content=upcomingB+'<ul class="pager"><li><a href="/course/fcs?page=1">next ›</a></li></ul>';
    if(url.pathname==='/course/fcs'&&url.searchParams.get('page')==='1') content=closed;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(page(content,true));
});
server.listen(8765,'127.0.0.1',()=>console.log('Preview ready: http://127.0.0.1:8765/'));
