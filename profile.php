<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$p = $stmt->fetch() ?: [];
$rh = get_risk_history($pdo, $u['id']);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST'){
    $action = $_POST['action'] ?? 'update_profile';

    if ($action === 'new_pregnancy') {
        $title = trim($_POST['title'] ?? '');
        $edd = !empty($_POST['edd']) ? $_POST['edd'] : null;
        $notes = trim($_POST['notes'] ?? '');
        add_new_pregnancy($pdo, $u['id'], $title, $edd, $notes);
        flash('New pregnancy added successfully! Your dashboard has been updated.', 'success');
        redirect('profile.php');
    }

    if ($action === 'switch_pregnancy') {
        $pid = $_POST['pregnancy_id'] ?? '';
        if ($pid) {
            switch_active_pregnancy($pdo, $u['id'], $pid);
            flash('Switched active pregnancy.', 'success');
        }
        redirect('profile.php');
    }

    $height = isset($_POST['height_cm']) ? (float)$_POST['height_cm'] : ($p['height_cm'] ?? null);
    $weight = isset($_POST['weight_kg']) ? (float)$_POST['weight_kg'] : ($p['weight_kg'] ?? null);
    $bloodType = isset($_POST['blood_type']) ? trim($_POST['blood_type']) : ($p['blood_type'] ?? '');
    $stmt = $pdo->prepare("REPLACE INTO patient_profiles
        (user_id, dob, age, height_cm, weight_kg, blood_type, occupation, lmp, edd, gravida, prior_miscarriage, prior_csection, conditions, phone, address, emergency_name, emergency_relation, emergency_phone)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $age = $_POST['dob'] ? (int)((time() - strtotime($_POST['dob'])) / (365.25*86400)) : null;
    $lmp = !empty($_POST['lmp']) ? $_POST['lmp'] : ($p['lmp'] ?? null);
    $edd = $lmp ? date('Y-m-d', strtotime($lmp.' + 280 days')) : ($p['edd'] ?? null);
    $stmt->execute([
        $u['id'], $_POST['dob'] ?: null, $age, $height ?: null, $weight ?: null,
        $bloodType, trim($_POST['occupation'] ?? ''), $lmp, $edd,
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

$pregnancies = get_user_pregnancies($pdo, $u['id']);

render_header('Profile', 'profile');
?>

<!-- Pregnancies Management Card -->
<div class="card" style="margin-bottom:16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
    <div>
      <div class="eyebrow" style="margin-bottom:2px;">Mother's Journey</div>
      <h3 style="margin:0;font-size:18px;">Pregnancies</h3>
    </div>
    <button type="button" class="btn btn-sm" onclick="pcOpenNewPregnancyModal()" style="background:linear-gradient(135deg, #f472b6 0%, #db2777 50%, #b04a6e 100%);color:#fff;border:none;border-radius:12px;padding:9px 16px;font-weight:700;display:inline-flex;align-items:center;gap:6px;box-shadow:0 3px 10px rgba(219,39,119,0.3);cursor:pointer;">
      <i class="fa-solid fa-plus"></i> New Pregnancy
    </button>
  </div>

  <div style="display:flex;flex-direction:column;gap:10px;">
    <?php foreach ($pregnancies as $preg): ?>
      <?php $isActive = ($preg['status'] === 'active'); ?>
      <div style="background:<?php echo $isActive ? '#fdf2f8' : '#f8fafc'; ?>;border:1.5px solid <?php echo $isActive ? '#fbcfe8' : '#e2e8f0'; ?>;border-radius:16px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:42px;height:42px;border-radius:50%;background:<?php echo $isActive ? '#fce7f3' : '#e2e8f0'; ?>;color:<?php echo $isActive ? '#db2777' : '#64748b'; ?>;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
            <i class="fa-solid fa-baby"></i>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:800;font-size:15px;color:#1e293b;"><?php echo e($preg['title']); ?></span>
              <?php if ($isActive): ?>
                <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;">ACTIVE</span>
              <?php else: ?>
                <span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;">COMPLETED</span>
              <?php endif; ?>
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              <?php if (!empty($preg['edd'])): ?>
                Due Date: <strong><?php echo fmt_date($preg['edd']); ?></strong>
              <?php else: ?>
                Due Date: <em>Not set</em>
              <?php endif; ?>
              <?php if (!empty($preg['notes'])): ?>
                &bull; <?php echo e($preg['notes']); ?>
              <?php endif; ?>
            </div>
          </div>
        </div>

        <?php if (!$isActive): ?>
          <form method="post" action="profile.php" style="margin:0;">
            <input type="hidden" name="action" value="switch_pregnancy">
            <input type="hidden" name="pregnancy_id" value="<?php echo e($preg['id']); ?>">
            <button type="submit" class="btn btn-outline btn-sm" style="border-radius:10px;font-size:12px;">
              <i class="fa-solid fa-arrow-rotate-right"></i> Set as Active
            </button>
          </form>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </div>
</div>

<!-- Modal: New Pregnancy -->
<div class="ed-modal-backdrop" id="newPregnancyModal" style="display:none;" onclick="if(event.target===this) pcCloseNewPregnancyModal()">
  <div class="ed-modal" style="max-width:400px;border-radius:24px;padding:22px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:#1e293b;">New Pregnancy</div>
        <div style="font-size:12px;color:#64748b;">Start a new pregnancy tracking journey</div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseNewPregnancyModal()"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <form method="post" action="profile.php">
      <input type="hidden" name="action" value="new_pregnancy">
      <div class="field">
        <label>Pregnancy Title / Nickname</label>
        <input type="text" name="title" placeholder="e.g. Baby #2 or 2nd Pregnancy" required>
      </div>
      <div class="field">
        <label>Expected Due Date (EDD)</label>
        <input type="date" name="edd" required>
      </div>
      <div class="field">
        <label>Notes / Details (Optional)</label>
        <textarea name="notes" rows="2" placeholder="e.g. Conceived in spring, excited for baby #2"></textarea>
      </div>
      <p style="font-size:11.5px;color:#64748b;margin:6px 0 14px;">Starting a new pregnancy will make it your active pregnancy and safely archive previous records in history.</p>
      <button type="submit" class="btn btn-primary btn-block" style="background:linear-gradient(135deg, #f472b6 0%, #db2777 50%, #b04a6e 100%);border:none;border-radius:14px;padding:12px;font-weight:700;">
        <i class="fa-solid fa-heart"></i> Start Pregnancy Journey
      </button>
    </form>
  </div>
</div>

<script>
function pcOpenNewPregnancyModal(){
  var m = document.getElementById('newPregnancyModal');
  if(m) m.style.display = 'flex';
}
function pcCloseNewPregnancyModal(){
  var m = document.getElementById('newPregnancyModal');
  if(m) m.style.display = 'none';
}
</script>
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
    <div class="field"><label>Gravida (# pregnancies)</label><input type="number" name="gravida" value="<?php echo e($p['gravida'] ?? 1); ?>"></div>
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
