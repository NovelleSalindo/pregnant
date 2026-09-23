<?php
/* ============================================================
   PregnaCare — api/monitoring.php
   Endpoints:
     GET  /api/monitoring.php        -> Returns vitals history & stats
     POST /api/monitoring.php        -> Logs new vitals entry
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../pregnacare.php';

$u = require_api_user('patient');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 30;

    // Laboratory section
    if (isset($_GET['section']) && $_GET['section'] === 'laboratory') {
        $stmt = $pdo->prepare("SELECT * FROM prenatal_laboratories WHERE user_id = ? ORDER BY date DESC LIMIT ?");
        $stmt->bindValue(1, $u['id']);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $labs = $stmt->fetchAll();

        json_success([
            'labs' => $labs,
            'totalEntries' => count($labs),
        ]);
    }

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

    // ── Handle Laboratory Submission ──
    if ((isset($_GET['section']) && $_GET['section'] === 'laboratory') || (!empty($input['section']) && $input['section'] === 'laboratory')) {
        $id = uid('lab');
        $date = !empty($input['date']) ? $input['date'] : now_iso();
        $labType = !empty($input['lab_type']) ? $input['lab_type'] : 'initial';
        $cbcHb = !empty($input['cbc_hemoglobin']) ? (float)$input['cbc_hemoglobin'] : null;
        $cbcHct = !empty($input['cbc_hematocrit']) ? (float)$input['cbc_hematocrit'] : null;
        $cbcWbc = !empty($input['cbc_wbc']) ? (float)$input['cbc_wbc'] : null;
        $cbcPlt = !empty($input['cbc_platelets']) ? (int)$input['cbc_platelets'] : null;
        $bloodType = !empty($input['blood_type']) ? trim($input['blood_type']) : null;
        $rhFactor = !empty($input['rh_factor']) ? trim($input['rh_factor']) : null;
        $urinProt = !empty($input['urinalysis_protein']) ? trim($input['urinalysis_protein']) : null;
        $urinGlu = !empty($input['urinalysis_glucose']) ? trim($input['urinalysis_glucose']) : null;
        $urinKet = !empty($input['urinalysis_ketones']) ? trim($input['urinalysis_ketones']) : null;
        $bloodGlu = !empty($input['blood_glucose']) ? (float)$input['blood_glucose'] : null;
        $hiv = !empty($input['hiv_screening']) ? trim($input['hiv_screening']) : null;
        $syphilis = !empty($input['syphilis_screening']) ? trim($input['syphilis_screening']) : null;
        $hepb = !empty($input['hepb_screening']) ? trim($input['hepb_screening']) : null;
        $urineCult = !empty($input['urine_culture']) ? trim($input['urine_culture']) : null;
        $otherTests = !empty($input['other_tests']) ? trim($input['other_tests']) : null;
        $ultrasound = !empty($input['ultrasound_notes']) ? trim($input['ultrasound_notes']) : null;
        $fetalHr = !empty($input['fetal_heart_rate']) ? (int)$input['fetal_heart_rate'] : null;
        $fundalHeight = !empty($input['fundal_height_cm']) ? (float)$input['fundal_height_cm'] : null;
        $fetalMvmt = !empty($input['fetal_movement']) ? (int)$input['fetal_movement'] : null;
        $notes = !empty($input['notes']) ? trim($input['notes']) : null;
        $createdAt = now_iso();

        try {
            $stmt = $pdo->prepare("INSERT INTO prenatal_laboratories (
                id, user_id, date, lab_type,
                cbc_hemoglobin, cbc_hematocrit, cbc_wbc, cbc_platelets,
                blood_type, rh_factor,
                urinalysis_protein, urinalysis_glucose, urinalysis_ketones,
                blood_glucose,
                hiv_screening, syphilis_screening, hepb_screening,
                urine_culture, other_tests,
                ultrasound_notes, fetal_heart_rate, fundal_height_cm, fetal_movement,
                notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $id, $u['id'], $date, $labType,
                $cbcHb, $cbcHct, $cbcWbc, $cbcPlt,
                $bloodType, $rhFactor,
                $urinProt, $urinGlu, $urinKet,
                $bloodGlu,
                $hiv, $syphilis, $hepb,
                $urineCult, $otherTests,
                $ultrasound, $fetalHr, $fundalHeight, $fetalMvmt,
                $notes, $createdAt
            ]);
        } catch (\PDOException $e) {
            json_error('Save Failed: ' . $e->getMessage(), 500);
        }

        json_success([
            'id' => $id,
            'date' => $date,
            'lab_type' => $labType,
            'cbc_hemoglobin' => $cbcHb,
            'cbc_hematocrit' => $cbcHct,
            'cbc_wbc' => $cbcWbc,
            'cbc_platelets' => $cbcPlt,
            'blood_type' => $bloodType,
            'rh_factor' => $rhFactor,
            'urinalysis_protein' => $urinProt,
            'urinalysis_glucose' => $urinGlu,
            'urinalysis_ketones' => $urinKet,
            'blood_glucose' => $bloodGlu,
            'hiv_screening' => $hiv,
            'syphilis_screening' => $syphilis,
            'hepb_screening' => $hepb,
            'urine_culture' => $urineCult,
            'other_tests' => $otherTests,
            'ultrasound_notes' => $ultrasound,
            'fetal_heart_rate' => $fetalHr,
            'fundal_height_cm' => $fundalHeight,
            'fetal_movement' => $fetalMvmt,
            'notes' => $notes,
        ], 'Prenatal laboratory record saved successfully', 201);
    }

    // ── Handle Daily Vitals Submission ──
    $bpSys = !empty($input['bp_sys']) ? (int)$input['bp_sys'] : null;
    $bpDia = !empty($input['bp_dia']) ? (int)$input['bp_dia'] : null;
    $weight = !empty($input['weight_kg']) ? (float)$input['weight_kg'] : null;
    $sugar = !empty($input['blood_sugar']) ? (int)$input['blood_sugar'] : null;
    $hb = !empty($input['hemoglobin']) ? (float)$input['hemoglobin'] : null;
    $temp = !empty($input['temp']) ? (float)$input['temp'] : null;
    $heartRate = !empty($input['heart_rate']) ? (int)$input['heart_rate'] : null;
    $respRate = !empty($input['respiratory_rate']) ? (int)$input['respiratory_rate'] : null;
    $spo2 = !empty($input['spo2']) ? (int)$input['spo2'] : null;
    $fetalHr = !empty($input['fetal_heart_rate']) ? (int)$input['fetal_heart_rate'] : null;
    $fetalMovement = isset($input['fetal_movement']) && $input['fetal_movement'] !== '' ? (int)$input['fetal_movement'] : null;
    $sleepHours = !empty($input['sleep_hours']) ? (float)$input['sleep_hours'] : null;
    $waterIntake = !empty($input['water_intake']) ? (int)$input['water_intake'] : null;
    $mood = !empty($input['mood']) ? trim($input['mood']) : null;
    $activity = !empty($input['activity']) ? trim($input['activity']) : null;
    $date = !empty($input['date']) ? $input['date'] : now_iso();
    $glucoseTiming = !empty($input['glucose_timing']) ? trim($input['glucose_timing']) : 'preprandial';


    // PREGNACARE DECISION ENGINE
    // Runs validation + alert classification + risk synthesis + recs
    // ----------------------------------------------------------------
    $alertLevel      = 'Green_Alert';
    $overallRisk     = 'Low Risk';
    $recommendations = [];
    $engineRan       = false;

    // Only run engine when at least one clinical vital is provided
    if ($bpSys || $bpDia || $temp || $heartRate || $sugar) {
        $engineVitals = [
            'sys_bp'  => $bpSys  ?? 120,
            'dia_bp'  => $bpDia  ?? 80,
            'temp'    => $temp   ?? 37.0,
            'hr'      => $heartRate ?? 70,
            'timing'  => $glucoseTiming,
            'glucose' => $sugar  ?? 90,
        ];

        // Step 1: Validate programmatic bounds (rejects impossible readings)
        $validation = validateVitalsInput($engineVitals);
        if (!$validation['isValid']) {
            json_error($validation['message'], 422);
        }

        // Step 2: Classify alert level from vitals alone
        $alertLevel = processMaternalVitalsAndSymptoms($engineVitals, [
            'decreased_fetal_movement' => ($fetalMovement !== null && $fetalMovement < 4),
        ]);

        // Step 3: Determine overall risk
        // Demographics/clinical score not available here — treated as baseline Low
        $overallRisk = determineOverallRiskStatus($alertLevel, 'Low', 0);

        // Step 4: Generate personalized recommendations based on vitals
        $recommendations = generatePersonalizedRecommendations(
            $overallRisk,
            $engineVitals,
            ['decreased_fetal_movement' => ($fetalMovement !== null && $fetalMovement < 4)],
            []
        );

        $engineRan = true;
    }
    // ----------------------------------------------------------------

    $id = uid('mon');
    try {
        $stmt = $pdo->prepare("INSERT INTO monitoring (id, user_id, date, bp_sys, bp_dia, weight_kg, hemoglobin, blood_sugar, temp, heart_rate, fetal_movement, sleep_hours, water_intake, mood, activity, respiratory_rate, spo2, fetal_heart_rate)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id, $u['id'], $date,
            $bpSys, $bpDia, $weight, $hb, $sugar, $temp,
            $heartRate, $fetalMovement, $sleepHours, $waterIntake, $mood, $activity,
            $respRate, $spo2, $fetalHr
        ]);
    } catch (\PDOException $e) {
        json_error('Save Failed: ' . $e->getMessage(), 500);
    }

    // Clinical threshold warnings (legacy simple alerts kept for compatibility)
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
    if ($fetalMovement !== null && $fetalMovement < 4) {
        $warnings[] = 'Low fetal movement noted. If you notice reduced kicks, rest on your left side and monitor; contact your doctor if it persists.';
    }

    // Notify doctor dashboard when Severe / High Risk is detected
    if ($engineRan && in_array($overallRisk, ['High Risk', 'Severe Risk'], true)) {
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
            ->execute([uid('ntf'), $u['id'], 'Risk Alert from Vitals Log', "Risk level: {$overallRisk}. Alert: {$alertLevel}.", now_iso(), 'risk_alert']);
    }

    json_success([
        'id'               => $id,
        'date'             => $date,
        'bp_sys'           => $bpSys,
        'bp_dia'           => $bpDia,
        'weight_kg'        => $weight,
        'hemoglobin'       => $hb,
        'blood_sugar'      => $sugar,
        'temp'             => $temp,
        'heart_rate'       => $heartRate,
        'respiratory_rate' => $respRate,
        'spo2'             => $spo2,
        'fetal_heart_rate' => $fetalHr,
        'fetal_movement'   => $fetalMovement,
        'sleep_hours'      => $sleepHours,
        'water_intake'     => $waterIntake,
        'mood'             => $mood,
        'activity'         => $activity,
        'warnings'         => $warnings,
        // Pregnacare engine output
        'alert_level'     => $alertLevel,
        'overall_risk'    => $overallRisk,
        'recommendations' => $recommendations,
    ], 'Vitals recorded successfully', 201);
}

json_error('Method not allowed', 405);
