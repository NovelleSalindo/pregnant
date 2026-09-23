<?php
/**
 * PREGNACARE - Rule-Based Risk Monitoring & Personalized Recommendation Engine
 * File: pregnacare_engine.php
 */

declare(strict_types=1);

// ============================================================================
// 1. INPUT FORM VALIDATION (Programmatic Bounds)
// ============================================================================

/**
 * Validates physical bounds to reject corrupted/invalid form submissions.
 *
 * @param array $vitals
 * @return array
 */
function validateVitalsInput(array $vitals): array {
    $temp    = $vitals['temp'] ?? 37.0;
    $sysBp   = $vitals['sys_bp'] ?? 120;
    $diaBp   = $vitals['dia_bp'] ?? 80;
    $hr      = $vitals['hr'] ?? 70;
    $glucose = $vitals['glucose'] ?? 90;

    if ($temp < 34.0 || $temp > 43.0) {
        return ['isValid' => false, 'message' => "Temperature must be between 34°C and 43°C."];
    }
    if ($sysBp < 60 || $sysBp > 220) {
        return ['isValid' => false, 'message' => "Systolic BP must be between 60 and 220 mmHg."];
    }
    if ($diaBp < 30 || $diaBp > 140) {
        return ['isValid' => false, 'message' => "Diastolic BP must be between 30 and 140 mmHg."];
    }
    if ($hr < 40 || $hr > 180) {
        return ['isValid' => false, 'message' => "Heart rate must be between 40 and 180 bpm."];
    }
    if ($glucose < 30 || $glucose > 500) {
        return ['isValid' => false, 'message' => "Blood glucose must be between 30 and 500 mg/dL."];
    }

    return ['isValid' => true, 'message' => "Valid"];
}

// ============================================================================
// 2. FEATURE CLASSIFICATION (Sets & Ranges)
// ============================================================================

/**
 * Classifies continuous demographic variables into discrete sets.
 *
 * @param array $demographics
 * @return array
 */
function classifyDemographicSets(array $demographics): array {
    $age      = $demographics['age'] ?? 25;
    $bmi      = $demographics['bmi'] ?? 22.0;
    $interval = $demographics['pregnancy_interval_years'] ?? 3.0;

    // Maternal Age Set
    if ($age < 18) {
        $ageSet = "Lower";
    } elseif ($age >= 18 && $age <= 35) {
        $ageSet = "Normal";
    } else {
        $ageSet = "Higher";
    }

    // BMI Set
    if ($bmi < 19.0) {
        $bmiSet = "Lower";
    } elseif ($bmi >= 19.0 && $bmi <= 25.0) {
        $bmiSet = "Normal";
    } else {
        $bmiSet = "Higher";
    }

    // Inter-Pregnancy Interval Set
    if ($interval < 2.0) {
        $intervalSet = "Lower";
    } elseif ($interval >= 2.0 && $interval <= 10.0) {
        $intervalSet = "Normal";
    } else {
        $intervalSet = "Higher";
    }

    return [
        'age_set'      => $ageSet,
        'bmi_set'      => $bmiSet,
        'interval_set' => $intervalSet
    ];
}

// ============================================================================
// 3. CUMULATIVE CLINICAL RISK SCORING
// ============================================================================

/**
 * Calculates total additive risk score across Reproductive History (RH),
 * Medical Conditions (MC), and Present Pregnancy (PP) rules.
 *
 * @param array $medicalHistory
 * @param array $presentPregnancy
 * @return int
 */
/**
 * Evaluates the full Coopland High-Risk Evaluation Form (Mayor Hilarion A. Ramiro Sr. Medical Center).
 * Returns column totals for Reproductive History (RH), Medical/Surgical Conditions (MC), 
 * and Present Pregnancy (PP), along with total score, active item hits, and Coopland classification.
 *
 * @param array $medicalHistory
 * @param array $presentPregnancy
 * @return array
 */
