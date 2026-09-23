<?php
/* ============================================================
   test_fuzzy_rules.php
   Automated verification for PregnaCare Fuzzy Logic Decision Support System
   ============================================================ */

require_once __DIR__ . '/base.php';

echo "====================================================\n";
echo "PREGNACARE FUZZY LOGIC & RULES.DOCX VERIFICATION\n";
echo "====================================================\n\n";

$passed = 0;
$failed = 0;

function assert_test($description, $condition, $extra = ''){
    global $passed, $failed;
    if ($condition){
        echo "[PASS] {$description}\n";
        $passed++;
    } else {
        echo "[FAIL] {$description} {$extra}\n";
        $failed++;
    }
}

// ----------------------------------------------------
// 1. TEST INPUT VALIDATION (RULES.docx Rule 24)
// ----------------------------------------------------
echo "--- 1. Testing Input Validation (Rule 24) ---\n";

$invalidData1 = ['temp' => 45.0];
$errs1 = validate_maternal_inputs($invalidData1);
assert_test("Temperature > 43.0 C is rejected", isset($errs1['temp']));

$invalidData2 = ['bp_sys' => 250, 'bp_dia' => 20];
$errs2 = validate_maternal_inputs($invalidData2);
assert_test("Out-of-bound BP is rejected", isset($errs2['bp_sys']) && isset($errs2['bp_dia']));

$validData = ['temp' => 36.8, 'bp_sys' => 120, 'bp_dia' => 80, 'heart_rate' => 75, 'blood_sugar' => 95];
$errs3 = validate_maternal_inputs($validData);
assert_test("Normal physiological vitals pass validation", empty($errs3));

// ----------------------------------------------------
// 2. TEST FUZZY SYMPTOM SEVERITY (Section 2 Specification)
// ----------------------------------------------------
echo "\n--- 2. Testing Fuzzy Symptom Severity (Headache Intensity = 4) ---\n";

$m4 = fuzzy_symptom_membership(4.0);
echo "Intensity 4.0 -> LOW: {$m4['low']}, HIGH: {$m4['high']}, SEVERE: {$m4['severe']}, Dominant: {$m4['dominant']}\n";

assert_test("Intensity 4 gives LOW membership = 0.20", abs($m4['low'] - 0.20) < 0.05, "Got {$m4['low']}");
assert_test("Intensity 4 gives HIGH membership = 0.70", abs($m4['high'] - 0.70) < 0.05, "Got {$m4['high']}");
assert_test("Intensity 4 gives SEVERE membership = 0.10", abs($m4['severe'] - 0.10) < 0.05, "Got {$m4['severe']}");
assert_test("Dominant membership for intensity 4 is HIGH", $m4['dominant'] === 'HIGH');

$m0 = fuzzy_symptom_membership(0.0);
assert_test("Intensity 0 gives LOW = 1.0, HIGH = 0.0, SEVERE = 0.0", $m0['low'] == 1.0 && $m0['high'] == 0.0 && $m0['severe'] == 0.0);

$m8 = fuzzy_symptom_membership(8.0);
assert_test("Intensity 8 dominant membership is SEVERE", $m8['dominant'] === 'SEVERE' && $m8['severe'] >= 0.75);

// ----------------------------------------------------
// 3. TEST MULTI-SYMPTOM FUZZY INFERENCE (Sections 3 & 4)
// ----------------------------------------------------
echo "\n--- 3. Testing Multi-Symptom Fuzzy Inference ---\n";

$catalog = get_symptom_catalog();
$ruleBase = get_rule_base();

// Scenario: High Headache + High Blood Pressure -> Overall High Risk
$inputMulti = [
    'age' => 28,
    'bp_sys' => 134,
    'bp_dia' => 88,
    'temp' => 36.8,
    'heart_rate' => 78,
    'blood_sugar' => 95,
    'symptoms' => [
        ['id' => 'headache', 'severity' => 'Moderate'],
    ],
    'symptom_intensities' => [
        'headache' => 5.0,
    ],
];
$resMulti = assess_risk($inputMulti, $ruleBase, $catalog);
assert_test("Headache High + BP High evaluates to HIGH severity or MODERATE/HIGH RISK",
    in_array($resMulti['overall_severity'], ['HIGH', 'SEVERE']));

// ----------------------------------------------------
// 4. TEST SAFETY-RULE OVERRIDES (RULES.docx)
// ----------------------------------------------------
echo "\n--- 4. Testing Emergency Overrides (Red, Yellow, Green Alerts) ---\n";

// A. Red Alert: Elevated Temperature (>= 38 C)
$inputRed1 = [
    'age' => 28,
    'bp_sys' => 120,
    'bp_dia' => 80,
    'temp' => 38.5, // >= 38 C
    'heart_rate' => 80,
    'blood_sugar' => 90,
    'symptoms' => [],
];
$resRed1 = assess_risk($inputRed1, $ruleBase, $catalog);
assert_test("Temperature >= 38 C triggers Red Alert", $resRed1['alert_type'] === 'RED');
assert_test("Red Alert forces Overall Severity = SEVERE", $resRed1['overall_severity'] === 'SEVERE');
assert_test("Red Alert forces Risk Level = HIGH RISK", $resRed1['risk_level'] === 'HIGH RISK');

