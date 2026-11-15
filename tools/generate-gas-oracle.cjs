// Read-only reference execution. No Google service is contacted and no source file is modified.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const source=process.argv[2];if(!source)throw Error('Supply local GAS checkout path');
const gitDir=fs.readFileSync(source+'/.git/HEAD','utf8').trim();const sha=gitDir.startsWith('ref: ')?fs.readFileSync(source+'/.git/'+gitDir.slice(5),'utf8').trim():gitDir;if(sha!=='c0e3db58a7d0522408c633dbb22403522e4ff8d3')throw Error('Baseline mismatch');
const {runtime}=require(source+'/tests/helpers/runtime.cjs');const r=runtime(source,0);const legacy=process.argv.includes('--legacy');const snapshot=JSON.parse(fs.readFileSync('database/seed.json','utf8'));
if(legacy){
 const map=new Map(snapshot.tables.TASKS.map(t=>[t.Task_ID,t]));
 snapshot.tables.PHASES=snapshot.tables.TASKS.filter(t=>t.Task_Type==='PHASE').map(t=>({Phase_ID:t.Task_ID,Project_ID:t.Project_ID,Phase_Name:t.Task_Name,Phase_Order:t.Sort_Order,Start_Date:t.Start_Date,End_Date:t.End_Date,Status:t.Status,RAG:t.RAG,Template_ID:''}));
 snapshot.tables.TASKS=snapshot.tables.TASKS.filter(t=>t.Task_Type!=='PHASE').map(t=>{let p=map.get(t.Parent_Task_ID);while(p&&p.Task_Type!=='PHASE')p=map.get(p.Parent_Task_ID);const out={...t,Phase_ID:p?.Task_ID||'',Task_Type:t.Task_Type==='MILESTONE'?'Milestone':'Task'};if(map.get(out.Parent_Task_ID)?.Task_Type==='PHASE')out.Parent_Task_ID='';delete out.Sort_Order;return out;});
 snapshot.tables.CONFIG[0].Value='LEGACY_V1';snapshot.schemaVersion='LEGACY_V1';
}
snapshot.tables.PROCEDURE_TEMPLATES.push({Template_ID:'ODD-DURATION',Template_Name:'Fallback duration',Step_No:'1',Task_Name:'Fallback task',Duration_Days:'2invalid',Required_Document:'',Responsible_Role:'PM'});
const contract=vm.runInContext('SCHEMA',r.ctx);
function append(table,fields){const cols=table==='TASKS'&&!legacy?[...contract[table],'Sort_Order']:contract[table];snapshot.tables[table].push(Object.fromEntries(cols.map(k=>[k,String(fields[k]??'')])));}
append('USERS',{User_ID:'0',Email:'zero@example.invalid',Full_Name:'Zero user',System_Role:'PIC',Weekly_Capacity_Days:'0',Active:'TRUE'});
append('USERS',{User_ID:'0 ',Email:'space@example.invalid',Full_Name:'Space user',System_Role:'PIC',Weekly_Capacity_Days:'5',Active:'FALSE'});
append('PROJECT_GROUPS',{Group_ID:'0',Group_Name:'0',Owner_ID:'0'});
append('PROJECTS',{Project_ID:'0',Project_Name:'0',Group_ID:'0',PM_ID:'PM',Status:'In Progress',RAG:'Green',Start_Date:'2026-11-09',End_Date:'2026-11-20'});
append('PHASES',{Phase_ID:'0',Project_ID:'0',Phase_Name:'0',Phase_Order:'1',Status:'In Progress',RAG:'Green',Start_Date:'2026-11-09',End_Date:'2026-11-20'});
append('TASKS',{Task_ID:'0',Project_ID:'0',Task_Name:'0',Task_Type:legacy?'Task':'TASK',PIC_ID:'0',Phase_ID:'0',Start_Date:'2026-11-09',End_Date:'2026-11-20',Progress:'0',Status:'Not Started',RAG:'Green',Sort_Order:'1024'});
append('TASKS',{Task_ID:'ZERO-CHILD',Project_ID:'0',Parent_Task_ID:'0',Task_Name:'Zero child',Task_Type:legacy?'Task':'TASK',PIC_ID:'0 ',Phase_ID:'0',Start_Date:'2026-11-09',End_Date:'2026-11-20',Progress:'0',Status:'Not Started',RAG:'Green',Sort_Order:'1024'});
append('PROJECT_MEMBERS',{Member_ID:'ZERO-MEMBER',Project_ID:'0',User_ID:'0',Project_Role:'Member'});
append('ASSIGNMENTS',{Assignment_ID:'ZERO-ASSIGNMENT',Task_ID:'0',User_ID:'0',Start_Date:'2026-11-09',End_Date:'2026-11-20',Allocation_Pct:'25'});
append('CHECKLIST_ITEMS',{Item_ID:'ZERO-DOC',Project_ID:'0',Task_ID:'0',Phase_ID:'0',Item_Name:'0',Owner_ID:'0',Required:'TRUE',Status:'Missing',Due_Date:'2026-11-20'});
append('ISSUES',{Issue_ID:'ZERO-ISSUE',Project_ID:'0',Task_ID:'0',Title:'0',Owner_ID:'0',Created_By:'0',Severity:'High',Status:'Open',Decision_Required:'TRUE'});
append('PROCEDURE_TEMPLATES',{Template_ID:'0',Template_Name:'Zero template',Step_No:'1',Task_Name:'0',Duration_Days:'1',Required_Document:'0'});
for(const [t,rows]of Object.entries(snapshot.tables))r.db[t]=JSON.parse(JSON.stringify(rows));if(!legacy)r.headers.TASKS.push('Sort_Order');
const pepper='synthetic-test-pepper-'.repeat(3),tokens={};
for(const u of r.db.USERS){const id=u.User_ID,t=crypto.createHash('sha256').update('oracle-'+id).digest('hex');tokens[id]=t;r.db.AUTH_USERS.push({User_ID:id,Username:id==='0 '?'zero-space-user':id.toLowerCase()+'-user',Password_Salt:'synthetic-salt',Password_Hash:crypto.pbkdf2Sync('synthetic-password|'+pepper,'synthetic-salt',12000,32,'sha256').toString('hex'),Iterations:'12000',Active:'TRUE',Must_Change_Password:'FALSE',Created_At:'2026-11-15T06:00:00.000Z'});r.db.AUTH_SESSIONS.push({Session_ID:'ORACLE-'+id,User_ID:id,Token_Hash:crypto.createHash('sha256').update(t).digest('hex'),Created_At:'2026-11-15T06:00:00.000Z',Expires_At:'2099-01-01T00:00:00.000Z',Revoked:'FALSE'});}
// Clock fixed for deterministic task versions and returned timestamps.
const RealDate=Date;class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:['2026-11-15T06:00:00.000Z']));}static now(){return new RealDate('2026-11-15T06:00:00.000Z').getTime();}}r.ctx.Date=FixedDate;r.ctx.Utilities.formatDate=()=> '2026-11-15';
const clean=x=>JSON.parse(JSON.stringify(x));const sourceSnapshot={schemaVersion:legacy?'LEGACY_V1':'UNIFIED_TASKS_V2',tables:{}};
for(const[t,cols]of Object.entries(vm.runInContext('SCHEMA',r.ctx))){const keys=t==='TASKS'&&!legacy?[...cols,'Sort_Order']:cols;sourceSnapshot.tables[t]=r.db[t].map(row=>Object.fromEntries(keys.map(k=>[k,String(row[k]??'')])));}
const idCounters={};r.ctx.newId_=prefix=>prefix+'-'+(idCounters[prefix]=(idCounters[prefix]||0)+1).toString(16).padStart(8,'0').toUpperCase()+'-000';
const cases=[];function record(who,method,args=[]){const result=clean(r.ctx[method](tokens[who],...args));cases.push({who,method,args,result});return result;}
for(const who of ['ADMIN','EXEC','PM','PIC','OTHER','0']){
 for(const m of ['getBootstrap','getInitialData','getProjects','getPortfolioData','getDashboard'])record(who,m);
 record(who,'getDailyWorkload',['2026-11-14',10]);record(who,'getWorkload',['2026-11-14',3]);
 if(who==='0')record(who,'getProjectDetail',['0']);else if(who!=='OTHER')record(who,'getProjectDetail',['DEMO-PRJ-01']);
}
record('PM','getProjectAttributes',['DEMO-PRJ-01']);record('PM','getProjectMemberSettings',['DEMO-PRJ-01']);record('PM','getWorkspaceCompatibilityReport',['DEMO-PRJ-01']);
const P='DEMO-PRJ-01',T='DEMO-TSK-01-1-4',schema=legacy?'LEGACY_V1':'UNIFIED_TASKS_V2';
record('PM','saveTaskBatch',[P,[{opId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',kind:'create',fields:{Task_Name:'Oracle quick task',Start_Date:'2026-11-15',End_Date:'2026-11-16'}}],schema]);
let detail=record('PM','getProjectDetail',[P]);
record('PIC','saveTaskBatch',[P,[{opId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',kind:'update',taskId:T,baseVersion:detail.taskVersions[T],fields:{Progress:'42',Status:'Blocked',Member_Update:'Oracle note'}}],schema]);
if(!legacy)record('PM','changeTaskStructure',[P,{opId:'cccccccc-cccc-cccc-cccc-cccccccccccc',action:'indent',taskIds:[T],baseVersion:r.ctx.structureVersion_(r.ctx.rows_('TASKS').filter(t=>t.Project_ID===P))},schema]);
record('PM','applyProcedureTemplate',[P,'DEMO-TEMPLATE','Approval','2026-11-14',schema]);if(!legacy)record('PM','applyProcedureTemplate',[P,'DEMO-TEMPLATE','Ignored','2027-01-01',schema]);
record('PM','applyProcedureTemplate',['DEMO-PRJ-02','ODD-DURATION','Fallback','2026-11-14',schema]);
record('PIC','saveChecklistItem',[{Item_ID:'DEMO-TSK-01-1-DOC',Status:'Preparing',Evidence_URL:'https://example.invalid/document',Notes:'Oracle draft'},schema]);
record('PIC','saveIssue',[{Issue_ID:P+'-ISS',Status:'Resolved',Resolution_Plan:'Ready'},schema]);
record('PM','saveProjectMembers',[P,{addUserIds:['OTHER']},schema]);
record('PM','getProjectMemberSettings',['0']);record('PM','saveProject',[{Project_ID:'0',Project_Name:'0'},schema]);record('PM','saveTask',[{Task_ID:'0',Description:'Zero root updated'},schema]);record('0','updateMyTask',['0','50','In Progress','Zero update',schema]);record('PM','applyProcedureTemplate',['0','0','0','2026-11-14',schema]);
if(!legacy)record('PM','changeTaskStructure',['0',{opId:'dddddddd-dddd-dddd-dddd-dddddddddddd',action:'reparent',taskIds:['ZERO-CHILD'],parentId:'',baseVersion:r.ctx.structureVersion_(r.ctx.rows_('TASKS').filter(t=>t.Project_ID==='0'))},schema]);record('0','getProjectDetail',['0']);
record('ADMIN','setProjectArchived',[P,true,schema]);record('ADMIN','getDashboard');record('EXEC','getProjects');record('ADMIN','setProjectArchived',[P,false,schema]);
const serialized=JSON.stringify({baseline:sha,clock:'2026-11-15T06:00:00.000Z',pepper,tokens,snapshot:sourceSnapshot,cases},null,2)+'\n';
fs.writeFileSync(legacy?'tests/fixtures/gas-legacy-oracle.json.gz':'tests/fixtures/gas-oracle.json.gz',require('node:zlib').gzipSync(serialized));console.log(`Generated ${cases.length} reference operations from ${sha}`);
