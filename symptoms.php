<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$catalog = get_symptom_catalog();

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    // 1. Save the symptom log
    $logId = uid('sym');
    $pdo->prepare("INSERT INTO symptom_logs (id, user_id, date) VALUES (?,?,?)")->execute([$logId, $u['id'], now_iso()]);

    $symptoms = [];
    foreach ($catalog as $c){
        $sid = $c['id'];
        $severity = $_POST['sev'][$sid] ?? 'None';
        if ($severity === 'None') continue; // only store/report symptoms actually present
        $duration = $_POST['dur'][$sid] ?? 'Today';
        $frequency = $_POST['freq'][$sid] ?? 'Rare';
        $pdo->prepare("INSERT INTO symptom_log_items (id, symptom_log_id, symptom_id, severity, duration, frequency) VALUES (?,?,?,?,?,?)")
            ->execute([uid('sli'), $logId, $sid, $severity, $duration, $frequency]);
        $symptoms[] = ['id'=>$sid, 'severity'=>$severity, 'duration'=>$duration, 'frequency'=>$frequency];
    }
    // Ensure every catalog symptom is represented (rules check by id; missing = 'None')
    $presentIds = array_column($symptoms, 'id');
    foreach ($catalog as $c){
        if (!in_array($c['id'], $presentIds)) $symptoms[] = ['id'=>$c['id'], 'severity'=>'None', 'duration'=>'Today', 'frequency'=>'Rare'];
    }

    // 2. Pull latest vitals + profile to build the engine input
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id']]);
    $vitals = $stmt->fetch() ?: [];

    $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$u['id']]);
    $profile = $stmt->fetch() ?: [];

    $age = $profile['age'] ?? 28;
    $trimester = 2;
    if (!empty($profile['lmp'])){
        $weeks = floor((time() - strtotime($profile['lmp'])) / (7*86400));
        $trimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
    }
    $bmi = !empty($vitals['bmi']) ? (float)$vitals['bmi'] : bmi_of($profile['weight_kg'] ?? 62, $profile['height_cm'] ?? 160);

    $input = [
        'age' => (int)$age,
        'trimester' => $trimester,
        'bp_sys' => (int)($vitals['bp_sys'] ?? 118),
        'bp_dia' => (int)($vitals['bp_dia'] ?? 76),
        'bmi' => $bmi,
        'hemoglobin' => (float)($vitals['hemoglobin'] ?? 12),
        'blood_sugar' => (int)($vitals['blood_sugar'] ?? 95),
        'medicalHistoryScore' => (float)($profile['medical_history_score'] ?? 0),
        'priorComplicationsScore' => (float)($profile['prior_complications_score'] ?? 0),
        'symptoms' => $symptoms,
    ];

    // 3. Run AHP + Fuzzy + Rule-based engine
    $ahpWeights = get_ahp_weights();
    $ruleBase = get_rule_base();
    $result = assess_risk($input, $ahpWeights, $ruleBase, $catalog);

    // 4. Persist assessment
    $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            uid('asm'), $u['id'], now_iso(), $result['score'], $result['level'],
            $result['fuzzy']['weightedScore'], $result['fuzzy']['centroid'],
            json_encode($result['ahp']), json_encode($result['fuzzy']),
            json_encode($result['rules']), json_encode($result['recommendations']),
        ]);

    if ($result['level'] === 'Severe'){
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, kind) VALUES (?,?,?,?,?,?)")
            ->execute([uid('ntf'), $u['id'], 'Severe Risk Detected', 'Your latest symptom check-in flagged a severe-risk pattern. Please review your recommendations.', now_iso(), 'error']);
    }

    log_action('symptom_checkin_and_assess');
    redirect('analyze.php');
}

render_header('Symptom Check-in', 'symptoms');
?>

<div class="card">
  <div class="eyebrow">Step 1 of the Risk Pipeline</div>
  <h3 style="margin-top:6px;">How are you feeling today?</h3>
 

  <form method="post" action="symptoms.php">
    <div class="symptom-grid">
      <?php foreach ($catalog as $c): ?>
        <div class="symptom-tile">
          <div class="sname"><span><i class="fa-solid <?php echo e($c['icon']); ?>" style="color:var(--teal);margin-right:6px;"></i><?php echo e($c['name']); ?></span></div>
          <div class="field" style="margin:8px 0 4px;">
            <select name="sev[<?php echo e($c['id']); ?>]">
              <?php foreach (SEVERITY_LEVELS as $lvl): ?>
                <option value="<?php echo e($lvl); ?>"><?php echo e($lvl); ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="grid grid-2" style="gap:6px;">
            <select name="dur[<?php echo e($c['id']); ?>]">
              <?php foreach (DURATION_LEVELS as $d): ?><option value="<?php echo e($d); ?>"><?php echo e($d); ?></option><?php endforeach; ?>
            </select>
            <select name="freq[<?php echo e($c['id']); ?>]">
              <?php foreach (FREQUENCY_LEVELS as $f): ?><option value="<?php echo e($f); ?>"><?php echo e($f); ?></option><?php endforeach; ?>
            </select>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:18px;" type="submit"><i class="fa-solid fa-diagram-project"></i> Submit &amp; Run Risk Analysis</button>
  </form>
</div>

<?php render_footer(); ?>
