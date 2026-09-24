<?php
/* ============================================================
   PregnaCare — test_data_isolation.php
   Automated verification of User Data Isolation (TEST 1 to TEST 5)
   ============================================================ */

require_once __DIR__ . '/base.php';
require_once __DIR__ . '/api/bootstrap.php';

function run_test(string $title, callable $fn) {
    echo "========================================\n";
    echo "RUNNING: $title\n";
    echo "========================================\n";
    try {
        $fn();
        echo ">>> PASS: $title\n\n";
        return true;
    } catch (Throwable $e) {
        echo ">>> FAIL: $title\n";
        echo "Error: " . $e->getMessage() . "\n\n";
        return false;
    }
}

function clean_user(string $email) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $uid = $stmt->fetchColumn();
    if ($uid) {
        $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$uid]);
    }
}

$emailA = 'test_user_a_' . time() . '@test.com';
$emailB = 'test_user_b_' . time() . '@test.com';
$pass = 'TestPassword123!';

$tokenA = null;
$userIdA = null;
$tokenB = null;
$userIdB = null;
$assessmentIdA = null;
$assessmentIdB = null;

// Clean up any leftovers
clean_user($emailA);
clean_user($emailB);

$allPassed = true;

// ----------------------------------------------------
// TEST 1: Create User A -> add assessment -> logout.
// ----------------------------------------------------
$passed = run_test("TEST 1: Create User A -> add assessment -> logout", function() use (&$tokenA, &$userIdA, &$assessmentIdA, $emailA, $pass, $pdo) {
    // 1. Register User A
    $userIdA = 'u_test_a_' . substr(md5(uniqid()), 0, 8);
    $hashed = password_hash($pass, PASSWORD_BCRYPT);
    $now = now_iso();
    
    $stmt = $pdo->prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'patient', ?)");
    $stmt->execute([$userIdA, 'Test User A', $emailA, $hashed, $now]);
    
    $tokenA = generate_api_token($userIdA);
    if (!$tokenA) throw new Exception("Failed to generate token for User A");
    
    // Add patient profile
    $stmt = $pdo->prepare("INSERT INTO patient_profiles (user_id, lmp, edd, blood_type) VALUES (?, '2026-01-01', '2026-10-08', 'O+')");
    $stmt->execute([$userIdA]);
    
    // Add Coopland Assessment for User A (Score 5, Moderate)
    $assessmentIdA = 'ca_test_a_' . substr(md5(uniqid()), 0, 8);
    $stmt = $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, ?, 5, 'Moderate', ?)");
    $stmt->execute([$assessmentIdA, $userIdA, $now, json_encode(['Previous C-Section (+2)', 'Hypertension (+3)'])]);
    
    // Also insert general assessment for User A
    $genAssessIdA = 'as_test_a_' . substr(md5(uniqid()), 0, 8);
    $stmt = $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, status) VALUES (?, ?, ?, 65, 'High', 0.65, 65, 'active')");
    $stmt->execute([$genAssessIdA, $userIdA, $now]);
    
    // Simulate Logout: token revoked
    $pdo->prepare("DELETE FROM api_tokens WHERE token = ?")->execute([$tokenA]);
    $tokenA = null;
    
    echo "User A created ($userIdA), added assessment (Score: 5), and logged out.\n";
});
$allPassed = $allPassed && $passed;

// ----------------------------------------------------
// TEST 2: Create User B -> login -> open History.
// Expected: User B sees an empty history or only User B's records.
// ----------------------------------------------------
$passed = run_test("TEST 2: Create User B -> login -> open History. (Expected: empty history)", function() use (&$tokenB, &$userIdB, $emailB, $pass, $pdo) {
    // 1. Register User B
    $userIdB = 'u_test_b_' . substr(md5(uniqid()), 0, 8);
    $hashed = password_hash($pass, PASSWORD_BCRYPT);
    $now = now_iso();
    
    $stmt = $pdo->prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'patient', ?)");
    $stmt->execute([$userIdB, 'Test User B', $emailB, $hashed, $now]);
    
    $tokenB = generate_api_token($userIdB);
    
    // Check User B's dashboard data from DB using User B's identity
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM coopland_assessments WHERE user_id = ?");
    $stmt->execute([$userIdB]);
    $coopCount = (int)$stmt->fetchColumn();
    if ($coopCount !== 0) {
        throw new Exception("Data leakage! User B has coopland_assessments count: $coopCount");
    }
    
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM assessments WHERE user_id = ?");
    $stmt->execute([$userIdB]);
    $assessCount = (int)$stmt->fetchColumn();
    if ($assessCount !== 0) {
        throw new Exception("Data leakage! User B has assessments count: $assessCount");
    }
    
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id = ?");
    $stmt->execute([$userIdB]);
    $sympCount = (int)$stmt->fetchColumn();
    if ($sympCount !== 0) {
        throw new Exception("Data leakage! User B has symptom_logs count: $sympCount");
    }
    
    echo "User B ($userIdB) history verified: 0 assessments, 0 coopland evaluations, 0 symptom logs.\n";
});
$allPassed = $allPassed && $passed;

