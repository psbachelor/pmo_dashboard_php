<?php
declare(strict_types=1);
namespace VCX\Parity;
final class ControlTower {
    public const READS=['getBootstrap','getInitialData','getProjects','getProjectDetail','getPortfolioData','getDashboard','getProjectAttributes','getProjectMemberSettings','getWorkload','getDailyWorkload','getWorkspaceCompatibilityReport'];
    public const WRITES=['logout','changePassword','adminProvisionUser','saveProject','setProjectArchived','purgeArchivedProject','saveTask','updateMyTask','saveTaskBatch','changeTaskStructure','recoverTaskStructure','applyProcedureTemplate','saveChecklistItem','saveIssue','saveAssignment','saveProjectAttribute','saveProjectMembers'];
    public const TASK_STATUSES=['Not Started','In Progress','Blocked','Done'];
    public const RAGS=['Green','Amber','Red'];
    public const EDITS=[
        'PROJECTS'=>['Group_ID','Project_Name','Project_Type','Department','Sponsor','PM_ID','Objective','Start_Date','End_Date','Status','RAG','Health_Summary'],
        'TASKS'=>['Project_ID','Parent_Task_ID','Task_Name','Task_Type','PIC_ID','Start_Date','End_Date','Progress','Status','RAG','Dependency_ID','Description','Phase_ID','Member_Update','Member_Updated_At'],
        'CHECKLIST_ITEMS'=>['Status','Due_Date','Owner_ID','Evidence_URL','Notes'],
        'ASSIGNMENTS'=>['Task_ID','User_ID','Start_Date','End_Date','Allocation_Pct','Planned_Effort_Days','Role'],
        'ISSUES'=>['Project_ID','Task_ID','Title','Description','Severity','Impact','Owner_ID','Open_Date','Due_Date','Status','Resolution_Plan','Escalation_Level','Decision_Required']
    ];
    public Auth $auth;
    public function __construct(public Store $s){$this->auth=new Auth($s);}
    public function call(string $method,array $args,string $token=''): mixed {
        $label=in_array($method,array_merge(['login'],self::READS,self::WRITES),true)?$method:'unknown_api';return Metrics::run($label,fn()=>$this->invoke($method,$args,$token));
    }
    private function invoke(string $method,array $args,string $token): mixed {
        Store::check($method==='login'||in_array($method,array_merge(self::READS,self::WRITES),true),'API không tồn tại.');
        if($method==='login')return $this->auth->login(...$args);
        return $this->s->transaction(function()use($method,$args,$token){
            $a=Metrics::timed('authentication',fn()=>$this->auth->actor($token,in_array($method,['getBootstrap','getInitialData','logout','changePassword'],true)));
            if(in_array($method,self::WRITES,true)&&!in_array($method,['logout','changePassword','adminProvisionUser'],true)){
                $version=array_pop($args);if(!in_array($method,['changeTaskStructure','recoverTaskStructure'],true)){Store::check($this->s->schemaVersion()==='LEGACY_V1'||$version==='UNIFIED_TASKS_V2','SCHEMA_INCOMPATIBLE: reload updated application.');
                Store::check(in_array($this->s->schemaVersion(),['LEGACY_V1','UNIFIED_TASKS_V2'],true),'SCHEMA_INCOMPATIBLE');
                if(!in_array($method,['changeTaskStructure','recoverTaskStructure'],true))Store::check(!$this->s->activeStructure(),'STRUCTURE_RECOVERY_REQUIRED: recover pending operation before writing.');}
            }
            return match($method){
                'logout'=>$this->auth->logout($token),'changePassword'=>$this->auth->changePassword($token,...$args),'adminProvisionUser'=>$this->auth->provision($a,...$args),
                'getBootstrap'=>$this->bootstrap($a),'getInitialData'=>$this->initial($a),'getProjects'=>$this->visible($a),'getProjectDetail'=>$this->detail($a,...$args),'getPortfolioData'=>$this->portfolio($a),'getDashboard'=>$this->dashboard($a),
                'getProjectAttributes'=>$this->attributes($a,...$args),'saveProjectAttribute'=>$this->saveAttribute($a,...$args),
                'getProjectMemberSettings'=>$this->memberSettings($a,...$args),'saveProjectMembers'=>$this->saveMembers($a,...$args),
                'saveProject'=>$this->saveProject($a,...$args),'setProjectArchived'=>$this->archive($a,...$args),'purgeArchivedProject'=>$this->purge($a,...$args),
                'saveTask'=>$this->saveTask($a,...$args),'updateMyTask'=>$this->updateTask($a,...$args),'saveTaskBatch'=>$this->batch($a,...$args),
                'changeTaskStructure'=>(new Structure($this))->change($a,$args[0],$args[1],$version),'recoverTaskStructure'=>(new Structure($this))->recover($a,$args[0],$args[1],$args[2],$version),
                'getWorkspaceCompatibilityReport'=>$this->compatibility($a,...$args),
                'applyProcedureTemplate'=>$this->procedure($a,...$args),'saveChecklistItem'=>$this->saveChecklist($a,...$args),'saveIssue'=>$this->saveIssue($a,...$args),'saveAssignment'=>$this->saveAssignment($a,...$args),
                'getWorkload'=>$this->workload($a,false,...$args),'getDailyWorkload'=>$this->workload($a,true,...$args)
            };
        },in_array($method,self::WRITES,true));
    }
    public static function admin(array $a): bool{return $a['System_Role']==='PMO_ADMIN';}
    public static function execution(?array $t): bool{return $t&&$t['Task_Type']!=='PHASE';}
    public static function filter(array $list,callable $fn): array{return array_values(array_filter($list,$fn));}
    public function visible(array $a): array {
        $key=$a['User_ID'].'|'.$a['System_Role'];if(array_key_exists($key,$this->s->scopes))return$this->s->scopes[$key];$p=$this->s->rows('PROJECTS');if(self::admin($a))return$this->s->scopes[$key]=$p;
        $active=self::filter($p,fn($p)=>$p['Status']!=='Archived');if($a['System_Role']==='EXECUTIVE')return$this->s->scopes[$key]=$active;
        $id=$a['User_ID'];$scope=[];$assigned=[];
        foreach($this->s->rows('PROJECT_MEMBERS')as$r)if($r['User_ID']===$id)$scope[$r['Project_ID']]=true;
        foreach($this->s->rows('ASSIGNMENTS')as$r)if($r['User_ID']===$id)$assigned[$r['Task_ID']]=true;
        foreach($this->s->rows('TASKS')as$r)if($r['PIC_ID']===$id||isset($assigned[$r['Task_ID']]))$scope[$r['Project_ID']]=true;
        foreach($this->s->rows('CHECKLIST_ITEMS')as$r)if($r['Owner_ID']===$id)$scope[$r['Project_ID']]=true;
        return $this->s->scopes[$key]=self::filter($active,fn($p)=>$p['PM_ID']===$id||isset($scope[$p['Project_ID']]));
    }
    public function view(array $a,string $id): void {Store::check(count(self::filter($this->visible($a),fn($p)=>$p['Project_ID']===$id))>0,'Bạn không có quyền xem dự án này.');}
    public function member(array $a,string $id): bool {if($a['System_Role']==='EXECUTIVE')return false;return count(self::filter($this->visible($a),fn($p)=>$p['Project_ID']===$id))>0;}
    public function canEdit(array $a,string $id): bool {
        $p=$this->s->find('PROJECTS',$id);if(!$p||$p['Status']==='Archived')return false;if(self::admin($a))return true;
        if(!in_array($a['System_Role'],['PM','PIC'],true))return false;
        if($p['PM_ID']===$a['User_ID'])return true;
        foreach($this->s->rows('PROJECT_MEMBERS')as$r)if($r['Project_ID']===$id&&$r['User_ID']===$a['User_ID']&&$r['Project_Role']==='PM')return true;return false;
    }
    public function edit(array $a,string $id): void {Store::check($this->canEdit($a,$id),'Bạn không có quyền sửa dự án này.');}
    public function canTask(array $a,array $t): bool {
        $p=$this->s->find('PROJECTS',$t['Project_ID']);if(!$p||$p['Status']==='Archived')return false;if($this->canEdit($a,$t['Project_ID']))return true;
        if(!in_array($a['System_Role'],['PM','PIC'],true)||!$this->member($a,$t['Project_ID']))return false;
        if($t['PIC_ID']===$a['User_ID'])return true;
        foreach($this->s->rows('ASSIGNMENTS')as$r)if($r['Task_ID']===$t['Task_ID']&&$r['User_ID']===$a['User_ID'])return true;return false;
    }
    public function bootstrap(array $a): array {
        $account=$this->s->find('AUTH_USERS',$a['User_ID']);return['schemaVersion'=>$this->s->schemaVersion(),'needsPasswordChange'=>$account['Must_Change_Password']==='TRUE','user'=>['id'=>$a['User_ID'],'name'=>$a['Full_Name'],'role'=>$a['System_Role']],'users'=>array_map(fn($u)=>['id'=>$u['User_ID'],'name'=>$u['Full_Name'],'department'=>$u['Department']],self::filter($this->s->rows('USERS'),fn($r)=>$r['Active']==='TRUE')),'today'=>Store::today()];
    }
    public function initial(array $a): array {$boot=$this->bootstrap($a);return['boot'=>$boot,'dash'=>$boot['needsPasswordChange']?null:$this->dashboard($a)];}
    public function projectRows(string $table,string $id): array{return self::filter($this->s->rows($table),fn($r)=>$r['Project_ID']===$id);}
    public function detail(array $a,string $id): array {
        $p=$this->s->find('PROJECTS',$id);Store::check($p,'Không tìm thấy dự án.');$this->view($a,$id);
        $tasks=$this->projectRows('TASKS',$id);$checklist=$this->projectRows('CHECKLIST_ITEMS',$id);$ids=array_column($tasks,'Task_ID');$assignments=self::filter($this->s->rows('ASSIGNMENTS'),fn($r)=>in_array($r['Task_ID'],$ids,true));$members=$this->projectRows('PROJECT_MEMBERS',$id);
        $j=$this->s->activeStructure();$pending=$j&&$j['projectId']===$id?['opId'=>$j['opId'],'status'=>$j['status'],'canRecover'=>self::admin($a)||$j['actorId']===$a['User_ID']]:null;
        $edit=$this->canEdit($a,$id);$member=$this->member($a,$id);$mine=array_fill_keys(array_column(self::filter($assignments,fn($r)=>$r['User_ID']===$a['User_ID']),'Task_ID'),true);$myIds=array_column(self::filter($tasks,fn($t)=>$edit||(in_array($a['System_Role'],['PM','PIC'],true)&&$member&&($t['PIC_ID']===$a['User_ID']||isset($mine[$t['Task_ID']])))),'Task_ID');
        return array_merge($this->references($p,$tasks,$members),['structureVersion'=>Structure::version($tasks),'structurePending'=>$this->canEdit($a,$id)?$pending:null,'schemaVersion'=>$this->s->schemaVersion(),'assignments'=>$assignments,'members'=>$members,'project'=>$p,'phases'=>$this->projectRows('PHASES',$id),'checklist'=>$checklist,'tasks'=>$tasks,'taskVersions'=>(object)(array_combine($ids,array_map(fn($t)=>$this->taskVersion($t),$tasks))?:[]),'issues'=>$this->projectRows('ISSUES',$id),'canEdit'=>$edit,'isMember'=>$member,'myUserId'=>$a['User_ID'],'myTaskIds'=>$myIds,'myChecklistIds'=>array_column(self::filter($checklist,fn($x)=>$edit||($member&&in_array($a['System_Role'],['PM','PIC'],true)&&($x['Owner_ID']===$a['User_ID']||in_array($x['Task_ID'],$myIds,true)))),'Item_ID')]);
    }
    public function portfolio(array $a): array {
        $projects=$this->visible($a);$ids=array_column($projects,'Project_ID');$tasks=self::filter($this->s->rows('TASKS'),fn($t)=>in_array($t['Project_ID'],$ids,true));$taskIds=array_column($tasks,'Task_ID');$out=['schemaVersion'=>$this->s->schemaVersion(),'groups'=>$this->s->rows('PROJECT_GROUPS'),'templates'=>$this->s->rows('PROCEDURE_TEMPLATES'),'projects'=>$projects,'tasks'=>$tasks,'assignments'=>self::filter($this->s->rows('ASSIGNMENTS'),fn($r)=>in_array($r['Task_ID'],$taskIds,true))];
        foreach(['phases'=>'PHASES','checklist'=>'CHECKLIST_ITEMS','issues'=>'ISSUES']as$k=>$table)$out[$k]=self::filter($this->s->rows($table),fn($r)=>in_array($r['Project_ID'],$ids,true));return$out;
    }
    public function clean(string $table,array $input,?array $existing=null): array {
        $out=[];foreach($this->s->columns($table)as$k)$out[$k]=(string)($existing[$k]??'');
        foreach(array_merge(self::EDITS[$table]??[],$table==='TASKS'&&$this->s->unified()?['Sort_Order']:[])as$k)if(array_key_exists($k,$input)){Store::check(is_scalar($input[$k])||$input[$k]===null,'Giá trị không hợp lệ.');$out[$k]=trim((string)($input[$k]??''));}return$out;
    }
    public static function date(string $date,bool $strict=false): void {
        if($date==='')return;Store::check(preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date),'Ngày phải có dạng YYYY-MM-DD: '.$date);
        $parts=explode('-',$date);Store::check((int)$parts[1]>=1&&(int)$parts[1]<=12&&(int)$parts[2]>=1&&(int)$parts[2]<=31,'Ngày không tồn tại.');
        $d=\DateTimeImmutable::createFromFormat('!Y-m-d',$date,new \DateTimeZone('UTC'));Store::check($d&&(!$strict||$d->format('Y-m-d')===$date),'Ngày không tồn tại.');
    }
    public static function dateRange(string $start,string $end,bool $strict=false): void {self::date($start,$strict);self::date($end,$strict);Store::check(!$start||!$end||$start<=$end,'End Date trước Start Date.');}
    public function saveProject(array $a,array $payload): array {
        $old=(isset($payload['Project_ID'])&&$payload['Project_ID']!=='')?$this->s->find('PROJECTS',$payload['Project_ID']):null;if($old)$this->edit($a,$old['Project_ID']);else Store::check(self::admin($a),'Chỉ PMO_ADMIN được tạo dự án.');
        $p=$this->clean('PROJECTS',$payload,$old);$p['Project_ID']=$old['Project_ID']??Store::id('PRJ');Store::check($p['Project_Name']!=='','Cần nhập tên dự án.');
        if($p['Group_ID']!=='')Store::check($this->s->find('PROJECT_GROUPS',$p['Group_ID']),'Nhóm dự án không hợp lệ.');
        Store::check(in_array($p['Status'],['Not Started','In Progress','On Hold','Completed','Cancelled','Archived'],true),'Project Status không hợp lệ.');Store::check(in_array($p['RAG'],self::RAGS,true),'RAG không hợp lệ.');self::dateRange($p['Start_Date'],$p['End_Date']);$p['Last_Updated']=Store::now();$this->s->put('PROJECTS',$p);$this->s->audit($a,'PROJECTS',$p['Project_ID'],$old?'UPDATE':'CREATE',$old,$p);return['ok'=>true,'id'=>$p['Project_ID']];
    }
    public function archive(array $a,string $id,bool $archived): array {
        Store::check(self::admin($a),'Chỉ PMO Admin được lưu trữ/khôi phục dự án.');$p=$this->s->find('PROJECTS',$id);Store::check($p,'Không tìm thấy dự án.');Store::check($archived?$p['Status']!=='Archived':$p['Status']==='Archived','Trạng thái lưu trữ không hợp lệ.');$before=$p;$p['Status']=$archived?'Archived':'On Hold';$p['Last_Updated']=Store::now();$this->s->put('PROJECTS',$p);$this->s->audit($a,'PROJECTS',$id,$archived?'ARCHIVE':'RESTORE',$before,$p);return['ok'=>true,'id'=>$id,'status'=>$p['Status']];
    }
    public function purge(array $a,string $id,string $confirmation): array {
        Store::check(self::admin($a)&&$confirmation==='PURGE:'.$id,'Xác nhận xóa hoặc quyền không hợp lệ.');$p=$this->s->find('PROJECTS',$id);Store::check($p&&$p['Status']==='Archived','Chỉ được xóa dự án đã Archive.');
        $taskIds=array_column($this->projectRows('TASKS',$id),'Task_ID');$phaseIds=array_column($this->projectRows('PHASES',$id),'Phase_ID');$deletions=[];
        foreach(['ASSIGNMENTS','CHECKLIST_ITEMS','ISSUES','PROJECT_MEMBERS','PROJECT_ATTRIBUTES','TASKS','PHASES','PROJECTS']as$table){$deletions[$table]=self::filter($this->s->rows($table),fn($r)=>($r['Project_ID']??'')===$id||in_array($r['Task_ID']??'',$taskIds,true)||($table==='CHECKLIST_ITEMS'&&in_array($r['Phase_ID'],$phaseIds,true)));}
        $counts=array_map('count',$deletions);$this->s->audit($a,'PROJECTS',$id,'PURGE',$p,['deletedCounts'=>$counts]);
        // Break self-relations before deleting the forest; all actions and audit share one transaction.
        foreach($deletions['TASKS']as$t){$t['Parent_Task_ID']='';$t['Dependency_ID']='';$this->s->put('TASKS',$t);}
        foreach($deletions as$table=>$rows)foreach($rows as$r)$this->s->delete($table,$r[$this->s->schema[$table][0]]);
        return['ok'=>true,'projectId'=>$id,'deletedCounts'=>$counts];
    }
    public function attributes(array $a,string $id): array {Store::check($this->s->find('PROJECTS',$id),'Project không tồn tại.');$this->view($a,$id);return $this->projectRows('PROJECT_ATTRIBUTES',$id);}
    public function saveAttribute(array $a,string $id,string $key,mixed $value): array {
        $this->edit($a,$id);Store::check(preg_match('/^[a-zA-Z][a-zA-Z0-9_]{1,63}$/D',$key)&&self::length((string)$value)<=2000,'Field key/value không hợp lệ.');$old=null;foreach($this->projectRows('PROJECT_ATTRIBUTES',$id)as$r)if($r['Field_Key']===$key)$old=$r;
        $r=['Attribute_ID'=>$old['Attribute_ID']??Store::id('ATR'),'Project_ID'=>$id,'Field_Key'=>$key,'Field_Value'=>(string)$value,'Updated_At'=>Store::now()];$this->s->put('PROJECT_ATTRIBUTES',$r);$this->s->audit($a,'PROJECT_ATTRIBUTES',$r['Attribute_ID'],$old?'UPDATE':'CREATE',$old,$r);return['ok'=>true];
    }
    private function userRef(array $u): array{return['id'=>$u['User_ID'],'name'=>$u['Full_Name'],'email'=>$u['Email'],'department'=>$u['Department'],'active'=>$u['Active']==='TRUE'];}
    public function references(array $p,array $tasks,array $members): array {
        $eligible=array_merge(array_column($members,'User_ID'),[$p['PM_ID']]);$ids=array_merge($eligible,array_column($tasks,'PIC_ID'));$counts=[];foreach($tasks as$t)if($t['PIC_ID']!==''&&!in_array($t['PIC_ID'],$eligible,true))$counts[$t['PIC_ID']]=($counts[$t['PIC_ID']]??0)+1;
        $non=[];foreach($counts as$id=>$count)$non[]=['id'=>(string)$id,'taskCount'=>$count];return['assigneeUsers'=>array_map(fn($u)=>$this->userRef($u),self::filter($this->s->rows('USERS'),fn($u)=>in_array($u['User_ID'],$ids,true))),'nonMemberPics'=>$non];
    }
    public function removalBlocks(array $a,array $p,array $tasks,array $members): array {
        $open=[];$responsibilities=[];foreach($tasks as$t)if($t['Status']!=='Done'){$open[$t['Task_ID']]=$t;if($t['PIC_ID']!=='')$responsibilities[$t['PIC_ID']][$t['Task_ID']]=true;}
        foreach($this->s->rows('ASSIGNMENTS')as$r)if(isset($open[$r['Task_ID']]))$responsibilities[$r['User_ID']][$r['Task_ID']]=true;
        $blocks=[];foreach($members as$m){$id=$m['User_ID'];if($id===$p['PM_ID'])$blocks[$id]='PM dự án luôn tham gia. Đổi PM trong Edit Project trước.';elseif(!self::admin($a)&&$id===$a['User_ID']&&$m['Project_Role']==='PM')$blocks[$id]='Nhờ PM khác hoặc PMO gỡ quyền PM của bạn để tránh tự mất quyền quản lý.';elseif(isset($responsibilities[$id]))$blocks[$id]='Còn '.count($responsibilities[$id]).' công việc đang mở: '.implode(', ',array_map(fn($id)=>$open[$id]['Task_Name'],array_slice(array_keys($responsibilities[$id]),0,3))).'. Cần phân công lại trước khi gỡ.';}return $blocks;
    }
    public function memberSettings(array $a,string $id,bool $directory=true): array {
        $this->edit($a,$id);$p=$this->s->find('PROJECTS',$id);$tasks=$this->projectRows('TASKS',$id);$members=$this->projectRows('PROJECT_MEMBERS',$id);
        $result=array_merge(['members'=>$members],$this->references($p,$tasks,$members),['removalBlocks'=>(object)$this->removalBlocks($a,$p,$tasks,$members)]);if($directory)$result['activeUsers']=array_map(fn($u)=>$this->userRef($u),self::filter($this->s->rows('USERS'),fn($u)=>$u['Active']==='TRUE'));return$result;
    }
    public function saveMembers(array $a,string $id,array $payload): array {
        $this->edit($a,$id);Store::check(!array_diff(array_keys($payload),['addUserIds','removeUserIds']),'Chỉ hỗ trợ thêm/gỡ thành viên.');$adds=$payload['addUserIds']??[];$removes=$payload['removeUserIds']??[];
        Store::check(is_array($adds)&&is_array($removes)&&count($adds)+count($removes)<=100,'Tối đa 100 thay đổi thành viên mỗi lần.');
        foreach(array_merge([$id],$adds)as$v)Store::check(is_string($v)&&strlen($v)>0&&strlen($v)<=128&&trim($v)===$v&&!preg_match('/^\s*[-=+@]/',$v),'User/Project ID không hợp lệ.');foreach($removes as$v)Store::check(is_string($v)&&strlen($v)>0&&strlen($v)<=128,'User ID không hợp lệ.');Store::check(!array_intersect($adds,$removes),'Không thêm và gỡ cùng một user.');
        $p=$this->s->find('PROJECTS',$id);$members=$this->projectRows('PROJECT_MEMBERS',$id);$blocks=$this->removalBlocks($a,$p,$this->projectRows('TASKS',$id),$members);
        foreach($adds as$uid){$u=$this->s->find('USERS',$uid);Store::check($u&&$u['Active']==='TRUE','Chỉ thêm user active.');}
        foreach($removes as$uid){Store::check($uid!==$p['PM_ID'],'Không thể gỡ PM dự án.');Store::check(!isset($blocks[$uid]),$blocks[$uid]??'');}
        foreach($members as$m)if(in_array($m['User_ID'],$removes,true)){$this->s->audit($a,'PROJECT_MEMBERS',$m['Member_ID'],'MEMBER_REMOVE_INTENT',$m,[]);$this->s->delete('PROJECT_MEMBERS',$m['Member_ID']);}
        foreach(array_unique($adds)as$uid)if($uid!==$p['PM_ID']&&!in_array($uid,array_column($members,'User_ID'),true)){$r=['Member_ID'=>Store::id('MEM'),'Project_ID'=>$id,'User_ID'=>$uid,'Project_Role'=>'Member'];$this->s->audit($a,'PROJECT_MEMBERS',$r['Member_ID'],'MEMBER_ADD_INTENT',[],$r);$this->s->put('PROJECT_MEMBERS',$r);}return array_merge(['ok'=>true],$this->memberSettings($a,$id,false));
    }
    public function taskVersion(array $t): string {return hash('sha256',Store::json(array_map(fn($k)=>(string)($t[$k]??''),$this->s->columns('TASKS'))));}
    public static function hierarchy(array $tasks,array $projects,bool $unified=true): array {
        $errors=[];$map=[];$projectIds=array_column($projects,'Project_ID');
        foreach($tasks as$t){$id=$t['Task_ID'];if($id===''||isset($map[$id]))$errors[]='DUPLICATE_TASK_ID:'.$id;$map[$id]=$t;if(!in_array($t['Project_ID'],$projectIds,true))$errors[]='MISSING_PROJECT:'.$id;if($unified&&!in_array($t['Task_Type'],['PHASE','TASK','MILESTONE'],true))$errors[]='INVALID_TYPE:'.$id;if($t['Task_Type']==='PHASE'&&$t['Parent_Task_ID']!=='')$errors[]='PHASE_NOT_ROOT:'.$id;}
        foreach($tasks as$t){$node=$t;$seen=[];$depth=0;$phase=false;while($node){$id=$node['Task_ID'];if(isset($seen[$id])){$errors[]='CYCLE:'.$id;break;}$seen[$id]=true;$depth++;$phase=$phase||($node['Phase_ID']??'')!=='';if($depth>4){$errors[]='MAX_DEPTH:'.$t['Task_ID'];break;}$parent=$node['Parent_Task_ID']??'';if($parent==='')break;if(!isset($map[$parent])){$errors[]='MISSING_PARENT:'.$id;break;}$p=$map[$parent];if($p['Project_ID']!==$node['Project_ID'])$errors[]='CROSS_PROJECT_PARENT:'.$id;if(in_array($p['Task_Type'],['Milestone','MILESTONE'],true))$errors[]='MILESTONE_HAS_CHILDREN:'.$parent;$node=$p;}if(!$unified&&$depth+($phase?1:0)>4)$errors[]='MAX_DEPTH:'.$t['Task_ID'];}
        return array_values(array_unique($errors));
    }
    public function sortOrder(array $all,array $t,?array $old,mixed $requested=null): string {
        $siblings=self::filter($all,fn($r)=>$r['Task_ID']!==$t['Task_ID']&&$r['Project_ID']===$t['Project_ID']&&($r['Parent_Task_ID']??'')===($t['Parent_Task_ID']??''));
        $max=0;foreach($siblings as$r)$max=max($max,(int)($r['Sort_Order']??0));$value=(string)($requested??($old&&$old['Parent_Task_ID']===$t['Parent_Task_ID']?$old['Sort_Order']:$max+1024));
        Store::check(preg_match('/^[1-9][0-9]*$/D',$value)&&(float)$value<=9007199254740991,'Sort_Order phải là số nguyên dương an toàn.');foreach($siblings as$r)Store::check((float)$r['Sort_Order']!==(float)$value,'Sort_Order trùng sibling.');return$value;
    }
    public function validateTask(array &$t,?array $old,array $input,bool $batch=false): void {
        $unified=$this->s->unified();$all=$this->s->rows('TASKS');
        Store::check($t['Task_Name']!==''&&(!$batch||self::length($t['Task_Name'])<=500),'Cần tên task (tối đa 500 ký tự).');
        Store::check(in_array($t['Task_Type'],$unified?['PHASE','TASK','MILESTONE']:['Task','Summary','Milestone'],true),'Task Type không hợp lệ.');
        Store::check(in_array($t['Status'],self::TASK_STATUSES,true)||($t['Task_Type']==='PHASE'&&$old&&$old['Status']===$t['Status']),'Task Status không hợp lệ.');
        Store::check(in_array($t['RAG'],self::RAGS,true)||($t['Task_Type']==='PHASE'&&$old&&$old['RAG']===$t['RAG']),'RAG không hợp lệ.');
        Store::check($t['Task_Type']==='PHASE'&&$t['Progress']===''||self::numberRange($t['Progress'],0,100),'Progress 0–100.');
        self::dateRange($t['Start_Date'],$t['End_Date'],$unified||$batch);
        if($t['Phase_ID']!==''){$p=$this->s->find('PHASES',$t['Phase_ID']);Store::check($p&&$p['Project_ID']===$t['Project_ID'],'Phase không hợp lệ.');}
        foreach(['Parent_Task_ID','Dependency_ID']as$k)if($t[$k]!==''){$r=$this->s->find('TASKS',$t[$k]);Store::check($r&&$r['Project_ID']===$t['Project_ID']&&$r['Task_ID']!==$t['Task_ID'],$k.' không hợp lệ.');}
        if(($unified||$batch)&&$t['PIC_ID']!==''&&(!$old||$old['PIC_ID']!==$t['PIC_ID'])){
            $p=$this->s->find('PROJECTS',$t['Project_ID']);$u=$this->s->find('USERS',$t['PIC_ID']);$members=array_column($this->projectRows('PROJECT_MEMBERS',$t['Project_ID']),'User_ID');Store::check($u&&$u['Active']==='TRUE'&&($p['PM_ID']===$t['PIC_ID']||in_array($t['PIC_ID'],$members,true)),'PIC phải là thành viên active của dự án.');
        }
        if($unified){
            if($old)Store::check($t['Parent_Task_ID']===$old['Parent_Task_ID']&&(!isset($input['Sort_Order'])||(string)$input['Sort_Order']===$old['Sort_Order']),'STRUCTURE_API_REQUIRED: dùng thao tác cấu trúc.');
            $t['Sort_Order']=$this->sortOrder($all,$t,$old,$input['Sort_Order']??null);
            if($t['Task_Type']==='PHASE')Store::check($t['PIC_ID']===''&&$t['Progress']==='' ,'PHASE không có PIC/Progress thực thi.');
            if($old&&$old['Task_Type']!=='PHASE'&&$t['Task_Type']==='PHASE')foreach($this->s->rows('ASSIGNMENTS')as$r)Store::check($r['Task_ID']!==$t['Task_ID'],'Task có assignment không thể chuyển thành PHASE.');
        }
        if(($unified||$batch)&&in_array($t['Task_Type'],['Milestone','MILESTONE'],true))Store::check($t['Start_Date']&&$t['Start_Date']===$t['End_Date'],'Milestone phải có cùng ngày bắt đầu/kết thúc.');
        if($unified||$batch){$proposed=self::filter($all,fn($r)=>$r['Task_ID']!==$t['Task_ID']);$proposed[]=$t;$errors=self::hierarchy($proposed,$this->s->rows('PROJECTS'),$unified);Store::check(!$errors,'Hierarchy: '.implode(', ',$errors));}
    }
    public static function length(string $s): int {return preg_match_all('/./us',$s)+preg_match_all('/[\x{10000}-\x{10FFFF}]/u',$s);}
    public static function number(mixed $value): float {
        if($value===null)return 0.0;if(is_bool($value)||is_int($value)||is_float($value))return(float)$value;if(!is_string($value))return NAN;
        $value=preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u','',$value);if($value==='')return 0.0;
        if($value==='Infinity'||$value==='+Infinity')return INF;if($value==='-Infinity')return -INF;
        if(preg_match('/^0[xX][0-9a-fA-F]+$/D',$value))return(float)hexdec(substr($value,2));if(preg_match('/^0[bB][01]+$/D',$value))return(float)bindec(substr($value,2));if(preg_match('/^0[oO][0-7]+$/D',$value))return(float)octdec(substr($value,2));
        return preg_match('/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/D',$value)?(float)$value:NAN;
    }
    public static function duration(mixed $value): float {$n=self::number($value);return max(1,is_nan($n)||$n===0.0?1:$n);}
    public static function numberRange(mixed $n,float $low,float $high): bool {$n=self::number($n);return is_finite($n)&&$n>=$low&&$n<=$high;}
    public function saveTask(array $a,array $payload): array {
        $old=(isset($payload['Task_ID'])&&$payload['Task_ID']!=='')?$this->s->find('TASKS',$payload['Task_ID']):null;if((isset($payload['Task_ID'])&&$payload['Task_ID']!==''))Store::check($old,'Task ID không tồn tại.');$id=$old['Project_ID']??($payload['Project_ID']??'');$this->edit($a,$id);Store::check(!$old||(!isset($payload['Project_ID'])||$payload['Project_ID']==='')||$payload['Project_ID']===$id,'Không hỗ trợ chuyển task sang dự án khác.');
        $t=$this->clean('TASKS',$payload,$old);$t['Task_ID']=$old['Task_ID']??Store::id('TSK');$t['Project_ID']=$id;$this->validateTask($t,$old,$payload);$this->s->put('TASKS',$t);$this->s->audit($a,'TASKS',$t['Task_ID'],$old?'UPDATE':'CREATE',$old,$t);return['ok'=>true,'id'=>$t['Task_ID'],'task'=>$t,'version'=>$this->taskVersion($t)];
    }
    public function updateTask(array $a,string $id,mixed $progress,string $status,mixed $note): array {
        $old=$this->s->find('TASKS',$id);Store::check($old,'Task không tồn tại.');Store::check(self::execution($old),'PHASE không có progress thực thi.');Store::check($this->canTask($a,$old),'Task chưa được giao cho bạn.');Store::check(in_array($status,self::TASK_STATUSES,true)&&self::numberRange($progress,0,100),'Status hoặc Progress không hợp lệ.');Store::check(self::length((string)$note)<=2000,'Ghi chú tối đa 2.000 ký tự.');
        $t=array_merge($old,['Status'=>$status,'Progress'=>(string)$progress,'Member_Update'=>(string)$note,'Member_Updated_At'=>Store::now()]);$this->s->put('TASKS',$t);$this->s->audit($a,'TASKS',$id,'MEMBER_PROGRESS',$old,$t);return['ok'=>true,'id'=>$id,'task'=>$t,'version'=>$this->taskVersion($t)];
    }
    public function batch(array $a,string $id,array $ops): array {
        Store::check(count($ops)>0&&count($ops)<=50,'Batch gồm 1–50 thao tác.');$this->view($a,$id);$p=$this->s->find('PROJECTS',$id);Store::check($p&&$p['Status']!=='Archived','Dự án đã lưu trữ.');$plan=$this->canEdit($a,$id);$results=[];$seen=[];$taskSeen=[];
        foreach($ops as$op){$result=['opId'=>$op['opId']??null,'ok'=>false];$this->s->db->exec('SAVEPOINT batch_op');
            try{
                Store::check(is_array($op)&&is_string($op['opId']??null)&&preg_match('/^[a-zA-Z0-9-]{16,100}$/D',$op['opId']),'Operation ID không hợp lệ.');Store::check(!isset($seen[$op['opId']]),'Operation ID trùng trong batch.');$seen[$op['opId']]=true;
                Store::check(in_array($op['kind']??'', ['create','update'],true),'Loại thao tác không hợp lệ.');$taskId=$op['kind']==='create'?'TSK-B-'.substr(hash('sha256',$a['User_ID'].'|'.$id.'|'.$op['opId']),0,32):(string)($op['taskId']??'');Store::check(!isset($taskSeen[$taskId]),'Mỗi task chỉ xuất hiện một lần trong batch.');$taskSeen[$taskId]=true;
                $old=$this->s->find('TASKS',$taskId);$fields=$op['fields']??[];Store::check(is_array($fields),'Giá trị không hợp lệ.');Store::check(!$old||$old['Project_ID']===$id,'Task thuộc dự án khác.');Store::check($plan||($op['kind']==='update'&&$old&&$this->canTask($a,$old)),'Không có quyền sửa task.');
                $allowed=$plan?array_diff(array_merge(self::EDITS['TASKS'],$this->s->unified()?['Sort_Order']:[]),['Project_ID','Member_Updated_At']):['Status','Progress','Member_Update'];Store::check(count($fields)>0&&!array_diff(array_keys($fields),$allowed),'Trường không được phép sửa.');
                foreach($fields as$v)Store::check((is_string($v)||is_int($v)||is_float($v))&&self::length((string)$v)<=4000&&!preg_match('/^\s*[-=+@]/u',(string)$v),'Giá trị không hợp lệ hoặc công thức Sheets.');
                if($op['kind']==='update')Store::check($old,'Task không tồn tại.');
                if($op['kind']==='create'&&$old){$result=array_merge($result,['ok'=>true,'id'=>$taskId,'task'=>$old,'version'=>$this->taskVersion($old)]);$results[]=$result;continue;}
                $normalized=$fields;foreach(['Parent_Task_ID','Dependency_ID']as$k)if(!empty($normalized[$k])&&str_starts_with((string)$normalized[$k],'tmp-'))$normalized[$k]='TSK-B-'.substr(hash('sha256',$a['User_ID'].'|'.$id.'|'.substr($normalized[$k],4)),0,32);
                $defaults=['Task_Type'=>$this->s->unified()?'TASK':'Task','Status'=>'Not Started','Progress'=>($normalized['Task_Type']??'')==='PHASE'?'':'0','RAG'=>'Green'];
                $t=$this->clean('TASKS',$normalized,$old??$defaults);$t['Task_ID']=$taskId;$t['Project_ID']=$id;
                $same=$old!==null;foreach($fields as$k=>$v)if((string)($old[$k]??'')!==trim((string)$v))$same=false;
                if($old)Store::check(($op['baseVersion']??null)===$this->taskVersion($old)||$same,'CONFLICT: Task đã thay đổi. Giữ bản nháp; đối chiếu trước khi thử lại.');
                $this->validateTask($t,$old,$normalized,true);
                if(!$same){if(!$plan)$t['Member_Updated_At']=Store::now();$this->s->audit($a,'TASKS',$taskId,'BATCH_INTENT',$old,['opId'=>$op['opId'],'task'=>$t]);$this->s->put('TASKS',$t);}else $t=$old;
                $result=array_merge($result,['ok'=>true,'id'=>$taskId,'task'=>$t,'version'=>$this->taskVersion($t)]);
            }catch(\Throwable $e){$this->s->db->exec('ROLLBACK TO SAVEPOINT batch_op');$this->s->invalidate();$result['error']=$e instanceof \PDOException?'Chưa xác nhận lưu: database constraint.':$e->getMessage();$result['code']=str_starts_with($result['error'],'CONFLICT')?'CONFLICT':'VALIDATION';}
            $results[]=$result;
        }
        return ['ok'=>!in_array(false,array_column($results,'ok'),true),'results'=>$results];
    }
    public function compatibility(array $a,string $id): array {
        $this->edit($a,$id);$tasks=$this->projectRows('TASKS',$id);$phases=$this->projectRows('PHASES',$id);$ids=array_column($tasks,'Task_ID');$phaseIds=array_column($phases,'Phase_ID');return['dryRun'=>true,'schemaChanged'=>false,'phaseCount'=>count($phases),'taskCount'=>count($tasks),'proposedPhaseTasks'=>array_map(fn($p)=>['sourcePhaseId'=>$p['Phase_ID'],'proposedTaskId'=>'TSK-PHASE-'.$p['Phase_ID'],'Task_Type'=>'PHASE','alreadyExists'=>in_array('TSK-PHASE-'.$p['Phase_ID'],$ids,true)],$phases),'missingParents'=>array_column(self::filter($tasks,fn($t)=>$t['Parent_Task_ID']&&!in_array($t['Parent_Task_ID'],$ids,true)),'Task_ID'),'missingPhases'=>array_column(self::filter($tasks,fn($t)=>$t['Phase_ID']&&!in_array($t['Phase_ID'],$phaseIds,true)),'Task_ID')];
    }
    public function saveIssue(array $a,array $payload): array {
        $old=(isset($payload['Issue_ID'])&&$payload['Issue_ID']!=='')?$this->s->find('ISSUES',$payload['Issue_ID']):null;if((isset($payload['Issue_ID'])&&$payload['Issue_ID']!==''))Store::check($old,'Issue ID không tồn tại.');$id=$old['Project_ID']??($payload['Project_ID']??'');$p=$this->s->find('PROJECTS',$id);Store::check($p&&$p['Status']!=='Archived','Dự án đã lưu trữ hoặc không tồn tại.');$plan=$this->canEdit($a,$id);$member=in_array($a['System_Role'],['PM','PIC'],true)&&$this->member($a,$id);Store::check($plan||$member,'Không có quyền tạo/cập nhật issue.');
        if(!$plan&&$old){Store::check($old['Created_By']===$a['User_ID'],'Chỉ được sửa issue do bạn tạo.');Store::check(!array_diff(array_keys($payload),['Issue_ID','Project_ID','Status','Resolution_Plan','Description']),'Member chỉ được cập nhật trạng thái/nội dung xử lý issue.');}
        if(!$plan&&!$old)Store::check(($payload['Owner_ID']??'')===$a['User_ID'],'Member tạo issue phải tự làm owner.');Store::check(!$old||(!isset($payload['Project_ID'])||$payload['Project_ID']==='')||$payload['Project_ID']===$id,'Không hỗ trợ chuyển issue.');
        $r=$this->clean('ISSUES',$payload,$old);$r['Issue_ID']=$old['Issue_ID']??Store::id('ISS');$r['Project_ID']=$id;
        Store::check($r['Title']&&in_array($r['Severity'],['Low','Medium','High','Critical'],true)&&in_array($r['Status'],['Open','In Progress','Resolved','Closed'],true)&&in_array(strtoupper($r['Decision_Required']),['TRUE','FALSE'],true),'Title/Severity/Status/Decision Required không hợp lệ.');self::dateRange($r['Open_Date'],$r['Due_Date']);if($r['Task_ID']!==''){$t=$this->s->find('TASKS',$r['Task_ID']);Store::check($t&&$t['Project_ID']===$id,'Task liên kết không hợp lệ.');}
        $r['Created_By']=$old['Created_By']??$a['User_ID'];$r['Last_Updated']=Store::now();$this->s->put('ISSUES',$r);$this->s->audit($a,'ISSUES',$r['Issue_ID'],$old?'UPDATE':'CREATE',$old,$r);return['ok'=>true,'id'=>$r['Issue_ID']];
    }
    public function saveAssignment(array $a,array $payload): array {
        $old=(isset($payload['Assignment_ID'])&&$payload['Assignment_ID']!=='')?$this->s->find('ASSIGNMENTS',$payload['Assignment_ID']):null;if((isset($payload['Assignment_ID'])&&$payload['Assignment_ID']!==''))Store::check($old,'Assignment ID không tồn tại.');$taskId=$old['Task_ID']??($payload['Task_ID']??'');$t=$this->s->find('TASKS',$taskId);Store::check($t,'Task không tồn tại.');Store::check(self::execution($t),'Không tạo allocation cho PHASE.');$this->edit($a,$t['Project_ID']);
        $r=$this->clean('ASSIGNMENTS',$payload,$old);$r['Task_ID']=$taskId;$r['Assignment_ID']=$old['Assignment_ID']??Store::id('ASN');$u=$this->s->find('USERS',$r['User_ID']);Store::check($u&&strtoupper($u['Active'])==='TRUE','Nhân sự không hợp lệ.');self::dateRange($r['Start_Date'],$r['End_Date']);Store::check($r['Start_Date']&&$r['End_Date'],'Thời gian assignment không hợp lệ.');Store::check($r['Allocation_Pct']===''||self::numberRange($r['Allocation_Pct'],0,100),'Allocation từng assignment từ 0 đến 100.');Store::check($r['Planned_Effort_Days']===''||self::numberRange($r['Planned_Effort_Days'],0,PHP_FLOAT_MAX),'Effort không hợp lệ.');$this->s->put('ASSIGNMENTS',$r);$this->s->audit($a,'ASSIGNMENTS',$r['Assignment_ID'],$old?'UPDATE':'CREATE',$old,$r);return['ok'=>true,'id'=>$r['Assignment_ID']];
    }
    public function saveChecklist(array $a,array $payload): array {
        $old=$this->s->find('CHECKLIST_ITEMS',(string)($payload['Item_ID']??''));Store::check($old,'Không tìm thấy checklist item.');$p=$this->s->find('PROJECTS',$old['Project_ID']);Store::check($p&&$p['Status']!=='Archived','Dự án đã lưu trữ, không được cập nhật.');$plan=$this->canEdit($a,$old['Project_ID']);$task=$this->s->find('TASKS',$old['Task_ID']);$member=!$plan&&in_array($a['System_Role'],['PM','PIC'],true)&&$this->member($a,$old['Project_ID'])&&($old['Owner_ID']===$a['User_ID']||$task&&$task['Project_ID']===$old['Project_ID']&&$this->canTask($a,$task));Store::check($plan||$member,'Không có quyền cập nhật checklist này.');if($member)Store::check(!array_diff(array_keys($payload),['Item_ID','Status','Evidence_URL','Notes']),'Member không được đổi hạn hoặc người phụ trách.');
        $r=$this->clean('CHECKLIST_ITEMS',$payload,$old);Store::check(in_array($r['Status'],['Missing','Preparing','For Approval','Returned','Done','Waived'],true),'Checklist Status không hợp lệ.');self::date($r['Due_Date']);Store::check($r['Evidence_URL']===''||preg_match('/^https:\/\//i',$r['Evidence_URL']),'Evidence_URL phải là https URL.');$r['Last_Updated']=Store::now();$this->s->put('CHECKLIST_ITEMS',$r);$this->s->audit($a,'CHECKLIST_ITEMS',$r['Item_ID'],'UPDATE',$old,$r);return['ok'=>true,'id'=>$r['Item_ID']];
    }
    public static function addDay(string $date,int $n): string {return (new \DateTimeImmutable($date.'T00:00:00Z'))->modify(($n>=0?'+':'').$n.' days')->format('Y-m-d');}
    public function working(string $date): bool {
        $r=$this->s->find('CALENDAR',$date);if($r&&$r['Is_Working_Day']!=='')return$r['Is_Working_Day']==='TRUE';return (int)(new \DateTimeImmutable($date.'T00:00:00Z'))->format('N')<6;
    }
    public function addWorking(string $date,int|float $n): string {
        $day=$date;$accepted=0;for($i=0;$i<14&&!$this->working($day);$i++)$day=self::addDay($day,1);
        for($guard=0;$accepted<$n&&$guard<366;$guard++){$day=self::addDay($day,1);if($this->working($day))$accepted++;}return$day;
    }
    public function procedure(array $a,string $id,string $templateId,string $phaseName,string $start): array {
        $this->edit($a,$id);self::date($start);Store::check($start!=='','Cần ngày khởi tạo.');$unified=$this->s->unified();$key='CR002_IMPORT_'.hash('sha256',$id.'|'.$templateId);$record=$this->s->find('CONFIG',$key);$journal=$record?json_decode($record['Value'],true,512,JSON_THROW_ON_ERROR):null;
        if($unified&&$journal&&$journal['status']==='COMPLETED')return['ok'=>true,'phaseId'=>$journal['phaseId'],'taskIds'=>$journal['taskIds'],'resumed'=>true];
        if(!$unified||!$journal){
            foreach($this->projectRows('PHASES',$id)as$p)Store::check($p['Template_ID']!==$templateId,'Template đã được tạo cho dự án này; không import trùng.');
            $steps=self::filter($this->s->rows('PROCEDURE_TEMPLATES'),fn($t)=>$t['Template_ID']===$templateId);usort($steps,function($a,$b){$delta=self::number($a['Step_No'])-self::number($b['Step_No']);return is_nan($delta)?0:($delta<=>0);});Store::check(count($steps)>0,'Không có template thủ tục.');
            $phaseId=$unified?'PHS-U-'.substr(hash('sha256',$key),0,24):Store::id('PHS');$phaseTaskId='TSK-PHASE-'.$phaseId;$tasks=[];$items=[];$pointer=$this->addWorking($start,0);
            foreach($steps as$i=>$step){$days=self::duration($step['Duration_Days']);$end=$this->addWorking($pointer,$days-1);$taskId=$unified?'TSK-U-'.substr(hash('sha256',$key.'|'.$i),0,24):Store::id('TSK');
                $t=$this->clean('TASKS',[]);$t=array_merge($t,['Task_ID'=>$taskId,'Project_ID'=>$id,'Parent_Task_ID'=>$unified?$phaseTaskId:'','Task_Name'=>$step['Task_Name'],'Task_Type'=>$unified?'TASK':'Task','Start_Date'=>$pointer,'End_Date'=>$end,'Progress'=>'0','Status'=>'Not Started','RAG'=>'Green','Description'=>'Thủ tục chuẩn: '.$step['Template_Name'],'Phase_ID'=>$phaseId]);if($unified)$t['Sort_Order']=(string)(($i+1)*1024);$tasks[]=$t;
                if($step['Required_Document']!=='')$items[]=['Item_ID'=>$unified?'DOC-U-'.substr(hash('sha256',$key.'|'.$i),0,24):Store::id('DOC'),'Project_ID'=>$id,'Phase_ID'=>$phaseId,'Task_ID'=>$taskId,'Item_Name'=>$step['Required_Document'],'Required'=>'TRUE','Status'=>'Missing','Due_Date'=>$end,'Owner_ID'=>'','Evidence_URL'=>'','Notes'=>'','Last_Updated'=>Store::now()];$pointer=$this->addWorking($end,1);
            }
            $duration=array_sum(array_map(fn($s)=>self::duration($s['Duration_Days']),$steps));$phase=['Phase_ID'=>$phaseId,'Project_ID'=>$id,'Phase_Name'=>$phaseName!==''?$phaseName:$steps[0]['Template_Name'],'Phase_Order'=>(string)(count($this->projectRows('PHASES',$id))+1),'Start_Date'=>$tasks[0]['Start_Date'],'End_Date'=>$unified?$tasks[count($tasks)-1]['End_Date']:$this->addWorking($this->addWorking($start,0),$duration-1),'Status'=>'In Progress','RAG'=>'Green','Template_ID'=>$templateId];
            $operations=[['table'=>'PHASES','row'=>$phase]];
            if($unified){$phaseTask=array_merge($this->clean('TASKS',[]),['Task_ID'=>$phaseTaskId,'Project_ID'=>$id,'Task_Name'=>$phase['Phase_Name'],'Task_Type'=>'PHASE','Start_Date'=>$phase['Start_Date'],'End_Date'=>$phase['End_Date'],'Status'=>'In Progress','RAG'=>'Green','Phase_ID'=>$phaseId,'Sort_Order'=>$this->sortOrder($this->s->rows('TASKS'),['Task_ID'=>$phaseTaskId,'Project_ID'=>$id,'Parent_Task_ID'=>''],null)]);$operations[]=['table'=>'TASKS','row'=>$phaseTask];}
            foreach($tasks as$t)$operations[]=['table'=>'TASKS','row'=>$t];foreach($items as$t)$operations[]=['table'=>'CHECKLIST_ITEMS','row'=>$t];$journal=['status'=>'RUNNING','phaseId'=>$phaseId,'taskIds'=>array_column($tasks,'Task_ID'),'operations'=>$operations,'cursor'=>0];if($unified)Store::check(self::length(Store::json($journal))<45000,'Template quá lớn cho journal CONFIG; chưa có dữ liệu nào được ghi.');
        }
        foreach($journal['operations']as$i=>$op){$table=$op['table'];$row=$op['row'];$rowId=$row[$this->s->schema[$table][0]];$found=$this->s->find($table,$rowId);
            if(!$found){$this->s->audit($a,$table,$rowId,$unified?'IMPORT_INTENT':'CREATE_FROM_TEMPLATE',[],$row);$this->s->put($table,$row);}else{Store::check($found['Project_ID']===$id,'Import ID collision.');foreach(['Parent_Task_ID','Task_Type','Task_ID','Phase_ID']as$k)if(array_key_exists($k,$row))Store::check($found[$k]===$row[$k],'Import relationship conflict: '.$k);}$journal['cursor']=$i+1;
        }
        $journal['status']='COMPLETED';if($unified)$this->s->config($key,Store::json($journal));return['ok'=>true,'phaseId'=>$journal['phaseId'],'taskIds'=>$journal['taskIds']];
    }
    public function workload(array $a,bool $daily,string $start,mixed $count=null): array {
        self::date($start);Store::check($start!=='','Cần ngày bắt đầu.');$numeric=self::number($count);if(is_nan($numeric))$numeric=0;$count=(int)min($daily?31:16,max(1,$numeric?:($daily?14:8)));$projects=array_column(self::filter($this->visible($a),fn($p)=>$p['Status']!=='Archived'),null,'Project_ID');$tasks=array_column($this->s->rows('TASKS'),null,'Task_ID');$assignments=$this->s->rows('ASSIGNMENTS');
        if(!$daily){$n=(int)(new \DateTimeImmutable($start.'T00:00:00Z'))->format('N');$start=self::addDay($start,-($n-1));}
        $dates=[];for($i=0;$i<$count;$i++)$dates[]=self::addDay($start,$i*($daily?1:7));$people=[];
        foreach($this->s->rows('USERS')as$u){if(strtoupper($u['Active'])!=='TRUE')continue;$buckets=[];
            foreach($dates as$date){$days=[];if($daily){if($this->working($date))$days[]=$date;}else{for($i=0;$i<5;$i++){$d=self::addDay($date,$i);$override=$this->s->find('CALENDAR',$d);if(!$override||strtoupper($override['Is_Working_Day'])!=='FALSE')$days[]=$d;}}
                $active=self::filter($assignments,function($r)use($u,$days,$tasks,$projects){if($r['User_ID']!==$u['User_ID']||!self::execution($tasks[$r['Task_ID']]??null)||!isset($projects[$tasks[$r['Task_ID']]['Project_ID']]))return false;foreach($days as$d)if($d>=$r['Start_Date']&&$d<=$r['End_Date'])return true;return false;});
                $pct=0;foreach($days as$d)foreach($active as$r)if($d>=$r['Start_Date']&&$d<=$r['End_Date']&&$r['Allocation_Pct']!=='')$pct+=self::number($r['Allocation_Pct']);
                $details=[];foreach($active as$r){$t=$tasks[$r['Task_ID']];$det=['taskId'=>$t['Task_ID'],'taskName'=>$t['Task_Name'],'projectName'=>$projects[$t['Project_ID']]['Project_Name'],'allocation'=>$r['Allocation_Pct']];if(!$daily)$det['projectId']=$t['Project_ID'];$details[]=$det;}
                $b=['taskCount'=>count(array_unique(array_column($active,'Task_ID'))),'allocationPct'=>$daily?$pct:(count($days)?(int)round($pct/count($days)):0),'hasMissingAllocation'=>count(self::filter($active,fn($r)=>$r['Allocation_Pct']===''))>0,'details'=>$details];if($daily){$b=['date'=>$date,'isWorkingDay'=>$this->working($date)]+$b;}else{$b=['week'=>$date,'assignmentCount'=>count($active)]+$b;}$buckets[]=$b;
            }
            $people[]=['id'=>$u['User_ID'],'name'=>$u['Full_Name'],'department'=>$u['Department'],$daily?'days':'weeks'=>$buckets];
        }
        $out=[$daily?'dates':'weeks'=>$dates,'people'=>$people];if(!$daily)$out['method']='Average assigned allocation across available weekdays; excludes weekends and calendar nonworking days. Missing allocations are flagged.';return$out;
    }
    public function dashboard(array $a): array {
        $projects=self::filter($this->visible($a),fn($p)=>$p['Status']!=='Archived');$projectMap=array_column($projects,null,'Project_ID');$ids=array_map('strval',array_keys($projectMap));$today=Store::today();$tasks=self::filter($this->s->rows('TASKS'),fn($t)=>in_array($t['Project_ID'],$ids,true)&&self::execution($t));$issues=self::filter($this->s->rows('ISSUES'),fn($r)=>in_array($r['Project_ID'],$ids,true));$open=self::filter($issues,fn($r)=>!in_array($r['Status'],['Resolved','Closed'],true));
        $pending=self::filter($this->s->rows('CHECKLIST_ITEMS'),fn($r)=>in_array($r['Project_ID'],$ids,true)&&$r['Required']==='TRUE'&&!in_array($r['Status'],['Done','Waived'],true));$overdue=self::filter($pending,fn($r)=>$r['Due_Date']&&$r['Due_Date']<$today);$active=self::filter($projects,fn($p)=>!in_array($p['Status'],['Completed','Cancelled','Archived'],true));$activeIds=array_column($active,'Project_ID');$late=self::filter($tasks,fn($t)=>$t['End_Date']&&$t['End_Date']<$today&&$t['Status']!=='Done'&&in_array($t['Project_ID'],$activeIds,true));
        $kpi=['total'=>count($projects),'active'=>count($active)];foreach(['red'=>'Red','amber'=>'Amber','green'=>'Green']as$k=>$rag)$kpi[$k]=count(self::filter($active,fn($p)=>$p['RAG']===$rag));$kpi+=['openIssues'=>count($open),'lateTasks'=>count($late),'decisions'=>count(self::filter($open,fn($r)=>strtoupper($r['Decision_Required'])==='TRUE')),'pendingDocuments'=>count($pending),'overdueDocuments'=>count($overdue)];
        $problems=array_map(fn($r)=>['id'=>$r['Issue_ID'],'projectId'=>$r['Project_ID'],'projectName'=>$projectMap[$r['Project_ID']]['Project_Name'],'title'=>$r['Title'],'severity'=>$r['Severity'],'status'=>$r['Status'],'owner'=>$r['Owner_ID'],'due'=>$r['Due_Date'],'impact'=>$r['Impact'],'decision'=>$r['Decision_Required']],$open);$severity=['Critical'=>0,'High'=>1,'Medium'=>2,'Low'=>3];usort($problems,fn($a,$b)=>($severity[$a['severity']]??4)<=>($severity[$b['severity']]??4));
        $alerts=array_map(fn($r)=>['itemId'=>$r['Item_ID'],'projectId'=>$r['Project_ID'],'projectName'=>$projectMap[$r['Project_ID']]['Project_Name'],'name'=>$r['Item_Name'],'status'=>$r['Status'],'due'=>$r['Due_Date'],'overdue'=>(bool)($r['Due_Date']&&$r['Due_Date']<$today)],$pending);usort($alerts,fn($a,$b)=>(int)$b['overdue']<=>(int)$a['overdue']);
        $counts=array_count_values(array_column($open,'Project_ID'));return['asOf'=>$today,'kpi'=>$kpi,'problems'=>$problems,'procedureAlerts'=>array_slice($alerts,0,40),'projects'=>array_map(fn($p)=>['id'=>$p['Project_ID'],'name'=>$p['Project_Name'],'pm'=>$p['PM_ID'],'department'=>$p['Department'],'rag'=>$p['RAG'],'status'=>$p['Status'],'health'=>$p['Health_Summary'],'start'=>$p['Start_Date'],'end'=>$p['End_Date'],'issueCount'=>$counts[$p['Project_ID']]??0],$projects)];
    }
}
