<?php
declare(strict_types=1);
namespace VCX\Parity;
final class Seeder {
    public function seed(Store $s): array {
        return$s->transaction(function()use($s){
            Store::check(!$s->find('CONFIG','CR002_DEMO_SEED'),'Demo seed has already been attempted.');
            foreach(['PROJECTS','PHASES','TASKS','PROJECT_MEMBERS','ASSIGNMENTS','CHECKLIST_ITEMS','ISSUES','PROJECT_ATTRIBUTES']as$t)Store::check(!$s->rows($t),'Refusing seed: '.$t.' already contains data.');
            $fixture=(new Importer())->read(dirname(__DIR__,2).'/database/seed.json');$users=$s->rows('USERS');
            if(!$users){
                foreach(['CONFIG','PROJECT_GROUPS','USERS','CALENDAR','PROCEDURE_TEMPLATES']as$t){Store::check(!$s->rows($t),'Initial seed requires empty '.$t);foreach($fixture['tables'][$t]as$r)$s->put($t,$r);}$users=$s->rows('USERS');
            }else{
                Store::check($s->unified(),'Seed requires UNIFIED_TASKS_V2.');$active=ControlTower::filter($users,fn($u)=>$u['Active']==='TRUE');$admins=ControlTower::filter($active,fn($u)=>$u['System_Role']==='PMO_ADMIN');Store::check($admins,'No active PMO_ADMIN in USERS.');$planners=ControlTower::filter($active,fn($u)=>$u['System_Role']==='PM');$pool=ControlTower::filter($active,fn($u)=>in_array($u['System_Role'],['PM','PIC'],true));if(!$pool)$pool=$active;if(!$planners)$planners=$admins;
                $pmByProject=[];$picByProject=[];$fixture['tables']['PROJECT_MEMBERS']=[];
                foreach($fixture['tables']['PROJECTS']as$i=>&$p){$p['PM_ID']=$planners[$i%count($planners)]['User_ID'];$p['Group_ID']='';$id=$p['Project_ID'];$pmByProject[$id]=$p['PM_ID'];$picByProject[$id]=$pool[$i%count($pool)]['User_ID'];$ids=array_unique([$p['PM_ID'],$picByProject[$id],$pool[($i+1)%count($pool)]['User_ID']]);foreach($ids as$j=>$uid)$fixture['tables']['PROJECT_MEMBERS'][]=['Member_ID'=>'DEMO-MEM-'.$i.'-'.$j,'Project_ID'=>$id,'User_ID'=>$uid,'Project_Role'=>$uid===$p['PM_ID']?'PM':'Member'];}unset($p);
                foreach($fixture['tables']['TASKS']as&$t)if($t['PIC_ID'])$t['PIC_ID']=$picByProject[$t['Project_ID']];unset($t);
                $tasks=array_column($fixture['tables']['TASKS'],null,'Task_ID');foreach($fixture['tables']['ASSIGNMENTS']as&$r)$r['User_ID']=$picByProject[$tasks[$r['Task_ID']]['Project_ID']];unset($r);
                foreach($fixture['tables']['CHECKLIST_ITEMS']as&$r)$r['Owner_ID']=$picByProject[$r['Project_ID']];unset($r);
                foreach($fixture['tables']['ISSUES']as&$r){$r['Owner_ID']=$pmByProject[$r['Project_ID']];$r['Created_By']=$admins[0]['User_ID'];}unset($r);
            }
            foreach(['PROJECTS','TASKS','PROJECT_MEMBERS','ASSIGNMENTS','CHECKLIST_ITEMS','ISSUES']as$t)foreach($fixture['tables'][$t]as$r)$s->put($t,$r);
            $s->config('CR002_DEMO_SEED','COMPLETED');$result=['status'=>'COMPLETED','projects'=>10,'tasks'=>210,'phases'=>30,'milestones'=>30,'assignments'=>30,'checklist'=>30,'issues'=>10,'people'=>count($users)];return$result;
        });
    }
}
