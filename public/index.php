<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

http_response_code(503);
echo json_encode([
    'status' => 'not_ready',
    'message' => 'VCX PMO PHP migration is under development.',
], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
