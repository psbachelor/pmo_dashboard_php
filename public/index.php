<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ini_set('session.cookie_secure', '1');
session_start();
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
function out(array $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET' && $path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(dirname(__DIR__) . '/resources/views/index.html');
    exit;
}
if ($method === 'GET' && $path === '/api/csrf') out(['csrf' => $_SESSION['csrf']]);
if ($method === 'POST') {
    if (!hash_equals($_SESSION['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) out(['error'=>'Invalid CSRF token'], 403);
}
try {
    $db = \VCX\Core\Database::connect();
    if ($method === 'POST' && $path === '/api/login') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) out(['error'=>'Invalid JSON'], 400);
        $auth = new \VCX\Services\AuthService($db);
        if (!$auth->login((string)($body['username'] ?? ''), (string)($body['password'] ?? ''))) out(['error'=>'Invalid credentials'], 401);
        out(['ok'=>true, 'name'=>$_SESSION['name']]);
    }
    if ($method === 'POST' && $path === '/api/logout') {
        $_SESSION = [];
        session_destroy();
        out(['ok'=>true]);
    }
    $actor = \VCX\Services\AuthService::requireUser();
    $portfolio = new \VCX\Services\PortfolioService($db);
    if ($method === 'GET' && $path === '/api/me') out(['user_id'=>$actor['id'],'role'=>$actor['role'],'name'=>$_SESSION['name'] ?? '']);
    if ($method === 'GET' && $path === '/api/projects') out(['projects'=>$portfolio->projects($actor['id'],$actor['role'])]);
    if ($method === 'GET' && $path === '/api/project') {
        $id = (string)($_GET['id'] ?? '');
        $detail = $portfolio->detail($id,$actor['id'],$actor['role']);
        if (!$detail) out(['error'=>'Project not found'],404);
        out(['project'=>$detail]);
    }
    out(['error'=>'Not found'],404);
} catch (Throwable $e) {
    error_log((string)$e);
    out(['error'=>'Server error'],500);
}
