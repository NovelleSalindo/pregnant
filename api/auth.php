<?php
/* ============================================================
   PregnaCare — api/auth.php
   Endpoints:
     POST ?action=login     -> { email, password }
     POST ?action=register  -> { name, email, password, lmp, edd, age, ... }
     GET  ?action=me        -> returns profile of authenticated user
     POST ?action=logout    -> revokes current token
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? '';
$input = get_json_input();

if (empty($action) && isset($input['action'])) {
    $action = $input['action'];
}

// Default action based on method if not explicitly given
if (empty($action)) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = 'login';
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = 'me';
    }
}

// Helper to fetch complete user profile
function fetch_user_payload($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT id, role, username, first_name, middle_name, last_name, name, email, created_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) return null;

    $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $profile = $stmt->fetch() ?: [];

    return [
        'user' => $user,
        'profile' => $profile
    ];
}

switch ($action) {
    case 'login':
        $loginInput = trim($input['email'] ?? $input['username'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($loginInput) || empty($password)) {
            json_error('Email or username, and password are required.', 422);
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR username = ?");
        $stmt->execute([$loginInput, $loginInput]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_error('Invalid email or password.', 401);
        }

        $token = generate_api_token($user['id']);
        log_action("api_login: {$user['email']}");

        $userData = fetch_user_payload($pdo, $user['id']);
        json_success([
            'token' => $token,
            'user' => $userData['user'],
            'profile' => $userData['profile']
        ], 'Login successful');
        break;

    case 'register':
        $username = trim($input['username'] ?? '');
        $firstName = trim($input['first_name'] ?? $input['firstname'] ?? '');
        $middleName = trim($input['middle_name'] ?? $input['middlename'] ?? '');
        $lastName = trim($input['last_name'] ?? $input['lastname'] ?? '');

        $name = trim($input['name'] ?? '');
        if (empty($name)) {
            $name = trim($firstName . ($middleName !== '' ? ' ' . $middleName : '') . ' ' . $lastName);
        }

        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if ((empty($username) || empty($firstName) || empty($lastName)) && empty($name)) {
            json_error('Username, first name, last name, email, and password are required.', 422);
        }
        if (empty($email) || empty($password)) {
            json_error('Email and password are required.', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_error('Please enter a valid email address.', 422);
        }
        if (strlen($password) < 6) {
            json_error('Password must be at least 6 characters.', 422);
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR (username IS NOT NULL AND username != '' AND username = ?)");
        $stmt->execute([$email, $username]);
        if ($stmt->fetch()) {
            json_error('An account with this email or username already exists.', 409);
        }

        $userId = uid('usr');
        $hash = password_hash($password, PASSWORD_DEFAULT);

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("INSERT INTO users (id, role, username, first_name, middle_name, last_name, name, email, password_hash, created_at) VALUES (?, 'patient', ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $username ?: null, $firstName ?: null, $middleName ?: null, $lastName ?: null, $name, $email, $hash, now_iso()]);

            // Optional profile fields matching register.php (Weight & Height removed from register)
            $dob = !empty($input['dob']) ? $input['dob'] : null;
            $age = !empty($input['age']) ? (int)$input['age'] : ($dob ? (int)((strtotime('now') - strtotime($dob)) / (365.25*86400)) : null);
            $lmp = !empty($input['lmp']) ? $input['lmp'] : null;
            $edd = !empty($input['edd']) ? $input['edd'] : ($lmp ? date('Y-m-d', strtotime($lmp . ' + 280 days')) : null);
            $phone = $input['phone'] ?? null;
            $height = !empty($input['height_cm']) ? (float)$input['height_cm'] : (!empty($input['height']) ? (float)$input['height'] : null);
            $weight = !empty($input['weight_kg']) ? (float)$input['weight_kg'] : (!empty($input['weight']) ? (float)$input['weight'] : null);

            $stmt = $pdo->prepare("INSERT INTO patient_profiles (user_id, dob, lmp, edd, age, phone, height_cm, weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$userId, $dob, $lmp, $edd, $age, $phone, $height, $weight]);

            // Seed default hospital bag items
            seed_default_hospital_bag($pdo, $userId);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            json_error('Failed to create account: ' . $e->getMessage(), 500);
        }

        $token = generate_api_token($userId);
        log_action("api_register: {$email}");

        $userData = fetch_user_payload($pdo, $userId);
        json_success([
            'token' => $token,
            'user' => $userData['user'],
            'profile' => $userData['profile']
        ], 'Registration successful', 201);
        break;

    case 'me':
        $user = require_api_user();
        $userData = fetch_user_payload($pdo, $user['id']);
        json_success([
            'user' => $userData['user'],
            'profile' => $userData['profile']
        ]);
        break;

    case 'update_profile':
        $user = require_api_user('patient');
        $allowed = [
            'dob', 'age', 'height_cm', 'weight_kg', 'pre_pregnancy_weight_kg',
            'blood_type', 'occupation', 'lmp', 'edd', 'gravida',
            'prior_miscarriage', 'prior_csection', 'conditions',
            'phone', 'address', 'emergency_name', 'emergency_relation', 'emergency_phone',
            'next_ob_visit'
        ];

        $sets = [];
        $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $input)) {
                $sets[] = "$f = ?";
                $params[] = $input[$f] === '' ? null : $input[$f];
            }
        }

        if (!empty($sets)) {
            $params[] = $user['id'];
            $sql = "UPDATE patient_profiles SET " . implode(', ', $sets) . " WHERE user_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        // Also update name if provided
        if (!empty($input['name'])) {
            $stmt = $pdo->prepare("UPDATE users SET name = ? WHERE id = ?");
            $stmt->execute([trim($input['name']), $user['id']]);
        }

        $userData = fetch_user_payload($pdo, $user['id']);
        json_success([
            'user' => $userData['user'],
            'profile' => $userData['profile']
        ], 'Profile updated successfully');
        break;

    case 'logout':
        $token = get_bearer_token();
        if ($token) {
            $stmt = $pdo->prepare("DELETE FROM api_tokens WHERE token = ?");
            $stmt->execute([$token]);
        }
        json_success([], 'Logged out successfully');
        break;

    default:
        json_error("Invalid auth action '{$action}'. Supported: login, register, me, update_profile, logout.", 400);
}