// A2. Red Alert: Systolic BP outside 110-130 OR Diastolic BP outside 75-85
$inputBpHighSys = ['age' => 28, 'bp_sys' => 135, 'bp_dia' => 80, 'temp' => 36.8, 'heart_rate' => 75, 'symptoms' => []];
$resBpHighSys = assess_risk($inputBpHighSys, $ruleBase, $catalog);
assert_test("Systolic BP 135 (> 130) triggers Red Alert", $resBpHighSys['alert_type'] === 'RED' && $resBpHighSys['risk_level'] === 'HIGH RISK');

$inputBpHighDia = ['age' => 28, 'bp_sys' => 120, 'bp_dia' => 90, 'temp' => 36.8, 'heart_rate' => 75, 'symptoms' => []];
$resBpHighDia = assess_risk($inputBpHighDia, $ruleBase, $catalog);
assert_test("Diastolic BP 90 (> 85) triggers Red Alert", $resBpHighDia['alert_type'] === 'RED' && $resBpHighDia['risk_level'] === 'HIGH RISK');

$inputBpLowSys = ['age' => 28, 'bp_sys' => 105, 'bp_dia' => 80, 'temp' => 36.8, 'heart_rate' => 75, 'symptoms' => []];
$resBpLowSys = assess_risk($inputBpLowSys, $ruleBase, $catalog);
assert_test("Systolic BP 105 (< 110) triggers Red Alert", $resBpLowSys['alert_type'] === 'RED' && $resBpLowSys['risk_level'] === 'HIGH RISK');

$inputBpLowDia = ['age' => 28, 'bp_sys' => 120, 'bp_dia' => 70, 'temp' => 36.8, 'heart_rate' => 75, 'symptoms' => []];
$resBpLowDia = assess_risk($inputBpLowDia, $ruleBase, $catalog);
assert_test("Diastolic BP 70 (< 75) triggers Red Alert", $resBpLowDia['alert_type'] === 'RED' && $resBpLowDia['risk_level'] === 'HIGH RISK');

$inputBpNormal = ['age' => 28, 'bp_sys' => 120, 'bp_dia' => 80, 'temp' => 36.8, 'heart_rate' => 75, 'symptoms' => []];
$resBpNormal = assess_risk($inputBpNormal, $ruleBase, $catalog);
assert_test("Optimal BP (120/80 mmHg) does not trigger Red Alert", $resBpNormal['alert_type'] !== 'RED');

// B. Red Alert: Loss of Vaginal Fluid == True
$inputRed2 = [
    'age' => 28,
    'bp_sys' => 120,
    'bp_dia' => 80,
    'temp' => 36.8,
    'heart_rate' => 80,
    'loss_of_vaginal_fluid' => true,
    'symptoms' => [],
];
$resRed2 = assess_risk($inputRed2, $ruleBase, $catalog);
assert_test("Loss of vaginal fluid triggers Red Alert / HIGH RISK", $resRed2['alert_type'] === 'RED' && $resRed2['risk_level'] === 'HIGH RISK');

// C. Yellow Alert: Swollen locations count == 2
$inputYellow = [
    'age' => 28,
    'bp_sys' => 120,
    'bp_dia' => 80,
    'temp' => 36.8,
    'heart_rate' => 80,
    'swollen_locations_count' => 2,
    'symptoms' => [],
];
$resYellow = assess_risk($inputYellow, $ruleBase, $catalog);
assert_test("2 swollen locations triggers Yellow Alert", $resYellow['alert_type'] === 'YELLOW');
assert_test("Yellow Alert forces Risk Level = MODERATE RISK", $resYellow['risk_level'] === 'MODERATE RISK');

// D. Green Alert: Vitals safe & 0 symptoms
$inputGreen = [
    'age' => 28,
    'bp_sys' => 120,
    'bp_dia' => 80,
    'temp' => 36.8,
    'heart_rate' => 75,
    'blood_sugar' => 90,
    'glucose_timing' => 'preprandial',
    'symptoms' => [],
];
$resGreen = assess_risk($inputGreen, $ruleBase, $catalog);
assert_test("Optimal vitals + 0 symptoms triggers Green Alert / LOW RISK",
    $resGreen['alert_type'] === 'GREEN' && $resGreen['risk_level'] === 'LOW RISK' && $resGreen['overall_severity'] === 'LOW');

// ----------------------------------------------------
// 5. TEST CONTINUOUS MONITORING PROGRESSION
// ----------------------------------------------------
echo "\n--- 5. Testing Continuous Monitoring Progression Detection ---\n";

// We simulate progression detection logic
$progTest = detect_severity_progression($pdo, null, 'HIGH', 'MODERATE RISK');
assert_test("Handles null user without crashing", $progTest['detected'] === false);

echo "\n====================================================\n";
echo "SUMMARY: {$passed} tests passed, {$failed} tests failed.\n";
echo "====================================================\n";

if ($failed === 0){
    echo "\nAll Fuzzy Logic and Clinical Safety Rules verified successfully!\n";
    exit(0);
} else {
    echo "\nSome tests failed!\n";
    exit(1);
}