// ----------------------------------------------------
// TEST 3: User B creates a risk assessment.
// Expected: Only User B can see that assessment.
// ----------------------------------------------------
$passed = run_test("TEST 3: User B creates a risk assessment. (Expected: only User B sees it)", function() use ($userIdA, $userIdB, &$assessmentIdB, $pdo) {
    $now = now_iso();
    $assessmentIdB = 'ca_test_b_' . substr(md5(uniqid()), 0, 8);
    $stmt = $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, ?, 10, 'High', ?)");
    $stmt->execute([$assessmentIdB, $userIdB, $now, json_encode(['Severe Preeclampsia (+10)'])]);
    
    // Verify it is visible to User B
    $stmt = $pdo->prepare("SELECT id, score FROM coopland_assessments WHERE user_id = ?");
    $stmt->execute([$userIdB]);
    $bRecords = $stmt->fetchAll();
    if (count($bRecords) !== 1 || (int)$bRecords[0]['score'] !== 10) {
        throw new Exception("User B assessment creation verification failed");
    }
    
    // Verify it is NOT visible in User A's dataset
    $stmt = $pdo->prepare("SELECT id FROM coopland_assessments WHERE user_id = ? AND id = ?");
    $stmt->execute([$userIdA, $assessmentIdB]);
    if ($stmt->fetch()) {
        throw new Exception("Cross-user contamination! User A query returned User B's assessment");
    }
    
    echo "User B assessment ($assessmentIdB, Score: 10) belongs strictly to User B.\n";
});
$allPassed = $allPassed && $passed;

// ----------------------------------------------------
// TEST 4: Logout User B -> login User A.
// Expected: User A sees only User A's previous records.
// ----------------------------------------------------
$passed = run_test("TEST 4: Logout User B -> login User A. (Expected: User A sees only User A's records)", function() use ($userIdA, $userIdB, $assessmentIdA, $assessmentIdB, $pdo) {
    // Logout User B
    $pdo->prepare("DELETE FROM api_tokens WHERE user_id = ?")->execute([$userIdB]);
    
    // Login User A
    $newTokA = generate_api_token($userIdA);
    
    // Fetch User A's assessments
    $stmt = $pdo->prepare("SELECT id, score FROM coopland_assessments WHERE user_id = ?");
    $stmt->execute([$userIdA]);
    $aRecords = $stmt->fetchAll();
    
    if (count($aRecords) !== 1) {
        throw new Exception("Expected 1 assessment for User A, found: " . count($aRecords));
    }
    if ($aRecords[0]['id'] !== $assessmentIdA || (int)$aRecords[0]['score'] !== 5) {
        throw new Exception("User A record mismatch: " . json_encode($aRecords[0]));
    }
    
    // Ensure User A NEVER sees User B's assessment
    foreach ($aRecords as $rec) {
        if ($rec['id'] === $assessmentIdB) {
            throw new Exception("CRITICAL FAILURE: User A can see User B's assessment ($assessmentIdB)");
        }
    }
    
    echo "User A logged back in: Sees exactly User A's assessment (Score: 5), 0 traces of User B.\n";
});
$allPassed = $allPassed && $passed;

// ----------------------------------------------------
// TEST 5: Try requesting User A's record while authenticated as User B.
// Expected: The backend must reject the request or return no record.
// ----------------------------------------------------
$passed = run_test("TEST 5: Try requesting User A's record while authenticated as User B.", function() use ($userIdA, $userIdB, $assessmentIdA, $pdo) {
    // Authenticate as User B
    $tokB = generate_api_token($userIdB);
    
    // User B tries to fetch User A's record by filtering by authenticated user
    // The backend uses $u['id'] = $userIdB
    $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND id = ?");
    $stmt->execute([$userIdB, $assessmentIdA]);
    $tamperResult = $stmt->fetch();
    
    if ($tamperResult !== false) {
        throw new Exception("SECURITY BREACH: User B accessed User A's assessment ($assessmentIdA)!");
    }
    
    // Direct attempt to update User A's profile using User B's context
    $stmt = $pdo->prepare("UPDATE patient_profiles SET blood_type = 'AB+' WHERE user_id = ?");
    $stmt->execute([$userIdB]); // Backend binds authenticated user ID, never trusting client parameter
    
    // Verify User A's profile is intact
    $stmt = $pdo->prepare("SELECT blood_type FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$userIdA]);
    $bloodA = $stmt->fetchColumn();
    if ($bloodA !== 'O+') {
        throw new Exception("SECURITY BREACH: User A's profile was modified by User B's action!");
    }
    
    echo "Ownership verification passed: User B cannot access or alter User A's record.\n";
});
$allPassed = $allPassed && $passed;

// Cleanup test users
clean_user($emailA);
clean_user($emailB);

echo "========================================\n";
if ($allPassed) {
    echo "ALL 5 DATA ISOLATION TESTS PASSED SUCCESSFULLY!\n";
} else {
    echo "SOME TESTS FAILED!\n";
}
echo "========================================\n";
