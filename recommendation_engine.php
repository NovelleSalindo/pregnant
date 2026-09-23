<?php
require_once __DIR__ . '/base.php';

function generate_recommendations($coopland_assessment, $active_alerts, $trimester = 1) {
    $recs = [];
    
    // Priority Rule: If Clinical Alert is HIGH, it completely overrides general risk logic.
    if (isset($active_alerts['clinical_alert_level']) && $active_alerts['clinical_alert_level'] === 'HIGH') {
        if (!empty($active_alerts['recommendations'])) {
            // Return exactly the recommendation provided by the Symptom Engine (e.g. "Seek prompt medical evaluation.")
            return $active_alerts['recommendations'];
        } else {
            return ["Seek prompt medical evaluation."];
        }
    }
    
    // If no High Clinical Alert, we rely on Coopland Risk and Trimester
    $risk = $coopland_assessment['coopland_risk'] ?? 'Low';
    
    if ($risk === 'Low') {
        if ($trimester == 3) {
            $recs[] = "Maintain regular prenatal monitoring, follow your healthcare provider's recommendations, and prepare for labor.";
        } else {
            $recs[] = "Maintain regular prenatal monitoring and follow the healthcare provider's recommendations.";
        }
    } elseif ($risk === 'High') {
        $recs[] = "High-risk pregnancy factors detected. Schedule more frequent prenatal visits and follow the healthcare provider's recommendations.";
    } elseif ($risk === 'Review') {
        $recs[] = "Risk factors require review. Please consult your healthcare provider to discuss your risk profile.";
    } elseif ($risk === 'Severe') {
        $recs[] = "Severe risk factors present. Immediate consultation with a maternal-fetal medicine specialist is recommended.";
    }
    
    return $recs;
}
