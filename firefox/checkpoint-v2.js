(function(root) {
  'use strict';
  const columns = Object.freeze({A:'imageName',B:'endImageName',C:'clipName',D:'prompt',E:'mode',F:'seconds',G:'videoType'});
  const inputFields = new Set(Object.values(columns));
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  function split(row) {
    const input={}, runtime={};
    for(const [col,key] of Object.entries(columns)) if(own(row,key)) input[col]=row[key];
    for(const [key,value] of Object.entries(row)) if(!inputFields.has(key)) runtime[key]=value;
    return {input,runtime};
  }
  function pack(rows) {
    const cells={}, runtime={};
    rows.forEach((row,i)=>{
      const parts=split(row);
      for(const [col,value] of Object.entries(parts.input)) cells[col+(i+1)]=value;
      runtime[String(i+1)]=parts.runtime;
    });
    return {sheet:{columns,rowCount:rows.length,cells},runtime};
  }
  function unpack(record) {
    const sheet=record.sheet;
    if(!sheet || !Number.isInteger(sheet.rowCount) || sheet.rowCount<0 || sheet.rowCount>500 || !sheet.cells || typeof sheet.cells!=='object' || Array.isArray(sheet.cells)) throw Error('单元格字典结构无效');
    if(JSON.stringify(sheet.columns)!==JSON.stringify(columns)) throw Error('单元格列定义不兼容');
    const rows=Array.from({length:sheet.rowCount},(_,i)=>({...record.runtime?.[String(i+1)]}));
    for(const [address,value] of Object.entries(sheet.cells)) {
      const m=/^([A-G])([1-9]\d*)$/.exec(address);
      if(!m || Number(m[2])>sheet.rowCount || !['string','number','boolean'].includes(typeof value) && value!==null) throw Error('无效单元格：'+address);
      rows[Number(m[2])-1][columns[m[1]]]=value;
    }
    return rows;
  }
  // Input and runtime have separate IndexedDB records. Unchanged input strings
  // are never JSON-encoded again for a status-only update.
  function createStore(dbName='flow-batch-checkpoint-v2') {
    let dbPromise, chain=Promise.resolve(), initialized=false;
    const cache=new Map();
    const metrics={transactions:0,inputWrites:0,runtimeWrites:0,metadataWrites:0,errors:0};
    function db(){return dbPromise ||= new Promise((resolve,reject)=>{
      const req=indexedDB.open(dbName,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('records');
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>{dbPromise=null;reject(req.error);};
    });}
    function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
    async function readAll(){const d=await db();return request(d.transaction('records').objectStore('records').get('pages'));}
    async function load(){
      const d=await db(), pages=await readAll();
      if(!pages)return null;
      initialized=true;
      const result={};
      for(const page of pages){
        const tx=d.transaction('records'), st=tx.objectStore('records');
        const meta=await request(st.get([page,'meta']));
        if(!meta)continue;
        const entries=await Promise.all(meta.map((_,i)=>Promise.all([
          request(d.transaction('records').objectStore('records').get([page,'input',i])),
          request(d.transaction('records').objectStore('records').get([page,'runtime',i]))
        ])));
        result[page]=entries.map(([input,runtime])=>{const row={...runtime};for(const [col,v] of Object.entries(input||{}))row[columns[col]]=v;return row;});
        cache.set(page,result[page].map(row=>{const p=split(row);return {row,input:p.input,runtime:JSON.stringify(p.runtime)};}));
      }
      return result;
    }
    async function commit(pages){
      const d=await db(), writes=[], nextCache=new Map();
      for(const [page,rows] of Object.entries(pages)){
        const old=cache.get(page)||[], next=[];
        rows.forEach((row,i)=>{
          const previous=old[i];
          if(previous?.row===row){next.push(previous);return;}
          const p=split(row);
          const inputChanged=!previous || Object.keys(p.input).length!==Object.keys(previous.input).length || Object.entries(p.input).some(([k,v])=>previous.input[k]!==v);
          const runtimeText=JSON.stringify(p.runtime);
          if(inputChanged)writes.push({key:[page,'input',i],value:p.input,type:'inputWrites'});
          if(!previous || previous.runtime!==runtimeText)writes.push({key:[page,'runtime',i],value:p.runtime,type:'runtimeWrites'});
          next.push({row,input:inputChanged?p.input:previous.input,runtime:runtimeText});
        });
        if(old.length!==rows.length || !cache.has(page))writes.push({key:[page,'meta'],value:rows.map(r=>r.id||''),type:'metadataWrites'});
        for(let i=rows.length;i<old.length;i++)for(const kind of ['input','runtime'])writes.push({key:[page,kind,i],remove:true});
        nextCache.set(page,next);
      }
      const names=Object.keys(pages),oldNames=[...cache.keys()];
      if(!initialized || JSON.stringify(names)!==JSON.stringify(oldNames))writes.push({key:'pages',value:names,type:'metadataWrites'});
      for(const page of oldNames)if(!own(pages,page)){
        writes.push({key:[page,'meta'],remove:true});
        cache.get(page).forEach((_,i)=>{for(const kind of ['input','runtime'])writes.push({key:[page,kind,i],remove:true});});
      }
      if(!writes.length)return;
      await new Promise((resolve,reject)=>{
        const tx=d.transaction('records','readwrite'),st=tx.objectStore('records');
        for(const w of writes)w.remove?st.delete(w.key):st.put(w.value,w.key);
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('断点事务中断'));
      });
      initialized=true;cache.clear();for(const [k,v] of nextCache)cache.set(k,v);
      metrics.transactions++;for(const w of writes)if(w.type)metrics[w.type]++;
    }
    function save(pages){
      // Callers use immutable row replacement. Capture lists to freeze row order.
      const snapshot=Object.fromEntries(Object.entries(pages).map(([k,v])=>[k,v.slice()]));
      const task=chain.catch(()=>{}).then(()=>commit(snapshot));
      chain=task;task.catch(()=>metrics.errors++);return task;
    }
    return {load,save,metrics,flush:()=>chain};
  }
  const api={columns,pack,unpack,split,createStore};
  if(typeof module!=='undefined')module.exports=api;
  else root.__flowBatchCheckpointV2=Object.freeze({...api,store:createStore()});
})(typeof window==='undefined'?globalThis:window);
