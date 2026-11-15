<?php
declare(strict_types=1);
namespace VCX\Services;
use PDO;
final class AuthService {
    public function __construct(private PDO $db) {}
    public function login(string $username, string $password): bool {
        $stmt = $this->db->prepare('SELECT a.User_ID,a.Password_Hash,a.Active,u.System_Role,u.Full_Name FROM auth_users a JOIN users u ON u.User_ID=a.User_ID WHERE a.Username=? LIMIT 1');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row || (int)$row['Active'] !== 1 || !password_verify($password, $row['Password_Hash'])) return false;
        session_regenerate_id(true);
        $_SESSION['user_id'] = $row['User_ID'];
        $_SESSION['role'] = $row['System_Role'];
        $_SESSION['name'] = $row['Full_Name'];
        return true;
    }
    public static function requireUser(): array {
        if (empty($_SESSION['user_id'])) {
            http_response_code(401);
            exit('Unauthorized');
        }
        return ['id' => (string)$_SESSION['user_id'], 'role' => (string)($_SESSION['role'] ?? '')];
    }
}
