<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
try{$s=new \VCX\Parity\Store(\VCX\Core\Database::connect());foreach($s->schema as$table=>$cols){$actual=$s->db->query('SHOW COLUMNS FROM `'.strtolower($table).'`')->fetchAll(PDO::FETCH_COLUMN);$expected=array_merge(['_seq'],$cols,$table==='TASKS'?['Sort_Order']:[]);\VCX\Parity\Store::check($actual===$expected,'Schema mismatch '.$table);}$i=new \VCX\Parity\Importer();$errors=$i->validate($s->transaction(fn()=>$i->export($s),false));echo \VCX\Parity\Store::json(['ok'=>!$errors,'errors'=>$errors])."\n";exit($errors?1:0);}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
