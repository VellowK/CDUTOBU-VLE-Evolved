// Drupal's radio group shares a name. Checkboxes use one name per option:
// question[QUESTION_ID][answer][user_answer][OPTION_ID].
const VLEChoices = (() => {
  'use strict';
  function classify(inputs) {
    if (inputs.length < 2 || inputs.length > 20) throw new Error('选项数量或题型不受支持。');
    const types = new Set(inputs.map(input => input.type));
    if (types.size !== 1 || !['radio','checkbox'].includes(inputs[0].type)) {
      throw new Error('混合题型无法确认，未修改答案。');
    }
    const multiple = inputs[0].type === 'checkbox';
    const names = inputs.map(input => /^question\[(\d+)\]\[answer\]\[user_answer\](?:\[(\d+)\])?$/.exec(input.name));
    if (names.some((name,i) => !name || Boolean(name[2]) !== multiple || multiple && name[2] !== inputs[i].value)
        || new Set(names.map(name => name?.[1])).size !== 1
        || new Set(inputs.map(input => input.value)).size !== inputs.length
        || new Set(inputs.map(input => input.name)).size !== (multiple ? inputs.length : 1)) {
      throw new Error('选项分组不完整或属于不同题目，未修改答案。');
    }
    return multiple ? 'multiple' : 'single';
  }
  function matches(options,indices) {
    const selected = new Set(indices);
    return options.every((option,index) => option.input.checked === selected.has(index));
  }
  function apply(options,indices,type,isVisible,isCurrent) {
    if (!Array.isArray(indices) || !indices.length || new Set(indices).size !== indices.length
        || indices.some(index => !Number.isInteger(index) || index < 0 || index >= options.length)
        || !['single','multiple'].includes(type) || type === 'single' && indices.length !== 1) {
      throw new Error('建议答案集合不合法，未修改答案。');
    }
    if (!isCurrent() || options.some(option => !isVisible(option.input))) throw new Error('题目或选项已变化，未填入答案。');
    const desired = new Set(indices);
    const targets = type === 'single' ? [options[indices[0]]] : options;
    for (const option of targets) {
      if (!isCurrent()) throw new Error('题目已变化，已停止选择。');
      const wanted = desired.has(options.indexOf(option));
      if (option.input.checked !== wanted) option.input.click();
    }
    if (!isCurrent() || !matches(options,indices)) throw new Error('完整勾选集合未能验证，请人工核对。');
  }
  return {classify,matches,apply};
})();
