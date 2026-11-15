<?php
declare(strict_types=1);
namespace VCX\Services;
use PDO;
final class PortfolioService {
    public function __construct(private PDO $db) {}
    public function projects(string $userId, string $role): array {
        if (in_array($role, ['PMO_ADMIN', 'EXECUTIVE'], true)) {
            return $this->db->query('SELECT * FROM projects ORDER BY Project_Name')->fetchAll();
        }
        $sql = 'SELECT DISTINCT p.* FROM projects p LEFT JOIN project_members m ON m.Project_ID=p.Project_ID AND m.User_ID=:member WHERE p.PM_ID=:pm OR m.User_ID IS NOT NULL ORDER BY p.Project_Name';
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['member' => $userId, 'pm' => $userId]);
        return $stmt->fetchAll();
    }
    public function detail(string $projectId, string $userId, string $role): ?array {
        $allowed = array_filter($this->projects($userId, $role), fn($p) => $p['Project_ID'] === $projectId);
        if (!$allowed) return null;
        $project = array_values($allowed)[0];
        $stmt = $this->db->prepare('SELECT * FROM tasks WHERE Project_ID=? ORDER BY Start_Date, Task_ID');
        $stmt->execute([$projectId]);
        $project['tasks'] = $stmt->fetchAll();
        return $project;
    }
}
