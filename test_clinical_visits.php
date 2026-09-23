<?php
require_once __DIR__ . '/base.php';

echo "=== TESTING CLINICAL VISIT RESOLUTION & SEVERE RISK ARCHIVING ===\n\n";

$testUserId = 'test_usr_vis';
// Create or ensure test user
$stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
$stmt->execute([$testUserId]);
if (!$stmt->fetch()) {
    $pdo->prepare("INSERT INTO users (id, role, name, email, password_hash, created_at) VALUES (?, 'patient', 'Test Mother', 'testmother@example.com', 'hash', NOW())")
        ->execute([$testUserId]);
}

// Ensure clean slate for test user
$pdo->prepare("DELETE FROM clinical_visits WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM assessments WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM notifications WHERE user_id = ?")->execute([$testUserId]);

// Step 1: Create a SEVERE assessment
$asmId = uid('asm');
$now = now_iso();
$pdo->prepare("
    INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json, status)
    VALUES (?, ?, ?, 88, 'Severe', 0.88, 88, '{}', '{}', '[]', '[]', 'active')
")->execute([$asmId, $testUserId, $now]);

echo "[Test 1] Created SEVERE assessment {$asmId}.\n";

// Verify initial state
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE id = ?");
$stmt->execute([$asmId]);
$row = $stmt->fetch();
assert($row['status'] === 'active', "Initial status must be 'active'");
echo "  -> Assessment status is 'active' as expected.\n";

// Step 2: Record clinical visit
$visitData = [
    'facility' => 'St. Luke\'s Medical Center',
    'doctor_name' => 'Dr. Eleanor Vance, OB-GYN',
    'visit_date' => date('Y-m-d H:i:s', strtotime('-2 hours')),
    'notes' => 'Patient presented with elevated BP. Prescribed labetalol. Vitals stabilized to 120/78 mmHg. Advised 48h bed rest and adequate hydration. Cleared for continued home monitoring.',
];

$res = record_clinical_visit($pdo, $testUserId, $asmId, $visitData);
assert($res['success'] === true, "record_clinical_visit must return success");
echo "\n[Test 2] record_clinical_visit executed successfully (Visit ID: {$res['visit_id']}).\n";

// Step 3: Verify assessment was updated
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE id = ?");
$stmt->execute([$asmId]);
$updatedAsm = $stmt->fetch();
assert($updatedAsm['status'] === 'resolved', "Assessment status should be 'resolved'");
assert($updatedAsm['visited_facility'] === $visitData['facility'], "Facility must match");
assert($updatedAsm['doctor_name'] === $visitData['doctor_name'], "Doctor name must match");
assert(!empty($updatedAsm['resolved_at']), "resolved_at must be set");
echo "  -> Assessment marked as 'resolved' with correct facility, doctor name, and resolved_at.\n";

// Step 4: Verify clinical_visits table
$stmt = $pdo->prepare("SELECT * FROM clinical_visits WHERE id = ?");
$stmt->execute([$res['visit_id']]);
$cvRow = $stmt->fetch();
assert($cvRow !== false, "Row in clinical_visits must exist");
assert($cvRow['assessment_id'] === $asmId, "assessment_id in clinical_visits must match");
assert($cvRow['facility'] === $visitData['facility'], "facility in clinical_visits must match");
assert($cvRow['notes'] === $visitData['notes'], "notes in clinical_visits must match");
echo "  -> clinical_visits table contains verified record.\n";

// Step 5: Verify get_clinical_visits_history
$history = get_clinical_visits_history($pdo, $testUserId);
assert(count($history) === 1, "get_clinical_visits_history must return 1 record");
assert($history[0]['facility'] === $visitData['facility'], "History record facility must match");
assert((int)$history[0]['assessment_score'] === 88, "History record must include assessment score");
echo "  -> get_clinical_visits_history returned correctly joined historical record.\n";

// Step 6: Verify notification created
$stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? AND kind = 'visit_resolved'");
$stmt->execute([$testUserId]);
$notif = $stmt->fetch();
assert($notif !== false, "visit_resolved notification must exist");
echo "  -> Notification 'Clinical Visit Logged' was dispatched to patient.\n";

// Step 7: Create a fresh normal assessment (simulating the patient's new check-in)
$newAsmId = uid('asm');
$newDate = date('Y-m-d H:i:s', strtotime('+1 hour'));
$pdo->prepare("
    INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json, status)
    VALUES (?, ?, ?, 22, 'Low', 0.22, 22, '{}', '{}', '[]', '[]', 'active')
")->execute([$newAsmId, $testUserId, $newDate]);

// Check latest assessment
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$testUserId]);
$currentLatest = $stmt->fetch();
assert($currentLatest['id'] === $newAsmId, "Latest assessment should now be the new one");
assert($currentLatest['level'] === 'Low', "Latest assessment level should be Low");
assert($currentLatest['status'] === 'active', "Latest assessment status should be active");

// Verify the historical visit is still archived and accessible
$historyAfter = get_clinical_visits_history($pdo, $testUserId);
assert(count($historyAfter) === 1, "Archived clinical visit is still preserved in history");
echo "\n[Test 7] Fresh assessment successfully logged; past severe alert remains permanently archived in history.\n";

// Clean up test user data
$pdo->prepare("DELETE FROM clinical_visits WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM assessments WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM notifications WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);

echo "\n>>> ALL CLINICAL VISIT RESOLUTION TESTS PASSED (100% SUCCESS) <<<\n";
