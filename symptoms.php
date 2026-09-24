<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$catalog = get_symptom_catalog();

// Fetch latest recorded vitals for pre-filling form
$stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$latestVitals = $stmt->fetch() ?: [];

// Fetch patient profile for Coopland factors
$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$profileGet = $stmt->fetch() ?: [];

// Fetch Coopland factors metadata
$stmt = $pdo->query("SELECT * FROM coopland_factors");
$cooplandFactors = $stmt->fetchAll(PDO::FETCH_ASSOC);

$validationErrors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    // 1. Validate inputs per RULES.docx Rule 24
    $validationErrors = validate_maternal_inputs($_POST);

    if (!empty($validationErrors)){
        foreach ($validationErrors as $err){
            flash($err, 'danger');
        }
    } else {
        // 2. Save symptom log
        $logId = uid('sym');
        $pdo->prepare("INSERT INTO symptom_logs (id, user_id, date) VALUES (?,?,?)")->execute([$logId, $u['id'], now_iso()]);

        $symptoms = [];
        $symptomIntensities = [];

        foreach ($catalog as $c){
            $sid = $c['id'];
            $severity = $_POST['sev'][$sid] ?? 'None';
            $intensity = isset($_POST['intensity'][$sid]) && $_POST['intensity'][$sid] !== ''
                ? (float)$_POST['intensity'][$sid]
                : severity_label_to_intensity($severity);

            $symptomIntensities[$sid] = $intensity;

            if ($severity === 'None' && $intensity <= 0) continue;

            $duration = $_POST['dur'][$sid] ?? 'Today';
            $frequency = $_POST['freq'][$sid] ?? 'Rare';
            $pdo->prepare("INSERT INTO symptom_log_items (id, symptom_log_id, symptom_id, severity, duration, frequency) VALUES (?,?,?,?,?,?)")
                ->execute([uid('sli'), $logId, $sid, $severity, $duration, $frequency]);
            $symptoms[] = ['id'=>$sid, 'severity'=>$severity, 'duration'=>$duration, 'frequency'=>$frequency];
        }

        // Ensure all catalog symptoms are present in the engine input
        $presentIds = array_column($symptoms, 'id');
        foreach ($catalog as $c){
            if (!in_array($c['id'], $presentIds)){
                $symptoms[] = ['id'=>$c['id'], 'severity'=>'None', 'duration'=>'Today', 'frequency'=>'Rare'];
            }
        }

        // 3. Save Present Pregnancy Problems (PP)
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

        // 4. Save Vitals to monitoring table if submitted
        $bpSys = !empty($_POST['bp_sys']) ? (int)$_POST['bp_sys'] : ($latestVitals['bp_sys'] ?? 118);
        $bpDia = !empty($_POST['bp_dia']) ? (int)$_POST['bp_dia'] : ($latestVitals['bp_dia'] ?? 76);
        $tempVal = !empty($_POST['temp']) ? (float)$_POST['temp'] : ($latestVitals['temp'] ?? 36.8);
        $hrVal = !empty($_POST['heart_rate']) ? (int)$_POST['heart_rate'] : ($latestVitals['heart_rate'] ?? 78);
        $sugarVal = !empty($_POST['blood_sugar']) ? (int)$_POST['blood_sugar'] : ($latestVitals['blood_sugar'] ?? 95);
        $sugarTiming = $_POST['glucose_timing'] ?? 'preprandial';

        if (!empty($_POST['bp_sys']) || !empty($_POST['temp']) || !empty($_POST['blood_sugar'])){
            $pdo->prepare("INSERT INTO monitoring (id, user_id, date, bp_sys, bp_dia, temp, heart_rate, blood_sugar) VALUES (?,?,?,?,?,?,?,?)")
                ->execute([uid('mon'), $u['id'], now_iso(), $bpSys, $bpDia, $tempVal, $hrVal, $sugarVal]);
        }

        // 5. Gather profile and historical risk factors
        $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
        $stmt->execute([$u['id']]);
        $profile = $stmt->fetch() ?: [];

        $riskHistory = get_risk_history($pdo, $u['id']);
        $riskHistory['prev_cesarean'] = !empty($profile['prior_csection']);

        $age = $profile['age'] ?? 28;
        $trimester = 2;
        if (!empty($profile['lmp'])){
            $weeks = floor((time() - strtotime($profile['lmp'])) / (7*86400));
            $trimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
        }
        $bmi = !empty($latestVitals['bmi']) ? (float)$latestVitals['bmi'] : bmi_of($profile['weight_kg'] ?? 62, $profile['height_cm'] ?? 160);
        $hemoglobin = (float)($latestVitals['hemoglobin'] ?? 12);

        // Emergency indicator inputs from RULES.docx
        $swollenLocs = isset($_POST['swollen_locs']) && is_array($_POST['swollen_locs']) ? $_POST['swollen_locs'] : [];
        $swollenCount = count($swollenLocs);

        $input = [
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
            'symptoms' => $symptoms,
            'symptom_intensities' => $symptomIntensities,
            'swollen_locations' => $swollenLocs,
            'swollen_locations_count' => $swollenCount,
            'fever_with_chills' => !empty($_POST['fever_with_chills']),
            'fever_with_sweating' => !empty($_POST['fever_with_sweating']),
            'breathing_difficulty' => !empty($_POST['breathing_difficulty']),
            'breathing_with_sound' => !empty($_POST['breathing_with_sound']),
            'belly_pain_with_hard_abdomen' => !empty($_POST['belly_pain_with_hard_abdomen']),
            'belly_pain_with_bleeding' => !empty($_POST['belly_pain_with_bleeding']),
            'loss_of_vaginal_fluid' => !empty($_POST['loss_of_vaginal_fluid']),
            'decreased_fetal_movement' => !empty($_POST['decreased_fetal_movement']),
            'discomfort_during_urination' => !empty($_POST['discomfort_during_urination']),
            'diabetes_symptoms_count' => (int)($_POST['diabetes_symptoms_count'] ?? 0),
            'preeclampsia_symptoms_count' => (int)($_POST['preeclampsia_symptoms_count'] ?? 0),
            'belly_pain_symptoms_count' => (int)($_POST['belly_pain_symptoms_count'] ?? 0),
        ];

        // 6. Execute Master Fuzzy Decision Support Pipeline
        $ruleBase = get_rule_base();
        $result = assess_risk($input, $ruleBase, $catalog, $pdo);

        // 7. Persist assessment record
        $asmId = uid('asm');
        $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $asmId, $u['id'], now_iso(), $result['score'], $result['level'],
                $result['structural']['total'], $result['fuzzy']['centroid'],
                json_encode($result['structural']), json_encode($result['fuzzy']),
                json_encode($result['main_contributors']), json_encode($result['recommendations']),
            ]);

        // --- New Coopland & Clinical Alert logic ---
        require_once __DIR__ . '/coopland_engine.php';
        require_once __DIR__ . '/symptom_alert_engine.php';
        
        $cooplandResult = evaluate_coopland($u['id'], $pdo, $symptoms, $pp);
        $vitalsData = [
            'bp_sys' => $bpSys,
            'bp_dia' => $bpDia,
            'temp' => $tempVal,
            'heart_rate' => $hrVal,
            'blood_sugar' => $sugarVal
        ];
        $clinicalAlerts = evaluate_clinical_alerts($u['id'], $pdo, $symptoms, $vitalsData);
        // -----------------------------------------

        // If any critical acute symptoms were reported, record an urgent notification
        if (!empty($clinicalAlerts['has_critical'])) {
            $critMsg = implode('; ', array_column($clinicalAlerts['alerts'] ?? [], 'message'));
            if (!$critMsg && !empty($clinicalAlerts['alerts'][0]['title'])) {
                $critMsg = $clinicalAlerts['alerts'][0]['title'];
            }
            try {
                $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
                    ->execute([uid('ntf'), $u['id'], '🚨 Urgent: Critical Symptoms Detected', $critMsg ?: 'Critical maternal symptoms reported. Please seek immediate medical evaluation.', now_iso(), 'severe_risk_alert']);
            } catch (Exception $e) {}
        }

        log_action('symptom_fuzzy_checkin_and_assess');
        flash("Symptom check-in completed. Your personalized clinical advice has been updated.", "success");
        redirect("recommendations.php?a={$asmId}&c=" . ($cooplandResult['id'] ?? ''));
    }
}

