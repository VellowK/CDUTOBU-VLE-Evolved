// Observed Drupal short answers use one single-line field, even when the stem has several blanks.
const VLEShortAnswer = (() => {
  'use strict';
  function inspect(inputs) {
    const input = inputs[0];
    if (inputs.length !== 1 || input.type !== 'text' || input.readOnly || input.disabled
        || !/^question\[\d+\]\[answer\]$/.test(input.name) || input.maxLength === 0) {
      throw new Error('填空控件结构不受支持，请自行作答。');
    }
    const maxLength = Number.isInteger(input.maxLength) && input.maxLength > 0
      ? Math.min(input.maxLength,256) : 256;
    return {input,maxLength,value:input.value};
  }
  function validate(text,maxLength = 256,allowEmpty = false) {
    if (typeof text !== 'string' || text.length > maxLength || text.length > 256
        || /[\u0000-\u001f\u007f]/.test(text) || !allowEmpty && !text.trim()) {
      throw new Error('填空答案为空、过长或包含不支持的控制字符，未填写。');
    }
    return text.trim();
  }
  function matches(field,text) { return field.input.value === text; }
  function apply(field,text,isVisible,isCurrent) {
    const value = validate(text,field.maxLength);
    if (!isCurrent() || !isVisible(field.input) || field.input.readOnly
        || field.input.value !== field.value) throw new Error('填空题或输入内容已变化，未覆盖你的答案。');
    field.input.value = value;
    field.input.dispatchEvent(new Event('input',{bubbles:true}));
    if (!isCurrent() || !matches(field,value)) throw new Error('填空答案未能验证，已停止。');
    field.input.dispatchEvent(new Event('change',{bubbles:true}));
    if (!isCurrent() || !matches(field,value)) throw new Error('填空答案未能验证，已停止。');
  }
  return {inspect,validate,matches,apply};
})();
