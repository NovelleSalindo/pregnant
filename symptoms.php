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

    // 1b. Save this check-in's Present Pregnancy Problems (PP rules from the clinical rule table)
    $ppFields = ['bleeding_lt_20wks','bleeding_gt_20wks','postmaturity_prematurity','hypertension','prom','poly_oligohydramnios','iugr','multiple_pregnancy','breech_malpresentation','rh_isoimmunization'];
    $pp = [];
    foreach ($ppFields as $f) $pp[$f] = isset($_POST['pp'][$f]) ? 1 : 0;
    $pdo->prepare("INSERT INTO pregnancy_problems
        (id, user_id, symptom_log_id, date, bleeding_lt_20wks, bleeding_gt_20wks, postmaturity_prematurity, hypertension, prom, poly_oligohydramnios, iugr, multiple_pregnancy, breech_malpresentation, rh_isoimmunization)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            uid('pp'), $u['id'], $logId, now_iso(),
            $pp['bleeding_lt_20wks'], $pp['bleeding_gt_20wks'], $pp['postmaturity_prematurity'], $pp['hypertension'],
            $pp['prom'], $pp['poly_oligohydramnios'], $pp['iugr'], $pp['multiple_pregnancy'],
            $pp['breech_malpresentation'], $pp['rh_isoimmunization'],
        ]);

    // 2. Pull latest vitals + profile + reproductive/medical history to build the engine input
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id']]);
    $vitals = $stmt->fetch() ?: [];

    $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$u['id']]);
    $profile = $stmt->fetch() ?: [];

    $riskHistory = get_risk_history($pdo, $u['id']);
    $riskHistory['prev_cesarean'] = !empty($profile['prior_csection']); // reuse the existing profile field for RH-12

    $age = $profile['age'] ?? 28;
    $trimester = 2;
    if (!empty($profile['lmp'])){
        $weeks = floor((time() - strtotime($profile['lmp'])) / (7*86400));
        $trimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
    }
    $bmi = !empty($vitals['bmi']) ? (float)$vitals['bmi'] : bmi_of($profile['weight_kg'] ?? 62, $profile['height_cm'] ?? 160);
    $hemoglobin = (float)($vitals['hemoglobin'] ?? 12);

    $input = [
        'age' => (int)$age,
        'trimester' => $trimester,
        'bp_sys' => (int)($vitals['bp_sys'] ?? 118),
        'bp_dia' => (int)($vitals['bp_dia'] ?? 76),
        'bmi' => $bmi,
        'hemoglobin' => $hemoglobin,
        'blood_sugar' => (int)($vitals['blood_sugar'] ?? 95),
        'riskHistory' => $riskHistory,
        'pregnancyProblems' => $pp,
        'symptoms' => $symptoms,
    ];

    // 3. Run the clinical rule-based (RH/MC/PP) + fuzzy + acute-symptom rule engine
    $ruleBase = get_rule_base();
    $result = assess_risk($input, $ruleBase, $catalog);

    // 4. Persist assessment (ahp_json column name kept for schema compatibility;
    //    it now stores the structural RH/MC/PP rule breakdown instead)
    $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            uid('asm'), $u['id'], now_iso(), $result['score'], $result['level'],
            $result['structural']['total'], $result['fuzzy']['centroid'],
            json_encode($result['structural']), json_encode($result['fuzzy']),
            json_encode($result['rules']), json_encode($result['recommendations']),
        ]);

    if ($result['level'] === 'Severe'){
        $reasonHits = array_merge($result['rules'], $result['structural']['hits']);
        $reasonText = $reasonHits ? $reasonHits[0]['text'] ?? $reasonHits[0]['label'] ?? '' : '';
        $body = 'Your latest symptom check-in flagged a SEVERE risk pattern' . ($reasonText ? " ({$reasonText})" : '') . '. Please contact your OB-GYN or go to the nearest hospital now.';
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, kind) VALUES (?,?,?,?,?,?)")
            ->execute([uid('ntf'), $u['id'], 'Emergency: Severe Risk Detected', $body, now_iso(), 'emergency']);
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
            <select class="select-pill" name="sev[<?php echo e($c['id']); ?>]">
              <?php foreach (SEVERITY_LEVELS as $lvl): ?>
                <option value="<?php echo e($lvl); ?>"><?php echo e($lvl); ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="grid grid-2" style="gap:6px;">
            <select class="select-pill" name="dur[<?php echo e($c['id']); ?>]">
              <?php foreach (DURATION_LEVELS as $d): ?><option value="<?php echo e($d); ?>"><?php echo e($d); ?></option><?php endforeach; ?>
            </select>
            <select class="select-pill" name="freq[<?php echo e($c['id']); ?>]">
              <?php foreach (FREQUENCY_LEVELS as $f): ?><option value="<?php echo e($f); ?>"><?php echo e($f); ?></option><?php endforeach; ?>
            </select>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <div class="divider" style="margin-top:20px;"></div>
    <div class="eyebrow">Present Pregnancy Problems</div>
    <p class="muted" style="margin-top:-4px;font-size:12.5px;">Check anything that applies to this pregnancy right now — these feed directly into your clinical risk score.</p>
    <div class="grid grid-2" style="gap:8px;margin-top:8px;">
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[bleeding_lt_20wks]" style="margin-right:8px;"> Bleeding before 20 weeks</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[bleeding_gt_20wks]" style="margin-right:8px;"> Bleeding after 20 weeks</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[postmaturity_prematurity]" style="margin-right:8px;"> Postmaturity / prematurity</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[hypertension]" style="margin-right:8px;"> Hypertension (diagnosed)</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[prom]" style="margin-right:8px;"> Premature rupture of membrane</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[poly_oligohydramnios]" style="margin-right:8px;"> Polyhydramnios / oligohydramnios</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[iugr]" style="margin-right:8px;"> Intrauterine growth restriction</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[multiple_pregnancy]" style="margin-right:8px;"> Multiple pregnancy</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[breech_malpresentation]" style="margin-right:8px;"> Breech / malpresentation</label>
      <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[rh_isoimmunization]" style="margin-right:8px;"> Rh isoimmunization</label>
    </div>

    <button class="btn btn-primary btn-block" style="margin-top:18px;" type="submit"><i class="fa-solid fa-diagram-project"></i> Submit &amp; Run Risk Analysis</button>
  </form>
</div>

<?php render_footer(); ?>