function evaluateCooplandForm(array $medicalHistory, array $presentPregnancy): array {
    $rhScore = 0;
    $mcScore = 0;
    $ppScore = 0;
    $items   = [];

    // =========================================================================
    // COLUMN 1: REPRODUCTIVE HISTORY (RH)
    // =========================================================================
    $age    = (int)($medicalHistory['maternal_age'] ?? $medicalHistory['age'] ?? 25);
    $parity = (int)($medicalHistory['parity'] ?? 1);

    // Age: <16 (1 pt), 16-35 (0 pt), >35 (2 pts)
    if ($age < 16) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Age < 16', 'points' => 1];
    } elseif ($age > 35) {
        $rhScore += 2;
        $items[] = ['cat' => 'RH', 'label' => 'Age > 35', 'points' => 2];
    }

    // Parity: 0 (1 pt), 1-4 (0 pt), >4 (2 pts)
    if ($parity === 0) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Parity 0 (First Pregnancy)', 'points' => 1];
    } elseif ($parity > 4) {
        $rhScore += 2;
        $items[] = ['cat' => 'RH', 'label' => 'Parity > 4 (Grand Multiparity)', 'points' => 2];
    }

    // Abortions >= 2 / Infertility hx (1 pt)
    if (($medicalHistory['abortions'] ?? 0) >= 2 || !empty($medicalHistory['infertility_history']) || !empty($medicalHistory['prior_abortions_or_infertility'])) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Abortions ≥ 2 / Infertility hx', 'points' => 1];
    }

    // Postpartum Bleeding (1 pt)
    if (!empty($medicalHistory['previous_postpartum_bleeding']) || !empty($medicalHistory['prev_pp_hemorrhage'])) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Postpartum Bleeding (PPH)', 'points' => 1];
    }

    // Manual removal of placenta (1 pt)
    if (!empty($medicalHistory['manual_removal_of_placenta']) || !empty($medicalHistory['prev_manual_placenta_removal'])) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Manual Removal of Placenta', 'points' => 1];
    }

    // Previous Pregnancy:
    // > 9 lbs. (1 pt)
    $prevBabyWeight = (float)($medicalHistory['previous_baby_weight_lbs'] ?? $medicalHistory['prev_baby_weight_lbs'] ?? 0);
    if ($prevBabyWeight > 9.0 || !empty($medicalHistory['prev_baby_over_9lb'])) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Previous Baby > 9 lbs.', 'points' => 1];
    }
    // < 5 lbs. 8 oz (1 pt)
    if (!empty($medicalHistory['prev_baby_under_5lb8oz']) || (!empty($medicalHistory['previous_baby_under_5lb8oz'])) || ($prevBabyWeight > 0 && $prevBabyWeight < 5.5)) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Previous Baby < 5 lbs. 8 oz (Low Birth Weight)', 'points' => 1];
    }
    // Toxemia or HPN (1 pt)
    if (!empty($medicalHistory['previous_toxemia_or_hpn']) || !empty($medicalHistory['prev_toxemia_hpn'])) {
        $rhScore += 1;
        $items[] = ['cat' => 'RH', 'label' => 'Previous Toxemia or HPN', 'points' => 1];
    }
    // Previous CS (2 pts)
    if (!empty($medicalHistory['previous_cesarean']) || !empty($medicalHistory['prev_cesarean'])) {
        $rhScore += 2;
        $items[] = ['cat' => 'RH', 'label' => 'Previous Cesarean Section (CS)', 'points' => 2];
    }
    // Abnormal / Difficult Labor (2 pts)
    if (!empty($medicalHistory['previous_abnormal_difficult_labor']) || !empty($medicalHistory['prev_abnormal_labor'])) {
        $rhScore += 2;
        $items[] = ['cat' => 'RH', 'label' => 'Abnormal / Difficult Labor', 'points' => 2];
    }

    // =========================================================================
    // COLUMN 2: MEDICAL / SURGICAL CONDITION (MC)
    // =========================================================================
    // Previous Gyne (1 pt)
    if (!empty($medicalHistory['previous_gynecological_disease']) || !empty($medicalHistory['prev_gyn_disease'])) {
        $mcScore += 1;
        $items[] = ['cat' => 'MC', 'label' => 'Previous Gyne Disease / Surgery', 'points' => 1];
    }

    // Chronic Renal Dse (1 pt)
    if (!empty($medicalHistory['chronic_renal_disease'])) {
        $mcScore += 1;
        $items[] = ['cat' => 'MC', 'label' => 'Chronic Renal Disease', 'points' => 1];
    }

    // Gestational Diabetes (A) (1 pt)
    if (!empty($medicalHistory['gestational_diabetes'])) {
        $mcScore += 1;
        $items[] = ['cat' => 'MC', 'label' => 'Gestational Diabetes (Class A)', 'points' => 1];
    }

    // Class B Diabetes or Higher (3 pts)
    if (!empty($medicalHistory['class_b_diabetes_or_higher'])) {
        $mcScore += 3;
        $items[] = ['cat' => 'MC', 'label' => 'Class B Diabetes or Higher', 'points' => 3];
    }

    // Cardiac Disease (3 pts)
    if (!empty($medicalHistory['cardiac_disease'])) {
        $mcScore += 3;
        $items[] = ['cat' => 'MC', 'label' => 'Cardiac Disease', 'points' => 3];
    }

    // Others (Significant) Medical Disease (1 - 5 pts)
    $otherMedScore = (int)($medicalHistory['significant_medical_disease_score'] ?? $medicalHistory['other_significant_disease_score'] ?? 0);
    // Also check explicit medical complications if present
    if (!empty($medicalHistory['pulmonary_embolism'])) { $otherMedScore = max($otherMedScore, 3); }
    elseif (!empty($medicalHistory['asthma']) || !empty($medicalHistory['tuberculosis'])) { $otherMedScore = max($otherMedScore, 1); }
    if (!empty($medicalHistory['hyperthyroidism_medication'])) { $otherMedScore = max($otherMedScore, 3); }
    elseif (!empty($medicalHistory['hyperthyroidism_history'])) { $otherMedScore = max($otherMedScore, 2); }
    if (!empty($medicalHistory['collagen_vascular_active'])) { $otherMedScore = max($otherMedScore, 3); }
    elseif (!empty($medicalHistory['collagen_vascular_controlled'])) { $otherMedScore = max($otherMedScore, 2); }
    elseif (!empty($medicalHistory['collagen_vascular_remission'])) { $otherMedScore = max($otherMedScore, 1); }
    if (!empty($medicalHistory['severe_systemic_infection'])) { $otherMedScore = max($otherMedScore, 3); }
    elseif (!empty($medicalHistory['torch_infection']) || !empty($medicalHistory['pyelonephritis_uti'])) { $otherMedScore = max($otherMedScore, 2); }
    if (!empty($medicalHistory['epilepsy_medication'])) { $otherMedScore = max($otherMedScore, 2); }
    elseif (!empty($medicalHistory['epilepsy_history'])) { $otherMedScore = max($otherMedScore, 1); }

    $otherMedScore = max(0, min(5, $otherMedScore));
    if ($otherMedScore > 0) {
        $mcScore += $otherMedScore;
        $items[] = ['cat' => 'MC', 'label' => 'Other Significant Medical Disease', 'points' => $otherMedScore];
    }

    // =========================================================================
    // COLUMN 3: PRESENT PREGNANCY (PP)
    // =========================================================================
    // Bleeding: < 20 wks. (1 pt)
    if (!empty($presentPregnancy['bleeding_less_than_20_weeks']) || !empty($presentPregnancy['bleeding_lt_20wks'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Bleeding < 20 wks.', 'points' => 1];
    }

    // Bleeding: > 20 wks. (3 pts)
    if (!empty($presentPregnancy['bleeding_greater_than_20_weeks']) || !empty($presentPregnancy['bleeding_gt_20wks'])) {
        $ppScore += 3;
        $items[] = ['cat' => 'PP', 'label' => 'Bleeding > 20 weeks', 'points' => 3];
    }

    // Anemia < 10 gm. % (1 pt)
    if (!empty($presentPregnancy['anemia_less_than_10g']) || !empty($presentPregnancy['anemia'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Anemia < 10 gm. %', 'points' => 1];
    }

    // Postmaturity / Prematurity (1 pt)
    if (!empty($presentPregnancy['postmaturity_or_prematurity']) || !empty($presentPregnancy['postmaturity_prematurity'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Postmaturity / Prematurity', 'points' => 1];
    }

    // Hypertension (2 pts)
    if (!empty($presentPregnancy['hypertension'])) {
        $ppScore += 2;
        $items[] = ['cat' => 'PP', 'label' => 'Hypertension', 'points' => 2];
    }

    // Premature Rupture of Membrane (PROM) (1 pt)
    if (!empty($presentPregnancy['premature_rupture_of_membranes']) || !empty($presentPregnancy['prom'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Premature Rupture of Membrane', 'points' => 1];
    }

    // Polyhydramnios / Oligohydramnios (1 pt)
    if (!empty($presentPregnancy['poly_or_oligohydramnios']) || !empty($presentPregnancy['poly_oligohydramnios'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Polyhydramnios / Oligohydramnios', 'points' => 1];
    }

    // IUGR (1 pt)
    if (!empty($presentPregnancy['iugr'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Intrauterine Growth Restriction (IUGR)', 'points' => 1];
    }

    // Multiple pregnancy (1 pt)
    if (!empty($presentPregnancy['multiple_pregnancy'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Multiple Pregnancy', 'points' => 1];
    }

    // Breech / Malpresentation (1 pt)
    if (!empty($presentPregnancy['breech_or_malpresentation']) || !empty($presentPregnancy['breech_malpresentation'])) {
        $ppScore += 1;
        $items[] = ['cat' => 'PP', 'label' => 'Breech / Malpresentation', 'points' => 1];
    }

    // RH isoimmunization (3 pts)
    if (!empty($presentPregnancy['rh_isoimmunization'])) {
        $ppScore += 3;
        $items[] = ['cat' => 'PP', 'label' => 'RH Isoimmunization', 'points' => 3];
    }

    // Total Coopland Score
    $totalScore = $rhScore + $mcScore + $ppScore;

    // Classification according to Coopland High Risk Evaluation Form:
    // Low Risk: 0 - 2
    // High Risk: 3 - 6
    // Severe Risk: > 7 (>= 7)
    $classification = 'Low Risk';
    if ($totalScore >= 7) {
        $classification = 'Severe Risk';
    } elseif ($totalScore >= 3) {
        $classification = 'High Risk';
    }

    return [
        'total_score' => $totalScore,
        'classification' => $classification,
        'rh_score' => $rhScore,
        'mc_score' => $mcScore,
        'pp_score' => $ppScore,
        'categories' => [
            'reproductive_history' => [
                'name' => 'Reproductive History',
                'subtotal' => $rhScore,
                'items' => array_values(array_filter($items, fn($i) => $i['cat'] === 'RH'))
            ],
            'medical_surgical' => [
                'name' => 'Medical / Surgical Condition',
                'subtotal' => $mcScore,
                'items' => array_values(array_filter($items, fn($i) => $i['cat'] === 'MC'))
            ],
            'present_pregnancy' => [
                'name' => 'Present Pregnancy',
                'subtotal' => $ppScore,
                'items' => array_values(array_filter($items, fn($i) => $i['cat'] === 'PP'))
            ],
        ],
        'items' => $items,
    ];
}

/**
 * Calculates the cumulative risk score using the Coopland High-Risk Evaluation Form.
 *
 * @param array $medicalHistory
 * @param array $presentPregnancy
 * @return int
 */
function calculateCumulativeRiskScore(array $medicalHistory, array $presentPregnancy): int {
    $coopland = evaluateCooplandForm($medicalHistory, $presentPregnancy);
    return $coopland['total_score'];
}

// ============================================================================
// 4. BASELINE DEMOGRAPHICS RISK MATRIX
// ============================================================================

/**
 * Evaluates tuple set combinations for baseline socio-demographic risk.
 *
 * @param array $demographics
 * @return string
 */
function evaluateDemographicRiskMatrix(array $demographics): string {
    $classified = classifyDemographicSets($demographics);
    $age      = $classified['age_set'];
    $bmi      = $classified['bmi_set'];
    $interval = $classified['interval_set'];

    // High-Risk Matrix
    if (
        ($age === "Normal" && $bmi === "Higher" && $interval === "Higher") ||
        ($age === "Higher" && $bmi === "Higher" && $interval === "Higher") ||
        ($age === "Lower"  && $bmi === "Higher" && $interval === "Higher") ||
        ($age === "Lower"  && $bmi === "Higher" && $interval === "Lower")  ||
        ($age === "Lower"  && $bmi === "Normal" && $interval === "Higher")
    ) {
        return "High";
    }

    // Moderate-Risk Matrix
    if (
        ($age === "Normal" && $bmi === "Higher" && in_array($interval, ["Normal", "Lower"], true)) ||
        ($age === "Normal" && $bmi === "Lower"  && $interval === "Higher") ||
        ($age === "Higher" && $interval === "Normal" && in_array($bmi, ["Normal", "Higher"], true)) ||
        ($age === "Higher" && $bmi === "Higher" && $interval === "Lower") ||
        ($age === "Higher" && $interval === "Higher" && in_array($bmi, ["Normal", "Lower"], true)) ||
        ($age === "Higher" && $bmi === "Lower"  && $interval === "Lower") ||
        ($age === "Lower"  && $bmi === "Lower"  && $interval === "Lower") ||
        ($age === "Lower"  && $interval === "Normal" && in_array($bmi, ["Normal", "Higher"], true)) ||
        ($age === "Lower"  && $bmi === "Lower"  && $interval === "Higher")
    ) {
        return "Moderate";
    }

    // Low-Risk Matrix (Default fallback)
    return "Low";
}

// ============================================================================
// 5. REAL-TIME ALERT EVALUATION
// ============================================================================

/**
 * Evaluates real-time symptoms & vitals to assign Red, Yellow, or Green alert levels.
 *
 * @param array $vitals
 * @param array $symptoms
 * @return string
 */
function processMaternalVitalsAndSymptoms(array $vitals, array $symptoms): string {
    $sysBp    = $vitals['sys_bp'] ?? 0;
    $diaBp    = $vitals['dia_bp'] ?? 0;
    $temp     = $vitals['temp'] ?? 0.0;
    $hr       = $vitals['hr'] ?? 0;
    $timing   = $vitals['timing'] ?? '';
    $glucose  = $vitals['glucose'] ?? 0;

    $preeclampsiaCount = $symptoms['preeclampsia_symptoms_count'] ?? 0;
    $swollenCount      = $symptoms['swollen_locations_count'] ?? 0;
    $headacheIntensity = $symptoms['headache_intensity'] ?? 0;
    $bellyPainIntensity= $symptoms['belly_pain_intensity'] ?? 0;
    $bellyPainCount    = $symptoms['belly_pain_symptoms_count'] ?? 0;
    $diabetesCount     = $symptoms['diabetes_symptoms_count'] ?? 0;
    $bleedingIntensity = $symptoms['vaginal_bleeding_intensity'] ?? 0;

    // 1. Red Alert Check
    if (
        !($sysBp >= 110 && $sysBp <= 130) ||
        !($diaBp >= 75 && $diaBp <= 85) ||
        $temp >= 38.0 ||
        !($hr >= 60 && $hr <= 100) ||
        ($timing === 'preprandial' && ($glucose < 70 || $glucose > 120)) ||
        ($timing === 'postprandial' && $glucose > 180) ||
        !empty($symptoms['fever_chills']) || !empty($symptoms['fever_sweating']) ||
        !empty($symptoms['breathing_diff']) || !empty($symptoms['breathing_sound']) ||
        $headacheIntensity >= 6 ||
        $swollenCount >= 4 ||
        !empty($symptoms['belly_pain_hard_abdomen']) || !empty($symptoms['belly_pain_bleeding']) ||
        $bellyPainIntensity > 6 ||
        !empty($symptoms['loss_vaginal_fluid']) || !empty($symptoms['decreased_fetal_movement']) ||
        $diabetesCount >= 4
    ) {
        return "Red_Alert";
    }

    // 2. Yellow Alert Check
    if (
        $preeclampsiaCount >= 2 ||
        in_array($swollenCount, [2, 3], true) ||
        (!empty($symptoms['headache_symptoms']) && $headacheIntensity < 6) ||
        $bleedingIntensity > 0 ||
        !empty($symptoms['discomfort_urination']) ||
        ($bellyPainCount >= 3 && $bellyPainIntensity < 6) ||
        ($diabetesCount >= 1 && $diabetesCount <= 3)
    ) {
        return "Yellow_Alert";
    }

    // 3. Green Alert Fallback
    return "Green_Alert";
}

// ============================================================================
// 6. OVERALL RISK STATUS SYNTHESIS
// ============================================================================

/**
 * Combines alert level, demographic matrix, and clinical score into a unified risk status
 * based on the Coopland High-Risk Evaluation Form classification:
 * - Low Risk:    0 – 2
 * - High Risk:   3 – 6
 * - Severe Risk: ≥ 7
 *
 * Safety Override: An acute Red Alert (vital signs crisis or severe symptoms)
 * immediately escalates the patient to Severe Risk regardless of baseline score.
 *
 * @param string $alertLevel
 * @param string $demographicRisk
 * @param int $cumulativeScore
 * @return string
 */
function determineOverallRiskStatus(string $alertLevel, string $demographicRisk, int $cumulativeScore): string {
    // 1. Acute Emergency Safety Override (Crisis BP, active hemorrhage, hard abdomen, etc.)
    if ($alertLevel === "Red_Alert") {
        return "Severe Risk";
    }

    // 2. Coopland Classification Cutoffs
    if ($cumulativeScore >= 7) {
        return "Severe Risk";
    }

    if ($cumulativeScore >= 3 || $alertLevel === "Yellow_Alert" || $demographicRisk === "High") {
        return "High Risk";
    }

    return "Low Risk";
}

// ============================================================================
// 7. PERSONALIZED RECOMMENDATIONS ENGINE
// ============================================================================

/**
 * Generates tailored clinical, medical, and lifestyle recommendations.
 *
 * @param string $overallRisk
 * @param array $vitals
 * @param array $symptoms
 * @param array $demographics
 * @return array
 */
function generatePersonalizedRecommendations(
    string $overallRisk, 
    array $vitals, 
    array $symptoms, 
    array $demographics
): array {
    $recommendations = [];

    // --- High-Level Action Directives ---
    if ($overallRisk === "Severe Risk") {
        $recommendations[] = [
            'category' => 'Urgent Action',
            'text'     => "Seek immediate evaluation at the nearest triage, hospital, or maternal clinic.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    } elseif ($overallRisk === "High Risk") {
        $recommendations[] = [
            'category' => 'Action Required',
            'text'     => "Schedule a follow-up appointment with your healthcare provider within 24–48 hours.",
            'urgent'   => false,
            'icon'     => 'fa-calendar-check'
        ];
    } else {
        $recommendations[] = [
            'category' => 'Routine Care',
            'text'     => "Continue standard prenatal visit schedule and daily monitoring.",
            'urgent'   => false,
            'icon'     => 'fa-circle-check'
        ];
    }

    // --- Vital-Specific Advice ---
    $sysBp = $vitals['sys_bp'] ?? 120;
    $diaBp = $vitals['dia_bp'] ?? 80;
    if ($sysBp > 130 || $diaBp > 85) {
        $recommendations[] = [
            'category' => 'Blood Pressure Management',
            'text'     => "Elevated Blood Pressure: Rest on your left side for 30 minutes, avoid salt-heavy foods, and re-check BP in 2 hours.",
            'urgent'   => ($sysBp >= 140 || $diaBp >= 90),
            'icon'     => 'fa-heart-pulse'
        ];
    } elseif ($sysBp < 110 || $diaBp < 75) {
        $recommendations[] = [
            'category' => 'Blood Pressure Management',
            'text'     => "Slightly Low Blood Pressure: Ensure adequate hydration (8–10 glasses of water daily) and avoid standing up too quickly.",
            'urgent'   => false,
            'icon'     => 'fa-droplet'
        ];
    }

    $glucose = $vitals['glucose'] ?? 90;
    $timing  = $vitals['timing'] ?? '';
    if (($timing === 'preprandial' && $glucose > 120) || ($timing === 'postprandial' && $glucose > 180)) {
        $recommendations[] = [
            'category' => 'Glycemic Control',
            'text'     => "Blood Glucose Spike: Maintain a low-glycemic meal plan, log your food intake, and contact your doctor if spikes persist.",
            'urgent'   => false,
            'icon'     => 'fa-bowl-food'
        ];
    }

    $temp = $vitals['temp'] ?? 37.0;
    if ($temp >= 38.0) {
        $recommendations[] = [
            'category' => 'Temperature Warning',
            'text'     => "Fever Detected (≥38.0°C): Stay hydrated, apply cold compresses, and inform your clinic immediately to rule out infection.",
            'urgent'   => true,
            'icon'     => 'fa-temperature-high'
        ];
    }

    // --- Symptom-Specific Advice ---
    // 1. Abdominal Pain
    if (!empty($symptoms['belly_pain_hard_abdomen']) || !empty($symptoms['belly_pain_bleeding']) || ($symptoms['belly_pain_intensity'] ?? 0) > 6) {
        $recommendations[] = [
            'category' => 'Abdominal Pain Care',
            'text'     => "Severe Abdominal Pain: Intense pain or abdominal tightness requires urgent medical evaluation to rule out placental abruption or preterm complications.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    } elseif (!empty($symptoms['belly_pain_symptoms_count']) || ($symptoms['belly_pain_intensity'] ?? 0) > 0 || !empty($symptoms['abdominal_pain'])) {
        $recommendations[] = [
            'category' => 'Abdominal Pain Care',
            'text'     => "Mild Abdominal Discomfort: Monitor mild cramps. Rest on your left side, drink warm water, and contact your clinic if cramps become rhythmic or increase in pain.",
            'urgent'   => false,
            'icon'     => 'fa-circle-check'
        ];
    }

    // 2. Difficulty Breathing
    if (!empty($symptoms['breathing_diff']) || !empty($symptoms['breathing_sound']) || !empty($symptoms['difficulty_breathing'])) {
        $recommendations[] = [
            'category' => 'Respiratory Care',
            'text'     => "Breathing Difficulty: Sit upright in a comfortable position, rest, and seek clinical evaluation to check oxygen levels and rule out respiratory or cardiac strain.",
            'urgent'   => true,
            'icon'     => 'fa-lungs'
        ];
    }

    // 3. Bleeding
    if (($symptoms['vaginal_bleeding_intensity'] ?? 0) > 4 || !empty($symptoms['bleeding_severe'])) {
        $recommendations[] = [
            'category' => 'Vaginal Bleeding Alert',
            'text'     => "Active Vaginal Bleeding: Any heavy bleeding requires immediate emergency evaluation. Avoid tampons or intercourse and proceed to your nearest maternity triage.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    } elseif (($symptoms['vaginal_bleeding_intensity'] ?? 0) > 0 || !empty($symptoms['bleeding'])) {
        $recommendations[] = [
            'category' => 'Vaginal Bleeding Alert',
            'text'     => "Vaginal Spotting: Rest with feet elevated, avoid strenuous activity, track pad count, and contact your doctor for prompt evaluation.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    }

    // 4. Headache
    $headacheInt = $symptoms['headache_intensity'] ?? 0;
    if ($headacheInt >= 6) {
        $recommendations[] = [
            'category' => 'Headache Management',
            'text'     => "Severe Headache (≥6/10): Rest in a dark, quiet room. If accompanied by blurred vision, spots, or swelling, seek immediate medical assessment for blood pressure evaluation.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    } elseif (!empty($symptoms['headache_symptoms']) || $headacheInt > 0) {
        $recommendations[] = [
            'category' => 'Headache Management',
            'text'     => "Mild Headache: Rest in a calm environment, ensure you are drinking enough water, and apply a cool cloth to your forehead.",
            'urgent'   => false,
            'icon'     => 'fa-circle-check'
        ];
    }

    // 5. Blurred Vision
    if (!empty($symptoms['blurred_vision'])) {
        $recommendations[] = [
            'category' => 'Visual Changes',
            'text'     => "Vision Changes: Blurred vision, floaters, or light sensitivity can indicate elevated blood pressure. Rest quietly and have your blood pressure checked promptly.",
            'urgent'   => true,
            'icon'     => 'fa-eye'
        ];
    }

    // 6. Convulsions
    if (!empty($symptoms['convulsions'])) {
        $recommendations[] = [
            'category' => 'Emergency Neurological',
            'text'     => "Convulsions / Seizures: Call emergency services immediately. Ensure the mother is safely resting on her left side away from hard objects to protect airway.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    }

    // 7. Dizziness
    if (!empty($symptoms['dizziness'])) {
        $recommendations[] = [
            'category' => 'Circulation & Dizziness',
            'text'     => "Dizziness Relief: Lie down on your left side immediately to restore blood flow. Drink fluids with electrolytes and avoid standing up suddenly.",
            'urgent'   => false,
            'icon'     => 'fa-circle-notch'
        ];
    }

    // 8. Fatigue
    if (!empty($symptoms['fatigue'])) {
        $recommendations[] = [
            'category' => 'Maternal Rest & Nutrition',
            'text'     => "Fatigue Support: Aim for 8+ hours of sleep, take short daytime rests, and eat iron-rich foods (spinach, beans, eggs) to maintain healthy red blood cell levels.",
            'urgent'   => false,
            'icon'     => 'fa-bed'
        ];
    }

    // 9. Swelling
    $swollenCount = $symptoms['swollen_locations_count'] ?? 0;
    if ($swollenCount >= 4) {
        $recommendations[] = [
            'category' => 'Swelling Management',
            'text'     => "Generalized Swelling: Rapid swelling across face, hands, and legs requires prompt medical evaluation to check blood pressure and kidney function.",
            'urgent'   => true,
            'icon'     => 'fa-triangle-exclamation'
        ];
    } elseif ($swollenCount >= 2 || !empty($symptoms['swelling'])) {
        $recommendations[] = [
            'category' => 'Swelling Management',
            'text'     => "Mild to Moderate Swelling: Elevate your feet above heart level for 20–30 minutes, wear comfortable footwear, and reduce sodium intake.",
            'urgent'   => false,
            'icon'     => 'fa-circle-check'
        ];
    }

    // 10. Vomiting / Nausea
    if (!empty($symptoms['vomiting'])) {
        $recommendations[] = [
            'category' => 'Nausea & Hydration',
            'text'     => "Vomiting & Nausea: Sip cold water, electrolyte drinks, or ginger tea in small, frequent amounts. Eat dry crackers before getting out of bed and avoid an empty stomach.",
            'urgent'   => false,
            'icon'     => 'fa-mug-hot'
        ];
    }

    // 11. Back Pain
    if (!empty($symptoms['back_pain'])) {
        $recommendations[] = [
            'category' => 'Back Care',
            'text'     => "Back Discomfort: Practice gentle pelvic tilts, apply a warm compress, wear supportive flat shoes, and avoid heavy lifting. If pain is rhythmic, contact your provider.",
            'urgent'   => false,
            'icon'     => 'fa-person'
        ];
    }

    // 12. Urinary Discomfort
    if (!empty($symptoms['discomfort_urination']) || !empty($symptoms['urinary_discomfort'])) {
        $recommendations[] = [
            'category' => 'Urinary Care',
            'text'     => "Urinary Discomfort: Burning or pain during urination may indicate a urinary tract infection. Drink plenty of water and seek a urine test from your clinic.",
            'urgent'   => false,
            'icon'     => 'fa-droplet'
        ];
    }

    // 13. Decreased Fetal Movement
    if (!empty($symptoms['decreased_fetal_movement'])) {
        $recommendations[] = [
            'category' => 'Fetal Monitoring',
            'text'     => "Decreased Fetal Movement: Drink cold water or juice, lie on your left side, and count kicks for 1 hour. If fewer than 10 movements occur, contact triage immediately.",
            'urgent'   => true,
            'icon'     => 'fa-heart'
        ];
    }

    // 14. Loss of Vaginal Fluid
    if (!empty($symptoms['loss_vaginal_fluid'])) {
        $recommendations[] = [
            'category' => 'Membrane Care',
            'text'     => "Fluid Leakage: Leaking clear vaginal fluid may indicate premature water breaking. Contact your maternity facility or doctor immediately.",
            'urgent'   => true,
            'icon'     => 'fa-droplet'
        ];
    }

    // --- Demographic Personalization ---
    $age = $demographics['age'] ?? 25;
    if ($age < 18) {
        $recommendations[] = [
            'category' => 'Adolescent Care Track',
            'text'     => "Adolescent Pregnancy Support: Ensure daily prenatal iron and folic acid intake are logged, and attend dedicated young-maternal wellness sessions.",
            'urgent'   => false,
            'icon'     => 'fa-user-nurse'
        ];
    }

    return $recommendations;
}

// ============================================================================
// 8. PIPELINE CONTROLLER (Master Execution)
// ============================================================================

/**
 * Master controller executing validation, risk evaluation, scoring, and recommendation output.
 *
 * @param array $userPayload
 * @return array
 */
function runPregnacareDecisionEngine(array $userPayload): array {
    $vitals           = $userPayload['vitals'] ?? [];
    $symptoms         = $userPayload['symptoms'] ?? [];
    $demographics     = $userPayload['demographics'] ?? [];
    $medicalHistory   = $userPayload['medical_history'] ?? [];
    $presentPregnancy = $userPayload['present_pregnancy'] ?? [];

    // Step 1: Validate input bounds
    $validation = validateVitalsInput($vitals);
    if (!$validation['isValid']) {
        return [
            'status' => 'REJECTED',
            'error'  => $validation['message']
        ];
    }

    // Step 2: Compute risk metrics & Coopland High-Risk Evaluation
    $alertLevel          = processMaternalVitalsAndSymptoms($vitals, $symptoms);
    $demographicRisk     = evaluateDemographicRiskMatrix($demographics);
    $coopland            = evaluateCooplandForm($medicalHistory, $presentPregnancy);
    $totalClinicalScore  = $coopland['total_score'];

    // Step 3: Determine overall unified risk level (Coopland cutoffs + Acute Red Alert override)
    $overallRisk = determineOverallRiskStatus($alertLevel, $demographicRisk, $totalClinicalScore);

    // Step 4: Generate tailored personalized recommendations
    $recommendations = generatePersonalizedRecommendations($overallRisk, $vitals, $symptoms, $demographics);

    // Step 5: System / UI Actions
    $notifyDoctor    = in_array($overallRisk, ["High Risk", "Severe Risk"], true);
    $hideVisualAlarm = ($overallRisk === "Severe Risk"); // Minimizes panic/anxiety on client side

    return [
        'status'                => 'SUCCESS',
        'overall_risk'          => $overallRisk,          // "Low Risk", "High Risk", or "Severe Risk"
        'alert_level'           => $alertLevel,           // "Green_Alert", "Yellow_Alert", "Red_Alert"
        'demographic_risk'      => $demographicRisk,      // "Low", "Moderate", "High"
        'cumulative_risk_score' => $totalClinicalScore,   // Numeric additive score
        'coopland'              => $coopland,             // Full Coopland Evaluation Form breakdown
        'recommendations'       => $recommendations,       // List of category/text objects
        'system_actions'        => [
            'notify_doctor_dashboard'     => $notifyDoctor,
            'hide_visual_alarm_indicator' => $hideVisualAlarm,
            'display_localized_advice'    => true
        ]
    ];
}

// ============================================================================
// EXAMPLE IMPLEMENTATION / TESTING BENCH
// ============================================================================

// Sample execution when loaded directly in browser or command line
$samplePayload = [
    'vitals' => [
        'sys_bp'  => 138,
        'dia_bp'  => 88,
        'temp'    => 37.2,
        'hr'      => 85,
        'timing'  => 'preprandial',
        'glucose' => 105
    ],
    'symptoms' => [
        'headache_symptoms'  => true,
        'headache_intensity' => 4,
        'swollen_locations_count' => 2
    ],
    'demographics' => [
        'age'                      => 17,
        'bmi'                      => 26.0,
        'pregnancy_interval_years' => 1.5
    ],
    'medical_history' => [
        'maternal_age' => 17,
        'parity'       => 0
    ],
    'present_pregnancy' => []
];

// Execute engine only when run directly
if (
    (php_sapi_name() === 'cli' && isset($argv[0]) && realpath($argv[0]) === realpath(__FILE__)) ||
    (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))
) {
    $output = runPregnacareDecisionEngine($samplePayload);

    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json');
        echo json_encode($output, JSON_PRETTY_PRINT);
    } else {
        print_r($output);
    }
}