<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Parity\{Store,Importer};
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
try{
    $options=getopt('',['input:','output:']);Store::check(isset($options['input'],$options['output'])&&!file_exists($options['output']),'Usage: php scripts/clean_pilot.php --input=export.json --output=new-private-copy.json');$i=new Importer();$x=$i->read($options['input']);Store::check(!$i->validate($x),'Source snapshot must pass validation before copying.');
    $keep=['USERS','AUTH_USERS','CALENDAR','PROCEDURE_TEMPLATES'];foreach(array_keys($x['tables'])as$t)if(!in_array($t,$keep,true)&&$t!=='CONFIG')$x['tables'][$t]=[];
    $x['tables']['CONFIG']=array_values(array_filter($x['tables']['CONFIG'],fn($r)=>!in_array($r['Key'],['DATABASE_SCHEMA_VERSION','CR002_MIGRATION_TARGET'],true)&&!str_starts_with($r['Key'],'CR002_MIGRATION_')&&!str_starts_with($r['Key'],'CR002_IMPORT_')&&!str_starts_with($r['Key'],'CR002_STRUCTURE_')));$x['tables']['CONFIG'][]=['Key'=>'DATABASE_SCHEMA_VERSION','Value'=>'UNIFIED_TASKS_V2','Description'=>'Fresh clean pilot; offline copy'];$x['schemaVersion']='UNIFIED_TASKS_V2';
    $users=array_column($x['tables']['USERS'],null,'User_ID');$activeAdmin=false;foreach($x['tables']['AUTH_USERS']as$a)if($a['Active']==='TRUE'&&isset($users[$a['User_ID']])&&$users[$a['User_ID']]['Active']==='TRUE'&&$users[$a['User_ID']]['System_Role']==='PMO_ADMIN')$activeAdmin=true;Store::check($activeAdmin,'Clean pilot requires an active admin account.');$mask=umask(0077);$f=fopen($options['output'],'x');Store::check($f,'Cannot create private copy');fwrite($f,Store::json($x));fclose($f);umask($mask);echo"Clean pilot snapshot created; source unchanged. Import into a new database.\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
