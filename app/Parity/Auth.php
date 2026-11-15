<?php
declare(strict_types=1);
namespace VCX\Parity;
final class Auth {
    public function __construct(private Store $s){}
    public static function derive(string $password,string $salt,int $iterations): string {
        $pepper=getenv('AUTH_PEPPER')?:'';Store::check(strlen($pepper)>=32,'Thiếu AUTH_PEPPER (ít nhất 32 ký tự).');
        Store::check($iterations>=1&&$iterations<=1000000,'Invalid password iterations');
        return hash_pbkdf2('sha256',$password.'|'.$pepper,$salt,$iterations,64);
    }
    private function verify(array $account,string $password): bool {
        if(str_starts_with($account['Password_Hash'],'$'))return password_verify($password,$account['Password_Hash']);
        return hash_equals($account['Password_Hash'],self::derive($password,$account['Password_Salt'],(int)$account['Iterations']));
    }
    public function login(string $username,string $password): array {
        $username=strtolower(trim($username));Store::check(preg_match('/^[a-z0-9._-]{3,64}$/D',$username)&&ControlTower::length($password)>0&&ControlTower::length($password)<=256,'Tài khoản hoặc mật khẩu không hợp lệ.');
        // Commit failed attempts too. Throwing inside this transaction would undo the rate limit.
        $out=$this->s->transaction(function()use($username,$password){
            $fail=array_filter($this->s->rows('LOGIN_ATTEMPTS'),fn($r)=>$r['Username']===$username&&$r['Success']!=='TRUE'&&time()-strtotime($r['Timestamp'])<900);
            Store::check(count($fail)<5,'Tài khoản tạm khóa 15 phút do đăng nhập sai nhiều lần.');
            $account=null;foreach($this->s->rows('AUTH_USERS')as$r)if(strtolower($r['Username'])===$username&&$r['Active']==='TRUE'){$account=$r;break;}
            $u=$account?$this->s->find('USERS',$account['User_ID']):null;
            $matched=$u&&$u['Active']==='TRUE'&&$this->verify($account,$password);
            $this->s->put('LOGIN_ATTEMPTS',['Attempt_ID'=>Store::id('ATT'),'Username'=>$username,'Timestamp'=>Store::now(),'Success'=>$matched?'TRUE':'FALSE']);
            if(!$matched)return null;
            $token=bin2hex(random_bytes(32));$expiry=gmdate('Y-m-d\TH:i:s.000\Z',time()+28800);
            $this->s->put('AUTH_SESSIONS',['Session_ID'=>Store::id('SES'),'User_ID'=>$u['User_ID'],'Token_Hash'=>hash('sha256',$token),'Created_At'=>Store::now(),'Expires_At'=>$expiry,'Revoked'=>'FALSE']);
            return ['token'=>$token,'expiresAt'=>$expiry,'needsPasswordChange'=>$account['Must_Change_Password']==='TRUE','name'=>$u['Full_Name'],'role'=>$u['System_Role']];
        });Store::check($out!==null,'Tài khoản hoặc mật khẩu không hợp lệ.');return$out;
    }
    public function actor(string $token,bool $temporary=false): array {
        Store::check(preg_match('/^[a-f0-9]{64}$/D',$token),'Bạn cần đăng nhập để tiếp tục.');
        $found=null;foreach($this->s->rows('AUTH_SESSIONS')as$r)if(hash_equals($r['Token_Hash'],hash('sha256',$token))&&$r['Revoked']!=='TRUE'&&$r['Expires_At']>Store::now())$found=$r;
        Store::check($found,'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
        $u=$this->s->find('USERS',$found['User_ID']);Store::check($u&&$u['Active']==='TRUE','Tài khoản đã bị vô hiệu hóa.');
        $account=$this->s->find('AUTH_USERS',$u['User_ID']);Store::check($account&&$account['Active']==='TRUE','Tài khoản không khả dụng.');
        Store::check($temporary||$account['Must_Change_Password']!=='TRUE','Bạn phải đổi mật khẩu tạm trước khi sử dụng.');return $u;
    }
    public function logout(string $token): array {
        $this->actor($token,true);foreach($this->s->rows('AUTH_SESSIONS')as$r)if($r['Token_Hash']===hash('sha256',$token)){$r['Revoked']='TRUE';$this->s->put('AUTH_SESSIONS',$r);}return['ok'=>true];
    }
    public function revoke(string $id): void {foreach($this->s->rows('AUTH_SESSIONS')as$r)if($r['User_ID']===$id){$r['Revoked']='TRUE';$this->s->put('AUTH_SESSIONS',$r);}}
    public function changePassword(string $token,string $oldPassword,string $newPassword): array {
        $a=$this->actor($token,true);Store::check(ControlTower::length($newPassword)>=8&&ControlTower::length($newPassword)<=128,'Mật khẩu mới phải có 8–128 ký tự.');
        $old=$this->s->find('AUTH_USERS',$a['User_ID']);Store::check($this->verify($old,$oldPassword),'Sai mật khẩu hiện tại.');
        $salt=bin2hex(random_bytes(16));$old['Password_Salt']=$salt;$old['Password_Hash']=self::derive($newPassword,$salt,12000);$old['Iterations']='12000';$old['Must_Change_Password']='FALSE';$this->s->put('AUTH_USERS',$old);$this->revoke($a['User_ID']);$this->s->audit($a,'AUTH_USERS',$a['User_ID'],'CHANGE_PASSWORD',[],[]);return['ok'=>true];
    }
    public function provision(array $a,string $id,string $username,string $password): array {
        Store::check($a['System_Role']==='PMO_ADMIN','Chỉ PMO Admin tạo tài khoản.');
        Store::check(preg_match('/^[a-z0-9._-]{3,64}$/D',$username)&&ControlTower::length($password)>=8&&ControlTower::length($password)<=128,'Username hoặc mật khẩu không hợp lệ.');
        $u=$this->s->find('USERS',$id);Store::check($u&&$u['Active']==='TRUE','User ID không tồn tại/không active.');
        foreach($this->s->rows('AUTH_USERS')as$r)Store::check($r['Username']!==$username||$r['User_ID']===$id,'Username đã sử dụng.');
        $salt=bin2hex(random_bytes(16));$this->s->put('AUTH_USERS',['User_ID'=>$id,'Username'=>$username,'Password_Salt'=>$salt,'Password_Hash'=>self::derive($password,$salt,12000),'Iterations'=>'12000','Active'=>'TRUE','Must_Change_Password'=>'TRUE','Created_At'=>Store::now()]);
        $this->revoke($id);$this->s->audit($a,'AUTH_USERS',$id,'PROVISION',[],['Username'=>$username]);return['ok'=>true];
    }
}
