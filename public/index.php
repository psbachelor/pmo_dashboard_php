<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
ini_set('session.use_strict_mode','1');ini_set('session.cookie_httponly','1');ini_set('session.cookie_samesite','Strict');ini_set('session.gc_maxlifetime','28800');
$https=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';ini_set('session.cookie_secure',$https?'1':'0');session_name('vcx_pmo');session_start();
header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');header('Referrer-Policy: same-origin');header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
$_SESSION['csrf']??=bin2hex(random_bytes(32));
function respond(mixed $data,int $code=200): never {http_response_code($code);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
if(!isset($_GET['rpc'])){
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')respond(['error'=>'Method not allowed'],405);
    header('Content-Type: text/html; charset=utf-8');echo str_replace('__CSRF__',htmlspecialchars($_SESSION['csrf'],ENT_QUOTES,'UTF-8'),file_get_contents(dirname(__DIR__).'/resources/views/index.html'));exit;
}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')respond(['error'=>'Method not allowed'],405);
if(!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))respond(['error'=>'Invalid CSRF token'],403);
if((int)($_SERVER['CONTENT_LENGTH']??0)>1000000)respond(['error'=>'Request too large'],413);
try{
    $body=json_decode(file_get_contents('php://input'),true,64,JSON_THROW_ON_ERROR);
    if(!is_array($body)||!is_string($body['method']??null)||!is_array($body['args']??null)||!array_is_list($body['args'])||count($body['args'])>10)respond(['error'=>'Invalid request'],400);
    $app=new \VCX\Parity\ControlTower(new \VCX\Parity\Store(\VCX\Core\Database::connect()));$method=$body['method'];
    $token=(string)($_SERVER['HTTP_X_PMO_TOKEN']??'');
    if($method!=='login'&&($token===''||!isset($_SESSION['tokens'][hash('sha256',$token)])))respond(['error'=>'Bạn cần đăng nhập để tiếp tục.'],422);
    $result=$app->call($method,$body['args'],$token);
    // Preserve GAS sessionStorage isolation: every tab presents its own issued token.
    // The HttpOnly PHP session binds those tokens to this browser, never to a client-supplied role.
    if($method==='login'){session_regenerate_id(true);$_SESSION['tokens'][hash('sha256',$result['token'])]=true;}
    if(in_array($method,['logout','changePassword'],true)){unset($_SESSION['tokens'][hash('sha256',$token)]);session_regenerate_id(true);}
    respond(['result'=>$result]);
}catch(JsonException|TypeError|ArgumentCountError $e){respond(['error'=>'Invalid request'],400);}
catch(PDOException $e){error_log('PMO database operation failed: '.$e->getCode());respond(['error'=>'Database operation failed.'],500);}
catch(RuntimeException $e){respond(['error'=>$e->getMessage()],422);}
catch(Throwable $e){error_log('PMO internal error: '.get_class($e));respond(['error'=>'Server error'],500);}
