const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const source = fs.readFileSync('src/deepseek.js','utf8');
function provider(transport) {
  const context={GM_xmlhttpRequest:transport,URL,JSON,Number,Promise};
  vm.runInNewContext(source+'\n;globalThis.provider=VLEDeepSeek;',context);
  return context.provider;
}
const q={stem:'How many bits in IPv4?',options:[{text:'16',input:{name:'SECRET_FORM_ID'}},{text:'32'}]};
const response = answer => JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]});
const answer={choice_ids:['o2'],confidence:0.97,needs_review:false,reason:'IPv4 has 32 bits.'};

test('fixed official model, image payload and no page/form metadata in prompt',()=>{
  const p=provider();
  const body=p.body(q,['data:image/png;base64,AAAA']);
  assert.equal(p.model,'deepseek-flash');
  assert.equal(p.endpoint,'https://api.deepseek.com/chat/completions');
  assert.equal(body.response_format.type,'json_object');
  assert.equal(body.messages[1].content[1].type,'image_url');
  assert.equal(JSON.stringify(body).includes('SECRET_FORM_ID'),false);
  assert.match(body.messages[0].content,/untrusted data/);
});

test('strict choice mapping and explicit abstention',()=>{
  const p=provider();
  assert.equal(p.parse(response(answer),2).index,1);
  assert.equal(p.parse(response({...answer,choice_ids:[],needs_review:true}),2).index,null);
  for(const invalid of [
    {...answer,choice_ids:['o3']},{...answer,choice_ids:['o0']},{...answer,choice_ids:['o1','o2']},
    {...answer,choice_ids:[]},{...answer,confidence:'0.99'}, {...answer,confidence:1.1},
    {...answer,needs_review:'false'},{...answer,reason:{}},
  ]) assert.throws(()=>p.parse(response(invalid),2));
  assert.throws(()=>p.parse({choices:[{finish_reason:'length',message:{content:'{}'}}]},2),/未完整/);
  assert.throws(()=>p.parse('not json',2));
});

test('multiple-choice prompt and response accept subsets, one or all, but reject duplicates and invalid IDs',()=>{
  const p=provider();
  const question={...q,type:'multiple',options:[{text:'a'},{text:'b'},{text:'c'},{text:'d'}]};
  const input=JSON.parse(p.body(question).messages[1].content);
  assert.equal(input.question_type,'multiple_choice');
  assert.equal(input.instruction,'Choose all that apply');
  for(const ids of [['o2'],['o1','o3'],['o1','o2','o3','o4']]) {
    const parsed=p.parse(response({...answer,choice_ids:ids}),4,'multiple');
    assert.deepEqual(Array.from(parsed.indices),ids.map(id=>Number(id.slice(1))-1));
  }
  for(const ids of [['o2','o2'],['o1','o5'],['o0'],['o01'],[]]) {
    assert.throws(()=>p.parse(response({...answer,choice_ids:ids}),4,'multiple'));
  }
  assert.throws(()=>p.parse(response({...answer,choice_ids:['o1','o3']}),4,'single'));
  assert.equal(p.parse(response({...answer,choice_ids:[],needs_review:true}),4,'multiple').indices.length,0);
});

test('request is credentialless, fixed destination, bounded and cancellable',async()=>{
  let call;
  const p=provider(details=>{call=details;queueMicrotask(()=>details.onload({status:200,finalUrl:details.url,responseText:response(answer)}));return {abort(){}};});
  const result=await p.request('sk-dummy-local-test',p.body(q));
  assert.equal(call.anonymous,true);
  assert.equal(call.redirect,'error');
  assert.equal(call.timeout,65000);
  assert.equal(call.url,p.endpoint);
  assert.equal(p.parse(result,2).index,1);
  const abort = new AbortController(); let aborted=false;
  const hanging=provider(()=>({abort(){aborted=true;}}));
  const task=hanging.request('sk-dummy-local-test',hanging.body(q),abort.signal);
  abort.abort();await assert.rejects(task,/已停止/);assert.equal(aborted,true);
});

test('short-answer payload sends one-field constraints, not DOM names, existing answers or hidden values',()=>{
  const p=provider();
  const payload=p.body({type:'short',stem:'Enter the two terms in order, separated by a comma.',maxLength:32,
    field:{value:'PRIVATE_EXISTING_ANSWER',input:{name:'SECRET_FIELD_NAME'}},secret:'HIDDEN_TOKEN'});
  const content=JSON.parse(payload.messages[1].content);
  assert.equal(content.question_type,'short_answer');
  assert.deepEqual(content.answer_constraints,{field_count:1,single_line:true,max_length:32});
  assert.equal(content.options,undefined);
  for(const secret of ['PRIVATE_EXISTING_ANSWER','SECRET_FIELD_NAME','HIDDEN_TOKEN'])assert.ok(!JSON.stringify(payload).includes(secret));
  assert.throws(()=>p.body({type:'short',stem:'x',maxLength:0}));
});

test('short-answer parsing accepts exact strings and abstention, rejects wrong schema, multiline and overlong output',()=>{
  const p=provider();const value={answer_text:'alpha, beta',confidence:0.96,needs_review:false,reason:'Synthetic explanation.'};
  assert.equal(p.parse(response(value),0,'short',32).text,'alpha, beta');
  assert.equal(p.parse(response({...value,answer_text:'',needs_review:true}),0,'short').text,'');
  for(const invalid of [answer,{...value,answer_text:42},{...value,answer_text:''},
    {...value,answer_text:'x'.repeat(33)},{...value,answer_text:'a\nb'},
    {...value,confidence:'0.99'},{...value,needs_review:'false'},{...value,reason:{}}]) {
    assert.throws(()=>p.parse(response(invalid),0,'short',32));
  }
  assert.throws(()=>p.parse({choices:[{finish_reason:'length',message:{content:'{}'}}]},0,'short'));
});

test('auth/billing/ratelimit/timeout/errors do not expose remote response or API key',async()=>{
  for(const code of [401,402,429,500,503]) {
    const p=provider(d=>{queueMicrotask(()=>d.onload({status:code,responseText:'SECRET-ECHO'}));return {abort(){}};});
    await assert.rejects(p.request('sk-dummy-local-test',p.body(q)),e=>!e.message.includes('SECRET-ECHO'));
  }
  for(const callback of ['ontimeout','onerror','onabort']) {
    const p=provider(d=>{queueMicrotask(()=>d[callback]());return {abort(){}};});
    await assert.rejects(p.request('sk-dummy-local-test',p.body(q)));
  }
  const p=provider(d=>{queueMicrotask(()=>d.onload({status:200,finalUrl:'https://untrusted.example',responseText:response(answer)}));return {abort(){}};});
  await assert.rejects(p.request('sk-dummy-local-test',p.body(q)),/来源异常/);
  await assert.rejects(provider().request('sk-dummy-local-test',p.body(q)),/油猴/);
});