render_header('Symptom Check-in', 'symptoms');
?>

<div class="card">
  <div class="eyebrow">PregnaCare Decision Support</div>
  <h2 style="margin-top:6px;font-size:22px;">Comprehensive Symptom &amp; Vitals Check-in</h2>
  <p class="muted" style="font-size:13.5px;margin-top:4px;">
    Share how you are feeling today and your latest health readings. Our clinical fuzzy logic engine analyzes symptom intensity, vital signs, and risk factors to provide personalized prenatal guidance.
  </p>

  <form method="post" action="symptoms.php" id="checkinForm">
    <!-- A. Pregnancy Information & B. Coopland Risk Factors -->
    <div style="background:var(--bg-soft);border-radius:14px;padding:18px;margin-top:16px;border:1px solid var(--border);">
      <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:12px;">
        <i class="fa-solid fa-clipboard-user" style="color:var(--teal);margin-right:8px;"></i>A. Pregnancy Information
      </div>
      <div class="grid grid-4" style="gap:14px;">
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Age</label>
          <input type="number" name="age" class="input" value="<?php echo e($profileGet['age'] ?? ''); ?>" readonly />
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Gestational Weeks</label>
          <?php 
          $weeks = '';
          if (!empty($profileGet['lmp'])) {
              $weeks = floor((time() - strtotime($profileGet['lmp'])) / (7*86400));
          }
          ?>
          <input type="number" name="gestational_weeks" class="input" value="<?php echo e($weeks); ?>" readonly />
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Gravida</label>
          <input type="number" name="gravida" class="input" value="<?php echo e($profileGet['gravida'] ?? ''); ?>" readonly />
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Prior Miscarriage</label>
          <input type="text" class="input" value="<?php echo !empty($profileGet['prior_miscarriage']) ? 'Yes' : 'No'; ?>" readonly />
        </div>
      </div>
      
      <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:12px;margin-top:20px;">
        <i class="fa-solid fa-scale-balanced" style="color:var(--teal);margin-right:8px;"></i>B. Coopland Risk Factors (Auto-detected from profile)
      </div>
      <div class="grid grid-2" style="gap:10px;">
        <?php foreach ($cooplandFactors as $f): ?>
            <?php 
                $hasFactor = false;
                $profileAge = $profileGet['age'] ?? 20;
                if ($f['factor_key'] == 'age_under_16' && $profileAge < 16) $hasFactor = true;
                if ($f['factor_key'] == 'age_16_35' && $profileAge >= 16 && $profileAge <= 35) $hasFactor = true;
                if ($f['factor_key'] == 'age_over_35' && $profileAge > 35) $hasFactor = true;
                
                $parity = max(0, ($profileGet['gravida'] ?? 1) - 1);
                if ($f['factor_key'] == 'parity_0' && $parity == 0) $hasFactor = true;
                if ($f['factor_key'] == 'parity_1_4' && $parity >= 1 && $parity <= 4) $hasFactor = true;
                if ($f['factor_key'] == 'parity_over_4' && $parity > 4) $hasFactor = true;
                
                if ($f['factor_key'] == 'prior_miscarriage' && !empty($profileGet['prior_miscarriage'])) $hasFactor = true;
                if ($f['factor_key'] == 'prior_csection' && !empty($profileGet['prior_csection'])) $hasFactor = true;
                
                $conds = strtolower($profileGet['conditions'] ?? '');
                if ($f['factor_key'] == 'prior_preeclampsia' && strpos($conds, 'preeclampsia') !== false) $hasFactor = true;
                if ($f['factor_key'] == 'chronic_hypertension' && strpos($conds, 'hypertension') !== false) $hasFactor = true;
                if ($f['factor_key'] == 'diabetes' && strpos($conds, 'diabetes') !== false) $hasFactor = true;
                if ($f['factor_key'] == 'cardiac_disease' && (strpos($conds, 'cardiac') !== false || strpos($conds, 'heart') !== false)) $hasFactor = true;
            ?>
            <label class="chip" style="<?php echo $hasFactor ? 'background:var(--primary);color:white;border-color:var(--primary);' : 'opacity:0.6;'; ?>">
                <i class="<?php echo $hasFactor ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'; ?>" style="margin-right:6px;"></i>
                <?php echo e($f['description']); ?> (+<?php echo e($f['points']); ?> pt)
            </label>
        <?php endforeach; ?>
      </div>
    </div>

    <!-- C. Vital Signs (Health Measurements) -->
    <div style="background:var(--bg-soft);border-radius:14px;padding:18px;margin-top:16px;border:1px solid var(--border);">
      <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:12px;">
        <i class="fa-solid fa-heart-pulse" style="color:var(--teal);margin-right:8px;"></i>Current Health Measurements
      </div>
      <div class="grid grid-3" style="gap:14px;">
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Systolic BP (mmHg)</label>
          <input type="number" name="bp_sys" class="input" placeholder="e.g. 118" min="60" max="240"
                 value="<?php echo e($_POST['bp_sys'] ?? ($latestVitals['bp_sys'] ?? 118)); ?>" required />
          <span class="muted" style="font-size:11px;">Optimal: 110–130 mmHg</span>
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Diastolic BP (mmHg)</label>
          <input type="number" name="bp_dia" class="input" placeholder="e.g. 76" min="30" max="150"
                 value="<?php echo e($_POST['bp_dia'] ?? ($latestVitals['bp_dia'] ?? 76)); ?>" required />
          <span class="muted" style="font-size:11px;">Optimal: 75–85 mmHg</span>
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Body Temperature (°C)</label>
          <input type="number" step="0.1" name="temp" class="input" placeholder="e.g. 36.8" min="34" max="43"
                 value="<?php echo e($_POST['temp'] ?? ($latestVitals['temp'] ?? 36.8)); ?>" required />
          <span class="muted" style="font-size:11px;">Target: &lt; 38.0°C</span>
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Heart Rate (bpm)</label>
          <input type="number" name="heart_rate" class="input" placeholder="e.g. 78" min="40" max="200"
                 value="<?php echo e($_POST['heart_rate'] ?? ($latestVitals['heart_rate'] ?? 78)); ?>" required />
          <span class="muted" style="font-size:11px;">Normal: 60–100 bpm</span>
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Blood Glucose (mg/dL)</label>
          <input type="number" name="blood_sugar" class="input" placeholder="e.g. 95" min="40" max="500"
                 value="<?php echo e($_POST['blood_sugar'] ?? ($latestVitals['blood_sugar'] ?? 95)); ?>" />
          <span class="muted" style="font-size:11px;">Target: 70–120 fasting</span>
        </div>
        <div class="field">
          <label style="font-size:12.5px;font-weight:600;">Glucose Timing</label>
          <select name="glucose_timing" class="select-pill" style="width:100%;">
            <option value="preprandial" <?php echo ($_POST['glucose_timing'] ?? 'preprandial')==='preprandial'?'selected':''; ?>>Fasting / Preprandial</option>
            <option value="postprandial" <?php echo ($_POST['glucose_timing'] ?? '')==='postprandial'?'selected':''; ?>>After Meal / Postprandial</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Symptoms Evaluation Grid -->
    <div style="margin-top:24px;">
      <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:12px;">
        <i class="fa-solid fa-list-check" style="color:var(--teal);margin-right:8px;"></i>Pregnancy Symptoms &amp; Intensity
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:-6px;margin-bottom:14px;">
        Select your severity level or specify a 0–10 scale rating for any symptoms you are currently experiencing.
      </p>

      <div class="symptom-grid">
        <?php foreach ($catalog as $c): $sid = $c['id']; ?>
          <div class="symptom-tile">
            <div class="sname">
              <span><i class="fa-solid <?php echo e($c['icon']); ?>" style="color:var(--teal);margin-right:6px;"></i><?php echo e($c['name']); ?></span>
            </div>
            <div class="field" style="margin:8px 0 4px;">
              <select class="select-pill" name="sev[<?php echo e($sid); ?>]">
                <?php foreach (SEVERITY_LEVELS as $lvl): ?>
                  <option value="<?php echo e($lvl); ?>" <?php echo ($_POST['sev'][$sid] ?? '')===$lvl?'selected':''; ?>><?php echo e($lvl); ?></option>
                <?php endforeach; ?>
              </select>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>

    <!-- Specific Maternal Indicators (RULES.docx) -->
    <div style="background:var(--bg-soft);border-radius:14px;padding:18px;margin-top:24px;border:1px solid var(--border);">
      <div style="font-weight:700;font-size:15px;color:var(--ink);margin-bottom:10px;">
        <i class="fa-solid fa-shield-halved" style="color:var(--teal);margin-right:8px;"></i>Important Symptom Characteristics
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:-4px;margin-bottom:12px;">
        Please check any specific signs that currently apply:
      </p>

      <div class="grid grid-2" style="gap:10px;">
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="loss_of_vaginal_fluid" style="margin-right:8px;" /> Loss or leakage of vaginal fluid (water broken)
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="decreased_fetal_movement" style="margin-right:8px;" /> Noticeable decrease in baby kicks / movement
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="belly_pain_with_hard_abdomen" style="margin-right:8px;" /> Abdomen feels hard or rigid with pain
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="belly_pain_with_bleeding" style="margin-right:8px;" /> Abdominal cramping accompanied by bleeding
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="breathing_with_sound" style="margin-right:8px;" /> Wheezing, stridor, or noisy breathing
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="fever_with_chills" style="margin-right:8px;" /> Fever accompanied by chills or shivering
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="fever_with_sweating" style="margin-right:8px;" /> Fever accompanied by profuse sweating
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="discomfort_during_urination" style="margin-right:8px;" /> Pain, burning, or discomfort during urination
        </label>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="one_sided_leg_swelling" style="margin-right:8px;" /> One-sided leg swelling or pain
        </label>
      </div>

      <div style="margin-top:16px;">
        <label style="font-size:13px;font-weight:600;">Swelling Locations (check all that apply):</label>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;">
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;"><input type="checkbox" name="swollen_locs[legs]" value="1" /> Legs / Ankles</label>
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;"><input type="checkbox" name="swollen_locs[feet]" value="1" /> Feet</label>
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;"><input type="checkbox" name="swollen_locs[hands]" value="1" /> Hands / Fingers</label>
          <label style="font-size:13px;display:flex;align-items:center;gap:6px;"><input type="checkbox" name="swollen_locs[face]" value="1" /> Face / Eyes</label>
        </div>
      </div>
    </div>

    <!-- Present Pregnancy Conditions (Plain Language) -->
    <div style="margin-top:24px;">
      <div class="eyebrow">Special Pregnancy Conditions</div>
      <p class="muted" style="margin-top:2px;font-size:12.5px;">Check any conditions diagnosed or monitored by your doctor or midwife:</p>
      <div class="grid grid-2" style="gap:8px;margin-top:8px;">
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[bleeding_lt_20wks]" style="margin-right:8px;"> Bleeding or spotting early in pregnancy (first 20 weeks)</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[bleeding_gt_20wks]" style="margin-right:8px;"> Bleeding later in pregnancy (after 20 weeks)</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[postmaturity_prematurity]" style="margin-right:8px;"> Early contractions or overdue baby (past 41 weeks)</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[hypertension]" style="margin-right:8px;"> High blood pressure (BP ≥ 140/90)</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[prom]" style="margin-right:8px;"> Water broke or fluid leaking early</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[poly_oligohydramnios]" style="margin-right:8px;"> Too much or too little fluid around baby</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[iugr]" style="margin-right:8px;"> Baby is smaller or growing slower than expected</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[multiple_pregnancy]" style="margin-right:8px;"> Expecting twins or triplets</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[breech_malpresentation]" style="margin-right:8px;"> Baby is feet-first or sideways (not head-down)</label>
        <label class="chip" style="cursor:pointer;"><input type="checkbox" name="pp[rh_isoimmunization]" style="margin-right:8px;"> Rh blood type difference (Rh-negative)</label>
      </div>
    </div>

    <button class="btn btn-primary btn-block" style="margin-top:22px;padding:14px;" type="submit">
      <i class="fa-solid fa-calculator" style="margin-right:8px;"></i> Submit &amp; Run Fuzzy Risk Analysis
    </button>
  </form>
</div>

<?php render_footer(); ?>
