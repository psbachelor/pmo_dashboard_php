<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Parity\{Store,Importer};
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
try{$path=$argv[1]??'';Store::check($path&&!file_exists($path),'Supply a new backup file path outside public/.');$s=new Store(\VCX\Core\Database::connect());$data=$s->transaction(fn()=>(new Importer())->export($s),false);$old=umask(0077);$f=fopen($path,'x');Store::check($f,'Cannot create backup file.');fwrite($f,Store::json($data));fclose($f);umask($old);echo"Backup saved (contains password hashes and session records; protect this file).\n";}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
