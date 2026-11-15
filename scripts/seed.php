<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
try{$s=new \VCX\Parity\Store(\VCX\Core\Database::connect());$result=(new \VCX\Parity\Seeder())->seed($s);echo \VCX\Parity\Store::json($result)."\n";}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
