<?php
/* ============================================================
   PregnaCare — api/coopland.php
   Endpoint: GET & POST /api/coopland.php
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../coopland_engine.php';
require_once __DIR__ . '/../symptom_alert_engine.php';
require_once __DIR__ . '/../recommendation_engine.php';

$u = require_api_user('patient');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = get_json_input();
    $symptoms = $input['symptoms'] ?? [];
    $pp = $input['pregnancy_problems'] ?? [];
    
    // Evaluate without auto-saving an unpopulated record
    $cooplandResult = evaluate_coopland($u['id'], $pdo, $symptoms, $pp, false);
    
    // If client supplied calculated score/factors from the mobile Coopland checklist
    if (isset($input['score']) && isset($input['risk_level'])) {
        $assessment_id = 'ca-' . uniqid();
        $riskLvl = ucfirst(strtolower($input['risk_level']));
        $scoreVal = (int)$input['score'];
        $factorsList = $input['matched_factors'] ?? [];
        $stmt = $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, NOW(), ?, ?, ?)");
        $stmt->execute([
            $assessment_id,
            $u['id'],
            $scoreVal,
            $riskLvl,
            json_encode($factorsList)
        ]);
        $cooplandResult = [
            'id' => $assessment_id,
            'coopland_score' => $scoreVal,
            'coopland_risk' => $riskLvl,
            'contributing_factors' => $factorsList
        ];
    } else {
        $assessment_id = 'ca-' . uniqid();
        $riskLvl = $cooplandResult['coopland_risk'] ?? 'Low';
        $scoreVal = $cooplandResult['coopland_score'] ?? 0;
        $factorsList = $cooplandResult['contributing_factors'] ?? [];
        $stmt = $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, NOW(), ?, ?, ?)");
        $stmt->execute([
            $assessment_id,
            $u['id'],
            $scoreVal,
            $riskLvl,
            json_encode($factorsList)
        ]);
        $cooplandResult['id'] = $assessment_id;
    }

    // Insert notification according to Coopland risk level for notification.php and mobile notifications
    $notifId = uid('ntf');
    if ($riskLvl === 'Severe') {
        $notifTitle = '🚨 Urgent: Severe Maternal Risk Detected';
        $notifBody = "Your Coopland risk score is {$scoreVal} (Severe Risk). Immediate medical evaluation by an obstetrician or at a hospital triage is required.";
        $notifKind = 'severe_risk_alert';
    } elseif ($riskLvl === 'High') {
        $notifTitle = '⚠️ Maternal Risk Alert: High Risk';
        $notifBody = "Your Coopland risk score is {$scoreVal} (High Risk). Please schedule an OB-GYN checkup within 24 to 48 hours.";
        $notifKind = 'high_risk_alert';
    } else {
        $notifTitle = '✅ Risk Assessment Completed: Low Risk';
        $notifBody = "Your Coopland risk score is {$scoreVal} (Low Risk). Continue your routine prenatal checkup schedule.";
        $notifKind = 'low_risk_assessment';
    }

    try {
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
            ->execute([$notifId, $u['id'], $notifTitle, $notifBody, now_iso(), $notifKind]);
    } catch (Exception $e) {}

    $recs = generate_recommendations($cooplandResult, []);
    json_success([
        'coopland' => $cooplandResult,
        'recommendations' => $recs
    ], 'Coopland assessment evaluated successfully', 201);
}

// GET handler
$stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$vitals = $stmt->fetch() ?: [];

$cooplandResult = evaluate_coopland($u['id'], $pdo, [], []);
$clinicalAlerts = evaluate_clinical_alerts($u['id'], $pdo, [], $vitals);

json_success([
    'coopland' => $cooplandResult,
    'clinical_alerts' => $clinicalAlerts
]);
