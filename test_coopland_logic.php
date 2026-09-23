<?php
require_once __DIR__ . '/base.php';
require_once __DIR__ . '/coopland_engine.php';
require_once __DIR__ . '/symptom_alert_engine.php';

// Create a dummy user
$user_id = 'usr-' . uniqid();
$pdo->query("INSERT INTO users (id, name, email, password_hash, role) VALUES ('$user_id', 'Test User', 'test@example.com', 'test', 'patient')");

function run_test($pdo, $user_id, $test_name, $profile_data, $symptoms = [], $vitals = []) {
    echo "\n=== $test_name ===\n";
    // Setup profile
    $pdo->query("DELETE FROM patient_profiles WHERE user_id = '$user_id'");
    $stmt = $pdo->prepare("INSERT INTO patient_profiles (user_id, age, gravida, prior_miscarriage, prior_csection, conditions) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $user_id,
        $profile_data['age'] ?? 25,
        $profile_data['gravida'] ?? 1, // parity = gravida - 1
        $profile_data['prior_miscarriage'] ?? 0,
        $profile_data['prior_csection'] ?? 0,
        $profile_data['conditions'] ?? ''
    ]);

    // Default vitals if not provided
    if (empty($vitals)) {
        $vitals = ['bp_sys' => 120, 'bp_dia' => 80, 'temp' => 37.0, 'heart_rate' => 80, 'blood_sugar' => 90];
    }

    $cooplandResult = evaluate_coopland($user_id, $pdo, $symptoms);
    $clinicalAlerts = evaluate_clinical_alerts($user_id, $pdo, $symptoms, $vitals);

    echo "Coopland Score: " . $cooplandResult['score'] . "\n";
    echo "Coopland Risk: " . $cooplandResult['risk_level'] . "\n";
    if (empty($clinicalAlerts)) {
        echo "Clinical Alert: NONE\n";
    } else {
        foreach ($clinicalAlerts as $a) {
            echo "Clinical Alert: " . $a['severity'] . " (" . $a['alert_text'] . ")\n";
        }
    }
}

// TEST 1: No risk factors + no warning symptoms
// Parity=1 (gravida=2) gives 0 points. Age=25 gives 0 points.
run_test($pdo, $user_id, "TEST 1: No risk factors + no symptoms", 
    ['age' => 25, 'gravida' => 2]);

// TEST 2: Age >35 (2) + Previous CS (2) + Hypertension (2) = 6 -> HIGH
run_test($pdo, $user_id, "TEST 2: Age >35 + Previous CS + Hypertension", 
    ['age' => 36, 'gravida' => 2, 'prior_csection' => 1, 'conditions' => 'hypertension']);

// TEST 3: Coopland score = 7 -> REVIEW
// Age > 35 (2) + Prior CS (2) + Diabetes (3) = 7
run_test($pdo, $user_id, "TEST 3: Coopland Score 7", 
    ['age' => 36, 'gravida' => 2, 'prior_csection' => 1, 'conditions' => 'diabetes']);

// TEST 4: Coopland score > 7 -> SEVERE
// Age > 35 (2) + Prior CS (2) + Cardiac Disease (3) + Nulliparous (1) = 8
run_test($pdo, $user_id, "TEST 4: Coopland Score > 7", 
    ['age' => 36, 'gravida' => 1, 'prior_csection' => 1, 'conditions' => 'cardiac']);

// TEST 5: Coopland score = 0 + severe headache
// Expected: Coopland LOW, Clinical Alert HIGH
run_test($pdo, $user_id, "TEST 5: Coopland 0 + severe headache", 
    ['age' => 25, 'gravida' => 2], 
    [['id' => 'headache', 'severity' => 'severe']]);

// TEST 6: Coopland score = 0 + severe headache + BP >=140/90
run_test($pdo, $user_id, "TEST 6: Coopland 0 + severe headache + BP >=140/90", 
    ['age' => 25, 'gravida' => 2], 
    [['id' => 'headache', 'severity' => 'severe']],
    ['bp_sys' => 145, 'bp_dia' => 95, 'temp' => 37, 'heart_rate' => 80, 'blood_sugar' => 90]);

// TEST 7: No Coopland risk factors + mild/common symptoms
run_test($pdo, $user_id, "TEST 7: No Coopland risk + mild symptoms", 
    ['age' => 25, 'gravida' => 2], 
    [['id' => 'nausea', 'severity' => 'mild'], ['id' => 'fatigue', 'severity' => 'mild']]);

// TEST 8: Vaginal bleeding
run_test($pdo, $user_id, "TEST 8: Vaginal Bleeding", 
    ['age' => 25, 'gravida' => 2], 
    [['id' => 'vaginal_bleeding', 'severity' => 'severe']]);

$pdo->query("DELETE FROM users WHERE id = '$user_id'");
