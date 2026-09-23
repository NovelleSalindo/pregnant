<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$p = $stmt->fetch() ?: [];
$rh = get_risk_history($pdo, $u['id']);

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $height = isset($_POST['height_cm']) ? (float)$_POST['height_cm'] : ($p['height_cm'] ?? null);
    $weight = isset($_POST['weight_kg']) ? (float)$_POST['weight_kg'] : ($p['weight_kg'] ?? null);
    $bloodType = isset($_POST['blood_type']) ? trim($_POST['blood_type']) : ($p['blood_type'] ?? '');
    $stmt = $pdo->prepare("REPLACE INTO patient_profiles
        (user_id, dob, age, height_cm, weight_kg, blood_type, occupation, lmp, edd, gravida, prior_miscarriage, prior_csection, conditions, phone, address, emergency_name, emergency_relation, emergency_phone)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $age = $_POST['dob'] ? (int)((time() - strtotime($_POST['dob'])) / (365.25*86400)) : null;
    $edd = $_POST['lmp'] ? date('Y-m-d', strtotime($_POST['lmp'].' + 280 days')) : null;
    $stmt->execute([
        $u['id'], $_POST['dob'] ?: null, $age, $height ?: null, $weight ?: null,
        $bloodType, trim($_POST['occupation'] ?? ''), $_POST['lmp'] ?: null, $edd,
        (int)($_POST['gravida'] ?? 1), isset($_POST['prior_miscarriage'])?1:0, isset($_POST['prior_csection'])?1:0,
        trim($_POST['conditions'] ?? 'None'), trim($_POST['phone'] ?? ''), trim($_POST['address'] ?? ''),
        trim($_POST['emergency_name'] ?? ''), trim($_POST['emergency_relation'] ?? ''), trim($_POST['emergency_phone'] ?? ''),
    ]);

    // Reproductive History (RH) + Medical/Surgical Conditions (MC) — feeds the clinical risk-scoring rules
    $rhFields = [
        'prior_abortions_or_infertility','prev_pp_hemorrhage','prev_manual_placenta_removal',
        'prev_baby_over_9lb','prev_baby_over_5lb8oz','prev_toxemia_hpn','prev_abnormal_labor',
        'prev_gyn_disease','chronic_renal_disease','gestational_diabetes','class_b_diabetes_or_higher',
        'cardiac_disease', 'asthma', 'tuberculosis', 'pulmonary_embolism', 'hyperthyroidism', 
        'hypothyroidism', 'epilepsy', 'torch_infection', 'pyelonephritis_uti'
    ];
    $rhVals = [];
    foreach ($rhFields as $f) $rhVals[$f] = isset($_POST[$f]) ? 1 : 0;
    $otherScore = max(0, min(5, (int)($_POST['other_significant_disease_score'] ?? 0)));
    $stmt = $pdo->prepare("REPLACE INTO risk_history
        (user_id, parity, prior_abortions_or_infertility, prev_pp_hemorrhage, prev_manual_placenta_removal, prev_baby_over_9lb, prev_baby_over_5lb8oz, prev_toxemia_hpn, prev_abnormal_labor, prev_gyn_disease, chronic_renal_disease, gestational_diabetes, class_b_diabetes_or_higher, cardiac_disease, other_significant_disease_score, asthma, tuberculosis, pulmonary_embolism, hyperthyroidism, hypothyroidism, epilepsy, torch_infection, pyelonephritis_uti)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $u['id'], (int)($_POST['parity'] ?? 0),
        $rhVals['prior_abortions_or_infertility'], $rhVals['prev_pp_hemorrhage'], $rhVals['prev_manual_placenta_removal'],
        $rhVals['prev_baby_over_9lb'], $rhVals['prev_baby_over_5lb8oz'], $rhVals['prev_toxemia_hpn'], $rhVals['prev_abnormal_labor'],
        $rhVals['prev_gyn_disease'], $rhVals['chronic_renal_disease'], $rhVals['gestational_diabetes'],
        $rhVals['class_b_diabetes_or_higher'], $rhVals['cardiac_disease'], $otherScore,
        $rhVals['asthma'], $rhVals['tuberculosis'], $rhVals['pulmonary_embolism'], $rhVals['hyperthyroidism'],
        $rhVals['hypothyroidism'], $rhVals['epilepsy'], $rhVals['torch_infection'], $rhVals['pyelonephritis_uti']
    ]);
    $pdo->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([trim($_POST['name']), $u['id']]);
    flash('Profile updated.', 'success');
    log_action('profile_update');
    redirect('profile.php');
}

render_header('Profile', 'profile');
?>

