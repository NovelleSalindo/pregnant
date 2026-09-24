<?php
require_once __DIR__ . '/base.php';

/**
 * Evaluates clinical alerts and generates precise evidence-based recommendations
 * for 20 clinical maternal symptoms.
 */
function evaluate_clinical_alerts($user_id, $pdo, $engineInput = [], $vitals = null) {
    $level = 'LOW';
    $triggered_symptoms = [];
    $recommendations = [];

    $symptoms = $engineInput['symptoms'] ?? [];
    
    // Flatten symptoms for easier checking
    $symMap = [];
    foreach ($symptoms as $sym) {
        $id = strtolower($sym['id'] ?? $sym['name'] ?? '');
        $severity = strtolower($sym['severity'] ?? 'moderate');
        if ($id) {
            $symMap[$id] = $severity;
        }
    }

    $sys = $vitals['bp_sys'] ?? ($engineInput['bp_sys'] ?? null);
    $dia = $vitals['bp_dia'] ?? ($engineInput['bp_dia'] ?? null);
    $temp = $vitals['temp'] ?? ($engineInput['temp'] ?? null);

    // Helper functions
    $has = function($id) use ($symMap) {
        return isset($symMap[$id]) && $symMap[$id] !== 'none';
    };
    $isSevere = function($id) use ($symMap) {
        return isset($symMap[$id]) && ($symMap[$id] === 'severe' || $symMap[$id] === 'high');
    };
    $getSev = function($id) use ($symMap) {
        return $symMap[$id] ?? 'none';
    };

    // Helper to upgrade overall alert level
    $upgradeLevel = function($newLevel) use (&$level) {
        if ($newLevel === 'HIGH') {
            $level = 'HIGH';
        } elseif ($newLevel === 'MODERATE' && $level !== 'HIGH') {
            $level = 'MODERATE';
        }
    };

    // --- 1 & 2. HEADACHE / SEVERE HEADACHE ---
    $hasHeadache = $has('headache') || $has('severe_headache') || ($engineInput['headache_symptoms'] ?? false);
    $headacheIntensity = (float)($engineInput['headache_intensity'] ?? 0);
    $isSevereHeadache = $isSevere('headache') || $has('severe_headache') || $headacheIntensity >= 6;

    if ($isSevereHeadache) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Severe Headache (High)';
        $recommendations[] = 'Seek prompt medical evaluation, especially if the headache is persistent or worsening.';
    } elseif ($hasHeadache) {
        $upgradeLevel('MODERATE');
        $triggered_symptoms[] = 'Headache (Moderate)';
        $recommendations[] = 'Rest, maintain adequate hydration, and monitor the headache. If it persists, becomes severe, or is accompanied by vision changes, contact your healthcare provider.';
    }

    // --- 3. DIZZINESS ---
    if ($has('dizziness')) {
        $upgradeLevel('MODERATE');
        $triggered_symptoms[] = 'Dizziness (Moderate)';
        $recommendations[] = 'Sit or lie down safely, maintain hydration, and monitor the symptom. Report persistent or worsening dizziness to your healthcare provider.';
    }

    // --- 4. FAINTING ---
    if ($has('fainting')) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Fainting (High)';
        $recommendations[] = 'Seek medical evaluation after fainting, particularly if it recurs or is associated with injury, chest pain, or difficulty breathing.';
    }

    // --- 5. NAUSEA ---
    if ($has('nausea')) {
        // Alert Level: Low
        $triggered_symptoms[] = 'Nausea (Low)';
        $recommendations[] = 'Eat small, frequent meals, maintain hydration, and avoid foods or smells that trigger nausea.';
    }

    // --- 6 & 7. VOMITING / SEVERE/PERSISTENT VOMITING ---
    $hasVomiting = $has('vomiting') || $has('severe_vomiting') || $has('unable_to_keep_fluids');
    $isSevereVomiting = $isSevere('vomiting') || $has('severe_vomiting') || $has('unable_to_keep_fluids');

    if ($isSevereVomiting) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Severe/Persistent Vomiting (High)';
        $recommendations[] = 'Contact your healthcare provider promptly, particularly if you cannot keep fluids down or have signs of dehydration.';
    } elseif ($hasVomiting) {
        $upgradeLevel('MODERATE');
        $triggered_symptoms[] = 'Vomiting (Moderate)';
        $recommendations[] = 'Take small frequent sips of fluids and eat small meals as tolerated. Contact your healthcare provider if vomiting persists or worsens.';
    }

    // --- 8 & 9. ABDOMINAL PAIN / SEVERE ABDOMINAL PAIN ---
    $hasAbdPain = $has('abdominal_pain') || $has('severe_abdominal_pain') || !empty($engineInput['belly_pain_with_hard_abdomen']) || !empty($engineInput['belly_pain_with_bleeding']);
    $abdIntensity = (float)($engineInput['belly_pain_intensity'] ?? 0);
    $isSevereAbdPain = $isSevere('abdominal_pain') || $has('severe_abdominal_pain') || !empty($engineInput['belly_pain_with_hard_abdomen']) || !empty($engineInput['belly_pain_with_bleeding']) || $abdIntensity > 6;

    if ($isSevereAbdPain) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Severe Abdominal Pain (High)';
        $recommendations[] = 'Seek prompt medical evaluation for severe or persistent abdominal pain.';
    } elseif ($hasAbdPain) {
        $upgradeLevel('MODERATE');
        $triggered_symptoms[] = 'Abdominal Pain (Moderate)';
        $recommendations[] = 'Rest and monitor the pain. Contact your healthcare provider if the pain persists, worsens, or is associated with bleeding or other concerning symptoms.';
    }

    // --- 10. VAGINAL BLEEDING ---
    $bleedingIntensity = (float)($engineInput['vaginal_bleeding_intensity'] ?? 0);
    if ($has('vaginal_bleeding') || $has('bleeding') || $bleedingIntensity > 0) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Vaginal Bleeding (High)';
        $recommendations[] = 'Contact your healthcare provider promptly for assessment of vaginal bleeding.';
    }

    // --- 11. FLUID LEAKAGE ---
    if ($has('fluid_leakage') || $has('fluid_loss') || $has('vaginal_fluid_leakage') || !empty($engineInput['loss_of_vaginal_fluid'])) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Fluid Leakage (High)';
        $recommendations[] = 'Contact your healthcare provider promptly for assessment of possible fluid leakage.';
    }

    // --- 12. BLURRED VISION ---
    if ($has('blurred_vision') || $has('vision_changes')) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Blurred Vision (High)';
        $recommendations[] = 'Seek prompt medical evaluation, particularly when accompanied by headache or elevated blood pressure.';
    }

    // --- 13. DIFFICULTY BREATHING ---
    if ($has('difficulty_breathing') || !empty($engineInput['breathing_difficulty']) || !empty($engineInput['breathing_with_sound'])) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Difficulty Breathing (High)';
        $recommendations[] = 'Seek immediate medical assessment for significant or worsening difficulty breathing.';
    }

    // --- 14. CHEST PAIN ---
    if ($has('chest_pain')) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Chest Pain (High)';
        $recommendations[] = 'Seek immediate medical assessment for chest pain, especially if severe or accompanied by difficulty breathing, dizziness, or fainting.';
    }

    // --- 15. FEVER ≥38°C ---
    $highTemp = ($temp !== null && (float)$temp >= 38.0) || $has('fever') || !empty($engineInput['fever_with_chills']) || !empty($engineInput['fever_with_sweating']);
    if ($highTemp) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Fever ≥38°C (High)';
        $recommendations[] = 'Contact your healthcare provider for assessment of fever and possible infection.';
    }

    // --- 16. DECREASED FETAL MOVEMENT ---
    if ($has('decreased_fetal_movement') || $has('reduced_movement') || !empty($engineInput['decreased_fetal_movement'])) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Decreased Fetal Movement (High)';
        $recommendations[] = 'Contact your maternity/obstetric provider promptly for assessment of decreased fetal movement.';
    }

    // --- 17. SEIZURE ---
    if ($has('seizure') || $has('convulsions')) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'Seizure (High)';
        $recommendations[] = 'Seek emergency medical care immediately after a seizure during pregnancy.';
    }

    // --- 18. ONE-SIDED LEG SWELLING/PAIN ---
    $swollen_locs = $engineInput['swollen_locations'] ?? [];
    $isOneSidedLeg = $has('one_sided_leg_swelling') || $has('one_sided_leg_swelling_pain') || $has('leg_swelling_pain') || !empty($engineInput['one_sided_leg_swelling']) || (!empty($swollen_locs['legs']) && $has('pain_in_leg'));
    if ($isOneSidedLeg) {
        $upgradeLevel('HIGH');
        $triggered_symptoms[] = 'One-sided Leg Swelling/Pain (High)';
        $recommendations[] = 'Seek prompt medical assessment for new one-sided leg swelling or pain, particularly if accompanied by chest pain or difficulty breathing.';
    }

    // --- 19. SEVERE WEAKNESS (Moderate–High) ---
    $hasWeakness = $has('severe_weakness') || $has('fatigue') || $has('weakness');
    if ($hasWeakness) {
        $isSevWeak = $isSevere('fatigue') || $isSevere('severe_weakness') || $isSevere('weakness') || $has('severe_weakness');
        $upgradeLevel($isSevWeak ? 'HIGH' : 'MODERATE');
        $triggered_symptoms[] = $isSevWeak ? 'Severe Weakness (High)' : 'Weakness (Moderate)';
        $recommendations[] = 'Rest and maintain hydration. If weakness is severe, persistent, sudden, or associated with fainting, difficulty breathing, bleeding, or other concerning symptoms, seek medical evaluation.';
    }

    // --- 20. PAINFUL URINATION ---
    if ($has('painful_urination') || $has('urinary_discomfort') || !empty($engineInput['discomfort_during_urination'])) {
        $upgradeLevel('MODERATE');
        $triggered_symptoms[] = 'Painful Urination (Moderate)';
        $recommendations[] = 'Contact your healthcare provider for assessment, especially if accompanied by fever, back/flank pain, or worsening symptoms.';
    }

    // Default recommendation if no symptoms triggered
    if (empty($recommendations)) {
        $recommendations[] = 'Continue routine monitoring. Report any new or worsening symptoms to your healthcare provider.';
    }

    // Save to Database (we store one record for the entire assessment if symptoms were triggered)
    if (!empty($triggered_symptoms) && $pdo) {
        try {
            $id = 'alt-' . uniqid();
            $stmt = $pdo->prepare("INSERT INTO clinical_alerts (id, user_id, date, alert_text, severity, source_type) VALUES (?, ?, NOW(), ?, ?, ?)");
            $stmt->execute([
                $id,
                $user_id,
                implode(', ', $triggered_symptoms),
                $level,
                'symptom'
            ]);
        } catch (Exception $e) {}
    }
    
    // Clean up duplicate recommendations while preserving order
    $recommendations = array_values(array_unique($recommendations));

    return [
        'clinical_alert_level' => $level,
        'triggered_symptoms' => $triggered_symptoms,
        'recommendations' => $recommendations
    ];
}
