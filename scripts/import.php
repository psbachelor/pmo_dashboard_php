<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Parity\{Store,Importer};
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$options=getopt('',['input:','apply','unify','report:','expect:']);
try{
    Store::check(isset($options['input']),'Usage: php scripts/import.php --input=export.json|csv-directory [--unify] [--apply --expect=FINGERPRINT] [--report=path]');
    $importer=new Importer();$source=$importer->read($options['input']);$errors=$importer->validate($source);$target=$source;$warnings=[];
    if(isset($options['unify'])&&!$errors){$plan=$importer->plan($source);$target=$plan['target'];$errors=$plan['errors'];$warnings=$plan['warnings'];}
    $fingerprint=Importer::fingerprint($target);$report=['dryRun'=>!isset($options['apply']),'writes'=>0,'sourceFingerprint'=>Importer::fingerprint($source),'targetFingerprint'=>$fingerprint,'schemaVersion'=>$target['schemaVersion'],'canImport'=>!$errors,'counts'=>array_map('count',$target['tables']),'errors'=>$errors,'warnings'=>$warnings];
    if(isset($plan)){$report['planFingerprint']=$plan['planFingerprint'];$report['phaseMapping']=$plan['phaseMapping'];}
    if(isset($options['apply'])){Store::check(!$errors,'Import validation failed; run dry-run for error report.');Store::check(($options['expect']??'')===$fingerprint,'Dry-run target fingerprint required via --expect.');$s=new Store(\VCX\Core\Database::connect());$result=$importer->apply($s,$target);$report['writes']=!empty($result['resumed'])?0:array_sum($result['counts']);$report['resumed']=$result['resumed']??false;}
    $json=Store::json($report);if(isset($options['report'])){Store::check(!file_exists($options['report']),'Report path exists; choose a new path.');file_put_contents($options['report'],$json."\n");}echo$json."\n";if($errors)exit(1);
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
