const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const{fetchAllCatalogRows}=require('../dist/catalog-context');
const{handleCatalogEvent}=require('../dist/catalog-events');
const{OrderedLines,KeyedTasks}=require('../dist/ordered-lines');
test('catalog pagination includes rows beyond the first1000 with no broadened fallback',async()=>{
 const data=Array.from({length:2501},(_,id)=>({id}));const calls=[];
 const all=await fetchAllCatalogRows((from,to)=>{calls.push([from,to]);return Promise.resolve({data:data.slice(from,to+1),error:null})});
 assert.equal(all.length,2501);assert.equal(all[2500].id,2500);assert.deepEqual(calls,[[0,999],[1000,1999],[2000,2999]]);
 await assert.rejects(fetchAllCatalogRows(()=>Promise.resolve({data:null,error:{message:'offline'}})),/offline/);
});
test('URL check events preserve discovery progress without entering price ingestion',async()=>{
 const calls=[];const rpc={rpc:async(name,args)=>{calls.push({name,args});return{error:null}}};
 assert.equal(await handleCatalogEvent({name:'Product',competitor_price:100},true,'s',rpc),false);
 assert.equal(await handleCatalogEvent({type:'lampan_url_checks',urls:['https://lampan.se/p/a/','https://lampan.se/p/a/']},true,'trusted-scraper',rpc),true);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'record_competitor_url_checks');assert.equal(calls[0].args.p_scraper_id,'trusted-scraper');assert.deepEqual(calls[0].args.p_urls,['https://lampan.se/p/a/']);
 await assert.rejects(handleCatalogEvent({type:'lampan_url_checks',urls:['https://other.test/p/a/']},true,'s',rpc),/Invalid/);
 await assert.rejects(handleCatalogEvent({type:'lampan_url_checks',urls:['https://lampan.se/p/a/']},false,'s',rpc),/Unexpected/);
});
test('context launcher handles a large catalog and paths with spaces without shell expansion',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'catalog context '));const fixture=path.join(dir,'scraper test.js'),context=path.join(dir,'context file.base64');
 try{
  const data={products:Array.from({length:33000},(_,id)=>({id,sku:'part-'+id})),literal:'$(not-a-command);`literal`'};
  fs.writeFileSync(context,Buffer.from(JSON.stringify(data)).toString('base64'));
  fs.writeFileSync(fixture,"const c=JSON.parse(Buffer.from(process.argv[4],'base64').toString());console.log(JSON.stringify({count:c.products.length,literal:c.literal,isMain:require.main===module,command:process.argv[2]}));");
  const result=spawnSync(process.execPath,[path.resolve(__dirname,'../dist/context-launcher.js'),fixture,context],{encoding:'utf8',shell:false,timeout:10000});
  assert.equal(result.status,0,result.stderr);const actual=JSON.parse(result.stdout);assert.equal(actual.count,33000);assert.equal(actual.literal,data.literal);assert.equal(actual.isMain,true);assert.equal(actual.command,'scrape');
 }finally{fs.unlinkSync(fixture);fs.unlinkSync(context);fs.rmdirSync(dir);}
});
test('split UTF8/log chunks and asynchronous updates finish in order before completion',async()=>{
 const actual=[];const reader=new OrderedLines(async line=>{await new Promise(resolve=>setTimeout(resolve,line.startsWith('första')?15:1));actual.push(line)});
 const bytes=Buffer.from('första Ö\nandra\nslutrapport');
 const split=bytes.indexOf(Buffer.from('Ö'))+1;
 const first=reader.push(bytes.subarray(0,split));const second=reader.push(bytes.subarray(split));
 await reader.finish();await Promise.all([first,second]);assert.deepEqual(actual,['första Ö','andra','slutrapport']);
});
test('overlapping periodic/final log flushes cannot overwrite the final report with an older snapshot',async()=>{
 const queue=new KeyedTasks();let stored=[];const buffer=['first'];
 const flush=()=>queue.run('job',async()=>{const next=buffer.splice(0);const before=[...stored];await new Promise(resolve=>setTimeout(resolve,next.includes('first')?20:1));stored=[...before,...next]});
 const first=flush();await new Promise(resolve=>setTimeout(resolve,1));buffer.push('final report');const final=flush();await Promise.all([first,final]);assert.deepEqual(stored,['first','final report']);
});
