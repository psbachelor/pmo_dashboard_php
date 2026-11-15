<?php
declare(strict_types=1);
namespace VCX\Parity;
final class Metrics {
    private static ?array $context=null;
    public static function run(string $operation,callable $fn): mixed {
        if(self::$context!==null||getenv('PERF_TRACE_ENABLED')!=='TRUE')return$fn();self::$context=['timings'=>[],'reads'=>[],'writes'=>[]];$start=microtime(true);$ok=false;
        try{$out=$fn();$ok=true;return$out;}finally{$trace=self::$context;self::$context=null;error_log(Store::json(['type'=>'pmo_performance','operation'=>$operation,'ok'=>$ok,'totalMs'=>round((microtime(true)-$start)*1000,3)]+$trace));}
    }
    public static function timed(string $stage,callable $fn): mixed {
        if(self::$context===null)return$fn();$start=microtime(true);try{return$fn();}finally{self::$context['timings'][$stage]??=['count'=>0,'ms'=>0];self::$context['timings'][$stage]['count']++;self::$context['timings'][$stage]['ms']+=round((microtime(true)-$start)*1000,3);}
    }
    public static function count(string $kind,string $table): void {if(self::$context!==null)self::$context[$kind][$table]=(self::$context[$kind][$table]??0)+1;}
}
