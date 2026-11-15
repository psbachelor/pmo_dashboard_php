<?php
declare(strict_types=1);
require dirname(__DIR__).'/app/bootstrap.php';
use VCX\Core\Database;
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
try{
    $db=Database::connect();$db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(128) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
    foreach(glob(dirname(__DIR__).'/database/migrations/*.sql')as$file){$name=basename($file);$hash=hash_file('sha256',$file);$q=$db->prepare('SELECT checksum FROM schema_migrations WHERE name=?');$q->execute([$name]);$existing=$q->fetchColumn();if($existing){if($existing!==$hash)throw new RuntimeException('Migration checksum mismatch: '.$name);echo "Already applied: $name\n";continue;}
        $old=$db->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='users'")->fetchColumn();if($old)throw new RuntimeException('Existing foundation/partial schema: export/backup, initialize a NEW database and import. No tables modified.');
        // MySQL DDL commits implicitly. On DDL failure retain DB for diagnosis; never mark as applied.
        $sql=file_get_contents($file);foreach(explode(';',$sql)as$statement)if(trim($statement)!=='')$db->exec($statement);
        $q=$db->prepare('INSERT INTO schema_migrations(name,checksum) VALUES(?,?)');$q->execute([$name,$hash]);echo "Applied: $name\n";
    }
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
