const assert=require('node:assert/strict');
const base=process.env.PMO_TEST_URL||'http://127.0.0.1:8080/';let cookie='',csrf='',token='',count=0;
async function request(path,options={}){const r=await fetch(base+path,{...options,headers:{Cookie:cookie,...options.headers}});for(const value of r.headers.getSetCookie()){const [pair]=value.split(';');if(pair.startsWith('vcx_pmo='))cookie=pair;}return r;}
async function rpc(method,args=[],withCsrf=true){const r=await request('index.php?rpc=1',{method:'POST',headers:{'Content-Type':'application/json','X-PMO-Token':token,...(withCsrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify({method,args})});const body=await r.json();if(r.status===200&&method==='login')token=body.result.token;if(r.status===200&&['logout','changePassword'].includes(method))token='';return{status:r.status,...body};}
async function check(name,fn){await fn();count++;console.log('PASS api '+name);}
(async()=>{
 const page=await request('');const html=await page.text();csrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1];
 await check('secure session headers',()=>{assert.match(page.headers.get('set-cookie'),/HttpOnly/i);assert.match(page.headers.get('set-cookie'),/SameSite=Strict/i);assert.equal(page.headers.get('x-frame-options'),'DENY');assert.match(page.headers.get('cache-control'),/no-store/);});
 await check('CSRF enforced before API dispatch',async()=>assert.equal((await rpc('getProjects',[],false)).status,403));
 await check('anonymous portfolio denied',async()=>assert.equal((await rpc('getProjects')).status,422));
 const before=cookie;
 await check('bootstrap temporary login',async()=>{const r=await rpc('login',['admin','temporary-test-password']);assert.equal(r.status,200);assert.equal(r.result.needsPasswordChange,true);assert.notEqual(cookie,before);});
 await check('mandatory password gate enforced by backend',async()=>{assert.equal((await rpc('getProjects')).status,422);assert.equal((await rpc('getBootstrap')).result.needsPasswordChange,true);});
 await check('password change revokes old session',async()=>{assert.equal((await rpc('changePassword',['temporary-test-password','changed-test-password'])).status,200);assert.equal((await rpc('getProjects')).status,422);});
 await check('login normal session',async()=>assert.equal((await rpc('login',['admin','changed-test-password'])).status,200));
 await check('portfolio and initial dashboard HTTP',async()=>{assert.equal((await rpc('getProjects')).result.length,10);const r=await rpc('getInitialData');assert.equal(r.result.dash.kpi.total,10);assert.equal(r.result.boot.schemaVersion,'UNIFIED_TASKS_V2');});
 await check('cookie alone cannot choose an actor without its tab token',async()=>{const savedToken=token;token='';assert.equal((await rpc('getProjects')).status,422);token=savedToken;assert.equal((await rpc('getProjects')).status,200);});
 await check('a token from another PHP browser session is rejected',async()=>{const r=await fetch(base);const html=await r.text();const foreignCsrf=html.match(/name="csrf-token" content="([a-f0-9]+)"/)[1],foreignCookie=r.headers.getSetCookie().find(x=>x.startsWith('vcx_pmo=')).split(';')[0];const denied=await fetch(base+'index.php?rpc=1',{method:'POST',headers:{Cookie:foreignCookie,'Content-Type':'application/json','X-CSRF-Token':foreignCsrf,'X-PMO-Token':token},body:JSON.stringify({method:'getProjects',args:[]})});assert.equal(denied.status,422);});
 await check('backend API whitelist rejects helpers and maintenance',async()=>assert.equal((await rpc('actor_')).status,422));
 await check('malformed arguments rejected',async()=>{const r=await request('index.php?rpc=1',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:'{bad'});assert.equal(r.status,400);});
 await check('GET cannot mutate',async()=>assert.equal((await request('index.php?rpc=1&method=saveProject')).status,405));
 await check('schema stale client cannot write',async()=>assert.equal((await rpc('saveProject',[{Project_Name:'No',Status:'In Progress',RAG:'Green'},'LEGACY_V1'])).status,422));
 await check('query injection cannot bypass project scope',async()=>assert.equal((await rpc('getProjectDetail',["' OR 1=1 --"])).status,422));
 await check('logout clears session',async()=>{assert.equal((await rpc('logout')).status,200);assert.equal((await rpc('getProjects')).status,422);});
 console.log(JSON.stringify({passed:count,failed:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
