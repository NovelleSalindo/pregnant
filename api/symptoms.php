<?php
/* ============================================================
   PregnaCare — api/symptoms.php
   Endpoints:
     GET  /api/symptoms.php -> Symptom catalog, levels, and past assessments
     POST /api/symptoms.php -> Runs AHP + Fuzzy + Rule-based assessment & saves
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');
$catalog = get_symptom_catalog();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 10");
    $stmt->execute([$u['id']]);
    $pastAssessments = $stmt->fetchAll();

    foreach ($pastAssessments as &$asm) {
        $asm['structural'] = json_decode($asm['ahp_json'] ?? 'null', true);
        $asm['fuzzy'] = json_decode($asm['fuzzy_json'] ?? 'null', true);
        $asm['rules'] = json_decode($asm['rules_json'] ?? 'null', true);
        $asm['recommendations'] = json_decode($asm['recommendations_json'] ?? 'null', true);
        unset($asm['ahp_json'], $asm['fuzzy_json'], $asm['rules_json'], $asm['recommendations_json']);
    }

    json_success([
        'catalog' => $catalog,
        'levels' => [
            'severity' => SEVERITY_LEVELS,
            'duration' => DURATION_LEVELS,
            'frequency' => FREQUENCY_LEVELS,
        ],
        'ruleScores' => RULE_SCORES,
        'ruleCategoryLabels' => RULE_CAT_LABELS,
        'history' => $pastAssessments,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = get_json_input();
    $submittedSymptoms = $input['symptoms'] ?? [];
    $submittedPP = $input['pregnancy_problems'] ?? ($input['pp'] ?? []);

    // 1. Save symptom log
    $logId = uid('sym');
    $pdo->prepare("INSERT INTO symptom_logs (id, user_id, date) VALUES (?,?,?)")->execute([$logId, $u['id'], now_iso()]);

    $normalizedSymptoms = [];
    $activeEntries = [];

    // Map submitted items by ID
    $submittedMap = [];
    foreach ($submittedSymptoms as $s) {
        if (!empty($s['id'])) {
            $submittedMap[$s['id']] = $s;
        }
    }

    foreach ($catalog as $c) {
        $sid = $c['id'];
        $entry = $submittedMap[$sid] ?? null;
        $severity = $entry['severity'] ?? 'None';
        $duration = $entry['duration'] ?? 'Today';
        $frequency = $entry['frequency'] ?? 'Rare';

        if ($severity !== 'None') {
            $pdo->prepare("INSERT INTO symptom_log_items (id, symptom_log_id, symptom_id, severity, duration, frequency) VALUES (?,?,?,?,?,?)")
                ->execute([uid('sli'), $logId, $sid, $severity, $duration, $frequency]);
            $activeEntries[] = ['id' => $sid, 'severity' => $severity, 'duration' => $duration, 'frequency' => $frequency];
        }

        $normalizedSymptoms[] = [
            'id' => $sid,
            'severity' => $severity,
            'duration' => $duration,
            'frequency' => $frequency,
        ];
    }

    // 2. Save Present Pregnancy Problems (PP)
    $ppFields = [
        'bleeding_lt_20wks', 'bleeding_gt_20wks', 'postmaturity_prematurity',
        'hypertension', 'prom', 'poly_oligohydramnios', 'iugr',
        'multiple_pregnancy', 'breech_malpresentation', 'rh_isoimmunization'
    ];
    $pp = [];
    foreach ($ppFields as $f) {
        $pp[$f] = !empty($submittedPP[$f]) ? 1 : 0;
    }

    $pdo->prepare("INSERT INTO pregnancy_problems
        (id, user_id, symptom_log_id, date, bleeding_lt_20wks, bleeding_gt_20wks, postmaturity_prematurity, hypertension, prom, poly_oligohydramnios, iugr, multiple_pregnancy, breech_malpresentation, rh_isoimmunization)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            uid('pp'), $u['id'], $logId, now_iso(),
            $pp['bleeding_lt_20wks'], $pp['bleeding_gt_20wks'], $pp['postmaturity_prematurity'], $pp['hypertension'],
            $pp['prom'], $pp['poly_oligohydramnios'], $pp['iugr'], $pp['multiple_pregnancy'],
            $pp['breech_malpresentation'], $pp['rh_isoimmunization'],
        ]);

    // 3. Retrieve latest vitals, patient profile, and risk history
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id']]);
    $vitals = $stmt->fetch() ?: [];

    $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$u['id']]);
    $profile = $stmt->fetch() ?: [];

    $riskHistory = get_risk_history($pdo, $u['id']);
    $riskHistory['prev_cesarean'] = !empty($profile['prior_csection']);

    $age = $profile['age'] ?? 28;
    $trimester = 2;
    if (!empty($profile['lmp'])) {
        $weeks = floor((time() - strtotime($profile['lmp'])) / (7 * 86400));
        $trimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
    }
    $bmi = !empty($vitals['bmi']) ? (float)$vitals['bmi'] : bmi_of($profile['weight_kg'] ?? 62, $profile['height_cm'] ?? 160);
    $hemoglobin = (float)($vitals['hemoglobin'] ?? 12);

    $engineInput = [
        'age' => (int)$age,
        'trimester' => $trimester,
        'bp_sys' => (int)($vitals['bp_sys'] ?? 118),
        'bp_dia' => (int)($vitals['bp_dia'] ?? 76),
        'bmi' => $bmi,
        'hemoglobin' => $hemoglobin,
        'blood_sugar' => (int)($vitals['blood_sugar'] ?? 95),
        'riskHistory' => $riskHistory,
        'pregnancyProblems' => $pp,
        'symptoms' => $normalizedSymptoms,
    ];

    // 4. Run Risk Engine
    $ruleBase = get_rule_base();
    $result = assess_risk($engineInput, $ruleBase, $catalog);

    // 5. Persist Assessment
    $asmId = uid('asm');
    $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            $asmId, $u['id'], now_iso(), $result['score'], $result['level'],
            $result['structural']['total'], $result['fuzzy']['centroid'],
            json_encode($result['structural']), json_encode($result['fuzzy']),
            json_encode($result['rules']), json_encode($result['recommendations']),
        ]);

    // Send high/severe alert notification
    if ($result['level'] === 'Severe') {
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
            ->execute([uid('ntf'), $u['id'], 'Critical Maternal Risk Alert', 'Your recent check-in indicated SEVERE risk factors. Please contact your OB-GYN immediately.', now_iso(), 'risk_alert']);
    }

    json_success([
        'assessmentId' => $asmId,
        'score' => $result['score'],
        'level' => $result['level'],
        'structural' => $result['structural'],
        'fuzzy' => $result['fuzzy'],
        'rules' => $result['rules'],
        'recommendations' => $result['recommendations'],
        'generatedAt' => $result['generatedAt'],
    ], 'Assessment completed successfully', 201);
}

json_error('Method not allowed', 405);
