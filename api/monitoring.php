<?php
/* ============================================================
   PregnaCare — api/monitoring.php
   Endpoints:
     GET  /api/monitoring.php        -> Returns vitals history & stats
     POST /api/monitoring.php        -> Logs new vitals entry
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 30;

    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT ?");
    $stmt->bindValue(1, $u['id']);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll();

    // Summary statistics
    $bpSysValues = [];
    $bpDiaValues = [];
    $sugarValues = [];
    foreach ($logs as $l) {
        if ($l['bp_sys']) $bpSysValues[] = (int)$l['bp_sys'];
        if ($l['bp_dia']) $bpDiaValues[] = (int)$l['bp_dia'];
        if ($l['blood_sugar']) $sugarValues[] = (int)$l['blood_sugar'];
    }

    $avgSys = count($bpSysValues) ? round(array_sum($bpSysValues) / count($bpSysValues)) : null;
    $avgDia = count($bpDiaValues) ? round(array_sum($bpDiaValues) / count($bpDiaValues)) : null;
    $avgSugar = count($sugarValues) ? round(array_sum($sugarValues) / count($sugarValues)) : null;

    json_success([
        'logs' => $logs,
        'stats' => [
            'totalEntries' => count($logs),
            'avgBpSys' => $avgSys,
            'avgBpDia' => $avgDia,
            'avgSugar' => $avgSugar,
            'latest' => $logs[0] ?? null,
        ]
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = get_json_input();

    $bpSys = !empty($input['bp_sys']) ? (int)$input['bp_sys'] : null;
    $bpDia = !empty($input['bp_dia']) ? (int)$input['bp_dia'] : null;
    $weight = !empty($input['weight_kg']) ? (float)$input['weight_kg'] : null;
    $sugar = !empty($input['blood_sugar']) ? (int)$input['blood_sugar'] : null;
    $hb = !empty($input['hemoglobin']) ? (float)$input['hemoglobin'] : null;
    $temp = !empty($input['temp']) ? (float)$input['temp'] : null;
    $date = !empty($input['date']) ? $input['date'] : now_iso();

    // Fetch height to calculate BMI if weight is provided
    $stmt = $pdo->prepare("SELECT height_cm FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$u['id']]);
    $height = $stmt->fetchColumn();

    $bmi = null;
    if ($weight && $height && (float)$height > 0) {
        $hM = (float)$height / 100;
        $bmi = round($weight / ($hM * $hM), 1);
    }

    $id = uid('mon');
    $stmt = $pdo->prepare("INSERT INTO monitoring (id, user_id, date, bp_sys, bp_dia, weight_kg, bmi, hemoglobin, blood_sugar, temp)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $u['id'], $date, $bpSys, $bpDia, $weight, $bmi, $hb, $sugar, $temp]);

    // Check for clinical threshold warnings
    $warnings = [];
    if ($bpSys && ($bpSys >= 140 || ($bpDia && $bpDia >= 90))) {
        $warnings[] = 'Elevated blood pressure detected. Rest and check again; consult your doctor if it stays high.';
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
            ->execute([uid('ntf'), $u['id'], 'High Blood Pressure Alert', "Recorded BP {$bpSys}/{$bpDia} mmHg. Please inform your OB-GYN.", now_iso(), 'bp_alert']);
    }
    if ($sugar && $sugar >= 140) {
        $warnings[] = 'Elevated blood sugar detected.';
    }
    if ($hb && $hb < 10.0) {
        $warnings[] = 'Low hemoglobin indicates possible anemia. Ensure you are taking prescribed iron supplements.';
    }

    json_success([
        'id' => $id,
        'date' => $date,
        'bp_sys' => $bpSys,
        'bp_dia' => $bpDia,
        'weight_kg' => $weight,
        'bmi' => $bmi,
        'hemoglobin' => $hb,
        'blood_sugar' => $sugar,
        'temp' => $temp,
        'warnings' => $warnings,
    ], 'Vitals recorded successfully', 201);
}

json_error('Method not allowed', 405);
