<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
if ($argc !== 5) { fwrite(STDERR, "Usage: php scripts/create_admin.php USER_ID USERNAME FULL_NAME EMAIL\nPassword is read from VCX_ADMIN_PASSWORD env.\n"); exit(1); }
$password = getenv('VCX_ADMIN_PASSWORD');
if (!$password || strlen($password) < 12) { fwrite(STDERR, "VCX_ADMIN_PASSWORD must be at least 12 characters.\n"); exit(1); }
$db = \VCX\Core\Database::connect();
$db->beginTransaction();
try {
    $stmt = $db->prepare("INSERT INTO users (User_ID,Email,Full_Name,System_Role,Active) VALUES (?,?,?,'PMO_ADMIN',1)");
    $stmt->execute([$argv[1], $argv[4], $argv[3]]);
    $stmt = $db->prepare('INSERT INTO auth_users(User_ID,Username,Password_Hash,Active) VALUES (?,?,?,1)');
    $stmt->execute([$argv[1], $argv[2], password_hash($password, PASSWORD_DEFAULT)]);
    $db->commit();
    echo "Admin created.\n";
} catch (Throwable $e) { $db->rollBack(); fwrite(STDERR, "Failed to create admin.\n"); exit(1); }
