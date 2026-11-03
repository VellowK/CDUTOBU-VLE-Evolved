const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const context={Event};
vm.runInNewContext(fs.readFileSync('src/short-answer.js','utf8')+'\n;globalThis.short=VLEShortAnswer;',context);
const short=context.short;
function input(overrides={}) {
  return {type:'text',name:'question[301][answer]',maxLength:256,value:'',readOnly:false,disabled:false,
    events:[],dispatchEvent(event){this.events.push(event.type);},...overrides};
}
test('recognizes one observed short-answer field, enforces length and rejects unsupported groups',()=>{
  assert.equal(short.inspect([input()]).maxLength,256);
  assert.equal(short.inspect([input({maxLength:12})]).maxLength,12);
  assert.equal(short.inspect([input({maxLength:-1})]).maxLength,256);
  for(const fields of [[],[input(),input()],...[{type:'textarea'},{type:'password'},{readOnly:true},
    {disabled:true},{maxLength:0},{name:'question[301][answer][user_answer]'}].map(value=>[input(value)])]) {
    assert.throws(()=>short.inspect(fields));
  }
});
test('fills exact plain text, preserves punctuation and emits native input/change events',()=>{
  const control=input();const field=short.inspect([control]);
  short.apply(field,'alpha, beta',()=>true,()=>true);
  assert.equal(control.value,'alpha, beta');assert.deepEqual(control.events,['input','change']);
  assert.equal(short.matches(field,'alpha, beta'),true);
  assert.equal(short.matches(field,'alpha'),false);
  for(const answer of ['', 'x'.repeat(257), 'one\ntwo', 'one\ttwo', 42]) assert.throws(()=>short.validate(answer));
  assert.throws(()=>short.validate('long',3));
  assert.equal(short.validate('  x < y  '),'x < y');
});
test('does not overwrite changed, readonly, hidden or stale inputs; refuses a site-rewritten value',()=>{
  for(const scenario of ['changed','readonly','hidden','stale']) {
    const control=input();const field=short.inspect([control]);
    if(scenario==='changed')control.value='my answer';
    if(scenario==='readonly')control.readOnly=true;
    assert.throws(()=>short.apply(field,'new answer',()=>scenario!=='hidden',()=>scenario!=='stale'));
    assert.equal(control.value,scenario==='changed'?'my answer':'');assert.deepEqual(control.events,[]);
  }
  const control=input({dispatchEvent(event){this.events.push(event.type);this.value='rewritten';}});
  assert.throws(()=>short.apply(short.inspect([control]),'expected',()=>true,()=>true),/未能验证/);
  assert.deepEqual(control.events,['input']);
});
