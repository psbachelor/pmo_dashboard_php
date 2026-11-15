<?php
declare(strict_types=1);
namespace VCX\Parity;
use PDO;
use RuntimeException;
final class Store {
    public array $schema;
    public static ?\DateTimeImmutable $clock=null;
    public static ?\Closure $idGenerator=null;
    private array $cache=[];
    public array $scopes=[];
    public function __construct(public PDO $db) { $this->schema=json_decode(file_get_contents(__DIR__.'/schema.json'),true,512,JSON_THROW_ON_ERROR); }
    public function columns(string $table): array { $this->valid($table); return array_merge($this->schema[$table], $table==='TASKS'&&$this->unified()?['Sort_Order']:[]); }
    private function valid(string $table): void { if(!isset($this->schema[$table])) throw new RuntimeException('Invalid table'); }
    public function rows(string $table,bool $raw=false): array {
        $this->valid($table);
        if(!isset($this->cache[$table])){
            $rows=Metrics::timed('database_read',fn()=>$this->db->query('SELECT * FROM `'.strtolower($table).'` ORDER BY `_seq`')->fetchAll());Metrics::count('reads',$table);
            $this->cache[$table]=array_map(function($r)use($table){unset($r['_seq']);foreach($r as $k=>$v)$r[$k]=(string)($v??'');if($table==='TASKS'&&!$this->unified())unset($r['Sort_Order']);return $r;},$rows);
        }
        $rows=$this->cache[$table];if($table==='TASKS'&&!$raw){$j=$this->activeStructure();if($j&&$j['status']==='PREPARED'){$patches=array_column($j['changes'],null,0);$rows=array_map(function($t)use($patches){if(isset($patches[$t['Task_ID']])){$p=$patches[$t['Task_ID']];$t['Parent_Task_ID']=$p[1];$t['Sort_Order']=$p[2];}return$t;},$rows);}}return $rows;
    }
    public function find(string $table,string $id): ?array { $key=$this->schema[$table][0];foreach($this->rows($table)as$r)if($r[$key]===$id)return$r;return null; }
    public function put(string $table,array $row): array {
        $keys=$this->columns($table);$data=[];foreach($keys as$k)$data[$k]=(string)($row[$k]??'');
        // Optional relations are NULL in SQL and empty strings in the GAS wire contract.
        $optional=['PROJECT_MEMBERS'=>['Project_ID','User_ID'],'TASKS'=>['Parent_Task_ID','Dependency_ID','Phase_ID'],'PHASES'=>[],'ASSIGNMENTS'=>['Task_ID','User_ID'],'CHECKLIST_ITEMS'=>['Task_ID','Phase_ID'],'ISSUES'=>['Task_ID']];
        foreach($optional[$table]??[]as$k)if($data[$k]==='')$data[$k]=null;
        $names=implode(',',array_map(fn($k)=>'`'.$k.'`',$keys));
        $update=implode(',',array_map(fn($k)=>'`'.$k.'`=VALUES(`'.$k.'`)',$keys));
        $q=$this->db->prepare('INSERT INTO `'.strtolower($table).'` ('.$names.') VALUES ('.implode(',',array_fill(0,count($keys),'?')).') ON DUPLICATE KEY UPDATE '.$update);
        Metrics::timed('database_write',fn()=>$q->execute(array_values($data)));Metrics::count('writes',$table);unset($this->cache[$table]);$this->scopes=[];return $row;
    }
    public function delete(string $table,string $id): void { $this->valid($table);$q=$this->db->prepare('DELETE FROM `'.strtolower($table).'` WHERE `'.$this->schema[$table][0].'`=?');Metrics::timed('database_write',fn()=>$q->execute([$id]));Metrics::count('writes',$table);unset($this->cache[$table]);$this->scopes=[]; }
    public function invalidate(): void { $this->cache=[];$this->scopes=[]; }
    public function schemaVersion(): string {$version='LEGACY_V1';foreach($this->rows('CONFIG')as$r)if($r['Key']==='DATABASE_SCHEMA_VERSION')$version=$r['Value'];if($version==='MIGRATING'&&$this->activeStructure())$version='UNIFIED_TASKS_V2';self::check(in_array($version,['LEGACY_V1','UNIFIED_TASKS_V2'],true),'SCHEMA_INCOMPATIBLE: database='.$version);return$version;}
    public function activeStructure(): ?array {
        $records=[];$pointer=null;$pending=[];foreach($this->rows('CONFIG')as$r){if(str_starts_with($r['Key'],'CR002_STRUCTURE_OP_')){$j=json_decode($r['Value'],true,512,JSON_THROW_ON_ERROR);$j['key']=$r['Key'];$records[$r['Key']]=$j;if($j['status']==='PREPARED')$pending[]=$j;}if($r['Key']==='CR002_STRUCTURE_ACTIVE'&&$r['Value'])$pointer=json_decode($r['Value'],true,512,JSON_THROW_ON_ERROR)['key'];}
        self::check(count($pending)<=1,'STRUCTURE_RECOVERY_REQUIRED: multiple pending journals.');if($pointer){self::check(isset($records[$pointer]),'STRUCTURE_RECOVERY_REQUIRED: missing journal.');return$records[$pointer];}return$pending[0]??null;
    }
    public function unified(): bool { return $this->schemaVersion()==='UNIFIED_TASKS_V2'; }
    public function config(string $key,string $value): void {$this->put('CONFIG',['Key'=>$key,'Value'=>$value,'Description'=>'PHP maintenance journal']);}
    public function transaction(callable $fn,bool $write=true): mixed {
        if($this->db->inTransaction())return $fn();
        $this->db->beginTransaction();
        try{if($write)$this->db->query('SELECT id FROM pmo_lock WHERE id=1 FOR UPDATE')->fetch();$this->invalidate();$out=$fn();$this->db->commit();return $out;}
        catch(\Throwable $e){if($this->db->inTransaction())$this->db->rollBack();$this->invalidate();throw $e;}
    }
    public function audit(array $actor,string $table,string $id,string $action,?array $before,array $after): void {
        $this->put('AUDIT_LOG',['Audit_ID'=>self::id('AUD'),'Timestamp'=>self::now(),'Actor_Email'=>$actor['Email'],'Entity'=>$table,'Entity_ID'=>$id,'Action'=>$action,'Before_JSON'=>self::json($before?:new \stdClass()),'After_JSON'=>self::json($after?:new \stdClass())]);
    }
    public static function now(): string {return (self::$clock??new \DateTimeImmutable('now',new \DateTimeZone('UTC')))->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');}
    public static function today(): string {return (self::$clock??new \DateTimeImmutable('now'))->setTimezone(new \DateTimeZone('Asia/Ho_Chi_Minh'))->format('Y-m-d');}
    public static function id(string $prefix): string {return self::$idGenerator?(self::$idGenerator)($prefix):$prefix.'-'.strtoupper(bin2hex(random_bytes(4)).'-'.substr(bin2hex(random_bytes(2)),0,3));}
    public static function json(mixed $x): string{return json_encode($x,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
    public static function check(mixed $condition,string $message): void {if(!$condition&&$condition!=='0')throw new RuntimeException($message);}
}
