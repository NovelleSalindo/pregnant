<?php
/* ============================================================
   PregnaCare — api/bootstrap.php
   Shared API bootstrap: CORS, JSON response helpers, Bearer Auth.
   ============================================================ */

// Turn off HTML display of errors/warnings to avoid corrupting JSON API payloads
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);

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

// Ensure assessments table has clinical visit resolution columns
foreach ([
    "ALTER TABLE assessments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'",
    "ALTER TABLE assessments ADD COLUMN visited_facility VARCHAR(150) NULL",
    "ALTER TABLE assessments ADD COLUMN doctor_name VARCHAR(120) NULL",
    "ALTER TABLE assessments ADD COLUMN visit_date DATETIME NULL",
    "ALTER TABLE assessments ADD COLUMN doctor_notes TEXT NULL",
] as $alterSql) {
    try { $pdo->exec($alterSql); } catch (Exception $ex) {}
}

// 3. Ensure API tokens and mobile tracker tables exist
$pdo->exec("CREATE TABLE IF NOT EXISTS api_tokens (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS trackers (
    id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    kind ENUM('kick','contraction') NOT NULL,
    at DATETIME NOT NULL,
    duration_seconds INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS medications (
    id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    name VARCHAR(120) NOT NULL,
    dosage VARCHAR(80) NULL,
    schedule_time VARCHAR(60) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS medication_logs (
    id VARCHAR(20) PRIMARY KEY,
    medication_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    taken_at DATETIME NOT NULL,
    status ENUM('taken','skipped') NOT NULL DEFAULT 'taken',
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS journal_entries (
    id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    entry_date DATE NOT NULL,
    mood VARCHAR(40) NULL,
    notes TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS bump_photos (
    id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    week_number INT NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    caption VARCHAR(255) NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS coopland_assessments (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    date DATETIME NOT NULL,
    score INT NOT NULL DEFAULT 0,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'Low',
    factors_json TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS clinical_visits (
    id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    assessment_id VARCHAR(32) NOT NULL,
    facility VARCHAR(150) NULL,
    doctor_name VARCHAR(120) NULL,
    visit_date DATETIME NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
