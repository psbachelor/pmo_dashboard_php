<?php
declare(strict_types=1);
namespace VCX\Parity;
final class Importer {
    public array $schema;
    public function __construct(){ $this->schema=json_decode(file_get_contents(__DIR__.'/schema.json'),true,512,JSON_THROW_ON_ERROR); }
    public function read(string $path): array {
        if(is_dir($path)){
            $tables=[];foreach($this->schema as$table=>$cols){$file=rtrim($path,'/').'/'.$table.'.csv';Store::check(is_file($file),'Missing export file '.$table.'.csv');$f=fopen($file,'r');$header=fgetcsv($f,0,',','"','');if(isset($header[0]))$header[0]=preg_replace('/^\xEF\xBB\xBF/','',$header[0]);$rows=[];$line=1;while(($values=fgetcsv($f,0,',','"',''))!==false){$line++;if($values===[null])continue;Store::check(count($values)===count($header),'Column count mismatch '.$table.':'.$line);$rows[]=array_combine($header,$values);}fclose($f);$expected=$table==='TASKS'&&in_array('Sort_Order',$header,true)?array_merge($cols,['Sort_Order']):$cols;Store::check($header===$expected,'Header mismatch '.$table);$tables[$table]=$rows;}
            $schema='LEGACY_V1';foreach($tables['CONFIG']as$r)if($r['Key']==='DATABASE_SCHEMA_VERSION')$schema=$r['Value'];return['schemaVersion'=>$schema,'tables'=>$tables];
        }
        return json_decode(file_get_contents($path),true,128,JSON_THROW_ON_ERROR);
    }
    public static function canonical(mixed $x): string {
        if(is_array($x)){if(array_is_list($x))return'['.implode(',',array_map([self::class,'canonical'],$x)).']';ksort($x,SORT_STRING);$pairs=[];foreach($x as$k=>$v)if($k!=='_row')$pairs[]=Store::json((string)$k).':'.self::canonical($v);return'{'.implode(',',$pairs).'}';}return Store::json($x);
    }
    public static function fingerprint(array $snapshot): string {return hash('sha256',self::canonical($snapshot));}
    public function validate(array $snapshot): array {
        $errors=[];$tables=$snapshot['tables']??[];$version=$snapshot['schemaVersion']??'';$unified=$version==='UNIFIED_TASKS_V2';if(!in_array($version,['LEGACY_V1','UNIFIED_TASKS_V2'],true))$errors[]=['code'=>'SCHEMA_INCOMPATIBLE'];$keys=[];
        foreach(array_keys($tables)as$t)if(!isset($this->schema[$t]))$errors[]=['code'=>'UNKNOWN_TABLE','table'=>$t];
        foreach($this->schema as$table=>$cols){if(!isset($tables[$table])||!is_array($tables[$table])||!array_is_list($tables[$table])){$errors[]=['code'=>'MISSING_TABLE','table'=>$table];continue;}$keys[$table]=[];
            foreach($tables[$table]as$i=>$r){if(!is_array($r)){$errors[]=['code'=>'INVALID_ROW','table'=>$table,'row'=>$i+2];continue;}$allowed=array_merge($cols,$table==='TASKS'&&$unified?['Sort_Order']:[]);$id=$r[$cols[0]]??'';$key=$table==='PROCEDURE_TEMPLATES'?Store::json([$id,$r['Step_No']??'']):$id;
                if($id===''||$table!=='PROCEDURE_TEMPLATES'&&isset($keys[$table][$key]))$errors[]=['code'=>'DUPLICATE_OR_EMPTY_ID','table'=>$table,'row'=>$i+2];$keys[$table][$key]=true;
                if($table!=='PROCEDURE_TEMPLATES'&&strlen((string)$id)>128)$errors[]=['code'=>'ID_TOO_LONG','table'=>$table,'row'=>$i+2];
                if(array_diff(array_keys($r),array_merge($allowed,['_row']))||array_diff($allowed,array_keys($r)))$errors[]=['code'=>'ROW_COLUMNS','table'=>$table,'row'=>$i+2];
                foreach($r as$k=>$v){if($k==='_row')continue;if(!is_string($v))$errors[]=['code'=>'NON_STRING_CELL','table'=>$table,'row'=>$i+2,'field'=>$k];if(in_array($k,['Start_Date','End_Date','Due_Date','Open_Date','Date'],true))try{ControlTower::date((string)$v,true);}catch(\Throwable $e){$errors[]=['code'=>'INVALID_DATE','table'=>$table,'row'=>$i+2,'field'=>$k];}}
                if(isset($r['Start_Date'],$r['End_Date'])&&$r['Start_Date']&&$r['End_Date']&&$r['Start_Date']>$r['End_Date'])$errors[]=['code'=>'DATE_RANGE','table'=>$table,'row'=>$i+2];
                foreach(['Active','Must_Change_Password','Revoked','Success','Is_Working_Day','Required']as$flag)if(isset($r[$flag])&&$r[$flag]!==''&&!in_array($r[$flag],['TRUE','FALSE'],true))$errors[]=['code'=>'INVALID_FLAG','table'=>$table,'row'=>$i+2,'field'=>$flag];
                if($table==='CHECKLIST_ITEMS'&&($r['Evidence_URL']??'')!==''&&!preg_match('/^https:\/\//i',$r['Evidence_URL']))$errors[]=['code'=>'UNSAFE_EVIDENCE_URL','table'=>$table,'row'=>$i+2];
                if($table==='ASSIGNMENTS'&&($r['Task_ID']??'')==='')$errors[]=['code'=>'REQUIRED_TASK_REFERENCE','table'=>$table,'row'=>$i+2];
                if($table==='TASKS'&&!in_array($r['Task_Type']??'', $unified?['PHASE','TASK','MILESTONE']:['Task','Summary','Milestone'],true))$errors[]=['code'=>'INVALID_TASK_TYPE','table'=>$table,'row'=>$i+2];
                if($table==='TASKS'&&($r['Task_Type']??'')!=='PHASE'&&!ControlTower::numberRange($r['Progress']??'',0,100))$errors[]=['code'=>'INVALID_PROGRESS','table'=>$table,'row'=>$i+2];
                if($table==='ASSIGNMENTS'&&(!ControlTower::numberRange($r['Allocation_Pct']??'',0,100)||!ControlTower::numberRange($r['Planned_Effort_Days']??'',0,PHP_FLOAT_MAX)))$errors[]=['code'=>'INVALID_ALLOCATION','table'=>$table,'row'=>$i+2];
                if($table==='USERS'&&!in_array($r['System_Role']??'', ['PMO_ADMIN','EXECUTIVE','PM','PIC'],true))$errors[]=['code'=>'INVALID_ROLE','table'=>$table,'row'=>$i+2];
                if($table==='CONFIG'&&(($r['Key']==='DATABASE_SCHEMA_VERSION'&&$r['Value']!==$version)||str_starts_with($r['Key'],'CR002_STRUCTURE_OP_')&&str_contains($r['Value'],'PREPARED')))$errors[]=['code'=>'PENDING_MAINTENANCE','table'=>$table,'row'=>$i+2];
            }
        }
        if(count($keys)<count($this->schema))return$errors;
        $templateIds=array_column($tables['PROCEDURE_TEMPLATES'],'Template_ID');foreach($tables['PHASES']as$i=>$r)if($r['Template_ID']!==''&&!in_array($r['Template_ID'],$templateIds,true))$errors[]=['code'=>'BROKEN_TEMPLATE_REFERENCE','table'=>'PHASES','row'=>$i+2];
        $refs=['PROJECTS'=>['Group_ID'=>'PROJECT_GROUPS'],'PHASES'=>['Project_ID'=>'PROJECTS'],'TASKS'=>['Project_ID'=>'PROJECTS','Parent_Task_ID'=>'TASKS','Dependency_ID'=>'TASKS','Phase_ID'=>'PHASES'],'PROJECT_MEMBERS'=>['Project_ID'=>'PROJECTS','User_ID'=>'USERS'],'ASSIGNMENTS'=>['Task_ID'=>'TASKS','User_ID'=>'USERS'],'CHECKLIST_ITEMS'=>['Project_ID'=>'PROJECTS','Task_ID'=>'TASKS','Phase_ID'=>'PHASES'],'ISSUES'=>['Project_ID'=>'PROJECTS','Task_ID'=>'TASKS'],'PROJECT_ATTRIBUTES'=>['Project_ID'=>'PROJECTS'],'AUTH_USERS'=>['User_ID'=>'USERS'],'AUTH_SESSIONS'=>['User_ID'=>'USERS']];
        foreach($refs as$table=>$fields)foreach($tables[$table]as$i=>$r)foreach($fields as$field=>$target)if(($r[$field]??'')!==''&&!isset($keys[$target][$r[$field]]))$errors[]=['code'=>'BROKEN_REFERENCE','table'=>$table,'row'=>$i+2,'field'=>$field,'target'=>$target];
        $taskMap=array_column($tables['TASKS'],null,'Task_ID');$phaseMap=array_column($tables['PHASES'],null,'Phase_ID');
        foreach(['TASKS','ISSUES','CHECKLIST_ITEMS']as$table)foreach($tables[$table]as$i=>$r)foreach(['Task_ID'=>$taskMap,'Dependency_ID'=>$taskMap,'Phase_ID'=>$phaseMap]as$field=>$map){$ref=$map[$r[$field]??'']??null;if($ref&&isset($r['Project_ID'])&&$ref['Project_ID']!==$r['Project_ID'])$errors[]=['code'=>'CROSS_PROJECT_REFERENCE','table'=>$table,'row'=>$i+2,'field'=>$field];}
        foreach(ControlTower::hierarchy($tables['TASKS'],$tables['PROJECTS'],$unified)as$e)$errors[]=['code'=>$e];
        $unique=[];foreach($tables['TASKS']as$i=>$t)if($unified){$k=Store::json([$t['Project_ID'],$t['Parent_Task_ID'],$t['Sort_Order']??'']);if(!preg_match('/^[1-9][0-9]*$/D',(string)($t['Sort_Order']??''))||isset($unique[$k]))$errors[]=['code'=>'INVALID_SORT_ORDER','table'=>'TASKS','row'=>$i+2];$unique[$k]=true;}
        $attributeKeys=[];foreach($tables['PROJECT_ATTRIBUTES']as$i=>$r){$k=Store::json([$r['Project_ID'],$r['Field_Key']]);if(isset($attributeKeys[$k]))$errors[]=['code'=>'DUPLICATE_ATTRIBUTE','table'=>'PROJECT_ATTRIBUTES','row'=>$i+2];$attributeKeys[$k]=true;}
        $tokenHashes=[];foreach($tables['AUTH_SESSIONS']as$i=>$r){$hash=$r['Token_Hash'];if(isset($tokenHashes[$hash]))$errors[]=['code'=>'DUPLICATE_SESSION_TOKEN_HASH','table'=>'AUTH_SESSIONS','row'=>$i+2];$tokenHashes[$hash]=true;}
        $names=[];foreach($tables['AUTH_USERS']as$i=>$r){$name=strtolower($r['Username']);if(!preg_match('/^[a-z0-9._-]{3,64}$/D',$name)||isset($names[$name]))$errors[]=['code'=>'INVALID_USERNAME','table'=>'AUTH_USERS','row'=>$i+2];$names[$name]=true;}
        return$errors;
    }
    public function plan(array $source): array {
        $errors=$this->validate($source);$warnings=[];$mapping=[];$target=$source;$operations=[];
        if(($source['schemaVersion']??'')==='LEGACY_V1'&&!$errors){
            $t=$source['tables'];$children=array_column($t['TASKS'],'Parent_Task_ID');
            foreach($t['PHASES']as$p){$mapping[$p['Phase_ID']]='TSK-PHASE-'.$p['Phase_ID'];if(!in_array($p['Status'],ControlTower::TASK_STATUSES,true)||!in_array($p['RAG'],ControlTower::RAGS,true))$warnings[]=['code'=>'LEGACY_PHASE_STATUS_RAG_PRESERVED','id'=>$p['Phase_ID']];if(!preg_match('/^[0-9]+$/D',$p['Phase_Order']))$warnings[]=['code'=>'UNUSUAL_PHASE_ORDER','id'=>$p['Phase_ID']];}
            foreach($t['TASKS']as$r)if($r['Task_Type']==='Summary'){$warnings[]=['code'=>'SUMMARY_NORMALIZED_TO_TASK','id'=>$r['Task_ID']];if(!in_array($r['Task_ID'],$children,true))$warnings[]=['code'=>'SUMMARY_WITHOUT_CHILDREN','id'=>$r['Task_ID']];}
            try{$target=$this->unify($source);$errors=$this->validate($target);$map=array_column($target['tables']['TASKS'],null,'Task_ID');
                foreach($target['tables']['TASKS']as$r){foreach($r as$v)if(is_string($v)&&preg_match('/^\s*[-=+@]/u',$v))$errors[]=['code'=>'UNSAFE_LEGACY_CELL','id'=>$r['Task_ID']];}
                foreach($t['TASKS']as$r)if($r['Parent_Task_ID']!==''&&$r['Phase_ID']!==''){$root=$map[$r['Parent_Task_ID']]??null;$seen=[];while($root&&$root['Parent_Task_ID']!==''&&!isset($seen[$root['Task_ID']])&&count($seen)<4){$seen[$root['Task_ID']]=true;$root=$map[$root['Parent_Task_ID']]??null;}if($root&&$root['Task_Type']==='PHASE'&&$root['Phase_ID']!==$r['Phase_ID'])$errors[]=['code'=>'CONFLICTING_PHASE_ANCESTRY','id'=>$r['Task_ID']];elseif($root&&$root['Task_Type']!=='PHASE')$warnings[]=['code'=>'PHASE_METADATA_WITHOUT_PHASE_ANCESTOR','id'=>$r['Task_ID']];}
                $old=array_column($t['TASKS'],null,'Task_ID');foreach($target['tables']['TASKS']as$r)$operations[]=['id'=>$r['Task_ID'],'before'=>$old[$r['Task_ID']]??null,'after'=>$r];
            }catch(\RuntimeException $e){$errors[]=['code'=>$e->getMessage()];}
        }
        $plan=['migration'=>'GAS_TO_MYSQL_V1','sourceFingerprint'=>self::fingerprint($source),'targetFingerprint'=>self::fingerprint($target),'phaseMapping'=>(object)$mapping,'operations'=>$operations,'errors'=>$errors,'warnings'=>$warnings,'source'=>$source,'target'=>$target];$plan['planFingerprint']=hash('sha256',self::canonical(['migration'=>$plan['migration'],'sourceFingerprint'=>$plan['sourceFingerprint'],'targetFingerprint'=>$plan['targetFingerprint'],'operations'=>$operations]));return$plan;
    }
    public function unify(array $snapshot): array {
        Store::check($snapshot['schemaVersion']==='LEGACY_V1','Migration requires LEGACY_V1 snapshot.');$tasks=$snapshot['tables']['TASKS'];$phases=$snapshot['tables']['PHASES'];$map=[];$phaseMap=array_column($phases,null,'Phase_ID');$ids=array_column($tasks,'Task_ID');
        foreach($phases as$p){$id='TSK-PHASE-'.$p['Phase_ID'];Store::check(!in_array($id,$ids,true),'PHASE_TASK_ID_COLLISION');$map[$p['Phase_ID']]=$id;}
        foreach($tasks as&$t){foreach($t as$cell)Store::check(!is_string($cell)||!preg_match('/^\s*[-=+@]/u',$cell),'UNSAFE_LEGACY_CELL');Store::check(in_array($t['Task_Type'],['Task','Summary','Milestone'],true),'UNEXPECTED_LEGACY_TYPE');$t['Task_Type']=$t['Task_Type']==='Milestone'?'MILESTONE':'TASK';if($t['Phase_ID']!==''&&$t['Parent_Task_ID']==='')$t['Parent_Task_ID']=$map[$t['Phase_ID']]??'';}unset($t);
        usort($phases,fn($a,$b)=>(float)$a['Phase_Order']<=>(float)$b['Phase_Order']);
        foreach($phases as$p){$t=array_fill_keys(array_merge($this->schema['TASKS'],['Sort_Order']),'');$tasks[]=array_merge($t,['Task_ID'=>$map[$p['Phase_ID']],'Project_ID'=>$p['Project_ID'],'Task_Name'=>$p['Phase_Name'],'Task_Type'=>'PHASE','Start_Date'=>$p['Start_Date'],'End_Date'=>$p['End_Date'],'Status'=>$p['Status'],'RAG'=>$p['RAG'],'Phase_ID'=>$p['Phase_ID']]);}
        // Source row order is authoritative, with phase roots preceding other roots.
        $order=[];$indices=array_keys($tasks);usort($indices,fn($a,$b)=>($tasks[$a]['Task_Type']==='PHASE'?0:1)<=>($tasks[$b]['Task_Type']==='PHASE'?0:1)?:$a<=>$b);
        foreach($indices as$i){$k=Store::json([$tasks[$i]['Project_ID'],$tasks[$i]['Parent_Task_ID']]);$order[$k]=($order[$k]??0)+1024;$tasks[$i]['Sort_Order']=(string)$order[$k];}
        $snapshot['tables']['TASKS']=$tasks;$snapshot['schemaVersion']='UNIFIED_TASKS_V2';$found=false;foreach($snapshot['tables']['CONFIG']as&$r)if($r['Key']==='DATABASE_SCHEMA_VERSION'){$r['Value']='UNIFIED_TASKS_V2';$found=true;}unset($r);if(!$found)$snapshot['tables']['CONFIG'][]=['Key'=>'DATABASE_SCHEMA_VERSION','Value'=>'UNIFIED_TASKS_V2','Description'=>'Offline legacy import conversion'];return$snapshot;
    }
    public function apply(Store $s,array $snapshot): array {
        $errors=$this->validate($snapshot);Store::check(!$errors,'Import validation failed.');
        return $s->transaction(function()use($s,$snapshot){
            $fingerprint=self::fingerprint($snapshot);$q=$s->db->prepare('SELECT result_json FROM import_runs WHERE fingerprint=?');$q->execute([$fingerprint]);$stored=$q->fetchColumn();if($stored){$result=json_decode($stored,true,512,JSON_THROW_ON_ERROR);$result['resumed']=true;return$result;}
            foreach(array_keys($this->schema)as$table)Store::check(!$s->rows($table),'Import requires empty target business tables: '.$table);
            $order=['CONFIG','USERS','AUTH_USERS','AUTH_SESSIONS','LOGIN_ATTEMPTS','PROJECT_GROUPS','PROJECTS','PROCEDURE_TEMPLATES','PHASES','TASKS','PROJECT_MEMBERS','ASSIGNMENTS','CHECKLIST_ITEMS','ISSUES','CALENDAR','PROJECT_ATTRIBUTES','AUDIT_LOG'];
            foreach($order as$table){$rows=$snapshot['tables'][$table];if($table==='TASKS'){$map=array_column($rows,null,'Task_ID');$written=[];$visiting=[];$ordered=[];$visit=function($id)use(&$visit,$map,&$written,&$visiting,&$ordered){if(isset($written[$id]))return;Store::check(!isset($visiting[$id]),'Cyclic parent/dependency prevents import');$visiting[$id]=true;$t=$map[$id];foreach(['Parent_Task_ID']as$k)if($t[$k]!=='')$visit($t[$k]);unset($visiting[$id]);$written[$id]=true;$ordered[]=$t;};foreach($rows as$t)$visit($t['Task_ID']);$rows=$ordered;}
                foreach($rows as$row){if($table==='TASKS')$row['Dependency_ID']='';$s->put($table,$row);}
                if($table==='TASKS'){foreach($snapshot['tables']['TASKS']as$row)$s->put('TASKS',$row);$max=(int)$s->db->query('SELECT COALESCE(MAX(_seq),0) FROM tasks')->fetchColumn();$q=$s->db->prepare('UPDATE tasks SET _seq=? WHERE Task_ID=?');foreach($snapshot['tables']['TASKS']as$i=>$row)$q->execute([$max+$i+1,$row['Task_ID']]);$s->invalidate();}
            }
            $result=['ok'=>true,'sourceFingerprint'=>$fingerprint,'counts'=>array_map('count',$snapshot['tables'])];$q=$s->db->prepare('INSERT INTO import_runs(fingerprint,result_json) VALUES(?,?)');$q->execute([$fingerprint,Store::json($result)]);return$result;
        });
    }
    public function export(Store $s): array {$tables=[];foreach(array_keys($this->schema)as$table)$tables[$table]=$s->rows($table);return['schemaVersion'=>$s->schemaVersion(),'tables'=>$tables];}
}