<div class="card">
  <h3 style="margin-top:0;">My Profile</h3>
  <form method="post" action="profile.php">
    <div class="grid grid-2">
      <div class="field"><label>Full Name</label><input type="text" name="name" value="<?php echo e($u['name']); ?>" required></div>
      <div class="field">
        <label>Email</label>
        <input type="email" value="<?php echo e($u['email']); ?>" disabled>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="field"><label>Date of Birth</label><input type="date" name="dob" value="<?php echo e($p['dob'] ?? ''); ?>"></div>
      <div class="field"><label>Occupation</label><input type="text" name="occupation" value="<?php echo e($p['occupation'] ?? ''); ?>"></div>
    </div>
    <div class="grid grid-2">
      <div class="field"><label>Gravida (# pregnancies)</label><input type="number" name="gravida" value="<?php echo e($p['gravida'] ?? 1); ?>"></div>
      <div class="field"><label>Last Menstrual Period</label><input type="date" name="lmp" value="<?php echo e($p['lmp'] ?? ''); ?>"></div>
    </div>
    <div class="field"><label>Known Conditions</label><input type="text" name="conditions" value="<?php echo e($p['conditions'] ?? 'None'); ?>"></div>
    <div class="grid grid-2">
      <label class="chip <?php echo !empty($p['prior_miscarriage'])?'on':''; ?>" style="cursor:pointer;">
        <input type="checkbox" name="prior_miscarriage" <?php echo !empty($p['prior_miscarriage'])?'checked':''; ?> style="margin-right:8px;"> Prior Miscarriage
      </label>
      <label class="chip <?php echo !empty($p['prior_csection'])?'on':''; ?>" style="cursor:pointer;">
        <input type="checkbox" name="prior_csection" <?php echo !empty($p['prior_csection'])?'checked':''; ?> style="margin-right:8px;"> Prior C-Section
      </label>
    </div>
    <div class="divider"></div>
    <div class="eyebrow">Reproductive &amp; Medical History</div>
    <p class="muted" style="margin-top:-4px;font-size:12.5px;">Feeds your clinical risk score (RH + MC rules) — fill in what applies.</p>
    <div class="grid grid-2">
      <div class="field"><label>Parity (# of live births)</label><input type="number" min="0" name="parity" value="<?php echo e($rh['parity'] ?? 0); ?>"></div>
      <div class="field"><label>Other significant disease severity (0–5)</label><input type="number" min="0" max="5" name="other_significant_disease_score" value="<?php echo e($rh['other_significant_disease_score'] ?? 0); ?>"></div>
    </div>
    <div class="grid grid-2" style="gap:8px;">
      <?php
      $rhChecks = [
        'prior_abortions_or_infertility' => '2+ prior abortions or infertility history',
        'prev_pp_hemorrhage' => 'Previous postpartum hemorrhage',
        'prev_manual_placenta_removal' => 'Previous manual removal of placenta',
        'prev_baby_over_9lb' => 'Previous baby over 9 lb',
        'prev_baby_over_5lb8oz' => 'Previous baby over 5 lb 8 oz',
        'prev_toxemia_hpn' => 'Previous toxemia / hypertension',
        'prev_abnormal_labor' => 'Previous abnormal or difficult labor',
        'prev_gyn_disease' => 'Previous gynecological disease',
        'chronic_renal_disease' => 'Chronic renal disease',
        'gestational_diabetes' => 'Gestational diabetes',
        'class_b_diabetes_or_higher' => 'Class B diabetes or higher',
        'cardiac_disease' => 'Cardiac disease',
        'asthma' => 'Asthma',
        'tuberculosis' => 'Tuberculosis',
        'pulmonary_embolism' => 'Pulmonary Embolism',
        'hyperthyroidism' => 'Hyperthyroidism',
        'hypothyroidism' => 'Hypothyroidism',
        'epilepsy' => 'Epilepsy',
        'torch_infection' => 'TORCH Infection',
        'pyelonephritis_uti' => 'Pyelonephritis / UTI',
      ];
      foreach ($rhChecks as $field => $label):
      ?>
        <label class="chip" style="cursor:pointer;">
          <input type="checkbox" name="<?php echo e($field); ?>" <?php echo !empty($rh[$field])?'checked':''; ?> style="margin-right:8px;"> <?php echo e($label); ?>
        </label>
      <?php endforeach; ?>
    </div>
    <div class="divider"></div>
    <div class="grid grid-2">
      <div class="field"><label>Phone</label><input type="text" name="phone" value="<?php echo e($p['phone'] ?? ''); ?>"></div>
      <div class="field"><label>Address</label><input type="text" name="address" value="<?php echo e($p['address'] ?? ''); ?>"></div>
    </div>
    <div class="grid grid-3">
      <div class="field"><label>Emergency Contact Name</label><input type="text" name="emergency_name" value="<?php echo e($p['emergency_name'] ?? ''); ?>"></div>
      <div class="field"><label>Relation</label><input type="text" name="emergency_relation" value="<?php echo e($p['emergency_relation'] ?? ''); ?>"></div>
      <div class="field"><label>Emergency Phone</label><input type="text" name="emergency_phone" value="<?php echo e($p['emergency_phone'] ?? ''); ?>"></div>
    </div>
    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Profile</button>
  </form>
</div>

<?php render_footer(); ?>
