<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Parity\{Store,Auth};
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
try{
    $s=new Store(\VCX\Core\Database::connect());$s->transaction(function()use($s){
        Store::check(!$s->rows('AUTH_USERS'),'Bootstrap already done; use account management.');
        $username=getenv('BOOTSTRAP_ADMIN_USERNAME')?:'';$password=getenv('BOOTSTRAP_ADMIN_PASSWORD')?:'';$configuredId=getenv('BOOTSTRAP_ADMIN_USER_ID');$id=$configuredId!==false&&$configuredId!==''?$configuredId:'ADMIN';
        Store::check(preg_match('/^[a-z0-9._-]{3,64}$/D',$username)&&\VCX\Parity\ControlTower::length($password)>=8&&\VCX\Parity\ControlTower::length($password)<=128,'Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD (8–128 chars) in environment.');
        $user=$s->find('USERS',$id);if(!$user){$user=['User_ID'=>$id,'Email'=>getenv('BOOTSTRAP_ADMIN_EMAIL')?:'admin@example.invalid','Full_Name'=>'PMO Administrator','Department'=>'PMO','System_Role'=>'PMO_ADMIN','Weekly_Capacity_Days'=>'5','Active'=>'TRUE'];$s->put('USERS',$user);}Store::check($user['System_Role']==='PMO_ADMIN'&&$user['Active']==='TRUE','Bootstrap user must be active PMO_ADMIN.');
        (new Auth($s))->provision($user,$id,$username,$password);
        if(!$s->find('CONFIG','DATABASE_SCHEMA_VERSION'))$s->config('DATABASE_SCHEMA_VERSION','UNIFIED_TASKS_V2');
    });echo "Admin created. Change temporary password on first login. Remove bootstrap password from environment.\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
