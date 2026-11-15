<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Core\Database;
use VCX\Parity\Store;
Store::check(str_ends_with(getenv('DB_DATABASE')?:'','_test'),'Isolated test database required');
final class InterceptTaskStatement extends PDOStatement {
    protected function __construct(private Closure $before){}
    public function execute(?array $params=null): bool {($this->before)($this->queryString);return parent::execute($params);}
}
$a=Database::connect();$b=Database::connect();$b->exec('SET SESSION innodb_lock_wait_timeout=1');$passed=0;
try{
    $a->beginTransaction();$a->query('SELECT id FROM pmo_lock WHERE id=1 FOR UPDATE')->fetch();$b->beginTransaction();$blocked=false;try{$b->query('SELECT id FROM pmo_lock WHERE id=1 FOR UPDATE')->fetch();}catch(PDOException $e){$blocked=(int)$e->errorInfo[1]===1205;}Store::check($blocked,'Concurrent writer was not fenced');$passed++;$b->rollBack();$a->rollBack();
    $b->beginTransaction();$b->query('SELECT id FROM pmo_lock WHERE id=1 FOR UPDATE')->fetch();$b->rollBack();$passed++;
    $a->beginTransaction();$before=$a->query("SELECT Project_Name FROM projects WHERE Project_ID='DEMO-PRJ-01'")->fetchColumn();$b->beginTransaction();$q=$b->prepare("UPDATE projects SET Project_Name=? WHERE Project_ID='DEMO-PRJ-01'");$q->execute(['Synthetic concurrent name']);$b->commit();$snapshot=$a->query("SELECT Project_Name FROM projects WHERE Project_ID='DEMO-PRJ-01'")->fetchColumn();Store::check($snapshot===$before,'Read snapshot changed mid-request');$a->rollBack();$q->execute([$before]);$passed++;
    $store=new Store($a);$app=new \VCX\Parity\ControlTower($store);$actor=$store->find('USERS','PM');$task='DEMO-TSK-01-1-4';$project='DEMO-PRJ-01';$original=$store->find('TASKS',$task);$hooked=false;$b->exec('SET SESSION innodb_lock_wait_timeout=3');
    $hook=function($sql)use(&$hooked,$b,$task){if(!$hooked&&(str_starts_with($sql,'UPDATE tasks SET Parent_Task_ID=')||str_starts_with($sql,'INSERT INTO `tasks`'))){$hooked=true;$q=$b->prepare('UPDATE tasks SET Member_Update=? WHERE Task_ID=?');$q->execute(['Synthetic concurrent external note',$task]);}};
    $a->setAttribute(PDO::ATTR_STATEMENT_CLASS,[InterceptTaskStatement::class,[$hook]]);
    try{$detail=$app->detail($actor,$project);$result=$store->transaction(fn()=>(new \VCX\Parity\Structure($app))->change($actor,$project,['opId'=>'race-operation-aaaaaaaaaaaaaaaa','action'=>'indent','taskIds'=>[$task],'baseVersion'=>$detail['structureVersion']]));Store::check($hooked,'Concurrent edit hook did not execute');Store::check(!$result['ok'],'Concurrent business edit must trigger integrity conflict');$store->invalidate();$actual=$store->find('TASKS',$task);Store::check($actual['Member_Update']==='Synthetic concurrent external note','Structural writer overwrote another connection business fields');Store::check($actual['Parent_Task_ID']===$original['Parent_Task_ID'],'Failed structural operation was not rolled back');$passed++;}
    finally{if($a->inTransaction())$a->rollBack();$a->setAttribute(PDO::ATTR_STATEMENT_CLASS,[PDOStatement::class]);$q=$b->prepare('UPDATE tasks SET Member_Update=? WHERE Task_ID=?');$q->execute([$original['Member_Update'],$task]);}
    echo Store::json(['passed'=>$passed,'failed'=>0,'checks'=>['concurrent writer fence','retry after lock release','consistent read snapshot','concurrent business edit preserved and structure rolled back']])."\n";
}finally{if($a->inTransaction())$a->rollBack();if($b->inTransaction())$b->rollBack();}
