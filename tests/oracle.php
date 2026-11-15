<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Parity\{Store,Importer,ControlTower};
use VCX\Core\Database;
Store::check(str_ends_with(getenv('DB_DATABASE')?:'','_test'),'Isolated test database required');
$fixture=json_decode(gzdecode(file_get_contents(__DIR__.'/fixtures/'.(in_array('--legacy',$argv,true)?'gas-legacy-oracle.json.gz':'gas-oracle.json.gz'))),true,512,JSON_THROW_ON_ERROR);$db=Database::connect();$name='vcx_oracle_'.bin2hex(random_bytes(5)).'_test';$failed=0;$passed=0;
function difference(mixed $a,mixed $b,string $path=''): ?string {if(is_array($a)&&is_array($b)){if(array_is_list($a)!==array_is_list($b)&&count($a)&&count($b))return$path.' list/object mismatch';$ak=array_keys($a);$bk=array_keys($b);sort($ak);sort($bk);if($ak!==$bk)return$path.' keys '.json_encode([$ak,$bk]);foreach($a as$k=>$v){$diff=difference($v,$b[$k],$path.'.'.$k);if($diff)return$diff;}return null;}if($a!==$b){if(is_numeric($a)&&is_numeric($b)&&(float)$a===(float)$b)return null;return$path.' '.json_encode([$a,$b],JSON_UNESCAPED_UNICODE);}return null;}
try{
    $db->exec('CREATE DATABASE `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');$db->exec('USE `'.$name.'`');foreach(explode(';',file_get_contents(dirname(__DIR__).'/database/migrations/001_parity.sql'))as$sql)if(trim($sql))$db->exec($sql);
    putenv('AUTH_PEPPER='.$fixture['pepper']);Store::$clock=new DateTimeImmutable($fixture['clock']);$idCounters=[];Store::$idGenerator=function($prefix)use(&$idCounters){$idCounters[$prefix]=($idCounters[$prefix]??0)+1;return$prefix.'-'.strtoupper(str_pad(dechex($idCounters[$prefix]),8,'0',STR_PAD_LEFT).'-000');};$s=new Store($db);(new Importer())->apply($s,$fixture['snapshot']);$app=new ControlTower($s);
    foreach($fixture['cases']as$i=>$case){try{$out=$app->call($case['method'],$case['args'],$fixture['tokens'][$case['who']]);$out=json_decode(Store::json($out),true);$diff=difference($case['result'],$out);if($diff)throw new RuntimeException($diff);$passed++;echo'PASS oracle '.($i+1).' '.$case['who'].' '.$case['method']."\n";}catch(Throwable $e){$failed++;echo'FAIL oracle '.($i+1).' '.$case['who'].' '.$case['method'].': '.substr($e->getMessage(),0,600)."\n";}}
}finally{Store::$clock=null;Store::$idGenerator=null;$db->exec('DROP DATABASE IF EXISTS `'.$name.'`');}
echo Store::json(['passed'=>$passed,'failed'=>$failed,'baseline'=>$fixture['baseline']])."\n";exit($failed?1:0);
