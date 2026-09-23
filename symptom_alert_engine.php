<?php
require_once __DIR__ . '/base.php';

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

    $sys = $vitals['bp_sys'] ?? null;
    $dia = $vitals['bp_dia'] ?? null;
    $temp = $vitals['temp'] ?? null;

    // Helper functions
    $has = function($id) use ($symMap) {
        return isset($symMap[$id]);
    };
    $isSevere = function($id) use ($symMap) {
        return isset($symMap[$id]) && $symMap[$id] === 'severe';
    };

    // Derived flags based on list of 20 symptoms
    $severe_headache = $has('severe_headache') || $isSevere('headache');
    $blurred_vision = $has('blurred_vision') || $has('vision_changes');
    $vaginal_bleeding = $has('vaginal_bleeding') || $has('bleeding');
    $fluid_leakage = $has('fluid_leakage') || $has('vaginal_fluid_leakage') || !empty($engineInput['loss_of_vaginal_fluid']);
    $decreased_fetal_movement = $has('decreased_fetal_movement') || !empty($engineInput['decreased_fetal_movement']);
    $severe_abdominal_pain = $has('severe_abdominal_pain') || $isSevere('abdominal_pain');
    $chest_pain = $has('chest_pain');
    $difficulty_breathing = $has('difficulty_breathing') || !empty($engineInput['breathing_difficulty']) || !empty($engineInput['breathing_with_sound']);
    $fainting = $has('fainting') || $has('dizziness'); // Prompt mentions Dizziness in list
    $seizure = $has('seizure') || $has('convulsions');
    $high_temp = ($temp !== null && (float)$temp >= 38.0) || $has('fever');
    $severe_vomiting = $has('severe_vomiting') || $isSevere('vomiting') || $isSevere('nausea');
    $unable_to_keep_fluids = $has('unable_to_keep_fluids');
    
    $swollen_locs = $engineInput['swollen_locations'] ?? [];
    $one_sided_leg_swelling = $has('one_sided_leg_swelling') || $has('one_sided_leg_swelling_pain') || (!empty($swollen_locs['legs']) && $has('pain_in_leg')); // Just map it generically if legs are swollen, but the prompt says "One-sided leg swelling/pain"
    if ($has('leg_swelling_pain')) $one_sided_leg_swelling = true;

    $painful_urination = $has('painful_urination') || !empty($engineInput['discomfort_during_urination']);

    // Vitals check
    $high_bp = ($sys !== null && (float)$sys >= 140) || ($dia !== null && (float)$dia >= 90);

    // Apply rules
    if ($severe_headache && $high_bp) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Severe Headache with High Blood Pressure';
        $recommendations[] = 'Contact your healthcare provider or seek prompt medical evaluation.';
    } elseif ($severe_headache) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Severe Headache';
        $recommendations[] = 'Seek prompt medical evaluation.';
    }

    if ($blurred_vision) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Blurred Vision';
        $recommendations[] = 'Seek prompt medical evaluation.';
    }

    if ($vaginal_bleeding) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Vaginal Bleeding';
        $recommendations[] = 'Contact your healthcare provider for assessment.';
    }

    if ($fluid_leakage) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Vaginal Fluid Leakage';
        $recommendations[] = 'Contact your healthcare provider for assessment.';
    }

    if ($decreased_fetal_movement) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Decreased Fetal Movement';
        $recommendations[] = 'Contact your healthcare provider promptly.';
    }

    if ($severe_abdominal_pain) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Severe Abdominal Pain';
        $recommendations[] = 'Seek prompt medical evaluation.';
    }

    if ($chest_pain) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Chest Pain';
        $recommendations[] = 'Seek immediate medical assessment.';
    }

    if ($difficulty_breathing) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Difficulty Breathing';
        $recommendations[] = 'Seek immediate medical assessment.';
    }

    if ($fainting) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Fainting';
        $recommendations[] = 'Seek medical evaluation.';
    }

    if ($seizure) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Seizure';
        $recommendations[] = 'Seek emergency medical care.';
    }

    if ($high_temp) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Fever (>= 38.0)';
        $recommendations[] = 'Contact your healthcare provider for assessment.';
    }

    if ($severe_vomiting || $unable_to_keep_fluids) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Severe Vomiting / Unable to Keep Fluids';
        $recommendations[] = 'Contact your healthcare provider for assessment.';
    }

    if ($one_sided_leg_swelling) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'One-sided Leg Swelling/Pain';
        $recommendations[] = 'Seek medical assessment.';
    }

    if ($painful_urination) {
        $level = 'HIGH';
        $triggered_symptoms[] = 'Painful Urination';
        $recommendations[] = 'Seek medical assessment.';
    }

    // Default recommendation if LOW
    if ($level === 'LOW') {
        $recommendations[] = 'Continue routine monitoring. Report any new or worsening symptoms to your healthcare provider.';
    }

    // Save to Database (we store one record for the entire assessment)
    if (!empty($triggered_symptoms)) {
        $id = 'alt-' . uniqid();
        $stmt = $pdo->prepare("INSERT INTO clinical_alerts (id, user_id, date, alert_text, severity, source_type) VALUES (?, ?, NOW(), ?, ?, ?)");
        $stmt->execute([
            $id,
            $user_id,
            implode(', ', $triggered_symptoms),
            $level,
            'symptom'
        ]);
    }
    
    // Clean up duplicate recommendations
    $recommendations = array_values(array_unique($recommendations));

    return [
        'clinical_alert_level' => $level,
        'triggered_symptoms' => $triggered_symptoms,
        'recommendations' => $recommendations
    ];
}
