const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const context={};
vm.runInNewContext(fs.readFileSync('src/choices.js','utf8')+'\n;globalThis.choices=VLEChoices;',context);
const choices=context.choices;
function inputs(type,count=4) {
  const values=Array.from({length:count},(_,index)=>({type,name:`question[201][answer][user_answer]${type==='checkbox'?`[${index+1}]`:''}`,
    value:String(index+1),checked:false,clicks:0,click(){this.clicks++;if(type==='radio')values.forEach(v=>v.checked=false);this.checked=!this.checked;}}));
  return values;
}
test('recognizes observed Drupal checkbox names without confusing distinct options for distinct questions',()=>{
  assert.equal(choices.classify(inputs('radio')),'single');
  assert.equal(choices.classify(inputs('checkbox')),'multiple');
  const mixed=inputs('checkbox');mixed[2].name='question[202][answer][user_answer][3]';
  assert.throws(()=>choices.classify(mixed));
  const wrong=inputs('checkbox');wrong[1].name=wrong[0].name;
  assert.throws(()=>choices.classify(wrong));
  const types=inputs('radio');types[1].type='checkbox';
  assert.throws(()=>choices.classify(types));
});
test('multiple answers replace the exact selected set, including clearing pre-existing wrong choices',()=>{
  const radios=inputs('checkbox');radios[0].checked=true;radios[3].checked=true;
  const options=radios.map(input=>({input}));
  choices.apply(options,[1,2],'multiple',()=>true,()=>true);
  assert.deepEqual(radios.map(i=>i.checked),[false,true,true,false]);
  assert.equal(choices.matches(options,[1,2]),true);
  assert.equal(choices.matches(options,[1]),false);
  choices.apply(options,[0,1,2,3],'multiple',()=>true,()=>true);
  assert.ok(radios.every(i=>i.checked));
  choices.apply(options,[2],'multiple',()=>true,()=>true);
  assert.deepEqual(radios.map(i=>i.checked),[false,false,true,false]);
});
test('single-choice behavior remains exclusive; invalid or stale suggestions never touch options',()=>{
  const radios=inputs('radio');const options=radios.map(input=>({input}));
  choices.apply(options,[2],'single',()=>true,()=>true);
  assert.deepEqual(radios.map(i=>i.checked),[false,false,true,false]);
  for(const indices of [[],[0,0],[5],[0,2]])assert.throws(()=>choices.apply(options,indices,'single',()=>true,()=>true));
  const previous=radios.map(i=>i.clicks);
  assert.throws(()=>choices.apply(options,[0],'single',()=>true,()=>false));
  assert.throws(()=>choices.apply(options,[0],'single',()=>false,()=>true));
  assert.deepEqual(radios.map(i=>i.clicks),previous);
});
