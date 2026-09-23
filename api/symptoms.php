<?php
/* ============================================================
   PregnaCare — api/symptoms.php
   Endpoints:
     GET  /api/symptoms.php -> Symptom catalog, levels, and past assessments
     POST /api/symptoms.php -> Runs Fuzzy Logic + RULES.docx Safety Override & saves
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../coopland_engine.php';
require_once __DIR__ . '/../symptom_alert_engine.php';
require_once __DIR__ . '/../recommendation_engine.php';

$u = require_api_user('patient');
$catalog = get_symptom_catalog();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 10");
    $stmt->execute([$u['id']]);
    $pastAssessments = $stmt->fetchAll();

    foreach ($pastAssessments as &$asm) {
        $asm['structural'] = json_decode($asm['ahp_json'] ?? 'null', true);
        $asm['fuzzy'] = json_decode($asm['fuzzy_json'] ?? 'null', true);
        $asm['rules'] = json_decode($asm['rules_json'] ?? 'null', true) ?: [];
        $asm['recommendations'] = json_decode($asm['recommendations_json'] ?? 'null', true) ?: [];
        $asm['main_contributors'] = $asm['rules'];

        // Retrieve logged symptoms for this assessment
        $symStmt = $pdo->prepare("
            SELECT sli.symptom_id AS id, sli.severity, sli.duration, sli.frequency, sc.name 
            FROM symptom_logs sl
            JOIN symptom_log_items sli ON sli.symptom_log_id = sl.id
            LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id
            WHERE sl.user_id = ? AND ABS(TIMESTAMPDIFF(SECOND, sl.date, ?)) <= 60
            ORDER BY sli.id ASC
        ");
        $symStmt->execute([$u['id'], $asm['date']]);
        $asm['logged_symptoms'] = $symStmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch present pregnancy problems if any
        $ppStmt = $pdo->prepare("
            SELECT * FROM pregnancy_problems
            WHERE user_id = ? AND ABS(TIMESTAMPDIFF(SECOND, date, ?)) <= 60
            LIMIT 1
        ");
        $ppStmt->execute([$u['id'], $asm['date']]);
        $ppRow = $ppStmt->fetch(PDO::FETCH_ASSOC);
        $activePP = [];
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
            ];
            foreach ($ppLabels as $k => $label) {
                if (!empty($ppRow[$k])) {
                    $activePP[] = $label;
                }
            }
        }
        $asm['pregnancy_problems'] = $activePP;

        unset($asm['ahp_json'], $asm['fuzzy_json'], $asm['rules_json'], $asm['recommendations_json']);
    }

    // Retrieve latest Coopland assessments history and current evaluation
    $cStmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 10");
    $cStmt->execute([$u['id']]);
    $coopHistory = $cStmt->fetchAll();

    if (!empty($coopHistory)) {
        $firstCoop = $coopHistory[0];
        $factorsDecoded = json_decode($firstCoop['factors_json'] ?? '[]', true);
        $cooplandLatest = [
            'id' => $firstCoop['id'],
            'coopland_score' => (int)$firstCoop['score'],
            'coopland_risk' => ucfirst(strtolower($firstCoop['risk_level'])),
            'date' => $firstCoop['date'],
            'contributing_factors' => $factorsDecoded,
            'factors' => $factorsDecoded,
        ];
    } else {
        $cooplandLatest = evaluate_coopland($u['id'], $pdo, [], []);
        $coopHistory = [];
        if ($cooplandLatest) {
            $coopHistory = [
                [
                    'id' => $cooplandLatest['id'] ?? 'ca-init',
                    'user_id' => $u['id'],
                    'date' => now_iso(),
                    'score' => $cooplandLatest['coopland_score'],
                    'risk_level' => $cooplandLatest['coopland_risk'],
                    'factors_json' => json_encode($cooplandLatest['contributing_factors'] ?? []),
                ]
            ];
        }
    }

    $clinicalAlertsLatest = evaluate_clinical_alerts($u['id'], $pdo, [], $latestVitals);

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
        'coopland' => $cooplandLatest,
        'coopland_history' => $coopHistory,
        'clinical_alerts' => $clinicalAlertsLatest,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = get_json_input();

    // 1. Validate inputs per RULES.docx Rule 24
    $validationErrors = validate_maternal_inputs($input);
    if (!empty($validationErrors)) {
        json_error('Validation failed', 422, ['errors' => $validationErrors]);
    }

    $submittedSymptoms = $input['symptoms'] ?? [];
    $submittedPP = $input['pregnancy_problems'] ?? ($input['pp'] ?? []);

    // 2. Save symptom log
    $logId = uid('sym');
    $pdo->prepare("INSERT INTO symptom_logs (id, user_id, date) VALUES (?,?,?)")->execute([$logId, $u['id'], now_iso()]);

    $normalizedSymptoms = [];
    $symptomIntensities = $input['symptom_intensities'] ?? [];

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
        $intensity = isset($symptomIntensities[$sid])
            ? (float)$symptomIntensities[$sid]
            : severity_label_to_intensity($severity);

        $symptomIntensities[$sid] = $intensity;

        if ($severity !== 'None' || $intensity > 0) {
            $pdo->prepare("INSERT INTO symptom_log_items (id, symptom_log_id, symptom_id, severity, duration, frequency) VALUES (?,?,?,?,?,?)")
                ->execute([uid('sli'), $logId, $sid, $severity, $duration, $frequency]);
        }

        $normalizedSymptoms[] = [
            'id' => $sid,
            'severity' => $severity,
            'duration' => $duration,
            'frequency' => $frequency,
        ];
    }

    // 3. Save Present Pregnancy Problems (PP)
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

    // 4. Retrieve latest vitals, patient profile, and risk history
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id']]);
    $vitals = $stmt->fetch() ?: [];

    // Optional override with incoming vitals in payload
    $bpSys = isset($input['bp_sys']) ? (int)$input['bp_sys'] : ($vitals['bp_sys'] ?? 118);
    $bpDia = isset($input['bp_dia']) ? (int)$input['bp_dia'] : ($vitals['bp_dia'] ?? 76);
    $tempVal = isset($input['temp']) ? (float)$input['temp'] : ($vitals['temp'] ?? 36.8);
    $hrVal = isset($input['heart_rate']) ? (int)$input['heart_rate'] : ($vitals['heart_rate'] ?? 78);
    $sugarVal = isset($input['blood_sugar']) ? (int)$input['blood_sugar'] : ($vitals['blood_sugar'] ?? 95);
    $sugarTiming = $input['glucose_timing'] ?? 'preprandial';

    if (isset($input['bp_sys']) || isset($input['temp']) || isset($input['blood_sugar'])) {
        $pdo->prepare("INSERT INTO monitoring (id, user_id, date, bp_sys, bp_dia, temp, heart_rate, blood_sugar) VALUES (?,?,?,?,?,?,?,?)")
            ->execute([uid('mon'), $u['id'], now_iso(), $bpSys, $bpDia, $tempVal, $hrVal, $sugarVal]);
    }

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

    $swollenLocs = isset($input['swollen_locations']) && is_array($input['swollen_locations']) ? $input['swollen_locations'] : [];
    $swollenCount = count($swollenLocs);

    $engineInput = [
        'user_id' => $u['id'],
        'age' => (int)$age,
        'trimester' => $trimester,
        'bp_sys' => $bpSys,
        'bp_dia' => $bpDia,
        'temp' => $tempVal,
        'heart_rate' => $hrVal,
        'blood_sugar' => $sugarVal,
        'glucose_timing' => $sugarTiming,
        'bmi' => $bmi,
        'hemoglobin' => $hemoglobin,
        'riskHistory' => $riskHistory,
        'pregnancyProblems' => $pp,
        'symptoms' => $normalizedSymptoms,
        'symptom_intensities' => $symptomIntensities,
        'swollen_locations' => $swollenLocs,
        'swollen_locations_count' => $swollenCount,
        'fever_with_chills' => !empty($input['fever_with_chills']),
        'fever_with_sweating' => !empty($input['fever_with_sweating']),
        'breathing_difficulty' => !empty($input['breathing_difficulty']),
        'breathing_with_sound' => !empty($input['breathing_with_sound']),
        'belly_pain_with_hard_abdomen' => !empty($input['belly_pain_with_hard_abdomen']),
        'belly_pain_with_bleeding' => !empty($input['belly_pain_with_bleeding']),
        'loss_of_vaginal_fluid' => !empty($input['loss_of_vaginal_fluid']),
        'decreased_fetal_movement' => !empty($input['decreased_fetal_movement']),
        'discomfort_during_urination' => !empty($input['discomfort_during_urination']),
        'one_sided_leg_swelling' => !empty($input['one_sided_leg_swelling']),
        'diabetes_symptoms_count' => (int)($input['diabetes_symptoms_count'] ?? 0),
        'preeclampsia_symptoms_count' => (int)($input['preeclampsia_symptoms_count'] ?? 0),
        'belly_pain_symptoms_count' => (int)($input['belly_pain_symptoms_count'] ?? 0),
    ];

    // 5. Run Fuzzy Decision Support Engine
    $ruleBase = get_rule_base();
    $result = assess_risk($engineInput, $ruleBase, $catalog, $pdo);

    // --- Trimester Calculation ---
    $stmtProfile = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmtProfile->execute([$u['id']]);
    $profileData = $stmtProfile->fetch();
    
    $weeksPregnant = 32; // Default
    if (!empty($profileData['lmp'])) {
        $diffSecs = time() - strtotime($profileData['lmp']);
        if ($diffSecs >= 0) {
            $weeksPregnant = (int)floor(($diffSecs / 86400) / 7);
        }
    } elseif (!empty($profileData['edd'])) {
        $daysToEdd = (int)ceil((strtotime($profileData['edd']) - time()) / 86400);
        $weeksPregnant = (int)floor(max(0, 280 - $daysToEdd) / 7);
    }
    $trimester = $weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3);
    
    // --- New Modules Integration ---
    // Calculate Coopland without saving automatically ($save = false)
    $cooplandResult = evaluate_coopland($u['id'], $pdo, $normalizedSymptoms, $pp, false);
    $clinicalAlerts = evaluate_clinical_alerts($u['id'], $pdo, $engineInput, $vitals);
    
    $isCooplandSubmission = isset($input['coopland_score'])
        || isset($input['coopland_risk'])
        || isset($input['score'])
        || !empty($input['matched_factors'])
        || ($input['source'] ?? '') === 'coopland'
        || ($input['action'] ?? '') === 'coopland';

    if ($isCooplandSubmission) {
        $coopScore = isset($input['coopland_score']) 
            ? (int)$input['coopland_score'] 
            : (isset($input['score']) ? (int)$input['score'] : (int)($cooplandResult['coopland_score'] ?? 0));
        
        $rawLvl = $input['coopland_risk'] 
            ?? ($input['risk_level'] 
            ?? ($input['level'] 
            ?? ($coopScore >= 7 ? 'Severe' : ($coopScore >= 3 ? 'High' : 'Low'))));
        
        $coopRisk = ucfirst(strtolower($rawLvl));
        if ($coopRisk === 'Moderate') $coopRisk = 'High';
        
        $coopFactors = !empty($input['matched_factors']) 
            ? $input['matched_factors'] 
            : ($cooplandResult['contributing_factors'] ?? []);

        // Explicitly persist into coopland_assessments
        $coopId = 'ca-' . uniqid();
        $cStmt = $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, NOW(), ?, ?, ?)");
        $cStmt->execute([
            $coopId,
            $u['id'],
            $coopScore,
            $coopRisk,
            json_encode($coopFactors)
        ]);

        $cooplandResult = [
            'id' => $coopId,
            'coopland_score' => $coopScore,
            'coopland_risk' => $coopRisk,
            'contributing_factors' => $coopFactors
        ];

        // Insert notification according to Coopland risk level
        $notifId = uid('ntf');
        if ($coopRisk === 'Severe') {
            $notifTitle = '🚨 Urgent: Severe Maternal Risk Detected';
            $notifBody = "Your Coopland risk score is {$coopScore} (Severe Risk). Immediate medical evaluation by an obstetrician or at a hospital triage is required.";
            $notifKind = 'severe_risk_alert';
        } elseif ($coopRisk === 'High') {
            $notifTitle = '⚠️ Maternal Risk Alert: High Risk';
            $notifBody = "Your Coopland risk score is {$coopScore} (High Risk). Please schedule an OB-GYN checkup within 24 to 48 hours.";
            $notifKind = 'high_risk_alert';
        } else {
            $notifTitle = '✅ Risk Assessment Recorded: Low Risk';
            $notifBody = "Your Coopland risk score is {$coopScore} (Low Risk). Continue your routine prenatal checkup schedule.";
            $notifKind = 'low_risk_assessment';
        }

        try {
            $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
                ->execute([$notifId, $u['id'], $notifTitle, $notifBody, now_iso(), $notifKind]);
        } catch (Exception $e) {}

        $recs = generate_recommendations($cooplandResult, $clinicalAlerts, $trimester);
        $cooplandRecs = $recs;
        $result['score'] = $coopScore;
        $result['level'] = $coopRisk;
        $result['risk_level'] = $coopRisk;
    } else {
        // Submit symptoms uses critical recommendations, NOT risk recommendations
        $recs = !empty($clinicalAlerts['recommendations']) ? $clinicalAlerts['recommendations'] : [];
        if (empty($recs) || ($recs[0] ?? '') === 'Continue routine monitoring. Report any new or worsening symptoms to your healthcare provider.') {
            $hasAnySymptoms = false;
            foreach ($normalizedSymptoms as $ns) {
                if (($ns['severity'] ?? 'None') !== 'None') {
                    $hasAnySymptoms = true;
                    break;
                }
            }
            if (!$hasAnySymptoms) {
                $recs = ['No active critical symptoms reported. Continue monitoring and report any sudden headache, bleeding, vision changes, or fluid leakage immediately.'];
            }
        }

        // Maintain the active maternal risk classification from Coopland
        $stmtActiveCoop = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1");
        $stmtActiveCoop->execute([$u['id']]);
        $activeCoop = $stmtActiveCoop->fetch();
        if ($activeCoop) {
            $result['level'] = ucfirst(strtolower($activeCoop['risk_level']));
            $result['risk_level'] = ucfirst(strtolower($activeCoop['risk_level']));
            $result['score'] = (int)$activeCoop['score'];
            $cooplandResult = [
                'id' => $activeCoop['id'],
                'coopland_score' => (int)$activeCoop['score'],
                'coopland_risk' => ucfirst(strtolower($activeCoop['risk_level'])),
                'contributing_factors' => json_decode($activeCoop['factors_json'] ?? '[]', true)
            ];
        }
        $cooplandRecs = generate_recommendations($cooplandResult, $clinicalAlerts, $trimester);
    }
    
    $result['recommendations'] = $recs;
    $result['coopland'] = $cooplandResult;
    $result['clinical_alerts'] = $clinicalAlerts;
    // -------------------------------

    // 6. Persist Assessment with unified recommendations
    $asmId = uid('asm');
    $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            $asmId, $u['id'], now_iso(), $result['score'], $result['level'],
            $result['structural']['total'] ?? 0, $result['fuzzy']['centroid'] ?? 0,
            json_encode($result['structural'] ?? []), json_encode($result['fuzzy'] ?? []),
            json_encode($result['main_contributors'] ?? []), json_encode($result['recommendations']),
        ]);

    // Format logged symptoms with catalog names for immediate response
    $returnedLoggedSymptoms = [];
    $catMap = [];
    foreach ($catalog as $catItem) {
        $catMap[$catItem['id']] = $catItem['name'];
    }
    foreach ($normalizedSymptoms as $ns) {
        if (($ns['severity'] ?? 'None') !== 'None') {
            $returnedLoggedSymptoms[] = [
                'id' => $ns['id'],
                'name' => $catMap[$ns['id']] ?? ucwords(str_replace('_', ' ', $ns['id'])),
                'severity' => $ns['severity'],
                'duration' => $ns['duration'] ?? 'Today',
                'frequency' => $ns['frequency'] ?? 'Rare'
            ];
        }
    }

    json_success([
        'assessmentId' => $asmId,
        'score' => $result['score'],
        'level' => $result['level'],
        'risk_level' => $result['risk_level'],
        'overall_severity' => $result['overall_severity'],
        'alert_type' => $result['alert_type'],
        'override_applied' => $result['override_applied'],
        'structural' => $result['structural'],
        'fuzzy' => $result['fuzzy'],
        'main_contributors' => $result['main_contributors'],
        'progression' => $result['progression'],
        'recommendations' => $result['recommendations'],
        'generatedAt' => $result['generatedAt'],
        
        // Return separated new engine results alongside existing fuzzy logic
        'coopland' => $cooplandResult,
        'clinical_alerts' => $clinicalAlerts,
        'coopland_recommendations' => $cooplandRecs,
        'logged_symptoms' => $returnedLoggedSymptoms
    ], 'Fuzzy risk assessment completed successfully', 201);
}

json_error('Method not allowed', 405);
