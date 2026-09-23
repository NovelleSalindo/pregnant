<?php
require_once __DIR__ . '/base.php';

function evaluate_coopland($user_id, $pdo, $symptoms = [], $pregnancy_problems = [], $save = true) {
    // 1. Fetch patient profile
    $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $profile = $stmt->fetch();
    
    if (!$profile) return null;

    // We also need risk_history
    $stmt = $pdo->prepare("SELECT * FROM risk_history WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $risk = $stmt->fetch();
    if (!$risk) $risk = [];

    $score = 0;
    $matched_factors = [];
    
    // REPRODUCTIVE HISTORY
    // 1. Age <= 16 = +1
    if (($profile['age'] ?? 25) <= 16) { $score += 1; $matched_factors[] = 'Age <= 16 (+1)'; }
    // 2. Age > 35 = +2
    elseif (($profile['age'] ?? 25) > 35) { $score += 2; $matched_factors[] = 'Age > 35 (+2)'; }
    
    // 3. Parity = 0 = +1
    $parity = $risk['parity'] ?? max(0, ($profile['gravida'] ?? 1) - 1);
    if ($parity == 0) { $score += 1; $matched_factors[] = 'Parity = 0 (+1)'; }
    // 4. Parity > 4 = +2
    elseif ($parity > 4) { $score += 2; $matched_factors[] = 'Parity > 4 (+2)'; }
    
    // 5. Two or more abortions = +1 (we have prior_abortions_or_infertility in risk_history)
    // 6. Infertility history = +1
    // We combine these as they are stored together in risk_history (prior_abortions_or_infertility), or if profile has prior_miscarriage
    if (!empty($risk['prior_abortions_or_infertility']) || !empty($profile['prior_miscarriage'])) { 
        $score += 1; $matched_factors[] = 'Prior Abortions / Infertility (+1)'; 
    }
    
    // 7. Previous postpartum bleeding = +1
    if (!empty($risk['prev_pp_hemorrhage'])) { $score += 1; $matched_factors[] = 'Previous Postpartum Bleeding (+1)'; }
    // 8. Manual removal of placenta = +1
    if (!empty($risk['prev_manual_placenta_removal'])) { $score += 1; $matched_factors[] = 'Manual Removal of Placenta (+1)'; }
    // 9. Previous baby >9 lbs = +1
    if (!empty($risk['prev_baby_over_9lb'])) { $score += 1; $matched_factors[] = 'Previous Baby >9 lbs (+1)'; }
    // 10. Previous toxemia/HPN = +1
    if (!empty($risk['prev_toxemia_hpn']) || strpos(strtolower($profile['conditions'] ?? ''), 'preeclampsia') !== false) { 
        $score += 1; $matched_factors[] = 'Previous Toxemia/HPN (+1)'; 
    }
    // 11. Previous Cesarean Section = +2
    if (!empty($risk['prev_cesarean']) || !empty($profile['prior_csection'])) { $score += 2; $matched_factors[] = 'Previous Cesarean Section (+2)'; }
    // 12. Previous abnormal/difficult labor = +2
    if (!empty($risk['prev_abnormal_labor'])) { $score += 2; $matched_factors[] = 'Previous Abnormal Labor (+2)'; }

    // MEDICAL/SURGICAL HISTORY
    // 13. Previous gynecologic condition = +1
    if (!empty($risk['prev_gyn_disease'])) { $score += 1; $matched_factors[] = 'Previous Gynecologic Condition (+1)'; }
    // 14. Chronic renal disease = +1
    if (!empty($risk['chronic_renal_disease'])) { $score += 1; $matched_factors[] = 'Chronic Renal Disease (+1)'; }
    // 15. Gestational diabetes = +1
    if (!empty($risk['gestational_diabetes']) && empty($risk['class_b_diabetes_or_higher'])) { 
        $score += 1; $matched_factors[] = 'Gestational Diabetes (+1)'; 
    }
    // 16. Diabetes Class B or higher = +3
    if (!empty($risk['class_b_diabetes_or_higher']) || strpos(strtolower($profile['conditions'] ?? ''), 'diabetes') !== false) { 
        $score += 3; $matched_factors[] = 'Diabetes Class B or higher (+3)'; 
    }
    // 17. Cardiac disease = +3
    if (!empty($risk['cardiac_disease']) || strpos(strtolower($profile['conditions'] ?? ''), 'cardiac') !== false) { 
        $score += 3; $matched_factors[] = 'Cardiac Disease (+3)'; 
    }
    // 18. Asthma = +1
    if (!empty($risk['asthma'])) { $score += 1; $matched_factors[] = 'Asthma (+1)'; }
    // 19. Tuberculosis = +1
    if (!empty($risk['tuberculosis'])) { $score += 1; $matched_factors[] = 'Tuberculosis (+1)'; }
    // 20. Pulmonary embolism = +3
    if (!empty($risk['pulmonary_embolism'])) { $score += 3; $matched_factors[] = 'Pulmonary Embolism (+3)'; }
    // 21. Hyperthyroidism = +1
    if (!empty($risk['hyperthyroidism'])) { $score += 1; $matched_factors[] = 'Hyperthyroidism (+1)'; }
    // 22. Hypothyroidism = +2
    if (!empty($risk['hypothyroidism'])) { $score += 2; $matched_factors[] = 'Hypothyroidism (+2)'; }
    // 23. Epilepsy = +1
    if (!empty($risk['epilepsy'])) { $score += 1; $matched_factors[] = 'Epilepsy (+1)'; }
    // 24. TORCH infection = +2
    if (!empty($risk['torch_infection'])) { $score += 2; $matched_factors[] = 'TORCH Infection (+2)'; }
    // 25. Pyelonephritis/UTI = +2
    if (!empty($risk['pyelonephritis_uti'])) { $score += 2; $matched_factors[] = 'Pyelonephritis / UTI (+2)'; }

    // PRESENT PREGNANCY
    // We also check acute symptoms
    $hasVaginalBleeding = false;
    if (!empty($symptoms)) {
        foreach ($symptoms as $sym) {
            $sid = strtolower($sym['id'] ?? $sym['name'] ?? '');
            if ($sid === 'vaginal_bleeding' || $sid === 'bleeding') {
                $hasVaginalBleeding = true;
            }
        }
    }
    
    // Determine bleeding < or > 20 weeks based on PP or active symptoms + gestational age
    $bleeding_lt_20 = !empty($pregnancy_problems['bleeding_lt_20wks']);
    $bleeding_gt_20 = !empty($pregnancy_problems['bleeding_gt_20wks']);
    
    // If they have the acute symptom but didn't check the box, infer by LMP
    if ($hasVaginalBleeding && !$bleeding_lt_20 && !$bleeding_gt_20) {
        $weeks = 0;
        if (!empty($profile['lmp'])) {
            $weeks = floor((time() - strtotime($profile['lmp'])) / (7*86400));
        }
        if ($weeks < 20) { $bleeding_lt_20 = true; } else { $bleeding_gt_20 = true; }
    }
    
    // 26. Vaginal bleeding before 20 weeks = +1 (per hospital form)
    if ($bleeding_lt_20) { $score += 1; $matched_factors[] = 'Bleeding <20 weeks (+1)'; }
    // 27. Vaginal bleeding after 20 weeks = +3 (per hospital form)
    if ($bleeding_gt_20) { $score += 3; $matched_factors[] = 'Bleeding >20 weeks (+3)'; }
    
    // 28. Hemoglobin <10 g/dL = +1
    if (!empty($pregnancy_problems['anemia'])) { $score += 1; $matched_factors[] = 'Hemoglobin <10 g/dL / Anemia (+1)'; }
    
    // 29. Prematurity/Postmaturity = +1
    if (!empty($pregnancy_problems['postmaturity_prematurity'])) { $score += 1; $matched_factors[] = 'Prematurity / Postmaturity (+1)'; }
    
    // 30. Hypertension = +2
    if (!empty($pregnancy_problems['hypertension']) || strpos(strtolower($profile['conditions'] ?? ''), 'hypertension') !== false) { 
        $score += 2; $matched_factors[] = 'Hypertension (Present Pregnancy) (+2)'; 
    }
    
    // 31. PROM = +1
    if (!empty($pregnancy_problems['prom'])) { $score += 1; $matched_factors[] = 'PROM (+1)'; }
    
    // 32. Polyhydramnios/Oligohydramnios = +1
    if (!empty($pregnancy_problems['poly_oligohydramnios'])) { $score += 1; $matched_factors[] = 'Polyhydramnios / Oligohydramnios (+1)'; }
    
    // 33. IUGR = +1
    if (!empty($pregnancy_problems['iugr'])) { $score += 1; $matched_factors[] = 'IUGR (+1)'; }
    
    // 34. Multiple pregnancy = +1
    if (!empty($pregnancy_problems['multiple_pregnancy'])) { $score += 1; $matched_factors[] = 'Multiple Pregnancy (+1)'; }
    
    // 35. Breech/Malpresentation = +1
    if (!empty($pregnancy_problems['breech_malpresentation'])) { $score += 1; $matched_factors[] = 'Breech / Malpresentation (+1)'; }
    
    // 36. Rh isoimmunization = +3
    if (!empty($pregnancy_problems['rh_isoimmunization'])) { $score += 3; $matched_factors[] = 'Rh isoimmunization (+3)'; }

    // Classify Risk (per hospital Coopland form: Low 0-2, High 3-6, Severe >= 7)
    $risk_level = 'Low';
    if ($score >= 3 && $score <= 6) { $risk_level = 'High'; }
    elseif ($score >= 7) { $risk_level = 'Severe'; }
    
    // Save Assessment if requested
    $assessment_id = 'ca-' . uniqid();
    if ($save) {
        $stmt = $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, NOW(), ?, ?, ?)");
        $stmt->execute([
            $assessment_id,
            $user_id,
            $score,
            $risk_level,
            json_encode($matched_factors)
        ]);
    }
    
    return [
        'id' => $assessment_id,
        'coopland_score' => $score,
        'coopland_risk' => $risk_level,
        'contributing_factors' => $matched_factors
    ];
}
