<?php
/* ============================================================
   PregnaCare — api/history.php
   Endpoint: GET /api/history.php?pregnancy_id=[id|all]
   Returns comprehensive history of:
     - All pregnancies / children of the mother
     - Complete vitals logs & vitals trends
     - Coopland risk assessments & clinical visit resolutions
     - Symptom check-ins & reported symptoms
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');
$userId = $u['id'];

// 1. Fetch all pregnancies of this mother
$pregsStmt = $pdo->prepare("SELECT * FROM pregnancies WHERE user_id = ? ORDER BY pregnancy_number DESC, created_at DESC");
$pregsStmt->execute([$userId]);
$pregnancies = $pregsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

$activePregId = get_active_pregnancy_id($pdo, $userId);

// Filter by pregnancy if specified
$filterPregId = $_GET['pregnancy_id'] ?? 'all';
if ($filterPregId !== 'all' && !empty($filterPregId)) {
    $pregFound = false;
    foreach ($pregnancies as $p) {
        if ($p['id'] === $filterPregId) {
            $pregFound = true;
            break;
        }
    }
    if (!$pregFound) {
        $filterPregId = 'all';
    }
} else {
    $filterPregId = 'all';
}

// 2. Fetch Vitals Logs (with pregnancy title)
if ($filterPregId !== 'all') {
    $vStmt = $pdo->prepare("
        SELECT m.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM monitoring m 
        LEFT JOIN pregnancies p ON p.id = m.pregnancy_id 
        WHERE m.user_id = ? AND m.pregnancy_id = ? 
        ORDER BY m.date DESC
    ");
    $vStmt->execute([$userId, $filterPregId]);
} else {
    $vStmt = $pdo->prepare("
        SELECT m.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM monitoring m 
        LEFT JOIN pregnancies p ON p.id = m.pregnancy_id 
        WHERE m.user_id = ? 
        ORDER BY m.date DESC
    ");
    $vStmt->execute([$userId]);
}
$vitalsLogs = $vStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

// 3. Compute Vitals Trends
$trends = compute_vitals_trends($pdo, $userId, $filterPregId === 'all' ? 'all' : $filterPregId);

// 4. Fetch Coopland Risk Assessments
if ($filterPregId !== 'all') {
    $caStmt = $pdo->prepare("
        SELECT ca.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM coopland_assessments ca 
        LEFT JOIN pregnancies p ON p.id = ca.pregnancy_id 
        WHERE ca.user_id = ? AND ca.pregnancy_id = ? 
        ORDER BY ca.date DESC, ca.id DESC
    ");
    $caStmt->execute([$userId, $filterPregId]);
} else {
    $caStmt = $pdo->prepare("
        SELECT ca.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM coopland_assessments ca 
        LEFT JOIN pregnancies p ON p.id = ca.pregnancy_id 
        WHERE ca.user_id = ? 
        ORDER BY ca.date DESC, ca.id DESC
    ");
    $caStmt->execute([$userId]);
}
$rawCooplands = $caStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
$riskAssessments = [];
foreach ($rawCooplands as $rc) {
    $factors = json_decode($rc['factors_json'] ?? '[]', true) ?: [];
    $riskAssessments[] = [
        'id' => $rc['id'],
        'pregnancy_id' => $rc['pregnancy_id'],
        'pregnancy_title' => $rc['pregnancy_title'] ?? 'Pregnancy',
        'pregnancy_number' => $rc['pregnancy_number'] ?? 1,
        'date' => $rc['date'],
        'score' => (int)$rc['score'],
        'risk_level' => ucfirst(strtolower($rc['risk_level'])),
        'factors' => $factors,
    ];
}

// 5. Fetch Clinical Doctor Consultations (attended visits)
if ($filterPregId !== 'all') {
    $cvStmt = $pdo->prepare("
        SELECT cv.*, p.title AS pregnancy_title 
        FROM clinical_visits cv 
        LEFT JOIN pregnancies p ON p.id = cv.pregnancy_id 
        WHERE cv.user_id = ? AND cv.pregnancy_id = ? 
        ORDER BY cv.visit_date DESC, cv.created_at DESC
    ");
    $cvStmt->execute([$userId, $filterPregId]);
} else {
    $cvStmt = $pdo->prepare("
        SELECT cv.*, p.title AS pregnancy_title 
        FROM clinical_visits cv 
        LEFT JOIN pregnancies p ON p.id = cv.pregnancy_id 
        WHERE cv.user_id = ? 
        ORDER BY cv.visit_date DESC, cv.created_at DESC
    ");
    $cvStmt->execute([$userId]);
}
$clinicalVisits = $cvStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

// 6. Fetch Symptom Check-in Logs with detailed items
if ($filterPregId !== 'all') {
    $slStmt = $pdo->prepare("
        SELECT sl.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM symptom_logs sl 
        LEFT JOIN pregnancies p ON p.id = sl.pregnancy_id 
        WHERE sl.user_id = ? AND sl.pregnancy_id = ? 
        ORDER BY sl.date DESC
    ");
    $slStmt->execute([$userId, $filterPregId]);
} else {
    $slStmt = $pdo->prepare("
        SELECT sl.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM symptom_logs sl 
        LEFT JOIN pregnancies p ON p.id = sl.pregnancy_id 
        WHERE sl.user_id = ? 
        ORDER BY sl.date DESC
    ");
    $slStmt->execute([$userId]);
}
$rawSymLogs = $slStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
$symptomLogs = [];
foreach ($rawSymLogs as $sl) {
    // Fetch items for this log
    $sliStmt = $pdo->prepare("
        SELECT sli.symptom_id, sli.severity, sli.duration, sli.frequency, sc.name, sc.icon, '' AS category 
        FROM symptom_log_items sli 
        LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id 
        WHERE sli.symptom_log_id = ? AND sli.severity != 'None' 
        ORDER BY sli.id ASC
    ");
    $sliStmt->execute([$sl['id']]);
    $items = $sliStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Fetch matching pregnancy problems if any
    $ppStmt = $pdo->prepare("
        SELECT * FROM pregnancy_problems 
        WHERE user_id = ? AND (pregnancy_id = ? OR pregnancy_id IS NULL) 
        AND ABS(TIMESTAMPDIFF(SECOND, date, ?)) <= 60 
        LIMIT 1
    ");
    $ppStmt->execute([$userId, $sl['pregnancy_id'], $sl['date']]);
    $ppRow = $ppStmt->fetch(PDO::FETCH_ASSOC);
    $ppConditions = [];
    if ($ppRow) {
        $ppLabels = [
            'bleeding_lt_20wks' => 'Bleeding < 20 weeks',
            'bleeding_gt_20wks' => 'Bleeding > 20 weeks',
            'postmaturity_prematurity' => 'Postmaturity / Prematurity',
            'hypertension' => 'Hypertension / High BP',
            'prom' => 'Premature Rupture of Membranes',
            'poly_oligohydramnios' => 'Polyhydramnios / Oligohydramnios',
            'iugr' => 'Intrauterine Growth Restriction (IUGR)',
            'multiple_pregnancy' => 'Multiple Pregnancy (Twins+)',
            'breech_malpresentation' => 'Breech / Malpresentation',
            'rh_isoimmunization' => 'Rh Isoimmunization',
            'anemia' => 'Hemoglobin < 10 g/dL / Anemia',
        ];
        foreach ($ppLabels as $k => $label) {
            if (!empty($ppRow[$k])) {
                $ppConditions[] = $label;
            }
        }
    }

    $symptomLogs[] = [
        'id' => $sl['id'],
        'pregnancy_id' => $sl['pregnancy_id'],
        'pregnancy_title' => $sl['pregnancy_title'] ?? 'Pregnancy',
        'pregnancy_number' => $sl['pregnancy_number'] ?? 1,
        'date' => $sl['date'],
        'items' => $items,
        'conditions' => $ppConditions,
        'total_symptoms' => count($items),
    ];
}

// 7. Pregnancy stats summary for each pregnancy (queried directly so counts are always permanent and independent of filter)
$pregnancySummaries = [];
$cntVStmt = $pdo->prepare("SELECT COUNT(*) FROM monitoring WHERE user_id = ? AND pregnancy_id = ?");
$cntRStmt = $pdo->prepare("SELECT COUNT(*) FROM coopland_assessments WHERE user_id = ? AND pregnancy_id = ?");
$cntSStmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id = ? AND pregnancy_id = ?");

foreach ($pregnancies as $pr) {
    $pId = $pr['id'];
    $cntVStmt->execute([$userId, $pId]);
    $cntV = (int)$cntVStmt->fetchColumn();

    $cntRStmt->execute([$userId, $pId]);
    $cntR = (int)$cntRStmt->fetchColumn();

    $cntSStmt->execute([$userId, $pId]);
    $cntS = (int)$cntSStmt->fetchColumn();

    $pregnancySummaries[$pId] = [
        'vitals_count' => $cntV,
        'risk_count' => $cntR,
        'symptoms_count' => $cntS,
    ];
}

// 8. Overall Summary
$allBps = [];
foreach ($vitalsLogs as $vl) {
    if (!empty($vl['bp_sys']) && !empty($vl['bp_dia'])) {
        $allBps[] = ['sys' => (int)$vl['bp_sys'], 'dia' => (int)$vl['bp_dia']];
    }
}
$avgSys = count($allBps) ? round(array_sum(array_column($allBps, 'sys')) / count($allBps)) : null;
$avgDia = count($allBps) ? round(array_sum(array_column($allBps, 'dia')) / count($allBps)) : null;

json_success([
    'filter_pregnancy_id' => $filterPregId,
    'active_pregnancy_id' => $activePregId,
    'pregnancies' => $pregnancies,
    'pregnancy_summaries' => $pregnancySummaries,
    'vitals' => $vitalsLogs,
    'trends' => $trends,
    'risk_assessments' => $riskAssessments,
    'clinical_visits' => $clinicalVisits,
    'symptom_logs' => $symptomLogs,
    'summary' => [
        'total_pregnancies' => count($pregnancies),
        'total_vitals' => count($vitalsLogs),
        'total_risk_assessments' => count($riskAssessments),
        'total_clinical_visits' => count($clinicalVisits),
        'total_symptom_logs' => count($symptomLogs),
        'avg_bp' => ($avgSys && $avgDia) ? "{$avgSys}/{$avgDia} mmHg" : '—',
        'latest_reading' => !empty($vitalsLogs[0]) ? $vitalsLogs[0]['date'] : null,
    ]
]);
