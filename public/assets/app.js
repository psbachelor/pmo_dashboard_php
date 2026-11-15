async function rpc(method,args){
 const response=await fetch('index.php?rpc=1',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':document.querySelector('meta[name="csrf-token"]').content,'X-PMO-Token':S.token},body:JSON.stringify({method,args})});
 const body=await response.json();if(!response.ok||body.error)throw Error(body.error||'API error');return body.result;
}
'use strict';
const S={view:'dashboard',boot:null,dash:null,data:null,work:null,project:null,expanded:new Set(),weekStart:new Date().toISOString().slice(0,10),metric:'allocation',grain:'week',ganttGrain:'day',filter:'',showArchived:false,workVersion:0,revision:0,renderVersion:0,projectRequest:0,modalVersion:0,inflight:new Map(),loading:null,token:sessionStorage.getItem('vcx_pmo_session')||''};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arg=s=>esc(JSON.stringify(String(s??"")));
const fmt=s=>s?esc(s):'—';
const tag=s=>`<span class="tag ${esc(['Red','Amber','Green'].includes(s)?s:'neutral')}">${esc(s||'Unknown')}</span>`;
// Only aggregate operation names/durations are logged; arguments/results are never logged.
function perfStart(){return performance.now();}
function perfEnd(operation,start){if(sessionStorage.getItem('vcx_pmo_perf')==='TRUE')console.info(JSON.stringify({type:'pmo_client_performance',operation,ms:Math.round((performance.now()-start)*100)/100}));}
function invalidateClient(method){
 if(!['saveTask','updateMyTask','saveProject','saveIssue','saveChecklistItem','saveAssignment','applyProcedureTemplate','saveProjectAttribute','setProjectArchived','purgeArchivedProject'].includes(method))return;
 S.revision++;S.projectRequest++;S.dash=null;S.work=null;
 if(!['saveTask','updateMyTask'].includes(method))S.data=null;
}
function gas(method,...args){const started=perfStart(),token=S.token;if(['saveTask','updateMyTask','saveProject','saveIssue','saveChecklistItem','saveAssignment','applyProcedureTemplate','saveProjectAttribute','setProjectArchived','purgeArchivedProject','saveProjectMembers','saveTaskBatch','changeTaskStructure','recoverTaskStructure'].includes(method))args.push(S.boot?.schemaVersion||'LEGACY_V1');return rpc(method,args).then(result=>{if(S.token===token)invalidateClient(method);return result;}).finally(()=>perfEnd('rpc_'+method,started));}
function readGas(method,...args){
 const key=JSON.stringify([S.token,S.revision,method,args]);if(S.inflight.has(key))return S.inflight.get(key);
 const request=gas(method,...args).finally(()=>{if(S.inflight.get(key)===request)S.inflight.delete(key);});S.inflight.set(key,request);return request;
}
function gasPublic(method,...args){return rpc(method,args);}
function modalFormOpen(){return !$('modal').classList.contains('hidden')&&!!$('modal-content').querySelector('form');}
function modalBusy(){return !!$('modal-content').querySelector('form[data-busy="true"]');}
function formStatus(form,message,error=false){let status=form.querySelector('.form-status');if(!status){status=document.createElement('div');status.className='form-status';status.setAttribute('role','status');form.prepend(status);}status.textContent=message;status.className='form-status '+(error?'error':'success');}
async function ensurePortfolio(){
 if(S.data)return;const token=S.token,revision=S.revision;
 const data=await readGas('getPortfolioData');if(token!==S.token)return;
 if(revision!==S.revision)return ensurePortfolio();S.data=data;
}
async function ensureDashboard(){
 if(S.dash)return;const token=S.token,revision=S.revision;
 const data=await readGas('getDashboard');if(token!==S.token)return;
 if(revision!==S.revision)return ensureDashboard();S.dash=data;
}
function showLogin(){workspaceCloseReference();WS.projects.forEach(w=>{clearTimeout(w.timer);clearTimeout(w.maxTimer);});WS.projects.clear();S.revision++;S.renderVersion++;S.projectRequest++;S.modalVersion++;S.data=null;S.dash=null;S.project=null;S.work=null;S.inflight.clear();S.loading=null;$('modal-content').innerHTML='';$('modal').classList.add('hidden');S.token='';S.boot=null;sessionStorage.removeItem('vcx_pmo_session');$('login-screen').classList.remove('hidden');$('content').style.display='none';$('logout').style.display='none';$('change-password-button').style.display='none';$('who').textContent='Chưa đăng nhập';}
async function doLogin(e){e.preventDefault();const started=perfStart();const b=e.target.querySelector('button[type=submit]');b.disabled=true;try{const form=new FormData(e.target);const r=await gasPublic('login',form.get('username'),form.get('password'));S.token=r.token;sessionStorage.setItem('vcx_pmo_session',r.token);e.target.reset();if(r.needsPasswordChange){$('login-screen').classList.add('hidden');$('content').style.display='block';showChangePassword();}else await load();}catch(err){notify(err.message,true);}finally{b.disabled=false;perfEnd('login_to_dashboard',started);}}
async function doLogout(){if(modalBusy())return;if(workspaceDirty()){workspaceLeave();notify('Còn thay đổi chưa lưu. Hãy lưu hoặc xử lý lỗi trước khi đăng xuất.',true);return;}try{await gas('logout');}catch(e){}showLogin();}
function notify(msg,error=false){$('alert').innerHTML=`<div class="${error?'error':'success'}">${esc(msg)}</div>`;setTimeout(()=>$('alert').innerHTML='',5500);}
function setBusy(msg='Đang tải...'){$('content').innerHTML=`<div class="panel">${esc(msg)}</div>`;}
async function load(){
 if(modalFormOpen())return;if(workspaceDirty()){workspaceLeave();notify('Cần lưu xong trước khi làm mới.',true);return;}if(!S.token){showLogin();return;}if(S.loading)return S.loading;workspaceCloseReference();
 const token=S.token,revision=++S.revision;S.data=null;S.dash=null;S.projectRequest++;
 const started=perfStart();
 const request=(async()=>{try{
  $('login-screen').classList.add('hidden');$('content').style.display='block';$('logout').style.display='inline-block';setBusy();
  const initial=await readGas('getInitialData');if(token!==S.token||revision!==S.revision)return;
  S.boot=initial.boot;if(S.boot.needsPasswordChange){showChangePassword();return;}S.dash=initial.dash;
  $('change-password-button').style.display='inline-block';$('users-nav').style.display=S.boot.user.role==='PMO_ADMIN'?'block':'none';$('who').textContent=S.boot.user.name+' · '+S.boot.user.role;
  const route=location.hash.match(/^#project=(.*)$/);if(route)await openProject(decodeURIComponent(route[1]),true);else await render();
 }catch(e){if(token!==S.token)return;if(/đăng nhập|hết hạn|khả dụng|vô hiệu/i.test(e.message)){showLogin();notify(e.message,true);}else{setBusy('Lỗi: '+e.message);notify(e.message,true);}}
 finally{perfEnd('dashboard_load',started);}})();
 S.loading=request;try{return await request;}finally{if(S.loading===request)S.loading=null;}
}
async function render(){
 const version=++S.renderVersion,view=S.view,started=perfStart();
 document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
 const titles={dashboard:'Portfolio Dashboard',projects:'Project Register',gantt:'Master Gantt',resources:'Resource Workload',issues:'Issue Register',mytasks:'My Tasks',users:'Account Management'};
 $('page-title').textContent=titles[view];$('subtitle').textContent='VCX PMO • PHP / MySQL';
 if(view==='dashboard'&&!S.dash){setBusy();await ensureDashboard();}
 if(['projects','gantt','issues','mytasks'].includes(view)&&!S.data){setBusy();await ensurePortfolio();}
 if(version!==S.renderVersion||view!==S.view||!S.token)return;
 const drawStart=perfStart();
 if(view==='dashboard')drawDashboard();if(view==='projects')drawProjects();if(view==='gantt')drawGantt();if(view==='issues')drawIssues();if(view==='resources')await drawResources();if(view==='mytasks')drawMyTasks();if(view==='users')drawUsers();
 perfEnd('frontend_render',drawStart);perfEnd('view_ready',started);
}
function chooseView(v,fromHistory=false){if(modalFormOpen())return;workspaceCloseReference();workspaceLeave();WS.route++;if(!fromHistory&&location.hash)history.pushState(null,'',location.pathname+location.search);S.projectRequest++;S.view=v;render().catch(e=>notify(e.message,true));}
function projectName(id){return S.data.projects.find(x=>x.Project_ID===id)?.Project_Name||id;}
function userName(id){return S.boot.users.find(x=>x.id===id)?.name||id||'—';}
function countIssues(projectId){return S.data.issues.filter(x=>x.Project_ID===projectId&&!['Resolved','Closed'].includes(x.Status)).length;}
function drawDashboard(){const k=S.dash.kpi;const blocks=[['Total',k.total],['Active',k.active],['Red',k.red],['Amber',k.amber],['Open Issues',k.openIssues],['Decisions',k.decisions],['Overdue Tasks',k.lateTasks],['Missing Documents',k.pendingDocuments],['Overdue Documents',k.overdueDocuments]];
 let h=`<div class="cards">${blocks.map(([label,n])=>`<div class="card"><b>${n}</b><label>${label}</label></div>`).join('')}</div>`;
 h+=`<div class="split"><section class="panel"><h3>Priority issues & decisions</h3><div class="table-wrap"><table><thead><tr><th>Project</th><th>Issue</th><th>Severity</th><th>Decision?</th></tr></thead><tbody>`+
 S.dash.problems.slice(0,12).map(x=>`<tr><td><button class="link" onclick="openProject(${arg(x.projectId)})">${esc(x.projectName)}</button></td><td>${esc(x.title)}</td><td>${tag(x.severity==='Critical'?'Red':x.severity==='High'?'Amber':'Green')}</td><td>${x.decision==='TRUE'?'⚑ Yes':'No'}</td></tr>`).join('')+`</tbody></table></div></section>`;
 h+=`<section class="panel"><h3>Red / Amber projects</h3><div class="table-wrap"><table><thead><tr><th>Project</th><th>Health</th><th>Open Issues</th></tr></thead><tbody>`+
 S.dash.projects.filter(x=>['Red','Amber'].includes(x.rag)).map(x=>`<tr><td><button class="link" onclick="openProject(${arg(x.id)})">${esc(x.name)}</button></td><td>${tag(x.rag)} <span class="tiny muted">${esc(x.health)}</span></td><td>${x.issueCount}</td></tr>`).join('')+`</tbody></table></div></section></div>`;
 h+=`<section class="panel"><h3>Hồ sơ cần hoàn thiện / quá hạn</h3><div class="table-wrap"><table><thead><tr><th>Dự án</th><th>Hồ sơ</th><th>Trạng thái</th><th>Hạn</th></tr></thead><tbody>${(S.dash.procedureAlerts||[]).slice(0,20).map(x=>`<tr><td><button class="link" onclick="openProject(${arg(x.projectId)})">${esc(x.projectName)}</button></td><td>${esc(x.name)}</td><td>${x.overdue?tag('Red'):tag('Amber')} ${esc(x.status)}</td><td>${esc(x.due)}</td></tr>`).join('')}</tbody></table></div></section>`; $('content').innerHTML=h;}
function drawProjects(){const v=S.filter.toLowerCase();const list=S.data.projects.filter(x=>(x.Status==='Archived')===S.showArchived).filter(x=>[x.Project_Name,x.Department,x.Project_Type,x.PM_ID,x.RAG].some(t=>String(t).toLowerCase().includes(v)));
 $('content').innerHTML=`<section class="panel"><div class="panel-head"><h3>${list.length} projects</h3><div><input id="project-search" placeholder="Tìm dự án, đơn vị, PM..." value="${esc(S.filter)}"> ${S.boot.user.role==='PMO_ADMIN'?`<button class="secondary" onclick="toggleArchived()">${S.showArchived?'Dự án đang hoạt động':'Kho lưu trữ'}</button> <button onclick="editProject()">+ New project</button>`:''}</div></div><div class="table-wrap"><table><thead><tr><th>Project</th><th>Department</th><th>PM</th><th>Dates</th><th>Status</th><th>RAG</th><th>Issues</th></tr></thead><tbody>${list.map(p=>`<tr><td><button class="link" onclick="openProject(${arg(p.Project_ID)})">${esc(p.Project_Name)}</button></td><td>${esc(p.Department)}</td><td>${esc(userName(p.PM_ID))}</td><td>${fmt(p.Start_Date)} – ${fmt(p.End_Date)}</td><td>${esc(p.Status)}</td><td>${tag(p.RAG)}</td><td>${countIssues(p.Project_ID)}</td></tr>`).join('')}</tbody></table></div></section>`;
 $('project-search').addEventListener('input',e=>{const cursor=e.target.selectionStart;S.filter=e.target.value;drawProjects();const n=$('project-search');n.focus();n.setSelectionRange(cursor,cursor);});}
function toggleArchived(){S.showArchived=!S.showArchived;drawProjects();}
function parseDay(s){return Date.parse(s+'T00:00:00Z');}
function plusDays(s,n){return new Date(parseDay(s)+n*86400000).toISOString().slice(0,10);}
function monday(s){const d=new Date(parseDay(s));return plusDays(s,-(d.getUTCDay()+6)%7);}
function toggleTree(id){S.expanded.has(id)?S.expanded.delete(id):S.expanded.add(id);drawGantt();}
async function drawResources(){setBusy('Đang tính phân bổ nguồn lực...');const day=S.grain==='day',view=S.view,revision=S.revision,version=++S.workVersion;const work=day?await readGas('getDailyWorkload',S.weekStart,14):await readGas('getWorkload',S.weekStart,8);if(view!==S.view||revision!==S.revision||version!==S.workVersion)return;S.work=work;
 const buckets=day?S.work.dates:S.work.weeks;
 let html=`<section class="panel"><div class="panel-head"><h3>Resource Heatmap • ${day?'14 ngày':'8 tuần'}</h3><div class="toolbar"><input type="date" id="resource-date" value="${esc(S.weekStart)}"><select id="resource-grain"><option value="day" ${day?'selected':''}>Ngày</option><option value="week" ${!day?'selected':''}>Tuần</option></select><select id="resource-mode"><option value="allocation" ${S.metric==='allocation'?'selected':''}>Allocation %</option><option value="tasks" ${S.metric==='tasks'?'selected':''}>Task Count</option></select></div></div><p class="muted tiny">Ngày nghỉ hiển thị —; ⚠ khi thiếu allocation. Nhấn một ô để xem task đang phân bổ.</p><div class="table-wrap"><table class="work-table"><thead><tr><th>Member</th>${buckets.map(w=>`<th>${esc(w.slice(5))}</th>`).join('')}</tr></thead><tbody>`;
 S.work.people.forEach((p,pi)=>{html+=`<tr><td><b>${esc(p.name)}</b><br><span class="muted tiny">${esc(p.department)}</span></td>`;(day?p.days:p.weeks).forEach((w,wi)=>{const n=S.metric==='tasks'?w.taskCount:w.allocationPct;const status=day&&!w.isWorkingDay?'unknown':(w.hasMissingAllocation&&S.metric==='allocation'?'unknown':(S.metric==='allocation'?(n>100?'hot':n>=90?'warm':''):''));html+=`<td><div class="heat clickable ${status}" onclick="showWorkDetail(${pi},${wi})">${day&&!w.isWorkingDay?'—':`${n}${S.metric==='allocation'?'%':''}${w.hasMissingAllocation&&S.metric==='allocation'?' ⚠':''}`}</div></td>`;});html+='</tr>';});html+='</tbody></table></div></section>';$('content').innerHTML=html;
 $('resource-date').onchange=e=>{S.weekStart=e.target.value;drawResources().catch(x=>notify(x.message,true));};$('resource-mode').onchange=e=>{S.metric=e.target.value;drawResources().catch(x=>notify(x.message,true));};$('resource-grain').onchange=e=>{S.grain=e.target.value;drawResources().catch(x=>notify(x.message,true));};}
function showWorkDetail(pi,wi){const p=S.work.people[pi],w=(S.grain==='day'?p.days:p.weeks)[wi];showModal(`${p.name} — ${w.date||w.week}`,`<p><b>${w.taskCount} task</b> · allocation ${w.allocationPct}%${w.hasMissingAllocation?' · ⚠ thiếu allocation':''}</p><div class="table-wrap"><table><thead><tr><th>Project</th><th>Task</th><th>Allocation</th></tr></thead><tbody>${w.details.map(d=>`<tr><td>${esc(d.projectName)}</td><td>${esc(d.taskName)}</td><td>${d.allocation===''?'Unknown':esc(d.allocation)+'%'}</td></tr>`).join('')}</tbody></table></div>`);}
function drawIssues(){let issues=S.data.issues.filter(x=>S.data.projects.some(p=>p.Project_ID===x.Project_ID&&p.Status!=='Archived')).sort((a,b)=>(a.Status==='Closed'?1:0)-(b.Status==='Closed'?1:0));$('content').innerHTML=`<section class="panel"><div class="panel-head"><h3>${issues.length} issues</h3><span class="muted tiny">Click project to inspect / edit</span></div><div class="table-wrap"><table><thead><tr><th>Project</th><th>Issue</th><th>Severity</th><th>Status</th><th>Owner</th><th>Due</th><th>Decision</th></tr></thead><tbody>${issues.map(x=>`<tr><td><button class="link" onclick="openProject(${arg(x.Project_ID)})">${esc(projectName(x.Project_ID))}</button></td><td>${esc(x.Title)}</td><td>${esc(x.Severity)}</td><td>${esc(x.Status)}</td><td>${esc(userName(x.Owner_ID))}</td><td>${fmt(x.Due_Date)}</td><td>${x.Decision_Required==='TRUE'?'⚑ Yes':'No'}</td></tr>`).join('')}</tbody></table></div></section>`;}
function showModal(title,content){if(modalBusy())return false;workspaceCloseReference();const opener=document.activeElement;if(opener&&!$('modal').contains(opener))S.modalLauncher=opener;S.modalVersion++; $('modal-content').removeAttribute('role');$('modal-title').textContent=title;$('modal-content').innerHTML=content;$('modal').classList.remove('hidden');addPasswordToggles($('modal-content'));bindModalReferences($('modal-content'));$('modal-content').querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])')?.focus({preventScroll:true});}
function closeModal(){if(modalBusy())return;workspaceCloseReference();const refresh=S.view==='dashboard'&&!S.dash&&!!$('modal-content').querySelector('[data-project-workspace]');S.modalVersion++;S.projectRequest++;$('modal').classList.add('hidden');const launcher=S.modalLauncher?.isConnected?S.modalLauncher:S.modalLauncher?.id?$(S.modalLauncher.id):null;launcher?.focus({preventScroll:true});if(refresh)render().catch(e=>notify(e.message,true));}
function buildWorkspaceSections(d){const started=perfStart();const p=d.project,id=p.Project_ID;let h=`<div class="workspace-overview"><section id="workspace-information"><h3>Project Information</h3><p><b>${esc(p.Objective)}</b></p><p>${tag(p.RAG)} · ${esc(p.Status)} · PM: ${esc(userName(p.PM_ID))}</p><p class="muted">${esc(p.Health_Summary)}</p></section><section id="workspace-members"></section></div>`;
 if(d.isMember&&!d.canEdit&&p.Status!=='Archived')h+=`<div class="toolbar"><button onclick="newMyIssue(${arg(id)})">+ Báo cáo issue</button></div>`;
 h+='<div class="toolbar workspace-actions">';
 if(d.canEdit&&p.Status!=='Archived')h+=`<button onclick="editProject(${arg(id)})">Edit Project</button><button class="secondary" onclick="editTask(${arg(id)})">+ Task</button><button class="secondary" onclick="editIssue(${arg(id)})">+ Issue</button><button class="secondary" id="manage-project-members">Manage Members</button>`;
 if(S.boot.user.role==='PMO_ADMIN')h+=p.Status==='Archived'?`<button class="secondary" onclick="restoreProject(${arg(id)})">Khôi phục dự án</button><button class="danger-button" onclick="purgeProject(${arg(id)})">Xóa vĩnh viễn</button>`:`<button class="secondary" onclick="archiveProject(${arg(id)})">Archive Project</button>`;
 h+='</div>';
 if(d.canEdit&&p.Status!=='Archived')h+=`<div class="toolbar"><button class="secondary" onclick="showImportTemplate(${arg(id)})">Thêm công việc từ mẫu</button><details><summary>Nâng cao</summary><button class="secondary" onclick="editAssignment(${arg(id)})">Phân bổ nguồn lực</button></details></div>`;
 h+=`<h3>Tasks</h3><div data-task-placeholder></div>`;
 if(d.checklist.length)h+=`<h3 style="margin-top:20px">Checklist hồ sơ / thủ tục (${d.checklist.length})</h3><div class="toolbar">${d.canEdit&&p.Status!=='Archived'?`<button class="secondary" onclick="showImportTemplate(${arg(id)})">Thêm công việc từ mẫu</button>`:''}</div><div class="table-wrap"><table><thead><tr><th>Hạng mục hồ sơ</th><th>Trạng thái</th><th>Hạn</th><th>Minh chứng</th><th></th></tr></thead><tbody>${d.checklist.map(x=>`<tr><td>${esc(x.Item_Name)}</td><td>${x.Status==='Done'?tag('Green'):x.Due_Date&&x.Due_Date<new Date().toISOString().slice(0,10)?tag('Red'):tag('Amber')} ${esc(x.Status)}</td><td>${esc(x.Due_Date)}</td><td>${x.Evidence_URL?`<a href="${esc(x.Evidence_URL)}" target="_blank" rel="noopener">Link</a>`:'—'}</td><td>${(p.Status!=='Archived'&&(d.canEdit||d.myChecklistIds.includes(x.Item_ID)))?`<button class="link" onclick="editChecklist(${arg(x.Item_ID)})">Update</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
 h+=`<h3 style="margin-top:20px">Issues</h3><div class="table-wrap"><table><thead><tr><th>Issue</th><th>Severity</th><th>Status</th><th></th></tr></thead><tbody>${d.issues.map(x=>`<tr><td>${esc(x.Title)}</td><td>${esc(x.Severity)}</td><td>${esc(x.Status)}</td><td>${d.canEdit&&p.Status!=='Archived'?`<button class="link" onclick="editIssue(${arg(id)},${arg(x.Issue_ID)})">Edit</button>`:p.Status!=='Archived'&&d.isMember&&x.Created_By===d.myUserId?`<button class="link" onclick="editMyIssue(${arg(x.Issue_ID)})">Update</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
 perfEnd('project_render',started);return h;}
async function archiveProject(id){if(!confirm('Lưu trữ dự án? Các task, issue, checklist vẫn được giữ và loại khỏi báo cáo vận hành.'))return;try{await gas('setProjectArchived',id,true);closeModal();notify('Đã lưu trữ dự án');S.view='projects';await load();}catch(e){notify(e.message,true);}}
async function restoreProject(id){if(!confirm('Khôi phục dự án về trạng thái On Hold?'))return;try{await gas('setProjectArchived',id,false);closeModal();notify('Đã khôi phục dự án');S.view='projects';await load();}catch(e){notify(e.message,true);}}
async function purgeProject(id){if(!confirm('CHÚ Ý: Xóa vĩnh viễn dự án và tất cả task, assignment, phase, issue, checklist. Hãy sao lưu database trước. Tiếp tục?'))return;const confirmation=prompt('Nhập chính xác PURGE:'+id+' để xác nhận xóa vĩnh viễn:');if(confirmation!=='PURGE:'+id)return;try{await gas('purgeArchivedProject',id,confirmation);closeModal();notify('Đã xóa dự án và dữ liệu liên quan');S.view='projects';await load();}catch(e){notify(e.message,true);}}
async function showImportTemplate(projectId){try{await ensurePortfolio();}catch(e){notify(e.message,true);return;}const unique=[...new Map((S.data.templates||[]).map(x=>[x.Template_ID,x.Template_Name])).entries()];showModal('Task Templates / Mẫu công việc',`<form id="template-form"><div class="form-grid"><label class="field">Template<select name="template">${unique.map(([id,n])=>`<option value="${esc(id)}">${esc(n)}</option>`).join('')}</select></label><label class="field">Tên giai đoạn<input name="phase" value="Thủ tục dự án"></label><label class="field">Ngày bắt đầu<input type="date" name="start" value="${new Date().toISOString().slice(0,10)}"></label></div><div id="template-preview"></div><p class="tiny muted">Tạo công việc theo thứ tự và số ngày của mẫu. Hồ sơ yêu cầu là tùy chọn; để trống sẽ chỉ tạo công việc. Không import trùng mẫu trên cùng dự án.</p><div class="actions"><button type="submit">Thêm công việc</button></div></form>`);const preview=()=>{const steps=S.data.templates.filter(t=>t.Template_ID===$('template-form').elements.template.value).slice().sort((a,b)=>Number(a.Step_No)-Number(b.Step_No));$('template-preview').innerHTML=`<p>Thứ tự · Tên công việc · Số ngày</p><ol>${steps.map(t=>`<li>${esc(t.Task_Name)} · ${esc(t.Duration_Days)} ngày</li>`).join('')}</ol><details><summary>Nâng cao — Hồ sơ yêu cầu (tùy chọn)</summary>${steps.map(t=>`<p>${esc(t.Task_Name)}: ${esc(t.Required_Document||'Không yêu cầu')}</p>`).join('')}</details>`;};$('template-form').elements.template.onchange=preview;preview();$('template-form').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());try{await gas('applyProcedureTemplate',projectId,v.template,v.phase,v.start);closeModal();await load();await openProject(projectId);}catch(err){notify(err.message,true);}};}
function editChecklist(id){const x=S.project.checklist.find(y=>y.Item_ID===id);if(!x)return;showModal('Cập nhật hồ sơ',`<form id="checklist-form"><p><b>${esc(x.Item_Name)}</b></p><div class="form-grid"><label class="field">Status<select name="Status">${['Missing','Preparing','For Approval','Returned','Done','Waived'].map(v=>`<option ${x.Status===v?'selected':''}>${v}</option>`).join('')}</select></label>${S.project.canEdit?`<label class="field">Hạn<input name="Due_Date" type="date" value="${esc(x.Due_Date)}"></label>`:''}<label class="field wide">Link minh chứng<input name="Evidence_URL" value="${esc(x.Evidence_URL)}"></label><label class="field wide">Ghi chú<input name="Notes" value="${esc(x.Notes)}"></label></div><div class="actions"><button type="submit">Lưu</button></div></form>`);$('checklist-form').onsubmit=async e=>{e.preventDefault();try{await gas('saveChecklistItem',{Item_ID:id,...Object.fromEntries(new FormData(e.target).entries())});closeModal();await load();await openProject(x.Project_ID);}catch(err){notify(err.message,true);}};}
const def={projects:{Status:'In Progress',RAG:'Green',Project_Type:'Business'},tasks:{Task_Type:'Task',Status:'Not Started',RAG:'Green',Progress:'0'},issues:{Severity:'Medium',Status:'Open',Decision_Required:'FALSE',Open_Date:new Date().toISOString().slice(0,10)},assignments:{Allocation_Pct:'',Planned_Effort_Days:'',Role:'Contributor'}};
const specs={
 projects:[['Group_ID','Project group','group'],['Project_Name','Project name','text'],['Project_Type','Project type','text'],['Department','Department','text'],['Sponsor','Sponsor','text'],['PM_ID','PM','user'],['Objective','Objective','textarea'],['Start_Date','Start date','date'],['End_Date','End date','date'],['Status','Status','select:Not Started|In Progress|On Hold|Completed|Cancelled'],['RAG','RAG','select:Green|Amber|Red'],['Health_Summary','Health summary','textarea']],
 tasks:[['Phase_ID','Phase','phase'],['Task_Name','Task name','text'],['Parent_Task_ID','Parent task ID (optional)','text'],['Task_Type','Type','select:Task|Summary|Milestone'],['PIC_ID','PIC','user'],['Start_Date','Start','date'],['End_Date','End','date'],['Progress','Progress 0-100','number'],['Status','Status','select:Not Started|In Progress|Blocked|Done'],['RAG','RAG','select:Green|Amber|Red'],['Dependency_ID','Dependency task ID','text'],['Description','Description','textarea']],
 issues:[['Title','Issue title','text'],['Task_ID','Related task ID','text'],['Description','Description','textarea'],['Severity','Severity','select:Low|Medium|High|Critical'],['Impact','Impact','textarea'],['Owner_ID','Owner','user'],['Open_Date','Open date','date'],['Due_Date','Due date','date'],['Status','Status','select:Open|In Progress|Resolved|Closed'],['Resolution_Plan','Resolution plan','textarea'],['Escalation_Level','Escalation level','text'],['Decision_Required','Decision required','select:TRUE|FALSE']],
 assignments:[['Task_ID','Task','task'],['User_ID','Member','user'],['Start_Date','Start','date'],['End_Date','End','date'],['Allocation_Pct','Allocation % (optional)','number'],['Planned_Effort_Days','Planned effort days (optional)','number'],['Role','Assignment role','text']]
};
function formField([key,label,type],value,projectId){let ctrl='';if(type==='textarea')ctrl=`<textarea name="${key}">${esc(value)}</textarea>`;else if(type==='user')ctrl=`<select name="${key}"><option value="">— Select —</option>${S.boot.users.map(u=>`<option value="${esc(u.id)}" ${value===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>`;
 else if(type==='group')ctrl=`<select name="${key}"><option value="">Chưa phân nhóm</option>${(S.data?.groups||[]).map(g=>`<option value="${esc(g.Group_ID)}" ${value===g.Group_ID?'selected':''}>${esc(g.Group_Name)}</option>`).join('')}</select>`;
 else if(type==='phase')ctrl=`<select name="${key}"><option value="">Chưa có giai đoạn</option>${(S.project?.project.Project_ID===projectId?S.project.phases:S.data?.phases||[]).filter(p=>p.Project_ID===projectId).map(p=>`<option value="${esc(p.Phase_ID)}" ${value===p.Phase_ID?'selected':''}>${esc(p.Phase_Name)}</option>`).join('')}</select>`;
 else if(type==='task')ctrl=`<select name="${key}"><option value="">— Select task —</option>${(S.project?.project.Project_ID===projectId?S.project.tasks:S.data?.tasks||[]).filter(t=>t.Project_ID===projectId&&t.Task_Type!=='PHASE').map(t=>`<option value="${esc(t.Task_ID)}" ${value===t.Task_ID?'selected':''}>${esc(t.Task_Name)}</option>`).join('')}</select>`;
 else if(type.startsWith('select:'))ctrl=`<select name="${key}">${type.slice(7).split('|').map(o=>`<option ${value===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
 else ctrl=`<input type="${type}" name="${key}" value="${esc(value)}" ${type==='number'?'step="any"':''}>`;
 return `<label class="field ${type==='textarea'?'wide':''}"><span>${esc(label)}</span>${ctrl}</label>`;}
function editForm(entity,record={},projectId=''){const fromProject=S.view==='workspace';const unified=S.boot?.schemaVersion==='UNIFIED_TASKS_V2';const spec=entity==='tasks'&&unified?specs.tasks.filter(f=>f[0]!=='Phase_ID').map(f=>f[0]==='Task_Type'?['Task_Type','Type','select:PHASE|TASK|MILESTONE']:f):specs[entity];const data={...def[entity],...(entity==='tasks'&&unified?{Task_Type:'TASK'}:{}),...record};const names={projects:'Project',tasks:'Task / Milestone',issues:'Issue',assignments:'Assignment'};showModal(`${record[({projects:'Project_ID',tasks:'Task_ID',issues:'Issue_ID',assignments:'Assignment_ID'})[entity]]?'Edit':'New'} ${names[entity]}`,`<form id="entity-form"><div class="form-grid">${spec.map(f=>formField(f,data[f[0]]||'',projectId)).join('')}</div><div class="actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button type="submit">Save</button></div></form>`);
 $('entity-form').onsubmit=async e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.target).entries());const idField={projects:'Project_ID',tasks:'Task_ID',issues:'Issue_ID',assignments:'Assignment_ID'}[entity];if(record[idField])fields[idField]=record[idField];if(entity!=='projects')fields.Project_ID=projectId;
 const fn={projects:'saveProject',tasks:'saveTask',issues:'saveIssue',assignments:'saveAssignment'}[entity];const form=e.target;if(form.dataset.busy==='true')return;const btn=form.querySelector('button[type=submit]');form.dataset.busy='true';btn.disabled=true;const started=perfStart(),token=S.token;formStatus(form,'Saving...');btn.textContent='Saving...';
 try{const result=await gas(fn,fields);if(token!==S.token)return;form.dataset.busy='false';formStatus(form,'Saved');if(entity==='tasks'){applySavedTask(result.task,projectId,fromProject,result.version);}else{closeModal();notify('Đã lưu '+names[entity]);await load();if(entity!=='projects')await openProject(projectId);else if(fromProject&&record.Project_ID)await openProject(record.Project_ID);}}catch(err){formStatus(form,err.message,true);}finally{form.dataset.busy='false';btn.disabled=false;btn.textContent='Save';perfEnd(entity==='tasks'?(record.Task_ID?'task_update':'task_create'):'entity_save',started);}};}
async function editProject(id){try{await ensurePortfolio();const record=id?S.data.projects.find(x=>x.Project_ID===id):{};editForm('projects',record);}catch(e){notify(e.message,true);}}
function taskRecord(id){return S.project?.tasks.find(x=>x.Task_ID===id)||S.data?.tasks.find(x=>x.Task_ID===id);}
function editTask(projectId,id){if(S.view==='workspace'){if(!id)$('quick-task')?.focus();else workspaceDetails(id);return;}editForm('tasks',id?taskRecord(id):{},projectId);}
function issueRecord(id){return S.project?.issues.find(x=>x.Issue_ID===id)||S.data?.issues.find(x=>x.Issue_ID===id);}
function editIssue(projectId,id){editForm('issues',id?issueRecord(id):{},projectId);}
function editAssignment(projectId){editForm('assignments',{},projectId);}
function editMyTask(id){const fromProject=S.view==='workspace';const t=taskRecord(id);if(!t)return;showModal('Cập nhật task của tôi',`<form id="mine-task"><p><b>${esc(t.Task_Name)}</b> · Deadline ${esc(t.End_Date)}</p><div class="form-grid"><label class="field">Trạng thái<select name="Status">${['Not Started','In Progress','Blocked','Done'].map(x=>`<option ${x===t.Status?'selected':''}>${x}</option>`).join('')}</select></label><label class="field">Tiến độ (%)<input name="Progress" type="number" min="0" max="100" value="${esc(t.Progress)}"></label><label class="field wide">Ghi chú / blocker<textarea name="Member_Update">${esc(t.Member_Update)}</textarea></label></div><div class="actions"><button type="submit">Lưu cập nhật</button></div></form>`);$('mine-task').onsubmit=async e=>{e.preventDefault();const form=e.target;if(form.dataset.busy==='true')return;const f=new FormData(form),btn=form.querySelector('button[type=submit]'),started=perfStart(),token=S.token;form.dataset.busy='true';btn.disabled=true;btn.textContent='Saving...';formStatus(form,'Saving...');try{const result=await gas('updateMyTask',id,f.get('Progress'),f.get('Status'),f.get('Member_Update'));if(token!==S.token)return;form.dataset.busy='false';formStatus(form,'Saved');applySavedTask(result.task,t.Project_ID,fromProject,result.version);}catch(err){formStatus(form,err.message,true);}finally{form.dataset.busy='false';btn.disabled=false;btn.textContent='Lưu cập nhật';perfEnd('task_update',started);}};}
function applySavedTask(task,projectId,fromProject,version){
 if(!task)throw Error('Thiếu phản hồi task đã lưu. Hãy làm mới để kiểm tra.');
 function upsert(list){const index=list.findIndex(x=>x.Task_ID===task.Task_ID);if(index<0)list.push(task);else list[index]=task;}
 if(S.data)upsert(S.data.tasks);
 if(S.project?.project.Project_ID===projectId){upsert(S.project.tasks);const w=WS.projects.get(projectId),row=w?.rows.find(r=>r.task.Task_ID===task.Task_ID);if(row){row.task=task;row.confirmed=task;row.version=version;}else if(w)w.rows.push({key:task.Task_ID,task,patch:{},version});if(w)w.byKey=null;}
 closeModal();
 if(fromProject&&S.project?.project.Project_ID===projectId)renderProject(S.project);
 else if(S.view==='mytasks'&&S.data){const row=$('mytask-'+task.Task_ID);if(row)row.outerHTML=myTaskRow(task);else drawMyTasks();}
 else if(S.view==='gantt'&&S.data)drawGantt();
 notify('Saved');
}
function myTaskRow(t){return `<tr id="mytask-${esc(t.Task_ID)}"><td>${esc(projectName(t.Project_ID))}</td><td>${esc(t.Task_Name)}</td><td>${esc(t.End_Date)}</td><td>${esc(t.Status)}</td><td>${esc(t.Progress)}%</td><td>${S.boot.user.role!=='EXECUTIVE'?`<button class="link" onclick="editMyTask(${arg(t.Task_ID)})">Update</button>`:''}</td></tr>`;}
function drawMyTasks(){const uid=S.boot.user.id;const assigned=new Set(S.data.assignments.filter(x=>x.User_ID===uid).map(x=>x.Task_ID));const my=S.data.tasks.filter(t=>S.data.projects.some(p=>p.Project_ID===t.Project_ID&&p.Status!=='Archived')&&(t.PIC_ID===uid||assigned.has(t.Task_ID)));$('content').innerHTML=`<section class="panel"><h3>My Tasks (${my.length})</h3><div class="table-wrap"><table><thead><tr><th>Dự án</th><th>Task</th><th>Deadline</th><th>Status</th><th>Progress</th><th></th></tr></thead><tbody>${my.map(t=>myTaskRow(t)).join('')}</tbody></table></div></section>`;}
function newMyIssue(projectId){showModal('Báo cáo issue',`<form id="own-issue"><div class="form-grid"><label class="field wide">Vấn đề<input name="Title" required maxlength="200"></label><label class="field">Severity<select name="Severity"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></label><label class="field">Deadline<input name="Due_Date" type="date"></label><label class="field wide">Mô tả<textarea name="Description"></textarea></label><label class="field wide">Tác động<textarea name="Impact"></textarea></label><label class="field wide">Kế hoạch xử lý<textarea name="Resolution_Plan"></textarea></label></div><button type="submit">Tạo issue</button></form>`);$('own-issue').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());try{await gas('saveIssue',{...v,Project_ID:projectId,Owner_ID:S.boot.user.id,Open_Date:new Date().toISOString().slice(0,10),Status:'Open',Decision_Required:'FALSE'});closeModal();await load();await openProject(projectId);}catch(err){notify(err.message,true);}};}
function editMyIssue(issueId){const x=issueRecord(issueId);if(!x)return;showModal('Cập nhật issue',`<form id="own-issue-update"><p><b>${esc(x.Title)}</b></p><label class="field">Trạng thái<select name="Status">${['Open','In Progress','Resolved','Closed'].map(s=>`<option ${s===x.Status?'selected':''}>${s}</option>`).join('')}</select></label><label class="field">Kế hoạch xử lý<textarea name="Resolution_Plan">${esc(x.Resolution_Plan)}</textarea></label><label class="field">Ghi chú<textarea name="Description">${esc(x.Description)}</textarea></label><button type="submit">Lưu</button></form>`);$('own-issue-update').onsubmit=async e=>{e.preventDefault();try{await gas('saveIssue',{Issue_ID:issueId,Project_ID:x.Project_ID,...Object.fromEntries(new FormData(e.target).entries())});closeModal();await load();await openProject(x.Project_ID);}catch(err){notify(err.message,true);}};}
function drawUsers(){if(S.boot.user.role!=='PMO_ADMIN')return;const options=S.boot.users.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} (${esc(x.id)})</option>`).join('');$('content').innerHTML=`<section class="panel"><h3>Cấp / reset tài khoản cho nhân sự có sẵn trong USERS</h3><p class="muted">Tạo một username và mật khẩu tạm. Cấp lại sẽ thu hồi phiên cũ của người dùng.</p><form id="provision-user" class="form-grid"><label class="field">Nhân sự<select name="id">${options}</select></label><label class="field">Username<input name="username" required pattern="[a-z0-9._-]{3,64}"></label><label class="field wide">Mật khẩu tạm (8–128 ký tự)<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><div class="actions"><button type="submit">Cấp tài khoản</button></div></form></section>`;addPasswordToggles($('provision-user'));$('provision-user').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await gas('adminProvisionUser',f.get('id'),f.get('username'),f.get('password'));e.target.reset();notify('Đã tạo/reset tài khoản. Chia sẻ mật khẩu tạm qua kênh riêng.');}catch(err){notify(err.message,true);}};}
function addPasswordToggles(root){
 root.querySelectorAll('input[type="password"]').forEach(input=>{
  const button=document.createElement('button');button.type='button';button.className='secondary password-toggle';button.textContent='Hiện mật khẩu';button.setAttribute('aria-pressed','false');
  button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ẩn mật khẩu':'Hiện mật khẩu';button.setAttribute('aria-pressed',String(show));};input.after(button);
 });
}
function showChangePassword(){if($('change-password')?.dataset.busy==='true')return;showModal('Đổi mật khẩu',`<form id="change-password"><p>Thay đổi mật khẩu tạm trước khi tiếp tục sử dụng.</p><div id="password-error" role="alert" aria-live="assertive"></div><label class="field">Mật khẩu hiện tại<input type="password" name="old" autocomplete="current-password" required></label><label class="field">Mật khẩu mới (8–128 ký tự)<input type="password" name="next" minlength="8" maxlength="128" autocomplete="new-password" required></label><button type="submit">Đổi mật khẩu</button></form>`);$('change-password').onsubmit=async e=>{
 e.preventDefault();const form=e.target;if(form.dataset.busy==='true')return;
 const b=form.querySelector('button[type="submit"]'),f=new FormData(form);form.dataset.busy='true';b.disabled=true;b.setAttribute('aria-busy','true');b.innerHTML='<span class="spinner" aria-hidden="true"></span> Đang cập nhật...';$('password-error').textContent='';$('password-error').className='';
 try{await gas('changePassword',f.get('old'),f.get('next'));form.dataset.busy='false';closeModal();showLogin();notify('Đã đổi mật khẩu. Đăng nhập lại.');}
 catch(err){$('password-error').textContent=err.message;$('password-error').className='error';}
 finally{form.dataset.busy='false';b.disabled=false;b.removeAttribute('aria-busy');b.textContent='Đổi mật khẩu';}
 };}
// CR-002 stage A. Drafts live only in this authenticated browser session's memory.
const WS={projects:new Map(),debounce:650,maxWait:2500,batchSize:50,route:0};
function workspaceDirty(){return [...WS.projects.values()].some(w=>w.pending.size||w.saving)||[...WS.projects.values()].some(w=>w.structureBusy||w.structurePreparing||w.structurePacket||w.detail.structurePending)||!!document.querySelector('#quick-task:not(:placeholder-shown)')||!!document.querySelector('#task-grid [data-dirty="true"]');}
function workspaceLeave(){const current=workspaceCurrent();if(current){document.querySelectorAll('#task-grid [data-dirty="true"]').forEach(el=>workspaceEdit(current,el));const quick=$('quick-task');if(quick?.value.trim()){workspaceAdd(current,quick.value.trim());quick.value='';}}if(workspaceDirty()){WS.projects.forEach(w=>flushWorkspace(w));notify('Đang lưu thay đổi. Bản nháp vẫn được giữ khi chuyển màn hình.');}}
function workspaceIndex(w){
 if(w.byKey)return;
 w.byKey=new Map();w.byId=new Map();w.nodes=new Map();w.errors=new Set();w.editing=new Set();w.children=new Map();w.refsDirty=true;
 w.rows.forEach((r,index)=>{r.index=index;w.byKey.set(r.key,r);w.byId.set(r.task.Task_ID,r);if(r.error)w.errors.add(r.key);const parent=r.task.Parent_Task_ID||'';if(!w.children.has(parent))w.children.set(parent,new Set());w.children.get(parent).add(r);});
}
function workspaceRowNode(w,r){return w.nodes.get(r.key);}
function workspaceStatus(w,rows=[]){
 workspaceIndex(w);if(w.token!==S.token||S.view!=='workspace'||S.project?.project.Project_ID!==w.id)return;
 const editing=w.editing.size||!!$('quick-task')?.value;
 const state=w.saving||w.structureBusy||w.structurePreparing?'Saving':w.error||w.structureError||w.detail.structurePending?'Error':(w.pending.size||editing)?'Unsaved':'Saved',el=$('workspace-save');
 if(el&&el.textContent!==state)el.textContent=state;
 if(el&&el.dataset.state!==state)el.dataset.state=state;
 const error=$('workspace-error');if(error&&error.textContent!==(w.error||'')){error.textContent=w.error||'';error.title=w.error||'';}
 new Set(rows).forEach(r=>{const el=workspaceRowNode(w,r)?.querySelector('[data-save]');if(!el)return;const state=r.error?'Error':r.inflight?'Saving':(w.pending.has(r.key)||w.editing.has(r.key))?'Unsaved':'Saved';if(el.textContent!==state)el.textContent=state;if(el.dataset.state!==state)el.dataset.state=state;if(el.title!==(r.error||''))el.title=r.error||'';});
}
function queueWorkspace(w,row,fields){
 workspaceIndex(w);if(w.detail.schemaVersion==='UNIFIED_TASKS_V2'&&!row.createOpId&&Object.hasOwn(fields,'Parent_Task_ID')&&(fields.Parent_Task_ID||'')!==(row.task.Parent_Task_ID||'')){workspaceSelectStructure(w,row.key);workspaceStructure(w,'reparent',{parentId:fields.Parent_Task_ID});return;}if(['Parent_Task_ID','Sort_Order'].some(k=>Object.hasOwn(fields,k)))w.layoutDirty=true;if(w.detail.schemaVersion==='UNIFIED_TASKS_V2'&&['Parent_Task_ID','Sort_Order','Task_Type','Start_Date','End_Date'].some(k=>Object.hasOwn(fields,k)))w.hierarchy=null;const oldParent=row.task.Parent_Task_ID||'';
 Object.assign(row.task,fields);if(Object.hasOwn(fields,'PIC_ID'))workspaceMembersSection(w);if(Object.hasOwn(fields,'RAG')||Object.hasOwn(fields,'Status'))workspacePaintColors(w,row);
 const expected=row.inflight?{...row.confirmed,...row.sentFields}:row.confirmed;
 Object.entries(fields).forEach(([key,value])=>{if(!row.createOpId&&!row.retry&&!row.error&&String(value)===String(expected?.[key]??''))delete row.patch[key];else row.patch[key]=value;});
 row.error='';w.errors.delete(row.key);w.error=w.errors.size?w.byKey.get(w.errors.values().next().value)?.error||'':'';
 if(Object.keys(row.patch).length||row.retry||row.createOpId)w.pending.add(row.key);else w.pending.delete(row.key);
 if(Object.hasOwn(fields,'Parent_Task_ID')){w.children.get(oldParent)?.delete(row);const parent=row.task.Parent_Task_ID||'';if(!w.children.has(parent))w.children.set(parent,new Set());w.children.get(parent).add(row);}
 if(['Task_Name','Parent_Task_ID','Phase_ID','Task_Type'].some(k=>Object.hasOwn(fields,k))){w.refsDirty=true;if(!row.appending)workspaceRefreshParents(w);}
 clearTimeout(w.timer);
 if(w.pending.size){w.timer=setTimeout(()=>flushWorkspace(w),WS.debounce);if(!w.maxTimer)w.maxTimer=setTimeout(()=>flushWorkspace(w),WS.maxWait);}else{clearTimeout(w.maxTimer);w.maxTimer=null;}
 if(w.detail.schemaVersion==='UNIFIED_TASKS_V2'&&['Parent_Task_ID','Sort_Order','Task_Type','Start_Date','End_Date'].some(k=>Object.hasOwn(fields,k))){if(row.appending)w.layoutDirty=false;else{if(w.layoutDirty)workspaceReorder(w);workspaceSyncCells(w,row);workspaceRefreshDerived(w,[row],oldParent);}}
 workspaceStatus(w,[row]);
}
function workspacePacket(row){return row.retry||{opId:row.createOpId||crypto.randomUUID(),kind:row.createOpId?'create':'update',taskId:row.task.Task_ID,baseVersion:row.version,fields:{...row.patch}};}
async function flushWorkspace(w){
 workspaceIndex(w);clearTimeout(w.timer);clearTimeout(w.maxTimer);w.maxTimer=null;
 if(w.structureBusy||w.saving||!w.pending.size||w.token!==S.token)return;
 const rows=[...w.pending].slice(0,WS.batchSize).map(key=>w.byKey.get(key)),changed=new Set(rows);
 const packets=rows.map(r=>{const packet=workspacePacket(r);r.inflight=true;r.sentPatch={...r.patch};r.sentFields={...packet.fields};r.patch={};w.pending.delete(r.key);return packet;});
 w.saving=true;workspaceStatus(w,rows);
 try{
  const response=await gas('saveTaskBatch',w.id,packets);if(w.token!==S.token)return;
  const outcomes=new Map(response.results.map(result=>[result.opId,result]));
  rows.forEach((r,i)=>{
   const result=outcomes.get(packets[i].opId);
   if(!result?.ok){r.retry=result?.code==='VALIDATION'?null:packets[i];r.patch={...r.sentPatch,...r.patch};r.error=result?.error||'Thiếu xác nhận từ server';w.pending.add(r.key);w.errors.add(r.key);return;}
   const previous=r.task,oldId=previous.Task_ID;if(['Parent_Task_ID','Sort_Order','Task_Type','Start_Date','End_Date'].some(k=>previous[k]!==result.task[k]))w.hierarchy=null;if(previous.Parent_Task_ID!==result.task.Parent_Task_ID||previous.Sort_Order!==result.task.Sort_Order||oldId!==result.id)w.layoutDirty=true;r.retry=null;r.createOpId=null;r.version=result.version;r.confirmed=result.task;r.error='';w.errors.delete(r.key);
   const newer={...r.patch};r.task={...result.task,...newer};w.byId.set(result.id,r);
   if(oldId!==result.id){w.refsDirty=true;const children=w.children.get(oldId)||new Set();children.forEach(child=>{child.task.Parent_Task_ID=result.id;if(child.patch.Parent_Task_ID)child.patch.Parent_Task_ID=result.id;changed.add(child);});w.children.delete(oldId);w.children.set(result.id,children);}
   Object.keys(r.sentPatch).forEach(k=>{if(String(r.sentPatch[k])!==String(packets[i].fields[k]??'')&&!Object.hasOwn(newer,k))r.patch[k]=r.sentPatch[k];});
   // Remove only patches that match the newly confirmed baseline; keep reverts of in-flight edits.
   Object.keys(r.patch).forEach(k=>{if(String(r.patch[k])===String(result.task[k]??''))delete r.patch[k];});
   Object.assign(r.task,r.patch);if(['Task_Name','Parent_Task_ID','Phase_ID','Task_Type'].some(k=>previous[k]!==r.task[k]))w.refsDirty=true;if(Object.keys(r.patch).length)w.pending.add(r.key);else w.pending.delete(r.key);
   w.detail.tasks[r.index]=r.task;
   if(S.data){const index=S.data.tasks.findIndex(t=>t.Task_ID===result.id);if(index<0)S.data.tasks.push(result.task);else S.data.tasks[index]=result.task;}
  });
  S.revision++;S.dash=null;S.work=null;
 }catch(error){rows.forEach((r,i)=>{r.retry=packets[i];r.patch={...r.sentPatch,...r.patch};r.error=error.message;w.pending.add(r.key);w.errors.add(r.key);});}
 finally{
  rows.forEach(r=>r.inflight=false);w.saving=false;w.error=w.errors.size?w.byKey.get(w.errors.values().next().value)?.error||'':'';
  if(w.token===S.token&&S.view==='workspace'&&S.project?.project.Project_ID===w.id){
   changed.forEach(r=>workspaceSyncCells(w,r));workspaceReorder(w);workspaceRefreshDerived(w,[...changed]);if(w.refsDirty)workspaceRefreshParents(w);
  }
  workspaceStatus(w,changed);if(w.token===S.token&&!w.error&&w.pending.size)w.timer=setTimeout(()=>flushWorkspace(w),WS.debounce);
 }
}
function workspaceRefreshDerived(w,changed=[],previousParent=''){
 if(w.detail.schemaVersion!=='UNIFIED_TASKS_V2')return;
 const affected=new Set(changed),seen=new Set();
 function ancestors(id){while(id&&!seen.has(id)){seen.add(id);const row=w.byId.get(id);if(!row)break;affected.add(row);id=row.task.Parent_Task_ID;}}
 changed.forEach(row=>ancestors(row.task.Parent_Task_ID));ancestors(previousParent);
 affected.forEach(row=>workspaceSyncCells(w,row));
 drawWorkspaceTimeline(w,[...affected]);
}
function workspaceSyncCells(w,r){
 const display=workspaceDisplayTask(w,r),node=workspaceRowNode(w,r);
 if(node&&w.detail.schemaVersion==='UNIFIED_TASKS_V2'){const typeChanged=node.dataset.taskType!==display.Task_Type,derivedChanged=node.dataset.derived!==String(!!display._derived);if(typeChanged||derivedChanged){const table=document.createElement('table');table.innerHTML='<tbody>'+workspaceRowHtml(w,r,0)+'</tbody>';const fresh=table.rows[0];[...(typeChanged?[2,5]:[]),...(derivedChanged?[6,7,8]:[])].forEach(i=>node.cells[i].replaceWith(fresh.cells[i].cloneNode(true)));node.dataset.taskType=display.Task_Type;node.dataset.derived=String(!!display._derived);}}
 workspaceRowNode(w,r)?.querySelectorAll('input[data-field],select[data-field]').forEach(input=>{const key=input.dataset.field;if(input!==document.activeElement&&input.dataset.dirty!=='true'&&!Object.hasOwn(r.patch,key)){const value=key==='Duration'?workspaceDuration(display):['Parent_Task_ID','PIC_ID'].includes(key)?workspaceReferenceLabel(w,key,r.task[key]):display[key]||'';if(input.value!==String(value))input.value=value;input.dataset.original=input.value;if(['PIC_ID','Parent_Task_ID'].includes(key)&&input.title!==String(value))input.title=value;}});
 if(w.detail.schemaVersion==='UNIFIED_TASKS_V2'){['Start_Date','End_Date','Duration'].forEach((key,i)=>{const cell=workspaceRowNode(w,r)?.cells[6+i];if(cell&&!cell.querySelector('[data-field]')){const value=String(key==='Duration'?workspaceDuration(display):display[key]||'');if(cell.textContent!==value)cell.textContent=value;}});}
 workspaceProgressPaint(w,r);workspacePaintColors(w,r);
}
function bindModalReferences(root){
 root.querySelectorAll('input[list]').forEach(input=>{
  input.dataset.referenceList=input.getAttribute('list');input.removeAttribute('list');input.dataset.modalReference='true';input.dataset.referenceValue=input.value;input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
  const open=query=>workspaceOpenReference(workspaceCurrent(),input,query);
  input.onfocus=()=>open();input.onclick=()=>open();input.oninput=()=>open(input.value);input.onblur=()=>workspaceCloseReference();
  input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Tab'){workspaceCloseReference();return;}if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(!WS.referenceEditor){open();return;}const active=WS.referenceEditor;if(e.key==='Enter')workspaceChooseReference(active,active.index);else{active.index=Math.max(0,Math.min(active.options.length-1,active.index+(e.key==='ArrowDown'?1:-1)));workspaceHighlightReference(active);}}};
 });
}
function workspaceMemberWarnings(w){
 const memberIds=new Set(w.detail.members.map(m=>m.User_ID));memberIds.add(w.detail.project.PM_ID);
 const counts=new Map();w.rows.forEach(r=>{const id=r.task.PIC_ID;if(id&&!memberIds.has(id))counts.set(id,(counts.get(id)||0)+1);});
 return [...counts].map(([id,count])=>workspaceAssigneeLabel(w,id)+' ('+count+' task)');
}
function workspaceMembersSection(w){
 const section=$('workspace-members');if(!section)return;
 const warnings=workspaceMemberWarnings(w),names=w.detail.members.map(m=>workspaceAssigneeLabel(w,m.User_ID)+' ('+m.Project_Role+')');
 const signature=JSON.stringify([w.detail.canEdit,names,warnings]);if(w.memberSectionNode===section&&w.memberSectionSignature===signature)return;w.memberSectionNode=section;w.memberSectionSignature=signature;
 section.innerHTML=`<div class="toolbar"><b>Project Members</b></div><p>${esc(names.join(', ')||'Chưa có membership riêng. PM dự án luôn tham gia.')}</p><p id="workspace-member-warning" class="member-warning">${warnings.length?'⚠ PIC chưa là Project Member: '+esc(warnings.join('; '))+'. Chưa tự thêm thành viên.':''}</p>`;
 if($('manage-project-members'))$('manage-project-members').onclick=()=>workspaceManageMembers(w);
}
function workspaceApplyMemberReferences(w,result){
 w.detail.members=result.members;w.detail.assigneeUsers=result.assigneeUsers;w.detail.nonMemberPics=result.nonMemberPics;w.assigneeMap=null;workspaceAssignees(w);
 w.nodes.forEach((tr,key)=>{const row=w.byKey.get(key),cell=tr.querySelector('[data-col="2"]'),editor=cell?.querySelector('[data-field="PIC_ID"]'),label=workspaceAssigneeLabel(w,row.task.PIC_ID);if(editor&&editor!==document.activeElement&&editor.value!==label){editor.value=label;editor.title=label;editor.dataset.original=label;}else if(cell&&!editor){if(cell.textContent!==label)cell.textContent=label;if(cell.title!==label)cell.title=label;}});
 workspaceMembersSection(w);
}
function workspaceMemberOptions(w){
 const draft=w.memberDraft,existing=new Set(draft.settings.members.map(m=>m.User_ID));existing.add(w.detail.project.PM_ID);
 const counts=new Map();draft.settings.activeUsers.forEach(u=>counts.set(u.id,(counts.get(u.id)||0)+1));
 return draft.settings.activeUsers.filter(u=>u.id===u.id.trim()&&counts.get(u.id)===1&&!existing.has(u.id)&&!draft.add.has(u.id)).map(u=>({id:u.id,label:u.name?.trim()||'Chưa có tên ('+u.id+')',search:[u.name,u.email,u.department,u.id].filter(Boolean).join(' '),metadata:[u.email,u.department].filter(Boolean).join(' · ')}));
}
function workspaceMemberBlock(w,id){
 const blocks=w.memberDraft.settings.removalBlocks||{};if(Object.hasOwn(blocks,id))return blocks[id];
 if(id===w.detail.project.PM_ID)return 'PM dự án luôn tham gia.';
 const pending=w.rows.filter(r=>r.task.PIC_ID===id&&r.task.Status!=='Done');return pending.length?'Còn '+pending.length+' task/bản nháp đang phụ trách. Cần phân công lại và lưu trước.':'';
}
function workspaceMemberDraftPaint(w){
 const draft=w.memberDraft,form=$('project-members-form');if(!form)return;
 const userMap=new Map([...draft.settings.assigneeUsers,...draft.settings.activeUsers].map(u=>[u.id,u]));
 const label=id=>userMap.get(id)?.name?.trim()||'Không có tên ('+id+')';
 $('member-additions').innerHTML=[...draft.add].map(id=>`<span class="member-chip">${esc(label(id))}<button type="button" data-unpick="${esc(id)}" aria-label="Bỏ lựa chọn ${esc(label(id))}">×</button></span>`).join('');
 $('member-existing').innerHTML=draft.settings.members.map(m=>{const reason=workspaceMemberBlock(w,m.User_ID),selected=draft.remove.has(m.User_ID);return `<label class="member-row"><input type="checkbox" data-remove="${esc(m.User_ID)}" ${selected?'checked':''} ${reason&&!selected?'disabled':''}><span>Gỡ ${esc(label(m.User_ID))} <small>${esc(m.Project_Role)}</small>${reason?`<small class="member-warning">${esc(reason)}</small>`:''}</span></label>`;}).join('')||'<p>Chưa có membership riêng.</p>';
 $('members-submit').disabled=!draft.add.size&&!draft.remove.size;$('member-change-count').textContent=draft.add.size+' thêm · '+draft.remove.size+' gỡ';
}
async function workspaceManageMembers(w){
 if(!w.detail.canEdit||modalBusy())return;
 showModal('Project Members','<p role="status">Đang tải thành viên...</p><button type="button" data-cancel onclick="closeModal()">Cancel</button>');
 const ticket=S.modalVersion,token=S.token;
 try{
  const settings=await gas('getProjectMemberSettings',w.id);if(ticket!==S.modalVersion||token!==S.token)return;if(S.view!=='workspace'||S.project?.project.Project_ID!==w.id){closeModal();return;}
  workspaceApplyMemberReferences(w,settings);w.memberDraft={settings,add:new Set(),remove:new Set()};
  showModal('Project Members',`<form id="project-members-form"><label class="field">Thêm nhân sự có sẵn<input id="member-user-search" role="combobox" data-field="Member_User_ID" aria-label="Thêm thành viên" aria-expanded="false" aria-autocomplete="list" autocomplete="off" placeholder="Tìm theo tên, email hoặc phòng ban"></label><div id="member-additions" class="member-chips"></div><div id="member-existing"></div><p class="tiny muted">PM dự án luôn tham gia. Chỉ thêm với vai trò Member. Lịch sử PIC/assignment được giữ; quyền xem còn phụ thuộc công việc được giao.</p><div class="actions"><span id="member-change-count" role="status"></span><button type="button" data-cancel class="secondary" onclick="closeModal()">Cancel</button><button type="submit" id="members-submit">Áp dụng</button></div></form>`);
  workspaceMemberDraftPaint(w);const input=$('member-user-search');
  input.onfocus=()=>workspaceOpenReference(w,input);input.onclick=()=>workspaceOpenReference(w,input);input.oninput=()=>workspaceOpenReference(w,input,input.value);input.onblur=()=>workspaceCloseReference();
  input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Tab'){workspaceCloseReference();return;}if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();if(!WS.referenceEditor){workspaceOpenReference(w,input);return;}const active=WS.referenceEditor;if(e.key==='Enter')workspaceChooseReference(active,active.index);else{active.index=Math.max(0,Math.min(active.options.length-1,active.index+(e.key==='ArrowDown'?1:-1)));workspaceHighlightReference(active);}}};
  $('project-members-form').onclick=e=>{const id=e.target.dataset.unpick;if(id){w.memberDraft.add.delete(id);workspaceMemberDraftPaint(w);}};
  $('project-members-form').onchange=e=>{const id=e.target.dataset.remove;if(id){if(e.target.checked&&workspaceMemberBlock(w,id)){e.target.checked=false;formStatus(e.currentTarget,workspaceMemberBlock(w,id),true);return;}if(e.target.checked)w.memberDraft.remove.add(id);else w.memberDraft.remove.delete(id);workspaceMemberDraftPaint(w);}};
  $('project-members-form').onsubmit=async e=>{
   e.preventDefault();const form=e.target;if(form.dataset.busy==='true')return;form.dataset.busy='true';const controls=[...form.querySelectorAll('input,button:not([data-cancel])')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);formStatus(form,'Saving...');workspaceCloseReference();
   try{
    const result=await gas('saveProjectMembers',w.id,{addUserIds:[...w.memberDraft.add],removeUserIds:[...w.memberDraft.remove]});if(token!==S.token)return;
    workspaceApplyMemberReferences(w,result);
    S.revision++;S.dash=null;S.data=null;workspaceMembersSection(w);form.dataset.busy='false';closeModal();
   }catch(error){if(token===S.token)formStatus(form,error.message+' Danh sách có thể đã thay đổi một phần; thử lại sẽ kiểm tra dữ liệu hiện tại.',true);}
   finally{form.dataset.busy='false';controls.forEach(([el,disabled])=>el.disabled=disabled);}
  };
 }catch(error){if(ticket===S.modalVersion&&token===S.token){$('modal-content').innerHTML='<p role="alert">'+esc(error.message)+'</p><button type="button" data-cancel onclick="closeModal()">Cancel</button>';}}
}
function workspacePaintColors(w,r){
 if(w.token!==S.token||S.view!=='workspace'||S.project?.project.Project_ID!==w.id)return;
 workspaceRowNode(w,r)?.querySelectorAll('[data-color-field]').forEach(cell=>{const value=r.task[cell.dataset.colorField]||'';if(cell.dataset.value!==value)cell.dataset.value=value;});
}
function cancelLayer(layer){
 if(!layer)return false;
 const button=[...layer.querySelectorAll('button')].find(b=>b.type!=='submit'&&!b.disabled&&(b.hasAttribute('data-cancel')||/^(Cancel|Hủy|Huỷ|Hủy bỏ|Huỷ bỏ)$/i.test(b.textContent.trim())));
 if(!button)return false;button.click();return true;
}
document.addEventListener('pointerdown',e=>{const active=WS.referenceEditor;if(active&&e.target!==active.input&&!active.list.contains(e.target))workspaceCloseReference();},true);
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape'||e.isComposing||e.repeat||e.defaultPrevented)return;
 if(WS.referenceEditor){workspaceCloseReference();e.preventDefault();e.stopImmediatePropagation();return;}
 const layer=!$('modal').classList.contains('hidden')?$('modal-content'):document.activeElement?.closest('form,[data-cancel-layer]');
 if(cancelLayer(layer)){e.preventDefault();e.stopImmediatePropagation();}
},true);
function workspaceParentOptions(w){
 workspaceIndex(w);if(!w.refsDirty&&w.parentOptions)return w.parentOptions;
 const names=new Map();w.rows.forEach(r=>names.set(r.task.Task_Name,(names.get(r.task.Task_Name)||0)+1));
 w.parentOptions=w.rows.map(r=>{const path=[],seen=new Set([r.task.Task_ID]);let parent=w.byId.get(r.task.Parent_Task_ID);while(parent&&!seen.has(parent.task.Task_ID)){seen.add(parent.task.Task_ID);path.unshift(parent.task.Task_Name);parent=w.byId.get(parent.task.Parent_Task_ID);}const phase=w.detail.schemaVersion==='UNIFIED_TASKS_V2'?null:w.detail.phases.find(p=>p.Phase_ID===r.task.Phase_ID);if(phase)path.unshift(phase.Phase_Name);const context=path.join(' › '),label=names.get(r.task.Task_Name)>1?[...path,r.task.Task_Name].join(' › ')+' · hàng '+(r.index+1):r.task.Task_Name;return {id:r.task.Task_ID,key:r.key,label,metadata:context,search:[label,context].join(' ')};});
 w.parentLabels=new Map(w.parentOptions.map(o=>[o.id,o.label]));w.refsDirty=false;return w.parentOptions;
}
function workspaceParentLabel(w,id){if(!id)return '';workspaceParentOptions(w);return w.parentLabels.get(id)||'Task không khả dụng';}
function workspaceRefreshParents(w){
 workspaceParentOptions(w);if(w.token!==S.token||WS.projects.get(w.id)!==w||S.view!=='workspace'||S.project?.project.Project_ID!==w.id)return;
 w.nodes.forEach((tr,key)=>{const input=tr.querySelector('[data-field="Parent_Task_ID"]');if(input&&input!==document.activeElement){const value=workspaceParentLabel(w,w.byKey.get(key).task.Parent_Task_ID);if(input.value!==value)input.value=value;input.dataset.original=value;if(input.title!==value)input.title=value;}});
}
function workspaceAssignees(w){
 if(w.assigneeMap)return;
 const users=w.detail.assigneeUsers||S.boot.users.map(u=>({...u,active:true}));
 w.assigneeMap=new Map();w.ambiguousAssignees=new Set();
 users.forEach(u=>{if(w.assigneeMap.has(u.id))w.ambiguousAssignees.add(u.id);else w.assigneeMap.set(u.id,u);});
 const members=new Set((w.detail.members||[]).map(m=>m.User_ID));members.add(w.detail.project.PM_ID);
 w.assigneeOptions=[{id:'',label:'Chưa giao PIC',search:'Chưa giao PIC'}];
 w.assigneeMap.forEach(u=>{if(u.active&&u.id===String(u.id).trim()&&members.has(u.id)&&!w.ambiguousAssignees.has(u.id))w.assigneeOptions.push({id:u.id,label:u.name?.trim()||'Chưa có tên ('+u.id+')',search:[u.name,u.email,u.department].filter(Boolean).join(' '),metadata:[u.email,u.department].filter(Boolean).join(' · ')});});
}
function workspaceAssigneeLabel(w,id){
 if(!id)return '';workspaceAssignees(w);if(w.ambiguousAssignees.has(id))return 'Trùng mã người dùng ('+id+')';
 const u=w.assigneeMap.get(id);if(!u)return 'Không tìm thấy người dùng ('+id+')';
 return (u.name?.trim()||'Chưa có tên ('+id+')')+(u.active?'':' (ngừng hoạt động)')+(id===String(id).trim()?'':' (mã có khoảng trắng)');
}
function workspaceReferenceLabel(w,field,id){return field==='PIC_ID'?workspaceAssigneeLabel(w,id):workspaceParentLabel(w,id);}
function workspaceValidParent(w,row,parentId){
 if(row.task.Task_Type==='PHASE'&&parentId)return false;
 const affected=[],seen=new Set();function collect(r){if(seen.has(r.key))return;seen.add(r.key);affected.push(r);(w.children.get(r.task.Task_ID)||[]).forEach(collect);}collect(row);
 return affected.every(r=>{
  let current=r,depth=1,phase=!!r.task.Phase_ID;const visited=new Set([r.key]);
  while(current){const id=current.key===row.key?parentId:current.task.Parent_Task_ID;if(!id)break;const p=w.byId.get(id);if(!p||p.task.Project_ID!==w.id||['Milestone','MILESTONE'].includes(p.task.Task_Type)||visited.has(p.key))return false;visited.add(p.key);depth++;phase=phase||!!p.task.Phase_ID;current=p;}
  return depth+(w.detail.schemaVersion!=='UNIFIED_TASKS_V2'&&phase?1:0)<=4;
 });
}
function workspaceReferenceOptions(w,r,field){
 if(field==='Member_User_ID')return workspaceMemberOptions(w);
 if(field==='PIC_ID'){workspaceAssignees(w);return w.assigneeOptions;}
 return [{id:'',label:'No Parent — Không có Parent'},...workspaceParentOptions(w).filter(o=>w.byId.get(o.id)?.task.Project_ID===w.id&&workspaceValidParent(w,r,o.id))];
}
function workspaceCloseReference(restore=true){
 const active=WS.referenceEditor;if(!active)return;
 if(restore){active.input.value=active.field==='Form_Reference'?active.input.dataset.referenceValue||'':active.field==='Member_User_ID'?'':workspaceReferenceLabel(active.w,active.field,active.r.task[active.field]);active.input.dataset.dirty='false';active.input.dataset.original=active.input.value;}
 active.input.setAttribute('aria-expanded','false');active.input.removeAttribute('aria-activedescendant');active.input.removeAttribute('aria-controls');active.list.remove();WS.referenceEditor=null;
}
function workspaceOpenReference(w,input,query=''){
 const field=input.dataset.modalReference?'Form_Reference':input.dataset.field;let active=WS.referenceEditor;
 if(active?.input!==input){
  workspaceCloseReference();const r=['Member_User_ID','Form_Reference'].includes(field)?null:w.byKey.get(input.closest('tr').dataset.row),list=document.createElement('div');list.id='workspace-reference-options';list.className='reference-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',field==='PIC_ID'?'Chọn PIC':field==='Member_User_ID'?'Thêm thành viên':field==='Form_Reference'?'Chọn tham chiếu':'Chọn Parent');document.body.append(list);
  active={w,r,input,list,field,baseOptions:field==='Form_Reference'?[{id:'',label:'Không chọn'},...[...$(input.dataset.referenceList).options].map(o=>({id:o.value,label:o.label||o.textContent||o.value,search:[o.value,o.label,o.textContent].join(' ')}))]:workspaceReferenceOptions(w,r,field),options:[],index:0};WS.referenceEditor=active;
 }
 const {list}=active,rect=input.getBoundingClientRect();list.style.left=Math.max(8,Math.min(rect.left,innerWidth-360))+'px';list.style.top=Math.max(8,Math.min(rect.bottom,innerHeight-210))+'px';list.style.width=Math.max(320,rect.width)+'px';
 const needle=query.toLocaleLowerCase();if(active.query===needle)return;active.query=needle;active.options=active.baseOptions.filter(o=>(o.search||o.label).toLocaleLowerCase().includes(needle));active.index=0;
 input.setAttribute('aria-expanded','true');input.setAttribute('aria-controls',list.id);
 // All eligible matches are available; scrolling the fixed overlay never changes row geometry.
 list.innerHTML=active.options.length?active.options.map((o,i)=>`<div role="option" id="reference-option-${i}" data-option="${i}" aria-selected="${i===0}">${esc(o.label)}${o.metadata?`<small class="muted">${esc(o.metadata)}</small>`:''}</div>`).join(''):'<div role="status">Không tìm thấy kết quả</div>';
 list.onpointerdown=e=>{const option=e.target.closest('[data-option]');if(option){e.preventDefault();workspaceChooseReference(active,Number(option.dataset.option));}};workspaceHighlightReference(active);
}
function workspaceHighlightReference(active){
 const {list,input,index}=active;list.querySelectorAll('[role="option"]').forEach((el,i)=>{const selected=String(i===index);if(el.getAttribute('aria-selected')!==selected)el.setAttribute('aria-selected',selected);});
 const option=list.children[index];if(option?.getAttribute('role')==='option'){input.setAttribute('aria-activedescendant',option.id);if(option.offsetTop<list.scrollTop)list.scrollTop=option.offsetTop;else if(option.offsetTop+option.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=option.offsetTop+option.offsetHeight-list.clientHeight;}
}
function workspaceChooseReference(active,index){
 const option=active.options[index];if(!option)return;const {w,r,input,field}=active;
 if(field==='Form_Reference'){workspaceCloseReference(false);input.value=option.id;input.dataset.referenceValue=option.id;return;}
 if(field==='Member_User_ID'){workspaceCloseReference(false);w.memberDraft.add.add(option.id);input.value='';input.title='';workspaceMemberDraftPaint(w);return;}
 const id=field==='Parent_Task_ID'?(w.byId.get(option.id)?.task.Task_ID||option.id):option.id;
 if(field==='Parent_Task_ID'&&!workspaceValidParent(w,r,id)){workspaceCloseReference();notify('Parent không hợp lệ hoặc vượt quá 4 cấp.',true);return;}
 workspaceCloseReference(false);input.value=id?workspaceReferenceLabel(w,field,id):'';input.title=input.value;input.dataset.referenceId=id;workspaceEdit(w,input);delete input.dataset.referenceId;input.dataset.original=input.value;input.dataset.dirty='false';w.editing.delete(r.key);workspaceStatus(w,[r]);
}
function workspaceProgressPaint(w,r){
 const button=workspaceRowNode(w,r)?.querySelector('[data-progress]');if(!button)return;const p=Math.max(0,Math.min(100,Number(r.task.Progress)||0)),label=p+'%';
 if(button.textContent!==label)button.textContent=label;if(button.style.getPropertyValue('--progress')!==p+'%')button.style.setProperty('--progress',p+'%');const aria='Tiến độ '+p+'%; tăng 25%';if(button.getAttribute('aria-label')!==aria)button.setAttribute('aria-label',aria);if(button.dataset.complete!==String(p===100))button.dataset.complete=String(p===100);
}
function workspaceQuickProgress(w,r){if(!w.detail.canEdit&&!w.detail.myTaskIds.includes(r.task.Task_ID))return;const p=Number(r.task.Progress)>=100?0:Math.min(100,(Number(r.task.Progress)||0)+25);if(p!==Number(r.task.Progress)){queueWorkspace(w,r,{Progress:String(p)});workspaceProgressPaint(w,r);const input=workspaceRowNode(w,r)?.querySelector('[data-field="Progress"]');if(input)input.value=p;}}
function workspaceCurrent(){return WS.projects.get(S.project?.project.Project_ID);}
function workspaceRetry(){const w=workspaceCurrent();if(w.structureError&&!w.structurePacket&&!w.detail.structurePending&&!w.error)return workspaceCompare(w);if(w.error)w.structureError='';if(w.detail.structurePending)return workspaceStructureRecover(w,'RESUME');if(w.structurePacket)return workspaceStructure(w,'',{},true);w.error='';w.errors.forEach(key=>{w.byKey.get(key).error='';});w.errors.clear();flushWorkspace(w);}
async function workspaceCompare(w){
 if(w.structureError){try{const latest=await gas('getProjectDetail',w.id);if(w.token!==S.token)return;if(confirm('Cấu trúc đã thay đổi. Tải cấu trúc hiện tại, giữ các bản nháp rồi chọn lại thao tác?')){workspaceMergeStructure(w,latest,true);w.structurePacket=null;w.structureError='';workspaceStructurePaint(w);workspaceStatus(w);}}catch(error){w.structureError=error.message;workspaceStatus(w);}return;}
 if(w.saving)return;try{
  const latest=await readGas('getProjectDetail',w.id);if(w.token!==S.token)return;
  for(const r of w.rows.filter(r=>r.error&&!r.createOpId)){
   const server=latest.tasks.find(t=>t.Task_ID===r.task.Task_ID);if(!server){notify('Task không còn tồn tại; bản nháp được giữ.',true);continue;}
   const patch={...(r.retry?.fields||{}),...r.patch};
   const referenceName=id=>id?(latest.tasks.find(t=>t.Task_ID===id)?.Task_Name||w.byId.get(id)?.task.Task_Name||'Task không khả dụng'):'Không có Parent';
   const comparison=Object.entries(patch).map(([key,value])=>(workspaceColumns.find(c=>c[0]===key)?.[1]||key)+': '+(key==='Parent_Task_ID'?referenceName(server[key]):key==='PIC_ID'?workspaceAssigneeLabel(w,server[key]):String(server[key]||'—'))+' → '+(key==='Parent_Task_ID'?referenceName(value):key==='PIC_ID'?workspaceAssigneeLabel(w,value):String(value))).join('\n');
   if(confirm('Đối chiếu task '+r.task.Task_Name+'\nGiá trị hiện tại → thay đổi của bạn:\n'+comparison+'\nÁp dụng trên phiên bản mới?')){
    r.retry=null;r.version=latest.taskVersions[r.task.Task_ID];r.error='';queueWorkspace(w,r,patch);
   }
  }
 }catch(error){notify(error.message,true);}
}
async function openProject(id,fromHistory=false){
 if(modalBusy())return;
 workspaceCloseReference();workspaceLeave();const ticket=++WS.route,token=S.token;S.renderVersion++;S.projectRequest++;S.view='workspace';
 if(!fromHistory&&location.hash!=='#project='+encodeURIComponent(id))history.pushState(null,'','#project='+encodeURIComponent(id));
 $('page-title').textContent='Project Workspace';$('content').innerHTML='<section class="panel" role="status">Đang tải dự án...</section>';
 try{
  let w=WS.projects.get(id);
  if(!w||(!w.pending.size&&!w.saving&&!w.structureBusy&&!w.structurePreparing&&!w.structurePacket&&!w.detail.structurePending)){
   const detail=await readGas('getProjectDetail',id);if(ticket!==WS.route||token!==S.token||S.view!=='workspace')return;
   w={id,token,detail,rows:detail.tasks.map(t=>({key:t.Task_ID,task:{...t},confirmed:t,version:detail.taskVersions[t.Task_ID],patch:{}})),pending:new Set(),saving:false,collapsed:new Set(),timeline:false,grain:1};WS.projects.set(id,w);
  }
  if(ticket!==WS.route||token!==S.token||S.view!=='workspace')return;
  S.project=w.detail;renderProject(w.detail);
 }catch(error){if(ticket===WS.route)$('content').textContent=error.message;}
}
function renderProject(d){
 const w=WS.projects.get(d.project.Project_ID);if(!w)return;
 const p=d.project;S.view='workspace';S.project=d;
 $('page-title').textContent=p.Project_Name;$('subtitle').textContent='Project Workspace';
 // Keep checklist/issue forms and authorization controls from the established workspace renderer.
 $('content').innerHTML='<section class="panel" data-project-workspace>'+buildWorkspaceSections(d)+'</section>';
 $('modal').classList.add('hidden');
 const root=$('content').firstElementChild;root.classList.add('panel');
 const crumb=document.createElement('div');crumb.className='toolbar';crumb.innerHTML='<button class="link" id="workspace-portfolio">Portfolio</button> <span>› Project</span>';
 root.prepend(crumb);$('workspace-portfolio').onclick=()=>chooseView('projects');
 const headings=[...root.querySelectorAll('h3')],taskHeading=headings.find(h=>h.textContent==='Tasks'),issueHeading=headings.find(h=>h.textContent==='Issues');
 if(issueHeading){const table=issueHeading.nextElementSibling;root.insertBefore(issueHeading,taskHeading);root.insertBefore(table,taskHeading);issueHeading.textContent='Issues — '+d.issues.filter(x=>!['Resolved','Closed'].includes(x.Status)).length+' đang mở';
  table.querySelectorAll('tbody tr').forEach((tr,i)=>{const x=d.issues[i];tr.cells[0].append(document.createTextNode(' · '+userName(x.Owner_ID)+' · '+(x.Due_Date||'—')+' · '+(x.Decision_Required==='TRUE'?'⚑ Decision ':'')+(x.Escalation_Level||'')));});}
 if(taskHeading){const old=taskHeading.nextElementSibling;const grid=document.createElement('section');grid.id='workspace-grid';taskHeading.after(grid);old.remove();}
 const add=[...root.querySelectorAll('button')].find(b=>b.textContent==='+ Task');if(add)add.onclick=()=>$('quick-task')?.focus();
 workspaceMembersSection(w);
 drawWorkspaceGrid(w);
}
// Stage C: structural RPCs serialize with the existing save queue; ordinary drafts stay local.
function workspaceStructureVersion(w){return JSON.stringify(w.rows.map(r=>r.confirmed||r.task).slice().sort((a,b)=>a.Task_ID<b.Task_ID?-1:a.Task_ID>b.Task_ID?1:0).map(t=>[t.Task_ID,t.Project_ID,t.Parent_Task_ID||'',String(t.Sort_Order||''),t.Task_Type]));}
function workspaceSelectStructure(w,key,event){
 if(w.structureBusy||w.structurePreparing)return;
 if(event?.shiftKey&&w.structureAnchor){const visible=workspaceOrdered(w).map(x=>x.r.key),a=visible.indexOf(w.structureAnchor),b=visible.indexOf(key);if(a>=0&&b>=0)w.structureSelection=new Set(visible.slice(Math.min(a,b),Math.max(a,b)+1));}
 else if(event&&(event.ctrlKey||event.metaKey)){const selection=new Set(w.structureSelection||[]);if(selection.has(key))selection.delete(key);else selection.add(key);w.structureSelection=selection;w.structureAnchor=key;}
 else{w.structureSelection=new Set([key]);w.structureAnchor=key;}
 workspaceStructurePaint(w);
}
function workspaceStructureSelection(w){return [...(w.structureSelection||[])].map(k=>w.byKey.get(k)).filter(Boolean);}
function workspaceStructureRoots(w){const selected=new Set(workspaceStructureSelection(w).map(r=>r.task.Task_ID));return workspaceHierarchy(w).ordered.map(x=>w.byId.get(x.task.Task_ID)).filter(r=>{if(!selected.has(r.task.Task_ID))return false;let p=r.task.Parent_Task_ID;while(p){if(selected.has(p))return false;p=w.byId.get(p)?.task.Parent_Task_ID;}return true;});}
function workspaceStructureReady(w){return w.detail.canEdit&&w.detail.schemaVersion==='UNIFIED_TASKS_V2'&&!w.structureBusy&&!w.structurePreparing&&!w.structurePacket&&!w.detail.structurePending;}
function workspaceStructureAllowed(w,action){
 if(!workspaceStructureReady(w))return false;
 const rows=workspaceStructureRoots(w);if(!rows.length)return false;const parent=rows[0].task.Parent_Task_ID||'';if(rows.some(r=>(r.task.Parent_Task_ID||'')!==parent))return false;
 const siblings=w.rows.filter(r=>(r.task.Parent_Task_ID||'')===parent).sort((a,b)=>Number(a.task.Sort_Order||Number.MAX_SAFE_INTEGER)-Number(b.task.Sort_Order||Number.MAX_SAFE_INTEGER)||a.index-b.index),positions=rows.map(r=>siblings.indexOf(r));if(positions.some((p,i)=>i&&p!==positions[i-1]+1))return false;const first=positions[0],last=positions.at(-1);
 if(action==='up')return first>0;if(action==='down')return last<siblings.length-1;
 if(action==='outdent'){const p=w.byId.get(parent);return !!p&&rows.every(r=>workspaceValidParent(w,r,p.task.Parent_Task_ID||''));}
 if(action==='indent'){const p=siblings.slice(0,first).reverse().find(r=>r.task.Task_Type!=='MILESTONE');return !!p&&rows.every(r=>workspaceValidParent(w,r,p.task.Task_ID));}
 return false;
}
// Dragging is an optional pointer shortcut. Only handles start drags; inline text is never draggable.
function workspaceDragReady(w){return workspaceStructureReady(w)&&!w.saving&&!w.pending.size&&!w.editing.size&&!w.error&&!w.structureError&&!$('quick-task')?.value.trim();}
function workspaceDropPlan(w,target,action){
 if(!w.structureDrag||!workspaceDragReady(w)||!target)return null;
 const rows=w.structureDrag.keys.map(k=>w.byKey.get(k)).filter(Boolean),anchor=w.byId.get(target);if(!rows.length||!anchor)return null;
 const selected=new Set(rows.map(r=>r.task.Task_ID));let p=target;while(p){if(selected.has(p))return null;p=w.byId.get(p)?.task.Parent_Task_ID;}
 const parent=action==='inside'?target:anchor.task.Parent_Task_ID||'';
 if(!rows.every(r=>workspaceValidParent(w,r,parent)))return null;
 return {action,anchorId:target,taskIds:rows.map(r=>r.task.Task_ID)};
}
function workspaceDragClear(w){
 if(w.structureDrag?.frame)cancelAnimationFrame(w.structureDrag.frame);w.structureDrag=null;
 document.querySelectorAll('[data-drop]').forEach(tr=>tr.removeAttribute('data-drop'));workspaceStructurePaint(w);
}
function workspaceDragPreview(w,x,y){
 const drag=w.structureDrag;if(!drag)return null;drag.x=x;drag.y=y;
 document.querySelectorAll('[data-drop]').forEach(tr=>tr.removeAttribute('data-drop'));
 const tr=document.elementFromPoint(x,y)?.closest('#task-grid tr[data-row]');if(!tr){drag.plan=null;return null;}
 const rect=tr.getBoundingClientRect(),ratio=(y-rect.top)/rect.height,action=ratio<.25?'before':ratio>.75?'after':'inside',plan=workspaceDropPlan(w,tr.dataset.row,action);tr.dataset.drop=plan?action:'invalid';drag.plan=plan;
 const status=$('structure-status');if(status)status.textContent=plan?({before:'Thả trước',after:'Thả sau',inside:'Thả làm task con'}[action])+': '+w.byKey.get(tr.dataset.row).task.Task_Name:'Không thể thả tại đây';return plan;
}
function workspaceBindDrag(w,grid){
 grid.ondragstart=e=>{const handle=e.target.closest('[data-structure-drag]');if(!handle||!workspaceDragReady(w)){e.preventDefault();return;}
 const key=handle.closest('tr').dataset.row;if(!w.structureSelection?.has(key))workspaceSelectStructure(w,key);
 const keys=workspaceStructureRoots(w).map(r=>r.key);if(!keys.length||keys.some(k=>w.byKey.get(k).createOpId)){e.preventDefault();return;}
 w.structureDrag={keys};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','PMO task move');
 const tick=()=>{const d=w.structureDrag;if(!d)return;if(!grid.isConnected||S.view!=='workspace'||S.project?.project.Project_ID!==w.id||w.token!==S.token){workspaceDragClear(w);return;}const wrap=grid.querySelector('.task-grid-wrap'),rect=wrap.getBoundingClientRect();if(Number.isFinite(d.y)&&d.x>=rect.left&&d.x<=rect.right&&d.y>=rect.top-16&&d.y<=rect.bottom+16){const dy=d.y<rect.top+40?-16:d.y>rect.bottom-40?16:0;if(dy){wrap.scrollTop+=dy;workspaceDragPreview(w,d.x,d.y);}}d.frame=requestAnimationFrame(tick);};w.structureDrag.frame=requestAnimationFrame(tick);
 };
 grid.ondragover=e=>{if(!w.structureDrag)return;const plan=workspaceDragPreview(w,e.clientX,e.clientY);e.preventDefault();e.dataTransfer.dropEffect=plan?'move':'none';};
 grid.ondrop=e=>{if(!w.structureDrag)return;e.preventDefault();const plan=workspaceDragPreview(w,e.clientX,e.clientY);workspaceDragClear(w);if(plan)workspaceStructure(w,plan.action,{anchorId:plan.anchorId,taskIds:plan.taskIds});};
 grid.ondragend=()=>workspaceDragClear(w);grid.ondragleave=e=>{if(w.structureDrag&&!grid.contains(e.relatedTarget)){w.structureDrag.x=null;w.structureDrag.y=null;document.querySelectorAll('[data-drop]').forEach(tr=>tr.removeAttribute('data-drop'));}};
}
function workspaceStructurePaint(w){
 if(w.token!==S.token||WS.projects.get(w.id)!==w||S.view!=='workspace'||S.project?.project.Project_ID!==w.id)return;
 w.nodes.forEach((tr,key)=>{const selected=w.structureSelection?.has(key)||false;if(tr.getAttribute('aria-selected')!==String(selected))tr.setAttribute('aria-selected',String(selected));const select=tr.querySelector('[data-structure-select]');if(select&&select.getAttribute('aria-pressed')!==String(selected))select.setAttribute('aria-pressed',String(selected));});
 document.querySelectorAll('[data-structure-action]').forEach(b=>b.disabled=!workspaceStructureAllowed(w,b.dataset.structureAction));
 const status=$('structure-status');if(status)status.textContent=w.structureBusy||w.structurePreparing?'Saving structure…':w.structureError||w.detail.structurePending?'Error: '+(w.structureError||'Structural operation needs recovery'):workspaceStructureSelection(w).map(r=>r.task.Task_Name).join(', ')||'Chọn hàng · Ctrl/⌘ thêm · Shift chọn dải · kéo bằng ⋮⋮';
 const recover=$('structure-recover'),rollback=$('structure-rollback');if(recover){recover.hidden=!w.detail.structurePending;recover.disabled=w.structureBusy||!w.detail.structurePending?.canRecover;}if(rollback){rollback.hidden=!w.detail.structurePending;rollback.disabled=recover.disabled;}
}
function workspaceMergeStructure(w,detail,acceptConflicts=false){
 const focus=document.activeElement,focusKey=focus?.closest('tr[data-row]')?.dataset.row,wrap=document.querySelector('.task-grid-wrap'),scroll={top:wrap?.scrollTop,left:wrap?.scrollLeft,x:scrollX,y:scrollY};let range;try{range=[focus.selectionStart,focus.selectionEnd];}catch(_){}
 const started=perfStart(),changed=new Set(),oldParents=new Set();
 const visible=S.view==='workspace'&&S.project?.project.Project_ID===w.id&&WS.projects.get(w.id)===w,fresh=new Map(detail.tasks.map(t=>[t.Task_ID,t]));
 w.rows.forEach(r=>{const t=fresh.get(r.task.Task_ID);if(!t)return;if(Object.keys(t).some(k=>String(t[k]??'')!==String(r.task[k]??''))){changed.add(r);oldParents.add(r.task.Parent_Task_ID);}
 const draft=Object.keys(r.patch).length||w.editing.has(r.key),businessChanged=r.confirmed&&Object.keys(t).some(k=>!['Parent_Task_ID','Sort_Order','_row'].includes(k)&&String(t[k]??'')!==String(r.confirmed[k]??''));if(acceptConflicts||!draft||!businessChanged)r.version=detail.taskVersions[t.Task_ID];r.confirmed=t;r.task={...t,...r.patch};});
 // New rows from a confirmed comparison are incorporated, without throwing away local drafts.
 const ids=new Set(w.rows.map(r=>r.task.Task_ID));detail.tasks.filter(t=>!ids.has(t.Task_ID)).forEach(t=>{const r={key:t.Task_ID,task:{...t},confirmed:t,version:detail.taskVersions[t.Task_ID],patch:{},index:w.rows.length};w.rows.push(r);changed.add(r);w.byKey.set(r.key,r);w.byId.set(t.Task_ID,r);if(visible){$('task-grid').tBodies[0].insertAdjacentHTML('beforeend',workspaceRowHtml(w,r,0));w.nodes.set(r.key,$('task-grid').tBodies[0].lastElementChild);}});
 w.detail={...detail,tasks:w.rows.map(r=>r.task)};if(visible)S.project=w.detail;w.hierarchy=null;w.children=new Map();w.rows.forEach(r=>{w.byId.set(r.task.Task_ID,r);const parent=r.task.Parent_Task_ID||'';if(!w.children.has(parent))w.children.set(parent,new Set());w.children.get(parent).add(r);});
 w.layoutDirty=true;w.refsDirty=true;if(visible){
  // Include former and current ancestors: their derived dates may change after reparenting.
  const ancestors=id=>{const seen=new Set();while(id&&!seen.has(id)){seen.add(id);const r=w.byId.get(id);if(!r)break;changed.add(r);id=r.task.Parent_Task_ID;}};
  oldParents.forEach(ancestors);[...changed].forEach(r=>ancestors(r.task.Parent_Task_ID));
  workspaceReorder(w);changed.forEach(r=>workspaceSyncCells(w,r));workspaceRefreshParents(w);drawWorkspaceTimeline(w,[...changed]);
 }
 if(visible){if(!focus?.isConnected&&focusKey)w.nodes.get(focusKey)?.querySelector('[data-structure-select]')?.focus({preventScroll:true});if(focus?.isConnected){focus.focus({preventScroll:true});if(range&&range[0]!==null&&focus.setSelectionRange)try{focus.setSelectionRange(...range);}catch(_){}}if(wrap){wrap.scrollTop=scroll.top;wrap.scrollLeft=scroll.left;}window.scrollTo(scroll.x,scroll.y);}
 if(S.data){S.data.tasks=S.data.tasks.filter(t=>t.Project_ID!==w.id).concat(detail.tasks);}S.revision++;S.dash=null;S.work=null;perfEnd('workspace_structure_merge',started);
}
async function workspaceDrainStructure(w){
 document.querySelectorAll('#task-grid [data-dirty="true"]').forEach(input=>workspaceEdit(w,input));
 const quick=$('quick-task');if(quick?.value.trim()){workspaceAdd(w,quick.value.trim());quick.value='';}
 const deadline=performance.now()+30000;
 while(w.saving||w.pending.size){if(w.error)throw Error('Cần xử lý lỗi lưu trước khi đổi cấu trúc.');if(performance.now()>deadline)throw Error('Đang chờ lưu; thử lại sau khi Saved.');if(!w.saving)await flushWorkspace(w);else await new Promise(r=>setTimeout(r,20));}
}
async function workspaceStructure(w,action,extra={},retry=false){
 if(w.structureBusy||w.structurePreparing)return;if(!w.detail.canEdit||w.detail.schemaVersion!=='UNIFIED_TASKS_V2')return;
 workspaceCloseReference();w.structurePreparing=true;workspaceStructurePaint(w);workspaceStatus(w);
 try{
  if(!retry){await workspaceDrainStructure(w);if(w.token!==S.token)return;const selected=workspaceStructureSelection(w);if(!selected.length)throw Error('Chọn task trước khi di chuyển.');w.structurePacket={opId:crypto.randomUUID(),action,taskIds:selected.map(r=>r.task.Task_ID),baseVersion:workspaceStructureVersion(w),...extra};}
  w.structureBusy=true;workspaceStructurePaint(w);workspaceStatus(w);
  const result=await gas('changeTaskStructure',w.id,w.structurePacket);if(w.token!==S.token)return;
  if(!result.ok){w.structureError=result.error;if(result.code==='CONFLICT'||result.code==='VALIDATION'||result.code==='ROLLED_BACK'){w.structurePacket=null;}if(result.detail)workspaceMergeStructure(w,result.detail);if(result.code==='RECOVERY_REQUIRED'){const d=await gas('getProjectDetail',w.id);w.detail.structurePending=d.structurePending;}return;}
  workspaceMergeStructure(w,result.detail);w.structurePacket=null;w.structureError='';
 }catch(error){w.structureError=error.message;}
 finally{w.structureBusy=false;w.structurePreparing=false;workspaceStructurePaint(w);workspaceStatus(w);if(!w.structureError&&w.pending.size)flushWorkspace(w);}
}
async function workspaceStructureRecover(w,decision){
 const j=w.detail.structurePending;if(!j||w.structureBusy)return;w.structureBusy=true;workspaceStructurePaint(w);workspaceStatus(w);
 try{const result=await gas('recoverTaskStructure',w.id,j.opId,decision);if(w.token!==S.token)return;if(!result.ok)throw Error(result.error);workspaceMergeStructure(w,result.detail);w.structurePacket=null;w.structureError='';}catch(error){w.structureError=error.message;}finally{w.structureBusy=false;workspaceStructurePaint(w);workspaceStatus(w);if(!w.structureError&&w.pending.size)flushWorkspace(w);}
}
// Shared unified hierarchy projection: computed dates never overwrite persisted task dates.
function unifiedForest(tasks,collapsed=new Set()){
 const byId=new Map(tasks.map((t,i)=>[t.Task_ID,{task:t,index:i,children:[]} ])),roots=[];
 byId.forEach(node=>{const parent=byId.get(node.task.Parent_Task_ID);if(parent&&parent!==node)parent.children.push(node);else roots.push(node);});
 const compare=(a,b)=>(Number(a.task.Sort_Order)||Number.MAX_SAFE_INTEGER)-(Number(b.task.Sort_Order)||Number.MAX_SAFE_INTEGER)||a.index-b.index;
 const effective=new Map(),visiting=new Set();
 function dates(node){
  if(effective.has(node.task.Task_ID))return effective.get(node.task.Task_ID);
  if(visiting.has(node.task.Task_ID))return node.task;visiting.add(node.task.Task_ID);node.children.sort(compare);
  const children=node.children.map(dates),starts=children.map(t=>t.Start_Date).filter(Boolean),ends=children.map(t=>t.End_Date).filter(Boolean);
  const task={...node.task,_summary:children.length>0||node.task.Task_Type==='PHASE',_derived:children.length>0};
  if(children.length){task.Start_Date=starts.length?starts.sort()[0]:node.task.Start_Date;task.End_Date=ends.length?ends.sort().at(-1):node.task.End_Date;}
  effective.set(task.Task_ID,task);visiting.delete(task.Task_ID);return task;
 }
 byId.forEach(dates);roots.sort(compare);const ordered=[],seen=new Set();
 function visit(node,depth){if(seen.has(node.task.Task_ID))return;seen.add(node.task.Task_ID);ordered.push({task:effective.get(node.task.Task_ID),depth});if(!collapsed.has(node.task.Task_ID))node.children.forEach(child=>visit(child,depth+1));}
 roots.forEach(node=>visit(node,0));return {ordered,effective};
}
function workspaceHierarchy(w){if(!w.hierarchy)w.hierarchy=unifiedForest(w.rows.map(r=>r.task));return w.hierarchy;}
function workspaceDisplayTask(w,r){if(w.detail.schemaVersion!=='UNIFIED_TASKS_V2')return r.task;if(w.children&&!w.children.get(r.task.Task_ID)?.size)return {...r.task,_summary:r.task.Task_Type==='PHASE',_derived:false};const dates=workspaceHierarchy(w).effective.get(r.task.Task_ID);return dates?{...r.task,Start_Date:dates.Start_Date,End_Date:dates.End_Date,_summary:dates._summary,_derived:dates._derived}:r.task;}
function workspaceReorder(w){
 if(w.detail.schemaVersion!=='UNIFIED_TASKS_V2'||!w.layoutDirty)return;w.layoutDirty=false;const body=$('task-grid')?.tBodies[0];if(!body)return;
 const started=perfStart(),active=document.activeElement,ordered=workspaceOrdered(w),visible=new Set(ordered.map(x=>x.r.key));let cursor=body.firstElementChild;
 ordered.forEach(({r,depth})=>{const node=w.nodes.get(r.key);if(!node)return;node.hidden=false;if(node!==cursor)body.insertBefore(node,cursor);cursor=node.nextElementSibling;if(node.cells[0].style.paddingLeft!==depth*16+'px')node.cells[0].style.paddingLeft=depth*16+'px';});
 w.nodes.forEach((node,key)=>node.hidden=!visible.has(key));if(active?.isConnected&&document.activeElement!==active)active.focus({preventScroll:true});perfEnd('workspace_reorder',started);
}
function workspaceOrdered(w){
 if(w.detail.schemaVersion==='UNIFIED_TASKS_V2'){const tree=workspaceHierarchy(w);const hidden=new Set();tree.ordered.forEach(({task})=>{if(hidden.has(task.Parent_Task_ID)||w.collapsed.has(task.Parent_Task_ID))hidden.add(task.Task_ID);});return tree.ordered.filter(({task})=>!hidden.has(task.Task_ID)).map(({task,depth})=>({r:w.byId.get(task.Task_ID),depth}));}
 const rows=[],seen=new Set();function visit(parent,depth){w.rows.filter(r=>(r.task.Parent_Task_ID||'')===parent).forEach(r=>{if(seen.has(r.key))return;seen.add(r.key);rows.push({r,depth});if(!w.collapsed.has(r.task.Task_ID))visit(r.task.Task_ID,depth+1);});}visit('',0);
 w.rows.filter(r=>!seen.has(r.key)&&!w.rows.some(p=>p.task.Task_ID===r.task.Parent_Task_ID)).forEach(r=>rows.push({r,depth:0}));return rows;
}
const workspaceColumnWidths=[260,110,200,90,130,90,125,125,70,220,100,85];
const workspaceColumns=[['Task_Name','Task','text'],['Task_Type','Type','Task|Summary|Milestone'],['PIC_ID','PIC','reference'],['RAG','RAG','Green|Amber|Red'],['Status','Status','Not Started|In Progress|Blocked|Done'],['Progress','Progress','number'],['Start_Date','Start','date'],['End_Date','End','date'],['Duration','Duration','number'],['Parent_Task_ID','Parent','reference']];
function workspaceDuration(t){return t.Start_Date&&t.End_Date?Math.round((parseDay(t.End_Date)-parseDay(t.Start_Date))/86400000)+1:'';}
function workspaceRowHtml(w,r,depth){
 const plan=w.detail.canEdit,execute=w.detail.myTaskIds.includes(r.task.Task_ID),t=workspaceDisplayTask(w,r);
 return `<tr data-row="${esc(r.key)}" data-task-type="${esc(t.Task_Type)}" data-derived="${!!t._derived}">${workspaceColumns.map(([key,label,type],col)=>{
  if(key==='Task_Type'&&w.detail.schemaVersion==='UNIFIED_TASKS_V2')type='PHASE|TASK|MILESTONE';
  const enabled=(plan||(execute&&['Progress','Status'].includes(key)))&&!(t.Task_Type==='PHASE'&&['PIC_ID','Progress'].includes(key))&&!(t._derived&&['Start_Date','End_Date','Duration'].includes(key)),value=key==='Duration'?workspaceDuration(t):['Parent_Task_ID','PIC_ID'].includes(key)?workspaceReferenceLabel(w,key,t[key]):t[key]||'';
  let editor;if(type.includes('|'))editor=`<select aria-label="${label}" data-field="${key}">${!type.split('|').includes(String(value))?`<option value="${esc(value)}" selected>${esc(value||'Chưa có')}</option>`:''}${type.split('|').map(x=>`<option ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
  else if(['Parent_Task_ID','PIC_ID'].includes(key))editor=`<input aria-label="${label}" title="${esc(value)}" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" placeholder="${key==='PIC_ID'?'Chưa giao PIC':'No Parent'}" data-field="${key}" value="${esc(value)}">`;
  else editor=`<input aria-label="${label}" data-field="${key}" type="${type==='reference'?'text':type}" value="${esc(value)}" ${type==='reference'?`list="reference-${key}"`:''} ${key==='Progress'?'min="0" max="100"':''}>`;
  if(key==='Progress')editor=`<button type="button" data-progress class="quick-progress" aria-label="Tiến độ ${esc(value)}%; tăng 25%" style="--progress:${Number(value)||0}%" data-complete="${Number(value)===100}">${esc(value)+'%'}</button><button class="link progress-custom" data-progress-custom aria-label="Đặt tiến độ tùy ý">⋯</button>`;
  return `<td data-col="${col}" ${['RAG','Status'].includes(key)?`data-color-field="${key}" data-value="${esc(t[key])}"`:''} ${!enabled&&['PIC_ID','Parent_Task_ID'].includes(key)?`title="${esc(value)}"`:''} ${col===0?`style="padding-left:${depth*16}px"`:''}>${col===0?`${w.detail.canEdit&&w.detail.schemaVersion==='UNIFIED_TASKS_V2'?'<button type="button" class="link" data-structure-select aria-pressed="false" aria-label="Chọn hàng để sắp xếp (Ctrl hoặc Shift để chọn nhiều)">↕</button><button type="button" class="link structure-drag" data-structure-drag draggable="true" aria-label="Kéo task và toàn bộ cây con; hoặc dùng toolbar" title="Kéo để di chuyển; lưu bản nháp trước khi kéo">⋮⋮</button>':''}<button class="link collapse" aria-label="Thu gọn/mở rộng">${w.collapsed.has(t.Task_ID)?'▸':'▾'}</button>`:''}${enabled?editor:esc(value)}</td>`;
 }).join('')}<td class="save-cell"><span id="save-${esc(r.key)}" data-save role="status">Saved</span></td><td class="action-cell">${plan||execute?'<button class="link" data-detail>Chi tiết</button>':''}</td></tr>`;
}
function drawWorkspaceGrid(w){
 const grid=$('workspace-grid');if(!grid)return;workspaceCloseReference();workspaceIndex(w);
 grid.innerHTML=`<div class="toolbar"><span id="workspace-save" role="status"></span><button id="workspace-retry">Retry</button><button id="workspace-error-detail">Chi tiết lỗi</button><button id="workspace-compare">Đối chiếu lỗi/xung đột</button><button id="workspace-timeline">${w.timeline?'Ẩn':'Hiện'} Timeline</button><span class="muted tiny">Enter: xác nhận · Tab: ô kế · Escape: hủy ô · ngày lịch, tính cả hai đầu</span></div><div id="workspace-error" role="alert"></div>${w.detail.canEdit&&w.detail.schemaVersion==='UNIFIED_TASKS_V2'?`<div class="toolbar structure-toolbar" role="toolbar" aria-label="Sắp xếp cấu trúc task">${[['up','↑ Lên','Alt+ArrowUp'],['down','↓ Xuống','Alt+ArrowDown'],['indent','→ Thụt vào','Alt+ArrowRight'],['outdent','← Đưa ra','Alt+ArrowLeft']].map(([action,label,keys])=>`<button type="button" class="secondary" data-structure-action="${action}" aria-keyshortcuts="${keys}">${label}</button>`).join('')}<button id="structure-recover" hidden>Tiếp tục thao tác lỗi</button><button id="structure-rollback" hidden>Rollback thao tác lỗi</button><span id="structure-status" role="status"></span></div>`:''}<div class="table-wrap task-grid-wrap"><table id="task-grid"><colgroup>${workspaceColumnWidths.map(width=>`<col style="width:${width}px">`).join('')}</colgroup><thead><tr>${workspaceColumns.map(x=>`<th>${x[1]}</th>`).join('')}<th>Save</th><th>Actions</th></tr></thead><tbody>${workspaceOrdered(w).map(({r,depth})=>workspaceRowHtml(w,r,depth)).join('')}</tbody></table></div>${w.detail.canEdit?'<input id="quick-task" aria-label="Task mới" placeholder="Nhập tên task, Enter để thêm liên tục…" maxlength="500">':''}<div id="workspace-timeline-area"></div>`;
 $('workspace-retry').onclick=workspaceRetry;$('workspace-error-detail').onclick=()=>{const error=w.structureError||w.error;if(error)showModal('Lỗi lưu task','<p>'+esc(error)+'</p><p>Bản nháp vẫn được giữ. Sửa dữ liệu hoặc dùng Retry/Đối chiếu lỗi.</p>');};$('workspace-compare').onclick=()=>workspaceCompare(w);$('workspace-timeline').onclick=()=>{w.timeline=!w.timeline;drawWorkspaceTimeline(w);};
 if($('quick-task'))$('quick-task').oninput=()=>workspaceStatus(w);
 if($('quick-task'))$('quick-task').onkeydown=e=>{if(e.key==='Enter'&&e.target.value.trim()){e.preventDefault();const name=e.target.value.trim();e.target.value='';workspaceAdd(w,name);}if(e.key==='Escape'){e.target.value='';workspaceStatus(w);}};
 w.nodes=new Map([...$('task-grid').tBodies[0].rows].map(tr=>[tr.dataset.row,tr]));w.timelineSignature=null;
 if(grid._structureFocusIn)grid.removeEventListener('focusin',grid._structureFocusIn);grid._structureFocusIn=e=>{const row=e.target.closest('tr[data-row]');if(row&&!e.target.closest('[data-structure-select],[data-structure-drag]')&&!w.structureSelection?.has(row.dataset.row))workspaceSelectStructure(w,row.dataset.row);if(e.target.matches('[data-field]')){e.target.dataset.original=e.target.value;if(['Parent_Task_ID','PIC_ID'].includes(e.target.dataset.field))workspaceOpenReference(w,e.target);}};
 grid.addEventListener('focusin',grid._structureFocusIn);
 grid.onfocusout=e=>{const field=e.target.dataset.field;if(['Parent_Task_ID','PIC_ID'].includes(field)){workspaceCloseReference();const r=w.byKey.get(e.target.closest('tr').dataset.row),label=workspaceReferenceLabel(w,field,r.task[field]);e.target.value=label;e.target.title=label;e.target.dataset.original=label;}};
 grid.oninput=e=>{if(e.target.matches('[data-field]')){e.target.dataset.nav='false';e.target.dataset.dirty=String(e.target.value!==e.target.dataset.original);const r=w.byKey.get(e.target.closest('tr').dataset.row);if(['Parent_Task_ID','PIC_ID'].includes(e.target.dataset.field)){e.target.dataset.dirty='false';workspaceOpenReference(w,e.target,e.target.value);return;}if(e.target.dataset.dirty==='true')w.editing.add(r.key);else w.editing.delete(r.key);workspaceStatus(w,[r]);}};
 grid.onchange=e=>{if(e.target.matches('[data-field]')&&!['Parent_Task_ID','PIC_ID'].includes(e.target.dataset.field))workspaceEdit(w,e.target);};
 grid.onkeydown=e=>{
  if(e.isComposing)return;
  if(e.altKey&&['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'].includes(e.key)&&w.detail.canEdit&&w.detail.schemaVersion==='UNIFIED_TASKS_V2'){e.preventDefault();const action={ArrowUp:'up',ArrowDown:'down',ArrowRight:'indent',ArrowLeft:'outdent'}[e.key];if(workspaceStructureAllowed(w,action))workspaceStructure(w,action);return;}
  const input=e.target;if(!input.matches('[data-field],[data-progress]'))return;if(input.matches('[data-progress]')&&!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key))return;
  if(['Parent_Task_ID','PIC_ID'].includes(input.dataset.field)){let active=WS.referenceEditor;if(!active&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){workspaceOpenReference(w,input);e.preventDefault();return;}if(active&&['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape')workspaceCloseReference();else if(e.key==='Enter')workspaceChooseReference(active,active.index);else{active.index=Math.max(0,Math.min(active.options.length-1,active.index+(e.key==='ArrowDown'?1:-1)));workspaceHighlightReference(active);}return;}if(e.key==='Tab')workspaceCloseReference();}
  if(e.key==='Escape'){input.value=input.dataset.original||'';delete input.dataset.dirty;w.editing.delete(input.closest('tr').dataset.row);input.dataset.nav='true';workspaceStatus(w,[w.byKey.get(input.closest('tr').dataset.row)]);e.preventDefault();}
  if(e.key==='Enter'){workspaceEdit(w,input);input.dataset.nav='true';workspaceStatus(w);e.preventDefault();}
  if((e.altKey||input.dataset.nav==='true'||input.matches('[data-progress]'))&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)){
   const td=input.closest('td'),tr=td.parentElement,vertical=e.key==='ArrowDown'||e.key==='ArrowUp';let target;if(vertical){const row=e.key==='ArrowDown'?tr.nextElementSibling:tr.previousElementSibling;target=row?.cells[td.cellIndex];}else target=e.key==='ArrowRight'?td.nextElementSibling:td.previousElementSibling;target?.querySelector('[data-field],[data-progress]')?.focus();e.preventDefault();
  }
 };
 grid.onclick=e=>{const structural=e.target.closest('[data-structure-action]');if(structural){workspaceStructure(w,structural.dataset.structureAction);return;}if(e.target.closest('#structure-recover')){workspaceStructureRecover(w,'RESUME');return;}if(e.target.closest('#structure-rollback')){workspaceStructureRecover(w,'ROLLBACK');return;}const selection=e.target.closest('[data-structure-select]');if(selection){workspaceSelectStructure(w,selection.closest('tr').dataset.row,e);return;}if(e.target.matches('input[role=combobox]')){workspaceOpenReference(w,e.target);return;}const tr=e.target.closest('tr[data-row]'),r=tr?w.byKey.get(tr.dataset.row):null;const dateButton=e.target.closest('[data-date]');if(dateButton){workspaceTimelineEdit(w,dateButton,e);return;}if(e.target.closest('[data-progress]'))workspaceQuickProgress(w,r);if(e.target.matches('[data-progress-custom]'))workspaceProgressCustom(w,r);if(e.target.matches('[data-detail]')){const r=w.rows.find(r=>r.key===e.target.closest('tr').dataset.row);workspaceDetails(r.task.Task_ID);}if(e.target.matches('.collapse')){const r=w.rows.find(r=>r.key===e.target.closest('tr').dataset.row);if(w.collapsed.has(r.task.Task_ID))w.collapsed.delete(r.task.Task_ID);else w.collapsed.add(r.task.Task_ID);drawWorkspaceGrid(w);}};
 workspaceBindDrag(w,grid);grid.querySelectorAll('[data-structure-action]').forEach(button=>button.onmousedown=e=>e.preventDefault());w.layoutDirty=false;workspaceStatus(w,w.rows);drawWorkspaceTimeline(w);workspaceStructurePaint(w);
}
function workspaceDetails(id){
 const w=workspaceCurrent(),r=w?.rows.find(r=>r.task.Task_ID===id);if(!r)return;
 const plan=w.detail.canEdit;
 showModal('Chi tiết task',`<form id="workspace-details"><p>${esc(r.task.Task_Name)}</p>${plan?`<label class="field">Mô tả<textarea name="Description">${esc(r.task.Description)}</textarea></label><label class="field">Dependency<input name="Dependency_ID" list="workspace-dependencies" value="${esc(r.task.Dependency_ID)}"></label><datalist id="workspace-dependencies">${w.rows.filter(p=>p!==r).map(p=>`<option value="${esc(p.task.Task_ID)}">${esc(p.task.Task_Name)}</option>`).join('')}</datalist>${w.detail.schemaVersion==='UNIFIED_TASKS_V2'?'':`<label class="field">Phase<input name="Phase_ID" list="workspace-phases" value="${esc(r.task.Phase_ID)}"></label><datalist id="workspace-phases">${w.detail.phases.map(p=>`<option value="${esc(p.Phase_ID)}">${esc(p.Phase_Name)}</option>`).join('')}</datalist>`}`:''}<label class="field">Ghi chú / blocker<textarea name="Member_Update">${esc(r.task.Member_Update)}</textarea></label><div class="actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button type="submit">Áp dụng</button></div></form>`);
 $('workspace-details').onsubmit=e=>{e.preventDefault();queueWorkspace(w,r,Object.fromEntries(new FormData(e.target).entries()));closeModal();};
}
function workspaceAdd(w,name){
 const opId=crypto.randomUUID(),last=w.rows[w.rows.length-1],start=last?.task.Start_Date||S.boot.today||new Date().toISOString().slice(0,10);
 const task={Project_ID:w.id,Task_ID:'tmp-'+opId,Task_Name:name,Task_Type:w.detail.schemaVersion==='UNIFIED_TASKS_V2'?'TASK':'Task',Status:'Not Started',Progress:'0',RAG:'Green',Start_Date:start,End_Date:plusDays(start,1),Phase_ID:w.detail.schemaVersion==='UNIFIED_TASKS_V2'?'':last?.task.Phase_ID||'',Parent_Task_ID:''};
 workspaceIndex(w);const row={key:task.Task_ID,task,createOpId:opId,patch:{},index:w.rows.length,appending:w.detail.schemaVersion==='UNIFIED_TASKS_V2'};w.rows.push(row);w.byKey.set(row.key,row);w.byId.set(task.Task_ID,row);w.refsDirty=true;w.hierarchy=null;w.detail.tasks.push(task);
 $('task-grid').tBodies[0].insertAdjacentHTML('beforeend',workspaceRowHtml(w,row,0));w.nodes.set(row.key,$('task-grid').tBodies[0].lastElementChild);
 const fields={...task};delete fields.Task_ID;delete fields.Project_ID;queueWorkspace(w,row,fields);row.appending=false;workspaceReorder(w);drawWorkspaceTimeline(w,[row]);
}
function workspaceEdit(w,input){
 const r=w.byKey.get(input.closest('tr').dataset.row),key=input.dataset.field;let value=['Parent_Task_ID','PIC_ID'].includes(key)?(input.dataset.referenceId??(r.task[key]||'')):input.value,fields={[key]:value};
 if(key==='Parent_Task_ID'&&w.detail.schemaVersion==='UNIFIED_TASKS_V2'&&!r.createOpId){if((r.task.Parent_Task_ID||'')===value)return;workspaceSelectStructure(w,r.key);workspaceStructure(w,'reparent',{parentId:value});return;}
 if(key==='Duration'){const n=Number(value);if(!Number.isInteger(n)||n<1||!r.task.Start_Date){notify('Duration cần số ngày nguyên ≥1 và Start Date.',true);return;}fields={End_Date:plusDays(r.task.Start_Date,n-1)};}
 if(['Milestone','MILESTONE'].includes(r.task.Task_Type)&&['Start_Date','End_Date'].includes(key))fields={Start_Date:value,End_Date:value};
 if(key==='Task_Type'&&['Milestone','MILESTONE'].includes(value))fields.End_Date=r.task.Start_Date;
 if(key==='Parent_Task_ID'&&r.createOpId){const parent=w.byId.get(value),dates=parent?workspaceDisplayTask(w,parent):null;if(dates?.Start_Date)Object.assign(fields,{Start_Date:dates.Start_Date,End_Date:['Milestone','MILESTONE'].includes(r.task.Task_Type)?dates.Start_Date:plusDays(dates.Start_Date,1)});}
 if(key==='Task_Type'&&value==='PHASE')Object.assign(fields,{PIC_ID:'',Progress:''});
 if(Object.keys(fields).every(k=>String(r.task[k]||'')===String(fields[k])))return;
 queueWorkspace(w,r,fields);delete input.dataset.dirty;w.editing.delete(r.key);
 input.dataset.original=input.value;
 // Update dependent cells only, leaving the active editor and other rows intact.
 input.closest('tr').querySelectorAll('[data-field]').forEach(el=>{if(el!==input&&['Duration','Start_Date','End_Date'].includes(el.dataset.field))el.value=el.dataset.field==='Duration'?workspaceDuration(r.task):r.task[el.dataset.field]||'';});
 drawWorkspaceTimeline(w,[r]);workspaceStatus(w,[r]);
}
// Both views use identical integer-width columns and full-cell occupancy rules.
function timelineWindow(start,step,count){const begin=step===7?monday(start):start;return {begin,step,count,width:step===7?72:44,dates:Array.from({length:count},(_,i)=>plusDays(begin,i*step))};}
function timelineCellState(task,date,step){
 const occupied=!!(task.Start_Date&&task.End_Date&&task.Start_Date<=plusDays(date,step-1)&&task.End_Date>=date);
 const kind=['Milestone','MILESTONE'].includes(task.Task_Type)?'milestone':task._summary||task.Task_Type==='Summary'||task.Task_Type==='PHASE'?'summary':'task';
 return {occupied,kind,rag:['Green','Amber','Red'].includes(task.RAG)?task.RAG:'Green'};
}
function timelineCells(task,window,editable=false){return window.dates.map(date=>{const s=timelineCellState(task,date,window.step),bar=`<span class="timeline-bar">${s.occupied&&s.kind==='milestone'?'◆':''}</span>`;return `<td class="time-cell ${s.occupied?'occupied '+s.rag:''} ${s.kind}" data-time="${date}">${editable?`<button type="button" data-date="${date}" aria-label="${date}" aria-pressed="${s.occupied}">${bar}</button>`:`<span>${bar}</span>`}</td>`;}).join('');}
function timelineHeaders(window){return window.dates.map(date=>`<th class="time-heading" data-time="${date}" title="${window.step===7?'Tuần bắt đầu thứ Hai: ':''}${date}">${window.step===7?'Tuần ':''}${date.slice(5)}</th>`).join('');}
function workspaceProgressCustom(w,r){
 if(!w.detail.canEdit&&!w.detail.myTaskIds.includes(r.task.Task_ID))return;
 showModal('Đặt tiến độ',`<form id="progress-form"><label class="field">Tiến độ (%)<input name="Progress" data-field="Progress" type="number" min="0" max="100" step="any" required value="${esc(r.task.Progress||'0')}"></label><div class="actions"><button type="button" class="secondary" id="progress-reset">Về 0%</button><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button type="submit">Áp dụng</button></div></form>`);
 $('progress-reset').onclick=()=>$('progress-form').elements.Progress.value='0';
 $('progress-form').onsubmit=e=>{e.preventDefault();if(!e.target.reportValidity())return;queueWorkspace(w,r,{Progress:e.target.elements.Progress.value});workspaceProgressPaint(w,r);closeModal();};
}
function drawWorkspaceTimeline(w,changed){
 const area=$('workspace-timeline-area'),table=$('task-grid');if(!area||!table)return;const toggle=$('workspace-timeline');if(toggle&&toggle.textContent!==(w.timeline?'Ẩn Timeline':'Hiện Timeline'))toggle.textContent=w.timeline?'Ẩn Timeline':'Hiện Timeline';
 if(!w.timeline){if(w.timelineSignature){table.querySelectorAll('.time-cell,.time-heading,col[data-time-col]').forEach(el=>el.remove());table.classList.remove('workspace-timeline','sheet-timeline');w.timelineSignature=null;}const width=workspaceColumnWidths.reduce((a,b)=>a+b,0)+'px';if(table.style.width!==width)table.style.width=width;area.replaceChildren();return;}
 const start=w.timelineStart||w.rows.find(r=>r.task.Start_Date)?.task.Start_Date||S.boot.today||new Date().toISOString().slice(0,10),window=timelineWindow(start,w.grain||1,28),signature=window.begin+'|'+window.step;
 if(!w.timelineStart)w.timelineStart=window.begin;
 const rebuild=w.timelineSignature!==signature;w.timelineWindow=window;if(!table.classList.contains('workspace-timeline'))table.classList.add('workspace-timeline','sheet-timeline');
 if(rebuild){
  table.querySelectorAll('.time-cell,.time-heading,col[data-time-col]').forEach(el=>el.remove());
  table.querySelector('colgroup').insertAdjacentHTML('beforeend',window.dates.map(()=>`<col data-time-col style="width:${window.width}px">`).join(''));
  table.tHead.rows[0].insertAdjacentHTML('beforeend',timelineHeaders(window));
  area.innerHTML=`<div class="toolbar"><input id="timeline-start" aria-label="Ngày Timeline" type="date" value="${window.begin}"><button id="timeline-grain">${window.step===1?'Ngày':'Tuần'}</button><span>Click: Start · Shift+Click: End · Tuần bắt đầu thứ Hai</span></div>`;
  $('timeline-start').onchange=e=>{if(e.target.value){w.timelineStart=e.target.value;drawWorkspaceTimeline(w);}};$('timeline-grain').onclick=()=>{w.grain=window.step===1?7:1;drawWorkspaceTimeline(w);};
  w.timelineSignature=signature;
 }
 const width=(workspaceColumnWidths.reduce((a,b)=>a+b,0)+window.width*28)+'px';if(table.style.width!==width)table.style.width=width;
 (rebuild||!changed?workspaceOrdered(w).map(x=>x.r):changed).forEach(r=>{
  const tr=workspaceRowNode(w,r);if(!tr)return;const task=workspaceDisplayTask(w,r),editable=w.detail.canEdit&&!task._derived;let cells=tr.querySelectorAll('.time-cell');if(cells.length&&(cells[0].firstElementChild.tagName==='BUTTON')!==editable){cells.forEach(cell=>cell.remove());cells=[];}
  if(!cells.length)tr.insertAdjacentHTML('beforeend',timelineCells(task,window,editable));
  else cells.forEach((cell,i)=>{const state=timelineCellState(task,window.dates[i],window.step),className='time-cell '+(state.occupied?'occupied '+state.rag+' ':'')+state.kind;if(cell.className!==className)cell.className=className;const control=cell.firstElementChild,bar=control.querySelector('.timeline-bar'),label=state.occupied&&state.kind==='milestone'?'◆':'';if(bar.textContent!==label)bar.textContent=label;if(control.tagName==='BUTTON'&&control.getAttribute('aria-pressed')!==String(state.occupied))control.setAttribute('aria-pressed',String(state.occupied));});
 });
}
function workspaceTimelineEdit(w,button,event){
 if(!w.detail.canEdit)return;const date=button.dataset.date,r=w.byKey.get(button.closest('tr').dataset.row);if(workspaceDisplayTask(w,r)._derived)return;const fields=event.shiftKey?{End_Date:date}:{Start_Date:date,End_Date:date};
 if(['Milestone','MILESTONE'].includes(r.task.Task_Type))Object.assign(fields,{Start_Date:date,End_Date:date});
 if(fields.End_Date<(fields.Start_Date||r.task.Start_Date)){notify('End Date trước Start Date.',true);return;}
 queueWorkspace(w,r,fields);workspaceRowNode(w,r)?.querySelectorAll('input[data-field]').forEach(input=>{const key=input.dataset.field;if(['Start_Date','End_Date','Duration'].includes(key)&&input!==document.activeElement&&input.dataset.dirty!=='true')input.value=key==='Duration'?workspaceDuration(r.task):r.task[key];});drawWorkspaceTimeline(w,[r]);
}
function drawGantt(){
 const byDay=S.ganttGrain==='day',window=timelineWindow(S.weekStart,byDay?1:7,byDay?21:12),data=S.data,rows=[];
 function line(name,start,end,rag,level,type='Summary',projectId=''){rows.push({name,level,projectId,Start_Date:start,End_Date:end,RAG:rag,Task_Type:type});}
 const groups=data.groups||[],projects=data.projects||[],phases=data.phases||[];
 [...groups.map(g=>g.Group_ID),'__ungrouped'].forEach(gid=>{
  const subset=projects.filter(p=>(p.Group_ID||'__ungrouped')===gid&&!['Cancelled','Archived'].includes(p.Status)&&(!['Red','Amber','Green'].includes(S.filter)||p.RAG===S.filter));if(!subset.length)return;
  line('▦ '+(groups.find(g=>g.Group_ID===gid)?.Group_Name||'Chưa phân nhóm'),'','','',0);
  subset.forEach(p=>{const open=S.expanded.has(p.Project_ID);line((open?'▾ ':'▸ ')+p.Project_Name,p.Start_Date,p.End_Date,p.RAG,1,'Summary',p.Project_ID);if(!open)return;
   if(data.schemaVersion==='UNIFIED_TASKS_V2'){const tree=unifiedForest(data.tasks.filter(t=>t.Project_ID===p.Project_ID),S.ganttCollapsed||new Set());tree.ordered.forEach(({task,depth})=>rows.push({...task,name:task.Task_Name,level:2+depth,taskId:task.Task_ID}));return;}
   [...phases.filter(ph=>ph.Project_ID===p.Project_ID).sort((a,b)=>Number(a.Phase_Order)-Number(b.Phase_Order)),{Phase_ID:'',Phase_Name:'Chưa gán giai đoạn'}].forEach(ph=>{
    const tasks=data.tasks.filter(t=>t.Project_ID===p.Project_ID&&(t.Phase_ID||'')===ph.Phase_ID);if(!tasks.length)return;
    line('◫ '+ph.Phase_Name,ph.Start_Date||tasks.map(t=>t.Start_Date).filter(Boolean).sort()[0],ph.End_Date||tasks.map(t=>t.End_Date).filter(Boolean).sort().at(-1),ph.RAG||p.RAG,2);
    tasks.forEach(t=>line(t.Task_Name,t.Start_Date,t.End_Date,t.RAG,3,t.Task_Type));
   });
  });
 });
 $('content').innerHTML=`<section class="panel"><div class="panel-head"><h3>Portfolio Gantt • ${byDay?'21 ngày':'12 tuần'}</h3><div class="toolbar"><input type="date" id="gantt-date" value="${window.begin}"><select id="gantt-grain"><option value="day" ${byDay?'selected':''}>Ngày</option><option value="week" ${!byDay?'selected':''}>Tuần</option></select><select id="gantt-filter"><option value="">All RAG</option>${['Red','Amber','Green'].map(r=>`<option ${S.filter===r?'selected':''}>${r}</option>`).join('')}</select></div></div><p class="tiny muted">Tuần bắt đầu thứ Hai · ◆ Milestone · nền màu theo RAG</p><div class="gantt-scroll"><table class="sheet-timeline master-timeline" style="width:${300+window.width*window.count}px"><colgroup><col style="width:300px">${window.dates.map(()=>`<col style="width:${window.width}px">`).join('')}</colgroup><thead><tr><th>Project / Phase / Task</th>${timelineHeaders(window)}</tr></thead><tbody>${rows.map(row=>`<tr><td class="timeline-label" style="padding-left:${8+row.level*14}px">${row.projectId?`<button class="link" data-project="${esc(row.projectId)}">${esc(row.name)}</button>`:row.taskId&&row._derived?`<button class="link" data-gantt-task="${esc(row.taskId)}">${S.ganttCollapsed?.has(row.taskId)?'▸':'▾'} ${esc(row.name)}</button>`:esc(row.name)} ${row.RAG?tag(row.RAG):''}</td>${timelineCells(row,window)}</tr>`).join('')}</tbody></table></div></section>`;
 $('gantt-date').onchange=e=>{if(e.target.value){S.weekStart=e.target.value;drawGantt();}};$('gantt-grain').onchange=e=>{S.ganttGrain=e.target.value;drawGantt();};$('gantt-filter').onchange=e=>{S.filter=e.target.value;drawGantt();};document.querySelector('.master-timeline').onclick=e=>{const button=e.target.closest('[data-project]');if(button)toggleTree(button.dataset.project);const task=e.target.closest('[data-gantt-task]');if(task){S.ganttCollapsed||=new Set();const id=task.dataset.ganttTask;if(S.ganttCollapsed.has(id))S.ganttCollapsed.delete(id);else S.ganttCollapsed.add(id);drawGantt();}};
}
window.addEventListener('scroll',e=>{const active=WS.referenceEditor;if(active&&!active.list.contains(e.target)){const rect=active.input.getBoundingClientRect();active.list.style.left=Math.max(8,Math.min(rect.left,innerWidth-360))+'px';active.list.style.top=Math.max(8,Math.min(rect.bottom,innerHeight-210))+'px';}},true);
window.addEventListener('resize',()=>workspaceCloseReference());
window.addEventListener('beforeunload',e=>{if(workspaceDirty()||modalBusy()){e.preventDefault();e.returnValue='';}});
window.addEventListener('popstate',()=>{workspaceLeave();const match=location.hash.match(/^#project=(.*)$/);if(match&&S.boot)openProject(decodeURIComponent(match[1]),true);else chooseView('projects',true);});

addPasswordToggles($('login-form'));
document.querySelectorAll('.nav').forEach(el=>el.onclick=()=>chooseView(el.dataset.view));$('refresh').onclick=load;$('modal-close').onclick=closeModal;
$('modal').onclick=e=>{if(e.target===$('modal'))closeModal();};$('login-form').onsubmit=doLogin;$('logout').onclick=doLogout;if(S.token)load();else showLogin();
