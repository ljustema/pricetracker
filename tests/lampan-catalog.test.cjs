const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require('typescript'),cheerio=require('cheerio'),{XMLParser}=require('fast-xml-parser'),{gunzipSync,gzipSync}=require('node:zlib');
const source=fs.readFileSync('scrapers/lampan.ts','utf8'),ast=ts.createSourceFile('lampan.ts',source,ts.ScriptTarget.Latest,true);
const names=new Set(['normalizeCatalogBrand','normalizeCatalogSku','isLampanProductUrl','buildCatalogIndex','catalogIdentifierConflict','extractBrandLinks','extractBrandListings','selectDiscoveryUrls','discoverCatalogListings','fetchLampanText','fetchSitemapUrls','runLampanCatalog','isValidEAN','sanitizeEAN','extractStructuredProduct','extractProductData','extractLampanFaktaFields','extractStockData','parseStockDate','productPassesFilters']);
const code=ast.statements.filter(n=>(ts.isFunctionDeclaration(n)&&names.has(n.name?.text))||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>['CONFIG','lastLampanRequestStarted'].includes(d.name.getText(ast))))).map(n=>n.getText(ast)).join('\n');
function load(fetch=async()=>{throw Error('unexpected request')}) {
 const outputs=[],waits=[];const ctx={URL,Buffer,AbortSignal,gunzipSync,XMLParser,cheerio,fetch,Date,logProgress(){},logError(){},setTimeout:(fn,ms)=>{waits.push(ms);fn()},console:{log:line=>outputs.push(JSON.parse(line))}};
 vm.createContext(ctx);vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);vm.runInContext('CONFIG.PERFORMANCE.REQUEST_DELAY=0;',ctx);
 return{ctx,outputs,waits};
}
const base=()=>({version:1,generatedAt:new Date().toISOString(),brands:[{id:'b1',name:'By Rydéns',aliases:['Rydens']}],ownProducts:[{id:'p1',ean:'7318303297953',sku:'A-100',brandId:'b1'}],known:[],seen:[],urlChecks:false});
const reply=(body,status=200,retry=null)=>({ok:status===200,status,statusText:status===200?'OK':status===429?'Too Many Requests':'Forbidden',headers:{get:()=>retry},arrayBuffer:async()=>Buffer.from(body)});
function listing(items,total=items.length){return '<div class="pagination-load-more__num-products">('+items.length+' av '+total+')</div><script type="application/ld+json">'+JSON.stringify([{mainEntity:{itemListElement:items.map(([url,sku,brand='By Rydéns'])=>({item:{'@type':'Product',sku,brand:{name:brand},offers:[{url,price:'1'}]}}))}}])+'</script>';}
test('brand aliases/accents select only owned brands before requests',()=>{
 const{ctx}=load();const links=ctx.extractBrandLinks('<a href="/varumarken/by-rydens/">By Rydéns</a><a href="/varumarken/unowned/">Unowned</a><a href="https://other.test/varumarken/rydens/">Rydens</a>',base());
 assert.equal(links.length,1);assert.equal(links[0].brandId,'b1');
});
test('newly added own brand is picked up without a hardcoded brand list',()=>{
 const{ctx}=load();const plan=base();const html='<a href="/varumarken/new-brand/">New brand</a>';
 assert.equal(ctx.extractBrandLinks(html,plan).length,0);plan.brands.push({id:'b2',name:'New Brand',aliases:[]});assert.equal(ctx.extractBrandLinks(html,plan).length,1);
});
test('listing prices are never emitted as verified product prices',()=>{
 const{ctx,outputs}=load();const r=ctx.extractBrandListings(listing([['https://lampan.se/p/new/','A100']]),'b1',base());
 assert.equal(r.items[0].sku,'A100');assert.equal('price' in r.items[0],false);assert.equal(outputs.length,0);
});
test('new own SKU match is discovered before unrelated listings and EAN exploration gets a reserved share',()=>{
 const{ctx}=load();const plan=base();const items=Array.from({length:12},(_,i)=>({url:`https://lampan.se/p/own-${i}/`,sku:'A100',brandId:'b1'}));items.push({url:'https://lampan.se/p/ean-only/',sku:'Different',brandId:'b1'});
 const selected=ctx.selectDiscoveryUrls(items,plan,new Set(),3);assert.equal(selected.length,3);assert.ok(selected.includes('https://lampan.se/p/ean-only/'));
});
test('new own product changes discovery priority and known URLs are not rechecked as discovery',()=>{
 const{ctx}=load();const plan=base();const a={url:'https://lampan.se/p/a/',sku:'UNKNOWN',brandId:'b1'},z={url:'https://lampan.se/p/z/',sku:'NEW-1',brandId:'b1'};
 plan.ownProducts.push({id:'p2',ean:null,sku:'NEW1',brandId:'b1'});
 assert.equal(ctx.selectDiscoveryUrls([a,z],plan,new Set(),1)[0],z.url);
 assert.equal(ctx.selectDiscoveryUrls([a,z],plan,new Set([z.url]),1)[0],a.url);
});
test('checked unavailable listings rotate behind never-seen URLs',()=>{
 const{ctx}=load();const plan=base();plan.seen=[{url:'https://lampan.se/p/a/',verifiedAt:new Date().toISOString()}];
 const urls=ctx.selectDiscoveryUrls([{url:'https://lampan.se/p/a/',sku:null,brandId:'b1'},{url:'https://lampan.se/p/z/',sku:null,brandId:'b1'}],plan,new Set(),1);
 assert.equal(urls[0],'https://lampan.se/p/z/');
});
test('cumulative brand pagination reads the final public page and discovers new products',async()=>{
 const requests=[];const{ctx}=load(async url=>{requests.push(url);if(url==='https://lampan.se/varumarken/')return reply('<a href="/varumarken/by-rydens/">By Rydéns</a>');if(url.includes('page=2'))return reply(listing([['https://lampan.se/p/a/','A100'],['https://lampan.se/p/b/','B'],['https://lampan.se/p/c/','C']],3));return reply(listing([['https://lampan.se/p/a/','A100'],['https://lampan.se/p/b/','B']],3));});
 const rows=await ctx.discoverCatalogListings(base());assert.equal(rows.length,3);assert.ok(requests[2].endsWith('?page=2'));
});
test('403/challenge stops immediately; 429 waits for Retry-After before a bounded retry',async()=>{
 let calls=0;const a=load(async()=>{calls++;return reply('',403)});await assert.rejects(a.ctx.fetchLampanText('https://lampan.se/p/a/','text/html'),/403/);assert.equal(calls,1);
 const b=load(async()=>reply('<title>Just a moment...</title>'));await assert.rejects(b.ctx.fetchLampanText('https://lampan.se/p/a/','text/html'),/challenge/);
 calls=0;const c=load(async()=>++calls===1?reply('',429,'45'):reply('valid'));assert.equal(await c.ctx.fetchLampanText('https://lampan.se/p/a/','text/html'),'valid');assert.ok(c.waits.includes(45000));assert.equal(calls,2);
});
test('long Retry-After is respected by stopping instead of premature retry',async()=>{
 let calls=0;const{ctx}=load(async()=>{calls++;return reply('',429,'600')});await assert.rejects(ctx.fetchLampanText('https://lampan.se/p/a/','text/html'),/long Retry-After/);assert.equal(calls,1);
});
test('gzip sitemap supports both compressed and already decoded responses',async()=>{
 const xml='<urlset><url><loc>https://lampan.se/p/one/</loc></url></urlset>';
 for(const body of[gzipSync(xml),Buffer.from(xml)]){const{ctx}=load(async()=>reply(body));assert.equal((await ctx.fetchSitemapUrls('https://lampan.se/sitemap.xml.gz')).length,1);}
});
test('missing catalog never falls back to fetching an unfiltered entire catalog',async()=>{
 const{ctx}=load();await assert.rejects(ctx.runLampanCatalog({}),/context is required/);
});
test('production configuration and actual request starts enforce three-second spacing',async()=>{
 const starts=[];let clock=100000;
 const{ctx}=load(async()=>{starts.push(clock);return reply('ok')});
 ctx.Date=class extends Date{static now(){return clock}};ctx.setTimeout=(fn,ms)=>{clock+=ms;fn()};
 vm.runInContext('CONFIG.PERFORMANCE.REQUEST_DELAY=3000;',ctx);
 await ctx.fetchLampanText('https://lampan.se/p/a/','text/html');await ctx.fetchLampanText('https://lampan.se/p/b/','text/html');await ctx.fetchLampanText('https://lampan.se/p/c/','text/html');
 assert.deepEqual(starts,[100000,103000,106000]);assert.match(source,/REQUEST_DELAY:\s*3000\s*,/);assert.match(source,/MAX_CONCURRENCY:\s*1\s*,/);
});
test('new own products without EAN can match by SKU/brand; contradictory variants cannot',()=>{
 const{ctx}=load();const plan=base();plan.ownProducts[0].ean=null;
 const incoming={brand:'By Rydéns',sku:'A100',ean:'7318303297953'};
 assert.equal(ctx.catalogIdentifierConflict(incoming,ctx.buildCatalogIndex(plan)),null);
 plan.ownProducts[0].ean='9008606355051';
 assert.equal(ctx.catalogIdentifierConflict(incoming,ctx.buildCatalogIndex(plan)),'conflicting_ean_for_own_sku_brand');
 plan.ownProducts.push({id:'p2',brandId:'b1',sku:'A100',ean:'7318303297953'});
 assert.equal(ctx.catalogIdentifierConflict({...incoming,ean:null},ctx.buildCatalogIndex(plan)),'ambiguous_own_sku_brand');
});
