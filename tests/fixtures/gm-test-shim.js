// LOCAL FIXTURE ONLY. Dummy keys and mocked API; never shipped in the userscript.
(() => {
  const storageKey='vle-local-dummy-gm';
  const read=()=>JSON.parse(sessionStorage.getItem(storageKey)||'{}');
  const write=data=>sessionStorage.setItem(storageKey,JSON.stringify(data));
  window.GM_getValue=(key,fallback)=>read()[key]??fallback;
  window.GM_setValue=(key,value)=>{const data=read();data[key]=value;write(data);};
  window.GM_deleteValue=key=>{const data=read();delete data[key];write(data);};
  window.GM_getTab=callback=>callback(read().tab||{});
  window.GM_saveTab=tab=>{const data=read();data.tab=tab;write(data);};
  window.GM_xmlhttpRequest=options=>{
    const abort=new AbortController();
    fetch('/__mock_deepseek',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({payload:JSON.parse(options.data),providerURL:options.url,
        anonymous:options.anonymous,mode:new URLSearchParams(location.search).get('case')||'normal'}),signal:abort.signal})
      .then(async response=>options.onload({status:response.status,finalUrl:options.url,responseText:await response.text()}))
      .catch(e=>e.name==='AbortError'?options.onabort():options.onerror());
    return {abort:()=>abort.abort()};
  };
})();
