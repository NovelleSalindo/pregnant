<?php
/* ============================================================
   PregnaCare — api/bootstrap.php
   Shared API bootstrap: CORS, JSON response helpers, Bearer Auth.
   ============================================================ */

// 1. CORS Headers for React Native / Web Clients
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Load base.php for Database connection ($pdo) and risk engine
require_once __DIR__ . '/../base.php';

// 3. Ensure API tokens table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS api_tokens (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

// 4. JSON Helper Functions
function json_response($data, int $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function json_error(string $message, int $statusCode = 400, $details = null) {
    $payload = ['success' => false, 'error' => $message];
    if ($details !== null) {
        $payload['details'] = $details;
    }
    json_response($payload, $statusCode);
}

function json_success($data = [], string $message = 'Success', int $statusCode = 200) {
    $payload = array_merge(['success' => true, 'message' => $message], $data);
    json_response($payload, $statusCode);
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }
    }
    return $_POST ?: [];
}

// 5. Authentication Helpers for Mobile API
function get_bearer_token(): ?string {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER['Authorization']);
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        }
    }

    if (!empty($headers) && preg_match('/Bearer\s(\S+)/i', $headers, $matches)) {
        return $matches[1];
    }
    return $_GET['token'] ?? null;
}

function authenticate_api_user(): ?array {
    global $pdo;
    $token = get_bearer_token();
    if (!$token) {
        // Fallback to PHP session if testing in browser
        if (!empty($_SESSION['user_id'])) {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            return $stmt->fetch() ?: null;
        }
        return null;
    }

    $stmt = $pdo->prepare("SELECT u.* FROM api_tokens t JOIN users u ON t.user_id = u.id WHERE t.token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    return $user ?: null;
}

function require_api_user(?string $requiredRole = null): array {
    $user = authenticate_api_user();
    if (!$user) {
        json_error('Unauthorized: Invalid or missing Bearer token.', 401);
    }
    if ($requiredRole && $user['role'] !== $requiredRole) {
        json_error("Forbidden: Access restricted to {$requiredRole}s.", 403);
    }
    return $user;
}

function generate_api_token(string $userId): string {
    global $pdo;
    $token = bin2hex(random_bytes(32)); // 64 character hex string
    $stmt = $pdo->prepare("INSERT INTO api_tokens (token, user_id, created_at) VALUES (?, ?, ?)");
    $stmt->execute([$token, $userId, now_iso()]);
    return $token;
}
